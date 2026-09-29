import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Derived per-staff achievement rollup — no new data-entry burden. Every
// metric is counted from tables the rest of the app already writes, within an
// inclusive [from, to] date range, and zero-filled so every staff member
// appears even with no activity in the range.
//
// SCHEMA HISTORY (2026-09-29): the spec names `case_interventions.created_by`
// and `case_referrals.created_by` for two of these metrics. Neither column
// existed at first implementation (case_interventions only had client-supplied
// `delivered_by` free text; case_referrals had no staff column at all), so the
// metrics were proxied on `delivered_by` / `inter_agency_referrals.created_by`.
// Migration AddCaseChildCreatedBy0000000000069 (+ the migrate.ts bootstrap)
// now adds both columns as nullable UUID FKs to users, and the creation points
// record `created_by = caller.id` (case-interventions create, cases
// updateTransitionPlan → case_referrals). Legacy rows created before the
// migration stay NULL — they count to nobody, which is the intended reading of
// a nullable author column.

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

    // Cases served: `case_history` rows the staff acted on, with the spec's
    // fallback — an entry that lacks an actor (changed_by_id NULL) is counted
    // under the case's assigned worker instead of nobody. Rows with neither
    // actor nor assigned worker drop out (group under NULL, never a staff id).
    //
    // Type note (round 2 fix): `case_history.case_id` / `changed_by_id` are
    // VARCHAR while `cases.id` / `assigned_worker_id` are UUID, so the join and
    // the COALESCE compare/merge across types. Postgres refuses `uuid =
    // varchar` outright — the uuid side is cast to text (`c.id::text`,
    // `c.assigned_worker_id::text`). `changed_by_id` is deliberately NOT cast
    // to uuid: legacy text values may not be real uuids, so uuid is normalized
    // DOWN to text instead of text being coerced up.
    const caseRows: CountRow[] = await this.dataSource.query(
      `SELECT COALESCE(ch.changed_by_id, c.assigned_worker_id::text) AS user_id, COUNT(*)::int AS cases
       FROM case_history ch
       LEFT JOIN cases c ON ch.case_id = c.id::text
       WHERE ch.created_at >= $1 AND ch.created_at < $2
         AND (ch.changed_by_id IS NOT NULL OR (ch.changed_by_id IS NULL AND c.assigned_worker_id::text IS NOT NULL))
       GROUP BY COALESCE(ch.changed_by_id, c.assigned_worker_id::text)`,
      [from, upper],
    );

    // Interventions: spec's `created_by`, recorded at creation (see SCHEMA
    // HISTORY above). Legacy NULL rows are excluded and count to nobody.
    const interventionRows: CountRow[] = await this.dataSource.query(
      `SELECT created_by AS user_id, COUNT(*)::int AS interventions
       FROM case_interventions
       WHERE created_by IS NOT NULL AND created_at >= $1 AND created_at < $2
       GROUP BY created_by`,
      [from, upper],
    );

    // Referrals: spec's `case_referrals.created_by`, recorded at creation via
    // the transition plan (see SCHEMA HISTORY above).
    const referralRows: CountRow[] = await this.dataSource.query(
      `SELECT created_by AS user_id, COUNT(*)::int AS referrals
       FROM case_referrals
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
    // (same actor + assigned-worker fallback rule as cases served — and the
    // same uuid-vs-varchar cast treatment, see the cases query above).
    const trackerRows: CountRow[] = await this.dataSource.query(
      `SELECT COALESCE(ch.changed_by_id, c.assigned_worker_id::text) AS user_id, COUNT(DISTINCT ch.created_at::date)::int AS tracker_days
       FROM case_history ch
       LEFT JOIN cases c ON ch.case_id = c.id::text
       WHERE ch.created_at >= $1 AND ch.created_at < $2
         AND (ch.changed_by_id IS NOT NULL OR (ch.changed_by_id IS NULL AND c.assigned_worker_id::text IS NOT NULL))
       GROUP BY COALESCE(ch.changed_by_id, c.assigned_worker_id::text)`,
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