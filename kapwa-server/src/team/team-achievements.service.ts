import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Derived per-staff achievement rollup — no new data-entry burden. Every
// metric is counted from tables the rest of the app already writes, within an
// inclusive [from, to] date range, and zero-filled so every staff member
// appears even with no activity in the range.
//
// SCHEMA DRIFT (verified against entities + migrate.ts bootstrap, 2026-09-29):
// the approved spec names `case_interventions.created_by` and
// `case_referrals.created_by` for two of these metrics, but NEITHER column
// exists in the schema:
//   - `case_interventions` has no `created_by`; its only person column is
//     `delivered_by` (TEXT, client-supplied, may hold names/'MSWDO' rather
//     than user ids). Interventions therefore count rows whose `delivered_by`
//     equals a staff user id — rows with non-id text never match and count 0.
//   - `case_referrals` has NO user column at all (id, case_id, agency, status,
//     notes, reason, contact_info, timestamps). The only referral table that
//     records a staff creator is `inter_agency_referrals.created_by` (uuid FK
//     users, set from the caller at creation in inter-agency-referrals.service).
//     Referrals therefore count `inter_agency_referrals` rows instead.
// Both deviations are flagged in .superpowers/sdd/2026-09-29-team-workspace/
// task-7-report.md; a schema migration (add `created_by` to the case child
// tables) is the clean fix if the spec is to be honored exactly.

export interface TeamStaffAchievement {
  userId: string;
  name: string;
  cases: number;
  interventions: number;
  referrals: number;
  docs: number;
  trackerDays: number;
}

export interface TeamAchievementsRollup {
  perStaff: TeamStaffAchievement[];
  range: { from: string; to: string };
}

interface CountRow {
  user_id: string;
  cases?: number;
  interventions?: number;
  referrals?: number;
  docs?: number;
  tracker_days?: number;
}

@Injectable()
export class TeamAchievementsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async rollup(from: Date, to: Date): Promise<TeamAchievementsRollup> {
    // Inclusive range: [from, to]. The upper bound is exclusive at `to + 1
    // day` so the whole of `to` (UTC midnight) is included — same convention
    // as the brief's `created_at >= from AND created_at < to + 1 day`.
    const upper = new Date(to.getTime() + 86_400_000);

    const staffRows: Array<{ id: string; first_name: string | null; last_name: string | null }> =
      await this.dataSource.query(
        `SELECT id, first_name, last_name FROM users
         WHERE role IN ('admin', 'social_worker')
         ORDER BY first_name, last_name`,
      );

    // Cases served: `case_history` rows the staff acted on (actor-based only —
    // rows whose changed_by_id is NULL belong to no staff member's count).
    const caseRows: CountRow[] = await this.dataSource.query(
      `SELECT changed_by_id AS user_id, COUNT(*)::int AS cases
       FROM case_history
       WHERE changed_by_id IS NOT NULL AND created_at >= $1 AND created_at < $2
       GROUP BY changed_by_id`,
      [from, upper],
    );

    // Interventions: see SCHEMA DRIFT note above — spec's `created_by` does
    // not exist; counted on `delivered_by`, the only person column present.
    const interventionRows: CountRow[] = await this.dataSource.query(
      `SELECT delivered_by AS user_id, COUNT(*)::int AS interventions
       FROM case_interventions
       WHERE delivered_by IS NOT NULL AND created_at >= $1 AND created_at < $2
       GROUP BY delivered_by`,
      [from, upper],
    );

    // Referrals: see SCHEMA DRIFT note above — `case_referrals` has no user
    // column; counted on `inter_agency_referrals.created_by` instead.
    const referralRows: CountRow[] = await this.dataSource.query(
      `SELECT created_by AS user_id, COUNT(*)::int AS referrals
       FROM inter_agency_referrals
       WHERE created_by IS NOT NULL AND created_at >= $1 AND created_at < $2
       GROUP BY created_by`,
      [from, upper],
    );

    // Documents issued: vault uploads by the staff, approval/requirement
    // categories only.
    const documentRows: CountRow[] = await this.dataSource.query(
      `SELECT uploaded_by AS user_id, COUNT(*)::int AS docs
       FROM document_vault
       WHERE uploaded_by IS NOT NULL
         AND category IN ('approval_document', 'requirement')
         AND created_at >= $1 AND created_at < $2
       GROUP BY uploaded_by`,
      [from, upper],
    );

    // Tracker days: distinct dates on which the staff has case_history rows
    // (same actor rule as cases served).
    const trackerRows: CountRow[] = await this.dataSource.query(
      `SELECT changed_by_id AS user_id, COUNT(DISTINCT created_at::date)::int AS tracker_days
       FROM case_history
       WHERE changed_by_id IS NOT NULL AND created_at >= $1 AND created_at < $2
       GROUP BY changed_by_id`,
      [from, upper],
    );

    const tally = <K extends keyof CountRow>(rows: CountRow[], key: K) =>
      new Map(rows.map((r) => [r.user_id, Number(r[key] ?? 0)]));

    const cases = tally(caseRows, 'cases');
    const interventions = tally(interventionRows, 'interventions');
    const referrals = tally(referralRows, 'referrals');
    const docs = tally(documentRows, 'docs');
    const trackerDays = tally(trackerRows, 'tracker_days');

    // Zero-filled: every admin + social_worker appears even with no rows.
    const perStaff: TeamStaffAchievement[] = staffRows.map((s) => ({
      userId: s.id,
      // Staff are shown as "Ana Santos" (first name first) — the same order
      // the users entity's fullName getter uses for staff.
      name: [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || 'Unnamed staff',
      cases: cases.get(s.id) ?? 0,
      interventions: interventions.get(s.id) ?? 0,
      referrals: referrals.get(s.id) ?? 0,
      docs: docs.get(s.id) ?? 0,
      trackerDays: trackerDays.get(s.id) ?? 0,
    }));

    return { perStaff, range: { from: from.toISOString(), to: to.toISOString() } };
  }
}