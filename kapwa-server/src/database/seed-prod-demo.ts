/**
 * Production demo roster seed — the exact MSWDO shape used by the demo
 * deployment (deliberately NOT loaded with the fabricated seed-demo or
 * seed-analytics datasets):
 *
 *   1 admin, 5 social workers (city-wide MSWDO scope), 13 barangay
 *   coordinators (one per barangay, primary assignment), 5 claimants, each
 *   with one linked intake case, plus the full program catalog.
 *
 * Accounts are direct DB inserts (bcrypt + user_barangay_assignments,
 * mirroring seed-accounts). Cases go through the real POST /intake endpoint
 * so hash chains, audit trails and the auto-generated access cards stay
 * valid (mirroring seed-demo). Idempotent: ON CONFLICT users, dup-checked
 * intakes, guarded claimant links.
 *
 * Run with: npm run seed:prod-demo   (or docker exec <api> node dist/database/seed-prod-demo.js)
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { BARANGAYS } from '../common/constants';
import { seedPrograms } from './seed-programs';

const API = process.env.API_BASE || 'http://localhost:3000/api/v1';
const SALT_ROUNDS = 12;

interface SeedAccount {
  email: string;
  password: string;
  role: 'admin' | 'social_worker' | 'coordinator' | 'claimant';
  firstName: string;
  middleName?: string;
  lastName: string;
  phone: string;
  assignedBarangay?: string;
  permittedBarangays?: string[];
  /** Claimant persons: surname/firstName identify the linked beneficiary. */
  person?: { surname: string; firstName: string };
}

const ROSTER: SeedAccount[] = [
  // 1 admin
  { email: 'admin@mswdo.test', password: 'admin123', role: 'admin', firstName: 'Rosario', middleName: 'G.', lastName: 'Mendoza', phone: '09171000001' },
  // 5 social workers — city-wide scope, no single primary (3NF child table)
  { email: 'worker1@mswdo.test', password: 'worker123', role: 'social_worker', firstName: 'Juan', middleName: 'Dizon', lastName: 'Dela Cruz', phone: '09171000002', permittedBarangays: BARANGAYS.map(b => b.name) },
  { email: 'worker2@mswdo.test', password: 'worker123', role: 'social_worker', firstName: 'Lorna', middleName: 'Bautista', lastName: 'Santos', phone: '09171000003', permittedBarangays: BARANGAYS.map(b => b.name) },
  { email: 'worker3@mswdo.test', password: 'worker123', role: 'social_worker', firstName: 'Rosalie', middleName: 'Custodio', lastName: 'Camacho', phone: '09171000004', permittedBarangays: BARANGAYS.map(b => b.name) },
  { email: 'worker4@mswdo.test', password: 'worker123', role: 'social_worker', firstName: 'Dante', middleName: 'Villamor', lastName: 'Villanueva', phone: '09171000007', permittedBarangays: BARANGAYS.map(b => b.name) },
  { email: 'worker5@mswdo.test', password: 'worker123', role: 'social_worker', firstName: 'Marites', middleName: 'Rondina', lastName: 'Ramos', phone: '09171000008', permittedBarangays: BARANGAYS.map(b => b.name) },
  // 13 barangay coordinators — exactly one per barangay
  ...BARANGAYS.map((b, i) => ({
    email: `coordinator.${b.slug}@mswdo.test`,
    password: 'coordinator123',
    role: 'coordinator' as const,
    firstName: b.name,
    lastName: 'Coordinator',
    phone: `09171001${String(i + 1).padStart(2, '0')}`,
    assignedBarangay: b.name,
    permittedBarangays: [b.name],
  })),
  // 5 claimants — each with a linked case (see CLAIMANT_PEOPLE below);
  // middle names are full names, not initials (schema: middle_name TEXT)
  { email: 'pedro.claimant@test.com', password: 'claimant123', role: 'claimant', firstName: 'Pedro', middleName: 'Poblete', lastName: 'Reyes', phone: '09171000005', person: { surname: 'Reyes', firstName: 'Pedro' } },
  { email: 'ana.claimant@test.com', password: 'claimant123', role: 'claimant', firstName: 'Ana Marie', middleName: 'Lontok', lastName: 'Fernandez', phone: '09171000006', person: { surname: 'Fernandez', firstName: 'Ana Marie' } },
  { email: 'nena.castillo@test.com', password: 'claimant123', role: 'claimant', firstName: 'Nena', middleName: 'Cruz', lastName: 'Castillo', phone: '09171000009', person: { surname: 'Castillo', firstName: 'Nena' } },
  { email: 'rico.bautista@test.com', password: 'claimant123', role: 'claimant', firstName: 'Rico', middleName: 'Buenaventura', lastName: 'Bautista', phone: '09171000010', person: { surname: 'Bautista', firstName: 'Rico' } },
  { email: 'carla.dimagiba@test.com', password: 'claimant123', role: 'claimant', firstName: 'Carla', middleName: 'Dimayuga', lastName: 'Dimagiba', phone: '09171000011', person: { surname: 'Dimagiba', firstName: 'Carla' } },
];

