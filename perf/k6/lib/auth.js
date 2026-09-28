import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config.js';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'X-CSRF-Token';

export function csrfToken() {
  const cookies = http.cookieJar().cookiesForURL(BASE_URL);
  const value = cookies[CSRF_COOKIE];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function bootstrapCsrf() {
  const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(res, { 'health 200': r => r.status === 200 });
  return res;
}

export function login(email, password) {
  bootstrapCsrf();
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken() },
    tags: { endpoint: 'auth-login' },
  });
  const ok = check(res, { 'login 200': r => r.status === 200 });
  if (!ok) return { accessToken: '', refreshToken: '' };
  const body = res.json();
  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}

export function ensureCsrf() {
  if (!csrfToken()) bootstrapCsrf();
}

export function authHeaders(token) {
  ensureCsrf();
  return {
    Authorization: `Bearer ${token}`,
    [CSRF_HEADER]: csrfToken(),
    'Content-Type': 'application/json',
  };
}
