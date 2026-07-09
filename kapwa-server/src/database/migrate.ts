import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa'
});

async function migrate() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await q.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
  try {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgAudit"`);
  } catch (e) {
    console.warn('pgAudit extension not available, skipping:', e.message);
  }

  await q.query(`CREATE TABLE IF NOT EXISTS beneficiaries ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), philsys_number TEXT UNIQUE, surname TEXT NOT NULL, first_name TEXT NOT NULL, middle_name TEXT, gender TEXT CHECK (gender IN ('Male','Female')), dob DATE NOT NULL, address TEXT, phone TEXT, access_card_code TEXT UNIQUE, consent_status TEXT DEFAULT 'active', search_vector TSVECTOR, household_id UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS place_of_birth TEXT`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS civil_status TEXT`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS current_address JSONB`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS provincial_address JSONB`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS philhealth_number TEXT`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS occupation TEXT`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS estimated_monthly_income DECIMAL(12,2)`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS age INTEGER`);
  await q.query(`CREATE TABLE IF NOT EXISTS households ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), primary_beneficiary_id UUID REFERENCES beneficiaries(id), barangay TEXT, estimated_income DECIMAL(12,2), verified_by TEXT, verified_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS family_members ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), household_id UUID REFERENCES households(id), full_name TEXT NOT NULL, relationship TEXT NOT NULL, age INTEGER, status_income TEXT, is_primary BOOLEAN DEFAULT FALSE )`);
  await q.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT`);
  await q.query(`CREATE TABLE IF NOT EXISTS cases ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), control_no TEXT UNIQUE NOT NULL, beneficiary_id UUID REFERENCES beneficiaries(id), service_requested TEXT[], requirements_checklist JSONB, status TEXT CHECK (status IN ('pending_assessment','in_review','approved','disbursed','closed')) DEFAULT 'pending_assessment', certificate_url TEXT, petty_cash_voucher_url TEXT, assigned_worker_id UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS problems_presented TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS social_worker_assessment TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_category TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS nature_of_service TEXT[]`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS financial_subsidies JSONB`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_assistance DECIMAL(12,2)`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS mode_financial_assistance TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_of_fund TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS legislator_specify TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_assistance JSONB`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS interviewed_by TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT`);
  await q.query(`CREATE TABLE IF NOT EXISTS interventions ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), case_id UUID REFERENCES cases(id), intervention_type TEXT, amount DECIMAL(12,2), fund_source TEXT CHECK (fund_source IN ('Regular','PDAF','Legislative','Donation')), agency TEXT, service_date DATE NOT NULL, voucher_no TEXT, or_reference TEXT, worker_signature_url TEXT NOT NULL, logged_by UUID, logged_at TIMESTAMP DEFAULT NOW(), hash TEXT, prev_hash TEXT )`);
  await q.query(`CREATE TABLE IF NOT EXISTS case_tracker_log ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), daily_seq_num INTEGER NOT NULL, transaction_date DATE NOT NULL, surname TEXT, first_name TEXT, middle_name TEXT, gender TEXT CHECK (gender IN ('M','F')), age_range TEXT CHECK (age_range IN ('0-7','8-17','18-59','60+')), client_category TEXT, barangay TEXT, intervention_remarks TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (transaction_date, daily_seq_num) )`);
  await q.query(`CREATE TABLE IF NOT EXISTS access_card_services ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), access_card_code TEXT REFERENCES beneficiaries(access_card_code), service_date DATE NOT NULL, service_rendered TEXT NOT NULL, cost DECIMAL(12,2), agency TEXT, worker_name_sign TEXT, intervention_id UUID )`);
  await q.query(`CREATE TABLE IF NOT EXISTS irf_blotter_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS access_card_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS otp_codes ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), phone TEXT NOT NULL, code TEXT NOT NULL, verified BOOLEAN DEFAULT FALSE, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE TABLE IF NOT EXISTS irf_cases ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), blotter_entry_number TEXT UNIQUE NOT NULL, case_category TEXT NOT NULL, datetime_reported TIMESTAMP, datetime_incident TIMESTAMP, item_a_reporting_person JSONB, item_b_person_reported JSONB, encrypted_narration BYTEA, case_disposition TEXT, msdw_signature_url TEXT, reporting_signature_url TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS programs ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, category TEXT, waiting_period_days INTEGER, required_documents JSONB, fund_sources TEXT[], approval_workflow TEXT[], form_template JSONB, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS consent_ledger ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), beneficiary_id UUID, purpose TEXT, channel TEXT, status TEXT DEFAULT 'active', granted_at TIMESTAMP DEFAULT NOW(), revoked_at TIMESTAMP )`);
  await q.query(`CREATE TABLE IF NOT EXISTS users ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'social_worker', full_name TEXT, phone TEXT, assigned_barangay TEXT, permitted_barangays TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT TRUE, device_id TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS sync_queue ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), device_id TEXT NOT NULL, table_name TEXT NOT NULL, record_id TEXT NOT NULL, operation TEXT NOT NULL, payload JSONB, client_updated_at TIMESTAMP, status TEXT DEFAULT 'pending', idempotency_key TEXT, conflict_reason TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS version_vectors ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), device_id TEXT NOT NULL, table_name TEXT NOT NULL, local_version INTEGER DEFAULT 0, server_version INTEGER DEFAULT 0, last_synced_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE (device_id, table_name) )`);
  await q.query(`CREATE TABLE IF NOT EXISTS notifications ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), recipient_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, channel TEXT DEFAULT 'in_app', phone TEXT, sent BOOLEAN DEFAULT FALSE, sent_at TIMESTAMP, is_read BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'system', reference_id TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE SEQUENCE IF NOT EXISTS csr_seq_2026 START WITH 1 INCREMENT BY 1`);
  await q.query(`CREATE TABLE IF NOT EXISTS csr_reports ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), case_id UUID NOT NULL, control_no TEXT UNIQUE NOT NULL, social_worker_name TEXT NOT NULL, social_worker_position TEXT, referral_origin TEXT, reason_for_referral TEXT, problem_presented TEXT, family_background TEXT, socio_economic_profile TEXT, assessment_analysis TEXT, recommendation TEXT, intervention_plan TEXT, client_signature_url TEXT, worker_signature_url TEXT, finalized BOOLEAN DEFAULT FALSE, created_by TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS document_vault ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), file_name TEXT NOT NULL, original_name TEXT, mime_type TEXT, file_size INTEGER DEFAULT 0, case_id UUID, beneficiary_id UUID, category TEXT, notes TEXT, uploaded_by UUID, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE TABLE IF NOT EXISTS chat_messages ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, content TEXT NOT NULL, conversation_id TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, read_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_barangay ON beneficiaries(address)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_access_card ON beneficiaries(access_card_code)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_status ON cases(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_control ON cases(control_no)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_intervention_case ON interventions(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_intervention_date ON interventions(service_date)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_tracker_date ON case_tracker_log(transaction_date)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_search ON beneficiaries USING gin(search_vector)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_name_trgm ON beneficiaries USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_consent_beneficiary ON consent_ledger(beneficiary_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_consent_status ON consent_ledger(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_csr_case ON csr_reports(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_csr_control ON csr_reports(control_no)`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS user_id UUID`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS access_card_code TEXT`);

  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS category TEXT`);
  await q.query(`ALTER TABLE consent_ledger ADD COLUMN IF NOT EXISTS revoked_reason TEXT`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_category_trgm ON beneficiaries USING gin (category gin_trgm_ops)`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_case ON document_vault(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_beneficiary ON document_vault(beneficiary_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_user ON beneficiaries(user_id)`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(sender_id, recipient_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(recipient_id, is_read)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at)`);

  await q.query(`ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE cases ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE interventions ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE consent_ledger ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE irf_cases ENABLE ROW LEVEL SECURITY`);

  await q.query(`DROP POLICY IF EXISTS ben_admin_all ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS cases_admin_all ON cases`);
  await q.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);
  await q.query(`DROP POLICY IF EXISTS int_admin_all ON interventions`);
  await q.query(`DROP POLICY IF EXISTS consent_admin_all ON consent_ledger`);
  await q.query(`DROP POLICY IF EXISTS consent_self ON consent_ledger`);

  await q.query(`CREATE POLICY ben_admin_all ON beneficiaries FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY ben_barangay_scope ON beneficiaries FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND (current_setting('app.current_barangay') = '' OR address ILIKE '%' || current_setting('app.current_barangay') || '%') )`);
  await q.query(`CREATE POLICY cases_admin_all ON cases FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY cases_barangay_scope ON cases FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND EXISTS ( SELECT 1 FROM beneficiaries b WHERE b.id = cases.beneficiary_id AND (current_setting('app.current_barangay') = '' OR b.address ILIKE '%' || current_setting('app.current_barangay') || '%') ) )`);
  await q.query(`CREATE POLICY int_admin_all ON interventions FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY consent_admin_all ON consent_ledger FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY consent_self ON consent_ledger FOR SELECT USING (current_setting('app.current_role') = 'social_worker' AND beneficiary_id IS NOT NULL)`);

  // -- RLS policies for mayor and auditor roles (read-only access)
  await q.query(`DROP POLICY IF EXISTS ben_mayor_auditor ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS cases_mayor_auditor ON cases`);
  await q.query(`DROP POLICY IF EXISTS int_mayor_auditor ON interventions`);

  await q.query(`CREATE POLICY ben_mayor_auditor ON beneficiaries FOR SELECT USING (
    current_setting('app.current_role') IN ('mayor', 'auditor')
  )`);
  await q.query(`CREATE POLICY cases_mayor_auditor ON cases FOR SELECT USING (
    current_setting('app.current_role') IN ('mayor', 'auditor')
  )`);
  await q.query(`CREATE POLICY int_mayor_auditor ON interventions FOR SELECT USING (
    current_setting('app.current_role') IN ('mayor', 'auditor')
  )`);

  console.log('Migrations + RLS policies applied');
  await q.release();
  await dataSource.destroy();
}

migrate().catch(console.error);