interface ClaimantPerson {
  surname: string;
  firstName: string;
  middleName: string;
  gender: 'Male' | 'Female';
  dob: string;
  phone: string;
  address: string; // 'Barangay, Norzagaray'
  occupation: string;
  civilStatus: string;
  placeOfBirth: string;
  estimatedMonthlyIncome: number;
  category: string;
  serviceRequested: string;
}

const CLAIMANT_PEOPLE: ClaimantPerson[] = [
  // middle_name is the full middle name (maternal surname), never an initial.
  { surname: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', gender: 'Male', dob: '1988-03-21', phone: '09171000005', address: 'Bigte, Norzagaray', occupation: 'Tricycle Driver', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 7000, category: 'Indigent', serviceRequested: 'AICS — Assistance to Individuals in Crisis Situation' },
  { surname: 'Fernandez', firstName: 'Ana Marie', middleName: 'Lontok', gender: 'Female', dob: '1982-02-25', phone: '09171000006', address: 'FVR, Norzagaray', occupation: 'Sari-sari Store Owner', civilStatus: 'Single', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 8000, category: 'Family Head and Other Needy Adult', serviceRequested: 'AICS — Assistance to Individuals in Crisis Situation' },
  { surname: 'Castillo', firstName: 'Nena', middleName: 'Cruz', gender: 'Female', dob: '1975-06-14', phone: '09171000009', address: 'Poblacion, Norzagaray', occupation: 'Housewife', civilStatus: 'Widowed', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 4500, category: 'Family Head and Other Needy Adult', serviceRequested: 'PWD Assistance' },
  { surname: 'Bautista', firstName: 'Rico', middleName: 'Buenaventura', gender: 'Male', dob: '1969-11-02', phone: '09171000010', address: 'Minuyan, Norzagaray', occupation: 'Farmer', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 5000, category: 'Indigent', serviceRequested: 'Social Pension for Indigent Senior Citizens' },
  { surname: 'Dimagiba', firstName: 'Carla', middleName: 'Dimayuga', gender: 'Female', dob: '1993-04-19', phone: '09171000011', address: 'San Mateo, Norzagaray', occupation: 'Street Vendor', civilStatus: 'Single', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 6000, category: 'Indigent', serviceRequested: 'Sustainable Livelihood Program' },
];

async function seedAccountsAndAssignments(): Promise<void> {
  const q = AppDataSource.createQueryRunner();
  await q.connect();
  try {
    const hashed = await Promise.all(
      ROSTER.map(async acct => ({ acct, hash: await bcrypt.hash(acct.password, SALT_ROUNDS) })),
    );
    for (const { acct, hash } of hashed) {
      await q.query(
        `INSERT INTO users (email, password, role, first_name, middle_name, last_name, name_extension, phone, is_active, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true)
         ON CONFLICT (email) DO NOTHING`,
        [acct.email, hash, acct.role, acct.firstName, acct.middleName ?? null, acct.lastName, null, acct.phone],
      );
      // Converge identity fields on re-runs even when the row already exists
      // (ON CONFLICT above does nothing) — middle_name is a name, not an
      // initial, and earlier runs must be repaired.
      await q.query(
        `UPDATE users SET first_name = $2, middle_name = $3, last_name = $4, phone = $5 WHERE email = $1`,
        [acct.email, acct.firstName, acct.middleName ?? null, acct.lastName, acct.phone],
      );
    }
    // Barangay assignments (3NF child table) — delete + insert so a re-run
    // converges on this exact roster.
    for (const acct of ROSTER.filter(a => a.assignedBarangay || a.permittedBarangays?.length)) {
      const rows = await q.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [acct.email]);
      if (!rows.length) continue;
      const userId = rows[0].id;
      await q.query(`DELETE FROM user_barangay_assignments WHERE user_id = $1`, [userId]);
      if (acct.assignedBarangay) {
        await q.query(
          `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,true)`,
          [userId, acct.assignedBarangay],
        );
      }
      for (const b of acct.permittedBarangays ?? []) {
        await q.query(
          `INSERT INTO user_barangay_assignments (user_id, barangay, is_primary) VALUES ($1,$2,false)`,
          [userId, b],
        );
      }
    }
  } finally {
    await q.release();
  }
}

