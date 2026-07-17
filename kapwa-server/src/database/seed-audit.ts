import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'kapwa',
  password: process.env.DB_PASSWORD || 'kapwa',
  database: process.env.DB_NAME || 'kapwa',
});

function hashFor(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function genericPayload(prev: { id: string; hash: string | null }): Record<string, unknown> {
  return { id: prev.id, hash: prev.hash };
}

function makeAmount(n: number): string {
  return n.toFixed(2);
}

// ========================================================================
// Deterministic IDs for audit test data
// ========================================================================
const ID = {
  AUDITOR_USER: 'a0000000-0000-0000-0000-00000000a001',
  WORKER_USER:  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',

  // Beneficiaries (4 for hash chain)
  BEN_1: 'a0000000-0000-0000-0000-00000000b001',
  BEN_2: 'a0000000-0000-0000-0000-00000000b002',
  BEN_3: 'a0000000-0000-0000-0000-00000000b003',
  BEN_4: 'a0000000-0000-0000-0000-00000000b004',

  // Cases (4 for hash chain)
  CASE_1: 'a0000000-0000-0000-0000-00000000c001',
  CASE_2: 'a0000000-0000-0000-0000-00000000c002',
  CASE_3: 'a0000000-0000-0000-0000-00000000c003',
  CASE_4: 'a0000000-0000-0000-0000-00000000c004',

  // Interventions (6 — record 4 hash is deliberately tampered)
  INT_1: 'a0000000-0000-0000-0000-00000000f001',
  INT_2: 'a0000000-0000-0000-0000-00000000f002',
  INT_3: 'a0000000-0000-0000-0000-00000000f003',
  INT_4: 'a0000000-0000-0000-0000-00000000f004',
  INT_5: 'a0000000-0000-0000-0000-00000000f005',
  INT_6: 'a0000000-0000-0000-0000-00000000f006',

  // Consent ledger (3)
  CONS_1: 'a0000000-0000-0000-0000-00000000d001',
  CONS_2: 'a0000000-0000-0000-0000-00000000d002',
  CONS_3: 'a0000000-0000-0000-0000-00000000d003',
};

async function ensureAuditorUser(q: any) {
  const byEmail = await q.query(`SELECT id FROM users WHERE email = 'auditor@mswdo.test'`);
  if (byEmail.length === 0) {
    const pw = await bcrypt.hash('auditor123', 12);
    await q.query(
      `INSERT INTO users (id, email, password, role, full_name)
       VALUES ($1, 'auditor@mswdo.test', $2, 'auditor', 'Auditor User')`,
      [ID.AUDITOR_USER, pw],
    );
    console.log('  ✓ Created auditor user (auditor@mswdo.test / auditor123)');
  } else {
    console.log('  ✓ Auditor user already exists (id=' + byEmail[0].id.slice(0, 8) + '…)');
  }
}

async function seedBeneficiaryChain(q: any) {
  // Clear ALL hashes across the entire table so interleaving records don't break the chain
  await q.query(`UPDATE beneficiaries SET hash = NULL, prev_hash = NULL`);

  const rows: { id: string; hash: string | null }[] = [];
  const now = new Date();

  const beneficiaries = [
    { id: ID.BEN_1, surname: 'Alcala', firstName: 'Maria', gender: 'Female', dob: '1988-04-12', address: 'Bigte', category: 'Family' },
    { id: ID.BEN_2, surname: 'Roxas', firstName: 'Jose', gender: 'Male', dob: '1975-09-23', address: 'Matictic', category: 'Family' },
    { id: ID.BEN_3, surname: 'Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-11-05', address: 'Partida', category: 'Women' },
    { id: ID.BEN_4, surname: 'Santos', firstName: 'Benny', gender: 'Male', dob: '1980-07-18', address: 'Bigte', category: 'PWD' },
  ];

  for (let i = 0; i < beneficiaries.length; i++) {
    const b = beneficiaries[i];
    let hash: string | null;
    if (i === 0) {
      hash = null; // skipped by verification (prev record in DB has no hash)
    } else {
      hash = hashFor(genericPayload(rows[i - 1]));
    }
    rows.push({ id: b.id, hash });

    const exists = await q.query(`SELECT id FROM beneficiaries WHERE id = $1`, [b.id]);
    if (exists.length === 0) {
      await q.query(
        `INSERT INTO beneficiaries (id, philsys_number, surname, first_name, gender, dob, address, consent_status, category, created_at, hash, prev_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11)`,
        [
          b.id, `AUDIT-PHIL-${String(i + 1).padStart(4, '0')}`,
          b.surname, b.firstName, b.gender, b.dob, b.address,
          b.category, now, hash, i > 0 ? rows[i - 1].hash : null,
        ],
      );
    } else {
      await q.query(
        `UPDATE beneficiaries SET hash = $1, prev_hash = $2 WHERE id = $3`,
        [hash, i > 0 ? rows[i - 1].hash : null, b.id],
      );
    }
  }
  console.log(`  ✓ Beneficiary hash chain (${beneficiaries.length} records, all valid)`);
}

async function seedCaseChain(q: any) {
  // Clear ALL hashes across the entire table
  await q.query(`UPDATE cases SET hash = NULL, prev_hash = NULL`);

  const rows: { id: string; hash: string | null }[] = [];
  const now = new Date();

  const cases = [
    { id: ID.CASE_1, controlNo: 'AUDIT-2025-0001', beneficiaryId: ID.BEN_1, status: 'approved' },
    { id: ID.CASE_2, controlNo: 'AUDIT-2025-0002', beneficiaryId: ID.BEN_2, status: 'disbursed' },
    { id: ID.CASE_3, controlNo: 'AUDIT-2025-0003', beneficiaryId: ID.BEN_3, status: 'approved' },
    { id: ID.CASE_4, controlNo: 'AUDIT-2025-0004', beneficiaryId: ID.BEN_4, status: 'closed' },
  ];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    let hash: string | null;
    if (i === 0) {
      hash = null;
    } else {
      hash = hashFor(genericPayload(rows[i - 1]));
    }
    rows.push({ id: c.id, hash });

    const exists = await q.query(`SELECT id FROM cases WHERE id = $1`, [c.id]);
    if (exists.length === 0) {
      await q.query(
        `INSERT INTO cases (id, control_no, beneficiary_id, service_requested, status, created_at, hash, prev_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          c.id, c.controlNo, c.beneficiaryId, '{Financial Aid}',
          c.status, now, hash, i > 0 ? rows[i - 1].hash : null,
        ],
      );
    } else {
      await q.query(
        `UPDATE cases SET hash = $1, prev_hash = $2 WHERE id = $3`,
        [hash, i > 0 ? rows[i - 1].hash : null, c.id],
      );
    }
  }
  console.log(`  ✓ Case hash chain (${cases.length} records, all valid)`);
}

async function seedInterventionChain(q: any) {
  // Clear ALL existing hashes before setting up the audit chain
  await q.query(`UPDATE interventions SET hash = NULL, prev_hash = NULL`);

  // Delete existing audit-test interventions and re-insert to reset their logged_at
  await q.query(
    `DELETE FROM interventions WHERE id IN ($1, $2, $3, $4, $5, $6)`,
    [ID.INT_1, ID.INT_2, ID.INT_3, ID.INT_4, ID.INT_5, ID.INT_6],
  );

  interface IntRow { id: string; interventionType: string; amount: string; hash: string | null }
  const rows: IntRow[] = [];

  const interventions = [
    { id: ID.INT_1, type: 'Financial Assistance', amount: makeAmount(5000), caseId: ID.CASE_1, serviceDate: '2025-01-15' },
    { id: ID.INT_2, type: 'Medical Assistance', amount: makeAmount(12000), caseId: ID.CASE_1, serviceDate: '2025-02-20' },
    { id: ID.INT_3, type: 'Burial Assistance', amount: makeAmount(20000), caseId: ID.CASE_2, serviceDate: '2025-03-10' },
    { id: ID.INT_4, type: 'Educational Assistance', amount: makeAmount(8000), caseId: ID.CASE_3, serviceDate: '2025-04-05' },
    { id: ID.INT_5, type: 'Medical Assistance', amount: makeAmount(15000), caseId: ID.CASE_4, serviceDate: '2025-05-12' },
    { id: ID.INT_6, type: 'Financial Assistance', amount: makeAmount(3000), caseId: ID.CASE_3, serviceDate: '2025-06-01' },
  ];

  for (let i = 0; i < interventions.length; i++) {
    const iv = interventions[i];
    let hash: string | null;
    if (i === 0) {
      hash = null;
    } else {
      const prev = rows[i - 1];
      hash = hashFor(genericPayload(prev));
    }

    let prevHash: string | null = null;
    if (i > 0) prevHash = rows[i - 1].hash;

    // INT_4 (index 3) gets a WRONG hash to simulate a broken chain
    const storeHash = i === 3 ? hashFor({ tampered: true, id: iv.id }) : hash;
    rows.push({ id: iv.id, interventionType: iv.type, amount: iv.amount, hash: storeHash });

    await q.query(
      `INSERT INTO interventions
         (id, case_id, intervention_type, amount, fund_source, agency, service_date, signature_status,
          worker_signature_url, logged_by, logged_at, hash, prev_hash)
       VALUES ($1, $2, $3, $4, 'Regular', 'MSWDO-Norzagaray', $5, 'signatures_collected',
          '/sig/audit-worker.png', $6, $7, $8, $9)`,
      [
        iv.id, iv.caseId, iv.type, iv.amount, iv.serviceDate,
        ID.WORKER_USER, new Date(), storeHash, prevHash,
      ],
    );
  }

  // Separate: INT_4 should have been broken (tampered hash)
  // The verification will detect it
  console.log('  ✓ Intervention hash chain (6 records: INT-1..3 valid, INT-4 tampered → broken chain, INT-5..6 valid)');
}

async function seedConsentLedger(q: any) {
  // Clear ALL existing hashes first
  await q.query(`UPDATE consent_ledger SET hash = NULL, prev_hash = NULL`);

  await q.query(
    `DELETE FROM consent_ledger WHERE id IN ($1, $2, $3)`,
    [ID.CONS_1, ID.CONS_2, ID.CONS_3],
  );

  const rows: { id: string; hash: string | null }[] = [];

  const entries = [
    { id: ID.CONS_1, beneficiaryId: ID.BEN_1, purpose: 'GIS Intake & Case Processing', channel: 'in_person', status: 'active', grantedAt: new Date('2025-01-10') },
    { id: ID.CONS_2, beneficiaryId: ID.BEN_2, purpose: 'Data Sharing Agreement', channel: 'sms', status: 'active', grantedAt: new Date('2025-02-15') },
    { id: ID.CONS_3, beneficiaryId: ID.BEN_3, purpose: 'Medical Records Access', channel: 'in_person', status: 'revoked', grantedAt: new Date('2025-03-01'), revokedAt: new Date('2025-04-01'), revokedReason: 'Beneficiary request' },
  ];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let hash: string | null;
    if (i === 0) {
      hash = null;
    } else {
      hash = hashFor(genericPayload(rows[i - 1]));
    }
    rows.push({ id: e.id, hash });

    await q.query(
      `INSERT INTO consent_ledger (id, beneficiary_id, purpose, channel, status, granted_at, revoked_at, revoked_reason, hash, prev_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        e.id, e.beneficiaryId, e.purpose, e.channel, e.status,
        e.grantedAt, e.revokedAt || null, e.revokedReason || null,
        hash, i > 0 ? rows[i - 1].hash : null,
      ],
    );
  }
  console.log('  ✓ Consent ledger hash chain (3 records, all valid)');
}

async function seed() {
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  Audit Log Test Data Seeder');
  console.log('══════════════════════════════════════════════');
  console.log('');

  await dataSource.initialize();
  const q = dataSource.createQueryRunner();

  try {
    await ensureAuditorUser(q);
    console.log('');
    await seedBeneficiaryChain(q);
    await seedCaseChain(q);
    await seedInterventionChain(q);
    await seedConsentLedger(q);

    console.log('');
    console.log('── Summary ──────────────────────────────────');
    console.log('  Login: auditor@mswdo.test / auditor123');
    console.log('  URL:   /audit-logs');
    console.log('');
    console.log('  Hash chain statuses expected:');
    console.log('    interventions  → BROKEN  (INT-4 tampered)');
    console.log('    cases          → VALID');
    console.log('    beneficiaries  → VALID');
    console.log('    consent_ledger → VALID');
    console.log('');
    console.log('  Consent ledger: 3 records (2 active, 1 revoked)');
    console.log('══════════════════════════════════════════════');
    console.log('');
  } finally {
    await q.release();
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Audit seed failed:', err);
  process.exit(1);
});
