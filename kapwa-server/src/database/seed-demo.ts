/**
 * Demo data seeder — populates realistic MSWDO Norzagaray data for demos.
 *
 * Drives the real HTTP API so hash chains and audit trails stay valid, and
 * writes household/family composition directly to the DB (no API endpoint
 * exists for households) so the family-composition view is populated.
 * Idempotent: skips beneficiaries whose phone already exists.
 *
 * Run (inside the api container): node dist/database/seed-demo.js
 *   or from the repo: npm run seed:demo
 */
import { AppDataSource } from './data-source';

const API = process.env.API_BASE || 'http://localhost:3000/api/v1';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).accessToken;
}

async function call(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  label = '',
): Promise<{ status: number; json: any }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (r.status >= 400) console.warn(`  WARN ${label || method} ${path} -> ${r.status}: ${String(text).slice(0, 90)}`);
  return { status: r.status, json };
}

interface Person {
  surname: string; firstName: string; middleName: string; gender: string; dob: string;
  phone: string; address: string; philsysNumber: string; stage: string;
  occupation: string; civilStatus: string; placeOfBirth: string;
  estimatedMonthlyIncome: number; philhealthNumber: string; category: string;
}

const people: Person[] = [
  { surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M', gender: 'Male', dob: '1952-03-14', phone: '09171234001', address: 'Poblacion, Norzagaray', philsysNumber: '1234-5678-9012', stage: 'closed', occupation: 'Retired', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 0, philhealthNumber: '01-234567890-1', category: 'Senior Citizen' },
  { surname: 'Santos', firstName: 'Maria', middleName: 'L', gender: 'Female', dob: '1985-07-22', phone: '09171234002', address: 'Bigte, Norzagaray', philsysNumber: '2234-5678-9012', stage: 'active', occupation: 'Street Vendor', civilStatus: 'Widowed', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 4500, philhealthNumber: '02-234567890-2', category: 'Person with Disability' },
  { surname: 'Ramos', firstName: 'Pedro', middleName: 'S', gender: 'Male', dob: '1978-01-09', phone: '09171234003', address: 'Matictic, Norzagaray', philsysNumber: '3234-5678-9012', stage: 'in_review', occupation: 'Construction Worker', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 6500, philhealthNumber: '03-234567890-3', category: 'Indigent' },
  { surname: 'Villanueva', firstName: 'Ana', middleName: 'C', gender: 'Female', dob: '1990-11-30', phone: '09171234004', address: 'Partida, Norzagaray', philsysNumber: '4234-5678-9012', stage: 'active', occupation: 'Housewife', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 0, philhealthNumber: '04-234567890-4', category: 'Person with Disability' },
  { surname: 'Mendoza', firstName: 'Rosa', middleName: 'P', gender: 'Female', dob: '1948-05-02', phone: '09171234005', address: 'Poblacion, Norzagaray', philsysNumber: '5234-5678-9012', stage: 'transitioning', occupation: 'Retired', civilStatus: 'Widowed', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 0, philhealthNumber: '05-234567890-5', category: 'Senior Citizen' },
  { surname: 'Garcia', firstName: 'Jose', middleName: 'D', gender: 'Male', dob: '1965-09-18', phone: '09171234006', address: 'San Mateo, Norzagaray', philsysNumber: '6234-5678-9012', stage: 'enrolled', occupation: 'Farmer', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 5000, philhealthNumber: '06-234567890-6', category: 'Indigent' },
  { surname: 'Fernandez', firstName: 'Liza', middleName: 'R', gender: 'Female', dob: '1982-02-25', phone: '09171234007', address: 'FVR, Norzagaray', philsysNumber: '7234-5678-9012', stage: 'assessed', occupation: 'Sari-sari Store Owner', civilStatus: 'Single', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 8000, philhealthNumber: '07-234567890-7', category: 'Family Head and Other Needy Adult' },
];

const CATEGORIES: Record<string, string> = {
  closed: 'Senior Citizen',
  active: 'Person with Disability',
  in_review: 'Indigent',
  transitioning: 'Senior Citizen',
  enrolled: 'Indigent',
  assessed: 'Family Head and Other Needy Adult',
};

const SERVICES: Record<string, string[]> = {
  closed: ['Financial Assistance', 'Medical Assistance'],
  active: ['Assistive Devices', 'Medical Assistance'],
  in_review: ['Cash Assistance'],
  transitioning: ['Financial Assistance'],
  enrolled: ['Emergency Assistance'],
  assessed: ['Livelihood Assistance'],
};

const ASSESSMENT = {
  problemsPresented: 'Client presented with financial difficulties and limited income sources.',
  socialWorkerAssessment: 'Household income below poverty threshold; eligible for assistance.',
  frvaScore: 42,
  swdiScore: 35,
  natureOfService: ['Financial Assistance'],
  amountAssistance: 3000,
  modeFinancialAssistance: 'Cash',
  sourceOfFund: 'AICS',
  interviewedBy: 'Maria Clara Santos',
};

const INTERVENTIONS: Record<string, Record<string, unknown>[]> = {
  active: [
    { serviceName: 'Medical Assistance', category: 'FA', deliveryDate: '2026-07-10', amount: 2500, modeOfDelivery: 'Cash', fundSource: 'AICS', notes: 'Hospital bill support', deliveredBy: 'MSWDO' },
    { serviceName: 'Assistive Devices', category: 'HV', deliveryDate: '2026-07-25', amount: 0, modeOfDelivery: 'In-kind', fundSource: 'LGU', notes: 'Wheelchair issued', deliveredBy: 'MSWDO' },
  ],
  transitioning: [
    { serviceName: 'Financial Assistance', category: 'FA', deliveryDate: '2026-06-15', amount: 4500, modeOfDelivery: 'Cash', fundSource: 'AICS', notes: 'Monthly assistance', deliveredBy: 'MSWDO' },
  ],
  closed: [
    { serviceName: 'Financial Assistance', category: 'FA', deliveryDate: '2026-03-05', amount: 5000, modeOfDelivery: 'Cash', fundSource: 'AICS', notes: 'Regular assistance cycle', deliveredBy: 'MSWDO' },
    { serviceName: 'Medical Assistance', category: 'FA', deliveryDate: '2026-04-12', amount: 3000, modeOfDelivery: 'Cash', fundSource: 'LGU', notes: 'Follow-up checkup', deliveredBy: 'MSWDO' },
  ],
};

const TRANSITION = { selfRelianceLevel: 3, sustainabilityPlan: 'Small sari-sari store livelihood' };
const CLOSURE = { closureOutcome: 'graduated', clientSignature: 'Juan M. Dela Cruz', closureDate: '2026-07-30', exitNotes: 'Family achieved self-reliance target' };

// One genuine household member per family (spouse/child) so the family
// composition view is populated without duplicating the primary beneficiary.
const FAMILY: Record<string, { surname: string; firstName: string; middleName: string; gender: string; dob: string; relationship: string }> = {
  'Dela Cruz': { surname: 'Dela Cruz', firstName: 'Elena', middleName: 'R', gender: 'Female', dob: '1956-08-11', relationship: 'Spouse' },
  'Santos': { surname: 'Santos', firstName: 'Ramon', middleName: 'C', gender: 'Male', dob: '1982-02-02', relationship: 'Spouse' },
  'Ramos': { surname: 'Ramos', firstName: 'Luz', middleName: 'M', gender: 'Female', dob: '1980-06-19', relationship: 'Spouse' },
  'Villanueva': { surname: 'Villanueva', firstName: 'Carlos', middleName: 'B', gender: 'Male', dob: '1988-03-25', relationship: 'Spouse' },
  'Mendoza': { surname: 'Mendoza', firstName: 'Carla', middleName: 'S', gender: 'Female', dob: '1972-12-05', relationship: 'Child' },
  'Garcia': { surname: 'Garcia', firstName: 'Nenita', middleName: 'V', gender: 'Female', dob: '1967-04-14', relationship: 'Spouse' },
  'Fernandez': { surname: 'Fernandez', firstName: 'Mico', middleName: 'T', gender: 'Male', dob: '2008-09-30', relationship: 'Child' },
};

// Map an intervention service name to a seeded program id (exact match first,
// then first-token substring match), so case_interventions.program_id is linked.
function programIdFor(programs: any[], serviceName: string): string | null {
  const exact = programs.find((p: any) => p.name.toLowerCase() === serviceName.toLowerCase());
  if (exact) return exact.id;
  const token = serviceName.split(' ')[0].toLowerCase();
  const fuzzy = programs.find((p: any) => p.name.toLowerCase().includes(token));
  if (fuzzy) return fuzzy.id;
  return null;
}

async function main(): Promise<void> {
  const worker = await login('worker1@mswdo.test', 'worker123');
  const admin = await login('admin@mswdo.test', 'admin123');
  console.log('logged in: worker + admin');

  // Assigned worker for seeded cases + program map for intervention linkage.
  const me = await call(worker, 'GET', '/auth/me');
  const workerId = me.json?.user?.id || me.json?.id;
  const programsResp = await call(admin, 'GET', '/programs?limit=50');
  const programs = (Array.isArray(programsResp.json) ? programsResp.json : (programsResp.json?.items || programsResp.json?.data || [])) as any[];

  await AppDataSource.initialize();

  const cases: { caseId: string; stage: string; benId: string; name: string }[] = [];
  for (const p of people) {
    const dup = await call(admin, 'GET', `/beneficiaries?search=${encodeURIComponent(p.surname)}&limit=5`);
    const dupList = Array.isArray(dup.json) ? dup.json : (dup.json?.data || []);
    if (dupList.some((b: any) => String(b.phone || '') === p.phone)) {
      console.log(`skip ${p.firstName} ${p.surname} (already exists)`);
      continue;
    }

    const ben = await call(worker, 'POST', '/beneficiaries', {
      surname: p.surname, firstName: p.firstName, middleName: p.middleName,
      gender: p.gender, dob: p.dob, address: p.address, phone: p.phone, philsysNumber: p.philsysNumber,
      occupation: p.occupation, civilStatus: p.civilStatus, placeOfBirth: p.placeOfBirth,
      estimatedMonthlyIncome: p.estimatedMonthlyIncome, philhealthNumber: p.philhealthNumber,
      category: p.category,
    }, 'beneficiary');
    if (ben.status >= 400) { console.log(`beneficiary ${p.firstName} FAILED ${ben.status}`); continue; }
    const benId = ben.json.id;
    console.log(`created beneficiary ${p.firstName} ${p.surname} (${benId.slice(0, 8)})`);

    const c = await call(worker, 'POST', '/cases', { beneficiaryId: benId, serviceRequested: SERVICES[p.stage], assignedWorkerId: workerId }, 'case');
    if (c.status >= 400) { console.log(`case for ${p.firstName} FAILED ${c.status}`); continue; }
    const caseId = c.json.id;
    console.log(`  case ${caseId.slice(0, 8)} stage=${p.stage}`);

    if (['assessed', 'in_review', 'active', 'transitioning', 'closed'].includes(p.stage)) {
      await call(worker, 'PATCH', `/cases/${caseId}/assessment`, { ...ASSESSMENT, clientCategory: CATEGORIES[p.stage] }, 'assessment');
      await call(worker, 'PATCH', `/cases/${caseId}/request-review`, undefined, 'request-review');
    } else if (p.stage === 'enrolled') {
      // enrolled: assessment only (no review) so the case stays enrolled but
      // still carries client_category + interviewed_by.
      await call(worker, 'PATCH', `/cases/${caseId}/assessment`, { ...ASSESSMENT, clientCategory: CATEGORIES[p.stage] }, 'assessment');
    }
    if (['in_review', 'active', 'transitioning', 'closed'].includes(p.stage)) {
      await call(worker, 'PATCH', `/cases/${caseId}/status`, { status: 'in_review' }, 'to-in_review');
    }
    if (['active', 'transitioning', 'closed'].includes(p.stage)) {
      // interventions must be logged BEFORE activation (FSM enforces this)
      for (const iv of INTERVENTIONS[p.stage]) {
        const programId = programIdFor(programs, String(iv.serviceName));
        if (!programId) console.warn(`  WARN no program matched for intervention '${iv.serviceName}'`);
        await call(worker, 'POST', `/cases/${caseId}/interventions`, { ...iv, programId }, 'intervention');
      }
      await call(admin, 'PATCH', `/cases/${caseId}/approve`, { status: 'active', signature: 'Admin Approval' }, 'approve');
    }
    if (['transitioning', 'closed'].includes(p.stage)) {
      await call(admin, 'PATCH', `/cases/${caseId}/transition-plan`, TRANSITION, 'transition-plan');
      await call(admin, 'PATCH', `/cases/${caseId}/disburse`, { status: 'transitioning' }, 'disburse');
    }
    if (p.stage === 'closed') {
      await call(admin, 'PATCH', `/cases/${caseId}/closure`, CLOSURE, 'closure');
      await call(admin, 'PATCH', `/cases/${caseId}/close`, undefined, 'close');
    }

    // Household + family composition (direct DB write — no household API).
    const barangay = p.address.split(',')[0].trim();
    const hh = await AppDataSource.query(
      `INSERT INTO households (primary_beneficiary_id, barangay, estimated_income, verified_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [benId, barangay, p.estimatedMonthlyIncome, 'MSWDO Social Worker'],
    );
    const householdId = hh[0]?.id;
    // One real family member per household (primary is linked via
    // beneficiaries.household_id / households.primary_beneficiary_id and is
    // surfaced as the "primary" node by getFamilyGraph — no Self membership
    // row, which would duplicate the primary in the composition view).
    const fam = FAMILY[p.surname];
    if (fam) {
      const m = await AppDataSource.query(
        `INSERT INTO persons (surname, first_name, middle_name, gender, dob)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [fam.surname, fam.firstName, fam.middleName, fam.gender, fam.dob],
      );
      await AppDataSource.query(
        `INSERT INTO household_memberships (person_id, household_id, relationship, is_primary, status)
         VALUES ($1, $2, $3, false, 'active')`,
        [m[0].id, householdId, fam.relationship],
      );
    }
    await AppDataSource.query(
      `UPDATE beneficiaries SET household_id = $1 WHERE id = $2`,
      [householdId, benId],
    );
    // Structured address fields (barangay/city/province) — the API only
    // accepts a raw address string, so decompose it here.
    await AppDataSource.query(
      `UPDATE person_addresses SET barangay = $1, city = 'Norzagaray', province = 'Bulacan'
       WHERE person_id = $2 AND address_type = 'current'`,
      [barangay, ben.json.personId],
    );

    cases.push({ caseId, stage: p.stage, benId, name: `${p.firstName} ${p.surname}` });
    await sleep(150);
  }

  // Announcements (published + draft)
  await call(admin, 'POST', '/announcements', {
    title: 'MSWDO Norzagaray Schedule for August 2026',
    excerpt: 'Regular payout schedule for AICS beneficiaries.',
    bodyHtml: '<p>Ang MSWDO Norzagaray ay magsasagawa ng <strong>regular payout</strong> para sa mga benepisyaryo ng AICS sa mga sumusunod na petsa:</p><ul><li>August 15 — Poblacion at Bigte</li><li>August 22 — Matictic at Partida</li></ul>',
    status: 'published',
  }, 'announcement');
  await call(admin, 'POST', '/announcements', {
    title: 'Upcoming: Community Outreach Program',
    excerpt: 'Draft announcement for community outreach.',
    bodyHtml: '<p>Details coming soon.</p>',
    status: 'draft',
  }, 'announcement');

  // Access card for the active PWD case
  const active = cases.find(c => c.stage === 'active');
  if (active) {
    const card = await call(admin, 'POST', `/access-cards/assign/${active.benId}`, undefined, 'card-assign');
    console.log('access card assign:', card.status);
  }

  // Inter-agency referral (admin → RHU) for the in_review case
  const ref = cases.find(c => c.stage === 'in_review');
  if (ref) {
    const ag = await call(admin, 'GET', '/agencies');
    const rhu = (ag.json || []).find((a: any) => a.code === 'RHU');
    if (rhu) {
      const r = await call(admin, 'POST', '/inter-agency-referrals', {
        beneficiaryId: ref.benId, caseId: ref.caseId, toAgencyId: rhu.id,
        reason: 'Medical follow-up and specialist consultation', legalBasisCode: 'RA 10754',
      }, 'referral');
      console.log('inter-agency referral:', r.status);
    }
  }

  await AppDataSource.destroy();

  console.log('\n=== DONE ===');
  console.log('cases created:', cases.length);
  for (const c of cases) console.log(`  ${c.stage.padEnd(13)} ${c.name} (${c.caseId.slice(0, 8)})`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