async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify({ email, password }),
  });
  captureCsrf(r);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login ${email} failed: ${r.status} ${JSON.stringify(json).slice(0, 180)}`);
  return json.accessToken as string;
}

// Double-submit CSRF: the guard sets a readable `csrf-token` cookie on any
// request that lacks one and refuses unsafe methods without a matching
// `X-CSRF-Token` header. Node's fetch has no cookie jar, so keep one here —
// without it every write 403s with "Missing CSRF token" (mirrors seed-demo).
let csrfToken: string | null = null;
function captureCsrf(res: Response): void {
  const cookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const m = /^csrf-token=([^;]+)/.exec(cookie);
    if (m) csrfToken = m[1];
  }
}
function csrfHeaders(): Record<string, string> {
  return csrfToken ? { 'X-CSRF-Token': csrfToken, Cookie: `csrf-token=${csrfToken}` } : {};
}

async function call(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...csrfHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  captureCsrf(r);
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function seedClaimantCases(workerToken: string, workerId: string): Promise<number> {
  let created = 0;
  for (const p of CLAIMANT_PEOPLE) {
    // Idempotency: the API search masks phone (PII), so check the DB directly.
    const dup = await AppDataSource.query(
      `SELECT b.id, p.id AS person_id FROM beneficiaries b JOIN persons p ON p.id = b.person_id
       LEFT JOIN person_contacts pc ON pc.person_id = p.id AND pc.contact_type = 'phone'
       WHERE p.surname = $1 AND pc.value = $2 LIMIT 1`,
      [p.surname, p.phone],
    );
    if (dup[0]?.id) {
      // Converge on the configured middle name even when the person already
      // exists (earlier runs seeded initials) — middle_name is a name, not
      // an initial.
      if (dup[0].person_id) {
        await AppDataSource.query(
          `UPDATE persons SET middle_name = $2 WHERE id = $1`,
          [dup[0].person_id, p.middleName],
        );
      }
      console.log(`skip ${p.firstName} ${p.surname} (already exists) — middle name synced`);
      continue;
    }
    const personInput = {
      surname: p.surname, firstName: p.firstName, middleName: p.middleName,
      gender: p.gender, dob: p.dob, placeOfBirth: p.placeOfBirth, civilStatus: p.civilStatus,
      cellularNumber: p.phone, email: `${p.firstName.toLowerCase().split(' ')[0]}.${p.surname.toLowerCase()}@demo.test`,
      currentAddress: {
        street: p.address, barangay: p.address.split(',')[0].trim(),
        city: 'Norzagaray', province: 'Bulacan', region: 'Region III (Central Luzon)', postalCode: '3013',
      },
      occupation: p.occupation, estimatedMonthlyIncome: p.estimatedMonthlyIncome,
    };
    const intake = await call(workerToken, 'POST', '/intake', {
      beneficiary: personInput,
      claimant: { ...personInput, relationshipToBeneficiary: 'Self' },
      familyMembers: [],
      case: { serviceRequested: [p.serviceRequested], assignedWorkerId: workerId },
    });
    if (intake.status >= 400) {
      console.log(`intake ${p.firstName} ${p.surname} FAILED ${intake.status}: ${JSON.stringify(intake.json).slice(0, 160)}`);
      continue;
    }
    console.log(`intake enrolled ${p.firstName} ${p.surname} — ${intake.json.caseId} (access card auto-generated)`);
    created++;
  }
  return created;
}

async function linkClaimants(): Promise<number> {
  let linked = 0;
  for (const acct of ROSTER.filter(a => a.role === 'claimant' && a.person)) {
    const person = await AppDataSource.query(
      `SELECT p.id FROM persons p JOIN beneficiaries b ON b.person_id = p.id
       WHERE p.surname = $1 AND p.first_name = $2 LIMIT 1`,
      [acct.person!.surname, acct.person!.firstName],
    );
    if (!person[0]?.id) {
      console.warn(`  WARN no beneficiary person for ${acct.firstName} ${acct.person!.surname}`);
      continue;
    }
    const user = await AppDataSource.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [acct.email]);
    const userId = user[0]?.id;
    if (!userId) {
      console.warn(`  WARN no user for ${acct.email}`);
      continue;
    }
    await AppDataSource.query(
      `UPDATE users SET person_id = $2, person_link_code = NULL WHERE email = $1`,
      [acct.email, person[0].id],
    );
    await AppDataSource.query(
      `UPDATE beneficiaries SET user_id = $2 WHERE person_id = $1`,
      [person[0].id, userId],
    );
    await AppDataSource.query(
      `INSERT INTO beneficiary_claimants (beneficiary_id, claimant_id, relationship, is_primary, calendar_year)
       SELECT $1, $1, 'Self', true, EXTRACT(YEAR FROM NOW())
       WHERE NOT EXISTS (SELECT 1 FROM beneficiary_claimants WHERE beneficiary_id = $1 AND claimant_id = $1)`,
      [person[0].id],
    );
    console.log(`linked claimant ${acct.email} -> ${acct.firstName} ${acct.person!.surname}`);
    linked++;
  }
  return linked;
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('seeding programs (idempotent)...');
  await seedPrograms(AppDataSource);

  console.log('seeding accounts (1 admin / 5 workers / 13 coordinators / 5 claimants)...');
  await seedAccountsAndAssignments();

  console.log('enrolling claimant cases through the intake API...');
  const workerToken = await login('worker1@mswdo.test', 'worker123');
  const me = await call(workerToken, 'GET', '/auth/me');
  const workerId = me.json?.user?.id || me.json?.id;
  const created = await seedClaimantCases(workerToken, workerId);

  console.log('linking claimant accounts to their beneficiaries...');
  const linked = await linkClaimants();

  const counts = await AppDataSource.query(
    `SELECT (SELECT COUNT(*)::int FROM users) AS users,
            (SELECT COUNT(*)::int FROM programs) AS programs,
            (SELECT COUNT(*)::int FROM beneficiaries) AS beneficiaries,
            (SELECT COUNT(*)::int FROM cases) AS cases`,
  );
  console.log(`done: cases_created=${created} claimants_linked=${linked} users=${counts[0].users} programs=${counts[0].programs} beneficiaries=${counts[0].beneficiaries} cases=${counts[0].cases}`);
  await AppDataSource.destroy();
}

main().catch(async err => {
  console.error('seed-prod-demo failed:', err.message ?? err);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});