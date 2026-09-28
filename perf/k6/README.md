# KAPWA k6 performance suite

Load tests for the KAPWA HTTP API. Everything runs against a **disposable** stack:
Postgres on `:5433` (dedicated `kapwa_perf` database) and the server on `:3100`
with the throttler overridden. The dev `kapwa` database is never touched.

## Prerequisites

- Postgres server binaries (`initdb`, `pg_ctl`, `psql`) and a disposable cluster:

  ```bash
  initdb -D /tmp/opencode/kapwa-pg/data -U kapwa -A trust
  ```

  `run.sh` starts it with `pg_ctl -k /tmp/opencode/kapwa-pg -o "-p 5433"` (port 5433,
  trust auth, dedicated `kapwa_perf` database). The dev `kapwa` database is never touched.
- `npm install` run once in `kapwa-server/` — `run.sh` builds `dist/main.js` before booting.
- `ss` (util-linux) — used to assert the server actually owns port 3100.
- A k6 runner: a local `k6` binary, or a container runtime — Docker (daemon must be
  running) or rootless Podman (both use the pinned `grafana/k6:2.3.0`).
- Seed data: created automatically by `run.sh`.

## One-command run

```bash
bash perf/k6/run.sh                 # full profile: smoke + 20 VUs reads/writes + artifacts + teardown
bash perf/k6/run.sh --profile quick # ~40 s sanity run at lower VUs
bash perf/k6/run.sh --reset-db      # recreate kapwa_perf before running
```

`run.sh` picks the first available runner: local `k6`, then Docker (only when
`docker info` succeeds), then Podman (`--userns=keep-id` so the container user can
write into the mounted run directory); container runners are pinned to
`grafana/k6:2.3.0`. Artifacts land in `perf/results/<UTC timestamp>/`:
`summary.json`, `summary.html`, `run-meta.json`, `server.log`, and seed/migrate logs.
Exit code is non-zero when a threshold fails.

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

- **smoke** — `/health`, login, `/auth/me`. Its `checks{scenario:smoke}` threshold
  aborts the whole run on failure (`abortOnFail`), so a broken auth/health path cannot
  be averaged away by the load stages.
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
| `checks{scenario:smoke}` | > 99%, `abortOnFail` (smoke failures abort the run) |
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
  `noCookiesReset: true` keeps each VU's cookie jar across iterations, so the CSRF
  bootstrap happens once per VU, not once per iteration.
- Access tokens live 1 h; runs over that TTL would need a refresh strategy — the suite
  does not implement mid-run refresh.
- Not covered: socket.io/chat load (would need the `xk6-socketio` extension), TLS, and
  multi-instance deployments.

## Thesis notes

Attach `summary.html` per run plus `run-meta.json` (git SHA, profile, k6 version,
throttle settings). Method summary: seeded municipal dataset, full profile = 20 ramping
read VUs + 2 constant write VUs + 1 smoke VU, measured **19.07:1** read:write iteration
ratio in the validated run (5,415 reads vs 284 writes), acceptance thresholds above;
cold/warm cache behavior disclosed.

### Validated full-profile run

`perf/results/20260928T072650Z/` — started 2026-09-28T07:26:50Z (UTC), git `484183c`,
profile `full`: 20 ramping read VUs + 2 constant write VUs + 1 smoke VU (23 max
concurrent), k6 v2.3.0 via podman (`--userns=keep-id`). 65,292 requests, 5,700
iterations (5,415 reads / 284 writes / 1 smoke — measured ratio **19.07:1**) in 4 m 36 s.

| Metric | Threshold | Measured | Result |
|---|---|---|---|
| `http_req_failed` | < 1% | 0.0061% (4 of 65,292 requests) | PASS |
| `checks` | > 99% | 99.9878% (65,569 of 65,577 checks) | PASS |
| `checks{scenario:smoke}` | > 99% (`abortOnFail`) | 100% (3 of 3) | PASS |
| reads p95 (`http_req_duration{scenario:reads}`) | < 500 ms | 20.72 ms | PASS |
| writes p95 (`http_req_duration{scenario:writes}`) | < 1500 ms | 234.85 ms | PASS |

The 4 failed requests were `POST /intake` (writes scenario) returning 500 after a
Postgres serialization error (*could not serialize access due to read/write dependencies
among transactions*) under concurrent writes — within the 1% failure budget.

The CSRF bootstrap runs once per VU, not per iteration (`noCookiesReset: true`): 25
health checks total (2 setup logins + 23 scenario VUs) across 5,700 iterations, versus
one health check per iteration (5,718) before the fix.

Artifacts: `summary.json`, `summary.html`, `run-meta.json`, `server.log`, `migrate.log`,
`seed-accounts.log`, `seed-programs.log`, `seed-data.log`.
