import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PROFILE, profileConfig, ACCOUNTS } from './config.js';
import { login, authHeaders } from './lib/auth.js';
import { get, getAllow422, think } from './lib/requests.js';

const thresholds = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
};
if (PROFILE !== 'smoke') {
  thresholds['http_req_duration{scenario:reads}'] = ['p(95)<500'];
}

export const options = {
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
