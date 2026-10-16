import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for foreign keys that had none (audit §4.1).
 *
 * Postgres indexes the *referenced* side of a foreign key automatically, but
 * never the referencing column: every cascade delete, every "children of this
 * parent" lookup and every join through these columns was a sequential scan.
 * Harmless at the office's current volume, quadratic once a few years of case
 * history accumulate.
 *
 * The list was taken from the live schema (information_schema vs pg_indexes),
 * not guessed: 19 columns across 18 tables. `IF NOT EXISTS` keeps the migration
 * replay-safe.
 */
export class IndexForeignKeyColumns0000000000099 implements MigrationInterface {
  name = 'IndexForeignKeyColumns0000000000099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_access_card_services_logged_by ON access_card_services (logged_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_by ON analysis_runs (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_roles_person_id ON beneficiary_roles (person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_compliance_items_met_by ON case_compliance_items (met_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_events_created_by ON case_events (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_interventions_created_by ON case_interventions (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_interventions_program_enrollment_id ON case_interventions (program_enrollment_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_payouts_notified_by ON case_payouts (notified_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_referrals_created_by ON case_referrals (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_form_version_history_program_id ON form_version_history (program_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_households_primary_beneficiary_id ON households (primary_beneficiary_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inter_agency_referrals_created_by ON inter_agency_referrals (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_irf_cases_case_id ON irf_cases (case_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_office_events_owner_id ON office_events (owner_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_program_enrollments_created_by ON program_enrollments (created_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_case_id ON referrals (case_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_reminder_settings_updated_by ON reminder_settings (updated_by)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_team_schedule_blocks_created_by ON team_schedule_blocks (created_by)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_card_services_logged_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_analysis_runs_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_announcements_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_beneficiary_roles_person_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_compliance_items_met_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_events_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_interventions_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_interventions_program_enrollment_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_payouts_notified_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_referrals_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_form_version_history_program_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_households_primary_beneficiary_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inter_agency_referrals_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_irf_cases_case_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_office_events_owner_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_program_enrollments_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_referrals_case_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reminder_settings_updated_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_team_schedule_blocks_created_by`);
  }
}
