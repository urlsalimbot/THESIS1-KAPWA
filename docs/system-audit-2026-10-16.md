# KAPWA MSWDO — whole-system audit

**Date:** 2026-10-16 · **Revision:** `d05188c` (main) · **Scope:** server, client, database, CI/CD, ops, tests.
**Method:** static greps + counts, live DB introspection (`kapwa-db`), `npm audit`/`outdated`, build output, workflow/Dockerfile read, codebase graph (`get_architecture`, `check_index_coverage`). Ranks are risk × value.

---

## 0. Status — fixes landed 2026-10-16 (same day)

| § | Finding | Result |
|---|---|---|
| 2.1 | Dependency debt | Prod audit: server **31 → 0 high/critical** (66 → 12 moderate), client **7 → 0** high/critical. `tar` pinned patched via `overrides`, nodemailer + tiptap bumped, Renovate configured, **CI now fails on a high/critical prod advisory**. |
| 2.2 | No DB-backed tests / migrations never run | New `scripts/schema-parity.sh` builds **both** schema paths on empty databases and diffs them; new CI job `schema-parity` with a Postgres service; drift is a recorded baseline, so only NEW divergence fails. |
| 2.3 | Mail bodies in the log | Body no longer logged (recipient masked to `j***@domain`, shape only, error level in prod); user/audit warnings masked; specs assert the token cannot reach the log. |
| 2.4 | Auth rate limits | 15 credential/mail endpoints carry their own bucket (5–10/min) against the global 60; spec fails if a future sensitive route is added without one. |
| 4.3 | Interpolated SQL | ESLint rule added. It immediately found a **broken bootstrap** (see below) and a real injection in the case tracker (`status` / `barangay` filters) — both fixed; the 22 identifier-only sites are documented warnings. |
| 4.6 | Restore unproven | `infra/backup/restore.sh` (drill mode), proven end-to-end: dump restored into a scratch DB, 5 cases verified. |
| 4.2 | Stale worktrees | Both pruned (branches merged into main; branches kept). |
| 4.5 | Audits invisible to git | `.gitignore` re-includes `docs/*-audit*.md`; the audits are now tracked. |
| 3.2 | First-load payload | **Done.** Filipino is a lazily-fetched chunk (`changeLang` fetches before switching, so no screen ever renders in a language whose strings have not arrived and no async bootstrap was needed). Measured: the i18n chunk went **273 KB → 151 KB (84 → 48 KB gzip)** — 36 KB gzip off every first load. |
| 3.3 | No browser-level tests | **Done.** `kapwa-client/e2e/smoke.spec.ts`: boot + admin sign-in, signed-in shell with the admin-only nav, and a worker kept out of `/admin/programs`. Runs against the production bundle behind `vite preview` with a real API, database and seeded accounts; new CI job (non-blocking until it has a green record). Writing it found two setup bugs: `vite preview` does not inherit `server.proxy` (the built SPA had no `/api` route locally), and a production build has no `VITE_API_URL`, so it fell back to an absolute cross-origin `localhost:3000`. |
| 3.1 | No monitoring | **Half done.** `.github/workflows/uptime.yml` probes `/health/ready` (which checks the database) and the SPA every 30 minutes and notifies on failure — no AWS credentials needed, driven by two repository variables. The AWS half remains: a CloudWatch alarm on 5xx sees errors *within* a healthy process, which an external probe cannot. |
| 4.4 | `console.log` in server code | **Verified, no change needed.** Every one is in a bootstrap/CLI file (seeds, `init-buckets`) or is the JSON log formatter itself in `main.ts`; no service, controller or guard logs to the console. |

**Found while fixing (not in the original report):**

