# Codebase Concerns

**Analysis Date:** 2026-06-19

## Tech Debt

### Sync Service Over-Engineering (sync.service.ts — 442 lines)

- **Issue:** The sync service at `kapwa-server/src/sync/sync.service.ts` is the largest file in the server at 442 lines. It bundles raw SQL queries, column allowlist sanitization, idempotency caching, Ed25519 verification, version vector management, and conflict detection into a single class. The `applyChange()` method (lines 240-292) generates SQL dynamically with `ON CONFLICT (id) DO UPDATE SET` patterns, creating a maintenance surface that's brittle.
- **Files:** `kapwa-server/src/sync/sync.service.ts`, `kapwa-server/src/sync/conflict-resolver.ts`
- **Impact:** Any schema change requires updating both `ALLOWED_COLUMNS` Set and `resolveTableName` Map. Raw SQL dynamic generation bypasses TypeORM entity safety. Error handling in `fetchServerRecord` silently returns `null` on any database error (line 307).
- **Fix approach:** Decompose into smaller services: `SyncSignatureService`, `SyncChangeApplier`, `SyncIdempotencyCache`. Use TypeORM QueryBuilder instead of raw SQL. Add schema introspection for column allowlisting.

### Schema Drift Risk (Raw SQL Migrations)

- **Issue:** `kapwa-server/src/database/migrate.ts` is a hand-written 104-line SQL script that manages schema via `CREATE TABLE IF NOT EXISTS` statements. The TypeORM data source `kapwa-server/src/database/data-source.ts` has `migrationsRun: true`, but the actual migrations directory (`src/database/migrations/`) contains 4 TypeORM migration classes that likely overlap or conflict with the raw SQL in `migrate.ts`. Package.json has `typeorm-ts-node-commonjs` CLI commands for proper migrations, but they're not integrated.
- **Files:** `kapwa-server/src/database/migrate.ts`, `kapwa-server/src/database/data-source.ts`, `kapwa-server/src/app.module.ts` (line 51: `migrationsRun: true`)
- **Impact:** Entity changes drift from database. Adding columns requires manual SQL updates in two places (migration files + migrate.ts). RLS policies are recreated on every migrate run (DROP/CREATE cycle).
- **Fix approach:** Eliminate `migrate.ts` entirely. Use TypeORM CLI `migration:generate` for all schema changes. Convert existing raw SQL to proper migration classes. Remove the duplicate `CREATE TABLE IF NOT EXISTS` in `migrate.ts`.

### Sub-50% Test Coverage

- **Issue:** Overall statement coverage is 46.36% (1084/2338 statements), branch coverage 29.13% (162/556), function coverage 36.11% (121/335). Several modules have 0% coverage:
  - `access-cards/` — 0 statements tested
  - `tracker/` — 0 statements tested
  - `lcr/` — 0 statements tested
  - `filing/` — massive gaps
  - `csr/` — 0 statements tested
  - `otp/` — 61/97 statements tested
  - Client: 0 test files detected (vitest configured but no tests written)
- **Files:** Coverage report at `kapwa-server/coverage/lcov-report/index.html`
- **Impact:** Continued development risks regression on untested modules. Spec requires ≥80% coverage (KAPWA-PROJECT.md §11).
- **Fix approach:** Write unit tests for uncovered modules starting with `access-cards/`, `tracker/`, `lcr/`. Target 80%+ coverage. Add client-side tests with vitest.

### NestJS Core Version Mismatch

- **Issue:** `package.json` lists `@nestjs/common` at `^10.3.0` but `@nestjs/core` at `^11.1.19`, `@nestjs/platform-express` at `^11.1.19`, and `@nestjs/typeorm` at `^11.0.1`. This version mismatch (v10 vs v11) can cause runtime incompatibilities.
- **Files:** `kapwa-server/package.json`
- **Impact:** Potential runtime errors from decorator/metadata API differences between NestJS v10 and v11. Dependency resolution may install duplicate versions.
- **Fix approach:** Align all `@nestjs/*` packages to the same major version. Run full test suite after alignment.

