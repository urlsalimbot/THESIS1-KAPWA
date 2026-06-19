import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditHashChain20260619000001 implements MigrationInterface {
  name = 'AuditHashChain20260619000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add hash columns to tables that don't have them
    // Note: interventions already has hash + prev_hash — skip it
    for (const table of ['cases', 'beneficiaries', 'consent_ledger']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS hash TEXT`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS prev_hash TEXT`);
    }

    // Create idempotency_keys table for SYNC-04
    // Per RESEARCH.md Open Question 1: persist idempotency keys in DB
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key TEXT UNIQUE NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key)`);

    // Backfill hash values for existing records
    for (const table of ['cases', 'beneficiaries', 'consent_ledger']) {
      await queryRunner.query(`
        UPDATE "${table}" SET hash = encode(
          sha256(COALESCE(id::text, '') || COALESCE(created_at::text, '')),
          'hex'
        ) WHERE hash IS NULL
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['cases', 'beneficiaries', 'consent_ledger']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS hash`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS prev_hash`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`);
  }
}