- **P0 — the fresh-boot bootstrap was broken and lied about it.** `migrate.ts` ran a statement naming `program_enrollments` before that table existed, aborted on any empty database, and exited **0** — a new deployment would come up with an empty schema and report success. Introduced with the migration-98 mirror (commit `f222f95`) and caught the first time the parity check ran. Fixed: the block moved after the table, and the runner now exits 1 with `FATAL:` on failure.
- **P1 — SQL injection in the case tracker** (`cases.service.ts`): `status` and `barangay` from the query string were interpolated (with a hand-rolled `replace(/'/g, "''")`). Now bound as `$n`.
- **P2 — CSR sequences only existed for 2026**: the service derives `csr_seq_<year>` while the schema seeds only `csr_seq_2026`, so the first CSR of 2027 would fail. Sequences are now created on demand (`database/sequences.ts`).
- **P2 — chain lagged the bootstrap** on `document_vault.irf_id` / `announcement_id` (mapped by `filing.entity.ts`): an installation upgraded through the migration chain would fail on every filing query → catch-up migration added.

**Still open:** the AWS-side half of monitoring (a CloudWatch 5xx alarm), the 12 moderate advisories (dev tooling and transitive ranges), the second half of the payload work (PSGC's 68 KB gzip is genuinely needed to resolve addresses, so deferring it needs an async render path — not worth the risk today), and the **58 baselined schema differences** in `kapwa-server/scripts/schema-parity.baseline.txt`: decomposed columns the bootstrap still creates (`cases.amount_assistance`, `referrals.surname`, …), hash-chain columns and eleven foreign keys the bootstrap lacks, and `households.access_card_code`'s type. Closing them means touching data (drops with backfills, FK validation against existing rows), so they are recorded and ratcheted rather than rushed — any NEW divergence already fails CI.

---

## 1. Health snapshot

| | Server | Client |
|---|---|---|
| Files / LOC | 538 / ~61 k | 437 / ~74 k |
| Spec files | 143 (all collected by jest) | 164 |
| Tests | 1 551 passing | 1 479 passing |
| Modules / services / entities | 39 / 65 / 57 | — |
| Controllers / routes | 45 / 275 | — |
| Migrations | 101 files | — |

(LOC includes the spec files.)

DB (live bootstrap): **67 tables, 180 indexes, 53 FKs, 0 tables without a primary key.**
CI: 4 jobs (server, client, client-coverage, docker-build). Deploy: 2 jobs (API by repo sync to the deploy path, SPA build + publish with AWS deploy credentials).
Graph: 9 633 nodes / 33 468 edges; index generation 2026-10-14 (2 days before this audit — treat structural claims as best-effort).

**The system is in good shape.** The findings below are debt and gaps, not breakage. What is already solid is listed in §5.

---

## 2. P1 — do these first

### 2.1 Dependency vulnerabilities and staleness
**Evidence.** `npm audit`: server **66** (3 critical, 44 high, 17 moderate, 2 low), client **63** (2 critical, 19 high, 41 moderate). `npm outdated`: 41 server, 64 client.
Named: `tar` (critical, flagged runtime), `handlebars` (critical, dev), `proxy-addr` (critical, dev), plus the whole jest transitive tree (high, dev).

**Why it matters.** Most client findings are build/test tooling, but they are indistinguishable from runtime ones at a glance, and nothing in CI fails on them — so the number only grows. A `tar`/`proxy-addr` reachable at build or deploy time is a supply-chain path into the deploy box.

**Suggested fix.** ① `npm audit --omit=dev` on both apps to separate signals; patch the production tree first, then dev. ② Add Renovate or Dependabot (weekly, grouped) so it never re-accumulates. ③ Add `npm audit --omit=dev --audit-level=high` as a CI step.
**Effort:** half a day for the first pass + ~30 min for automation.

### 2.2 Nothing tests the database, and CI never runs a migration
**Evidence.** 143 spec files, all Nest `Test.createTestingModule` with mocked repositories; `ci.yml` declares **no Postgres service** (0 matches) and no spec references `AppDataSource`/`TypeOrmModule.forRoot`. The whole suite runs in ~22 s.

**Why it matters.** This is the exact gap that produced three live-only bugs this month: the matrix-replace 500 (a TypeORM orphan/nullify behaviour), and the two FK bugs shipped as migrations 95/96. It also means the `migrate.ts` ↔ migration-chain mirror — the single most load-bearing convention in this repo — is enforced by nothing but review.

**Suggested fix.** One CI job with a Postgres service that (a) boots `migrate.ts` on an empty DB, (b) runs the TypeORM chain on a second empty DB, (c) diffs `information_schema.columns`/`table_constraints` between the two, failing on any difference. That one job covers migration drift, orphan columns, missing FKs and index divergence in a single assertion.
**Effort:** ~half a day. Highest value-per-hour item in this report.

### 2.3 The mailer writes whole emails into the log
**Evidence.** `kapwa-server/src/common/mailer.service.ts:48` — when `EMAIL_HOST` is unset, `logger.log('[email:logged] to=${to} subject="${subject}"\n${text}')`. `main.ts` only *warns*. Related: `users.service.ts:129` logs a raw recipient address; `auth.service.ts:302` logs an error object.

**Why it matters.** In production a mail misconfiguration silently redirects password-reset and account-setup links (tokens included) into CloudWatch, where they persist and are readable by anyone with log access. It is a configuration slip away, not a hypothetical.

**Suggested fix.** Log a redacted reference only (subject, recipient domain/hash, message id) — never the body; make a missing `EMAIL_HOST` fatal when `NODE_ENV=production`, and mask the address in the users/audit warn lines.
**Effort:** ~1 hour + a spec.

### 2.4 Auth endpoints share the global rate limit
**Evidence.** `ThrottlerModule.forRoot([{ ttl: 60 000, limit: 60 }])` and **zero** `@Throttle`/`@SkipThrottle` decorators in the codebase.

**Why it matters.** Login, OTP verify, forgot-password and register all sit under 60 requests/minute/IP — enough for online guessing against a small staff directory, and coarse enough to be DoS-shaped for real users.

**Suggested fix.** Tighter buckets on the auth controller (login/OTP 5–10/min/IP, password-reset by account + IP), plus backoff or a lockout counter on repeated failures for the same account.
**Effort:** 1–2 hours.

---

## 3. P2 — next sprint

### 3.1 No production error tracking or alerting
**Evidence.** No Sentry, OpenTelemetry, prom-client or equivalent anywhere; `/health/live` and `/health/ready` exist but nothing watches them.
**Why it matters.** Today the only signal that something broke in production is a user saying so. The notification/deploy work of the last weeks is invisible to the office until it isn't.
**Fix.** Cheapest useful step: a CloudWatch alarm on 5xx + a synthetic uptime check on `/health/ready` that pages via email/SMS; then Sentry on API and SPA for grouped stack traces.
**Effort:** half a day (cheap version), 1 day with Sentry.

### 3.2 First-load payload is heavier than it needs to be
**Evidence (build output, gzip):** `i18n` 273 KB / **84 KB** — both `en` and `fil` are imported eagerly (`i18n/index.ts:3-4`); `psgc` 388 KB / 68 KB — the whole address dataset loads with the router; `AnnouncementForm` 389 KB / **123 KB** — larger than the entire app shell, likely editor + charts; `BarChart` 334 KB / 96 KB. `vite.config.ts` sets no `manualChunks`.
**Why it matters.** Barangay-level workers on mobile data pay for every byte. Route-level splitting and prefetch are already in place, so what remains is a few specific offenders, not architecture.
**Fix.** Dynamic-import the non-active locale; load PSGC on first address-field interaction; split the announcement editor/rich-text dependency; add `manualChunks` for vendor groups.
**Effort:** ~1 day, est. −150 KB gz on first load.

### 3.3 No browser-level tests
**Evidence.** No Playwright config, no e2e directory in either app; CI is unit/integration only.
**Why it matters.** Every UI regression this month was caught by a manual Playwright pass — the navigation blank-screen (Suspense), the GIS print gate, the inactive-programs filter. A hand pass does not run on every PR.
**Fix.** A 6–10 test smoke suite against the built SPA + API in CI: login → case view → add hearing → seal a step → print gates → approval notification appears.
**Effort:** 1–2 days, or start with three tests in half a day.

### 3.4 Dead table + unguarded bootstrap mirror
**Evidence.** Migration `ProgramServicesAndInterventionTypes…0080` creates `program_services`; no migration drops it and **no application code references it** (grep across `src` excluding `database/`). Separately: migrations create 72 table names, `migrate.ts` 67; six of the seven differences are tables a later migration drops, `program_services` is not.
**Fix.** Drop it in a follow-up migration (or record why it stays), and let the §2.2 job keep the two schema paths identical.
**Effort:** ~2 hours.

---

## 4. P3 — polish

| # | Finding | Evidence | Suggested action |
|---|---|---|---|
| 4.1 | 19 FK columns have no covering index | DB heuristic query | One migration adding the missing indexes; extend the "adding a table" convention to include the index. Low urgency at current volume, grows with history. |
| 4.2 | Stale worktrees | `.worktrees/case-step-locks` (`18d5050`), `.worktrees/beneficiary-interventions-card` (`3ab2412`) | `git worktree remove` after merging or abandoning; they add graph/index noise and confusion. |
| 4.3 | 36 interpolated SQL sites | All inside `database/` (migrations, bootstrap, seeds) using internal constants; request paths are clean | An ESLint `no-restricted-syntax` rule banning `${` inside `query(` outside `src/database/**` locks the property in. |
| 4.4 | 63 `console.log` in server code | Concentrated in seed CLIs (`seed-demo` 17, `seed-team-demo` 13) + 3 in `main.ts` | Route app-path logs through the Nest logger; leave CLI seeds as they are. |
| 4.5 | New docs are invisible to git | `.gitignore:97` ignores `/docs`; 189 files are tracked, so the dir is half-managed. This audit and the case-lifecycle audit are local-only | Decide one way: force-add `docs/specs/**` + `docs/*-audit.md`, or move the audits out of `docs/` into a tracked path. Design docs nobody else can clone have limited value. |
| 4.6 | Backups exist, restore is unproven | `infra/backup/backup.sh`, `kapwa-server/scripts/backup.sh`, `docker-compose.backup.yml`; no restore script or drill documented | Add `restore.sh` + a scheduled rehearsal note. A backup that has never been restored is a hope. |

---

## 5. What is already good (keep it)

- **Security posture:** helmet, CSRF guard (with spec), refresh token in an `httpOnly` + `sameSite=strict` cookie (`secure` in prod), 224 handler-level `@Roles` declarations across 275 routes, `@Body(new ZodPipe(...))` on 91 of 103 bodies, audit log with **hash-chained** triggers (spec exists), PII masking interceptor (spec exists).
- **Testing discipline:** 143 + 164 spec files, coverage gates in CI (80.2 % statements / 71.9 % branches), plus parity tests that hold client and server agree (FSM fixture, i18n fil/en).
- **Delivery:** 4 CI jobs including a docker-build of both images; multi-stage Dockerfiles with a non-root `appuser` (server) and a dedicated nginx security-headers file (client); `/health/live` + `/health/ready`; deploys watched to completion.
- **Data discipline:** 0 tables without a primary key; the last schema work added real FKs (migration 98) rather than leaving bare UUIDs; enum vocabularies validated at the API edge.
- **Client craft:** route-level code splitting + prefetch, typed API keys, a real design system, and copy in both locales.

---

## 6. Suggested order of work

1. **Deps first pass + `npm audit --omit=dev` CI gate** (§2.1) — half a day.
2. **Dual-path schema CI job** (§2.2) — half a day, prevents a whole bug class.
3. **Mailer redaction + prod-fatal SMTP** (§2.3) and **auth rate limits** (§2.4) — half a day together.
4. **Monitoring** (§3.1) then **bundle diet** (§3.2) — one day each.
5. **Playwright smoke suite** (§3.3) — start with three tests and grow.

---

## 7. Limits of this audit

- No load or concurrency testing; no profiling of slow queries (the DB is the dev instance, near-empty).
- The codebase graph generation is 2 days older than this revision; structural claims come from `metadata_match` paths only (`gis-export.service`, `programs.service`, `case-step-locks.service`, `migrate.ts`, `CaseViewPage`, `constants.ts`).
- PII-in-logs, accessibility and i18n coverage were assessed by targeted greps, not exhaustively — treat counts as lower bounds.
- Browser behaviour was not re-exercised during this audit; the UI findings come from code and build evidence.
- `npm audit` reflects the registry snapshot of 2026-10-16.
