# K6 Performance Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-command k6 suite (`perf/k6/run.sh`) that boots a disposable seeded stack, runs smoke/reads/writes scenarios against the KAPWA HTTP API, gates the 20-VU acceptance profile, and writes JSON + HTML artifacts.

**Architecture:** Bash orchestration (`run.sh`) owns the disposable environment (Postgres :5433 `kapwa_perf`, server :3100 with the throttler overridden, seeds) and invokes k6 (Docker or local). k6 scripts (`main.js` + `lib/*` + `config.js`) own the HTTP scenarios, CSRF/auth handling, and report rendering. No application code changes.

**Tech Stack:** k6 (Docker `grafana/k6` or local binary), bash, Node `fetch` for health polling, existing KAPWA server + Postgres.

**Spec:** `docs/superpowers/specs/2026-09-28-k6-performance-test-suite-design.md`

## Global Constraints

- No application-code changes; only `perf/**` and docs.
- Never touch the dev `kapwa` database: the suite uses `kapwa_perf` on the disposable Postgres (:5433, user/db `kapwa`, trust auth, data dir `/tmp/opencode/kapwa-pg/data`).
- Server runs on **:3100** with `THROTTLE_LIMIT=100000` and `THROTTLE_TTL_MS=60000` so 429s do not dominate the measurements.
- Seed credentials (dev only): `admin@mswdo.test/admin123`, `worker1@mswdo.test/worker123`.
- CSRF: unsafe requests must echo the `csrf-token` cookie in `X-CSRF-Token`; login/refresh are exempt.
- Auth response fields: `{ accessToken, refreshToken }`; list endpoints return `{ data, total }`; health returns `{ status: 'ok', db: 'connected' }`.
- Data-dependent analytics endpoints accept **200 or 422** as expected (`http.expectedStatuses(200, 422)`) — sparse demo data is not a failure.
- `perf/results/` is gitignored; runs must never be committed.
- Stage explicit paths when committing; leave unrelated dirty files alone.

## Review Focus

Five input classes/failure modes the spec implies but no happy path exercises; each gets a check/test in the owning task:

1. **Stack not ready** — health must be polled with a timeout and the script must fail loudly with the server log named (Tasks 1, 2).
2. **CSRF missing/expired** — an unsafe request without the cookie+header must 403; the auth lib must bootstrap the cookie per VU before any POST (Tasks 2, 4).
3. **Duplicate intake payloads** — write iterations must carry a unique surname so duplicate detection does not reject them (Task 4).
4. **Sparse analytics data** — 422 insufficient-data is an expected outcome, and 500s/403s are not (Task 3).
5. **Threshold breaches** — a failing run must exit non-zero and the artifacts must still be written (Task 5).

---

## Task 1: Orchestration script — disposable stack modes

**Files:**
- Create: `perf/.gitignore`
- Create: `perf/seed/seed-data.mjs`
- Create: `perf/k6/run.sh`

**Interfaces:**
- Consumes: the existing server build (`kapwa-server/dist/main.js`), `src/database/migrate.ts`, `src/database/seed-accounts.ts`, `src/database/seed-programs.ts`, `src/database/seed-demo.ts`.
- Produces: `run.sh` modes `--stack-only`, `--stop`, `--reset-db`, `--no-build`, `--profile <name>`; state file `perf/results/.stack-state`; log dir `perf/results/<UTC timestamp>/server.log`.

- [ ] **Step 1: Write `perf/.gitignore`**

```
results/
```

- [ ] **Step 2: Write `perf/k6/run.sh`**

