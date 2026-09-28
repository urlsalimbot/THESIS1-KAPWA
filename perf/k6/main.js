import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, PROFILE, profileConfig, ACCOUNTS } from './config.js';
import { login, authHeaders } from './lib/auth.js';

export const options = {
  scenarios: profileConfig(PROFILE),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
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
