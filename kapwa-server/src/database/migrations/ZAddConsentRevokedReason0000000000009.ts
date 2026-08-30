import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAddConsentRevokedReason0000000000009 implements MigrationInterface {
  name = 'ZAddConsentRevokedReason0000000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: only ALTER if the table exists (handles alphabetical ordering vs InitialSchema)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consent_ledger') THEN
          ALTER TABLE IF EXISTS consent_ledger ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consent_ledger') THEN
          ALTER TABLE IF EXISTS consent_ledger DROP COLUMN IF EXISTS revoked_reason;
        END IF;
      END $$;
    `);
  }
}
