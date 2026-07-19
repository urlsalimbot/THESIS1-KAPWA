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

function makeAmount(n: number): string {
  return n.toFixed(2);
}

// Deterministic UUIDs – stable IDs for cross-table referencing
const ID = {
  // Users (9)
  u_admin:          '10000000-0000-0000-0000-000000000001',
  u_worker_bigte:   '10000000-0000-0000-0000-000000000002',
  u_worker2:        '10000000-0000-0000-0000-000000000003',
  u_coordinator:    '10000000-0000-0000-0000-000000000004',
  u_claimant_a:     '10000000-0000-0000-0000-000000000005',
  u_claimant_b:     '10000000-0000-0000-0000-000000000006',
  u_mayor:          '10000000-0000-0000-0000-000000000007',
  u_auditor:        '10000000-0000-0000-0000-000000000008',
  u_mfa_admin:      '10000000-0000-0000-0000-000000000009',

  // Person records for claimant users
  p_claimant_pedro: '11000000-0000-0000-0000-000000000001',
  p_claimant_ana:   '11000000-0000-0000-0000-000000000002',
  p_claimant_liza:  '11000000-0000-0000-0000-000000000003',

  // Beneficiaries + persons (21)
  b_dela_cruz:  '20000000-0000-0000-0000-000000000000',
  b_mendoza:    '20000000-0000-0000-0000-000000000001',
  b_santos_legacy:'20000000-0000-0000-0000-000000000002',
  b_alcala:     '20000000-0000-0000-0000-000000000010',
  b_roxas:      '20000000-0000-0000-0000-000000000020',
  b_cruz:       '20000000-0000-0000-0000-000000000030',
  b_santos:     '20000000-0000-0000-0000-000000000040',
  b_garcia:     '20000000-0000-0000-0000-000000000050',
  b_reyes:      '20000000-0000-0000-0000-000000000060',
  b_ricardo:    '20000000-0000-0000-0000-000000000070',
  b_aquino:     '20000000-0000-0000-0000-000000000080',
  b_rivera:     '20000000-0000-0000-0000-000000000090',
  b_villanueva: '20000000-0000-0000-0000-0000000000a0',
  b_fernando:   '20000000-0000-0000-0000-0000000000b0',
  b_lopez:      '20000000-0000-0000-0000-0000000000c0',
  b_delacruz:   '20000000-0000-0000-0000-0000000000d0',
  b_martinez:   '20000000-0000-0000-0000-0000000000e0',
  b_flores:     '20000000-0000-0000-0000-0000000000f0',
  b_gonzales:   '20000000-0000-0000-0000-000000000100',
  b_navarro:    '20000000-0000-0000-0000-000000000110',
  b_soriano:    '20000000-0000-0000-0000-000000000120',

  // Households (20)
  hh_dela_cruz:  '30000000-0000-0000-0000-000000000000',
  hh_mendoza:    '30000000-0000-0000-0000-000000000001',
  hh_alcala:     '30000000-0000-0000-0000-000000000010',
  hh_roxas:      '30000000-0000-0000-0000-000000000020',
  hh_cruz:       '30000000-0000-0000-0000-000000000030',
  hh_santos:     '30000000-0000-0000-0000-000000000040',
  hh_garcia:     '30000000-0000-0000-0000-000000000050',
  hh_reyes:      '30000000-0000-0000-0000-000000000060',
  hh_ricardo:    '30000000-0000-0000-0000-000000000070',
  hh_aquino:     '30000000-0000-0000-0000-000000000080',
  hh_rivera:     '30000000-0000-0000-0000-000000000090',
  hh_villanueva: '30000000-0000-0000-0000-0000000000a0',
  hh_fernando:   '30000000-0000-0000-0000-0000000000b0',
  hh_lopez:      '30000000-0000-0000-0000-0000000000c0',
  hh_delacruz2:  '30000000-0000-0000-0000-0000000000d0',
  hh_martinez2:  '30000000-0000-0000-0000-0000000000e0',
  hh_flores2:    '30000000-0000-0000-0000-0000000000f0',
  hh_gonzales2:  '30000000-0000-0000-0000-000000000100',
  hh_navarro2:   '30000000-0000-0000-0000-000000000110',
  hh_soriano2:   '30000000-0000-0000-0000-000000000120',

  // Cases (10)
  c_dela_cruz: '50000000-0000-0000-0000-000000000000',
  c_mendoza:   '50000000-0000-0000-0000-000000000001',
  c_1: '50000000-0000-0000-0000-000000000010',
  c_2: '50000000-0000-0000-0000-000000000020',
  c_3: '50000000-0000-0000-0000-000000000030',
  c_4: '50000000-0000-0000-0000-000000000040',
  c_5: '50000000-0000-0000-0000-000000000050',
  c_6: '50000000-0000-0000-0000-000000000060',
  c_7: '50000000-0000-0000-0000-000000000070',
  c_8: '50000000-0000-0000-0000-000000000080',

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

  // Intervention types (7)
  it_fa:    '1a000000-0000-0000-0000-000000000001',
  it_c:     '1a000000-0000-0000-0000-000000000002',
  it_csr:   '1a000000-0000-0000-0000-000000000003',
  it_r:     '1a000000-0000-0000-0000-000000000004',
  it_h:     '1a000000-0000-0000-0000-000000000005',
  it_hv:    '1a000000-0000-0000-0000-000000000006',
  it_other: '1a000000-0000-0000-0000-000000000007',

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

  // Consent ledger (15)
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
  cl13: '90000000-0000-0000-0000-00000000000d',
  cl14: '90000000-0000-0000-0000-00000000000e',
  cl15: '90000000-0000-0000-0000-00000000000f',

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

  // Notification preferences (6)
  np_w1_ia: 'a1000000-0000-0000-0000-000000000001',
  np_w1_sm: 'a1000000-0000-0000-0000-000000000002',
  np_w2_ia: 'a1000000-0000-0000-0000-000000000003',
  np_w2_sm: 'a1000000-0000-0000-0000-000000000004',
  np_c_ia:  'a1000000-0000-0000-0000-000000000005',
  np_c_sm:  'a1000000-0000-0000-0000-000000000006',

  // CSR reports (3)
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

  // Household member persons (14)
  hm_p1:  'f0000000-0000-0000-0000-0000000f0001',
  hm_p2:  'f0000000-0000-0000-0000-0000000f0002',
  hm_p3:  'f0000000-0000-0000-0000-0000000f0003',
  hm_p4:  'f0000000-0000-0000-0000-0000000f0004',
  hm_p5:  'f0000000-0000-0000-0000-0000000f0005',
  hm_p6:  'f0000000-0000-0000-0000-0000000f0006',
  hm_p7:  'f0000000-0000-0000-0000-0000000f0007',
  hm_p8:  'f0000000-0000-0000-0000-0000000f0008',
  hm_p9:  'f0000000-0000-0000-0000-0000000f0009',
  hm_p10: 'f0000000-0000-0000-0000-0000000f000a',
  hm_p11: 'f0000000-0000-0000-0000-0000000f000b',
  hm_p12: 'f0000000-0000-0000-0000-0000000f000c',
  hm_p13: 'f0000000-0000-0000-0000-0000000f000d',
  hm_p14: 'f0000000-0000-0000-0000-0000000f000e',

  // Access card services (6)
  acs1: 'f1000000-0000-0000-0000-000000000001',
  acs2: 'f1000000-0000-0000-0000-000000000002',
  acs3: 'f1000000-0000-0000-0000-000000000003',
  acs4: 'f1000000-0000-0000-0000-000000000004',
  acs5: 'f1000000-0000-0000-0000-000000000005',
  acs6: 'f1000000-0000-0000-0000-000000000006',

  // Sync queue (3)
  sync1: '00000000-0000-0000-0000-0000000000f1',
  sync2: '00000000-0000-0000-0000-0000000000f2',
  sync3: '00000000-0000-0000-0000-0000000000f3',

  // Audit records (use a0000000-...-00000000b/c/f/d prefix)
  AUDIT_BEN_1:   'a0000000-0000-0000-0000-00000000b001',
  AUDIT_BEN_2:   'a0000000-0000-0000-0000-00000000b002',
  AUDIT_BEN_3:   'a0000000-0000-0000-0000-00000000b003',
  AUDIT_BEN_4:   'a0000000-0000-0000-0000-00000000b004',
  AUDIT_CASE_1:  'a0000000-0000-0000-0000-00000000c001',
  AUDIT_CASE_2:  'a0000000-0000-0000-0000-00000000c002',
  AUDIT_CASE_3:  'a0000000-0000-0000-0000-00000000c003',
  AUDIT_CASE_4:  'a0000000-0000-0000-0000-00000000c004',
  AUDIT_INT_1:   'a0000000-0000-0000-0000-00000000f001',
  AUDIT_INT_2:   'a0000000-0000-0000-0000-00000000f002',
  AUDIT_INT_3:   'a0000000-0000-0000-0000-00000000f003',
  AUDIT_INT_4:   'a0000000-0000-0000-0000-00000000f004',
  AUDIT_INT_5:   'a0000000-0000-0000-0000-00000000f005',
  AUDIT_INT_6:   'a0000000-0000-0000-0000-00000000f006',
  AUDIT_CONS_1:  'a0000000-0000-0000-0000-00000000d001',
  AUDIT_CONS_2:  'a0000000-0000-0000-0000-00000000d002',
  AUDIT_CONS_3:  'a0000000-0000-0000-0000-00000000d003',

  // Case intervention IDs
  ci1: 'a2000000-0000-0000-0000-000000000001',
  ci2: 'a2000000-0000-0000-0000-000000000002',
  ci3: 'a2000000-0000-0000-0000-000000000003',
  ci4: 'a2000000-0000-0000-0000-000000000004',
  ci5: 'a2000000-0000-0000-0000-000000000005',
  ci6: 'a2000000-0000-0000-0000-000000000006',
  ci7: 'a2000000-0000-0000-0000-000000000007',
  ci8: 'a2000000-0000-0000-0000-000000000008',
} as const;