### TypeORM Alpha Dependency

- **Issue:** TypeORM is pinned to `^0.4.0-alpha.1` — an alpha pre-release version. This is inherently unstable for production use.
- **Files:** `kapwa-server/package.json`
- **Impact:** API breakage on minor updates. No semantic versioning guarantees. Bug fixes may introduce regressions.
- **Fix approach:** Pin to a stable TypeORM release (0.3.x series) or migrate to a supported version. Test all migration paths.

### Hardcoded Development URLs

- **Issue:** `kapwa-client/src/lib/auth-context.tsx:17` has `const API = 'http://localhost:3000/api'` hardcoded at the module level, completely ignoring the `VITE_API_URL` environment variable. The `api.ts` file correctly uses `import.meta.env.VITE_API_URL || 'http://localhost:3000/api'` (line 1), but `auth-context.tsx` bypasses this pattern.
- **Files:** `kapwa-client/src/lib/auth-context.tsx:17`, `kapwa-client/src/lib/api.ts:1`
- **Impact:** Auth context always points to localhost, making deployment configuration inconsistent. Production deployments require code changes to auth endpoint.
- **Fix approach:** Use `const API = import.meta.env.VITE_API_URL || '/api'` consistently across all client files. Remove hardcoded URL from `auth-context.tsx`.

### Ed25519 via `as any` Type Casts

- **Issue:** Both client (`kapwa-client/src/lib/sync.ts:22,46,53`) and server (`kapwa-server/src/sync/sync.service.ts`) use `{ name: 'Ed25519' } as any` to bypass TypeScript's lack of Ed25519 algorithm support. If the runtime (Node.js version or browser) doesn't support Ed25519, there's no compiler warning — only a runtime crash.
- **Files:** `kapwa-client/src/lib/sync.ts:22,46,53`, `kapwa-server/src/sync/sync.service.ts:396-418`
- **Impact:** Silent fallback to HMAC-SHA256 on the client (line 60-66 in sync.ts) means the Ed25519 requirement from the spec is not enforced. Server silently returns `false` on signature errors (line 416-418).
- **Fix approach:** Use a typed wrapper library for Ed25519 operations. Remove the HMAC fallback once proper Ed25519 is verified. Add Node.js version checks in server startup.

### In-Memory State Lost on Restart

- **Issue:** Three runtime in-memory caches lose all state on server restart:
  1. `SyncService.processedKeys` — idempotency cache (`sync.service.ts:47`) — unbounded, evicted by TTL only
  2. `ChatGateway.userSockets` — socket-to-user mapping (`chat.gateway.ts:23`)
  3. `ChatGateway.rateLimitMap` — per-user rate limit tracking (`chat.gateway.ts:24`)
- **Files:** `kapwa-server/src/sync/sync.service.ts:47`, `kapwa-server/src/chat/chat.gateway.ts:23-24`
- **Impact:** After restart: idempotency cache is cold (re-processing accepted), rate limits are reset, all WebSocket connections must re-authenticate.
- **Fix approach:** For idempotency, persist to database or Redis. For rate limiting, use `@nestjs/throttler` (already configured globally). For WebSockets, add reconnection with automatic room re-join.

## Known Bugs

### Audit Log Endpoint Returns Interventions Instead of Generic Audit Trail

- **Symptoms:** `GET /audit/logs` at `kapwa-server/src/audit/audit.controller.ts:22-30` calls `auditService.getAuditLog(table, recordId)` which only queries the `interventions` table regardless of the `table` parameter. It returns intervention data labeled as audit records from any table.
- **Files:** `kapwa-server/src/audit/audit.service.ts:37-50`
- **Trigger:** Any call to `GET /audit/logs?table=users&recordId=abc123` returns intervention records instead of user audit history.
- **Workaround:** None — the endpoint only works for interventions.

