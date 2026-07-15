import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa',
});

// ============================================================================
// DETERMINISTIC UUIDs – stable IDs for easy cross-table referencing
// ============================================================================
const ID = {
  // Users (8)
  u_admin:          '10000000-0000-0000-0000-000000000001',
  u_worker_bigte:   '10000000-0000-0000-0000-000000000002',
  u_worker_matictic:'10000000-0000-0000-0000-000000000003',
  u_coordinator:    '10000000-0000-0000-0000-000000000004',
  u_claimant_a:     '10000000-0000-0000-0000-000000000005',
  u_claimant_b:     '10000000-0000-0000-0000-000000000006',
  u_mayor:          '10000000-0000-0000-0000-000000000007',
  u_auditor:        '10000000-0000-0000-0000-000000000008',

  // Beneficiaries (18)
  b_alcala:   '20000000-0000-0000-0000-000000000001',
  b_roxas:    '20000000-0000-0000-0000-000000000002',
  b_cruz:     '20000000-0000-0000-0000-000000000003',
  b_santos:   '20000000-0000-0000-0000-000000000004',
  b_garcia:   '20000000-0000-0000-0000-000000000005',
  b_reyes:    '20000000-0000-0000-0000-000000000006',
  b_mendoza:  '20000000-0000-0000-0000-000000000007',
  b_aquino:   '20000000-0000-0000-0000-000000000008',
  b_rivera:   '20000000-0000-0000-0000-000000000009',
  b_villanueva:'20000000-0000-0000-0000-00000000000a',
  b_fernando: '20000000-0000-0000-0000-00000000000b',
  b_lopez:    '20000000-0000-0000-0000-00000000000c',
  b_delacruz: '20000000-0000-0000-0000-00000000000d',
  b_martinez: '20000000-0000-0000-0000-00000000000e',
  b_flores:   '20000000-0000-0000-0000-00000000000f',
  b_gonzales: '20000000-0000-0000-0000-000000000010',
  b_navarro:  '20000000-0000-0000-0000-000000000011',
  b_soriano:  '20000000-0000-0000-0000-000000000012',

  // Households (14)
  hh_alcala:    '30000000-0000-0000-0000-000000000001',
  hh_roxas:     '30000000-0000-0000-0000-000000000002',
  hh_cruz:      '30000000-0000-0000-0000-000000000003',
  hh_santos:    '30000000-0000-0000-0000-000000000004',
  hh_garcia:    '30000000-0000-0000-0000-000000000005',
  hh_reyes:     '30000000-0000-0000-0000-000000000006',
  hh_mendoza:   '30000000-0000-0000-0000-000000000007',
  hh_aquino:    '30000000-0000-0000-0000-000000000008',
  hh_delacruz:  '30000000-0000-0000-0000-000000000009',
  hh_martinez:  '30000000-0000-0000-0000-00000000000a',
  hh_flores:    '30000000-0000-0000-0000-00000000000b',
  hh_gonzales:  '30000000-0000-0000-0000-00000000000c',
  hh_navarro:   '30000000-0000-0000-0000-00000000000d',
  hh_soriano:   '30000000-0000-0000-0000-00000000000e',

  // Family members (42)
  fm1:  '40000000-0000-0000-0000-000000000001',
  fm2:  '40000000-0000-0000-0000-000000000002',
  fm3:  '40000000-0000-0000-0000-000000000003',
  fm4:  '40000000-0000-0000-0000-000000000004',
  fm5:  '40000000-0000-0000-0000-000000000005',
  fm6:  '40000000-0000-0000-0000-000000000006',
  fm7:  '40000000-0000-0000-0000-000000000007',
  fm8:  '40000000-0000-0000-0000-000000000008',
  fm9:  '40000000-0000-0000-0000-000000000009',
  fm10: '40000000-0000-0000-0000-00000000000a',
  fm11: '40000000-0000-0000-0000-00000000000b',
  fm12: '40000000-0000-0000-0000-00000000000c',
  fm13: '40000000-0000-0000-0000-00000000000d',
  fm14: '40000000-0000-0000-0000-00000000000e',
  fm15: '40000000-0000-0000-0000-00000000000f',
  fm16: '40000000-0000-0000-0000-000000000010',
  fm17: '40000000-0000-0000-0000-000000000011',
  fm18: '40000000-0000-0000-0000-000000000012',
  fm19: '40000000-0000-0000-0000-000000000013',
  fm20: '40000000-0000-0000-0000-000000000014',
  fm21: '40000000-0000-0000-0000-000000000015',
  fm22: '40000000-0000-0000-0000-000000000016',
  fm23: '40000000-0000-0000-0000-000000000017',
  fm24: '40000000-0000-0000-0000-000000000018',
  fm25: '40000000-0000-0000-0000-000000000019',
  fm26: '40000000-0000-0000-0000-00000000001a',
  fm27: '40000000-0000-0000-0000-00000000001b',
  fm28: '40000000-0000-0000-0000-00000000001c',
  fm29: '40000000-0000-0000-0000-00000000001d',
  fm30: '40000000-0000-0000-0000-00000000001e',
  fm31: '40000000-0000-0000-0000-00000000001f',
  fm32: '40000000-0000-0000-0000-000000000020',
  fm33: '40000000-0000-0000-0000-000000000021',
  fm34: '40000000-0000-0000-0000-000000000022',
  fm35: '40000000-0000-0000-0000-000000000023',
  fm36: '40000000-0000-0000-0000-000000000024',
  fm37: '40000000-0000-0000-0000-000000000025',
  fm38: '40000000-0000-0000-0000-000000000026',
  fm39: '40000000-0000-0000-0000-000000000027',
  fm40: '40000000-0000-0000-0000-000000000028',
  fm41: '40000000-0000-0000-0000-000000000029',
  fm42: '40000000-0000-0000-0000-00000000002a',

  // Intervention types (7) – codes that match migration defaults
  it_fa:    '1a000000-0000-0000-0000-000000000001',
  it_c:     '1a000000-0000-0000-0000-000000000002',
  it_csr:   '1a000000-0000-0000-0000-000000000003',
  it_r:     '1a000000-0000-0000-0000-000000000004',
  it_h:     '1a000000-0000-0000-0000-000000000005',
  it_hv:    '1a000000-0000-0000-0000-000000000006',
  it_other: '1a000000-0000-0000-0000-000000000007',

  // Cases (8)
  c_1: '50000000-0000-0000-0000-000000000001',
  c_2: '50000000-0000-0000-0000-000000000002',
  c_3: '50000000-0000-0000-0000-000000000003',
  c_4: '50000000-0000-0000-0000-000000000004',
  c_5: '50000000-0000-0000-0000-000000000005',
  c_6: '50000000-0000-0000-0000-000000000006',
  c_7: '50000000-0000-0000-0000-000000000007',
  c_8: '50000000-0000-0000-0000-000000000008',

  // Case history (25)
  ch1:  '51000000-0000-0000-0000-000000000001',
  ch2:  '51000000-0000-0000-0000-000000000002',
  ch3:  '51000000-0000-0000-0000-000000000003',
  ch4:  '51000000-0000-0000-0000-000000000004',
  ch5:  '51000000-0000-0000-0000-000000000005',
  ch6:  '51000000-0000-0000-0000-000000000006',
  ch7:  '51000000-0000-0000-0000-000000000007',
  ch8:  '51000000-0000-0000-0000-000000000008',
  ch9:  '51000000-0000-0000-0000-000000000009',
  ch10: '51000000-0000-0000-0000-00000000000a',
  ch11: '51000000-0000-0000-0000-00000000000b',
  ch12: '51000000-0000-0000-0000-00000000000c',
  ch13: '51000000-0000-0000-0000-00000000000d',
  ch14: '51000000-0000-0000-0000-00000000000e',
  ch15: '51000000-0000-0000-0000-00000000000f',
  ch16: '51000000-0000-0000-0000-000000000010',
  ch17: '51000000-0000-0000-0000-000000000011',
  ch18: '51000000-0000-0000-0000-000000000012',
  ch19: '51000000-0000-0000-0000-000000000013',
  ch20: '51000000-0000-0000-0000-000000000014',
  ch21: '51000000-0000-0000-0000-000000000015',
  ch22: '51000000-0000-0000-0000-000000000016',
  ch23: '51000000-0000-0000-0000-000000000017',
  ch24: '51000000-0000-0000-0000-000000000018',
  ch25: '51000000-0000-0000-0000-000000000019',

  // Interventions (10)
  int1:  '60000000-0000-0000-0000-000000000001',
  int2:  '60000000-0000-0000-0000-000000000002',
  int3:  '60000000-0000-0000-0000-000000000003',
  int4:  '60000000-0000-0000-0000-000000000004',
  int5:  '60000000-0000-0000-0000-000000000005',
  int6:  '60000000-0000-0000-0000-000000000006',
  int7:  '60000000-0000-0000-0000-000000000007',
  int8:  '60000000-0000-0000-0000-000000000008',
  int9:  '60000000-0000-0000-0000-000000000009',
  int10: '60000000-0000-0000-0000-00000000000a',

  // Programs (6)
  prog_akap:     '70000000-0000-0000-0000-000000000001',
  prog_medical:  '70000000-0000-0000-0000-000000000002',
  prog_burial:   '70000000-0000-0000-0000-000000000003',
  prog_education:'70000000-0000-0000-0000-000000000004',
  prog_food:     '70000000-0000-0000-0000-000000000005',
  prog_transpo:  '70000000-0000-0000-0000-000000000006',

  // Program assignments (6)
  pa1: '71000000-0000-0000-0000-000000000001',
  pa2: '71000000-0000-0000-0000-000000000002',
  pa3: '71000000-0000-0000-0000-000000000003',
  pa4: '71000000-0000-0000-0000-000000000004',
  pa5: '71000000-0000-0000-0000-000000000005',
  pa6: '71000000-0000-0000-0000-000000000006',

  // Program assignment steps (18)
  pas1:  '72000000-0000-0000-0000-000000000001',
  pas2:  '72000000-0000-0000-0000-000000000002',
  pas3:  '72000000-0000-0000-0000-000000000003',
  pas4:  '72000000-0000-0000-0000-000000000004',
  pas5:  '72000000-0000-0000-0000-000000000005',
  pas6:  '72000000-0000-0000-0000-000000000006',
  pas7:  '72000000-0000-0000-0000-000000000007',
  pas8:  '72000000-0000-0000-0000-000000000008',
  pas9:  '72000000-0000-0000-0000-000000000009',
  pas10: '72000000-0000-0000-0000-00000000000a',
  pas11: '72000000-0000-0000-0000-00000000000b',
  pas12: '72000000-0000-0000-0000-00000000000c',
  pas13: '72000000-0000-0000-0000-00000000000d',
  pas14: '72000000-0000-0000-0000-00000000000e',
  pas15: '72000000-0000-0000-0000-00000000000f',
  pas16: '72000000-0000-0000-0000-000000000010',
  pas17: '72000000-0000-0000-0000-000000000011',
  pas18: '72000000-0000-0000-0000-000000000012',

  // IRF Cases (4)
  irf1: '80000000-0000-0000-0000-000000000001',
  irf2: '80000000-0000-0000-0000-000000000002',
  irf3: '80000000-0000-0000-0000-000000000003',
  irf4: '80000000-0000-0000-0000-000000000004',

  // Consent ledger (12)
  cl1:  '90000000-0000-0000-0000-000000000001',
  cl2:  '90000000-0000-0000-0000-000000000002',
  cl3:  '90000000-0000-0000-0000-000000000003',
  cl4:  '90000000-0000-0000-0000-000000000004',
  cl5:  '90000000-0000-0000-0000-000000000005',
  cl6:  '90000000-0000-0000-0000-000000000006',
  cl7:  '90000000-0000-0000-0000-000000000007',
  cl8:  '90000000-0000-0000-0000-000000000008',
  cl9:  '90000000-0000-0000-0000-000000000009',
  cl10: '90000000-0000-0000-0000-00000000000a',
  cl11: '90000000-0000-0000-0000-00000000000b',
  cl12: '90000000-0000-0000-0000-00000000000c',

  // Notifications (10)
  not1:  'a0000000-0000-0000-0000-000000000001',
  not2:  'a0000000-0000-0000-0000-000000000002',
  not3:  'a0000000-0000-0000-0000-000000000003',
  not4:  'a0000000-0000-0000-0000-000000000004',
  not5:  'a0000000-0000-0000-0000-000000000005',
  not6:  'a0000000-0000-0000-0000-000000000006',
  not7:  'a0000000-0000-0000-0000-000000000007',
  not8:  'a0000000-0000-0000-0000-000000000008',
  not9:  'a0000000-0000-0000-0000-000000000009',
  not10: 'a0000000-0000-0000-0000-00000000000a',

  // CSR Reports (3)
  csr1: 'b0000000-0000-0000-0000-000000000001',
  csr2: 'b0000000-0000-0000-0000-000000000002',
  csr3: 'b0000000-0000-0000-0000-000000000003',

  // Document vault (5)
  doc1: 'c0000000-0000-0000-0000-000000000001',
  doc2: 'c0000000-0000-0000-0000-000000000002',
  doc3: 'c0000000-0000-0000-0000-000000000003',
  doc4: 'c0000000-0000-0000-0000-000000000004',
  doc5: 'c0000000-0000-0000-0000-000000000005',

  // Tracker log (8)
  trk1: 'd0000000-0000-0000-0000-000000000001',
  trk2: 'd0000000-0000-0000-0000-000000000002',
  trk3: 'd0000000-0000-0000-0000-000000000003',
  trk4: 'd0000000-0000-0000-0000-000000000004',
  trk5: 'd0000000-0000-0000-0000-000000000005',
  trk6: 'd0000000-0000-0000-0000-000000000006',
  trk7: 'd0000000-0000-0000-0000-000000000007',
  trk8: 'd0000000-0000-0000-0000-000000000008',

  // Chat messages (8)
  chat1: 'e0000000-0000-0000-0000-000000000001',
  chat2: 'e0000000-0000-0000-0000-000000000002',
  chat3: 'e0000000-0000-0000-0000-000000000003',
  chat4: 'e0000000-0000-0000-0000-000000000004',
  chat5: 'e0000000-0000-0000-0000-000000000005',
  chat6: 'e0000000-0000-0000-0000-000000000006',
  chat7: 'e0000000-0000-0000-0000-000000000007',
  chat8: 'e0000000-0000-0000-0000-000000000008',

  // Access card services (6)
  acs1: 'f0000000-0000-0000-0000-000000000001',
  acs2: 'f0000000-0000-0000-0000-000000000002',
  acs3: 'f0000000-0000-0000-0000-000000000003',
  acs4: 'f0000000-0000-0000-0000-000000000004',
  acs5: 'f0000000-0000-0000-0000-000000000005',
  acs6: 'f0000000-0000-0000-0000-000000000006',

  // Sync (3)
  sync1: '00000000-0000-0000-0000-0000000000f1',
  sync2: '00000000-0000-0000-0000-0000000000f2',
  sync3: '00000000-0000-0000-0000-0000000000f3',
} as const;