```bash
#!/usr/bin/env bash
# KAPWA k6 performance suite orchestration.
#
#   bash perf/k6/run.sh                      # full run (stack + k6 + artifacts + teardown)
#   bash perf/k6/run.sh --stack-only         # boot the disposable stack and leave it running
#   bash perf/k6/run.sh --stop               # tear down whatever --stack-only started
#   bash perf/k6/run.sh --profile quick      # smoke|reads|writes|quick|full (default full)
#   bash perf/k6/run.sh --reset-db           # drop/recreate kapwa_perf before migrating
#   bash perf/k6/run.sh --no-build           # skip the server build
#   bash perf/k6/run.sh --upload             # enable the MinIO upload scenario
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
K6_DIR="$ROOT/perf/k6"
RESULTS_ROOT="$ROOT/perf/results"
PGDATA=/tmp/opencode/kapwa-pg/data
PG_SOCKET=/tmp/opencode/kapwa-pg
DB_NAME=kapwa_perf
SERVER_PORT=3100
BASE_URL="http://localhost:${SERVER_PORT}/api/v1"
STATE_FILE="$RESULTS_ROOT/.stack-state"

mode=run
profile="${PROFILE:-full}"
build=1
reset=0
upload="${UPLOAD:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --stack-only) mode=stack ;;
    --stop) mode=stop ;;
    --no-build) build=0 ;;
    --reset-db) reset=1 ;;
    --profile)
      shift
      [ $# -gt 0 ] || { echo "--profile needs a value" >&2; exit 2; }
      profile="$1"
      ;;
    --upload) upload=1 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

db_env() {
  echo "DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=$DB_NAME"
}

pg_running() {
  pg_ctl -D "$PGDATA" status >/dev/null 2>&1
}

stop_all() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
    if [ -n "${SERVER_PID:-}" ]; then
      kill "$SERVER_PID" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$SERVER_PID" 2>/dev/null || break
        sleep 0.5
      done
      kill -9 "$SERVER_PID" 2>/dev/null || true
    fi
    if [ "${PG_STARTED_BY_US:-0}" = "1" ]; then
      pg_ctl -D "$PGDATA" stop >/dev/null 2>&1 || true
    fi
    rm -f "$STATE_FILE"
    echo "stack stopped"
  else
    echo "no stack state found"
  fi
}

# Any failure path must not leave a server behind; a successful --stack-only
# sets KEEP_RUNNING=1 so the stack survives the script exit.
KEEP_RUNNING=0
cleanup_on_exit() {
  if [ "$KEEP_RUNNING" != "1" ]; then stop_all >/dev/null 2>&1 || true; fi
}
trap cleanup_on_exit EXIT INT TERM

if [ "$mode" = stop ]; then KEEP_RUNNING=1; stop_all; exit 0; fi

# Re-entrant: reuse a healthy stack for --stack-only (unless a DB reset is asked
# for); clean up stale state otherwise.
if [ -f "$STATE_FILE" ] && [ "$reset" = 0 ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  if [ "$mode" = stack ] && kill -0 "${SERVER_PID:-0}" 2>/dev/null \
     && node -e "fetch('${BASE_URL}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "stack already running at $BASE_URL"
    KEEP_RUNNING=1
    exit 0
  fi
  echo "cleaning up stale stack before starting"
  stop_all
fi

RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
RUN_DIR="$RESULTS_ROOT/$RUN_ID"
mkdir -p "$RUN_DIR"

startedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 1. Postgres
PG_STARTED_BY_US=0
if ! pg_running; then
  pg_ctl -D "$PGDATA" -o "-p 5433 -k $PG_SOCKET" -l "$PG_SOCKET/pg.log" start
  PG_STARTED_BY_US=1
fi

# 2. Database
if [ "$reset" = 1 ]; then
  psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME" >/dev/null
fi
if ! psql -h localhost -p 5433 -U kapwa -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE $DB_NAME" >/dev/null
fi

# 3. Build (if needed)
if [ "$build" = 1 ] || [ ! -f "$ROOT/kapwa-server/dist/main.js" ]; then
  (cd "$ROOT/kapwa-server" && npm run build >/dev/null)
fi

# 4. Migrate + base seeds (direct DataSource)
(cd "$ROOT/kapwa-server" && env $(db_env) node dist/database/migrate.js >"$RUN_DIR/migrate.log" 2>&1)
(cd "$ROOT/kapwa-server" && env $(db_env) npx ts-node src/database/seed-accounts.ts >"$RUN_DIR/seed-accounts.log" 2>&1)
(cd "$ROOT/kapwa-server" && env $(db_env) npx ts-node src/database/seed-programs.ts >"$RUN_DIR/seed-programs.log" 2>&1)

# 5. Server — exec so $! is the node PID, and record state immediately so a
#    failed health wait or seed still leaves a teardown trail.
(
  cd "$ROOT/kapwa-server"
  exec env $(db_env) PORT="$SERVER_PORT" THROTTLE_LIMIT=100000 THROTTLE_TTL_MS=60000 NODE_ENV=development \
    node dist/main.js >"$RUN_DIR/server.log" 2>&1
) &
SERVER_PID=$!
printf 'SERVER_PID=%s\nPG_STARTED_BY_US=%s\nRUN_DIR=%s\n' "$SERVER_PID" "$PG_STARTED_BY_US" "$RUN_DIR" > "$STATE_FILE"

wait_health() {
  for _ in $(seq 1 60); do
    if node -e "fetch('${BASE_URL}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      return 0
    fi
    sleep 1
  done
  echo "server did not become healthy; see $RUN_DIR/server.log" >&2
  return 1
}
owns_port() {
  ss -ltnp "sport = :$SERVER_PORT" 2>/dev/null | grep -q "pid=$SERVER_PID,"
}

wait_health
for _ in $(seq 1 30); do
  kill -0 "$SERVER_PID" 2>/dev/null || break
  owns_port && break
  sleep 1
done
if ! kill -0 "$SERVER_PID" 2>/dev/null || ! owns_port; then
  echo "server pid $SERVER_PID is not serving port $SERVER_PORT (likely EADDRINUSE against a foreign listener):" >&2
  tail -20 "$RUN_DIR/server.log" >&2 || true
  exit 1
fi

# 6. Perf seed data (API-driven, CSRF-aware; deterministic volume)
API_BASE="$BASE_URL" SEED_CASES="${SEED_CASES:-25}" node "$ROOT/perf/seed/seed-data.mjs" >"$RUN_DIR/seed-data.log" 2>&1

if [ "$mode" = stack ]; then
  KEEP_RUNNING=1
  echo "stack ready at $BASE_URL (state: $STATE_FILE)"
  exit 0
fi

# 7. k6
set +e
if command -v k6 >/dev/null 2>&1; then
  runner=local
  BASE_URL="$BASE_URL" PROFILE="$profile" RESULTS_DIR="$RUN_DIR" UPLOAD="$upload" k6 run "$K6_DIR/main.js"
  k6_status=$?
elif docker info >/dev/null 2>&1; then
  runner=docker
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -v "$K6_DIR:/scripts:ro" -v "$RUN_DIR:/results" \
    -e BASE_URL="$BASE_URL" -e PROFILE="$profile" -e RESULTS_DIR=/results -e UPLOAD="$upload" \
    grafana/k6 run /scripts/main.js
  k6_status=$?
elif command -v podman >/dev/null 2>&1; then
  runner=podman
  # Rootless podman maps container UID 1000 to a subuid; --userns=keep-id
  # makes the container user the host user so /results stays writable.
  podman run --rm --network host --userns=keep-id --user "$(id -u):$(id -g)" \
    -v "$K6_DIR:/scripts:ro" -v "$RUN_DIR:/results" \
    -e BASE_URL="$BASE_URL" -e PROFILE="$profile" -e RESULTS_DIR=/results -e UPLOAD="$upload" \
    docker.io/grafana/k6 run /scripts/main.js
  k6_status=$?
else
  echo "no k6 runner available: install k6, or start docker, or install podman" >&2
  exit 2
fi
set -e

# 8. Run metadata + teardown
cat > "$RUN_DIR/run-meta.json" <<JSON
{
  "gitSha": "$(git -C "$ROOT" rev-parse --short HEAD)",
  "startedAt": "$startedAt",
  "profile": "$profile",
  "runner": "$runner",
  "baseUrl": "$BASE_URL",
  "database": "$DB_NAME",
  "throttleLimit": "100000",
  "throttleTtlMs": "60000",
  "upload": "$upload"
}
JSON

stop_all

exit "$k6_status"
```