### SLA Service Loads All Records Without Pagination

- **Symptoms:** `SlaService.checkAndEscalate()` at `kapwa-server/src/sla/sla.service.ts:23-25,37-39` uses `.find({ where: { status } })` with no `.take()` limit, loading ALL pending and in-review cases into memory.
- **Files:** `kapwa-server/src/sla/sla.service.ts:23,37`
- **Trigger:** Running SLA escalation with >1000 pending cases will cause memory pressure and slow response times.
- **Workaround:** Only triggered by cron/scheduled task, but could be exploited via load.

### LCR Import Missing Pagination

- **Symptoms:** `LcrService.importRecord()` at `kapwa-server/src/lcr/lcr.service.ts:36-40` uses `.getMany()` with no `.take()` limit on the fuzzy match candidate query.
- **Files:** `kapwa-server/src/lcr/lcr.service.ts:36-40`
- **Trigger:** Importing records for people with common surnames (e.g., "Dela Cruz") could return hundreds of candidates.
- **Workaround:** Schema has pg_trgm index, but no limit means unbounded result sets.

### ABAC Guard Assigns Wrong Default Sensitivity

- **Symptoms:** The `AbacGuard` at `kapwa-server/src/auth/guards/abac.guard.ts:36-42` falls through to `abacService.getResourceSensitivity()` using `route?.path` from Express request, which may be undefined for nested routes. The fallback returns a potentially incorrect sensitivity level.
- **Files:** `kapwa-server/src/auth/guards/abac.guard.ts:36-42`
- **Trigger:** Routes with dynamic parameters or nested prefixes may get wrong sensitivity classification.
- **Workaround:** Manual testing of route-specific access.

### CSR Control Number Race Condition

- **Symptoms:** `CsrService` uses a single Postgres sequence `csr_seq_2026` defined in `kapwa-server/src/database/migrate.ts:43`. If the sequence wraps or year changes, control numbers collide.
- **Files:** `kapwa-server/src/database/migrate.ts:43`
- **Trigger:** Year rollover (2027) — sequence `csr_seq_2026` will continue generating numbers with "2026" prefix.
- **Workaround:** Requires manual migration to create `csr_seq_2027` before January 2027.

## Security Considerations

### .env File with Database Defaults

- **Risk:** The `.env` file at `kapwa-server/.env` exists on disk with `DB_PASSWORD` defaulting to `'kapwa'`. If this file contains actual credentials, they're stored in plaintext. If committed to git, credentials are exposed.
- **Files:** `kapwa-server/.env`
- **Current mitigation:** `.env` in `.gitignore` (standard practice), but file is on disk.
- **Recommendations:** Audit `.env` contents. Document required env vars in a `.env.example` file. In production, use a secrets manager or Podman secrets instead of `.env`.

### Hardcoded Dev DB Credentials Across All Config Files

- **Risk:** Three separate datasource configs (`data-source.ts`, `migrate.ts`, `seed.ts`, and `app.module.ts`) all use the same default credentials: `DB_USER='kapwa'`, `DB_PASSWORD='kapwa'`, `DB_NAME='kapwa'`. The standalone `compliance-audit.ts` does NOT use `ConfigModule` or environment injection.
- **Files:** `kapwa-server/src/database/data-source.ts:6-9`, `kapwa-server/src/database/migrate.ts:5-9`, `kapwa-server/src/database/seed.ts:6-9`, `kapwa-server/src/database/compliance-audit.ts:8-11`, `kapwa-server/src/app.module.ts:44-48`
- **Current mitigation:** Four of five configs use `process.env.* || 'fallback'` pattern.
- **Recommendations:** Centralize all database config in a single shared module. Remove fallback defaults in production builds. Make the compliance audit script use the AppDataSource instead of creating its own.

### ABAC Role Bypass Complexity

