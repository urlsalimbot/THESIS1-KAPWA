import { MigrationInterface, QueryRunner } from 'typeorm';

export class IrfDispositionEncryption2026062200005 implements MigrationInterface {
  name = 'IrfDispositionEncryption2026062200005';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create audit_log table for IRF audit logging
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        action TEXT NOT NULL,
        reference_id TEXT,
        user_id TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_reference ON audit_log(reference_id)`);

    // 2. Create disposition enum type
    await queryRunner.query(
      `CREATE TYPE irf_disposition AS ENUM ('Under Investigation', 'Referred to PNP', 'Referred to WCPD', 'Dismissed', 'Closed')`
    );

    // 3. Add new columns to irf_cases
    await queryRunner.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS key_wraps jsonb`);
    await queryRunner.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS key_version integer DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS dismissal_reason text`);

    // 4. Add new disposition column and migrate existing data
    await queryRunner.query(
      `ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS case_disposition_new irf_disposition DEFAULT 'Under Investigation'`
    );
    await queryRunner.query(`
      UPDATE irf_cases SET case_disposition_new = 
        CASE 
          WHEN case_disposition IS NULL THEN 'Under Investigation'::irf_disposition
          WHEN case_disposition = 'Under Investigation' THEN 'Under Investigation'::irf_disposition
          WHEN case_disposition = 'Referred' THEN 'Referred to PNP'::irf_disposition
          WHEN case_disposition = 'Closed' THEN 'Closed'::irf_disposition
          ELSE 'Under Investigation'::irf_disposition
        END
    `);

    // 5. Drop old column, rename new
    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS case_disposition`);
    await queryRunner.query(`ALTER TABLE irf_cases RENAME COLUMN case_disposition_new TO case_disposition`);

    // 6. Set NOT NULL and default
    await queryRunner.query(`ALTER TABLE irf_cases ALTER COLUMN case_disposition SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE irf_cases ALTER COLUMN case_disposition SET DEFAULT 'Under Investigation'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS case_disposition_old text`);
    await queryRunner.query(`UPDATE irf_cases SET case_disposition_old = case_disposition::text`);
    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS key_wraps`);
    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS key_version`);
    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS dismissal_reason`);
    await queryRunner.query(`ALTER TABLE irf_cases DROP COLUMN IF EXISTS case_disposition`);
    await queryRunner.query(`ALTER TABLE irf_cases RENAME COLUMN IF EXISTS case_disposition_old TO case_disposition`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
    await queryRunner.query(`DROP TYPE IF EXISTS irf_disposition`);
  }
}