- [ ] **Step 2b: Write `perf/seed/seed-data.mjs`

```js
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
      cellularNumber: `091700${String(1000 + i)}`, currentAddress: address,
      occupation: 'Farmer', estimatedMonthlyIncome: income,
    },
    claimant: {
      surname: `PerfSeedC${suffix}`, firstName: 'Load',
      gender: 'Female', dob: '1990-02-02', civilStatus: 'Married',
      cellularNumber: `091711${String(1000 + i)}`, currentAddress: address,
      relationshipToBeneficiary: 'Spouse',
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
```

- [ ] **Step 3: Make it executable and run the stack smoke check**

```bash
chmod +x perf/k6/run.sh
bash perf/k6/run.sh --stack-only
```

Expected: ends with `stack ready at http://localhost:3100/api/v1`; a new `perf/results/<ts>/` contains `migrate.log`, `seed-accounts.log`, `seed-programs.log`, `seed-data.log`, `server.log`; `seed-data.log` reports `cases=25`. Then verify health, data, and stop:

```bash
node -e "fetch('http://localhost:3100/api/v1/health').then(r=>r.json()).then(b=>{console.log(b);process.exit(b.status==='ok'?0:1)})"
psql -h localhost -p 5433 -U kapwa -d kapwa_perf -tAc "SELECT (SELECT count(*) FROM persons WHERE surname LIKE 'PerfSeed%'), (SELECT count(*) FROM case_interventions WHERE category='perf-seed')"
bash perf/k6/run.sh --stop
ss -ltn | grep -c ':3100' || echo 'port 3100 free'
```

Expected: `{ status: 'ok', db: 'connected', ... }`; psql prints `75|25` (3 persons per intake × 25, and 25 interventions); `stack stopped`; `perf/results/.stack-state` is gone and port 3100 is free.

- [ ] **Step 4: Commit**

```bash
git add perf/.gitignore perf/k6/run.sh
git commit -m "feat(perf): k6 stack orchestration script"
```

---

## Task 2: k6 foundation — config, auth/CSRF, requests, smoke scenario

**Files:**
- Create: `perf/k6/config.js`
- Create: `perf/k6/lib/auth.js`
- Create: `perf/k6/lib/requests.js`
- Create: `perf/k6/main.js`

