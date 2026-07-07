# Phase 15: Core Module Tests - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

## Phase Boundary

Achieve ≥70% line coverage on the four most critical client-side data modules (`api.ts`, `auth-context.tsx`, `offline-queue.ts`, `secure-storage.ts`) by adding unit tests with vitest + @testing-library/react, installing `@vitest/coverage-v8` for measurement, and enforcing the 70% threshold per module via the v8 provider config. Tests are split per concern into 8-12 test files (2-3 per module) for maintainability. Four-plan delivery: one plan per module, each independently shippable with its own coverage checkpoint.

## Implementation Decisions

### Coverage Tool Setup
- **D-01:** Install `@vitest/coverage-v8` as a devDependency. Add a `coverage` script in `package.json` that runs `vitest run --coverage`. Add a `coverage:check` script that fails if any of the 4 modules drops below 70% lines (CI gate per success criteria #5).
- **D-02:** Configure v8 provider in `vite.config.ts` under `test.coverage`: `provider: 'v8'`, `include: ['src/lib/{api,api-error,auth-context,offline-queue,secure-storage}.{ts,tsx}']`, `exclude: ['**/*.test.{ts,tsx}', '**/types.ts', '**/index.ts']`, `thresholds: { perFile: true, lines: 70, functions: 70, branches: 60, statements: 70 }`. Per-file thresholds are the gate; the aggregate ≥70% is implied.
- **D-03:** CI gate deferred to Phase 17 (which owns the CI pipeline per TST-07). For Phase 15, the `coverage:check` script is wired and runnable, but not yet integrated into any CI workflow. Document the script in the `package.json` README block.

### Test Depth per Module
- **D-04:** Target: 1 test per branch (~50-65 new tests total across 4 modules). Roughly 3-5 new tests for api.ts (uncovered exports), 8-10 for auth-context.tsx, 25-30 for offline-queue.ts, 6-8 for secure-storage.ts. Exhaustive edge cases (null, undefined, malformed input) are in scope where they exercise the contract; property-based / fuzz tests are deferred.
- **D-05:** offline-queue.ts strategy: test via the 14 public exports individually (1-3 tests each). No integration tests between exports (e.g., "queueChange then markSynced then getPendingChanges returns empty") — the unit tests cover the public API surface; the integration paths are exercised by the existing `sync-conflict.test.ts` file.
- **D-06:** Per-module coverage target = 70% lines (matches ROADMAP success criteria #5). Functions and branches are tracked but not blocking per the v8 threshold config in D-02 — if a module hits 70% lines but 65% branches, that's acceptable. The blocker is dropping below 70% lines.

### Secure-Storage Native Path
- **D-07:** Test both browser and native paths in jsdom using `vi.mock('@capacitor-community/sqlite', () => ({ CapacitorSQLite: { createConnection: vi.fn().mockResolvedValue(...), open: vi.fn().mockResolvedValue(...), close: vi.fn().mockResolvedValue(...), query: vi.fn().mockResolvedValue({ values: [] }), execute: vi.fn().mockResolvedValue({ changes: 1 }) } }))`. Toggle `Capacitor.isNativePlatform()` via `vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true/false)`.
- **D-08:** Test the corruption path: mock `encryptedDb.getItem` to throw / return malformed JSON. Verify `SecureStorage.getItem` returns null + logs the error. ~2-3 tests for the error boundary.
- **D-09:** Test `SecureStorage.init` (browser path: `encryptedDb.init()` is called; native path: `CapacitorSQLite.createConnection` + `open` + `execute` + `close` are called in order). Verify the password-derivation path reads `kapwa_db_key` from localStorage as the fallback.

### Login + MFA Test Fixtures
- **D-10:** Mock the global `fetch` (since `/auth/login` and `/auth/mfa/verify` stay on raw fetch per D-15 from Phase 14). Test 4 scenarios: (1) login success returns user + sets token, (2) login returns MFA challenge, sets `mfaChallenge` state, (3) login error throws, (4) resolveMfa success clears MFA challenge + sets user, (5) resolveMfa error throws. ~5 tests.
- **D-11:** Test `useAuth()` returns the context value via a mocked provider + consumer. Test `getCurrentUser()` (standalone helper) with 3 cases: (1) token present returns user, (2) token missing returns null, (3) fetch error returns null. ~4 tests.
- **D-12:** Test the `cancelMfa()` function clears `mfaChallenge` state without firing any fetch. ~1 test.

### Test File Structure
- **D-13:** Split each module into 2-3 test files. Total ~12 test files:
  - **api.ts** (1 file, existing): `api.test.ts` (16 existing + 3-5 new for KAPWA_AUTH_LOGOUT_EVENT export, internal retry edge cases)
  - **api-error.ts** (1 file, existing): `api-error.test.ts` (4 existing — no additions needed)
  - **auth-context.tsx** (3 files, new + existing):
    - `auth-context.test.tsx` (existing 3 tests: logout subscriber + fetchUser)
    - `auth-context.login.test.tsx` (new: D-10 5 tests)
    - `auth-context.useauth.test.tsx` (new: D-11 + D-12 5 tests)
  - **offline-queue.ts** (3 files, new + existing):
    - `offline-queue.test.ts` (existing 2 tests: loadQueue)
    - `offline-queue.queue.test.ts` (new: D-05 queueChange, getPendingChanges, queueFsmTransition ~7 tests)
    - `offline-queue.conflict.test.ts` (new: markSynced, markConflict, markFailed, mergeRecords, resolveConflict, getConflictChanges ~10 tests)
    - `offline-queue.versions.test.ts` (new: incrementLocalVersion, updateServerVersion, getVersionVector, getAllVersionVectors ~8 tests)
  - **secure-storage.ts** (3 files, new + existing):
    - `secure-storage.test.ts` (existing 3 tests: platform check + missing key)
    - `secure-storage.browser.test.ts` (new: D-08 corruption + D-09 browser init ~4 tests)
    - `secure-storage.native.test.ts` (new: D-07 native init + getItem + setItem + removeItem ~4 tests)
- **D-14:** All test files use the same vitest setup as Phase 14 (jsdom env, `vi.stubGlobal('fetch', vi.fn())` for tests that exercise network paths, `vi.mock('./encrypted-db', ...)` for secure-storage browser path). No changes to the global `vite.config.ts` test config beyond adding the `coverage` block per D-02.

### Migration Order
- **D-15:** Four-plan bottom-up: api first (mostly done), then auth-context, then offline-queue, then secure-storage. Each plan is independently shippable with its own coverage checkpoint. Coverage tool installation is in Plan 15-01 (the api plan) so all subsequent plans can verify against the threshold.
- **D-16:** Plan 15-01 = install @vitest/coverage-v8 + add new api tests (KAPWA_AUTH_LOGOUT_EVENT + edge cases) + verify api.ts ≥70%. Plan 15-02 = add auth-context login/MFA/useAuth tests across 2 new files + verify auth-context.tsx ≥70%. Plan 15-03 = add offline-queue tests across 3 new files + verify offline-queue.ts ≥70%. Plan 15-04 = add secure-storage tests across 2 new files + verify secure-storage.ts ≥70% + final full-suite coverage report.

### the agent's Discretion
- Specific test names (use descriptive: `login() with valid credentials sets user + token`, not `test1`)
- Whether to add `console.warn` mocks for the `kapwa:auth:logout` subscriber's log line (D-12 / D-15 carve-out)
- Exact test ordering within `describe` blocks (logical flow: happy path → error path → edge case)
- Whether to use `vi.useFakeTimers()` for `incrementLocalVersion` / `updateServerVersion` (which set `lastSyncedAt = new Date().toISOString()` — could freeze the clock for determinism, or rely on the timestamp being non-empty)

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, Kapwa stack, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements TST-01 (api.ts), TST-02 (auth-context), TST-03 (offline-queue), TST-04 (secure-storage)
- `.planning/ROADMAP.md` — Phase 15 boundary, success criteria #1-5 (CRUD, login/logout/roles, queue/conflict/versions, encrypt/decrypt/key-rotation/corrupted, ≥70% lines)
- `.planning/phases/14-api-client-swr/14-CONTEXT.md` — D-15 carve-out (auth.ts /auth/refresh + auth-context /auth/login + /auth/mfa/verify stay on raw fetch), D-10 (FormData/blob flows stay on raw fetch)
- `.planning/phases/14-api-client-swr/14-01-SUMMARY.md` — ApiError class + api object + queryKeys factory + SWRConfig
- `.planning/phases/12-toolchain-cleanup-vitest-upgrade/12-CONTEXT.md` — D-04 (RTL v16.3.2 supports React 18||19), D-08 (vitest include pattern `src/**/*.test.{ts,tsx}`)

### Codebase Maps
- `.planning/codebase/TESTING.md` — Current test framework (Vitest v4.1.9, jsdom)
- `.planning/codebase/CONVENTIONS.md` — Relative imports only, no `@/*` aliases
- `.planning/codebase/STRUCTURE.md` — `kapwa-client/src/lib/` is the service-layer home; tests co-located beside source

### Package Configuration
- `kapwa-client/package.json` — Add `@vitest/coverage-v8` to devDependencies; add `coverage` + `coverage:check` scripts
- `kapwa-client/vite.config.ts` — Add `test.coverage` block per D-02; preserve existing test config

### Source Modules to Test
- `kapwa-client/src/lib/api.ts` (220 lines, 7 exports: `api`, `KAPWA_AUTH_LOGOUT_EVENT`, `uploadSignature`, `uploadReceipt`, `dataURItoBlob`, `downloadCsrPdf`, `exportIrfPdf`) — method-style api object + FormData/blob helpers (D-10 carve-out: 5 FormData/blob exports untested; `KAPWA_AUTH_LOGOUT_EVENT` is the only non-deferred uncovered export)
- `kapwa-client/src/lib/api-error.ts` (17 lines, 1 export: `ApiError`) — class with status/body/cause
- `kapwa-client/src/lib/auth-context.tsx` (123 lines, 3 exports: `AuthProvider`, `useAuth`, `getCurrentUser`) — provider, hook, standalone helper
- `kapwa-client/src/lib/offline-queue.ts` (192 lines, 14 exports) — queue + version vector + FSM transition + conflict resolution
- `kapwa-client/src/lib/secure-storage.ts` (109 lines, 1 export: `SecureStorage`) — platform-routing init/getItem/setItem/removeItem
- `kapwa-client/src/lib/encrypted-db.ts` — used by SecureStorage browser path; already has its own test file (out of Phase 15 scope but referenced)

### Existing Test Files
- `kapwa-client/src/lib/api.test.ts` (255 lines, 16 tests) — bearer, timeout, signal composition, 401 single-flight + refresh, retry on TypeError, no-retry on 4xx/5xx/POST/PUT/DELETE, exponential backoff, method shape, JSON body
- `kapwa-client/src/lib/api-error.test.ts` (29 lines, 4 tests) — class instantiation, status/body/cause, Error superclass
- `kapwa-client/src/lib/auth-context.test.tsx` (144 lines, 3 tests) — logout subscriber + fetchUser/api.get
- `kapwa-client/src/lib/offline-queue.test.ts` (23 lines, 2 tests) — loadQueue happy + empty
- `kapwa-client/src/lib/secure-storage.test.ts` (46 lines, 3 tests) — platform check + missing key + round-trip
- `kapwa-client/src/lib/query-keys.test.ts` (existing — out of Phase 15 scope)
- `kapwa-client/src/lib/swr-config.test.tsx` (existing — out of Phase 15 scope)
- `kapwa-client/src/lib/sync-conflict.test.ts` (existing — out of Phase 15 scope, but exercises offline-queue.ts indirectly)

## Existing Code Insights

### Reusable Assets
- **`@testing-library/react` v16.3.2** — already installed (Phase 12/13). Supports both jsdom + React 19. Used by all existing `*.test.tsx` files.
- **`vi.stubGlobal('fetch', vi.fn())` pattern** — used by all existing test files that exercise network paths. Pattern reusable for new login/resolveMfa tests.
- **`vi.mock('./encrypted-db', ...)` pattern** — used by existing `secure-storage.test.ts`. Reusable for browser-path corruption tests.
- **`@capacitor/core` `isNativePlatform()` mock pattern** — `vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)` — can be added; not yet used in existing tests.
- **Existing `*Test file*` pattern from `CaseTrackerPage.test.tsx`** — `// Mock fetch since this page uses raw fetch() calls` comment (per Phase 14 CONTEXT). This pattern is the precedent for new login/MFA tests that exercise raw fetch.

### Established Patterns
- **Test file naming:** `*.test.ts` for non-component tests, `*.test.tsx` for component tests. Co-located next to source file.
- **Test environment:** jsdom (DOM simulation) — `npm test` (vitest watch), `npm run test:run` (single run)
- **Vitest include pattern:** `src/**/*.test.{ts,tsx}` for co-located + `tests/**/*.test.ts` for e2e (per 12-D-08)
- **Describe/it structure:** `describe('module area')` → `it('specific behavior')` with clear, verb-led names
- **Mock setup:** `beforeEach` for shared state (localStorage.clear(), vi.stubGlobal), `afterEach` for cleanup (vi.unstubAllGlobals, vi.restoreAllMocks)
- **vi.mock hoisting:** top of file, before imports — already used by `secure-storage.test.ts`
- **NO comments in tests** — AGENTS.md "DO NOT ADD ANY COMMENTS unless asked" — except for `// Mock ...` style comments inherited from existing test patterns (per Phase 12 precedent — these are 1-line fixture notes, not code comments)

### Integration Points
- **`vite.config.ts` test block** — add `coverage:` sub-block per D-02
- **`package.json` scripts** — add `coverage` + `coverage:check` per D-01
- **`tests/setup.ts`** (if exists) — global mocks for localStorage + crypto + jsdom; may need updates for native platform mocks
- **`api.test.ts` and `auth-context.test.tsx`** — these are the most heavily exercised; new tests in Plan 15-01 and 15-02 must not break the existing 19 tests

## Specific Ideas

- **offline-queue `mergeRecords` conflict resolution rules** — the `FINANCIAL_FIELDS` set is the most important business logic: 4 field names (`amount`, `status`, `fundSource`, `disbursedAmount`) that take server-wins semantics. Each field deserves its own test case in `offline-queue.conflict.test.ts`.
- **auth-context `kapwa:auth:logout` event subscriber** — the existing test in `auth-context.test.tsx` lines 24-63 covers the happy path. New tests should cover the no-op case (event dispatched with no detail → still calls logout), the error-log case (event detail is malformed).
- **api.ts `KAPWA_AUTH_LOGOUT_EVENT` export** — currently untested. The existing 401-refresh-fail test in `api.test.ts` lines 126-143 indirectly exercises the event dispatch (the test listens for the event). The new test should verify the constant value + that it's the same string used in `auth-context.tsx` line 50.
- **secure-storage corruption path** — the catch in `getItem` (line 71) wraps the `encryptedDb.getItem` call. A test that mocks `encryptedDb.getItem` to throw a `SyntaxError` (from `JSON.parse`) should verify that `SecureStorage.getItem` returns `null` + logs the error.

## Deferred Ideas

- **Property-based testing (fast-check)** — for offline-queue's `mergeRecords` rules, generating random server/client objects and asserting invariants. Deferred (D-04 says 1 test per branch only).
- **Coverage report badge** — embedding the coverage % as a README badge. Deferred (cosmetic).
- **Coverage diff in CI comments** — automatically posting the coverage delta to a PR. Deferred (CI integration is Phase 17 per TST-07).
- **Mutation testing (stryker, etc.)** — verifying that the tests actually catch bugs by mutating the source. Deferred (heavyweight; not in Phase 15 scope).
- **Coverage of `kapwa-client/src/lib/sync.ts`** — currently has no test file; covered indirectly by `sync-conflict.test.ts`. Out of Phase 15 scope (only 4 modules are in scope per ROADMAP).
- **Coverage of `kapwa-client/src/lib/encrypted-db.ts`** — already has its own test file (per CONTEXT §"Reusable Assets"). Out of Phase 15 scope.

---

*Phase: 15-Core Module Tests*
*Context gathered: 2026-07-06*
