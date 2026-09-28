import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, PROFILE, profileConfig, ACCOUNTS, UPLOAD, RESULTS_DIR } from './config.js';
import { login, authHeaders, csrfToken } from './lib/auth.js';
import { get, getAllow422, postJson, think } from './lib/requests.js';
import { renderHtml } from './lib/summary.js';

// Directly measured per-scenario iteration counts (k6's summary folds all
// `iterations` samples together, so scenario counts need explicit counters).
const readsIterations = new Counter('reads_iterations');
const writesIterations = new Counter('writes_iterations');

const thresholds = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  // Smoke failures abort the whole run: a broken auth/health path must not be
  // averaged away by the load stages.
  'checks{scenario:smoke}': [{ threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '2s' }],
};
if (PROFILE !== 'smoke') {
  thresholds['http_req_duration{scenario:reads}'] = ['p(95)<500'];
  thresholds['http_req_duration{scenario:writes}'] = ['p(95)<1500'];
}

// k6 v2 only allows open() in the init context; load the upload fixture here
// (path resolves relative to this script) so the writes VU can reuse it.
const samplePdf = UPLOAD ? open('./assets/sample.pdf', 'b') : null;

export const options = {
  // Keep each VU's cookie jar across iterations so the CSRF bootstrap happens
  // once per VU instead of once per iteration.
  noCookiesReset: true,
  scenarios: profileConfig(PROFILE),
  thresholds,
};

export function setup() {
  const admin = login(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  const worker = login(ACCOUNTS.worker.email, ACCOUNTS.worker.password);
  return { admin, worker };
}

export function smoke(data) {
  const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(health, {
    'health 200': r => r.status === 200,
    'health db connected': r => r.json('db') === 'connected',
  });

  const me = http.get(`${BASE_URL}/auth/me`, { headers: authHeaders(data.admin.accessToken), tags: { endpoint: 'auth-me' } });
  check(me, { 'auth/me 200': r => r.status === 200 });
}

export function reads(data) {
  readsIterations.add(1);
  const token = data.worker.accessToken;

  get('/dashboard/metrics', token);
  get('/dashboard/trends?range=6m', token);

  const cases = get('/cases?page=1&limit=10', token);
  if (cases.status === 200) {
    const body = cases.json();
    const first = Array.isArray(body) ? body[0] : body?.data?.[0];
    if (first?.id) get(`/cases/${first.id}`, token);
  }
  get('/cases?search=dela', token);

  get('/beneficiaries?page=1&limit=10', token);
  get('/beneficiaries?search=dela', token);

  getAllow422('/analytics/demographics', token);
  getAllow422('/analytics/concentration', token);
  getAllow422('/analytics/equity', token);
  getAllow422('/analytics/inequality', token);
  get('/analytics/clustering/runs', token);

  think();
}

export function writes(data) {
  writesIterations.add(1);
  const token = data.worker.accessToken;
  const suffix = `${__VU}-${__ITER}-${Date.now()}`;
  const address = { street: '123 Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '03', postalCode: '3012' };
  const digits = String((__VU * 1000 + __ITER) % 10000000).padStart(7, '0');
  const payload = {
    beneficiary: {
      surname: `Perf${suffix}`,
      firstName: 'Load',
      gender: 'Male',
      dob: '1990-05-15',
      placeOfBirth: 'Norzagaray, Bulacan',
      civilStatus: 'Married',
      cellularNumber: `0917${digits}`,
      email: `perf-${suffix}@example.test`,
      currentAddress: address,
      occupation: 'Farmer',
      estimatedMonthlyIncome: 8000,
    },
    claimant: {
      surname: `PerfClaim${suffix}`,
      firstName: 'Load',
      gender: 'Female',
      dob: '1992-08-20',
      placeOfBirth: 'Norzagaray, Bulacan',
      civilStatus: 'Married',
      cellularNumber: `0918${digits}`,
      email: `perf-claim-${suffix}@example.test`,
      currentAddress: address,
      occupation: 'Housewife',
      estimatedMonthlyIncome: 1000,
      relationshipToBeneficiary: 'Spouse',
    },
    familyMembers: [],
    case: {},
  };

  const res = postJson('/intake', token, payload);
  const ok = check(res, {
    'intake 200/201': r => r.status === 200 || r.status === 201,
    'intake has caseId': r => { try { return Boolean(r.json('caseId')); } catch { return false; } },
  });

  if (ok && UPLOAD) {
    const caseId = res.json('caseId');
    if (caseId) {
      const file = http.file(samplePdf, 'perf-sample.pdf', 'application/pdf');
      const upload = http.post(`${BASE_URL}/filing/upload`, { caseId, category: 'perf', file }, {
        headers: { Authorization: `Bearer ${token}`, [ 'X-CSRF-Token' ]: csrfToken() },
        tags: { endpoint: 'filing-upload' },
      });
      check(upload, { 'upload 200/201': r => r.status === 200 || r.status === 201 });
    }
  }

  think(1, 2);
}

export function handleSummary(data) {
  return {
    [`${RESULTS_DIR}/summary.json`]: JSON.stringify(data, null, 2),
    [`${RESULTS_DIR}/summary.html`]: renderHtml(data),
  };
}