// ============================================================================
// SEED FUNCTION
// ============================================================================
async function seed() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  // ---- Disable RLS & triggers for bulk insert ----
  await q.query('ALTER TABLE beneficiaries DISABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE cases DISABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE interventions DISABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE consent_ledger DISABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE irf_cases DISABLE ROW LEVEL SECURITY');

  // ---- Truncate all tables in dependency order ----
  await q.query(`TRUNCATE TABLE
    access_card_services, case_tracker_log, case_history, interventions,
    program_assignment_steps, program_assignments, form_version_history,
    document_vault, csr_reports, audit_log,
    sync_queue, version_vectors, idempotency_keys,
    chat_messages, notifications, notification_preferences, otp_codes,
    consent_ledger, cases, family_members, households,
    irf_cases, beneficiaries, programs, users,
    intervention_types
    CASCADE`);

  const adminPass   = await bcrypt.hash('admin123', 12);
  const workerPass  = await bcrypt.hash('worker123', 12);
  const coordPass   = await bcrypt.hash('coordinator123', 12);
  const claimantPass= await bcrypt.hash('claimant123', 12);
  const mayorPass   = await bcrypt.hash('mayor123', 12);
  const auditorPass = await bcrypt.hash('auditor123', 12);

  // ==========================================================================
  // 1. USERS (8)
  // ==========================================================================
  console.log('[1/26] Seeding users...');
  await q.query(`
    INSERT INTO users (id, email, password, role, full_name, phone, assigned_barangay, permitted_barangays, is_active, mfa_enabled)
    VALUES
      ('${ID.u_admin}',        'admin@mswdo.test',       '${adminPass}',   'admin',         'Rosario G. Mendoza',     '09171000001', NULL,      '{}',                                              true,  false),
      ('${ID.u_worker_bigte}',   'worker1@mswdo.test',     '${workerPass}',  'social_worker', 'Juan Dela Cruz',         '09171000002', NULL,      '{"Bigte","Partida","Pugad","Sapang Kawayan","Tigbe"}', true, false),
      ('${ID.u_worker_matictic}','worker2@mswdo.test',     '${workerPass}',  'social_worker', 'Lorna B. Santos',        '09171000003', NULL,      '{"Matictic","San Mateo","Tumana","Minuyan","Balayong","Alawihaw"}', true, false),
      ('${ID.u_coordinator}',   'coordinator@mswdo.test',  '${coordPass}',   'coordinator',   'Emmanuel T. Reyes',      '09171000004', NULL,      '{"Bigte","Matictic","Partida","San Mateo","Tumana","Bitbit","Bangkal","Pugad","Sapang Kawayan","Tigbe","Minuyan","Balayong","Alawihaw"}', true, false),
      ('${ID.u_claimant_a}',    'pedro.claimant@test.com', '${claimantPass}','claimant',      'Pedro P. Reyes',         '09171000005', NULL,      '{}',                                               true,  false),
      ('${ID.u_claimant_b}',    'ana.claimant@test.com',   '${claimantPass}','claimant',      'Ana Marie L. Fernandez', '09171000006', NULL,      '{}',                                               true,  false),
      ('${ID.u_mayor}',         'mayor@mswdo.test',        '${mayorPass}',   'mayor',         'Felicisimo I. Santiago', '09171000007', NULL,      '{}',                                               true,  false),
      ('${ID.u_auditor}',       'auditor@mswdo.test',      '${auditorPass}', 'auditor',       'Teresita Q. Valdez',     '09171000008', NULL,      '{}',                                               true,  false)
  `);

  // ==========================================================================
  // 2. BENEFICIARIES (18) – coverage across all 13 barangays for RLS
  // ==========================================================================
  console.log('[2/26] Seeding beneficiaries...');
  await q.query(`
    INSERT INTO beneficiaries (id, philsys_number, surname, first_name, middle_name, gender, dob, address, phone, access_card_code, consent_status, category, place_of_birth, civil_status, current_address, provincial_address, philhealth_number, occupation, estimated_monthly_income, age)
    VALUES
      ('${ID.b_alcala}',    'PHIL-9876-5432-1001','Alcala',    'Rodolfo',  'Garcia',  'Male',   '1973-04-12','123 Purok 1, Bigte, Norzagaray',       '09171234501','NORZ-AC-2025-0001','active','Senior Citizen','Norzagaray, Bulacan','Married','{"street":"123 Purok 1","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"123 Purok 1","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789001','Farmer',8500.00,52),
      ('${ID.b_roxas}',     'PHIL-9876-5432-1002','Roxas',     'Teresita', 'Mendoza', 'Female', '1968-11-03','456 Purok 2, Bigte, Norzagaray',       '09171234502','NORZ-AC-2025-0002','active','Senior Citizen','Norzagaray, Bulacan','Single','{"street":"456 Purok 2","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"456 Purok 2","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789002','Vendor',5000.00,57),
      ('${ID.b_cruz}',      'PHIL-9876-5432-1003','Cruz',      'Antonio',  'Lopez',   'Male',   '1982-07-21','789 Purok 3, Matictic, Norzagaray',    '09171234503','NORZ-AC-2025-0003','active','Family','Norzagaray, Bulacan','Married','{"street":"789 Purok 3","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"789 Purok 3","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789003','Laborer',12000.00,43),
      ('${ID.b_santos}',    'PHIL-9876-5432-1004','Santos',    'Elena',    'Rivera',  'Female', '1990-02-14','101 Purok 4, Matictic, Norzagaray',    '09171234504','NORZ-AC-2025-0004','active','Women','Norzagaray, Bulacan','Single','{"street":"101 Purok 4","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"101 Purok 4","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789004','Vendor',4500.00,35),
      ('${ID.b_garcia}',    'PHIL-9876-5432-1005','Garcia',    'Francisco','Aquino',  'Male',   '1995-09-08','202 Purok 1, Partida, Norzagaray',     '09171234505','NORZ-AC-2025-0005','active','Youth','Norzagaray, Bulacan','Single','{"street":"202 Purok 1","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"202 Purok 1","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789005','Driver',7000.00,30),
      ('${ID.b_reyes}',     'PHIL-9876-5432-1006','Reyes',     'Carmen',   'Villanueva','Female','1988-06-30','303 Purok 2, Partida, Norzagaray',     '09171234506','NORZ-AC-2025-0006','active','PWD','Norzagaray, Bulacan','Married','{"street":"303 Purok 2","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"303 Purok 2","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789006','Teacher',11000.00,37),
      ('${ID.b_mendoza}',   'PHIL-9876-5432-1007','Mendoza',   'Ricardo',  'Fernando','Male',   '1960-01-15','404 Purok 1, San Mateo, Norzagaray',   '09171234507','NORZ-AC-2025-0007','active','Senior Citizen','Norzagaray, Bulacan','Married','{"street":"404 Purok 1","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"404 Purok 1","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789007','Retired',3500.00,65),
      ('${ID.b_aquino}',    'PHIL-9876-5432-1008','Aquino',    'Sofia',    'Dela Cruz','Female','1998-12-25','505 Purok 2, San Mateo, Norzagaray',   '09171234508','NORZ-AC-2025-0008','active','Youth','Norzagaray, Bulacan','Single','{"street":"505 Purok 2","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"505 Purok 2","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789008','Student',9000.00,27),
      ('${ID.b_rivera}',    'PHIL-9876-5432-1009','Rivera',    'Benigno',  'Cruz',    'Male',   '1975-08-19','606 Sitio Bakal, Tumana, Norzagaray',   '09171234509','NORZ-AC-2025-0009','active','Family','Norzagaray, Bulacan','Married','{"street":"606 Sitio Bakal","barangay":"Tumana","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"606 Sitio Bakal","barangay":"Tumana","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789009','Fisherman',8500.00,50),
      ('${ID.b_villanueva}','PHIL-9876-5432-1010','Villanueva','Lydia',    'Santos',  'Female', '1985-03-10','707 Purok 3, Bitbit, Norzagaray',      '09171234510','NORZ-AC-2025-0010','active','PWD','Norzagaray, Bulacan','Married','{"street":"707 Purok 3","barangay":"Bitbit","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"707 Purok 3","barangay":"Bitbit","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789010','Housewife',6500.00,40),
      ('${ID.b_fernando}',  'PHIL-9876-5432-1011','Fernando',  'Gabriel',  'Reyes',   'Male',   '1992-10-05','808 Purok 4, Bangkal, Norzagaray',     '09171234511','NORZ-AC-2025-0011','revoked','Family','Norzagaray, Bulacan','Married','{"street":"808 Purok 4","barangay":"Bangkal","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"808 Purok 4","barangay":"Bangkal","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789011','Laborer',10000.00,33),
      ('${ID.b_lopez}',     'PHIL-9876-5432-1012','Lopez',     'Imelda',   'Alcala',  'Female', '1970-05-28','909 Purok 5, Bigte, Norzagaray',       '09171234512','NORZ-AC-2025-0012','active','Women','Norzagaray, Bulacan','Married','{"street":"909 Purok 5","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"909 Purok 5","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789012','Vendor',7500.00,55),
      -- 6 new beneficiaries in uncovered barangays (coordinator territory)
      ('${ID.b_delacruz}',  'PHIL-9876-5432-1013','Dela Cruz', 'Nenita',   'Marquez', 'Female', '1953-03-25','111 Purok 1, Pugad, Norzagaray',       '09171234513','NORZ-AC-2025-0013','active','Senior Citizen','Norzagaray, Bulacan','Single','{"street":"111 Purok 1","barangay":"Pugad","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"111 Purok 1","barangay":"Pugad","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789013','Retired',6200.00,72),
      ('${ID.b_martinez}',  'PHIL-9876-5432-1014','Martinez',  'Roberto',  'Fernandez','Male',   '1979-11-18','222 Purok 2, Sapang Kawayan, Norzagaray','09171234514','NORZ-AC-2025-0014','active','PWD','Norzagaray, Bulacan','Married','{"street":"222 Purok 2","barangay":"Sapang Kawayan","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"222 Purok 2","barangay":"Sapang Kawayan","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789014','Driver',3500.00,46),
      ('${ID.b_flores}',    'PHIL-9876-5432-1015','Flores',    'Maricel',  'Dimagiba', 'Female', '1992-07-08','333 Purok 1, Tigbe, Norzagaray',        '09171234515','NORZ-AC-2025-0015','active','Women','Norzagaray, Bulacan','Single','{"street":"333 Purok 1","barangay":"Tigbe","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"333 Purok 1","barangay":"Tigbe","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789015','Vendor',8000.00,33),
      ('${ID.b_gonzales}',  'PHIL-9876-5432-1016','Gonzales',  'Efren',    'Lansang',  'Male',   '1975-04-30','444 Purok 3, Minuyan, Norzagaray',      '09171234516','NORZ-AC-2025-0016','active','Family','Norzagaray, Bulacan','Married','{"street":"444 Purok 3","barangay":"Minuyan","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"444 Purok 3","barangay":"Minuyan","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789016','Farmer',5500.00,50),
      ('${ID.b_navarro}',   'PHIL-9876-5432-1017','Navarro',   'Luzviminda','Torres',  'Female', '1957-09-14','555 Purok 2, Balayong, Norzagaray',    '09171234517','NORZ-AC-2025-0017','active','Senior Citizen','Norzagaray, Bulacan','Single','{"street":"555 Purok 2","barangay":"Balayong","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"555 Purok 2","barangay":"Balayong","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789017','Retired',4000.00,68),
      ('${ID.b_soriano}',   'PHIL-9876-5432-1018','Soriano',   'Dante',    'Pascual',  'Male',   '2003-06-21','666 Purok 1, Alawihaw, Norzagaray',    '09171234518','NORZ-AC-2025-0018','active','Youth','Norzagaray, Bulacan','Single','{"street":"666 Purok 1","barangay":"Alawihaw","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'{"street":"666 Purok 1","barangay":"Alawihaw","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}'::jsonb,'123456789018','Student',3000.00,22)
  `);

  // ==========================================================================
  // 3. HOUSEHOLDS (14)
  // ==========================================================================
  console.log('[3/26] Seeding 14 households...');
  await q.query(`
    INSERT INTO households (id, primary_beneficiary_id, barangay, estimated_income, verified_by)
    VALUES
      ('${ID.hh_alcala}',  '${ID.b_alcala}',   'Bigte',     8500.00,  'Emmanuel T. Reyes'),
      ('${ID.hh_roxas}',   '${ID.b_roxas}',    'Bigte',     5000.00,  'Emmanuel T. Reyes'),
      ('${ID.hh_cruz}',    '${ID.b_cruz}',     'Matictic',  12000.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_santos}',  '${ID.b_santos}',   'Matictic',  4500.00,  'Emmanuel T. Reyes'),
      ('${ID.hh_garcia}',  '${ID.b_garcia}',   'Partida',   7000.00,  'Emmanuel T. Reyes'),
      ('${ID.hh_reyes}',   '${ID.b_reyes}',    'Partida',   11000.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_mendoza}', '${ID.b_mendoza}',  'San Mateo', 3500.00,  'Emmanuel T. Reyes'),
      ('${ID.hh_aquino}',  '${ID.b_aquino}',   'San Mateo', 9000.00,  'Emmanuel T. Reyes'),
      -- 6 new households in uncovered barangays
      ('${ID.hh_delacruz}', '${ID.b_delacruz}', 'Pugad',         6200.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_martinez}', '${ID.b_martinez}', 'Sapang Kawayan',3500.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_flores}',   '${ID.b_flores}',   'Tigbe',         8000.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_gonzales}', '${ID.b_gonzales}', 'Minuyan',       5500.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_navarro}',  '${ID.b_navarro}',  'Balayong',      4000.00, 'Emmanuel T. Reyes'),
      ('${ID.hh_soriano}',  '${ID.b_soriano}',  'Alawihaw',      3000.00, 'Emmanuel T. Reyes')
  `);

  // ==========================================================================
  // 4. FAMILY MEMBERS (42) – 3 per household, varied relationships
  // ==========================================================================
  console.log('[4/26] Seeding 42 family members...');
  await q.query(`
    INSERT INTO family_members (id, household_id, full_name, relationship, age, occupation, income, status, is_primary)
    VALUES
      -- Alcala household (Bigte)
      ('${ID.fm1}',  '${ID.hh_alcala}',  'Rosa Alcala',       'Spouse',       48, 'Housewife',         NULL::decimal, 'Unemployed',   false),
      ('${ID.fm2}',  '${ID.hh_alcala}',  'Mark Alcala',        'Child',        22, 'Farmer',            12000,         'Employed',     false),
      ('${ID.fm3}',  '${ID.hh_alcala}',  'Jenny Alcala',       'Child',        16, '',                    NULL::decimal, 'Student',      false),
      -- Roxas household (Bigte)
      ('${ID.fm4}',  '${ID.hh_roxas}',   'Teresita Roxas',     'Self',         56, 'Pensioner',          2000,          'Retired',      true),
      ('${ID.fm5}',  '${ID.hh_roxas}',   'Bobby Roxas',        'Grandchild',   10, '',                    NULL::decimal, 'Student',      false),
      ('${ID.fm6}',  '${ID.hh_roxas}',   'Lita Roxas',         'Grandchild',   7,  '',                    NULL::decimal, 'Student',      false),
      -- Cruz household (Matictic)
      ('${ID.fm7}',  '${ID.hh_cruz}',    'Antonio Cruz',       'Self',         42, 'Driver',             8000,          'Employed',     true),
      ('${ID.fm8}',  '${ID.hh_cruz}',    'Gloria Cruz',        'Spouse',       38, 'Construction Worker', 6000,         'Employed',     false),
      ('${ID.fm9}',  '${ID.hh_cruz}',    'Diego Cruz',         'Child',        12, '',                    NULL::decimal, 'Student',      false),
      -- Santos household (Matictic)
      ('${ID.fm10}', '${ID.hh_santos}',  'Elena Santos',       'Self',         35, 'Fruit Vendor',       5000,          'Self-Employed',true),
      ('${ID.fm11}', '${ID.hh_santos}',  'Baby Santos',        'Child',        3,  '',                    NULL::decimal, 'Dependent',    false),
      ('${ID.fm12}', '${ID.hh_santos}',  'Lola Nena Santos',   'Grandparent',  78, '',                    NULL::decimal, 'Dependent',    false),
      -- Garcia household (Partida)
      ('${ID.fm13}', '${ID.hh_garcia}',  'Francisco Garcia',   'Self',         29, 'Laborer',            10000,         'Employed',     true),
      ('${ID.fm14}', '${ID.hh_garcia}',  'Raul Garcia',        'Sibling',      25, 'Unemployed',         NULL::decimal, 'Unemployed',   false),
      ('${ID.fm15}', '${ID.hh_garcia}',  'Maria Garcia',       'Mother',       62, '',                    NULL::decimal, 'Dependent',    false),
      -- Reyes household (Partida)
      ('${ID.fm16}', '${ID.hh_reyes}',   'Carmen Reyes',       'Self',         37, 'Sales Lady',         15000,         'Employed',     true),
      ('${ID.fm17}', '${ID.hh_reyes}',   'Jorge Reyes',        'Spouse',       40, 'Factory Worker',     12000,         'Employed',     false),
      ('${ID.fm18}', '${ID.hh_reyes}',   'Mila Reyes',         'Child',        14, '',                    NULL::decimal, 'Student',      false),
      -- Mendoza household (San Mateo)
      ('${ID.fm19}', '${ID.hh_mendoza}', 'Ricardo Mendoza',    'Self',         65, 'Retired',            3000,          'Retired',      true),
      ('${ID.fm20}', '${ID.hh_mendoza}', 'Dalia Mendoza',      'Spouse',       61, '',                    NULL::decimal, 'Dependent',    false),
      ('${ID.fm21}', '${ID.hh_mendoza}', 'Karlo Mendoza',      'Child',        35, 'Laborer',            12000,         'Employed',     false),
      -- Aquino household (San Mateo)
      ('${ID.fm22}', '${ID.hh_aquino}',  'Sofia Aquino',       'Self',         27, '',                    NULL::decimal, 'Student',      true),
      ('${ID.fm23}', '${ID.hh_aquino}',  'Bella Aquino',       'Sibling',      19, '',                    NULL::decimal, 'Student',      false),
      ('${ID.fm24}', '${ID.hh_aquino}',  'Alfredo Aquino Sr.', 'Father',       55, 'Janitor',            6000,          'Employed',     false),
      -- Dela Cruz household (Pugad)
      ('${ID.fm25}', '${ID.hh_delacruz}',  'Nenita Dela Cruz',     'Self',         72, 'Retired',            5000,          'Retired',      true),
      ('${ID.fm26}', '${ID.hh_delacruz}',  'Mario Dela Cruz',      'Spouse',       75, 'Pensioner',          3000,          'Retired',      false),
      ('${ID.fm27}', '${ID.hh_delacruz}',  'Susan Dela Cruz',      'Child',        35, 'Driver',             10000,         'Employed',     false),
      -- Martinez household (Sapang Kawayan)
      ('${ID.fm28}', '${ID.hh_martinez}',  'Roberto Martinez',     'Self',         45, 'Fruit Vendor',       10000,         'Self-Employed',true),
      ('${ID.fm29}', '${ID.hh_martinez}',  'Liza Martinez',        'Spouse',       42, 'Driver',             6000,          'Employed',     false),
      ('${ID.fm30}', '${ID.hh_martinez}',  'Kevin Martinez',       'Child',        16, '',                    NULL::decimal, 'Student',      false),
      -- Flores household (Tigbe)
      ('${ID.fm31}', '${ID.hh_flores}',    'Maricel Flores',       'Self',         33, 'Fish Vendor',        10000,         'Self-Employed',true),
      ('${ID.fm32}', '${ID.hh_flores}',    'Baby Flores',          'Child',        4,  '',                    NULL::decimal, 'Dependent',    false),
      ('${ID.fm33}', '${ID.hh_flores}',    'Linda Flores',         'Mother',       60, '',                    NULL::decimal, 'Dependent',    false),
      -- Gonzales household (Minuyan)
      ('${ID.fm34}', '${ID.hh_gonzales}',  'Efren Gonzales',       'Self',         50, 'Factory Worker',     8000,          'Employed',     true),
      ('${ID.fm35}', '${ID.hh_gonzales}',  'Marilyn Gonzales',     'Spouse',       47, 'Cashier',            6000,          'Employed',     false),
      ('${ID.fm36}', '${ID.hh_gonzales}',  'John Gonzales',        'Child',        20, '',                    NULL::decimal, 'Student',      false),
      -- Navarro household (Balayong)
      ('${ID.fm37}', '${ID.hh_navarro}',   'Luzviminda Navarro',   'Self',         68, 'Pensioner',          2000,          'Retired',      true),
      ('${ID.fm38}', '${ID.hh_navarro}',   'Pedro Navarro',        'Spouse',       70, 'Retired',            2000,          'Retired',      false),
      ('${ID.fm39}', '${ID.hh_navarro}',   'Anna Navarro',         'Child',        30, 'Factory Worker',     15000,         'Employed',     false),
      -- Soriano household (Alawihaw)
      ('${ID.fm40}', '${ID.hh_soriano}',   'Dante Soriano',        'Self',         22, '',                    NULL::decimal, 'Student',      true),
      ('${ID.fm41}', '${ID.hh_soriano}',   'Elena Soriano',        'Mother',       50, 'Laborer',            15000,         'Employed',     false),
      ('${ID.fm42}', '${ID.hh_soriano}',   'Karl Soriano',         'Sibling',      18, '',                    NULL::decimal, 'Student',      false)
  `);

  // ==========================================================================
  // 5. INTERVENTION TYPES (7) – dynamic types managed by admin
  // ==========================================================================
  console.log('[5/26] Seeding intervention_types...');
  await q.query(`
    INSERT INTO intervention_types (id, code, name, description, is_active)
    VALUES
      ('${ID.it_fa}',    'FA',   'Financial Assistance',  'Direct financial aid disbursement to beneficiaries',                        true),
      ('${ID.it_c}',     'C',    'Cash Assistance',       'Cash-based assistance distribution',                                          true),
      ('${ID.it_csr}',   'CSR',  'Case Study Report',     'Comprehensive Social Report – assessment documentation',                     true),
      ('${ID.it_r}',     'R',    'Referral',              'Referral to external agency or service provider',                             true),
      ('${ID.it_h}',     'H',    'Home Visit',            'Home visit for wellness check or monitoring',                                 true),
      ('${ID.it_hv}',    'HV',   'Home Visit Variation',  'Home visit with additional services or distribution',                        true),
      ('${ID.it_other}', 'Other','Other Intervention',    'Custom intervention type defined by admin',                                   true)
    ON CONFLICT (code) DO NOTHING
  `);

  // ==========================================================================
  // 6. CASES (8) – all 5 FSM statuses covered
  // ==========================================================================
  console.log('[6/26] Seeding cases...');
  await q.query(`
    INSERT INTO cases (id, control_no, beneficiary_id, service_requested, requirements_checklist, status, assigned_worker_id, created_at)
    VALUES
      ('${ID.c_1}','NORZ-2025-0001','${ID.b_alcala}','{Financial Aid}',
       '[{"key":"med_cert","checked":true},{"key":"indigency","checked":true},{"key":"valid_id","checked":true}]',
       'disbursed',  '${ID.u_worker_bigte}',   '2025-01-15 09:00:00'),
      ('${ID.c_2}','NORZ-2025-0002','${ID.b_cruz}','{Medical Assistance}',
       '[{"key":"med_cert","checked":true},{"key":"prescription","checked":true}]',
       'approved',   '${ID.u_worker_matictic}','2025-02-10 10:30:00'),
      ('${ID.c_3}','NORZ-2025-0003','${ID.b_garcia}','{Financial Aid,Educational Assistance}',
       '[{"key":"reg_form","checked":true},{"key":"grades","checked":true},{"key":"indigency","checked":true}]',
       'disbursed',  '${ID.u_worker_bigte}',   '2025-02-20 14:00:00'),
      ('${ID.c_4}','NORZ-2025-0004','${ID.b_reyes}','{Medical Assistance,Medicine}',
       '[{"key":"med_cert","checked":true},{"key":"prescription","checked":true},{"key":"pwd_id","checked":true}]',
       'approved',   '${ID.u_worker_bigte}',   '2025-03-05 08:15:00'),
      ('${ID.c_5}','NORZ-2025-0005','${ID.b_mendoza}','{Burial Assistance}',
       '[{"key":"death_cert","checked":true},{"key":"indigency","checked":true},{"key":"funeral_contract","checked":true}]',
       'closed',     '${ID.u_worker_matictic}','2025-03-15 11:00:00'),
      ('${ID.c_6}','NORZ-2025-0006','${ID.b_aquino}','{Educational Assistance}',
       '[{"key":"reg_form","checked":true},{"key":"grades","checked":false}]',
       'in_review',  '${ID.u_worker_matictic}','2025-04-01 13:00:00'),
      ('${ID.c_7}','NORZ-2025-0007','${ID.b_roxas}','{Financial Aid,Food Assistance}',
       '[{"key":"indigency","checked":true},{"key":"valid_id","checked":true}]',
       'pending_assessment','${ID.u_worker_bigte}','2025-04-10 09:30:00'),
      ('${ID.c_8}','NORZ-2025-0008','${ID.b_santos}','{Medical Assistance}',
       '[{"key":"med_cert","checked":false},{"key":"prescription","checked":false}]',
       'pending_assessment','${ID.u_worker_matictic}','2025-04-12 15:45:00')
  `);

  // ==========================================================================
  // 6. CASE HISTORY (25) – full FSM transition audit trail
  // ==========================================================================
  console.log('[7/26] Seeding case_history...');
  await q.query(`
    INSERT INTO case_history (id, case_id, from_status, to_status, changed_by_role, changed_by_id, remarks, transition_type, created_at)
    VALUES
      -- Case 1: pending → in_review → approved → disbursed (full happy path)
      -- Coordinator field intake → social worker office review → coordinator approval → coordinator field disbursement
      ('${ID.ch1}', '${ID.c_1}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake completed – Bigte home visit',         'standard', '2025-01-15 09:05:00'),
      ('${ID.ch2}', '${ID.c_1}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_bigte}',   'Documents verified at MSWDO office',                'standard', '2025-01-16 10:00:00'),
      ('${ID.ch3}', '${ID.c_1}', 'in_review',           'approved',           'coordinator',  '${ID.u_coordinator}',     'Approved by coordinator review',                    'standard', '2025-01-17 14:30:00'),
      ('${ID.ch4}', '${ID.c_1}', 'approved',            'disbursed',          'coordinator',  '${ID.u_coordinator}',     'Funds disbursed via Landbank, PHP 5,000',           'standard', '2025-01-20 11:00:00'),
      -- Case 2: pending → in_review → approved
      ('${ID.ch5}', '${ID.c_2}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – medical emergency flagged',           'standard','2025-02-10 10:35:00'),
      ('${ID.ch6}', '${ID.c_2}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_matictic}','Office assessment: medical urgency verified',        'standard', '2025-02-12 09:00:00'),
      ('${ID.ch7}', '${ID.c_2}', 'in_review',           'approved',           'coordinator',  '${ID.u_coordinator}',     'Medical assistance approved, PHP 3,000',             'standard', '2025-02-14 16:00:00'),
      -- Case 3: full path with override
      ('${ID.ch8}', '${ID.c_3}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – educational + financial needs assessed','standard', '2025-02-20 14:10:00'),
      ('${ID.ch9}', '${ID.c_3}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_bigte}',   'Fast-tracked due to enrollment deadline',            'standard', '2025-02-20 16:00:00'),
      ('${ID.ch10}','${ID.c_3}', 'in_review',           'approved',           'admin',        '${ID.u_admin}',          'OVERRIDE: Mayor urgent endorsement',                 'override', '2025-02-21 08:00:00'),
      ('${ID.ch11}','${ID.c_3}', 'approved',            'disbursed',          'coordinator',  '${ID.u_coordinator}',     'PHP 8,000 disbursed (edu + cash aid) in field',      'standard', '2025-02-25 10:00:00'),
      -- Case 4: pending → in_review → approved
      ('${ID.ch12}','${ID.c_4}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'PWD medical field intake – home visit conducted',    'standard', '2025-03-05 08:20:00'),
      ('${ID.ch13}','${ID.c_4}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_bigte}',   'Office PWD verification complete',                   'standard', '2025-03-06 11:00:00'),
      ('${ID.ch14}','${ID.c_4}', 'in_review',           'approved',           'coordinator',  '${ID.u_coordinator}',     'Approved PHP 4,500',                                 'standard', '2025-03-08 09:00:00'),
      -- Case 5: full path → closed
      ('${ID.ch15}','${ID.c_5}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – family bereavement assessment',       'standard', '2025-03-15 11:10:00'),
      ('${ID.ch16}','${ID.c_5}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_matictic}','Death cert & funeral docs verified at office',       'standard', '2025-03-16 14:00:00'),
      ('${ID.ch17}','${ID.c_5}', 'in_review',           'approved',           'coordinator',  '${ID.u_coordinator}',     'Burial assistance PHP 10,000 approved',              'standard', '2025-03-17 10:00:00'),
      ('${ID.ch18}','${ID.c_5}', 'approved',            'disbursed',          'coordinator',  '${ID.u_coordinator}',     'Disbursed to funeral home',                          'standard', '2025-03-18 15:00:00'),
      ('${ID.ch19}','${ID.c_5}', 'disbursed',           'closed',             'social_worker','${ID.u_worker_matictic}','Case closed – services rendered',                    'standard', '2025-03-30 09:00:00'),
      -- Case 6: pending → in_review (awaiting grades document)
      ('${ID.ch20}','${ID.c_6}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – educational assistance for college student','standard', '2025-04-01 13:15:00'),
      ('${ID.ch21}','${ID.c_6}', 'pending_assessment',  'in_review',          'social_worker','${ID.u_worker_matictic}','Pending final grades submission – office follow-up','standard', '2025-04-03 10:00:00'),
      -- Case 7: just created (pending)
      ('${ID.ch22}','${ID.c_7}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – senior citizen assistance in Bigte',  'standard', '2025-04-10 09:35:00'),
      -- Case 8: just created (pending)
      ('${ID.ch23}','${ID.c_8}', NULL,                  'pending_assessment', 'coordinator',  '${ID.u_coordinator}',     'Field intake – medical certificate pending referral', 'standard','2025-04-12 15:50:00'),

      -- Additional history records for cases that had status jumps
      ('${ID.ch24}','${ID.c_4}', 'approved',            'in_review',          'admin',        '${ID.u_admin}',          'Returned for additional PWD verification','override', '2025-03-07 13:00:00'),
      ('${ID.ch25}','${ID.c_4}', 'in_review',           'approved',           'coordinator',  '${ID.u_coordinator}',     'Re-approved after verification',          'standard', '2025-03-08 08:30:00')
  `);

  // ==========================================================================
  // 7. INTERVENTIONS (10) – varied types, fund sources, signature statuses
  // ==========================================================================
  console.log('[8/26] Seeding interventions...');
  await q.query(`
    INSERT INTO interventions (id, case_id, household_id, intervention_type, amount, fund_source, agency, service_date, voucher_no, or_reference, worker_signature_url, client_signature_url, client_receipt_url, signature_status, logged_by)
    VALUES
      ('${ID.int1}',  '${ID.c_1}','${ID.hh_alcala}',  'FA', 5000.00, 'Regular', 'DSWD',       '2025-01-20','VCH-2025-001','OR-2025-001','/sig/coordinator/20250120.png','/sig/client/alcala/20250120.png','/receipt/alcala/20250120.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int2}',  '${ID.c_2}','${ID.hh_cruz}',     'C',  3000.00, 'Legislative','Congressman', '2025-02-14','VCH-2025-002','OR-2025-002','/sig/coordinator/20250214.png',NULL,NULL,'signatures_pending','${ID.u_coordinator}'),
      ('${ID.int3}',  '${ID.c_3}','${ID.hh_garcia}',   'FA', 5000.00, 'Regular', 'DSWD',       '2025-02-25','VCH-2025-003','OR-2025-003','/sig/coordinator/20250225.png','/sig/client/garcia/20250225.png','/receipt/garcia/20250225.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int4}',  '${ID.c_3}','${ID.hh_garcia}',   'CSR',3000.00, 'PDAF',    'Senator Office','2025-02-25','VCH-2025-004','OR-2025-004','/sig/coordinator/20250225b.png','/sig/client/garcia/20250225b.png','/receipt/garcia/20250225b.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int5}',  '${ID.c_4}','${ID.hh_reyes}',    'R',  4500.00, 'Regular', 'DSWD',       '2025-03-08','VCH-2025-005','OR-2025-005','/sig/coordinator/20250308.png',NULL,NULL,'signatures_pending','${ID.u_coordinator}'),
      ('${ID.int6}',  '${ID.c_5}','${ID.hh_mendoza}',  'FA', 10000.00,'Donation','LGU Norzagaray','2025-03-18','VCH-2025-006','OR-2025-006','/sig/coordinator/20250318.png','/sig/client/mendoza/20250318.png','/receipt/mendoza/20250318.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int7}',  '${ID.c_1}','${ID.hh_alcala}',  'HV', 2000.00, 'Regular', 'DSWD',       '2025-03-22','VCH-2025-007','OR-2025-007','/sig/coordinator/20250322.png','/sig/client/alcala/20250322.png','/receipt/alcala/20250322.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int8}',  '${ID.c_2}','${ID.hh_cruz}',     'H',  1500.00, 'Regular', 'DSWD',       '2025-03-28','VCH-2025-008','OR-2025-008','/sig/coordinator/20250328.png','/sig/client/cruz/20250328.png','/receipt/cruz/20250328.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int9}',  '${ID.c_5}','${ID.hh_mendoza}',  'C',  5000.00, 'Regular', 'DSWD',       '2025-04-05','VCH-2025-009','OR-2025-009','/sig/coordinator/20250405.png','/sig/client/mendoza2/20250405.png','/receipt/mendoza2/20250405.png','signatures_collected','${ID.u_coordinator}'),
      ('${ID.int10}', '${ID.c_4}','${ID.hh_reyes}',    'C',  2500.00, 'Regular', 'DSWD',       '2025-04-10','VCH-2025-010','OR-2025-010','/sig/coordinator/20250410.png',NULL,NULL,'signatures_pending','${ID.u_coordinator}')
  `);

  // ==========================================================================
  // 8. CASE TRACKER LOG (8) – daily transaction log
  // ==========================================================================
  console.log('[9/26] Seeding case_tracker_log...');
  await q.query(`
    INSERT INTO case_tracker_log (id, daily_seq_num, transaction_date, tracker_id, surname, first_name, middle_name, gender, age_range, client_category, barangay, intervention_remarks)
    VALUES
      ('${ID.trk1}', 1, '2025-01-20','TRK-20250120-001','Alcala',   'Rodolfo',  'Garcia',  'M','18-59','Senior Citizen','Bigte',     'FA — PHP 5,000'),
      ('${ID.trk2}', 1, '2025-02-14','TRK-20250214-001','Cruz',     'Antonio',  'Lopez',   'M','18-59','Family',        'Matictic',  'Medical Assistance — PHP 3,000'),
      ('${ID.trk3}', 1, '2025-02-25','TRK-20250225-001','Garcia',   'Francisco','Aquino',  'M','18-59','Youth',         'Partida',   'FA + Educational — PHP 8,000 total'),
      ('${ID.trk4}', 1, '2025-03-08','TRK-20250308-001','Reyes',    'Carmen',   'Villanueva','F','18-59','PWD',           'Partida',   'Medical Assistance — PHP 4,500'),
      ('${ID.trk5}', 1, '2025-03-18','TRK-20250318-001','Mendoza',  'Ricardo',  'Fernando', 'M','60+',  'Senior Citizen','San Mateo', 'Burial Assistance — PHP 10,000'),
      ('${ID.trk6}', 2, '2025-03-22','TRK-20250322-002','Alcala',   'Rodolfo',  'Garcia',   'M','18-59','Senior Citizen','Bigte',     'HV — PHP 2,000 (home visit)'),
      ('${ID.trk7}', 1, '2025-04-05','TRK-20250405-001','Mendoza',  'Ricardo',  'Fernando', 'M','60+',  'Senior Citizen','San Mateo', 'Cash Assistance follow-up — PHP 5,000'),
      ('${ID.trk8}', 1, '2025-04-10','TRK-20250410-001','Reyes',    'Carmen',   'Villanueva','F','18-59','PWD',           'Partida',   'Medicine assistance — PHP 2,500')
  `);

  // ==========================================================================
  // 9. ACCESS CARD SERVICES (6)
  // ==========================================================================
  console.log('[10/26] Seeding access_card_services...');
  await q.query(`
    INSERT INTO access_card_services (id, access_card_code, service_date, service_rendered, cost, agency, worker_name_sign, intervention_id)
    VALUES
      ('${ID.acs1}','NORZ-AC-2025-0001','2025-01-20','Financial Aid Disbursement',         5000.00,'DSWD',           'Emmanuel T. Reyes', '${ID.int1}'),
      ('${ID.acs2}','NORZ-AC-2025-0001','2025-03-22','Home Visit – Wellness Check',        2000.00,'MSWDO',          'Emmanuel T. Reyes', '${ID.int7}'),
      ('${ID.acs3}','NORZ-AC-2025-0003','2025-02-14','Medical Assistance Referral',        3000.00,'Congressman Office','Emmanuel T. Reyes','${ID.int2}'),
      ('${ID.acs4}','NORZ-AC-2025-0005','2025-02-25','Educational + Cash Aid',             8000.00,'DSWD',           'Emmanuel T. Reyes', '${ID.int3}'),
      ('${ID.acs5}','NORZ-AC-2025-0007','2025-03-18','Burial Assistance',                  10000.00,'LGU Norzagaray', 'Emmanuel T. Reyes', '${ID.int5}'),
      ('${ID.acs6}','NORZ-AC-2025-0006','2025-03-08','PWD Medical Assistance',            4500.00,'DSWD',           'Emmanuel T. Reyes', '${ID.int5}')
  `);

  // ==========================================================================
  // 10. IRF CASES (4) – all categories & dispositions exercised
  // ==========================================================================
  console.log('[11/26] Seeding irf_cases...');
  await q.query(`
    INSERT INTO irf_cases (id, blotter_entry_number, case_category, datetime_reported, datetime_incident, item_a_reporting_person, item_b_person_reported, encrypted_narration, case_disposition, msdw_signature_url, reporting_signature_url)
    VALUES
      ('${ID.irf1}','BLOTTER-2025-001','Abuse',
       '2025-01-25 09:00:00','2025-01-24 20:00:00',
       '{"name":"Maria Dela Rosa","address":"Purok 2, Bigte","phone":"09181234567"}',
       '{"name":"Pedro H. Santos","address":"Purok 5, Bigte","relationship":"Neighbor","age_est":45}',
       decode(encode('Alleged physical abuse reported by neighbor. Victim observed with bruises on upper arms. Incident occurred evening of Jan 24.', 'base64'), 'base64'),
       'Under Investigation','/sig/irf/msdw/20250125.png','/sig/irf/reporting/20250125.png'),

      ('${ID.irf2}','BLOTTER-2025-002','Neglect',
       '2025-02-18 14:00:00','2025-02-15 10:00:00',
       '{"name":"Barangay Kagawad","address":"Barangay Hall, Matictic","phone":"09182345678"}',
       '{"name":"Lolita G. Reyes","address":"Purok 1, Matictic","relationship":"Guardian","age_est":62}',
       decode(encode('Report of child neglect. Minor aged 8 found unsupervised for extended period. Guardian reportedly left to work in Manila.', 'base64'), 'base64'),
       'Referred to WCPD','/sig/irf/msdw/20250218.png',NULL),

      ('${ID.irf3}','BLOTTER-2025-003','Exploitation',
       '2025-03-10 11:00:00','2025-03-08 06:00:00',
       '{"name":"Anonymous (thru hotline)","address":"N/A","phone":"N/A"}',
       '{"name":"Unknown employer","address":"Quarry site, Bitbit","relationship":"Employer","age_est":null}',
       decode(encode('Report of child labor at quarry site. Anonymous caller reported minors working in hazardous conditions.', 'base64'), 'base64'),
       'Referred to PNP','/sig/irf/msdw/20250310.png',NULL),

      ('${ID.irf4}','BLOTTER-2025-004','Criminal',
       '2025-03-28 16:00:00','2025-03-27 22:00:00',
       '{"name":"Elena M. Torres","address":"Purok 4, Bangkal","phone":"09183456789"}',
       '{"name":"Rogelio P. Cruz","address":"Purok 4, Bangkal","relationship":"Ex-partner","age_est":38}',
       decode(encode('VAWC case. Victim reports domestic violence incident. Physical evidence documented. PNP blotter entry cross-referenced.', 'base64'), 'base64'),
       'Closed','/sig/irf/msdw/20250328.png','/sig/irf/reporting/20250328.png')
  `);

  // ==========================================================================
  // 11. PROGRAMS (6) – diverse programs with structured approval workflows
  // ==========================================================================
  console.log('[12/26] Seeding programs...');
  await q.query(`
    INSERT INTO programs (id, name, category, waiting_period_days, required_documents, fund_sources, approval_workflow, form_template, legal_basis, is_active, form_version)
    VALUES
      ('${ID.prog_akap}',
       'AKAP (Ayuda para sa Kapos ang Kita Program)',
       'Financial Assistance',
       7,
       '["Medical Certificate","Barangay Indigency","Valid ID"]',
       '{Regular,PDAF,Legislative}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":2,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":3,"order":1},{"stepName":"Mayor Approval","approverRole":"mayor","slaDays":2,"order":2},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":3,"order":3}]',
       '{"type":"object","title":"AKAP Application","properties":{"amount":{"type":"number","title":"Amount (PHP)","minimum":500,"maximum":15000},"purpose":{"type":"string","title":"Purpose","enum":["Medical","Education","Burial","Food","Transportation","Other"]},"remarks":{"type":"string","title":"Remarks","format":"textarea"}},"required":["amount","purpose"]}',
       'RA 11310 (Pantawid Pamilyang Pilipino Program Act)',
       true, 1),

      ('${ID.prog_medical}',
       'Medical Assistance Program',
       'Health',
       3,
       '["Medical Certificate","Prescription","Barangay Indigency","Valid ID"]',
       '{Regular,Legislative,Donation}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":2,"order":1},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":2,"order":2}]',
       '{"type":"object","title":"Medical Assistance","properties":{"hospital":{"type":"string","title":"Hospital/Clinic"},"diagnosis":{"type":"string","title":"Diagnosis"},"amount":{"type":"number","title":"Amount (PHP)","minimum":500,"maximum":20000},"admission_date":{"type":"string","title":"Date of Admission","format":"date"},"doctor_name":{"type":"string","title":"Attending Physician"}},"required":["hospital","diagnosis","amount"]}',
       'RA 11223 (Universal Health Care Act)',
       true, 1),

      ('${ID.prog_burial}',
       'Burial Assistance Program',
       'Crisis Intervention',
       1,
       '["Death Certificate","Barangay Indigency","Funeral Contract","Valid ID of Claimant"]',
       '{Regular,LGU}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":1,"order":1},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":1,"order":2}]',
       '{"type":"object","title":"Burial Assistance","properties":{"deceased_name":{"type":"string","title":"Name of Deceased"},"relationship":{"type":"string","title":"Relationship to Claimant"},"amount":{"type":"number","title":"Amount (PHP)","minimum":3000,"maximum":15000},"funeral_home":{"type":"string","title":"Funeral Home"},"date_of_death":{"type":"string","title":"Date of Death","format":"date"}},"required":["deceased_name","relationship","amount"]}',
       'LGU Ordinance 2023-05 (Burial Assistance)',
       true, 1),

      ('${ID.prog_education}',
       'Educational Assistance Program',
       'Education',
       5,
       '["Registration Form","Report Card/Grades","Barangay Indigency","School ID"]',
       '{Regular,PDAF,Legislative,Donation}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":2,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":3,"order":1},{"stepName":"Mayor Approval","approverRole":"mayor","slaDays":2,"order":2},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":3,"order":3}]',
       '{"type":"object","title":"Educational Assistance","properties":{"school_name":{"type":"string","title":"School"},"grade_level":{"type":"string","title":"Grade/Year Level"},"amount":{"type":"number","title":"Amount (PHP)","minimum":500,"maximum":10000},"semester":{"type":"string","title":"Semester/SY","enum":["1st Sem","2nd Sem","Summer"]}},"required":["school_name","grade_level","amount"]}',
       'RA 10931 (Universal Access to Quality Tertiary Education Act)',
       true, 1),

      ('${ID.prog_food}',
       'Food Assistance Program',
       'Basic Needs',
       3,
       '["Barangay Indigency","Valid ID"]',
       '{Regular,Donation}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":2,"order":1}]',
       '{"type":"object","title":"Food Assistance","properties":{"household_size":{"type":"number","title":"Household Size","minimum":1,"maximum":15},"reason":{"type":"string","title":"Reason for Assistance","enum":["Calamity","Job Loss","Medical Crisis","Other"]},"amount":{"type":"number","title":"Amount (PHP)","minimum":500,"maximum":5000}},"required":["household_size","reason","amount"]}',
       'RA 11310',
       true, 1),

      ('${ID.prog_transpo}',
       'Transportation Assistance',
       'Basic Needs',
       1,
       '["Barangay Indigency","Valid ID","Referral Letter (if applicable)"]',
       '{Regular,LGU}',
       '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":1,"order":1}]',
       '{"type":"object","title":"Transportation Assistance","properties":{"destination":{"type":"string","title":"Destination"},"purpose":{"type":"string","title":"Purpose","enum":["Medical Referral","Government Transaction","Employment","Return Home"]},"amount":{"type":"number","title":"Amount (PHP)","minimum":100,"maximum":3000}},"required":["destination","purpose","amount"]}',
       'MSWDO Internal Policy 2024-001',
       false, 1)
  `);

  // ==========================================================================
  // 12. FORM VERSION HISTORY (3)
  // ==========================================================================
  console.log('[13/26] Seeding form_version_history...');
  await q.query(`
    INSERT INTO form_version_history (id, program_id, form_template, version, created_at)
    VALUES
      (uuid_generate_v4(), '${ID.prog_akap}',     '{"type":"object","title":"AKAP Application v1","properties":{"amount":{"type":"number"},"purpose":{"type":"string"}},"required":["amount","purpose"]}', 1, '2024-11-01 08:00:00'),
      (uuid_generate_v4(), '${ID.prog_medical}',  '{"type":"object","title":"Medical Assistance v1","properties":{"hospital":{"type":"string"},"diagnosis":{"type":"string"},"amount":{"type":"number"}},"required":["hospital"]}', 1, '2024-11-01 08:00:00'),
      (uuid_generate_v4(), '${ID.prog_education}','{"type":"object","title":"Educational Assistance v1","properties":{"school":{"type":"string"},"grade":{"type":"string"},"amount":{"type":"number"}},"required":["school"]}', 1, '2025-01-15 08:00:00')
  `);

  // ==========================================================================
  // 13. PROGRAM ASSIGNMENTS (6)
  // ==========================================================================
  console.log('[14/26] Seeding program_assignments...');
  await q.query(`
    INSERT INTO program_assignments (id, case_id, program_id, status, current_step_order, assigned_worker_id)
    VALUES
      ('${ID.pa1}','${ID.c_1}','${ID.prog_akap}',      'approved',  4, '${ID.u_worker_bigte}'),
      ('${ID.pa2}','${ID.c_2}','${ID.prog_medical}',   'approved',  3, '${ID.u_worker_matictic}'),
      ('${ID.pa3}','${ID.c_3}','${ID.prog_akap}',      'approved',  4, '${ID.u_worker_bigte}'),
      ('${ID.pa4}','${ID.c_3}','${ID.prog_education}', 'approved',  4, '${ID.u_worker_bigte}'),
      ('${ID.pa5}','${ID.c_6}','${ID.prog_education}', 'in_review', 1, '${ID.u_worker_matictic}'),
      ('${ID.pa6}','${ID.c_7}','${ID.prog_akap}',      'pending',   0, '${ID.u_worker_bigte}')
  `);

  // ==========================================================================
  // 14. PROGRAM ASSIGNMENT STEPS (18)
  // ==========================================================================
  console.log('[15/26] Seeding program_assignment_steps...');
  await q.query(`
    INSERT INTO program_assignment_steps (id, assignment_id, step_order, step_name, approver_role, status, approved_by, approved_at, remarks)
    VALUES
      -- PA1 (Case 1 → AKAP, approved)
      ('${ID.pas1}', '${ID.pa1}',0,'SW Assessment', 'social_worker','approved','${ID.u_worker_bigte}',  '2025-01-16 09:00:00','All docs complete'),
      ('${ID.pas2}', '${ID.pa1}',1,'Head Approval', 'coordinator',  'approved','${ID.u_coordinator}',     '2025-01-17 14:00:00','Approved per policy'),
      ('${ID.pas3}', '${ID.pa1}',2,'Mayor Approval','mayor',        'approved','${ID.u_mayor}',          '2025-01-18 09:00:00','Approved'),
      ('${ID.pas4}', '${ID.pa1}',3,'Disbursement',  'coordinator',  'approved','${ID.u_coordinator}',     '2025-01-20 10:00:00','PHP 5,000 disbursed'),
      -- PA2 (Case 2 → Medical, approved)
      ('${ID.pas5}', '${ID.pa2}',0,'SW Assessment', 'social_worker','approved','${ID.u_worker_matictic}','2025-02-12 09:00:00','Medical urgency verified'),
      ('${ID.pas6}', '${ID.pa2}',1,'Head Approval', 'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-13 16:00:00','Approved'),
      ('${ID.pas7}', '${ID.pa2}',2,'Disbursement',  'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-14 15:00:00','PHP 3,000 disbursed'),
      -- PA3 (Case 3 → AKAP, approved)
      ('${ID.pas8}', '${ID.pa3}',0,'SW Assessment', 'social_worker','approved','${ID.u_worker_bigte}',   '2025-02-20 16:00:00','Eligible'),
      ('${ID.pas9}', '${ID.pa3}',1,'Head Approval', 'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-21 10:00:00','Approved'),
      ('${ID.pas10}','${ID.pa3}',2,'Mayor Approval','mayor',        'approved','${ID.u_mayor}',          '2025-02-22 10:00:00','Approved'),
      ('${ID.pas11}','${ID.pa3}',3,'Disbursement',  'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-25 09:00:00','PHP 5,000 disbursed'),
      -- PA4 (Case 3 → Education, approved)
      ('${ID.pas12}','${ID.pa4}',0,'SW Assessment', 'social_worker','approved','${ID.u_worker_bigte}',   '2025-02-20 17:00:00','Enrolled, grades acceptable'),
      ('${ID.pas13}','${ID.pa4}',1,'Head Approval', 'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-21 11:00:00','Approved'),
      ('${ID.pas14}','${ID.pa4}',2,'Mayor Approval','mayor',        'approved','${ID.u_mayor}',          '2025-02-22 11:00:00','Approved'),
      ('${ID.pas15}','${ID.pa4}',3,'Disbursement',  'coordinator',  'approved','${ID.u_coordinator}',     '2025-02-25 10:00:00','PHP 3,000 disbursed'),
      -- PA5 (Case 6 → Education, in_review)
      ('${ID.pas16}','${ID.pa5}',0,'SW Assessment', 'social_worker','approved','${ID.u_worker_matictic}','2025-04-03 10:00:00','Pending grades submission'),
      ('${ID.pas17}','${ID.pa5}',1,'Head Approval', 'coordinator',  'pending', NULL,                     NULL,                    'Awaiting grade docs'),
      -- PA6 (Case 7 → AKAP, pending)
      ('${ID.pas18}','${ID.pa6}',0,'SW Assessment', 'social_worker','pending', NULL,                     NULL,                    'Intake in progress')
  `);

  // ==========================================================================
  // 15. CONSENT LEDGER (12) – one per beneficiary, varied channels & statuses
  // ==========================================================================
  console.log('[16/26] Seeding consent_ledger...');
  await q.query(`
    INSERT INTO consent_ledger (id, beneficiary_id, purpose, channel, status, granted_at)
    VALUES
      ('${ID.cl1}',  '${ID.b_alcala}',    'GIS Intake & Case Processing',                    'in_person','active',  '2025-01-15 09:05:00'),
      ('${ID.cl2}',  '${ID.b_alcala}',    'SMS Notification – Disbursement Updates',         'sms',      'active',  '2025-01-15 09:05:00'),
      ('${ID.cl3}',  '${ID.b_roxas}',     'GIS Intake & Case Processing',                    'in_person','active',  '2025-04-10 09:30:00'),
      ('${ID.cl4}',  '${ID.b_cruz}',      'GIS Intake & Case Processing',                    'in_person','active',  '2025-02-10 10:35:00'),
      ('${ID.cl5}',  '${ID.b_santos}',    'GIS Intake & Case Processing',                    'in_person','active',  '2025-04-12 15:45:00'),
      ('${ID.cl6}',  '${ID.b_garcia}',    'GIS Intake & Case Processing',                    'in_person','active',  '2025-02-20 14:10:00'),
      ('${ID.cl7}',  '${ID.b_reyes}',     'GIS Intake & Case Processing',                    'in_person','active',  '2025-03-05 08:20:00'),
      ('${ID.cl8}',  '${ID.b_reyes}',     'SMS Notification – Approval Status',             'sms',      'active',  '2025-03-05 08:20:00'),
      ('${ID.cl9}',  '${ID.b_mendoza}',   'GIS Intake & Case Processing',                    'in_person','active',  '2025-03-15 11:10:00'),
      ('${ID.cl10}', '${ID.b_aquino}',    'GIS Intake & Case Processing',                    'in_person','active',  '2025-04-01 13:15:00'),
      ('${ID.cl11}', '${ID.b_fernando}',  'GIS Intake & Case Processing',                    'in_person','revoked', '2024-12-01 10:00:00'),
      ('${ID.cl12}', '${ID.b_lopez}',     'GIS Intake & Case Processing',                    'online',   'active',  '2025-03-20 14:00:00')
  `);

  // ==========================================================================
  // 16. NOTIFICATIONS (10) – diverse categories & channels
  // ==========================================================================
  console.log('[17/26] Seeding notifications...');
  await q.query(`
    INSERT INTO notifications (id, recipient_id, title, message, category, reference_id, channel, is_read, sent, sent_at)
    VALUES
      ('${ID.not1}',  '${ID.u_worker_bigte}',   'Case NORZ-2025-0001 Approved','Case NORZ-2025-0001 for Rodolfo Alcala has been approved by coordinator.','case_update','${ID.c_1}','in_app',true,  true,'2025-01-17 14:30:00'),
      ('${ID.not2}',  '${ID.u_worker_matictic}','Case NORZ-2025-0002 Approved','Case NORZ-2025-0002 for Antonio Cruz has been approved.','case_update','${ID.c_2}','in_app',true,  true,'2025-02-14 16:00:00'),
      ('${ID.not3}',  '${ID.u_worker_bigte}',   'New Case Assigned','Case NORZ-2025-0007 has been assigned to you.','case_update','${ID.c_7}','in_app',false,true,'2025-04-10 09:30:00'),
      ('${ID.not4}',  '${ID.u_coordinator}',    'Approval Required','Case NORZ-2025-0006 is in review and requires your approval.','approval','${ID.c_6}','in_app',false,true,'2025-04-03 10:00:00'),
      ('${ID.not5}',  '${ID.u_claimant_a}',     'Disbursement Confirmed','Your AKAP assistance of PHP 5,000 has been disbursed.','disbursement','${ID.c_1}','sms',false,true,'2025-01-20 11:00:00'),
      ('${ID.not6}',  '${ID.u_worker_bigte}',   'Sync Conflict Detected','A record conflict was detected for case NORZ-2025-0003.','sync_conflict','${ID.c_3}','in_app',true,true,'2025-02-22 08:30:00'),
      ('${ID.not7}',  '${ID.u_admin}',           'System Maintenance','Scheduled maintenance on 2025-05-01 00:00-04:00.','system',NULL,'in_app',false,true,'2025-04-28 09:00:00'),
      ('${ID.not8}',  '${ID.u_worker_matictic}','Approval Override Notice','Case NORZ-2025-0003 approved via admin override by Rosario Mendoza.','approval','${ID.c_3}','in_app',true,true,'2025-02-21 08:05:00'),
      ('${ID.not9}',  '${ID.u_mayor}',          'Cases Pending Mayor Approval','You have 2 cases pending your approval.','approval',NULL,'in_app',false,false,NULL),
      ('${ID.not10}', '${ID.u_worker_bigte}',   'New Chat Message','Emmanuel Reyes sent you a message regarding Case NORZ-2025-0004.','chat','${ID.c_4}','in_app',false,true,'2025-03-07 14:00:00')
  `);

  // ==========================================================================
  // 17. NOTIFICATION PREFERENCES (6)
  // ==========================================================================
  console.log('[18/26] Seeding notification_preferences...');
  await q.query(`
    INSERT INTO notification_preferences (user_id, channel, category, opted_in)
    VALUES
      ('${ID.u_worker_bigte}',   'in_app','case_update',  true),
      ('${ID.u_worker_bigte}',   'sms',   'case_update',  true),
      ('${ID.u_worker_matictic}','in_app','case_update',  true),
      ('${ID.u_worker_matictic}','sms',   'case_update',  false),
      ('${ID.u_coordinator}',    'in_app','approval',     true),
      ('${ID.u_coordinator}',    'sms',   'approval',     true)
  `);

  // ==========================================================================
  // 18. CHAT MESSAGES (8) – conversation between workers & coordinator
  // ==========================================================================
  console.log('[19/26] Seeding chat_messages...');
  await q.query(`
    INSERT INTO chat_messages (id, sender_id, sender_name, recipient_id, content, is_read, conversation_id, read_at)
    VALUES
      -- Coordinator (field) reports findings → Social Worker (office) reviews → Coordinator confirms
      ('${ID.chat1}','${ID.u_coordinator}',   'Emmanuel Reyes',  '${ID.u_worker_bigte}',   'Sir Juan, requesting your review for case NORZ-2025-0004 (PWD medical). Patient is scheduled for procedure next week. All field docs attached.',false,'CONV-2025-001',NULL),
      ('${ID.chat2}','${ID.u_worker_bigte}',  'Juan Dela Cruz',  '${ID.u_coordinator}',    'Noted, Emmanuel. Medical certificate is complete and legible. I will proceed with office assessment.',true,'CONV-2025-001','2025-03-07 16:00:00'),
      ('${ID.chat3}','${ID.u_coordinator}',   'Emmanuel Reyes',  '${ID.u_worker_bigte}',   'Thank you, Sir. PWD ID, med cert, and prescription verified during home visit – all uploaded to vault.',true,'CONV-2025-001','2025-03-08 09:00:00'),
      -- Social workers coordinate office tasks between themselves
      ('${ID.chat4}','${ID.u_worker_matictic}','Lorna B. Santos', '${ID.u_worker_bigte}',  'Hi Juan, can you handle the pending case reviews for Tumana tomorrow? I have a seminar at the Municipal Hall.',true,'CONV-2025-002','2025-03-10 15:30:00'),
      ('${ID.chat5}','${ID.u_worker_bigte}',  'Juan Dela Cruz',  '${ID.u_worker_matictic}','No problem, Lorna. I will process the pending assessments by end of day. Good luck at the seminar!',false,'CONV-2025-002',NULL),
      -- Coordinator requests expedited review from social worker
      ('${ID.chat6}','${ID.u_coordinator}',   'Emmanuel Reyes',  '${ID.u_worker_matictic}','Maam Lorna, requesting expedited review for burial assistance case NORZ-2025-0005. The family is requesting urgent processing.',true,'CONV-2025-003','2025-03-15 14:00:00'),
      ('${ID.chat7}','${ID.u_worker_matictic}','Lorna B. Santos', '${ID.u_coordinator}',   'Already processed, Emmanuel. Death cert and funeral contract verified at office. Ready for your field disbursement.',true,'CONV-2025-003','2025-03-16 10:00:00'),
      -- Coordinator reports field work completion to social worker
      ('${ID.chat8}','${ID.u_coordinator}',   'Emmanuel Reyes',  '${ID.u_worker_bigte}',   'Sir, re: NORZ-2025-0001 home visit. Completed wellness check and food pack distribution today. Photos uploaded to vault.',false,'CONV-2025-004',NULL)
  `);

  // ==========================================================================
  // 19. CSR REPORTS (3)
  // ==========================================================================
  console.log('[20/26] Seeding csr_reports...');
  await q.query(`
    INSERT INTO csr_reports (id, case_id, control_no, social_worker_name, social_worker_position, referral_origin, reason_for_referral, problem_presented, family_background, socio_economic_profile, assessment_analysis, recommendation, intervention_plan, finalized, created_by)
    VALUES
      ('${ID.csr1}','${ID.c_1}','CSR-2025-001','Juan Dela Cruz','Social Worker II','Barangay Health Center','Elderly client with mobility issues requiring financial aid for medical treatment.',
       'Mr. Alcala is a 52-year-old senior from Bigte who sustained a leg injury from a workplace accident. He requires ongoing physical therapy and medication.',
       'Mr. Alcala lives with his spouse Rosa (48) and two children Mark (22, employed) and Jenny (16, student). The household has a combined monthly income of approximately PHP 8,500 from Mark employment and Mr. Alcala pension.',
       'Semi-concrete dwelling with electricity and water connection. No owned vehicle. Children are enrolled in public school.',
       'Assessment finds the client eligible for AKAP financial assistance based on income threshold and medical necessity. Supporting documents (med cert, indigency) are valid.',
       'Approve AKAP financial assistance of PHP 5,000 for medical treatment. Schedule follow-up home visit after 30 days.',
       '1. Disburse PHP 5,000 via Landbank. 2. Home visit wellness check within 30 days. 3. Refer to PhilHealth for senior citizen health package.',
       true,'Juan Dela Cruz'),

      ('${ID.csr2}','${ID.c_5}','CSR-2025-002','Lorna B. Santos','Social Worker I','Barangay Captain San Mateo','Burial assistance requested by family of deceased Ricardo Mendoza Sr. (father of beneficiary).',
       'Ricardo Mendoza Jr. (beneficiary) is a 65-year-old senior who lost his father Ricardo Sr. (85) to natural causes. The family cannot afford the PHP 12,000 funeral expenses.',
       'Mendoza household consists of Ricardo Jr. (65, retired), spouse Dalia (61, dependent), and adult son Karlo (35, employed). Combined monthly income: PHP 3,500 (pension + Karlo irregular income).',
       'Wooden dwelling in San Mateo. No running water inside the house. Karlo works as a construction laborer with irregular income.',
       'Burial assistance warranted. Death certificate and funeral contract verified. Family meets indigency criteria.',
       'Approve PHP 10,000 burial assistance for immediate disbursement. Coordinate with LGU for additional indigent burial support.',
       '1. Disburse PHP 10,000 to funeral home. 2. Coordinate with LGU Mayor Office for supplemental assistance. 3. Post-burial follow-up within 14 days.',
       true,'Lorna B. Santos'),

      ('${ID.csr3}','${ID.c_6}','CSR-2025-003','Lorna B. Santos','Social Worker I','School Principal – San Mateo NHS','Educational assistance requested for college student Sofia Aquino, enrolled in BS Social Work at Bulacan State University.',
       'Sofia Aquino (27) is a 3rd year BS Social Work student. She is a working student supporting her own education. Needs assistance for enrollment and school supplies.',
       'Aquino household: Sofia (27, student), Bella (19, sibling, also a student), and Alfredo Sr. (55, father, employed as tricycle driver). Combined monthly income: approximately PHP 9,000.',
       'Rental apartment in San Mateo. Father is sole breadwinner supporting two college students. Bella also applied for CHED scholarship.',
       'Client demonstrates strong academic performance (GWA 1.75). Educational assistance is justified to help complete her Social Work degree which will contribute to community development.',
       'Approve PHP 3,000 educational assistance contingent on submission of final grades from last semester.',
       '1. Request final grade submission from Sofia. 2. Upon verification, disburse PHP 3,000. 3. Coordinate with CHED for scholarship application of sibling Bella.',
       false,'Lorna B. Santos')
  `);

  // ==========================================================================
  // 20. DOCUMENT VAULT (5)
  // ==========================================================================
  console.log('[21/26] Seeding document_vault...');
  await q.query(`
    INSERT INTO document_vault (id, file_name, original_name, mime_type, file_size, case_id, beneficiary_id, category, notes, uploaded_by)
    VALUES
      ('${ID.doc1}', '/vault/med/med_cert_alcala_20250115.pdf','MedicalCertificate_Alcala_20250115.pdf','application/pdf',245760, '${ID.c_1}', '${ID.b_alcala}', 'Medical Certificate', 'Collected during field intake – Dr. Reyes, RHU Bigte', '${ID.u_coordinator}'),
      ('${ID.doc2}', '/vault/indigency/indigency_cruz_20250210.pdf','BrgyIndigency_Cruz_20250210.pdf','application/pdf',180224, '${ID.c_2}', '${ID.b_cruz}', 'Barangay Indigency', 'Certified by Barangay Captain, Matictic', '${ID.u_coordinator}'),
      ('${ID.doc3}', '/vault/sig/signature_garcia_20250225.png','ClientSignature_Garcia_20250225.png','image/png', 51200, '${ID.c_3}', '${ID.b_garcia}', 'Signature', 'Client signature collected in field', '${ID.u_coordinator}'),
      ('${ID.doc4}', '/vault/death/death_cert_mendoza_sr_20250315.pdf','DeathCert_MendozaSr_20250315.pdf','application/pdf',156672, '${ID.c_5}', '${ID.b_mendoza}', 'Death Certificate', 'Document retrieved from family during home visit', '${ID.u_coordinator}'),
      ('${ID.doc5}', '/vault/photo/home_visit_alcala_20250322.jpg','HomeVisit_Alcala_20250322.jpg','image/jpeg', 204800, '${ID.c_1}', '${ID.b_alcala}', 'Field Photo', 'Wellness check home visit documentation', '${ID.u_coordinator}')
  `);

  // ==========================================================================
  // 21. SYNC QUEUE (3)
  // ==========================================================================
  console.log('[22/26] Seeding sync_queue...');
  await q.query(`
    INSERT INTO sync_queue (id, device_id, table_name, record_id, operation, payload, client_updated_at, status)
    VALUES
      ('${ID.sync1}','DEV-BIGTE-001','cases','${ID.c_7}','INSERT','{"control_no":"NORZ-2025-0007","beneficiary_id":"${ID.b_roxas}","service_requested":["Financial Aid","Food Assistance"],"status":"pending_assessment"}','2025-04-10 09:30:00','applied'),
      ('${ID.sync2}','DEV-MATICTIC-001','interventions','${ID.int9}','UPDATE','{"amount":5000.00,"fund_source":"Regular"}','2025-04-05 10:00:00','applied'),
      ('${ID.sync3}','DEV-MATICTIC-001','beneficiaries','${ID.b_lopez}','INSERT','{"philsys_number":"PHIL-9876-5432-1012","surname":"Lopez","first_name":"Imelda","gender":"Female","dob":"1970-05-28","address":"909 Purok 5, Bigte, Norzagaray","phone":"09171234512","access_card_code":"NORZ-AC-2025-0012","consent_status":"active","category":"Women"}','2025-03-20 14:00:00','applied')
  `);

  // ==========================================================================
  // 22. VERSION VECTORS (2)
  // ==========================================================================
  console.log('[23/26] Seeding version_vectors...');
  await q.query(`
    INSERT INTO version_vectors (device_id, table_name, local_version, server_version, last_synced_at)
    VALUES
      ('DEV-BIGTE-001',   'cases',         5, 8, '2025-04-10 09:30:00'),
      ('DEV-MATICTIC-001','interventions', 3, 10,'2025-04-05 10:00:00')
  `);

  // ==========================================================================
  // 23. OTP CODES (2)
  // ==========================================================================
  console.log('[24/26] Seeding otp_codes...');
  await q.query(`
    INSERT INTO otp_codes (phone, code, verified, expires_at)
    VALUES
      ('09171000001','654321',false,NOW() + interval '10 minutes'),
      ('09171000002','123456',true,  NOW() - interval '5 minutes')
  `);

  // ==========================================================================
  // 24. AUDIT LOG (5)
  // ==========================================================================
  console.log('[25/26] Seeding audit_log...');
  await q.query(`
    INSERT INTO audit_log (action, reference_id, user_id, details)
    VALUES
      ('irf.created', '${ID.irf1}', '${ID.u_worker_bigte}',   '{"blotter":"BLOTTER-2025-001","category":"Abuse"}'),
      ('irf.disposition_changed', '${ID.irf2}', '${ID.u_worker_matictic}', '{"from":"Under Investigation","to":"Referred to WCPD","reason":"Case jurisdiction falls under WCPD mandate"}'),
      ('irf.disposition_changed', '${ID.irf3}', '${ID.u_worker_bigte}',   '{"from":"Under Investigation","to":"Referred to PNP","reason":"Potential criminal nature requires PNP investigation"}'),
      ('irf.disposition_changed', '${ID.irf4}', '${ID.u_worker_matictic}', '{"from":"Under Investigation","to":"Closed","reason":"Victim retracted complaint. Case resolved through barangay mediation."}'),
      ('compliance.audit', NULL, '${ID.u_auditor}', '{"check":"RLS_policies","result":"pass","checked_at":"2025-04-15 10:00:00"}')
  `);

  // ==========================================================================
  // 25. IDEMPOTENCY KEYS (2)
  // ==========================================================================
  console.log('[26/26] Seeding idempotency_keys...');
  await q.query(`
    INSERT INTO idempotency_keys (key, result)
    VALUES
      ('sync-DEV-BIGTE-001-${ID.c_7}-20250410','{"status":"applied","record_id":"${ID.c_7}"}'),
      ('sync-DEV-MATICTIC-001-${ID.int9}-20250405','{"status":"applied","record_id":"${ID.int9}"}')
  `);

  // ---- Re-enable RLS ----
  await q.query('ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE cases ENABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE interventions ENABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE consent_ledger ENABLE ROW LEVEL SECURITY');
  await q.query('ALTER TABLE irf_cases ENABLE ROW LEVEL SECURITY');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  users:                      8  (admin, 2 workers, coordinator, 2 claimants, mayor, auditor)');
  console.log('  beneficiaries:             18  (across 13 barangays, 5 categories)');
  console.log('  households:                14  (10 barangays)');
  console.log('  family_members:            42  (3 per household, varied relationships)');
  console.log('  cases:                      8  (all 5 FSM statuses)');
  console.log('  case_history:              25  (full transitions + overrides)');
  console.log('  interventions:             10  (admin-managed types, varied fund sources)');
  console.log('  case_tracker_log:           8  (daily transaction log)');
  console.log('  access_card_services:       6  (card-linked service history)');
  console.log('  irf_cases:                  4  (4 categories, 4 dispositions)');
  console.log('  programs:                   6  (4 active + 1 inactive, structured workflows)');
  console.log('  form_version_history:       3');
  console.log('  program_assignments:        6  (3 statuses: pending/in_review/approved)');
  console.log('  program_assignment_steps:  18  (with pending/approved transitions)');
  console.log('  consent_ledger:            12  (active + revoked, varied channels)');
  console.log('  notifications:             10  (6 categories, in_app + sms)');
  console.log('  notification_preferences:   6');
  console.log('  chat_messages:              8  (3 conversations)');
  console.log('  csr_reports:                3  (2 finalized, 1 draft)');
  console.log('  document_vault:             5  (PDFs, images, signatures)');
  console.log('  sync_queue:                 3');
  console.log('  version_vectors:            2');
  console.log('  otp_codes:                  2');
  console.log('  audit_log:                  5');
  console.log('  idempotency_keys:           2');
  console.log('  intervention_types:         7');
  console.log('──────────────────────────────────────────────────────────');
  console.log('  Total:                    236 records across 26 tables');
  console.log('');
  console.log('  Default passwords (all users):');
  console.log('    admin / workers:        admin123 / worker123');
  console.log('    coordinator:            coordinator123');
  console.log('    claimants:              claimant123');
  console.log('    mayor:                  mayor123');
  console.log('    auditor:                auditor123');
  console.log('');
  console.log('  User emails:');
  console.log('    admin@mswdo.test        worker1@mswdo.test');
  console.log('    worker2@mswdo.test      coordinator@mswdo.test');
  console.log('    pedro.claimant@test.com ana.claimant@test.com');
  console.log('    mayor@mswdo.test        auditor@mswdo.test');
  console.log('══════════════════════════════════════════════════════════');

  await q.release();
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
