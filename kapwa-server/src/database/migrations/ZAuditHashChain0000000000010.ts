import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZAuditHashChain0000000000010 implements MigrationInterface {
  name = 'ZAuditHashChain0000000000010';

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
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        key TEXT UNIQUE NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key)`);

    // Runtime hash-chain writer + backfill. Chain semantics must match
    // audit.service.verifyHashChain:
    //   hash[0] = sha256('genesis'); hash[i] = sha256('{"id":"<prev.id>","hash":"<prev.hash>"}')
    await queryRunner.query(`CREATE OR REPLACE FUNCTION hash_chain_prev(hash_table TEXT, order_field TEXT, new_id UUID)
      RETURNS TABLE(prev_id UUID, prev_hash TEXT)
      LANGUAGE plpgsql VOLATILE AS $$
      DECLARE q TEXT;
      BEGIN
        q := format('SELECT id, hash FROM %I WHERE id <> $1 AND hash IS NOT NULL ORDER BY %I DESC, id DESC LIMIT 1', hash_table, order_field);
        RETURN QUERY EXECUTE q USING new_id;
      END $$;`);
    for (const [table, orderField, fnName] of [
      ['cases', 'created_at', 'hash_chain_tg_cases'],
      ['beneficiaries', 'created_at', 'hash_chain_tg_beneficiaries'],
      ['consent_ledger', 'granted_at', 'hash_chain_tg_consent_ledger'],
    ] as const) {
      await queryRunner.query(`CREATE OR REPLACE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE prev RECORD;
        BEGIN
          SELECT * INTO prev FROM hash_chain_prev('${table}', '${orderField}', NEW.id);
          IF prev.prev_id IS NULL THEN
            NEW.hash := encode(digest('genesis', 'sha256'), 'hex');
            NEW.prev_hash := NULL;
          ELSE
            NEW.prev_hash := prev.prev_hash;
            NEW.hash := encode(digest('{"id":"' || prev.prev_id::text || '","hash":"' || COALESCE(prev.prev_hash, '') || '"}', 'sha256'), 'hex');
          END IF;
          RETURN NEW;
        END $$;`);
      await queryRunner.query(`DROP TRIGGER IF EXISTS hash_chain_tg ON "${table}"`);
      await queryRunner.query(`CREATE TRIGGER hash_chain_tg BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW WHEN (NEW.hash IS NULL) EXECUTE FUNCTION ${fnName}()`);
    }
    // Backfill: recompute the whole chain in order (deterministic, idempotent).
    for (const [table, orderField] of [
      ['cases', 'created_at'],
      ['beneficiaries', 'created_at'],
      ['consent_ledger', 'granted_at'],
    ] as const) {
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE TRIGGER hash_chain_tg`);
      await queryRunner.query(`DO $$
      DECLARE r RECORD; p_id UUID; p_hash TEXT;
      BEGIN
        p_id := NULL; p_hash := NULL;
        FOR r IN SELECT id FROM "${table}" ORDER BY ${orderField} ASC, id ASC LOOP
          IF p_id IS NULL THEN
            UPDATE "${table}" SET hash = encode(digest('genesis', 'sha256'), 'hex'), prev_hash = NULL WHERE id = r.id;
          ELSE
            UPDATE "${table}" SET hash = encode(digest('{"id":"' || p_id::text || '","hash":"' || COALESCE(p_hash, '') || '"}', 'sha256'), 'hex'), prev_hash = p_hash WHERE id = r.id;
          END IF;
          SELECT hash INTO p_hash FROM "${table}" WHERE id = r.id;
          p_id := r.id;
        END LOOP;
      END $$;`);
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE TRIGGER hash_chain_tg`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['cases', 'beneficiaries', 'consent_ledger']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS hash_chain_tg ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS hash`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS prev_hash`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS hash_chain_prev(TEXT, TEXT, UUID)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS hash_chain_tg_cases()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS hash_chain_tg_beneficiaries()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS hash_chain_tg_consent_ledger()`);
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`);
  }
}
