# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Walking Skeleton — End-to-End Stack Verification >> Test 1: All 4 Docker services (db, api, minio, caddy) are running and healthy
- Location: e2e/auth-flow.spec.ts:15:7

# Error details

```
Error: Command failed: docker compose -f kapwa-server/docker-compose.yml ps --format json
open /home/typwtypw/Documents/NC/THESIS1-KAPWA/tests/kapwa-server/docker-compose.yml: no such file or directory

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const DOCKER_COMPOSE_FILE = 'kapwa-server/docker-compose.yml';
  4   | const BASE_URL = 'http://localhost';
  5   | 
  6   | interface DockerService {
  7   |   Name?: string;
  8   |   Service?: string;
  9   |   Status?: string;
  10  |   Health?: string;
  11  |   State?: string;
  12  | }
  13  | 
  14  | test.describe('Walking Skeleton — End-to-End Stack Verification', () => {
  15  |   test('Test 1: All 4 Docker services (db, api, minio, caddy) are running and healthy', async () => {
  16  |     const { execSync } = await import('child_process');
> 17  |     const raw = execSync(
      |                 ^ Error: Command failed: docker compose -f kapwa-server/docker-compose.yml ps --format json
  18  |       `docker compose -f ${DOCKER_COMPOSE_FILE} ps --format json`,
  19  |       { encoding: 'utf8', timeout: 15000 }
  20  |     );
  21  | 
  22  |     // docker compose ps --format json may return JSON array or NDJSON lines
  23  |     // Parse whichever format is returned
  24  |     let services: DockerService[];
  25  |     try {
  26  |       services = JSON.parse(raw.trim());
  27  |     } catch {
  28  |       // NDJSON — one JSON object per line
  29  |       services = raw
  30  |         .trim()
  31  |         .split('\n')
  32  |         .filter((l: string) => l.trim())
  33  |         .map((l: string) => JSON.parse(l));
  34  |     }
  35  | 
  36  |     const serviceNames = services.map((s: DockerService) => s.Service || s.Name);
  37  |     expect(serviceNames).toContain('db');
  38  |     expect(serviceNames).toContain('api');
  39  |     expect(serviceNames).toContain('minio');
  40  |     expect(serviceNames).toContain('caddy');
  41  | 
  42  |     for (const svc of services) {
  43  |       const name = svc.Service || svc.Name || 'unknown';
  44  |       expect(
  45  |         svc.Status?.startsWith('running') || svc.State === 'running',
  46  |         `Service "${name}" should be running`
  47  |       ).toBeTruthy();
  48  |     }
  49  |   });
  50  | 
  51  |   test('Test 2: Caddy health endpoint (GET /health) returns 200 with JSON body', async () => {
  52  |     const res = await fetch(`${BASE_URL}/health`);
  53  |     expect(res.status).toBe(200);
  54  | 
  55  |     const contentType = res.headers.get('content-type') || '';
  56  |     expect(contentType).toContain('application/json');
  57  | 
  58  |     const body = await res.json();
  59  |     expect(body).toHaveProperty('status');
  60  |     expect(body.status).toBe('ok');
  61  |   });
  62  | 
  63  |   test('Test 3: POST /api/auth/login with valid admin credentials returns JWT + admin role', async () => {
  64  |     const res = await fetch(`${BASE_URL}/api/auth/login`, {
  65  |       method: 'POST',
  66  |       headers: { 'Content-Type': 'application/json' },
  67  |       body: JSON.stringify({
  68  |         email: 'admin@kapwa.test',
  69  |         password: 'test-password',
  70  |       }),
  71  |     });
  72  |     expect(res.status).toBe(200);
  73  | 
  74  |     const body = await res.json();
  75  |     expect(body).toHaveProperty('access_token');
  76  |     expect(body).toHaveProperty('user');
  77  |     expect(body.user).toHaveProperty('role');
  78  |     expect(body.user.role).toBe('admin');
  79  |   });
  80  | 
  81  |   test('Test 4: GET /api/cases with bearer token returns 200 + cases array', async () => {
  82  |     // First authenticate to get a token
  83  |     const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  84  |       method: 'POST',
  85  |       headers: { 'Content-Type': 'application/json' },
  86  |       body: JSON.stringify({
  87  |         email: 'admin@kapwa.test',
  88  |         password: 'test-password',
  89  |       }),
  90  |     });
  91  |     expect(loginRes.status).toBe(200);
  92  |     const { access_token: token } = await loginRes.json();
  93  | 
  94  |     // Now request cases with the token
  95  |     const casesRes = await fetch(`${BASE_URL}/api/cases`, {
  96  |       headers: {
  97  |         'Authorization': `Bearer ${token}`,
  98  |         'Content-Type': 'application/json',
  99  |       },
  100 |     });
  101 |     expect(casesRes.status).toBe(200);
  102 |     const casesBody = await casesRes.json();
  103 |     expect(Array.isArray(casesBody)).toBeTruthy();
  104 |   });
  105 | });
  106 | 
```