**Interfaces:**
- Consumes: `run.sh --stack-only` (Task 1).
- Produces: `PROFILE`/`BASE_URL`/`RESULTS_DIR`/`UPLOAD` config; `ACCOUNTS`; `profileConfig(profile)`; `login`, `refresh`, `ensureCsrf`, `authHeaders`, `csrfToken`; `get`, `getAllow422`, `postJson`, `think`; `main.js` exporting `options`, `setup`, `smoke`, `handleSummary` (summary in Task 5).

- [ ] **Step 1: Write `config.js`**

```js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3100/api/v1';
export const PROFILE = __ENV.PROFILE || 'smoke';
export const RESULTS_DIR = __ENV.RESULTS_DIR || './results';
export const UPLOAD = __ENV.UPLOAD === '1';

export const ACCOUNTS = {
  admin: { email: 'admin@mswdo.test', password: 'admin123' },
  worker: { email: 'worker1@mswdo.test', password: 'worker123' },
};

export function profileConfig(profile) {
  const smoke = { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'smoke' };
  switch (profile) {
    case 'smoke':
      return { smoke };
    default:
      return { smoke };
  }
}
```

- [ ] **Step 2: Write `lib/auth.js`**

```js
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

export function refresh(refreshToken) {
  const res = http.post(`${BASE_URL}/auth/refresh`, JSON.stringify({ refreshToken }), {
    headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken() },
    tags: { endpoint: 'auth-refresh' },
  });
  if (res.status !== 200) return '';
  return res.json('accessToken') || '';
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
```

- [ ] **Step 3: Write `lib/requests.js`**

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config.js';
import { authHeaders } from './auth.js';

function endpointTag(path) {
  return path.split('?')[0];
}

export function get(path, token, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, { headers: authHeaders(token), tags: { endpoint: endpointTag(path), ...tags } });
  check(res, { [`GET ${endpointTag(path)} 2xx`]: r => r.status >= 200 && r.status < 300 });
  return res;
}

export function getAllow422(path, token, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(token),
    tags: { endpoint: endpointTag(path), ...tags },
    responseCallback: http.expectedStatuses(200, 422),
  });
  check(res, { [`GET ${endpointTag(path)} 200/422`]: r => r.status === 200 || r.status === 422 });
  return res;
}

export function postJson(path, token, body, tags = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers: authHeaders(token), tags: { endpoint: endpointTag(path), ...tags } });
}

export function think(min = 0.3, max = 1.2) {
  sleep(min + Math.random() * (max - min));
}
```

- [ ] **Step 4: Write `main.js` (smoke only for now)**

```js
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
```

- [ ] **Step 5: Verify against the live stack**

```bash
bash perf/k6/run.sh --stack-only
k6_dir="$PWD/perf/k6"; run_dir=$(ls -dt perf/results/*/ | head -1)
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$k6_dir:/scripts:ro" -v "$PWD/$run_dir:/results" \
  -e BASE_URL=http://localhost:3100/api/v1 -e PROFILE=smoke -e RESULTS_DIR=/results \
  grafana/k6 run /scripts/main.js
```

Expected: smoke exits 0; `checks` 100%; `http_req_failed` 0%.

- [ ] **Step 6: Verify failure visibility (Review Focus 1–2)**

```bash
bash perf/k6/run.sh --stop
docker run --rm --network host -v "$PWD/perf/k6:/scripts:ro" -e BASE_URL=http://localhost:3100/api/v1 -e PROFILE=smoke grafana/k6 run /scripts/main.js; echo "exit=$?"
```

Expected: non-zero exit with failed `health 200` checks (stack down). Then `bash perf/k6/run.sh --stack-only` again for the next task.

- [ ] **Step 7: Commit**

```bash
git add perf/k6/config.js perf/k6/lib/auth.js perf/k6/lib/requests.js perf/k6/main.js
git commit -m "feat(perf): k6 foundation with CSRF-aware auth and smoke scenario"
```

---

## Task 3: Reads scenario

**Files:**
- Modify: `perf/k6/config.js` (add `reads` to `profileConfig`)
- Modify: `perf/k6/main.js` (add reads scenario, function, and thresholds)

**Interfaces:**
- Consumes: `get`, `getAllow422`, `think` (Task 2).
- Produces: `reads(data)` scenario; `PROFILE=reads` (5 VUs, 20 s) for verification; reads threshold `p(95)<500` in every non-smoke profile.

- [ ] **Step 1: Extend `profileConfig`**

Replace the switch in `config.js`:

```js
export function profileConfig(profile) {
  const smoke = { executor: 'per-vu-iterations', vus: 1, iterations: 1 };
  const reads = { executor: 'constant-vus', vus: 5, duration: '20s', startTime: '1s', exec: 'reads' };
  switch (profile) {
    case 'smoke':
      return { smoke };
    case 'reads':
      return { smoke, reads };
    default:
      return { smoke, reads };
  }
}
```

(Keep the `exec` key on the smoke scenario too: `const smoke = { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'smoke' };`.)

- [ ] **Step 2: Add the reads function and thresholds to `main.js`**

```js
import { get, getAllow422, think } from './lib/requests.js';
```

```js
const thresholds = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
};
if (PROFILE !== 'smoke') {
  thresholds['http_req_duration{scenario:reads}'] = ['p(95)<500'];
}

// k6 v2 only allows open() in the init context.
const SAMPLE_PDF = UPLOAD ? open('./assets/sample.pdf', 'b') : null;

export const options = {
  scenarios: profileConfig(PROFILE),
  thresholds,
};

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
```

- [ ] **Step 3: Verify the reads profile**

```bash
bash perf/k6/run.sh --stack-only   # if not already running
k6_dir="$PWD/perf/k6"; run_dir=$(ls -dt perf/results/*/ | head -1)
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$k6_dir:/scripts:ro" -v "$PWD/$run_dir:/results" \
  -e BASE_URL=http://localhost:3100/api/v1 -e PROFILE=reads -e RESULTS_DIR=/results \
  grafana/k6 run /scripts/main.js