async function seed() {
  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  // Disable RLS
  for (const tbl of ['beneficiaries', 'cases', 'consent_ledger', 'irf_cases']) {
    await q.query(`ALTER TABLE ${tbl} DISABLE ROW LEVEL SECURITY`);
  }

  // Truncate all tables in dependency order
  await q.query(`TRUNCATE TABLE
    access_card_services, case_interventions, case_tracker_log, case_history,
    program_assignment_steps, program_assignments, form_version_history,
    document_vault, csr_reports, audit_log,
    sync_queue, version_vectors, idempotency_keys,
    chat_messages, notifications, notification_preferences, otp_codes,
    consent_ledger, cases, household_memberships, households,
    irf_cases, beneficiary_claimants, persons, beneficiaries, programs, users
    CASCADE`);

  const adminPass = await bcrypt.hash('admin123', 12);
  const workerPass = await bcrypt.hash('worker123', 12);
  const coordPass = await bcrypt.hash('coordinator123', 12);
  const claimantPass = await bcrypt.hash('claimant123', 12);
  const mayorPass = await bcrypt.hash('mayor123', 12);
  const auditorPass = await bcrypt.hash('auditor123', 12);

  // ==========================================================================
  // 1. USERS (9)
  // ==========================================================================
  console.log('[1/30] Seeding users...');
  const users = [
    [ID.u_admin,        'admin@mswdo.test',       adminPass,   'admin',         'Rosario G. Mendoza',     '09171000001', null, null, true, false],
    [ID.u_worker_bigte, 'worker1@mswdo.test',     workerPass,  'social_worker', 'Juan Dela Cruz',         '09171000002', null, '{"Bigte","Partida","Poblacion","Friendship Village Resources (FVR)","Tigbe","Matictic"}', true, false],
    [ID.u_worker2,      'worker2@mswdo.test',     workerPass,  'social_worker', 'Lorna B. Santos',        '09171000003', null, '{"Matictic","San Mateo","Pinagtulayan","Minuyan","San Lorenzo","Baraka"}', true, false],
    [ID.u_coordinator,  'coordinator@mswdo.test',  coordPass,   'coordinator',   'Emmanuel T. Reyes',      '09171000004', null, '{"Bigte","Matictic","Partida","San Mateo","Pinagtulayan","Bitungol","Bangkal","Poblacion","Friendship Village Resources (FVR)","Tigbe","Minuyan","San Lorenzo","Baraka"}', true, false],
    [ID.u_claimant_a,   'pedro.claimant@test.com', claimantPass,'claimant',      'Pedro P. Reyes',         '09171000005', null, '{}', true, false],
    [ID.u_claimant_b,   'ana.claimant@test.com',   claimantPass,'claimant',      'Ana Marie L. Fernandez', '09171000006', null, '{}', true, false],
    [ID.u_mayor,        'mayor@mswdo.test',        mayorPass,   'mayor',         'Felicisimo I. Santiago', '09171000007', null, '{}', true, false],
    [ID.u_auditor,      'auditor@mswdo.test',      auditorPass, 'auditor',       'Teresita Q. Valdez',     '09171000008', null, '{}', true, false],
    [ID.u_mfa_admin,    'mfa-admin@mswdo.test',   adminPass,   'admin',         'MFA Admin',              null,           null, '{}', true, true],
  ];
  for (const u of users) {
    await q.query(
      `INSERT INTO users (id, email, password, role, full_name, phone, assigned_barangay, permitted_barangays, is_active, mfa_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$10)`,
      u,
    );
  }
  await q.query(
    `UPDATE users SET mfa_secret = 'JBSWY3DPEHPK3PXP' WHERE id = $1`,
    [ID.u_mfa_admin],
  );

  console.log('[1/30] Users seeded.');

  // ==========================================================================
  // 2. PERSONS (3 claimant persons + 21 beneficiary persons + 14 HH members)
  // ==========================================================================
  console.log('[2/30] Seeding persons...');
  const persons = [
    // [id, surname, first_name, middle_name, extension, gender, dob, address, phone,
    //  philsys_no, place_of_birth, civil_status, current_address::jsonb,
    //  philhealth_no, occupation, est_income, age, email]

    // Claimant persons (3)
    [ID.p_claimant_pedro, 'Reyes',  'Pedro',   'P.',  null,  'Male','1968-03-15', null,                   '09177123456', null, null, 'Married',  null,                              null,  null,         null,  null, 'pedro.reyes@example.com'],
    [ID.p_claimant_ana,   'Fernandez', 'Ana',   'M.',  null,  'Female','1975-08-22','Blk 2, Purok 3, San Mateo','09177890123',null, null, 'Widowed',  '{"street":"Blk 2","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3014"}', null, null, null, null, 'ana.fernandez@example.com'],
    [ID.p_claimant_liza,  'Miranda','Liza',     'C.',  null,  'Female','1982-11-02',null,                 '09177456789', null, null, 'Married',  null,                              null,  null,         null,  null, 'liza.miranda@example.com'],
    // Beneficiary persons (21)
    [ID.b_dela_cruz,  'Dela Cruz', 'Juan',  'M.',  null,  'Male','1965-01-10', '123 Poblacion, Bigte',   '09171234567', null, null, 'Married',  '{"street":"123 Poblacion","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'housemaid', null, 59, null],
    [ID.b_mendoza,    'Mendoza',   'Maria', 'L.',  null,  'Female','1978-06-15','456 Purok 3, Matictic', null,           null, null, 'Married',  '{"street":"456 Purok 3","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'vendor',   null, 46, null],
    [ID.b_santos_legacy,'Santos',  'Jose',  'R.',  null,  'Male','1970-09-20',  '789 Purok 5, Partida',  '09172345678', null, null, 'Married',  '{"street":"789 Purok 5","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'self-employed', null, 54, null],
    [ID.b_alcala,     'Alcala',   'Teresa','S.',  null,  'Female','1990-04-05','890 Purok 1, Poblacion', null,           null, null, 'Single',   '{"street":"890 Purok 1","barangay":"Poblacion","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'student',  null, 34, null],
    [ID.b_roxas,      'Roxas',    'Manuel','G.',  null,  'Male','1985-07-12',  '123 Purok 2, FVR',       '09173456789', null, null, 'Married',  '{"street":"123 Purok 2","barangay":"FVR","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'farmer',   null, 39, null],
    [ID.b_cruz,       'Cruz',     'Elena', 'D.',  null,  'Female','1992-10-30','456 Purok 3, Tigbe',     null,           null, null, 'Married',  '{"street":"456 Purok 3","barangay":"Tigbe","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'laundry woman', null, 32, null],
    [ID.b_santos,     'Santos',   'Pedro', 'Q.',  null,  'Male','1960-12-01',  '789 Purok 1, Bigte',     '09174567891', null, null, 'Widowed',  '{"street":"789 Purok 1","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'retired',  null, 64, null],
    [ID.b_garcia,     'Garcia',   'Luz',   'B.',  null,  'Female','1975-03-22','12 Purok 5, Matictic',   null,           null, null, 'Married',  '{"street":"12 Purok 5","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'flower vendor', null, 49, null],
    [ID.b_reyes,      'Reyes',    'Mario', 'T.',  null,  'Male','1988-08-18',  '34 Purok 2, Partida',    '09175678901', null, null, 'Single',   '{"street":"34 Purok 2","barangay":"Partida","city":"Norzagaray","province":"Bulacan","postalCode":"3013"}', null, 'masseur',  null, 36, null],
    [ID.b_ricardo,    'Ricardo',  'Ana',   'V.',  null,  'Female','1995-05-14','56 Purok 4, Poblacion',  null,           null, null, 'Single',   '{"street":"56 Purok 4","barangay":"Poblacion","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'sales clerk', null, 29, null],
    [ID.b_aquino,     'Aquino',   'Josefina','C.', null,  'Female','1982-02-28','78 Purok 1, San Mateo',  '09176789012', null, null, 'Widowed',  '{"street":"78 Purok 1","barangay":"San Mateo","city":"Norzagaray","province":"Bulacan","postalCode":"3014"}', null, 'housewife', null, 42, null],
    [ID.b_rivera,     'Rivera',   'Carlos','N.',  null,  'Male','1970-11-09',  '90 Purok 3, Pinagtulayan',null,          null, null, 'Married',  '{"street":"90 Purok 3","barangay":"Pinagtulayan","city":"Norzagaray","province":"Bulacan","postalCode":"3015"}', null, 'carpenter', null, 54, null],
    [ID.b_villanueva, 'Villanueva','Rosa', 'P.',  null,  'Female','1986-09-17','23 Purok 2, Minuyan',    '09177890123', null, null, 'Married',  '{"street":"23 Purok 2","barangay":"Minuyan","city":"Norzagaray","province":"Bulacan","postalCode":"3016"}', null, 'food vendor', null, 38, null],
    [ID.b_fernando,   'Fernando', 'Ramon', 'A.',  null,  'Male','1963-04-03',  '45 Purok 5, San Lorenzo',null,          null, null, 'Married',  '{"street":"45 Purok 5","barangay":"San Lorenzo","city":"Norzagaray","province":"Bulacan","postalCode":"3017"}', null, 'tricycle driver', null, 61, null],
    [ID.b_lopez,      'Lopez',    'Carmen','S.',  null,  'Female','1991-07-25','67 Purok 1, Baraka',     '09178901234', null, null, 'Single',   '{"street":"67 Purok 1","barangay":"Baraka","city":"Norzagaray","province":"Bulacan","postalCode":"3018"}', null, 'student',  null, 33, null],
    [ID.b_delacruz,   'Dela Cruz','Pablo', 'H.',  null,  'Male','1972-01-15',  '89 Purok 4, Bitungol',   null,           null, null, 'Married',  '{"street":"89 Purok 4","barangay":"Bitungol","city":"Norzagaray","province":"Bulacan","postalCode":"3019"}', null, 'bakery helper', null, 52, null],
    [ID.b_martinez,   'Martinez', 'Lorna', 'Y.',  null,  'Female','1980-06-30','12 Purok 3, Bangkal',    '09179012345', null, null, 'Married',  '{"street":"12 Purok 3","barangay":"Bangkal","city":"Norzagaray","province":"Bulacan","postalCode":"3020"}', null, 'janitor',  null, 44, null],
    [ID.b_flores,     'Flores',   'Dante', 'K.',  null,  'Male','1967-12-20',  '34 Purok 2, Tigbe',      null,           null, null, 'Widowed',  '{"street":"34 Purok 2","barangay":"Tigbe","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'retired',  null, 57, null],
    [ID.b_gonzales,   'Gonzales', 'Nida',  'W.',  null,  'Female','1993-08-08','56 Purok 1, FVR',        '09170123456', null, null, 'Married',  '{"street":"56 Purok 1","barangay":"FVR","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'online seller', null, 31, null],
    [ID.b_navarro,    'Navarro',  'Ben',   'J.',  null,  'Male','1976-05-11',  '78 Purok 5, Matictic',   null,           null, null, 'Married',  '{"street":"78 Purok 5","barangay":"Matictic","city":"Norzagaray","province":"Bulacan","postalCode":"3012"}', null, 'jeepney driver', null, 48, null],
    [ID.b_soriano,    'Soriano',  'Violeta','Z.', null,  'Female','1984-03-27','90 Purok 3, Bigte',      '09171234567', null, null, 'Married',  '{"street":"90 Purok 3","barangay":"Bigte","city":"Norzagaray","province":"Bulacan","postalCode":"3002"}', null, 'dressmaker', null, 40, null],
    // Household member persons (14)
    [ID.hm_p1,  'Reyes',  'Ana',     'P.', null,  'Female','1990-05-10', null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p2,  'Reyes',  'Carlos',  'J.', null,  'Male','2015-08-22',  null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p3,  'Reyes',  'Maria',   'L.', null,  'Female','2018-01-15',null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p4,  'Mendoza','Jose',    'R.', null,  'Male','1980-03-12',  null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p5,  'Mendoza','Elena',   'S.', null,  'Female','1982-07-25',null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p6,  'Mendoza','Jose Jr.','R.', null,  'Male','2005-11-30',  null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p7,  'Alcala', 'Ramon',   'T.', null,  'Male','1960-04-18',  null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p8,  'Alcala', 'Luz',     'B.', null,  'Female','1963-09-05',null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p9,  'Roxas',  'Isabel',  'G.', null,  'Female','1987-06-14',null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p10, 'Roxas',  'Luis',    'M.', null,  'Male','2010-02-20',  null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p11, 'Cruz',   'Miguel',  'D.', null,  'Male','1995-08-08',  null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p12, 'Santos', 'Elena',   'R.', null,  'Female','1985-12-12',null, null, null, null, 'Married',  null, null, null, null, null, null],
    [ID.hm_p13, 'Garcia', 'Jorge',   'T.', null,  'Male','1992-03-22',  null, null, null, null, 'Single',   null, null, null, null, null, null],
    [ID.hm_p14, 'Villanueva','Pilar','S.', null,  'Female','1978-10-30',null, null, null, null, 'Married',  null, null, null, null, null, null],
  ];
  for (const p of persons) {
    await q.query(
      `INSERT INTO persons (id, surname, first_name, middle_name, extension, gender, dob,
        address, phone, philsys_number, place_of_birth, civil_status, current_address,
        philhealth_number, occupation, estimated_monthly_income, age, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16::numeric,$17,$18)`,
      p,
    );
  }
  console.log('[2/30] Persons seeded.');

  // ==========================================================================
  // 3. BENEFICIARIES (21 — now slim: only beneficiary-specific columns)
  // ==========================================================================
  console.log('[3/30] Seeding beneficiaries...');
  const beneficiaries = [
    [ID.b_dela_cruz,   ID.b_dela_cruz,  'NORZ-AC-0001', ID.u_claimant_a,    'active', ID.hh_dela_cruz,  'Senior Citizen'],
    [ID.b_mendoza,     ID.b_mendoza,    'NORZ-AC-0002', null,               'active', ID.hh_mendoza,    'Family Head and Other Needy Adult'],
    [ID.b_santos_legacy,ID.b_santos_legacy,'NORZ-AC-0003', null,            'active', ID.hh_dela_cruz,  'Person with Disability'],
    [ID.b_alcala,      ID.b_alcala,     'NORZ-AC-0004', null,               'active', ID.hh_alcala,     'Children in Need of Special Protection'],
    [ID.b_roxas,       ID.b_roxas,      'NORZ-AC-0005', null,               'active', ID.hh_roxas,      'Senior Citizen'],
    [ID.b_cruz,        ID.b_cruz,       'NORZ-AC-0006', null,               'active', ID.hh_cruz,       'Family Head and Other Needy Adult'],
    [ID.b_santos,      ID.b_santos,     'NORZ-AC-0007', null,               'active', ID.hh_santos,     'Senior Citizen'],
    [ID.b_garcia,      ID.b_garcia,     'NORZ-AC-0008', null,               'active', ID.hh_garcia,     'Family Head and Other Needy Adult'],
    [ID.b_reyes,       ID.b_reyes,      'NORZ-AC-0009', null,               'active', ID.hh_reyes,      'Person with Disability'],
    [ID.b_ricardo,     ID.b_ricardo,    'NORZ-AC-0010', null,               'active', ID.hh_ricardo,    'Women in Especially Difficult Circumstances'],
    [ID.b_aquino,      ID.b_aquino,     'NORZ-AC-0011', null,               'active', ID.hh_aquino,     'Senior Citizen'],
    [ID.b_rivera,      ID.b_rivera,     'NORZ-AC-0012', null,               'active', ID.hh_rivera,     'Person with Disability'],
    [ID.b_villanueva,  ID.b_villanueva, 'NORZ-AC-0013', null,               'active', ID.hh_villanueva, 'Family Head and Other Needy Adult'],
    [ID.b_fernando,    ID.b_fernando,   'NORZ-AC-0014', null,               'active', ID.hh_fernando,   'Senior Citizen'],
    [ID.b_lopez,       ID.b_lopez,      'NORZ-AC-0015', null,               'active', ID.hh_lopez,      'Children in Need of Special Protection'],
    [ID.b_delacruz,    ID.b_delacruz,   'NORZ-AC-0016', null,               'active', ID.hh_delacruz2,  'Person with Disability'],
    [ID.b_martinez,    ID.b_martinez,   'NORZ-AC-0017', null,               'active', ID.hh_martinez2,  'Family Head and Other Needy Adult'],
    [ID.b_flores,      ID.b_flores,     'NORZ-AC-0018', null,               'active', ID.hh_flores2,    'Senior Citizen'],
    [ID.b_gonzales,    ID.b_gonzales,   'NORZ-AC-0019', null,               'active', ID.hh_gonzales2,  'Women in Especially Difficult Circumstances'],
    [ID.b_navarro,     ID.b_navarro,    'NORZ-AC-0020', null,               'active', ID.hh_navarro2,   'Senior Citizen'],
    [ID.b_soriano,     ID.b_soriano,    'NORZ-AC-0021', null,               'active', ID.hh_soriano2,   'Family Head and Other Needy Adult'],
  ];
  for (const b of beneficiaries) {
    await q.query(
      `INSERT INTO beneficiaries (id, person_id, access_card_code, user_id, consent_status, household_id, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      b,
    );
  }
  console.log('[3/30] Beneficiaries seeded.');

  // ==========================================================================
  // 4. BENEFICIARY CLAIMANTS
  // ==========================================================================
  console.log('[4/30] Seeding beneficiary_claimants...');
  const beneficiaryClaimants = [
    // Self-claimants (beneficiary is their own claimant)
    [ID.b_dela_cruz,  ID.b_dela_cruz,  'Self'],
    [ID.b_santos,     ID.b_santos,     'Self'],
    [ID.b_reyes,      ID.b_reyes,      'Self'],
    [ID.b_fernando,   ID.b_fernando,   'Self'],
    [ID.b_aquino,     ID.b_aquino,     'Self'],
    [ID.b_flores,     ID.b_flores,     'Self'],
    [ID.b_navarro,    ID.b_navarro,    'Self'],
    // Spouse claimants
    [ID.b_mendoza,    ID.hm_p4,        'Spouse'],
    [ID.b_roxas,      ID.hm_p9,        'Spouse'],
    [ID.b_garcia,     ID.hm_p13,       'Spouse'],
    [ID.b_villanueva, ID.hm_p14,       'Spouse'],
    [ID.b_gonzales,   ID.hm_p11,       'Spouse'],
    [ID.b_soriano,    ID.hm_p12,       'Spouse'],
    // Parent/Guardian claimants (for children or elderly)
    [ID.b_alcala,     ID.hm_p7,        'Parent'],
    [ID.b_lopez,      ID.hm_p8,        'Guardian'],
    [ID.b_santos_legacy, ID.hm_p1,     'Child'],
    [ID.b_cruz,       ID.hm_p2,        'Sibling'],
    [ID.b_ricardo,    ID.hm_p3,        'Parent'],
    [ID.b_delacruz,   ID.hm_p5,        'Spouse'],
    [ID.b_martinez,   ID.hm_p6,        'Child'],
    // Rivera (self-claimant)
    [ID.b_rivera,     ID.b_rivera,     'Self'],
  ];
  for (const bc of beneficiaryClaimants) {
    await q.query(
      `INSERT INTO beneficiary_claimants (beneficiary_id, claimant_id, relationship)
       VALUES ($1,$2,$3)`,
      bc,
    );
  }
  console.log('[4/30] Beneficiary claimants seeded.');

  // ==========================================================================
  // 5. HOUSEHOLDS (20)
  // ==========================================================================
  console.log('[5/30] Seeding households...');
  const households = [
    [ID.hh_dela_cruz,  'Bigte'],
    [ID.hh_mendoza,    'Matictic'],
    [ID.hh_alcala,     'Poblacion'],
    [ID.hh_roxas,      'FVR'],
    [ID.hh_cruz,       'Tigbe'],
    [ID.hh_santos,     'Bigte'],
    [ID.hh_garcia,     'Matictic'],
    [ID.hh_reyes,      'Partida'],
    [ID.hh_ricardo,    'Poblacion'],
    [ID.hh_aquino,     'San Mateo'],
    [ID.hh_rivera,     'Pinagtulayan'],
    [ID.hh_villanueva, 'Minuyan'],
    [ID.hh_fernando,   'San Lorenzo'],
    [ID.hh_lopez,      'Baraka'],
    [ID.hh_delacruz2,  'Bitungol'],
    [ID.hh_martinez2,  'Bangkal'],
    [ID.hh_flores2,    'Tigbe'],
    [ID.hh_gonzales2,  'FVR'],
    [ID.hh_navarro2,   'Matictic'],
    [ID.hh_soriano2,   'Bigte'],
  ];
  for (const h of households) {
    await q.query(
      `INSERT INTO households (id, barangay)
       VALUES ($1,$2)`,
      h,
    );
  }
  console.log('[5/30] Households seeded.');

  // ==========================================================================
  // 6. HOUSEHOLD MEMBERSHIPS (21 — link each beneficiary to a household)
  // ==========================================================================
  console.log('[6/30] Seeding household_memberships...');
  const hhMemberships = [
    [ID.b_dela_cruz,  ID.hh_dela_cruz,  'Head', true,  'Employed'],
    [ID.b_mendoza,    ID.hh_mendoza,    'Head', true,  'Self-Employed'],
    [ID.b_santos_legacy,ID.hh_dela_cruz,'Member',false, 'Student'],
    [ID.b_alcala,     ID.hh_alcala,     'Head', true,  'Self-Employed'],
    [ID.b_roxas,      ID.hh_roxas,      'Head', true,  'Employed'],
    [ID.b_cruz,       ID.hh_cruz,       'Head', true,  'Unemployed'],
    [ID.b_santos,     ID.hh_santos,     'Head', true,  'Retired'],
    [ID.b_garcia,     ID.hh_garcia,     'Head', true,  'Self-Employed'],
    [ID.b_reyes,      ID.hh_reyes,      'Head', true,  'Self-Employed'],
    [ID.b_ricardo,    ID.hh_ricardo,    'Head', true,  'Employed'],
    [ID.b_aquino,     ID.hh_aquino,     'Head', true,  'Self-Employed'],
    [ID.b_rivera,     ID.hh_rivera,     'Head', true,  'Employed'],
    [ID.b_villanueva, ID.hh_villanueva, 'Head', true,  'Self-Employed'],
    [ID.b_fernando,   ID.hh_fernando,   'Head', true,  'Self-Employed'],
    [ID.b_lopez,      ID.hh_lopez,      'Head', true,  'Self-Employed'],
    [ID.b_delacruz,   ID.hh_delacruz2,  'Head', true,  'Unemployed'],
    [ID.b_martinez,   ID.hh_martinez2,  'Head', true,  'Self-Employed'],
    [ID.b_flores,     ID.hh_flores2,    'Head', true,  'Self-Employed'],
    [ID.b_gonzales,   ID.hh_gonzales2,  'Head', true,  'Employed'],
    [ID.b_navarro,    ID.hh_navarro2,   'Head', true,  'Self-Employed'],
    [ID.b_soriano,    ID.hh_soriano2,   'Head', true,  'Self-Employed'],
  ];
  for (const hm of hhMemberships) {
    await q.query(
      `INSERT INTO household_memberships (person_id, household_id, relationship, is_primary, status)
       VALUES ($1,$2,$3,$4,$5)`,
      hm,
    );
  }
  console.log('[6/30] Household memberships seeded.');

  // ==========================================================================
  // 7. CASES (10 — all use SERVICE_TYPES values)
  // ==========================================================================
  console.log('[7/29] Seeding cases...');
  const cases = [
    [ID.c_dela_cruz, 'NORZ-2024-0001', ID.b_dela_cruz,  ['Financial Aid'],               '[]', 'pending_assessment', null, null, ID.u_worker_bigte, '2024-06-15'],
    [ID.c_mendoza,   'NORZ-2024-0002', ID.b_mendoza,    ['Financial Aid'],               '[]', 'in_review',         null, null, ID.u_worker_bigte, '2024-06-20'],
    [ID.c_1,         'NORZ-2024-0003', ID.b_santos_legacy,['PWD Referral'],               '[]', 'in_review',         null, null, ID.u_worker2,      '2024-07-01'],
    [ID.c_2,         'NORZ-2024-0004', ID.b_alcala,     ['Educational Assistance'],       '[]', 'approved',          null, null, ID.u_worker_bigte, '2024-07-10'],
    [ID.c_3,         'NORZ-2024-0005', ID.b_roxas,      ['Medical Assistance'],           '[]', 'in_review',         null, null, ID.u_worker_bigte, '2024-07-15'],
    [ID.c_4,         'NORZ-2024-0006', ID.b_cruz,       ['Food Assistance'],              '[]', 'in_review',         null, null, ID.u_worker2,      '2024-08-01'],
    [ID.c_5,         'NORZ-2024-0007', ID.b_santos,     ['Medical Assistance'],           '[]', 'pending_assessment', null, null, ID.u_worker_bigte, '2024-08-05'],
    [ID.c_6,         'NORZ-2024-0008', ID.b_garcia,     ['Financial Aid'],               '[]', 'in_review',         null, null, ID.u_worker2,      '2024-08-10'],
    [ID.c_7,         'NORZ-2024-0009', ID.b_reyes,      ['PWD Referral'],                '[]', 'approved',          null, null, ID.u_worker_bigte, '2024-08-15'],
    [ID.c_8,         'NORZ-2024-0010', ID.b_lopez,      ['Educational Assistance'],       '[]', 'in_review',         null, null, ID.u_worker2,      '2024-09-20'],
  ];
  for (const c of cases) {
    await q.query(
      `INSERT INTO cases (id, control_no, beneficiary_id, service_requested, requirements_checklist, status, approved_by_signature, approved_by_role, assigned_worker_id, created_at)
       VALUES ($1,$2,$3,$4::text[],$5::jsonb,$6,$7,$8,$9,$10::date)`,
      c,
    );
  }
  console.log('[7/29] Cases seeded.');

  // ==========================================================================
  // 9. CASE HISTORY (25)
  // ==========================================================================
  console.log('[8/29] Seeding case_history...');
  const caseHistories = [
    [ID.ch1,  ID.c_dela_cruz, null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'Case opened for senior assistance',                '2024-06-15'],
    [ID.ch2,  ID.c_dela_cruz, 'pending_assessment',  'in_review',          'social_worker',  ID.u_worker_bigte, 'Home visit conducted, assessed daily living needs','2024-06-22'],
    [ID.ch3,  ID.c_dela_cruz, 'in_review',           'approved',           'social_worker',  ID.u_worker_bigte, 'Provided grocery assistance',                     '2024-07-01'],
    [ID.ch4,  ID.c_mendoza,   null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'Solo parent case opened for livelihood support',   '2024-06-20'],
    [ID.ch5,  ID.c_mendoza,   'pending_assessment',  'in_review',          'social_worker',  ID.u_worker2,      'Income and family needs assessed',                 '2024-06-28'],
    [ID.ch6,  ID.c_mendoza,   'in_review',           'approved',           'social_worker',  ID.u_worker_bigte, 'Enrolled in livelihood program',                   '2024-07-10'],
    [ID.ch7,  ID.c_1,         null,                  'pending_assessment', 'social_worker',  ID.u_worker2,      'PWD case opened',                                  '2024-07-01'],
    [ID.ch8,  ID.c_1,         'pending_assessment',  'in_review',          'social_worker',  ID.u_worker_bigte, 'Mobility assessment completed',                    '2024-07-08'],
    [ID.ch9,  ID.c_2,         null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'Educational assistance case for orphan',            '2024-07-10'],
    [ID.ch10, ID.c_2,         'pending_assessment',  'approved',           'social_worker',  ID.u_worker_bigte, 'Tuition assistance released',                      '2024-07-25'],
    [ID.ch11, ID.c_2,         'approved',            'disbursed',          'social_worker',  ID.u_worker_bigte, 'Checked academic performance — satisfactory',       '2024-08-30'],
    [ID.ch12, ID.c_3,         null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'Senior farmer needs medical + pension assistance',  '2024-07-15'],
    [ID.ch13, ID.c_3,         'pending_assessment',  'in_review',          'social_worker',  ID.u_worker2,      'Medical assessment: hypertension, arthritis',       '2024-07-22'],
    [ID.ch14, ID.c_3,         'in_review',           'approved',           'social_worker',  ID.u_worker_bigte, 'Provided medical assistance and vitamins',          '2024-07-30'],
    [ID.ch15, ID.c_4,         null,                  'pending_assessment', 'social_worker',  ID.u_worker2,      'Emergency intake for pregnant solo parent',         '2024-08-01'],
    [ID.ch16, ID.c_4,         'pending_assessment',  'approved',           'coordinator',    ID.u_coordinator,  'Emergency food assistance provided',                '2024-08-03'],
    [ID.ch17, ID.c_5,         null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'Senior with disability needs maintenance meds',     '2024-08-05'],
    [ID.ch18, ID.c_6,         null,                  'pending_assessment', 'social_worker',  ID.u_worker2,      'Solo parent vendor needs capital',                  '2024-08-10'],
    [ID.ch19, ID.c_6,         'pending_assessment',  'approved',           'social_worker',  ID.u_worker_bigte, 'Provided P10,000 livelihood capital',               '2024-08-20'],
    [ID.ch20, ID.c_7,         null,                  'pending_assessment', 'social_worker',  ID.u_worker_bigte, 'PWD employment support opened',                     '2024-08-15'],
    [ID.ch21, ID.c_7,         'pending_assessment',  'approved',           'social_worker',  ID.u_worker2,      'Skills training enrollment processed',              '2024-09-01'],
    [ID.ch22, ID.c_8,         null,                  'pending_assessment', 'social_worker',  ID.u_worker2,      'Orphan education scholarship maintenance',           '2024-09-20'],
    [ID.ch23, ID.c_8,         'pending_assessment',  'in_review',          'social_worker',  ID.u_worker_bigte, 'School records reviewed, grades satisfactory',      '2024-09-28'],
    [ID.ch24, ID.c_8,         'in_review',           'approved',           'social_worker',  ID.u_worker2,      'Scholarship stipend released',                      '2024-10-05'],
    [ID.ch25, ID.c_1,         'approved',            'disbursed',          'social_worker',  ID.u_worker_bigte, 'PWD assistive device delivered — needs fitting',    '2024-10-01'],
  ];
  for (const ch of caseHistories) {
    await q.query(
      `INSERT INTO case_history (id, case_id, from_status, to_status, changed_by_role, changed_by_id, remarks, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date)`,
      ch,
    );
  }
  console.log('[8/29] Case history seeded.');

  // ==========================================================================
  // 10. PROGRAMS (6)
  // ==========================================================================
  console.log('[11/29] Seeding programs...');
  const programs = [
    [ID.prog_akap,      'AKAP (Ayuda para sa Kapos ang Kita Program)',  'Financial Assistance', 7, '["Medical Certificate","Barangay Indigency","Valid ID"]', '{DSWD,PDAF,LGU}',          '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":2,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":3,"order":1},{"stepName":"Mayor Approval","approverRole":"mayor","slaDays":2,"order":2},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":3,"order":3}]', '{"type":"object","title":"AKAP Application v1","properties":{"amount":{"type":"number"},"purpose":{"type":"string"}},"required":["amount","purpose"]}', true, 'RA 11310'],
    [ID.prog_medical,   'Medical Assistance Program',                   'Health',               3, '["Medical Certificate","Prescription","Barangay Indigency","Valid ID"]', '{DSWD,LGU}',           '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":2,"order":1},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":2,"order":2}]', '{"type":"object","title":"Medical Assistance v1","properties":{"hospital":{"type":"string"},"diagnosis":{"type":"string"},"amount":{"type":"number"}},"required":["hospital"]}', true, 'RA 11223'],
    [ID.prog_burial,    'Burial Assistance Program',                    'Crisis Intervention',   1, '["Death Certificate","Barangay Indigency","Funeral Contract","Valid ID"]', '{DSWD,LGU}',            '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":1,"order":1},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":1,"order":2}]', '{"type":"object","title":"Burial Assistance v1","properties":{"deceased_name":{"type":"string"},"amount":{"type":"number"}},"required":["deceased_name","amount"]}', true, 'LGU Ordinance 2023-05'],
    [ID.prog_education, 'Educational Assistance Program',               'Education',            5, '["Registration Form","Report Card","Barangay Indigency","School ID"]', '{DSWD,PDAF,LGU}',           '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":2,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":3,"order":1},{"stepName":"Mayor Approval","approverRole":"mayor","slaDays":2,"order":2},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":3,"order":3}]', '{"type":"object","title":"Educational Assistance v1","properties":{"school":{"type":"string"},"grade":{"type":"string"},"amount":{"type":"number"}},"required":["school"]}', true, 'RA 10931'],
    [ID.prog_food,      'Food Assistance Program',                      'Basic Needs',          3, '["Barangay Indigency","Valid ID"]', '{DSWD}',              '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Head Approval","approverRole":"coordinator","slaDays":2,"order":1}]', '{"type":"object","title":"Food Assistance v1","properties":{"household_size":{"type":"number"},"reason":{"type":"string"}},"required":["household_size","reason"]}', true, 'RA 11310'],
    [ID.prog_transpo,   'Transportation Assistance Program',            'Basic Needs',          1, '["Barangay Indigency","Valid ID"]', '{DSWD,LGU}',           '[{"stepName":"SW Assessment","approverRole":"social_worker","slaDays":1,"order":0},{"stepName":"Disbursement","approverRole":"coordinator","slaDays":1,"order":1}]', '{"type":"object","title":"Transportation Assistance v1","properties":{"destination":{"type":"string"},"purpose":{"type":"string"},"amount":{"type":"number"}},"required":["destination","purpose","amount"]}', true, 'MSWDO Internal Policy 2024-001'],
  ];
  for (const p of programs) {
    await q.query(
      `INSERT INTO programs (id, name, category, waiting_period_days, required_documents, fund_sources, approval_workflow, form_template, is_active, legal_basis)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::text[],$7::jsonb,$8::jsonb,$9,$10)`,
      p,
    );
  }
  console.log('[11/29] Programs seeded.');

  // ==========================================================================
  // 11. PROGRAM ASSIGNMENTS (6)
  // ==========================================================================
  console.log('[10/27] Seeding program_assignments...');
  const programAssignments = [
    [ID.pa1, ID.c_dela_cruz, ID.prog_akap,      'approved', 4, ID.u_worker_bigte],
    [ID.pa2, ID.c_mendoza,   ID.prog_medical,   'approved', 3, ID.u_worker_bigte],
    [ID.pa3, ID.c_1,         ID.prog_food,      'approved', 2, ID.u_worker2],
    [ID.pa4, ID.c_2,         ID.prog_education, 'approved', 4, ID.u_worker_bigte],
    [ID.pa5, ID.c_3,         ID.prog_akap,      'pending',  0, ID.u_worker_bigte],
    [ID.pa6, ID.c_4,         ID.prog_food,      'pending',  0, ID.u_worker2],
  ];
  for (const pa of programAssignments) {
    await q.query(
      `INSERT INTO program_assignments (id, case_id, program_id, status, current_step_order, assigned_worker_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      pa,
    );
  }
  console.log('[10/27] Program assignments seeded.');

  // ==========================================================================
  // 12. PROGRAM ASSIGNMENT STEPS (18 — 3 per assignment)
  // ==========================================================================
  console.log('[11/27] Seeding program_assignment_steps...');
  const programSteps = [
    // PA1 → AKAP for Dela Cruz
    [ID.pas1,  ID.pa1, 0, 'Needs Assessment',  'social_worker',  'approved', ID.u_worker_bigte, '2024-07-02', null],
    [ID.pas2,  ID.pa1, 1, 'Documentation',     'social_worker',  'approved', ID.u_worker_bigte, '2024-07-05', null],
    [ID.pas3,  ID.pa1, 2, 'Payout Processing', 'coordinator',    'approved', ID.u_coordinator,  '2024-07-08', 'Payout completed via remittance'],
    // PA2 → Medical for Mendoza
    [ID.pas4,  ID.pa2, 0, 'Medical Assessment','social_worker',  'approved', ID.u_worker_bigte, '2024-07-16', null],
    [ID.pas5,  ID.pa2, 1, 'Budget Approval',   'coordinator',    'approved', ID.u_coordinator,  '2024-07-20', null],
    [ID.pas6,  ID.pa2, 2, 'Disbursement',      'coordinator',    'approved', ID.u_coordinator,  '2024-07-25', 'Medical assistance released to hospital'],
    // PA3 → Food for Santos
    [ID.pas7,  ID.pa3, 0, 'Food Pack Assessment','social_worker','approved', ID.u_worker2,      '2024-08-02', null],
    [ID.pas8,  ID.pa3, 1, 'Distribution',      'social_worker',  'approved', ID.u_worker2,      '2024-08-05', 'Food pack delivered to residence'],
    [ID.pas9,  ID.pa3, 2, 'Follow-up',         'social_worker',  'pending',  ID.u_worker2,      null,          'Scheduled follow-up in 2 weeks'],
    // PA4 → Education for Alcala
    [ID.pas10, ID.pa4, 0, 'School Verification','social_worker', 'approved', ID.u_worker_bigte, '2024-08-12', null],
    [ID.pas11, ID.pa4, 1, 'Tuition Payment',   'social_worker',  'approved', ID.u_worker_bigte, '2024-08-20', 'Direct payment to school'],
    [ID.pas12, ID.pa4, 2, 'Grade Monitoring',  'social_worker',  'pending',  ID.u_worker_bigte, null,          'End-of-semester grade check pending'],
    // PA5 → AKAP for Roxas (Pending)
    [ID.pas13, ID.pa5, 0, 'Intake Review',     'social_worker',  'approved', ID.u_worker_bigte, '2024-08-16', null],
    [ID.pas14, ID.pa5, 1, 'Validation',        'coordinator',    'pending',  ID.u_coordinator,  null,          'Awaiting income validation'],
    [ID.pas15, ID.pa5, 2, 'Approval',          'mayor',          'pending',  null,               null,          'Pending coordinator approval'],
    // PA6 → Food for Cruz (Draft)
    [ID.pas16, ID.pa6, 0, 'Initial Assessment', 'social_worker', 'pending',  ID.u_worker2,      null,          'Initial assessment not started'],
    [ID.pas17, ID.pa6, 1, 'Documentation',     'social_worker',  'pending',  null,               null,          null],
    [ID.pas18, ID.pa6, 2, 'Distribution',      'social_worker',  'pending',  null,               null,          null],
  ];
  for (const ps of programSteps) {
    await q.query(
      `INSERT INTO program_assignment_steps (id, assignment_id, step_order, step_name, approver_role, status, approved_by, approved_at, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9)`,
      ps,
    );
  }
  console.log('[11/27] Program assignment steps seeded.');

  // ==========================================================================
  // 13. IRF CASES (4)
  // ==========================================================================
  console.log('[12/27] Seeding irf_cases...');
  const irfCases = [
    [ID.irf1, 'BLOTTER-2024-001', 'Abuse',
     '2024-06-20 09:00:00', '2024-06-19 18:00:00',
     '{"name":"Juan Dela Cruz","address":"Purok 2, Bigte","phone":"09171234567"}',
     '{"name":"Unknown","address":"Purok 5, Bigte","relationship":"Neighbor"}',
     null, 'Under Investigation', '/sig/irf/msdw/20240620.png', '/sig/irf/reporting/20240620.png'],
    [ID.irf2, 'BLOTTER-2024-002', 'Neglect',
     '2024-06-25 14:00:00', '2024-06-24 10:00:00',
     '{"name":"Barangay Kagawad","address":"Barangay Hall, Matictic","phone":"09172345678"}',
     '{"name":"Lolita G. Reyes","address":"Purok 1, Matictic","relationship":"Guardian"}',
     null, 'Under Investigation', '/sig/irf/msdw/20240625.png', null],
    [ID.irf3, 'BLOTTER-2024-003', 'Exploitation',
     '2024-08-03 11:00:00', '2024-08-02 06:00:00',
     '{"name":"Anonymous","address":"N/A","phone":"N/A"}',
     '{"name":"Unknown employer","address":"Quarry site","relationship":"Employer"}',
     null, 'Referred to PNP', '/sig/irf/msdw/20240803.png', null],
    [ID.irf4, 'BLOTTER-2024-004', 'Criminal',
     '2024-10-01 16:00:00', '2024-09-30 22:00:00',
     '{"name":"Elena M. Torres","address":"Purok 4, Bangkal","phone":"09173456789"}',
     '{"name":"Rogelio P. Cruz","address":"Purok 4, Bangkal","relationship":"Ex-partner"}',
     null, 'Closed', '/sig/irf/msdw/20241001.png', '/sig/irf/reporting/20241001.png'],
  ];
  for (const irf of irfCases) {
    await q.query(
      `INSERT INTO irf_cases (id, blotter_entry_number, case_category, datetime_reported, datetime_incident, item_a_reporting_person, item_b_person_reported, encrypted_narration, case_disposition, msdw_signature_url, reporting_signature_url)
       VALUES ($1,$2,$3,$4::timestamp,$5::timestamp,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
      irf,
    );
  }
  console.log('[12/27] IRF cases seeded.');

  // ==========================================================================
  // 14. CONSENT LEDGER (15)
  // ==========================================================================
  console.log('[13/27] Seeding consent_ledger...');
  const consentLedger = [
    [ID.cl1,  ID.b_dela_cruz,  'Data Privacy & Case Processing',  'in_person', 'active', '2024-06-15', null, null],
    [ID.cl2,  ID.b_dela_cruz,  'Photo & Media Consent',           'in_person', 'active', '2024-06-15', null, null],
    [ID.cl3,  ID.b_mendoza,    'Data Privacy & Case Processing',  'in_person', 'active', '2024-06-20', null, null],
    [ID.cl4,  ID.b_mendoza,    'Photo & Media Consent',           'in_person', 'active', '2024-06-20', null, null],
    [ID.cl5,  ID.b_santos_legacy,'Data Privacy & Case Processing','in_person', 'active', '2024-07-01', null, null],
    [ID.cl6,  ID.b_santos_legacy,'Photo & Media Consent',         'in_person', 'active', '2024-07-01', null, null],
    [ID.cl7,  ID.b_alcala,     'Data Privacy & Case Processing',  'in_person', 'active', '2024-07-10', null, null],
    [ID.cl8,  ID.b_roxas,      'Data Privacy & Case Processing',  'in_person', 'active', '2024-07-15', null, null],
    [ID.cl9,  ID.b_cruz,       'Data Privacy & Case Processing',  'in_person', 'active', '2024-08-01', null, null],
    [ID.cl10, ID.b_cruz,       'Photo & Media Consent',           'in_person', 'active', '2024-08-01', null, null],
    [ID.cl11, ID.b_garcia,     'Data Privacy & Case Processing',  'in_person', 'active', '2024-08-10', null, null],
    [ID.cl12, ID.b_reyes,      'Data Privacy & Case Processing',  'in_person', 'active', '2024-08-15', null, null],
    [ID.cl13, ID.b_villanueva, 'Data Privacy & Case Processing',  'in_person', 'active', '2024-09-10', null, null],
    [ID.cl14, ID.b_lopez,      'Data Privacy & Case Processing',  'in_person', 'active', '2024-09-20', null, null],
    [ID.cl15, ID.b_martinez,   'Data Privacy & Case Processing',  'online',    'active', '2024-10-05', null, null],
  ];
  for (const cl of consentLedger) {
    await q.query(
      `INSERT INTO consent_ledger (id, beneficiary_id, purpose, channel, status, granted_at, revoked_at, revoked_reason)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8)`,
      cl,
    );
  }
  console.log('[13/27] Consent ledger seeded.');

  // ==========================================================================
  // 15. NOTIFICATIONS (10)
  // ==========================================================================
  console.log('[14/27] Seeding notifications...');
  const notifications = [
    [ID.not1,  ID.u_claimant_a,  'Application Approved',         'Your application has been approved',             'in_app', true,  '2024-06-20', false, 'application_status', null,  null],
    [ID.not2,  ID.u_claimant_a,  'Interview Scheduled',          'Interview scheduled on June 25, 2024',           'in_app', true,  '2024-06-21', false, 'interview',         null,  null],
    [ID.not3,  ID.u_claimant_b,  'Documents Required',           'Document requirements needed for processing',    'sms',    true,  '2024-07-01', false, 'application_status', null,  null],
    [ID.not4,  ID.u_claimant_b,  'Program Enrollment',           'Enrolled in AKAP Program',                       'in_app', true,  '2024-07-15', false, 'program_update',    null,  null],
    [ID.not5,  ID.u_worker_bigte,'New Case Assigned',            'New case assigned: Cruz Family Emergency',        'in_app', true,  '2024-08-01', false, 'case_assignment',   null,  null],
    [ID.not6,  ID.u_worker_bigte,'Case Follow-up Required',      'Case update: Dela Cruz case requires follow-up', 'in_app', true,  '2024-08-10', false, 'case_update',       null,  null],
    [ID.not7,  ID.u_coordinator, 'Approval Request',             'Pending approval: AKAP for Roxas',               'in_app', true,  '2024-08-15', false, 'approval_request',  ID.c_3, null],
    [ID.not8,  ID.u_worker2,     'New Case Assigned',            'New case: Educational Support for Lopez',         'in_app', true,  '2024-09-20', false, 'case_assignment',   null,  null],
    [ID.not9,  ID.u_claimant_a,  'Follow-up Scheduled',          'Follow-up visit scheduled for October 5',         'sms',    true,  '2024-09-28', false, 'follow_up',         null,  null],
    [ID.not10, ID.u_mayor,       'CSR Report Ready',             'Monthly CSR report for September is ready',       'in_app', true,  '2024-10-01', false, 'report_ready',      null,  null],
  ];
  for (const n of notifications) {
    await q.query(
      `INSERT INTO notifications (id, recipient_id, title, message, channel, sent, sent_at, is_read, category, reference_id, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11)`,
      n,
    );
  }
  console.log('[14/27] Notifications seeded.');

  // ==========================================================================
  // 16. NOTIFICATION PREFERENCES (6)
  // ==========================================================================
  console.log('[15/27] Seeding notification_preferences...');
  const notifPrefs = [
    [ID.np_w1_ia, ID.u_worker_bigte, 'in_app', 'case_update', true],
    [ID.np_w1_sm, ID.u_worker_bigte, 'sms',    'case_update', true],
    [ID.np_w2_ia, ID.u_worker2,      'in_app', 'case_update', true],
    [ID.np_w2_sm, ID.u_worker2,      'sms',    'case_update', false],
    [ID.np_c_ia,  ID.u_coordinator,  'in_app', 'approval',    true],
    [ID.np_c_sm,  ID.u_coordinator,  'sms',    'approval',    true],
  ];
  for (const np of notifPrefs) {
    await q.query(
      `INSERT INTO notification_preferences (id, user_id, channel, category, opted_in)
       VALUES ($1,$2,$3,$4,$5)`,
      np,
    );
  }
  console.log('[15/27] Notification preferences seeded.');

  // ==========================================================================
  // 17. CSR REPORTS (3)
  // ==========================================================================
  console.log('[16/27] Seeding csr_reports...');
  const csrReports = [
    [ID.csr1, ID.c_dela_cruz, 'CSR-2024-001', 'Rosario G. Mendoza', 'Social Worker II',  'MSWDO Bigte',
     'Elderly client with mobility issues requiring financial aid for medical treatment.',
     'Mr. Dela Cruz is a 59-year-old senior requiring ongoing medication and physical therapy.',
     'Resides in Bigte with spouse and two children. Combined monthly income approximately PHP 8,000.',
     'Semi-concrete dwelling with electricity. Children enrolled in public school.',
     'Client eligible for AKAP financial assistance based on income threshold and medical necessity.',
     'Approve AKAP assistance of PHP 5,000 for medical treatment.',
     '1. Disburse PHP 5,000. 2. Schedule follow-up home visit within 30 days.',
     true, 'Rosario G. Mendoza'],
    [ID.csr2, ID.c_5, 'CSR-2024-002', 'Lorna B. Santos', 'Social Worker I',  'Barangay Captain Bigte',
     'Senior citizen with disability requiring maintenance medicines and pension processing assistance.',
     'Mr. Santos is a 64-year-old widowed senior with hypertension and arthritis.',
     'Lives alone in a wooden dwelling in Bigte. Monthly pension of PHP 3,500 is sole income.',
     'No running water. Dependent on neighbors for daily assistance.',
     'Medical and transportation assistance warranted based on assessment.',
     'Approve PHP 3,500 medical assistance and PHP 2,000 transportation aid.',
     '1. Disburse PHP 5,500 total. 2. Coordinate with OSCA for pension processing.',
     true, 'Lorna B. Santos'],
    [ID.csr3, ID.c_2, 'CSR-2024-003', 'Rosario G. Mendoza', 'Social Worker II', 'MSWDO Poblacion',
     'Orphaned college student needing tuition support for ongoing semester.',
     'Ms. Alcala is a 34-year-old orphaned student enrolled in college, working part-time.',
     'Living with relatives in Poblacion. Self-supporting through part-time work as student assistant.',
     'Rental room near school. Income approximately PHP 4,000/month from part-time work.',
     'Student demonstrates strong academic performance. Educational assistance justified.',
     'Approve PHP 20,000 tuition assistance for current semester.',
     '1. Disburse PHP 20,000 directly to school. 2. Monitor academic performance.',
     false, 'Rosario G. Mendoza'],
  ];
  for (const csr of csrReports) {
    await q.query(
      `INSERT INTO csr_reports (id, case_id, control_no, social_worker_name, social_worker_position, referral_origin, reason_for_referral, problem_presented, family_background, socio_economic_profile, assessment_analysis, recommendation, intervention_plan, finalized, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      csr,
    );
  }
  console.log('[16/27] CSR reports seeded.');

  // ==========================================================================
  // 18. DOCUMENT VAULT (5)
  // ==========================================================================
  console.log('[17/27] Seeding document_vault...');
  const documents = [
    [ID.doc1, '/vault/senior_id.pdf',  'Senior Citizen ID',         'application/pdf', 245760, ID.c_dela_cruz, ID.b_dela_cruz,  'ID Document', 'Senior Citizen ID card scan',     ID.u_worker_bigte],
    [ID.doc2, '/vault/solo_parent.pdf','Solo Parent ID',            'application/pdf', 180224, ID.c_mendoza,   ID.b_mendoza,    'ID Document', 'Solo Parent ID card scan',        ID.u_worker_bigte],
    [ID.doc3, '/vault/pwd_id.pdf',     'PWD ID',                    'application/pdf', 156672, ID.c_1,         ID.b_santos_legacy,'ID Document', 'PWD ID card scan',               ID.u_worker2],
    [ID.doc4, '/vault/med_cert.pdf',   'Medical Certificate',       'application/pdf', 204800, ID.c_4,         ID.b_cruz,       'Medical',      'Medical certificate from RHU',     ID.u_worker2],
    [ID.doc5, '/vault/enrollment.pdf', 'Certificate of Enrollment', 'application/pdf', 102400, ID.c_8,         ID.b_lopez,      'Academic',     'School enrollment certificate',    ID.u_worker2],
  ];
  for (const d of documents) {
    await q.query(
      `INSERT INTO document_vault (id, file_name, original_name, mime_type, file_size, case_id, beneficiary_id, category, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      d,
    );
  }
  console.log('[17/27] Document vault seeded.');

  // ==========================================================================
  // 19. CASE TRACKER LOG (8)
  // ==========================================================================
  console.log('[18/27] Seeding case_tracker_log...');
  const trackerLogs = [
    [ID.trk1, 1, '2024-06-15', 'Dela Cruz', 'Juan',  'M.',  'Male',  'Senior', 'Senior Citizen', 'Bigte',     'Intake completed — FA assessment'],
    [ID.trk2, 1, '2024-06-28', 'Mendoza',   'Maria', 'L.',  'Female','18-59',  'Solo Parent',    'Matictic',  'Home visit assessment done'],
    [ID.trk3, 2, '2024-07-05', 'Santos',    'Jose',  'R.',  'Male',  'Senior', 'PWD',            'Partida',   'Beneficiary identity verified'],
    [ID.trk4, 1, '2024-07-25', 'Alcala',    'Teresa','S.',  'Female','18-59',  'Child',          'Poblacion', 'Tuition payment processed'],
    [ID.trk5, 1, '2024-08-03', 'Cruz',      'Elena', 'D.',  'Female','18-59',  'Solo Parent',    'Tigbe',     'Emergency food assistance deployed'],
    [ID.trk6, 1, '2024-08-20', 'Garcia',    'Luz',   'B.',  'Female','18-59',  'Solo Parent',    'Matictic',  'Livelihood capital released'],
    [ID.trk7, 1, '2024-09-01', 'Reyes',     'Mario', 'T.',  'Male',  '18-59',  'PWD',            'Partida',   'Skills training enrolled'],
    [ID.trk8, 1, '2024-10-05', 'Lopez',     'Carmen','S.',  'Female','Child',  'Child',          'Baraka',    'Scholarship stipend disbursed'],
  ];
  for (const t of trackerLogs) {
    await q.query(
      `INSERT INTO case_tracker_log (id, daily_seq_num, transaction_date, surname, first_name, middle_name, gender, age_range, client_category, barangay, intervention_remarks)
       VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)`,
      t,
    );
  }
  console.log('[18/27] Case tracker log seeded.');

  // ==========================================================================
  // 20. CHAT MESSAGES (8)
  // ==========================================================================
  console.log('[19/27] Seeding chat_messages...');
  const chatMessages = [
    [ID.chat1, ID.u_claimant_a, 'Pedro P. Reyes',     ID.u_worker_bigte, 'Good morning! I would like to follow up on my application.',           ID.c_dela_cruz, true,  '2024-06-18', '2024-06-18'],
    [ID.chat2, ID.u_worker_bigte, 'Juan Dela Cruz',   ID.u_claimant_a,  'Good morning! Your application is being processed.',                   ID.c_dela_cruz, true,  '2024-06-18', '2024-06-18'],
    [ID.chat3, ID.u_claimant_a, 'Pedro P. Reyes',     ID.u_worker_bigte, 'When can I expect the results?',                                      ID.c_dela_cruz, false, null,          '2024-06-18'],
    [ID.chat4, ID.u_worker_bigte, 'Juan Dela Cruz',   ID.u_claimant_a,  'Within 3-5 business days. We will notify you.',                       ID.c_dela_cruz, false, null,          '2024-06-18'],
    [ID.chat5, ID.u_claimant_b, 'Ana Marie L. Fernandez', ID.u_worker2,'Hi, I need help with my solo parent application.',                     ID.c_mendoza,   true,  '2024-07-02', '2024-07-02'],
    [ID.chat6, ID.u_worker2,    'Lorna B. Santos',    ID.u_claimant_b,  'Hello! Sure, what documents do you need?',                             ID.c_mendoza,   false, null,          '2024-07-02'],
    [ID.chat7, ID.u_claimant_b, 'Ana Marie L. Fernandez', ID.u_worker2,'I need to submit my barangay clearance.',                              ID.c_mendoza,   false, null,          '2024-07-02'],
    [ID.chat8, ID.u_worker2,    'Lorna B. Santos',    ID.u_claimant_b,  'Please upload it through the portal. Let me know if you need assistance.', ID.c_mendoza, false, null,      '2024-07-02'],
  ];
  for (const cm of chatMessages) {
    await q.query(
      `INSERT INTO chat_messages (id, sender_id, sender_name, recipient_id, content, conversation_id, is_read, read_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date)`,
      cm,
    );
  }
  console.log('[19/27] Chat messages seeded.');

  // ==========================================================================
  // 21. ACCESS CARD SERVICES (6)
  // ==========================================================================
  console.log('[20/27] Seeding access_card_services...');
  const accessCardServices = [
    [ID.acs1, 'NORZ-AC-0001', '2024-06-20', 'Senior Citizen ID Processing',   makeAmount(0),    'MSWDO',    'Juan Dela Cruz',     null],
    [ID.acs2, 'NORZ-AC-0001', '2024-07-01', 'Medical Assistance Request',     makeAmount(3000), 'DSWD',     'Juan Dela Cruz',     null],
    [ID.acs3, 'NORZ-AC-0002', '2024-06-25', 'Solo Parent ID Application',     makeAmount(0),    'MSWDO',    'Juan Dela Cruz',     null],
    [ID.acs4, 'NORZ-AC-0003', '2024-07-05', 'PWD ID Application',             makeAmount(0),    'MSWDO',    'Lorna B. Santos',    null],
    [ID.acs5, 'NORZ-AC-0005', '2024-07-20', 'Senior Citizen ID Renewal',      makeAmount(0),    'MSWDO',    'Juan Dela Cruz',     null],
    [ID.acs6, 'NORZ-AC-0006', '2024-08-03', 'Emergency Food Assistance',      makeAmount(2500), 'DSWD',     'Lorna B. Santos',    null],
  ];
  for (const acs of accessCardServices) {
    await q.query(
      `INSERT INTO access_card_services (id, access_card_code, service_date, service_rendered, cost, agency, worker_name_sign, intervention_id)
       VALUES ($1,$2,$3::date,$4,$5::numeric,$6,$7,$8)`,
      acs,
    );
  }
  console.log('[20/27] Access card services seeded.');

  // ==========================================================================
  // 22. SYNC QUEUE (3)
  // ==========================================================================
  console.log('[21/27] Seeding sync_queue...');
  const syncQueue = [
    [ID.sync1, 'DEV-BIGTE-001', 'beneficiaries', ID.b_mendoza, 'UPDATE', '{"changed_fields":["contact_no","address"]}',     '2024-10-01', 'pending', null, null, null],
    [ID.sync2, 'DEV-BIGTE-001', 'cases',         ID.c_4,       'UPDATE', '{"changed_fields":["status","description"]}',     '2024-10-02', 'pending', null, null, null],
    [ID.sync3, 'DEV-MATICTIC-001', 'cases',     ID.c_5,       'INSERT', '{"case_id":"' + ID.c_5 + '"}',                    '2024-10-03', 'applied', 'idem-' + ID.c_5, null, null],
  ];
  for (const sq of syncQueue) {
    await q.query(
      `INSERT INTO sync_queue (id, device_id, table_name, record_id, operation, payload, client_updated_at, status, idempotency_key, conflict_reason, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::date,$8,$9,$10,$11::date)`,
      sq,
    );
  }
  console.log('[21/27] Sync queue seeded.');

  // ==========================================================================
  // 23. FORM VERSION HISTORY (3)
  // ==========================================================================
  console.log('[22/27] Seeding form_version_history...');
  await q.query(
    `INSERT INTO form_version_history (id, program_id, form_template, version, created_at) VALUES
      (uuid_generate_v7(), $1, $2, 1, '2024-11-01'::date),
      (uuid_generate_v7(), $3, $4, 1, '2024-11-01'::date),
      (uuid_generate_v7(), $5, $6, 1, '2025-01-15'::date)`,
    [
      ID.prog_akap, '{"type":"object","title":"AKAP Application v1","properties":{"amount":{"type":"number"},"purpose":{"type":"string"}},"required":["amount","purpose"]}',
      ID.prog_medical, '{"type":"object","title":"Medical Assistance v1","properties":{"hospital":{"type":"string"},"diagnosis":{"type":"string"},"amount":{"type":"number"}},"required":["hospital"]}',
      ID.prog_education, '{"type":"object","title":"Educational Assistance v1","properties":{"school":{"type":"string"},"grade":{"type":"string"},"amount":{"type":"number"}},"required":["school"]}',
    ],
  );
  console.log('[22/27] Form version history seeded.');

  // ==========================================================================
  // 24. VERSION VECTORS (2)
  // ==========================================================================
  console.log('[23/27] Seeding version_vectors...');
  const now = new Date();
  const versionVectors = [
    ['DEV-BIGTE-001',    'cases',         5, 8,  now],
    ['DEV-MATICTIC-001', 'beneficiaries', 3, 10, now],
  ];
  for (const vv of versionVectors) {
    await q.query(
      `INSERT INTO version_vectors (device_id, table_name, local_version, server_version, last_synced_at)
       VALUES ($1,$2,$3,$4,$5)`,
      vv,
    );
  }
  console.log('[23/27] Version vectors seeded.');

  // ==========================================================================
  // 25. OTP CODES (2)
  // ==========================================================================
  console.log('[24/27] Seeding otp_codes...');
  await q.query(
    `INSERT INTO otp_codes (phone, code, verified, expires_at) VALUES
      ('09171000001','654321',false, NOW() + interval '10 minutes'),
      ('09171000002','123456',true,  NOW() - interval '5 minutes')`,
  );
  console.log('[24/27] OTP codes seeded.');

  // ==========================================================================
  // 26. AUDIT LOG (5)
  // ==========================================================================
  console.log('[25/27] Seeding audit_log...');
  const auditLogs = [
    ['irf.created',             ID.irf1, ID.u_worker_bigte, '{"blotter":"BLOTTER-2025-001","category":"Abuse"}'],
    ['irf.disposition_changed', ID.irf2, ID.u_worker_bigte, '{"from":"Under Investigation","to":"Referred to WCPD","reason":"Case jurisdiction falls under WCPD mandate"}'],
    ['irf.disposition_changed', ID.irf3, ID.u_worker2,      '{"from":"Under Investigation","to":"Referred to PNP","reason":"Potential criminal nature requires PNP investigation"}'],
    ['irf.disposition_changed', ID.irf4, ID.u_worker2,      '{"from":"Under Investigation","to":"Closed","reason":"Victim retracted complaint. Case resolved through barangay mediation."}'],
    ['compliance.audit',        null,    ID.u_auditor,       '{"check":"RLS_policies","result":"pass","checked_at":"2025-04-15 10:00:00"}'],
  ];
  for (const al of auditLogs) {
    await q.query(
      `INSERT INTO audit_log (action, reference_id, user_id, details)
       VALUES ($1,$2,$3,$4::jsonb)`,
      al,
    );
  }
  console.log('[25/27] Audit log seeded.');

  // ==========================================================================
  // 27. IDEMPOTENCY KEYS (2)
  // ==========================================================================
  console.log('[26/27] Seeding idempotency_keys...');
  await q.query(
    `INSERT INTO idempotency_keys (key, result) VALUES
      ($1, $2),
      ($3, $4)`,
    [
      'sync-DEV-BIGTE-001-' + ID.c_7 + '-20250410',
      '{"status":"applied","record_id":"' + ID.c_7 + '"}',
      'sync-DEV-MATICTIC-001-' + ID.c_5 + '-20250405',
      '{"status":"applied","record_id":"' + ID.c_5 + '"}',
    ],
  );
  console.log('[26/27] Idempotency keys seeded.');

  // ==========================================================================
  // 29. CASE INTERVENTIONS (8)
  // ==========================================================================
  console.log('[27/29] Seeding case_interventions...');
  const caseInterventions = [
    [ID.ci1, ID.c_dela_cruz, ID.prog_akap,     'AKAP Financial Aid',      'Financial Assistance', '2026-07-15', 5000,  'Cash',             'DSWD',     'Emergency cash assistance for medical needs', ID.u_worker_bigte],
    [ID.ci2, ID.c_dela_cruz, ID.prog_medical,  'Medical Assistance',       'Health',               '2026-07-18', 3000,  'Guarantee Letter', 'LGU',      'Guarantee letter for hospital expenses',     ID.u_worker_bigte],
    [ID.ci3, ID.c_mendoza,   ID.prog_food,     'Food Assistance',          'Basic Needs',          '2026-07-20', 2000,  'Cash',             'DSWD',     'Food pack for family of 5',                  ID.u_worker2],
    [ID.ci4, ID.c_1,         null,              'Counseling Session',       'Counseling',           '2026-07-22', null,  null,                null,       'Initial counseling session — family conflict resolution', ID.u_worker2],
    [ID.ci5, ID.c_2,         ID.prog_education,'Educational Assistance',   'Education',            '2026-07-25', 10000, 'Cheque',           'PDAF',     'Tuition fee for current semester',            ID.u_worker_bigte],
    [ID.ci6, ID.c_3,         null,              'Home Visit',               'Counseling',           '2026-07-28', null,  null,                null,       'Follow-up home visit — assessed living conditions', ID.u_worker_bigte],
    [ID.ci7, ID.c_4,         ID.prog_burial,   'Burial Assistance',        'Crisis Intervention',  '2026-07-10', 5000,  'Cash',             'LGU',      'Burial assistance for deceased family member', ID.u_worker2],
    [ID.ci8, ID.c_5,         ID.prog_akap,     'AKAP Financial Aid',       'Financial Assistance', '2026-07-12', 3000,  'Cash',             'DSWD',     'Financial aid for maintenance medication',    ID.u_worker_bigte],
  ];
  for (const ci of caseInterventions) {
    await q.query(
      `INSERT INTO case_interventions (id, case_id, program_id, service_name, category, delivery_date, amount, mode_of_delivery, fund_source, notes, delivered_by)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7::numeric,$8,$9,$10,$11)`,
      ci,
    );
  }
  console.log('[27/29] Case interventions seeded.');

  // ==========================================================================
  // 30. TRANSITION PLAN DATA (3 cases)
  // ==========================================================================
  console.log('[28/29] Seeding transition plan data...');
  await q.query(
    `UPDATE cases SET
       self_reliance_plan = 'Client will undergo skills training for livelihood program. Follow-up in 30 days.',
       referrals = $1::jsonb,
       follow_up_date = '2026-08-15'
     WHERE id = $2`,
    ['[{"agencyName":"DSWD Regional Office","reason":"Livelihood program referral","status":"pending"}]', ID.c_dela_cruz],
  );
  await q.query(
    `UPDATE cases SET
       self_reliance_plan = 'Referred to DSWD for sustainable livelihood assistance.',
       referrals = $1::jsonb,
       follow_up_date = '2026-08-01'
     WHERE id = $2`,
    ['[{"agencyName":"DOLE","reason":"Job placement assistance","status":"completed"}]', ID.c_mendoza],
  );
  await q.query(
    `UPDATE cases SET
       self_reliance_plan = 'Ongoing counseling — self-reliance plan to be developed after 3 sessions.'
     WHERE id = $1`,
    [ID.c_1],
  );
  console.log('[28/29] Transition plan data seeded.');

  // ==========================================================================
  // 31. RE-ENABLE RLS + SUMMARY
  // ==========================================================================
  console.log('[29/29] Re-enabling RLS...');
  for (const tbl of ['beneficiaries', 'cases', 'consent_ledger', 'irf_cases']) {
    await q.query(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`);
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  UNIFIED SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Tables seeded: 22');
  console.log('  Users:              9');
  console.log('  Persons:            38');
  console.log('  Beneficiaries:      21');
  console.log('  Beneficiary Claimants: 21 (diverse claimants)');
  console.log('  Households:         20');
  console.log('  Household Members:  42 (21 persons with membership)');
  console.log('  Cases:              10 (all use SERVICE_TYPES values)');
  console.log('  Case History:       25');
  console.log('  Programs:           6');
  console.log('  Program Assignments: 6');
  console.log('  Program Steps:      18');
  console.log('  IRF Cases:          4');
  console.log('  Consent Ledger:     15');
  console.log('  Notifications:      10');
  console.log('  Notification Prefs: 6');
  console.log('  CSR Reports:        3');
  console.log('  Documents:          5');
  console.log('  Tracker Log:        8');
  console.log('  Chat Messages:      8');
  console.log('  Access Card Svcs:   6');
  console.log('  Sync Queue:         3');
  console.log('  Form Versions:      3');
  console.log('  Version Vectors:    2');
  console.log('  OTP Codes:          2');
  console.log('  Audit Log:          5');
  console.log('  Idempotency Keys:   2');
  console.log('  Case Interventions: 8');
  console.log('');
  console.log('  Credentials:');
  console.log('    admin       → admin@mswdo.test / admin123');
  console.log('    worker 1    → worker1@mswdo.test / worker123');
  console.log('    worker 2    → worker2@mswdo.test / worker123');
  console.log('    coordinator → coordinator@mswdo.test / coordinator123');
  console.log('    claimant    → pedro.claimant@test.com / claimant123');
  console.log('    claimant    → ana.claimant@test.com / claimant123');
  console.log('    mayor       → mayor@mswdo.test / mayor123');
  console.log('    auditor     → auditor@mswdo.test / auditor123');
  console.log('');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
