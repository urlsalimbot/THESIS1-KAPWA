# K6 Performance Test Suite — Design

- **Date:** 2026-09-28
- **Status:** Approved (brainstorm 2026-09-28); pending written-spec review
- **Scope:** New `perf/k6/` tooling — load/performance testing of the KAPWA HTTP API. No application-code changes.

## 1. Objective

A reproducible, one-command k6 suite that measures KAPWA's HTTP performance against a disposable seeded stack and gates a thesis-usable acceptance profile: 20 virtual users, mixed read/write traffic, thresholds on error rate and p95 latency, with JSON + HTML result artifacts.

## 2. Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Scope | Full scenario suite (reads, writes incl. intake, analytics), not a smoke-only script |
| Workload | Smoke stage → ramp 0→20 VUs over 1 m → hold 3 m → ramp down; ~9:1 read:write |
| Thresholds | `http_req_failed < 1%`, `checks > 99%`, reads p95 < 500 ms, writes p95 < 1500 ms |
| Artifacts | `summary.json` + self-contained `summary.html` + `run-meta.json` + `server.log` per run |
| Environment | Disposable stack: Postgres on :5433 (dedicated `kapwa_perf` DB) + server on :3100 with the throttler overridden; never the dev DB |
| Runner | Docker `grafana/k6` (host network) with local-binary fallback |
| Out of scope | socket.io/chat load (needs xk6-socketio), TLS, distributed runners, CI gating |

## 3. Layout

```
perf/
  .gitignore             # results/
  results/               # per-run artifacts (gitignored)
  k6/
    run.sh               # orchestration: stack, seeds, k6, artifacts, teardown
    README.md            # prerequisites, commands, interpretation, thesis notes
    config.js            # BASE_URL, credentials, PROFILE, toggles
    main.js              # scenarios, thresholds, handleSummary
    lib/auth.js          # CSRF bootstrap, login, refresh, per-VU cookie handling
    lib/requests.js      # tagged request helpers, think-time, status checks
    lib/summary.js       # self-contained JSON + HTML report builder
    assets/sample.pdf    # minimal upload asset for UPLOAD=1
```

## 4. Scenarios

- **smoke** (1 VU, 1 iteration): `GET /health`, `POST /auth/login`, `GET /auth/me` for admin and worker1. Any failure aborts the run (`abortOnFail` on its threshold).
- **reads** (ramping 0→20 VUs, 1 m → hold 3 m → 30 s down): `GET /dashboard/metrics`, `GET /dashboard/trends?range=6m`, `GET /cases?page=1&limit=10`, `GET /cases/:id` (id resolved from the list; skipped if none), `GET /cases?search=dela`, `GET /beneficiaries?page=1&limit=10`, `GET /beneficiaries?search=dela`, `GET /analytics/demographics`, `GET /analytics/concentration`, `GET /analytics/equity`, `GET /analytics/inequality`, `GET /analytics/clustering/runs`.
  - Data-dependent analytics endpoints accept **200 or the spec's 422 insufficient-data** as an expected outcome (`http.expectedStatuses(200, 422)`), so sparse demo data neither fails the run nor masks real errors.
- **writes** (constant 2 VUs, same window): `POST /intake` with a unique surname per iteration (`PERF <vu>-<iter>-<epoch>`) so duplicate detection does not reject it; asserts 200/201 and a `caseId` in the body. Optional `UPLOAD=1`: `POST /filing/upload` multipart with `assets/sample.pdf` against the case the intake just created (requires MinIO; off by default).

## 5. Auth & CSRF

- k6's per-VU cookie jar receives the `csrf-token` cookie from any GET; unsafe requests must echo it in `X-CSRF-Token` (double-submit guard). `lib/auth.js` bootstraps via `GET /health`, extracts the cookie (`cookiesForURL`), and injects the header on POST/PATCH/PUT/DELETE.
- `setup()` logs in `admin@mswdo.test/admin123` and `worker1@mswdo.test/worker123` (seed-accounts values) and returns `{accessToken, refreshToken}` per role; 401s trigger one refresh attempt.
- Credentials are dev-seed accounts only; the suite never targets production.

## 6. Orchestration (`perf/k6/run.sh`)

Modes: default full run; `--stack-only` (boot and leave running, record pids); `--stop`; `--profile smoke|quick|full` (default full); `--no-build`; `--reset-db`.

Default flow:
1. Ensure Postgres on :5433 (start only if down; remember whether we started it).
2. Create `kapwa_perf` if missing; run `node dist/database/migrate.js` against it.
3. Seed `seed-accounts.ts` + `seed-programs.ts` (direct DataSource).
4. Build if `dist/main.js` is missing/stale (`--no-build` to skip); start the server on :3100 with `DB_* → kapwa_perf`, `THROTTLE_LIMIT=100000`, `THROTTLE_TTL_MS=60000`; log to `perf/results/<ts>/server.log`; wait for `/health` via a Node `fetch` poll.
5. Seed `seed-demo.ts` with `API=http://localhost:3100` (uploads warn without MinIO and the seed continues).
6. Run k6: local binary if present, else `docker run --rm --network host -v <k6 dir>:/scripts:ro -v <results dir>:/results grafana/k6 run /scripts/main.js` with `-e BASE_URL`, `-e PROFILE`, `-e RESULTS_DIR=/results`, `-e UPLOAD`.
7. Write `run-meta.json` (git SHA, UTC time, profile, throttle env, DB name, k6 version), tear down the server and (if we started it) Postgres, and exit with k6's threshold status.

## 7. Artifacts

- `summary.json` — k6 `handleSummary` output (metrics, thresholds).
- `summary.html` — self-contained report rendered by `lib/summary.js` from the same data (no network): threshold pass/fail table, request metrics (p50/p95/p99, RPS, error rate), per-endpoint table from `group_duration`/tag data available in `data.metrics`.
- `run-meta.json` — reproducibility metadata for the thesis appendix.
- `server.log` — server output for the run.

## 8. Success criteria

1. `bash perf/k6/run.sh` on a clean machine with Docker (or a local k6) completes end-to-end, seeds the stack, runs the full profile, and prints a threshold summary.
2. The smoke profile fails fast (non-zero exit) when the stack is unhealthy or credentials are wrong.
3. The full profile reports: error rate < 1%, checks > 99%, reads p95 < 500 ms, writes p95 < 1500 ms; a threshold breach exits non-zero.
4. Artifacts are written per run and `perf/results/` is gitignored.
5. README documents prerequisites, all modes, interpretation, and the caveats (analytics cache warm/cold, write-path state growth, no socket.io/TLS coverage).
6. No changes to application code; server/client suites remain untouched and green.

## 9. Out of scope

socket.io/chat load generation, TLS-termination testing, distributed/multi-region runners, CI gating, production data, and browser-level (Core Web Vitals) testing.
