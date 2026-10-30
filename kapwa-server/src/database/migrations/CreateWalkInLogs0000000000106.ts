import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Information-desk client visit log. Separate from intake/case tables:
 * inquiries and unserved visits must still be countable, and no person or case
 * is required just to record that someone came to the office.
 */
export class CreateWalkInLogs0000000000106 implements MigrationInterface {
  name = 'CreateWalkInLogs0000000000106';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS walk_in_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        queue_no INTEGER NOT NULL,
        first_name TEXT NULL,
        middle_name TEXT NULL,
        last_name TEXT NULL,
        extension TEXT NULL,
        person_id UUID NULL REFERENCES persons(id) ON DELETE SET NULL,
        case_id UUID NULL REFERENCES cases(id) ON DELETE SET NULL,
        pending_intake_id UUID NULL REFERENCES pending_intakes(id) ON DELETE SET NULL,
        referral_id UUID NULL REFERENCES inter_agency_referrals(id) ON DELETE SET NULL,
        barangay TEXT NULL,
        sex TEXT NULL,
        date_of_birth DATE NULL,
        age_band TEXT NULL,
        contact_number TEXT NULL,
        purpose_code TEXT NOT NULL,
        purpose_text TEXT NULL,
        is_new_client BOOLEAN NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        outcome TEXT NULL,
        outcome_notes TEXT NULL,
        time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        service_started_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_walk_in_logs_visited ON walk_in_logs (visited_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_walk_in_logs_status ON walk_in_logs (status, visited_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_walk_in_logs_barangay ON walk_in_logs (barangay, visited_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_walk_in_logs_purpose ON walk_in_logs (purpose_code, visited_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS walk_in_logs`);
  }
}
