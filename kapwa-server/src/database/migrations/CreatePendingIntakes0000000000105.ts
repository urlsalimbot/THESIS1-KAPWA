import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Claimant self-registrations park here until an admin/social worker consumes
 * or dismisses them. The JSON payload is the General Intake beneficiary/family
 * shape; no person, beneficiary or case exists until staff complete the intake.
 */
export class CreatePendingIntakes0000000000105 implements MigrationInterface {
  name = 'CreatePendingIntakes0000000000105';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pending_intakes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        data JSONB NOT NULL,
        reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pending_intakes_status_created ON pending_intakes (status, created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS pending_intakes`);
  }
}
