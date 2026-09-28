// CSRF-aware API seeder for the k6 suite. Creates deterministic demo data:
// N intakes (varied barangays/incomes) + one intervention per case.
const API = process.env.API_BASE || 'http://localhost:3100/api/v1';
const CASES = Number(process.env.SEED_CASES || 25);
const ADMIN = { email: 'admin@mswdo.test', password: 'admin123' };

const BARANGAYS = ['Bigte', 'Poblacion', 'Matictic', 'Partida', 'San Mateo'];
const SERVICES = [
  { name: 'Medical Assistance', amount: 3500, fundSource: 'LGU - Municipal' },
  { name: 'Food Assistance', amount: 1200, fundSource: 'DSWD - AICS' },
  { name: 'Educational Assistance', amount: 5000, fundSource: 'LGU - Municipal' },
  { name: 'Burial Assistance', amount: 8000, fundSource: 'DSWD - AICS' },
];

let csrf = '';
let cookie = '';

function rememberCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const pair = c.split(';')[0];
    if (pair.startsWith('csrf-token=')) {
      cookie = pair;
      csrf = pair.split('=')[1] || '';
    }
  }
}

function headers(token, json = true) {
  const h = { Cookie: cookie, 'X-CSRF-Token': csrf };
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function jsonFetch(path, options) {
  const res = await fetch(`${API}${path}`, options);
  rememberCookies(res);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

function intakePayload(i) {
  const suffix = String(i).padStart(3, '0');
  const barangay = BARANGAYS[i % BARANGAYS.length];
  const income = 3000 + (i % 12) * 1500;
  const address = { street: 'Purok 1', barangay, city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' };
  return {
    beneficiary: {
      surname: `PerfSeed${suffix}`, firstName: 'Load',
      gender: i % 2 ? 'Female' : 'Male', dob: '1988-04-12', civilStatus: 'Married',
      placeOfBirth: 'Norzagaray, Bulacan',
      cellularNumber: `0917000${String(1000 + i)}`,
      email: `perfseed${suffix}@demo.test`,
      currentAddress: address,
      occupation: 'Farmer', estimatedMonthlyIncome: income,
    },
    claimant: {
      surname: `PerfSeedC${suffix}`, firstName: 'Load',
      gender: 'Female', dob: '1990-02-02', civilStatus: 'Married',
      placeOfBirth: 'Norzagaray, Bulacan',
      cellularNumber: `0917111${String(1000 + i)}`,
      email: `perfseedc${suffix}@demo.test`,
      currentAddress: address,
      relationshipToBeneficiary: 'Spouse',
      occupation: 'Homemaker', estimatedMonthlyIncome: 0,
    },
    familyMembers: [
      { surname: `PerfSeed${suffix}`, firstName: 'Child', gender: 'Male', dob: '2016-07-01', age: 9, relationship: 'Child', occupation: 'Student' },
    ],
    case: {},
  };
}

async function main() {
  const health = await jsonFetch('/health', { method: 'GET' });
  if (health.status !== 200) throw new Error(`health ${health.status}`);

  const login = await jsonFetch('/auth/login', { method: 'POST', headers: headers(undefined), body: JSON.stringify(ADMIN) });
  if (login.status !== 200) throw new Error(`login ${login.status}: ${JSON.stringify(login.body).slice(0, 200)}`);
  const token = login.body.accessToken;

  let cases = 0;
  let interventions = 0;
  for (let i = 0; i < CASES; i++) {
    const created = await jsonFetch('/intake', { method: 'POST', headers: headers(token), body: JSON.stringify(intakePayload(i)) });
    if (created.status !== 200 && created.status !== 201) {
      throw new Error(`intake ${i} -> ${created.status}: ${JSON.stringify(created.body).slice(0, 200)}`);
    }
    cases++;
    const caseId = created.body?.caseId;
    if (!caseId) continue;
    const svc = SERVICES[i % SERVICES.length];
    const deliveryDate = new Date(Date.now() - (i % 60) * 86400000).toISOString().slice(0, 10);
    const iv = await jsonFetch(`/cases/${caseId}/interventions`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ serviceName: svc.name, category: 'perf-seed', deliveryDate, amount: svc.amount, fundSource: svc.fundSource }),
    });
    if (iv.status === 200 || iv.status === 201) interventions++;
    else console.warn(`  WARN intervention ${i} -> ${iv.status}: ${JSON.stringify(iv.body).slice(0, 160)}`);
  }

  console.log(`seed-data: cases=${cases} interventions=${interventions} (target ${CASES})`);
  if (cases !== CASES) process.exit(1);
}

main().catch(err => {
  console.error('seed-data failed:', err.message);
  process.exit(1);
});