- **Risk:** The ABAC guard at `kapwa-server/src/auth/guards/abac.guard.ts` implements a complex role-permission matrix spanning 70+ lines with 7 different branches. Complex logic increases risk of misconfiguration — a new role added to the enum but missing from the guard will pass through to `return true` on line 72.
- **Files:** `kapwa-server/src/auth/guards/abac.guard.ts`
- **Current mitigation:** Admin role bypasses all checks (line 23). Claimants are restricted to public resources (line 61-63).
- **Recommendations:** Add a safety check that throws if user.role is unrecognized. Add unit tests for every role-sensitivity combination. Consider using a declarative policy table instead of imperative if-else chains.

### Silent Ed25519 Signature Verification Failure

- **Risk:** `SyncService.verifySignature()` at `kapwa-server/src/sync/sync.service.ts:390-418` catches all errors and returns `false`. While this means bad signatures are rejected, it also means configuration errors (e.g., missing key, wrong algorithm) are silently ignored and logged at `error` level but not surfaced to operations. The client-side fallback in `kapwa-client/src/lib/sync.ts:60-66` silently degrades from Ed25519 to HMAC-SHA256.
- **Files:** `kapwa-server/src/sync/sync.service.ts:390-418`, `kapwa-client/src/lib/sync.ts:37-68`
- **Current mitigation:** Server rejects all invalid signatures.
- **Recommendations:** Add health-check endpoint for sync signature verification. On client, surface the fallback to HMAC in logs/metrics. Remove the HMAC fallback entirely once Ed25519 is verified working on all target platforms.

### RLS Depends on Application-Set Session Parameters

- **Risk:** PostgreSQL RLS policies in `kapwa-server/src/database/migrate.ts:91-97` use `current_setting('app.current_role')` and `current_setting('app.current_barangay')`. If the application fails to set these session variables (e.g., via middleware bug), RLS defaults to empty string and may expose more data than intended.
- **Files:** `kapwa-server/src/database/migrate.ts:91-97`
- **Current mitigation:** Policy uses `ILIKE '%' || '' || '%'` which matches everything when barangay is empty — this is a potential bypass, not a mitigation.
- **Recommendations:** Set session variables in a NestJS middleware that runs before EVERY request. Add a fallback that restricts access when session params are not set. Audit the middleware implementation.

## Performance Bottlenecks

### SLA Check Loads Full Tables

- **Problem:** `SlaService.checkAndEscalate()` runs `.find({})` with no pagination on cases table, loading ALL records matching a status. With growth to thousands of cases, this will cause memory pressure and slow cron cycle times.
- **Files:** `kapwa-server/src/sla/sla.service.ts:23-48`
- **Cause:** Eager-loading without pagination or cursor-based iteration.
- **Improvement path:** Add `.take(100)` with offset/ID-based pagination. Process cases in batches. Add index on `status + created_at` for faster filtering.

### Sync `getChangesSince()` Queries Per-Table Without Pagination

- **Problem:** The sync service's `getChangesSince()` at `kapwa-server/src/sync/sync.service.ts:361-388` runs `SELECT * FROM "${table}" WHERE updated_at > $1` per version vector entry without `LIMIT`. For large tables, this returns entire table contents.
- **Files:** `kapwa-server/src/sync/sync.service.ts:361-388`
- **Cause:** No pagination or change windowing on server-to-client sync pull.
- **Improvement path:** Add `LIMIT 1000` with cursor-based pagination. Return a `hasMore` flag to let the client paginate. Add index on `updated_at` for all synced tables.

### Document Vault Cleanup Processes Entire History

- **Problem:** `FilingService.cleanupOlderThan()` at `kapwa-server/src/filing/filing.service.ts:67-77` processes ALL documents older than the cutoff in one query — no batching.
- **Files:** `kapwa-server/src/filing/filing.service.ts:67-77`
- **Cause:** Single `DELETE` query with `LessThan(cutoff)`.
- **Improvement path:** Add batch processing (e.g., `take: 100` per iteration) to avoid long-running transactions and table locks.

## Fragile Areas

