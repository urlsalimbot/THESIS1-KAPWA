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
  if (r.status >= 400) console.warn(`  WARN ${label || method} ${path} -> ${r.status}: ${String(text).slice(0, 400)}`);
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
  { surname: 'Reyes', firstName: 'Pedro', middleName: 'P', gender: 'Male', dob: '1988-03-21', phone: '09171000005', address: 'Bigte, Norzagaray', philsysNumber: '8234-5678-9012', stage: 'active', occupation: 'Tricycle Driver', civilStatus: 'Married', placeOfBirth: 'Norzagaray, Bulacan', estimatedMonthlyIncome: 7000, philhealthNumber: '08-234567890-8', category: 'Indigent' },
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
    { serviceName: 'Cash Assistance', category: 'FA', deliveryDate: '2026-08-05', amount: 3000, modeOfDelivery: 'Cash', fundSource: 'AICS', notes: 'Tricycle driver livelihood support', deliveredBy: 'MSWDO' },
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
  'Reyes': { surname: 'Reyes', firstName: 'Alma', middleName: 'D', gender: 'Female', dob: '1990-11-05', relationship: 'Spouse' },
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

  const cases: { caseId: string; stage: string; benId: string; personId?: string; name: string }[] = [];
  for (const p of people) {
    // Idempotency check via the DB, not the API — search responses mask phone
    // (PII), so the API-based check never matched on re-runs and duplicated
    // beneficiaries for the same person.
    const dup = await AppDataSource.query(
      `SELECT b.id FROM beneficiaries b JOIN persons p ON p.id = b.person_id
       LEFT JOIN person_contacts pc ON pc.person_id = p.id AND pc.contact_type = 'phone'
       WHERE p.surname = $1 AND pc.value = $2 LIMIT 1`,
      [p.surname, p.phone],
    );
    if (dup[0]?.id) {
      console.log(`skip ${p.firstName} ${p.surname} (already exists)`);
      continue;
    }

    // Enroll through the REAL intake endpoint so the demo exercises the
    // actual flow — including the auto-generated household access card
    // (intake.service submitIntake → ensureHouseholdCard).
    const barangay = p.address.split(',')[0].trim();
    const personInput = {
      surname: p.surname, firstName: p.firstName, middleName: p.middleName,
      gender: p.gender, dob: p.dob, placeOfBirth: p.placeOfBirth, civilStatus: p.civilStatus,
      cellularNumber: p.phone, email: `${p.firstName.toLowerCase()}.${p.surname.toLowerCase().replace(/\s+/g, '')}@demo.test`,
      currentAddress: { street: p.address, barangay, city: 'Norzagaray', province: 'Bulacan', region: 'Region III (Central Luzon)', postalCode: '3013' },
      philhealthNumber: p.philhealthNumber, occupation: p.occupation, estimatedMonthlyIncome: p.estimatedMonthlyIncome,
    };
    const fam = FAMILY[p.surname];
    const intake = await call(worker, 'POST', '/intake', {
      beneficiary: personInput,
      claimant: { ...personInput, relationshipToBeneficiary: 'Self' },
      familyMembers: fam ? [fam] : [],
      case: { serviceRequested: SERVICES[p.stage], assignedWorkerId: workerId },
    }, 'intake');
    if (intake.status >= 400) { console.log(`intake ${p.firstName} FAILED ${intake.status}`); continue; }
    const caseId = intake.json.caseId;
    const benId = intake.json.beneficiaryId;
    const personRow = await AppDataSource.query(
      `SELECT person_id FROM beneficiaries WHERE id = $1`,
      [benId],
    );
    const personId = personRow[0]?.person_id;
    console.log(`intake enrolled ${p.firstName} ${p.surname} (${caseId.slice(0, 8)}) stage=${p.stage} — access card auto-generated`);

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

    cases.push({ caseId, stage: p.stage, benId, personId, name: `${p.firstName} ${p.surname}` });
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

  // Access cards were AUTO-GENERATED at enrollment (intake →
  // ensureHouseholdCard, US-040). Now give the active card the full
  // six-category service ledger (case_service/referral/community_service/
  // seminar/payout/compliance per US-041) so the ledger, QuickScan (US-042),
  // agency summaries (US-043) and the printable card (US-044) have demo data.
  const active = cases.find(c => c.stage === 'active');
  if (active) {
    const cardInfo = await call(admin, 'GET', `/access-cards/beneficiary/${active.benId}/card`);
    const code = cardInfo.json?.code;
    if (code) {
      const ag = await call(admin, 'GET', '/agencies');
      const agencies = (Array.isArray(ag.json) ? ag.json : []) as { id: string; code: string }[];
      const rhu = agencies.find(a => a.code === 'RHU');
      const dswd = agencies.find(a => a.code === 'DSWD');
      const existingServices = cardInfo.json?.services || [];
      const ledger = [
        { accessCardCode: code, serviceRendered: 'Case service — medical assistance follow-up', serviceDate: '2026-08-01', cost: 1500, category: 'case_service' },
        { accessCardCode: code, serviceRendered: 'RHU referral — specialist consultation', serviceDate: '2026-08-03', cost: 0, category: 'referral', agencyId: rhu?.id },
        { accessCardCode: code, serviceRendered: 'Community outreach — health caravan assistance', serviceDate: '2026-08-10', cost: 500, category: 'community_service' },
        { accessCardCode: code, serviceRendered: 'Seminar — Family Development Session', serviceDate: '2026-08-12', cost: 0, category: 'seminar' },
        { accessCardCode: code, serviceRendered: '4Ps payout — August cycle', serviceDate: '2026-08-15', cost: 2400, category: 'payout', agencyId: dswd?.id },
        { accessCardCode: code, serviceRendered: 'Compliance — health center checkup checkoff', serviceDate: '2026-08-20', cost: 0, category: 'compliance' },
      ];
      // Skip only if the manual six-category demo entries already landed
      // (auto-logged case_service entries from interventions are expected).
      if (!existingServices.some((s: any) => s.category === 'payout')) {
        for (const entry of ledger) {
          const r = await call(admin, 'POST', '/access-cards/log', entry, `card-log-${entry.category}`);
          if (r.status >= 400) console.warn(`  WARN card log ${entry.category}: ${r.status}`);
        }
        console.log('access card ledger:', ledger.length, 'entries for', code);
      } else {
        console.log('access card ledger already has', existingServices.length, 'entries for', code);
      }
    }
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

  // IRF for the active case (narration encrypted via pgcrypto) — powers the
  // WCPD/PNP export and the password-protected PDF demo.
  const irfCase = cases.find(c => c.stage === 'active');
  if (irfCase) {
    const existingIrfs = await call(worker, 'GET', `/irf/by-case/${irfCase.caseId}`);
    const irfList = Array.isArray(existingIrfs.json) ? existingIrfs.json : (existingIrfs.json?.data || []);
    if (irfList.length > 0) {
      console.log('IRF already exists for', irfCase.name);
    } else {
      const irf = await call(worker, 'POST', '/irf', {
      caseCategory: 'Abuse',
      datetimeReported: '2026-08-14T09:30:00+08:00',
      datetimeIncident: '2026-08-13T19:00:00+08:00',
      caseId: irfCase.caseId,
      itemAReportingPerson: { name: 'Maria L. Santos', relation: 'Self (victim)', address: 'Bigte, Norzagaray', phone: '09171234002' },
      itemBPersonReported: { name: 'Unknown Male', alias: 'Kapitbahay', address: 'Bigte, Norzagaray' },
      narration: 'Victim reported being threatened by a neighbor during an altercation at the barangay hall. Case documented for Women and Children Protection Desk coordination.',
      msdwSignatureUrl: '',
      reportingSignatureUrl: '',
    }, 'irf');
      if (irf.status < 400) console.log('IRF created for', irfCase.name, `(${String(irf.json?.id || '').slice(0, 8)})`);
      else console.warn(`  WARN IRF create: ${irf.status}`);
    }
  }

  // Renewal case (US-026): the closed Dela Cruz case gets a new cycle case
  // linked via renewal_of_case_id (4Ps-style recurring assistance).
  const closed = cases.find(c => c.stage === 'closed');
  if (closed) {
    const existingRenewal = await AppDataSource.query(
      `SELECT id FROM cases WHERE renewal_of_case_id = $1 LIMIT 1`,
      [closed.caseId],
    );
    if (existingRenewal[0]?.id) {
      console.log('renewal case already linked');
    } else {
    const renewed = await call(worker, 'POST', '/cases', {
      beneficiaryId: closed.benId,
      serviceRequested: ['Financial Assistance'],
      assignedWorkerId: workerId,
    }, 'renewal-case');
    if (renewed.status < 400) {
      await AppDataSource.query(
        `UPDATE cases SET renewal_of_case_id = $1 WHERE id = $2`,
        [closed.caseId, renewed.json.id],
      );
      console.log('renewal case linked:', String(renewed.json.id).slice(0, 8), '->', closed.caseId.slice(0, 8));
    } else {
      console.warn(`  WARN renewal case: ${renewed.status}`);
    }
    }
  }

  // Coordinator barangay referral (referrals module — coordinator-only POST).
  const refCase = cases.find(c => c.stage === 'active');
  if (refCase?.personId) {
    const existingRef = await AppDataSource.query(
      `SELECT id FROM referrals WHERE person_id = $1 LIMIT 1`,
      [refCase.personId],
    );
    if (existingRef[0]?.id) {
      console.log('coordinator referral already exists for', refCase.name);
    } else {
      const coor = await login('coordinator.bigte@mswdo.test', 'coordinator123');
      const r = await call(coor, 'POST', '/referrals', {
        personId: refCase.personId,
        reason: 'Requesting MSWDO assessment for financial assistance (barangay referral)',
      }, 'coordinator-referral');
      if (r.status < 400) console.log('coordinator referral sent for', refCase.name);
      else console.warn(`  WARN coordinator referral: ${r.status}`);
    }
  }

  // Claimant person links (US-002/US-003): claimant accounts see their cases
  // on /my-dashboard — pedro → Reyes case, ana → Fernandez case. The linkage
  // is three-fold: users.person_id (person-link verification), beneficiaries.
  // user_id (how getMyServices resolves the claimant's record) and a
  // beneficiary_claimants row (access-card view + consent flows).
  const links: [string, string, string][] = [
    ['pedro.claimant@test.com', 'Reyes', 'Pedro'],
    ['ana.claimant@test.com', 'Fernandez', 'Liza'],
  ];
  for (const [email, surname, firstName] of links) {
    const person = await AppDataSource.query(
      `SELECT p.id FROM persons p JOIN beneficiaries b ON b.person_id = p.id
       WHERE p.surname = $1 AND p.first_name = $2 LIMIT 1`,
      [surname, firstName],
    );
    if (person[0]?.id) {
      const user = await AppDataSource.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );
      const userId = user[0]?.id;
      await AppDataSource.query(
        `UPDATE users SET person_id = $2, person_link_code = NULL WHERE email = $1`,
        [email, person[0].id],
      );
      if (userId) {
        await AppDataSource.query(
          `UPDATE beneficiaries SET user_id = $2 WHERE person_id = $1`,
          [person[0].id, userId],
        );
        // beneficiary_claimants links person → person (claimant_id is a person,
        // not a user) — self-claimed beneficiaries link their own person.
        await AppDataSource.query(
          `INSERT INTO beneficiary_claimants (beneficiary_id, claimant_id, relationship, is_primary, calendar_year)
           SELECT $1, $1, 'Self', true, EXTRACT(YEAR FROM NOW())
           WHERE NOT EXISTS (SELECT 1 FROM beneficiary_claimants WHERE beneficiary_id = $1 AND claimant_id = $1)`,
          [person[0].id],
        );
      }
      console.log('linked claimant', email, '->', `${firstName} ${surname}`);
    } else {
      console.warn(`  WARN no person matched for ${firstName} ${surname}`);
    }
  }

  await AppDataSource.destroy();

  console.log('\n=== DONE ===');
  console.log('cases created:', cases.length);
  for (const c of cases) console.log(`  ${c.stage.padEnd(13)} ${c.name} (${c.caseId.slice(0, 8)})`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
