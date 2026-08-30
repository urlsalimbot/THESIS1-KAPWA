import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa'
});

export async function migrate() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  // Detect a fresh boot BEFORE the transaction: on a truly empty DB the
  // migrations table does not exist yet, so no prior bootstrap can have run.
  let wasFresh = false;
  try {
    const mTable = await q.query(`SELECT to_regclass('public.migrations') AS t`);
    if (mTable[0]?.t == null) {
      wasFresh = true;
    } else {
      const c = await q.query(`SELECT COUNT(*) AS c FROM migrations`);
      wasFresh = Number(c[0]?.c) === 0;
    }
  } catch { wasFresh = true; }

  let appDataSource: DataSource | null = null;

  try {
    await q.startTransaction();

  await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await q.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
  // pgAudit may be unavailable in some images — a failed statement would
  // poison the whole transaction, so guard it with a savepoint.
  await q.query(`SAVEPOINT sp_pgaudit`);
  try {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgaudit`);
  } catch (e) {
    await q.query(`ROLLBACK TO SAVEPOINT sp_pgaudit`);
    console.warn('pgAudit extension not available, skipping:', (e as Error).message);
  }

  // Self-contained uuid v7 generator (mirrors AaUuidV7Function migration) so the
  // bootstrap works on a truly empty DB before any TypeORM migration has run.
  await q.query(`
    CREATE OR REPLACE FUNCTION uuid_generate_v7()
    RETURNS uuid
    LANGUAGE plpgsql
    VOLATILE
    AS $$
    DECLARE
      unix_ts_ms bytea;
      rand bytea;
      result bytea;
    BEGIN
      unix_ts_ms = substring(
        int8send((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
        FROM 3
      );
      rand = gen_random_bytes(10);
      rand = set_byte(rand, 0, (0x70 | (get_byte(rand, 0) & 0x0f)));
      rand = set_byte(rand, 2, (0x80 | (get_byte(rand, 2) & 0x3f)));
      result = unix_ts_ms || substring(rand FROM 1 FOR 3) || substring(rand FROM 4 FOR 7);
      RETURN encode(result, 'hex')::uuid;
    END;
    $$;
  `);

  await q.query(`CREATE TABLE IF NOT EXISTS beneficiaries ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), person_id UUID, user_id UUID, consent_status TEXT DEFAULT 'active', household_id UUID, category TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS households ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), primary_beneficiary_id UUID REFERENCES beneficiaries(id), barangay TEXT, estimated_income DECIMAL(12,2), verified_by TEXT, access_card_code TEXT, verified_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS access_card_code TEXT`);
  // family_members table removed — superseded by household_memberships (see below)
  await q.query(`CREATE TABLE IF NOT EXISTS cases ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), control_no TEXT UNIQUE NOT NULL, beneficiary_id UUID REFERENCES beneficiaries(id), service_requested TEXT[], requirements_checklist JSONB, status TEXT CHECK (status IN ('enrolled','assessed','in_review','active','transitioning','closed')) DEFAULT 'enrolled', certificate_url TEXT, petty_cash_voucher_url TEXT, assigned_worker_id UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
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
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_worker_name VARCHAR`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_signature TEXT`);
  // interventions table removed — dead table, no application code reads it; replaced by case_interventions (CaseIntervention entity)
  // case_tracker_log table removed — dropped by DropCaseTrackerLog migration
  await q.query(`CREATE TABLE IF NOT EXISTS access_card_services ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), access_card_code TEXT, service_date DATE NOT NULL, service_rendered TEXT NOT NULL, cost DECIMAL(12,2), agency TEXT, agency_id UUID, worker_name_sign TEXT, intervention_id UUID )`);
  await q.query(`CREATE TABLE IF NOT EXISTS irf_blotter_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS access_card_seq ( id SERIAL PRIMARY KEY, year INTEGER NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS otp_codes ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), phone TEXT NOT NULL, code TEXT NOT NULL, verified BOOLEAN DEFAULT FALSE, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    action TEXT NOT NULL,
    reference_id TEXT,
    user_id TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_reference ON audit_log(reference_id)`);

  await q.query(`CREATE TABLE IF NOT EXISTS irf_cases ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), blotter_entry_number TEXT UNIQUE NOT NULL, case_category TEXT NOT NULL, datetime_reported TIMESTAMP, datetime_incident TIMESTAMP, item_a_reporting_person JSONB, item_b_person_reported JSONB, encrypted_narration BYTEA, case_disposition TEXT, msdw_signature_url TEXT, reporting_signature_url TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS programs ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), name TEXT NOT NULL, category TEXT, waiting_period_days INTEGER, required_documents JSONB, fund_sources TEXT[], approval_workflow JSONB, form_template JSONB, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  // F12 (deployability): the entity maps approval_workflow as jsonb ApprovalStep[];
  // a fresh boot must create it jsonb (not the legacy text[]) or POST /programs
  // with an approvalWorkflow array fails with "malformed array literal". The
  // CREATE above already uses JSONB, so this guard only converts a legacy
  // text[] column (existing DBs) and is a no-op on fresh boots.
  await q.query(`DO $$
  DECLARE adata TEXT;
  BEGIN
    SELECT data_type INTO adata FROM information_schema.columns
      WHERE table_name='programs' AND column_name='approval_workflow';
    IF adata = 'ARRAY' THEN
      UPDATE programs SET approval_workflow = NULL WHERE approval_workflow IS DISTINCT FROM NULL;
      ALTER TABLE programs ALTER COLUMN approval_workflow TYPE jsonb;
    END IF;
  END $$`);
  // Keep legacy required_documents/fund_sources columns (nullable) so upgrade
  // backfills below can still read them; they are not read by the entity.
  await q.query(`CREATE TABLE IF NOT EXISTS consent_ledger ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), beneficiary_id UUID, purpose TEXT, channel TEXT, status TEXT DEFAULT 'active', granted_at TIMESTAMP DEFAULT NOW(), revoked_at TIMESTAMP )`);
  await q.query(`CREATE TABLE IF NOT EXISTS users ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'social_worker', full_name TEXT, phone TEXT, assigned_barangay TEXT, permitted_barangays TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT TRUE, device_id TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS sync_queue ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), device_id TEXT NOT NULL, table_name TEXT NOT NULL, record_id TEXT NOT NULL, operation TEXT NOT NULL, payload JSONB, client_updated_at TIMESTAMP, status TEXT DEFAULT 'pending', idempotency_key TEXT, conflict_reason TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS version_vectors ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), device_id TEXT NOT NULL, table_name TEXT NOT NULL, local_version INTEGER DEFAULT 0, server_version INTEGER DEFAULT 0, last_synced_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE (device_id, table_name) )`);
  await q.query(`CREATE TABLE IF NOT EXISTS notifications ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), recipient_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, channel TEXT DEFAULT 'in_app', phone TEXT, sent BOOLEAN DEFAULT FALSE, sent_at TIMESTAMP, is_read BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'system', reference_id TEXT, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE SEQUENCE IF NOT EXISTS csr_seq_2026 START WITH 1 INCREMENT BY 1`);
  await q.query(`CREATE TABLE IF NOT EXISTS csr_reports ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), case_id UUID NOT NULL, control_no TEXT UNIQUE NOT NULL, social_worker_name TEXT NOT NULL, social_worker_position TEXT, referral_origin TEXT, reason_for_referral TEXT, problem_presented TEXT, family_background TEXT, socio_economic_profile TEXT, assessment_analysis TEXT, recommendation TEXT, intervention_plan TEXT, client_signature_url TEXT, worker_signature_url TEXT, finalized BOOLEAN DEFAULT FALSE, created_by TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE TABLE IF NOT EXISTS document_vault ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), file_name TEXT NOT NULL, original_name TEXT, mime_type TEXT, file_size INTEGER DEFAULT 0, case_id UUID, beneficiary_id UUID, category TEXT, notes TEXT, uploaded_by UUID, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE TABLE IF NOT EXISTS case_interventions (
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
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_interventions_case ON case_interventions(case_id)`);

  await q.query(`CREATE TABLE IF NOT EXISTS chat_messages ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, content TEXT NOT NULL, conversation_id TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, read_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW() )`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_person ON beneficiaries(person_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_status ON cases(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_control ON cases(control_no)`);
  // idx_intervention_case, idx_intervention_date, idx_tracker_date removed — tables no longer created
  await q.query(`CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_consent_beneficiary ON consent_ledger(beneficiary_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_consent_status ON consent_ledger(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_csr_case ON csr_reports(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_csr_control ON csr_reports(control_no)`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS user_id UUID`);

  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS category TEXT`);
  await q.query(`ALTER TABLE consent_ledger ADD COLUMN IF NOT EXISTS revoked_reason TEXT`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_category_trgm ON beneficiaries USING gin (category gin_trgm_ops)`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_case ON document_vault(case_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_beneficiary ON document_vault(beneficiary_id)`);
  await q.query(`ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS irf_id UUID`);
  await q.query(`ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS announcement_id UUID`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_irf ON document_vault(irf_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_announcement ON document_vault(announcement_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_beneficiary_user ON beneficiaries(user_id)`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(sender_id, recipient_id)`);
  // -- Person Schema Redesign (2026-07-21)
  await q.query(`CREATE TABLE IF NOT EXISTS persons ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), surname TEXT NOT NULL, first_name TEXT NOT NULL, middle_name TEXT, gender TEXT CHECK (gender IN ('Male','Female')), dob DATE NOT NULL, address TEXT, phone TEXT, email TEXT, philsys_number TEXT UNIQUE, place_of_birth TEXT, civil_status TEXT, current_address JSONB, philhealth_number TEXT, occupation TEXT, estimated_monthly_income DECIMAL(12,2), age INTEGER, search_vector TSVECTOR, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_person_name_trgm ON persons USING gin (surname gin_trgm_ops, first_name gin_trgm_ops)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_person_search ON persons USING gin(search_vector)`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id)`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_user_person ON users(person_id)`);
  await q.query(`CREATE TABLE IF NOT EXISTS household_memberships ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), person_id UUID NOT NULL REFERENCES persons(id), household_id UUID REFERENCES households(id), relationship TEXT NOT NULL, is_primary BOOLEAN DEFAULT FALSE, status TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_hm_person ON household_memberships(person_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_hm_household ON household_memberships(household_id)`);
  await q.query(`CREATE TABLE IF NOT EXISTS beneficiary_claimants ( id UUID PRIMARY KEY DEFAULT uuid_generate_v7(), beneficiary_id UUID NOT NULL REFERENCES persons(id), claimant_id UUID NOT NULL REFERENCES persons(id), relationship TEXT NOT NULL, authorization_url TEXT, calendar_year INTEGER, is_primary BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW() )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_bc_beneficiary ON beneficiary_claimants(beneficiary_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_bc_claimant ON beneficiary_claimants(claimant_id)`);
  await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bc_unique_primary ON beneficiary_claimants(beneficiary_id, claimant_id)`);

  await q.query(`ALTER TABLE persons ADD COLUMN IF NOT EXISTS extension TEXT`);

  await q.query(`CREATE TABLE IF NOT EXISTS person_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    person_id UUID NOT NULL,
    contact_type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    is_primary BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_person_contacts_person ON person_contacts(person_id)`);
  await q.query(`INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
    SELECT id, 'phone', phone, true FROM persons WHERE phone IS NOT NULL AND phone <> ''`);
  await q.query(`INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
    SELECT id, 'email', email, true FROM persons WHERE email IS NOT NULL AND email <> ''`);

  await q.query(`CREATE TABLE IF NOT EXISTS person_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    person_id UUID NOT NULL,
    address_type VARCHAR(50) NOT NULL,
    barangay VARCHAR(255),
    city VARCHAR(255),
    province VARCHAR(255),
    postal VARCHAR(20),
    is_primary BOOLEAN,
    raw TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_person_addresses_person ON person_addresses(person_id)`);
  await q.query(`INSERT INTO person_addresses (person_id, address_type, raw, is_primary)
    SELECT id, 'current', address, true FROM persons WHERE address IS NOT NULL AND address <> ''`);
  await q.query(`INSERT INTO person_addresses (person_id, address_type, barangay, city, province, is_primary)
    SELECT id, 'current', current_address->>'barangay', current_address->>'city', current_address->>'province', true
    FROM persons WHERE current_address IS NOT NULL`);

  // -- Supplementary columns (entity/migration reconciliation 2026-07-28)
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_by_signature TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_by_role VARCHAR`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS self_reliance_plan TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS referrals JSONB`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS follow_up_date DATE`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS exit_notes TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS frva_score NUMERIC(5,2)`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS swdi_score NUMERIC(5,2)`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS family_dialogue_notes TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS self_reliance_level INT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS sustainability_plan TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS transition_date DATE`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS closure_outcome VARCHAR`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS closure_date DATE`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS follow_up_visits JSONB`);

  await q.query(`CREATE TABLE IF NOT EXISTS case_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID NOT NULL,
    requirement_key VARCHAR(100) NOT NULL,
    met BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_requirements_case ON case_requirements(case_id)`);
  await q.query(`INSERT INTO case_requirements (case_id, requirement_key, met)
    SELECT c.id, e.key, e.value::boolean
    FROM cases c, jsonb_each(c.requirements_checklist) AS e
    WHERE c.requirements_checklist IS NOT NULL`);

  await q.query(`CREATE TABLE IF NOT EXISTS case_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID NOT NULL,
    agency VARCHAR(255),
    status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_referrals_case ON case_referrals(case_id)`);
  await q.query(`ALTER TABLE case_referrals ADD COLUMN IF NOT EXISTS reason TEXT`);
  await q.query(`ALTER TABLE case_referrals ADD COLUMN IF NOT EXISTS contact_info TEXT`);
  await q.query(`UPDATE case_referrals SET reason = '' WHERE reason IS NULL`);
  await q.query(`ALTER TABLE case_referrals ALTER COLUMN reason SET NOT NULL`);
  await q.query(`INSERT INTO case_referrals (case_id, agency, status, notes)
    SELECT c.id, r->>'agencyName', r->>'status', r->>'notes'
    FROM cases c, jsonb_array_elements(c.referrals) AS r
    WHERE c.referrals IS NOT NULL`);

  await q.query(`CREATE TABLE IF NOT EXISTS case_assistances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID NOT NULL,
    assistance_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2),
    mode VARCHAR(50),
    source_of_fund VARCHAR(100),
    legislator_specify VARCHAR(255),
    details JSONB,
    approved_by_signature TEXT,
    approved_by_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_case_assistances_case ON case_assistances(case_id)`);
  await q.query(`INSERT INTO case_assistances
    (case_id, assistance_type, amount, mode, source_of_fund, legislator_specify, details)
    SELECT c.id, 'financial', c.amount_assistance, c.mode_financial_assistance,
           c.source_of_fund, c.legislator_specify, c.financial_subsidies
    FROM cases c
    WHERE c.amount_assistance IS NOT NULL OR c.financial_subsidies IS NOT NULL`);
  await q.query(`INSERT INTO case_assistances (case_id, assistance_type, details)
    SELECT c.id, 'other', jsonb_build_object(e.key, e.value)
    FROM cases c, jsonb_each(c.other_assistance) AS e
    WHERE c.other_assistance IS NOT NULL`);

  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_person_id UUID`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS person_link_code VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS person_link_code_expires_at TIMESTAMP`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token VARCHAR`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_email_token_expires_at TIMESTAMP`);

  await q.query(`CREATE TABLE IF NOT EXISTS user_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id UUID NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_user_tokens_user ON user_tokens(user_id)`);
  await q.query(`ALTER TABLE user_tokens ADD COLUMN IF NOT EXISTS meta JSONB`);
  await q.query(`INSERT INTO user_tokens (user_id, purpose, token, expires_at)
    SELECT id, 'email_verification', verification_token, verification_token_expires_at
    FROM users WHERE verification_token IS NOT NULL`);
  await q.query(`INSERT INTO user_tokens (user_id, purpose, token, expires_at)
    SELECT id, 'password_reset', reset_token, reset_token_expires_at
    FROM users WHERE reset_token IS NOT NULL`);
  await q.query(`INSERT INTO user_tokens (user_id, purpose, token, expires_at)
    SELECT id, 'change_email', new_email_token, new_email_token_expires_at
    FROM users WHERE new_email_token IS NOT NULL`);

  await q.query(`CREATE TABLE IF NOT EXISTS user_barangay_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id UUID NOT NULL,
    barangay VARCHAR(255) NOT NULL,
    is_primary BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_user_barangay_user ON user_barangay_assignments(user_id)`);
  await q.query(`INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
    SELECT id, assigned_barangay, true FROM users WHERE assigned_barangay IS NOT NULL AND assigned_barangay <> ''`);
  await q.query(`INSERT INTO user_barangay_assignments (user_id, barangay, is_primary)
    SELECT u.id, b.barangay, false
    FROM users u, unnest(u.permitted_barangays) AS b(barangay)
    WHERE array_length(u.permitted_barangays, 1) > 0`);

  await q.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS legal_basis TEXT`);
  await q.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS form_version INT DEFAULT 1`);

  await q.query(`CREATE TABLE IF NOT EXISTS program_fund_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    program_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_program_funds_program ON program_fund_sources(program_id)`);
  await q.query(`INSERT INTO program_fund_sources (program_id, name)
    SELECT p.id, f.name
    FROM programs p, unnest(p.fund_sources) AS f(name)
    WHERE array_length(p.fund_sources, 1) > 0`);

  await q.query(`CREATE TABLE IF NOT EXISTS program_required_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    program_id UUID NOT NULL,
    document_key VARCHAR(100) NOT NULL,
    mandatory BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_program_docs_program ON program_required_documents(program_id)`);
  await q.query(`INSERT INTO program_required_documents (program_id, document_key, mandatory)
    SELECT p.id, doc, true
    FROM programs p, jsonb_array_elements_text(p.required_documents) AS doc
    WHERE p.required_documents IS NOT NULL`);

  await q.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS key_wraps JSONB`);
  await q.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS key_version INT DEFAULT 1`);
  await q.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS dismissal_reason TEXT`);
  await q.query(`ALTER TABLE irf_cases ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id)`);

  await q.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS consent_skipped BOOLEAN DEFAULT FALSE`);
  await q.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email VARCHAR`);

  await q.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR`);

  await q.query(`ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS requirement_key VARCHAR`);

  await q.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS category VARCHAR`);
  await q.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS logged_by UUID REFERENCES users(id)`);
  await q.query(`ALTER TABLE access_card_services ADD COLUMN IF NOT EXISTS source_barangay TEXT`);

  await q.query(`CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    coordinator_id UUID NOT NULL REFERENCES users(id),
    barangay TEXT NOT NULL,
    surname TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    extension TEXT,
    gender TEXT NOT NULL,
    dob DATE NOT NULL,
    address JSONB,
    phone TEXT,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
    decline_reason TEXT,
    case_id UUID REFERENCES cases(id),
    person_id UUID REFERENCES persons(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  // F13 (deployability): the Referral entity maps an eager person relation via
  // person_id; without the column, GET /referrals/counts (and any repo.count
  // touching the relation) fails with "column Referral.person_id does not
  // exist". person_id is nullable — legacy rows keep inline person columns.
  await q.query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_referral_person ON referrals(person_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_referral_coordinator ON referrals(coordinator_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_referral_status ON referrals(status)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_referral_barangay ON referrals(barangay)`);

  await q.query(`CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(recipient_id, is_read)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at)`);

  // --- Tables created by TypeORM migrations historically; migrate.js is the
  // --- canonical fresh-boot bootstrap, so these live tables are created here
  // --- too (idempotently) so a fresh DB has the complete schema.
  await q.query(`CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    contact_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_user_agency ON users(agency_id)`);
  await q.query(`INSERT INTO agencies (code, name, type, is_active) VALUES
    ('MSWDO', 'Municipal Social Welfare and Development Office', 'social_services', true),
    ('RHU', 'Rural Health Unit - Norzagaray', 'health', true),
    ('WCPD', 'Women and Children Protection Desk (PNP)', 'police', true),
    ('PESO', 'Public Employment Service Office', 'labor', true),
    ('DILG', 'Department of the Interior and Local Government', 'government', true),
    ('DSWD', 'Department of Social Welfare and Development', 'social_services', true),
    ('DepEd', 'Department of Education', 'education', true)
    ON CONFLICT (code) DO NOTHING`);
  await q.query(`CREATE TABLE IF NOT EXISTS agency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    agency_id UUID NOT NULL,
    contact_type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    is_primary BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_agency_contacts_agency ON agency_contacts(agency_id)`);
  await q.query(`INSERT INTO agency_contacts (agency_id, contact_type, value, is_primary)
    SELECT a.id, e.key, e.value::text, true
    FROM agencies a, jsonb_each_text(a.contact_info) AS e
    WHERE a.contact_info IS NOT NULL`);
  await q.query(`CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT NOT NULL DEFAULT '',
    body_html TEXT NOT NULL DEFAULT '',
    body_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    pinned BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS inter_agency_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    case_id UUID REFERENCES cases(id),
    person_id UUID NOT NULL REFERENCES persons(id),
    from_agency_id UUID NOT NULL REFERENCES agencies(id),
    to_agency_id UUID NOT NULL REFERENCES agencies(id),
    status TEXT NOT NULL DEFAULT 'referred'
      CHECK (status IN ('referred','received','actioned','closed','declined')),
    reason TEXT NOT NULL,
    notes TEXT,
    legal_basis_code TEXT NOT NULL,
    consent_ledger_id UUID REFERENCES consent_ledger(id),
    outcome TEXT,
    received_at TIMESTAMP,
    actioned_at TIMESTAMP,
    closed_at TIMESTAMP,
    declined_reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    id uuid DEFAULT uuid_generate_v7() PRIMARY KEY,
    user_id varchar NOT NULL,
    channel varchar NOT NULL,
    category varchar NOT NULL,
    opted_in boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS physical_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    intervention_id UUID UNIQUE NOT NULL REFERENCES case_interventions(id),
    cabinet VARCHAR(50) NOT NULL,
    folder VARCHAR(100) NOT NULL,
    shelf VARCHAR(100) NOT NULL,
    qr_hash VARCHAR(64) UNIQUE,
    qr_data_url TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS form_version_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    form_template JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    key TEXT UNIQUE NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key)`);
  await q.query(`CREATE TABLE IF NOT EXISTS beneficiary_roles (
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
  // case_history uses Postgres enums defined by AddCaseHistory migration
  await q.query(`
    DO $$ BEGIN
      CREATE TYPE "public"."case_history_from_status_enum" AS ENUM('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await q.query(`
    DO $$ BEGIN
      CREATE TYPE "public"."case_history_to_status_enum" AS ENUM('enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await q.query(`CREATE TABLE IF NOT EXISTS case_history (
    id uuid NOT NULL DEFAULT uuid_generate_v7(),
    case_id character varying NOT NULL,
    from_status "public"."case_history_from_status_enum",
    to_status "public"."case_history_to_status_enum" NOT NULL,
    changed_by_role character varying,
    changed_by_id character varying,
    remarks character varying,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    transition_type character varying NOT NULL DEFAULT 'standard',
    override_reason character varying,
    CONSTRAINT "PK_case_history" PRIMARY KEY (id)
  )`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS hash TEXT`);
  await q.query(`ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS prev_hash TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS hash TEXT`);
  await q.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS prev_hash TEXT`);
  await q.query(`ALTER TABLE consent_ledger ADD COLUMN IF NOT EXISTS hash TEXT`);
  await q.query(`ALTER TABLE consent_ledger ADD COLUMN IF NOT EXISTS prev_hash TEXT`);

  await q.query(`ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE cases ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE consent_ledger ENABLE ROW LEVEL SECURITY`);
  await q.query(`ALTER TABLE irf_cases ENABLE ROW LEVEL SECURITY`);

  await q.query(`DROP POLICY IF EXISTS ben_admin_all ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS ben_barangay_scope ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS cases_admin_all ON cases`);
  await q.query(`DROP POLICY IF EXISTS cases_barangay_scope ON cases`);
  await q.query(`DROP POLICY IF EXISTS consent_admin_all ON consent_ledger`);
  await q.query(`DROP POLICY IF EXISTS consent_self ON consent_ledger`);

  await q.query(`CREATE POLICY ben_admin_all ON beneficiaries FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY ben_barangay_scope ON beneficiaries FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND (current_setting('app.current_barangay') = '' OR EXISTS (SELECT 1 FROM persons p WHERE p.id = beneficiaries.person_id AND p.address ILIKE '%' || current_setting('app.current_barangay') || '%')) )`);
  await q.query(`CREATE POLICY cases_admin_all ON cases FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY cases_barangay_scope ON cases FOR ALL USING ( current_setting('app.current_role') IN ('social_worker', 'coordinator') AND EXISTS ( SELECT 1 FROM beneficiaries b JOIN persons p ON p.id = b.person_id WHERE b.id = cases.beneficiary_id AND (current_setting('app.current_barangay') = '' OR p.address ILIKE '%' || current_setting('app.current_barangay') || '%') ) )`);
  await q.query(`CREATE POLICY consent_admin_all ON consent_ledger FOR ALL USING (current_setting('app.current_role') = 'admin')`);
  await q.query(`CREATE POLICY consent_self ON consent_ledger FOR SELECT USING (current_setting('app.current_role') = 'social_worker' AND beneficiary_id IS NOT NULL)`);

  // -- RLS policies for mayor and auditor roles (read-only access)
  await q.query(`DROP POLICY IF EXISTS ben_mayor_auditor ON beneficiaries`);
  await q.query(`DROP POLICY IF EXISTS cases_mayor_auditor ON cases`);
  await q.query(`CREATE POLICY ben_mayor_auditor ON beneficiaries FOR SELECT USING (
    current_setting('app.current_role') IN ('mayor', 'auditor')
  )`);
  await q.query(`CREATE POLICY cases_mayor_auditor ON cases FOR SELECT USING (
    current_setting('app.current_role') IN ('mayor', 'auditor')
  )`);

  // -- case_history: drop enums, use TEXT (simpler than enum migration)
  //    (savepoint-guarded: each of these is best-effort and must not poison the txn)
  await q.query(`SAVEPOINT sp_case_history`);
  try {
    await q.query(`ALTER TABLE IF EXISTS case_history ALTER COLUMN from_status TYPE TEXT`);
    await q.query(`ALTER TABLE IF EXISTS case_history ALTER COLUMN to_status TYPE TEXT`);
    await q.query(`UPDATE case_history SET from_status = 'enrolled' WHERE from_status = 'pending_assessment'`);
    await q.query(`UPDATE case_history SET to_status = 'enrolled' WHERE to_status = 'pending_assessment'`);
    await q.query(`DROP TYPE IF EXISTS case_history_from_status_enum`);
    await q.query(`DROP TYPE IF EXISTS case_history_to_status_enum`);
  } catch (e) {
    await q.query(`ROLLBACK TO SAVEPOINT sp_case_history`);
    console.warn('case_history enum normalization skipped:', (e as Error).message);
  }

  // -- Fresh-boot contract: migrate.js is the canonical bootstrap (the
  //    TypeORM chain is NOT fresh-boot-safe). Mark the chain as applied so
  //    run-migrations.js is a clean no-op on fresh deployments and only ever
  //    runs on existing DBs as an upgrade path.
  await q.query(`CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    "timestamp" BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL
  )`);
  if (wasFresh) {
    const { AppDataSource } = await import('./data-source');
    await AppDataSource.initialize();
    appDataSource = AppDataSource;
    for (const m of AppDataSource.migrations) {
      await q.query(
        `INSERT INTO migrations ("timestamp", name)
         SELECT $1::bigint, $2::varchar WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = $2)`,
        [Date.now(), m.name],
      );
    }
    console.log(`Marked ${AppDataSource.migrations.length} TypeORM migrations as applied (fresh bootstrap)`);
  }

  await q.commitTransaction();
  console.log('Migrations + RLS policies applied');
  } catch (err) {
    try { await q.rollbackTransaction(); } catch { /* already rolled back */ }
    const error = err instanceof Error ? err : new Error(String(err));
    // Mark so main.ts can fail loudly on fresh boots instead of half-starting.
    (error as Error & { freshBoot?: boolean }).freshBoot = wasFresh;
    throw error;
  } finally {
    if (appDataSource) { try { await appDataSource.destroy(); } catch { /* ignore */ } }
    await q.release();
    await dataSource.destroy();
  }
}

// Run when executed directly: `node dist/database/migrate.js`
if (require.main === module) {
  migrate().catch(console.error);
}