### Sync Service (`sync.service.ts`)

- **Files:** `kapwa-server/src/sync/sync.service.ts` (442 lines)
- **Why fragile:** Combines raw SQL column allowlisting, Ed25519 crypto, idempotency caching, version vector management, and conflict detection in one class. The `ALLOWED_COLUMNS` set (lines 12-34) is a manual list of ~70 column names that must stay in sync with schema. The `resolveTableName` map (lines 312-326) is another manual mapping. Any schema change requires updating both.
- **Safe modification:** Always add new columns to `ALLOWED_COLUMNS` and verify `resolveTableName` includes the table. Add integration tests for any sync logic change.
- **Test coverage:** `sync.service.spec.ts` (180 lines), `sync.integration.spec.ts` (228 lines), `conflict-resolver.spec.ts` (150 lines) — moderate coverage.

### Raw SQL Migration File (`migrate.ts`)

- **Files:** `kapwa-server/src/database/migrate.ts` (104 lines)
- **Why fragile:** Hand-written raw SQL for 20+ tables, 20+ indexes, 5 RLS policies, and sequences. Duplicate column declarations, inconsistent CHECK constraints, and RLS policy DROP/CREATE cycle make this error-prone. Crashes on duplicate column errors (AUDIT-BUGS.md noted this was previously broken).
- **Safe modification:** Add new columns via TypeORM migration classes, NOT raw SQL. For schema changes, prefer entity `synchronize` in dev only. Test migration on a fresh database.
- **Test coverage:** No tests for migration file execution.

### Conflict Resolver Table Categorization

- **Files:** `kapwa-server/src/sync/conflict-resolver.ts` (153 lines)
- **Why fragile:** Hardcoded sets for `FINANCIAL_TABLES`, `NOTE_TABLES`, `CONSENT_TABLES` (lines 20-22) determine conflict resolution strategy per table. New tables added to the sync protocol must be categorized here. The `parseNotes()` function (lines 144-152) has XML-like parsing for unstructured note content.
- **Safe modification:** Add new table names to the appropriate set. For notes tables, ensure both `content` and `notes` fields are populated.
- **Test coverage:** `conflict-resolver.spec.ts` has 12 test cases covering all table types.

### ABAC Guard Role Matrix

- **Files:** `kapwa-server/src/auth/guards/abac.guard.ts` (74 lines)
- **Why fragile:** Complex if-else chain with 7 branches for 6 roles + fallthrough. Adding a new role requires updating every conditional. The guard checks barangay scoping via `query?.barangay || params?.barangay || body?.barangay` pattern (line 47, 55) — missing one source (e.g., `headers`) creates an access bypass.
- **Safe modification:** Convert to declarative policy table (role → allowedSensitivity → scope logic). Add tests for every (role, sensitivity, barangay) permutation.
- **Test coverage:** `abac.service.spec.ts` has basic tests (115 lines), but only tests `AbacService`, not the guard itself.

### Seed Data Hardcoded IDs

- **Files:** `kapwa-server/src/database/seed.ts` (95 lines)
- **Why fragile:** All 4 users, 3 beneficiaries, 2 cases, 2 households, etc. are created with hardcoded UUIDs and specific test credentials. Any schema change that adds non-nullable columns breaks the seed. The `TRUNCATE` statement (line 17) lists 15 tables but may miss newly added tables.
- **Safe modification:** Add new seeded entities with hardcoded IDs following the existing pattern. Update the TRUNCATE list when adding new tables.
- **Test coverage:** No automated tests validate seed data integrity.

## Scaling Limits

### localStorage Sync Queue (5MB Limit)

- **Current capacity:** The offline sync queue at `kapwa-client/src/lib/offline-queue.ts` stores pending changes and version vectors in `localStorage` via `JSON.stringify`. localStorage has a ~5MB limit per origin.
- **Limit:** With each queued change averaging ~500 bytes (JSON + metadata), the queue can hold roughly 10,000 pending changes before hitting limits. For field workers in areas with poor connectivity, this could be reached in a few days of offline work.
- **Scaling path:** Migrate to IndexedDB (using the `idb` wrapper library for simplicity) or implement the spec-mandated SQLCipher native storage via Capacitor. IndexedDB offers 50MB+ with async API.

