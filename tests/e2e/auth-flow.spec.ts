import { test, expect } from '@playwright/test';

const PODMAN_COMPOSE_FILE = 'kapwa-server/docker-compose.yml';
const BASE_URL = 'http://localhost';

interface PodmanService {
  Name?: string;
  Service?: string;
  Status?: string;
  Health?: string;
  State?: string;
}

test.describe('Walking Skeleton — End-to-End Stack Verification', () => {
  test('Test 1: All 4 Pod services (db, api, minio, caddy) are running and healthy', async () => {
    const { execSync } = await import('child_process');
    const raw = execSync(
      `podman-compose -f ${PODMAN_COMPOSE_FILE} ps --format json`,
      { encoding: 'utf8', timeout: 15000 }
    );

    // podman-compose ps --format json may return JSON array or NDJSON lines
    // Parse whichever format is returned
    let services: PodmanService[];
    try {
      services = JSON.parse(raw.trim());
    } catch {
      // NDJSON — one JSON object per line
      services = raw
        .trim()
        .split('\n')
        .filter((l: string) => l.trim())
        .map((l: string) => JSON.parse(l));
    }

    const serviceNames = services.map((s: PodmanService) => s.Service || s.Name);
    expect(serviceNames).toContain('db');
    expect(serviceNames).toContain('api');
    expect(serviceNames).toContain('minio');
    expect(serviceNames).toContain('caddy');

    for (const svc of services) {
      const name = svc.Service || svc.Name || 'unknown';
      expect(
        svc.Status?.startsWith('running') || svc.State === 'running',
        `Service "${name}" should be running`
      ).toBeTruthy();
    }
  });

  test('Test 2: Caddy health endpoint (GET /health) returns 200 with JSON body', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('application/json');

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });

  test('Test 3: POST /api/auth/login with valid admin credentials returns JWT + admin role', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kapwa.test',
        password: 'test-password',
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('access_token');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('role');
    expect(body.user.role).toBe('admin');
  });

  test('Test 4: GET /api/cases with bearer token returns 200 + cases array', async () => {
    // First authenticate to get a token
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kapwa.test',
        password: 'test-password',
      }),
    });
    expect(loginRes.status).toBe(200);
    const { access_token: token } = await loginRes.json();

    // Now request cases with the token
    const casesRes = await fetch(`${BASE_URL}/api/cases`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(casesRes.status).toBe(200);
    const casesBody = await casesRes.json();
    expect(Array.isArray(casesBody)).toBeTruthy();
  });
});
