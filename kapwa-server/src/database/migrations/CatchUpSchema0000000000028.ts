import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatchUpSchema0000000000028 implements MigrationInterface {
  name = 'CatchUpSchema0000000000028';

  async up(queryRunner: QueryRunner): Promise<void> {
    // -- Sequences --
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS csr_seq_2026 START WITH 1 INCREMENT BY 1`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS access_card_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS irf_blotter_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);

    // -- Extensions --
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    // PL/pgSQL DO block: swallows the failure internally (subtransaction) —
    // a bare try/catch cannot un-poison a Postgres transaction.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE EXTENSION IF NOT EXISTS pgaudit;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgaudit extension unavailable, skipping';
      END $$;
    `);

    // -- Indexes (idempotent) --
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beneficiaries' AND column_name = 'access_card_code') THEN
          CREATE INDEX IF NOT EXISTS idx_beneficiary_access_card ON beneficiaries(access_card_code);
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_person ON beneficiaries(person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_user ON beneficiaries(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_category_trgm ON beneficiaries USING gin (category gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_status ON cases(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_control ON cases(control_no)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_consent_beneficiary ON consent_ledger(beneficiary_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_consent_status ON consent_ledger(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_csr_case ON csr_reports(case_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_csr_control ON csr_reports(control_no)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_doc_case ON document_vault(case_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_doc_beneficiary ON document_vault(beneficiary_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(sender_id, recipient_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_name_trgm ON persons USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_person_search ON persons USING gin(search_vector)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_person ON users(person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hm_person ON household_memberships(person_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hm_household ON household_memberships(household_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bc_beneficiary ON beneficiary_claimants(beneficiary_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bc_claimant ON beneficiary_claimants(claimant_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bc_unique_primary ON beneficiary_claimants(beneficiary_id, claimant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(recipient_id, is_read)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at)`);

    // -- Supplementary columns (not yet in any TypeORM migration) --
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS approved_by_signature TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS approved_by_role VARCHAR`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS self_reliance_plan TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS referrals JSONB`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS follow_up_date DATE`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ADD COLUMN IF NOT EXISTS exit_notes TEXT`);

    await queryRunner.query(`ALTER TABLE IF EXISTS programs ADD COLUMN IF NOT EXISTS legal_basis TEXT`);
    await queryRunner.query(`ALTER TABLE IF EXISTS programs ADD COLUMN IF NOT EXISTS form_version INT DEFAULT 1`);

    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases ADD COLUMN IF NOT EXISTS key_wraps JSONB`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases ADD COLUMN IF NOT EXISTS key_version INT DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases ADD COLUMN IF NOT EXISTS dismissal_reason TEXT`);

    await queryRunner.query(`ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS consent_skipped BOOLEAN DEFAULT FALSE`);

    await queryRunner.query(`ALTER TABLE IF EXISTS document_vault ADD COLUMN IF NOT EXISTS requirement_key VARCHAR`);

    await queryRunner.query(`ALTER TABLE IF EXISTS access_card_services ADD COLUMN IF NOT EXISTS category VARCHAR`);

    // -- Missing tables (entities with no TypeORM migration) --
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS case_interventions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      case_id TEXT NOT NULL,
      program_id UUID,
      service_name TEXT NOT NULL,
      category TEXT,
      delivery_date DATE,
      amount DECIMAL(12,2),
      mode_of_delivery TEXT,
      fund_source TEXT,
      notes TEXT,
      delivered_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_case_interventions_case ON case_interventions(case_id)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS beneficiary_roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      person_id UUID NOT NULL REFERENCES persons(id),
      household_id UUID,
      user_id UUID,
      consent_status TEXT DEFAULT 'active',
      access_card_code TEXT UNIQUE,
      category TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);

    // -- case_history: drop enums, keep TEXT (avoids enum migration pain) --
    // Savepoint-guarded: a failed statement inside a PG transaction poisons
    // it — the JS catch cannot undo that, but ROLLBACK TO SAVEPOINT can.
    await queryRunner.query(`SAVEPOINT sp_case_history`);
    try {
      await queryRunner.query(`ALTER TABLE IF EXISTS case_history ALTER COLUMN from_status TYPE TEXT`);
      await queryRunner.query(`ALTER TABLE IF EXISTS case_history ALTER COLUMN to_status TYPE TEXT`);
      await queryRunner.query(`UPDATE case_history SET from_status = 'enrolled' WHERE from_status = 'pending_assessment'`);
      await queryRunner.query(`UPDATE case_history SET to_status = 'enrolled' WHERE to_status = 'pending_assessment'`);
      await queryRunner.query(`DROP TYPE IF EXISTS case_history_from_status_enum`);
      await queryRunner.query(`DROP TYPE IF EXISTS case_history_to_status_enum`);
    } catch {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT sp_case_history`);
    }

    // -- RLS Policies --
    await queryRunner.query(`ALTER TABLE IF EXISTS beneficiaries ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE IF EXISTS consent_ledger ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases ENABLE ROW LEVEL SECURITY`);

    await queryRunner.query(`DROP POLICY IF EXISTS ben_admin_all ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS ben_mayor_auditor ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_admin_all ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_mayor_auditor ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS consent_admin_all ON consent_ledger`);
    await queryRunner.query(`DROP POLICY IF EXISTS consent_self ON consent_ledger`);

    await queryRunner.query(`CREATE POLICY ben_admin_all ON beneficiaries FOR ALL USING (current_setting('app.current_role') = 'admin')`);
    await queryRunner.query(`CREATE POLICY ben_barangay_scope ON beneficiaries FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND (current_setting('app.current_barangay') = '' OR EXISTS (SELECT 1 FROM persons p WHERE p.id = beneficiaries.person_id AND p.address ILIKE '%' || current_setting('app.current_barangay') || '%')) )`);
    await queryRunner.query(`CREATE POLICY ben_mayor_auditor ON beneficiaries FOR SELECT USING (current_setting('app.current_role') IN ('mayor', 'auditor'))`);
    await queryRunner.query(`CREATE POLICY cases_admin_all ON cases FOR ALL USING (current_setting('app.current_role') = 'admin')`);
    await queryRunner.query(`CREATE POLICY cases_barangay_scope ON cases FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND EXISTS ( SELECT 1 FROM beneficiaries b JOIN persons p ON p.id = b.person_id WHERE b.id = cases.beneficiary_id AND (current_setting('app.current_barangay') = '' OR p.address ILIKE '%' || current_setting('app.current_barangay') || '%') ) )`);
    await queryRunner.query(`CREATE POLICY cases_mayor_auditor ON cases FOR SELECT USING (current_setting('app.current_role') IN ('mayor', 'auditor'))`);
    await queryRunner.query(`CREATE POLICY consent_admin_all ON consent_ledger FOR ALL USING (current_setting('app.current_role') = 'admin')`);
    await queryRunner.query(`CREATE POLICY consent_self ON consent_ledger FOR SELECT USING (current_setting('app.current_role') = 'social_worker' AND beneficiary_id IS NOT NULL)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS consent_self ON consent_ledger`);
    await queryRunner.query(`DROP POLICY IF EXISTS consent_admin_all ON consent_ledger`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_mayor_auditor ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS cases_admin_all ON cases`);
    await queryRunner.query(`DROP POLICY IF EXISTS ben_mayor_auditor ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
    await queryRunner.query(`DROP POLICY IF EXISTS ben_admin_all ON beneficiaries`);

    await queryRunner.query(`ALTER TABLE IF EXISTS access_card_services DROP COLUMN IF EXISTS category`);
    await queryRunner.query(`ALTER TABLE IF EXISTS document_vault DROP COLUMN IF EXISTS requirement_key`);
    await queryRunner.query(`ALTER TABLE IF EXISTS notifications DROP COLUMN IF EXISTS consent_skipped`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases DROP COLUMN IF EXISTS dismissal_reason`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases DROP COLUMN IF EXISTS key_version`);
    await queryRunner.query(`ALTER TABLE IF EXISTS irf_cases DROP COLUMN IF EXISTS key_wraps`);
    await queryRunner.query(`ALTER TABLE IF EXISTS programs DROP COLUMN IF EXISTS form_version`);
    await queryRunner.query(`ALTER TABLE IF EXISTS programs DROP COLUMN IF EXISTS legal_basis`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS exit_notes`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS follow_up_date`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS referrals`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS self_reliance_plan`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS approved_by_role`);
    await queryRunner.query(`ALTER TABLE IF EXISTS cases DROP COLUMN IF EXISTS approved_by_signature`);

    await queryRunner.query(`DROP TABLE IF EXISTS beneficiary_roles CASCADE`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_case_interventions_case`);
    await queryRunner.query(`DROP TABLE IF EXISTS case_interventions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS irf_blotter_seq`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_card_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS csr_seq_2026`);
  }
}