### Single-Threaded Node.js Server

- **Current capacity:** The NestJS server runs on a single Node.js process (no `cluster` or PM2 fork mode detected).
- **Limit:** CPU-bound tasks (SLA checks, sync processing, large PDF generation) block the event loop for all other requests.
- **Scaling path:** Use Node.js `cluster` module or PM2 with `--cluster` mode to utilize multiple cores. For CPU-bound work (sync), offload to worker threads.

### Unbound Idempotency Cache Growth

- **Current capacity:** `SyncService.processedKeys` Map (`sync.service.ts:47`) has `MAX_CACHE_SIZE = 10,000` but entries persist in memory for 24h TTL. At maximum capacity, this holds ~10,000 sync responses in memory (estimated ~50MB+).
- **Limit:** Memory grows with sync volume. Under heavy sync load (e.g., crop season benefits distribution), cache could grow beyond 10K entries before TTL eviction kicks in.
- **Scaling path:** Move idempotency cache to Redis or database-backed storage. Set aggressive TTL (e.g., 1 hour for sync results).

## Dependencies at Risk

### `typeorm` `^0.4.0-alpha.1`

- **Risk:** Alpha pre-release software. API surface may change without notice. Security patches may not be backported.
- **Impact:** Any production deployment relies on software that's explicitly not stable. Breakage on minor updates.
- **Migration plan:** Pin to `typeorm@0.3.20` (latest stable) and test migration paths. The API is close enough that most imports should work.

### `esbuild` in Client Dependencies

- **Risk:** `esbuild` at `^0.28.0` is listed in `dependencies` (not `devDependencies`) at `kapwa-client/package.json:17`. This is a build tool that's included in the production bundle for no reason.
- **Impact:** Unnecessary production bundle size increase. Potential security surface for a build tool in runtime.
- **Migration plan:** Move `esbuild` to `devDependencies`.

### NestJS Version Mismatch

- **Risk:** `@nestjs/common@^10.3.0` vs `@nestjs/core@^11.1.19` — differing major versions cause potential decorator/metadata incompatibility.
- **Impact:** Runtime errors in dependency injection, guard resolution, or interceptor execution.
- **Migration plan:** Align all `@nestjs/*` packages to v11. Run full test suite.

### `thirty-two` for TOTP

- **Risk:** `thirty-two` at `kapwa-server/package.json:50` is a niche, rarely-updated package for base32 encoding used in TOTP secret generation. Has no recent updates.
- **Impact:** Potential security vulnerabilities in base32 encoding logic. No active maintenance.
- **Migration plan:** Replace with `@levanot/thirty-two` or use native `Buffer.from(secret, 'base64')`. The built-in `speakeasy` or `otplib` libraries are more actively maintained for TOTP.

## Missing Critical Features

### No Client-Side Tests

- **Problem:** `kapwa-client/package.json` configures `vitest` for testing, but no test files were found. Client-side code has zero test coverage.
- **Files:** `kapwa-client/` (entire src/)
- **Blocks:** Cannot verify React component rendering, API integration hooks, or offline sync behavior without client tests.
- **Priority:** High

### pgAudit Not Enabled in Production

- **Problem:** The `pgAudit` extension is installed in `kapwa-server/src/database/migrate.ts:20-23` but fails silently with `console.warn` if the extension isn't available (requires Postgres superuser). The `CREATE EXTENSION IF NOT EXISTS "pgAudit"` call is wrapped in try/catch that only logs a warning.
- **Files:** `kapwa-server/src/database/migrate.ts:19-23`
- **Blocks:** COA audit trail requirements per spec.
- **Priority:** Medium (blocked by Supabase superuser limitation per `audit-2026-06-17.md`)