```

Expected: exit 0; `checks` > 99%; reads p95 < 500 ms; no 500s in the server log for the endpoint calls. Analytics endpoints may return 422 (sparse demo data) without failing.

- [ ] **Step 4: Spot-check the server log for 5xx**

```bash
run_dir=$(ls -dt perf/results/*/ | head -1); grep -c " 500 \|ERROR" "$run_dir/server.log" || true
```

Expected: zero (or only benign MinIO warnings — note them in the report if present).

- [ ] **Step 5: Commit**

```bash
git add perf/k6/config.js perf/k6/main.js
git commit -m "feat(perf): k6 reads scenario with analytics 422 tolerance"
```

---

## Task 4: Writes scenario (intake + optional upload)

**Files:**
- Modify: `perf/k6/config.js` (add `writes`, `quick`, `full` profiles)
- Modify: `perf/k6/main.js` (add writes scenario, function, threshold)
- Create: `perf/k6/assets/sample.pdf`

**Interfaces:**
- Consumes: `postJson`, `think`, `authHeaders`, `csrfToken` (Task 2).
- Produces: `writes(data)`; `PROFILE=writes` (1 VU, 20 s); `PROFILE=quick`; `PROFILE=full` (ramping 0→20 VUs over 1 m, hold 3 m, down 30 s; writes 2 VUs 4 m).

- [ ] **Step 1: Create a minimal upload asset**

`perf/k6/assets/sample.pdf` — write this exact text (a valid one-page PDF):

```
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f 
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF
```

- [ ] **Step 2: Extend `profileConfig` with writes/quick/full**

```js
export function profileConfig(profile) {
  const smoke = { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'smoke' };
  const readsQuick = { executor: 'constant-vus', vus: 5, duration: '20s', startTime: '1s', exec: 'reads' };
  const writesQuick = { executor: 'constant-vus', vus: 1, duration: '20s', startTime: '1s', exec: 'writes' };
  const readsFull = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '30s', target: 0 },
    ],
    startTime: '5s',
    exec: 'reads',
  };
  const writesFull = { executor: 'constant-vus', vus: 2, duration: '4m', startTime: '5s', exec: 'writes' };
  switch (profile) {
    case 'smoke':
      return { smoke };
    case 'reads':
      return { smoke, reads: readsQuick };
    case 'writes':
      return { smoke, writes: writesQuick };
    case 'quick':
      return { smoke, reads: readsQuick, writes: writesQuick };
    case 'full':
    default:
      return { smoke, reads: readsFull, writes: writesFull };
  }
}
```

- [ ] **Step 3: Add the writes function and threshold to `main.js`**

```js
import { postJson, think } from './lib/requests.js';
import { authHeaders, csrfToken } from './lib/auth.js';
```

```js
if (PROFILE !== 'smoke') {
  thresholds['http_req_duration{scenario:reads}'] = ['p(95)<500'];
  thresholds['http_req_duration{scenario:writes}'] = ['p(95)<1500'];
}

export function writes(data) {
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
  const ok = check(res, { 'intake 200/201': r => r.status === 200 || r.status === 201 });

  if (ok && UPLOAD) {
    const caseId = res.json('caseId');
    if (caseId) {
      const file = http.file(SAMPLE_PDF, 'perf-sample.pdf', 'application/pdf');
      const upload = http.post(`${BASE_URL}/filing/upload`, { caseId, category: 'perf', file }, {
        headers: { Authorization: `Bearer ${token}`, [ 'X-CSRF-Token' ]: csrfToken() },
        tags: { endpoint: 'filing-upload' },
      });
      check(upload, { 'upload 200/201': r => r.status === 200 || r.status === 201 });
    }
  }

  think(1, 2);
}
```

Add `UPLOAD` to the imports from `./config.js`.

- [ ] **Step 4: Verify the writes profile**

```bash
bash perf/k6/run.sh --stack-only   # if not already running
k6_dir="$PWD/perf/k6"; run_dir=$(ls -dt perf/results/*/ | head -1)
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$k6_dir:/scripts:ro" -v "$PWD/$run_dir:/results" \
  -e BASE_URL=http://localhost:3100/api/v1 -e PROFILE=writes -e RESULTS_DIR=/results \
  grafana/k6 run /scripts/main.js
