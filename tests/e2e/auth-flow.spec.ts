import { test, expect } from '@playwright/test';

const COMPOSE_FILE = 'kapwa-server/docker-compose.yml';
const BASE = 'http://localhost:3001';

interface PodmanService {
  Name?: string;
  Service?: string;
  Status?: string;
  Health?: string;
  State?: string;
}

/** Fetch a CSRF cookie + token from a GET, then return auth headers for mutations. */
async function authedHeaders(token?: string): Promise<Record<string, string>> {
  // Grab csrf-token from a GET
  const getRes = await fetch(`${BASE}/api/v1/health`);
  const cookies = getRes.headers.getSetCookie?.() ?? [];
  const csrfCookie = cookies.find((c: string) => c.startsWith('csrf-token='));
  const csrfToken = csrfCookie?.split(';')[0].split('=')[1] ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

test.describe('Walking Skeleton — Stack Verification', () => {
  test('API health endpoint returns 200 with status', async () => {
    const headers = await authedHeaders();
    const res = await fetch(`${BASE}/api/v1/health`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });

  test('Login with valid admin credentials returns JWT', async () => {
    const headers = await authedHeaders();
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('user');
    expect(body.user.role).toBe('admin');
  });

  test('GET /api/v1/cases with bearer token returns cases array', async () => {
    // Login
    const loginHeaders = await authedHeaders();
    const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken: token } = await loginRes.json();

    // Fetch cases
    const headers = await authedHeaders(token);
    const casesRes = await fetch(`${BASE}/api/v1/cases`, { headers });
    expect(casesRes.status).toBe(200);
    const body = await casesRes.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('Dashboard metrics returns 200 for admin', async () => {
    // Login
    const loginHeaders = await authedHeaders();
    const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken: token } = await loginRes.json();

    // Dashboard metrics
    const headers = await authedHeaders(token);
    const res = await fetch(`${BASE}/api/v1/dashboard/metrics`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('totalCases');
    expect(body).toHaveProperty('approvedCases');
    expect(body).toHaveProperty('disbursedCases');
    expect(body).toHaveProperty('uniqueHouseholds');
  });

  test('Dashboard SLA returns 200 for admin', async () => {
    const loginHeaders = await authedHeaders();
    const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
    });
    expect(loginRes.status).toBe(200);
    const { accessToken: token } = await loginRes.json();

    const headers = await authedHeaders(token);
    const res = await fetch(`${BASE}/api/v1/dashboard/sla`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overdueCount');
    expect(body).toHaveProperty('slaStatus');
  });
});