### Capacitor Native Build Pending

- **Problem:** Capacitor is configured in `kapwa-client/package.json` with ios/android platforms but interactive `npx cap init` must be run manually. SQLCipher native storage for offline mode is not implemented.
- **Files:** `kapwa-client/package.json:12-16`
- **Blocks:** Offline SQLCipher storage, native push notifications, mobile deployment.
- **Priority:** Medium (blocked by interactive CLI setup per `audit-2026-06-17.md`)

### WCPD/PNP Secure Export

- **Problem:** `IrfService.exportWcpd()` at `kapwa-server/src/irf/irf.service.ts:105-151` exists but the endpoint has no controller route and no WCPD-specific export format.
- **Files:** `kapwa-server/src/irf/irf.service.ts:105-151`, `kapwa-server/src/irf/irf.controller.ts`
- **Blocks:** DSWD AO 2020-002 compliance for secure exports to Women and Children Protection Desk.
- **Priority:** Medium (legal compliance gap)

### Family Graph Visualization

- **Problem:** `GET /beneficiaries/:id/family-graph` endpoint exists, `getFamilyGraph()` exists in `kapwa-client/src/lib/api.ts:100-102`, but no React component renders the family graph visualization.
- **Files:** `kapwa-client/src/lib/api.ts:100-102`, `kapwa-server/src/beneficiaries/beneficiaries.service.ts`
- **Blocks:** Spec §5 family composition visualization feature.
- **Priority:** Medium

### Approval Pipeline UI

- **Problem:** No UI for Certificate of Eligibility view, Petty Cash Voucher preview, or Mayor/MSWDO Head e-sign workflow. The backend `CasesService.approve()` supports signature capture, but no client renders it.
- **Files:** `kapwa-server/src/cases/cases.service.ts:149-193`
- **Blocks:** Spec §7 Approval Pipeline screen.
- **Priority:** Medium

### Dynamic Form Versioning

- **Problem:** `FormVersionHistory` entity exists at `kapwa-server/src/programs/form-version-history.entity.ts` and migrations exist (`1742000000000-AddFormVersionHistory.ts`), but no service logic tracks form template versions or supports rollback.
- **Files:** `kapwa-server/src/programs/form-version-history.entity.ts`
- **Blocks:** Spec requirement for tracking program form changes over time.
- **Priority:** Low

## Test Coverage Gaps

### Modules with Zero or Near-Zero Coverage

- **What's not tested:**
  - `access-cards/` — 0% statement coverage (Code# generation, service logging)
  - `tracker/` — 0% statement coverage (daily case tracker CRUD)
  - `lcr/` — 0% statement coverage (LCR import/matching)
  - `csr/` — service partially tested, controller untested
  - `filing/` — file upload, delete, cleanup untested
  - `otp/` — only partial test coverage (61/97 statements)
  - `sla/` — escalation logic partially tested
- **Files:** All uncovered modules under `kapwa-server/src/`
- **Risk:** Unnoticed regressions in file upload, access card generation, LCR import, OTP verification, and SLA escalation.
- **Priority:** High

### Client-Side Testing Gap

- **What's not tested:** Entire `kapwa-client/src/` has zero tests. Critical components like `auth-context.tsx`, `api.ts`, `sync.ts`, `offline-queue.ts`, all page components.
- **Files:** `kapwa-client/src/` (entire)
- **Risk:** UI regressions, broken auth flows, sync data corruption go undetected.
- **Priority:** High

### ABAC Guard Not Directly Tested

- **What's not tested:** `abac.guard.ts` — only `abac.service.ts` has tests. The guard's complex if-else chain (7 role branches) has zero test coverage.
- **Files:** `kapwa-server/src/auth/guards/abac.guard.ts`
- **Risk:** Role bypass, incorrect barangay scoping, consent evaluation errors.
- **Priority:** Medium

---

*Concerns audit: 2026-06-19*