```

Expected: exit 0; intake 200/201 checks pass (no duplicate-rejection 409s); writes p95 < 1500 ms. Verify rows were created:

```bash
psql -h localhost -p 5433 -U kapwa -d kapwa_perf -tAc "SELECT count(*) FROM persons WHERE surname LIKE 'Perf%'"
```

Expected: a positive count.

- [ ] **Step 5: Verify CSRF enforcement is real (Review Focus 2)**

```bash
node -e "fetch('http://localhost:3100/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@mswdo.test',password:'admin123'})}).then(async r=>{console.log('login',r.status);const {accessToken}=await r.json();const c=await fetch('http://localhost:3100/api/v1/intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},body:JSON.stringify({beneficiary:{surname:'X',firstName:'Y',gender:'Male',dob:'1990-01-01'},claimant:{surname:'X',firstName:'Y',gender:'Female',dob:'1990-01-01'},familyMembers:[],case:{}})});console.log('intake without csrf',c.status)})"
```

Expected: `login 200` and `intake without csrf 403` — proving the suite's CSRF handling is necessary, not incidental.

- [ ] **Step 6: Commit**

```bash
git add perf/k6/config.js perf/k6/main.js perf/k6/assets/sample.pdf
git commit -m "feat(perf): k6 writes scenario with intake and optional upload"
```

---

## Task 5: Summary artifacts, run metadata, README

**Files:**
- Create: `perf/k6/lib/summary.js`
- Modify: `perf/k6/main.js` (`handleSummary`)
- Create: `perf/k6/README.md`

**Interfaces:**
- Consumes: k6 `data` object in `handleSummary`; `RESULTS_DIR` (Task 2); `run-meta.json` written by `run.sh` (Task 1).
- Produces: `renderHtml(data)`; per-run `summary.json` + `summary.html`.

- [ ] **Step 1: Write `lib/summary.js`**

```js
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function metricRow(name, metric) {
  const values = metric.values || {};
  let value = '';
  if (metric.type === 'rate') value = `${((values.rate ?? 0) * 100).toFixed(2)}%`;
  else if (metric.type === 'trend') value = values['p(95)'] !== undefined ? `${Number(values['p(95)']).toFixed(1)} ms` : '';
  else if (metric.type === 'gauge') value = `${values.value ?? ''}`;
  else value = `${values.count ?? ''}${values.rate !== undefined ? ` (${Number(values.rate).toFixed(1)}/s)` : ''}`;
  return `<tr><td>${esc(name)}</td><td>${esc(metric.type)}</td><td>${esc(value)}</td><td>${esc(values.avg !== undefined ? Number(values.avg).toFixed(1) : '')}</td></tr>`;
}

