# KAPWA k6 performance suite

Load tests for the KAPWA HTTP API. Everything runs against a **disposable** stack:
Postgres on `:5433` (dedicated `kapwa_perf` database) and the server on `:3100`
with the throttler overridden. The dev `kapwa` database is never touched.

## Prerequisites

- Postgres data dir at `/tmp/opencode/kapwa-pg/data` (the repo's disposable cluster).
- `psql`, `node`, and a k6 runner: a local `k6` binary, or a container runtime —
  Docker (daemon must be running) or rootless Podman (both use `grafana/k6`).
- Seed data: created automatically by `run.sh`.

## One-command run

```bash
bash perf/k6/run.sh                 # full profile: smoke + 20 VUs reads/writes + artifacts + teardown
bash perf/k6/run.sh --profile quick # ~40 s sanity run at lower VUs
bash perf/k6/run.sh --reset-db      # recreate kapwa_perf before running
```

`run.sh` picks the first available runner: local `k6`, then Docker (only when
`docker info` succeeds), then Podman (`--userns=keep-id` so the container user can
write into the mounted run directory). Artifacts land in `perf/results/<UTC timestamp>/`:
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
| `run.sh --no-build` | Skip the server build step |
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

- Analytics and dashboard endpoints are cached for 5 minutes; a second run without a
  data change will mostly measure the cache. Restart the server (or vary filters) for
  cold-path numbers.
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