export function renderHtml(data) {
  const metrics = data.metrics || {};
  const thresholdRows = Object.entries(metrics).flatMap(([name, metric]) =>
    Object.entries(metric.thresholds || {}).map(([expr, t]) => ({ name, expr, ok: t.ok !== undefined ? t.ok : !t.fails })),
  );
  const keyMetrics = ['http_reqs', 'http_req_failed', 'http_req_duration', 'checks', 'iterations', 'vus_max']
    .filter(name => metrics[name]);

  const thresholdTable = thresholdRows.length
    ? thresholdRows.map(t => `<tr class="${t.ok ? 'ok' : 'fail'}"><td>${esc(t.name)}</td><td>${esc(t.expr)}</td><td>${t.ok ? 'PASS' : 'FAIL'}</td></tr>`).join('')
    : '<tr><td colspan="3">no thresholds</td></tr>';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>KAPWA k6 run</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;color:#111}
table{border-collapse:collapse;margin:1rem 0;width:100%;max-width:900px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:14px}
th{background:#f5f5f5}
tr.ok td:last-child{color:#0a7d32;font-weight:600}
tr.fail td:last-child{color:#b42318;font-weight:600}
h2{margin-top:2rem}
</style></head>
<body>
<h1>KAPWA performance run</h1>
<p>Generated ${esc(new Date().toISOString())} by k6.</p>
<h2>Thresholds</h2>
<table><thead><tr><th>Metric</th><th>Threshold</th><th>Result</th></tr></thead><tbody>${thresholdTable}</tbody></table>
<h2>Key metrics</h2>
<table><thead><tr><th>Metric</th><th>Type</th><th>Value</th><th>Avg</th></tr></thead><tbody>${keyMetrics.map(name => metricRow(name, metrics[name])).join('')}</tbody></table>
</body></html>`;
}
```

- [ ] **Step 2: Add `handleSummary` to `main.js`**

```js
import { RESULTS_DIR } from './config.js';
import { renderHtml } from './lib/summary.js';

export function handleSummary(data) {
  return {
    [`${RESULTS_DIR}/summary.json`]: JSON.stringify(data, null, 2),
    [`${RESULTS_DIR}/summary.html`]: renderHtml(data),
  };
}
```

- [ ] **Step 3: Write `README.md`**

```markdown
# KAPWA k6 performance suite

Load tests for the KAPWA HTTP API. Everything runs against a **disposable** stack:
Postgres on `:5433` (dedicated `kapwa_perf` database) and the server on `:3100`
with the throttler overridden. The dev `kapwa` database is never touched.

## Prerequisites

- Postgres data dir at `/tmp/opencode/kapwa-pg/data` (the repo's disposable cluster).
- `psql`, `node`, and either a local `k6` binary or Docker (uses `grafana/k6`).
- Seed data: created automatically by `run.sh`.

## One-command run

```bash
bash perf/k6/run.sh                 # full profile: smoke + 20 VUs reads/writes + artifacts + teardown
bash perf/k6/run.sh --profile quick # ~40 s sanity run at lower VUs
bash perf/k6/run.sh --reset-db      # recreate kapwa_perf before running
```

Artifacts land in `perf/results/<UTC timestamp>/`: `summary.json`, `summary.html`,
`run-meta.json`, `server.log`, and seed/migrate logs. Exit code is non-zero when a
threshold fails.

## Modes

| Command | Effect |
|---|---|
| `run.sh` | Full run (default `--profile full`) and teardown |
| `run.sh --stack-only` | Boot the stack, leave it running (write state to `perf/results/.stack-state`) |
| `run.sh --stop` | Tear down a `--stack-only` stack |
| `run.sh --profile smoke\|reads\|writes\|quick\|full` | Pick scenario set |
| `run.sh --reset-db` | Drop/recreate `kapwa_perf` first |
| `run.sh --no-build` | Skip the server build step (still builds when `dist/main.js` is missing) |
| `run.sh --upload` | Enable the MinIO upload scenario (requires MinIO running) |

## Scenarios

- **smoke** — `/health`, login, `/auth/me`; must pass before the load stages.
- **reads** — ramping 0→20 VUs (full): dashboard, cases list/detail/search,
  beneficiaries list/search, analytics (demographics, concentration, equity,
  inequality, clustering runs). Analytics accepts 200 or 422 (sparse demo data).
- **writes** — constant 2 VUs: `POST /intake` with unique surnames; optional
  `POST /filing/upload` behind `--upload` (MinIO required).

## Thresholds (acceptance criteria)

| Metric | Threshold |
|---|---|
| `http_req_failed` | < 1% |
| `checks` | > 99% |
| reads p95 | < 500 ms |
| writes p95 | < 1500 ms |

## Interpreting results

- Analytics and dashboard *trends* are cached for 5 minutes and `/dashboard/metrics`
  for 30 s; a second run without a data change will mostly measure the cache. Restart
  the server (or vary filters) for cold-path numbers.
- The writes scenario grows the `kapwa_perf` database by design; use `--reset-db` to
  start clean and to keep run-to-run comparisons honest. **Repeat seeding without a
  reset currently fails** because a repeated intake for an existing person hits an app
  bug (`Cannot set property age of #<Person> which has only a getter`); use
  `--reset-db` until that app-side bug is fixed.
- CSRF and rate limiting are real: the suite bootstraps the `csrf-token` cookie and
  raises `THROTTLE_LIMIT`, so measured latency reflects the app, not the guards.
- Not covered: socket.io/chat load (would need the `xk6-socketio` extension), TLS, and
  multi-instance deployments.

## Thesis notes

Attach `summary.html` per run plus `run-meta.json` (git SHA, profile, throttle settings).
Method summary: seeded municipal dataset, 20-VU ramping profile, 9:1 read:write mix,
acceptance thresholds above; cold/warm cache behavior disclosed.
```

- [ ] **Step 4: Verify a full quick run produces artifacts**

```bash
bash perf/k6/run.sh --stop || true
bash perf/k6/run.sh --profile quick
run_dir=$(ls -dt perf/results/*/ | head -1); ls "$run_dir"
node -e "const fs=require('fs');const d=process.argv[1];const j=JSON.parse(fs.readFileSync(d+'/summary.json','utf8'));const h=fs.readFileSync(d+'/summary.html','utf8');const m=JSON.parse(fs.readFileSync(d+'/run-meta.json','utf8'));console.log('thresholds:',Object.keys(j.metrics).length,'html bytes:',h.length,'profile:',m.profile,'sha:',m.gitSha)" "$PWD/$run_dir"
```

Expected: exit 0; `summary.json` parses; `summary.html` is a non-trivial document; `run-meta.json` carries profile and SHA; `run-meta.json` + all four logs exist.

- [ ] **Step 5: Verify a threshold breach exits non-zero (Review Focus 5)**

```bash
bash perf/k6/run.sh --stack-only
k6_dir="$PWD/perf/k6"; run_dir=$(ls -dt perf/results/*/ | head -1)
docker run --rm --network host --user "$(id -u):$(id -g)" -v "$k6_dir:/scripts:ro" -v "$PWD/$run_dir:/results" \
  -e BASE_URL=http://localhost:3100/api/v1 -e PROFILE=smoke -e RESULTS_DIR=/results \
  grafana/k6 run --threshold 'http_req_failed=rate<0' /scripts/main.js; echo "exit=$?"
```

Expected: `exit=1` while `summary.json`/`summary.html` are still written to the run dir.

- [ ] **Step 6: Commit**

```bash
git add perf/k6/lib/summary.js perf/k6/main.js perf/k6/README.md
git commit -m "feat(perf): k6 summary artifacts and documentation"
```

---

## Task 6: Full-profile validation and close-out

**Files:**
- Modify: `perf/k6/README.md` (record the validated run)
- Modify: `.superpowers/sdd/progress.md` (wave-specific location chosen by the SDD run — gitignored)

**Interfaces:**
- Consumes: everything above.
- Produces: a recorded full-profile run and final verification.

- [ ] **Step 1: Full-profile run**

```bash
bash perf/k6/run.sh --reset-db
```

Expected: exit 0; smoke + 20-VU profile complete (~5 min); all four thresholds PASS. If a threshold fails, do NOT tune it down — capture the artifacts, note the failure, and report it.

- [ ] **Step 2: Record the run in the README**

Append to the README under "Thesis notes":

```markdown
Validated run: local disposable stack (Postgres :5433, server :3100), full profile
(reads ramping to 20 VUs + 2 write VUs + 1 smoke VU — max concurrent 23), k6 via podman
(`--userns=keep-id`); measured thresholds and results in `perf/results/<timestamp>/`
(summary.json, summary.html, run-meta.json, server.log).
```

- [ ] **Step 3: Confirm no application code changed and existing gates stay green**

```bash
git diff --stat $(git merge-base HEAD main)..HEAD -- kapwa-server kapwa-client | tail -3
cd kapwa-server && npm run typecheck && npx jest --silent 2>&1 | tail -3
cd ../kapwa-client && npm run typecheck && npm run test:run 2>&1 | tail -3
```

Expected: `git diff` for `kapwa-server`/`kapwa-client` is empty (only `perf/` and docs changed); suites green (they are untouched, but this proves it).

- [ ] **Step 4: Commit**

```bash
git add perf/k6/README.md
git commit -m "docs(perf): record validated 20-VU full-profile run"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| §3 layout | Tasks 1, 2, 5 |
| §4 scenarios (smoke/reads/writes) | Tasks 2, 3, 4 |
| §5 auth + CSRF | Tasks 2, 4 (verification step proves 403 without it) |
| §6 orchestration modes + env overrides | Task 1 (uses modes in Tasks 2–5) |
| §7 artifacts | Tasks 1 (logs, meta via run.sh) and 5 (summary JSON/HTML) |
| §8 success criteria | Tasks 2 (fail-fast), 3 (reads), 4 (writes), 5 (thresholds + artifacts), 6 (full run) |
| §9 out of scope | Not implemented (socket.io/TLS/CI), stated in README |

**2. Placeholder scan:** no TBD/TODO; every file has full content; every verification has a concrete command and expected result.

**3. Type consistency:** `profileConfig` keys match the scenario keys and `exec` names; `main.js` imports match the lib exports (`get`, `getAllow422`, `postJson`, `think`, `login`, `authHeaders`, `csrfToken`, `renderHtml`); `run.sh` env names (`BASE_URL`, `PROFILE`, `RESULTS_DIR`, `UPLOAD`) match `config.js`; state-file keys (`SERVER_PID`, `PG_STARTED_BY_US`, `RUN_DIR`) match between write and `stop_all`.

**4. Review Focus coverage:** stack-not-ready → Tasks 1 (health poll) and 2 (failure-visibility step); CSRF → Tasks 2 (lib) and 4 (403 proof step); duplicate intakes → Task 4 (unique surnames + row count); sparse analytics → Task 3 (expectedStatuses 200/422); threshold breach → Task 5 (force-fail step writes artifacts and exits 1).
