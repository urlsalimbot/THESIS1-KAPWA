---
phase: 15-core-module-tests
plan: 02
subsystem: testing
tags: [vitest, coverage-v8, auth-context, login, mfa, useauth, getCurrentUser, cancelMfa, per-file-threshold]

# Dependency graph
requires:
  - phase: 15-01
    provides: "@vitest/coverage-v8@4.1.10 installed + per-file 70% threshold gate in vite.config.ts + coverage:check script"
  - phase: 14-api-client-swr
    provides: "D-15 carve-out (pre-auth flows /auth/login + /auth/mfa/verify stay on raw fetch — tests stub global fetch instead of mocking the api client)"
  - phase: 12-test-harness
    provides: "vitest 4.1.9 + @testing-library/react 16.3.2 + vi.stubGlobal('fetch', vi.fn()) + vi.unstubAllGlobals + localStorage mock in tests/setup.ts"
provides:
  - "10 new tests for auth-context.tsx public surface (login + MFA + useAuth + getCurrentUser + cancelMfa) split across 2 new test files"
  - "auth-context.login.test.tsx — 5 tests for D-10 (login success, login+MFA, login error, resolveMfa success, resolveMfa error)"
  - "auth-context.useauth.test.tsx — 5 tests for D-11 (useAuth + getCurrentUser 3 cases) + D-12 (cancelMfa)"
  - "auth-context.tsx now at 93.1% statements / 80% branches / 100% functions / 94.23% lines (all above the 70% per-file threshold) — TST-02 satisfied"
affects:
  - phase 15 plan 03 (offline-queue coverage)
  - phase 15 plan 04 (secure-storage coverage)
  - phase 17 (CI integration of coverage:check)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-test AuthProbe duplication (D-13) — each new test file gets its own AuthProbe helper to stay self-contained, no shared test-utility extraction"
    - "AuthProbe passes the FULL auth context (auth object with all 8 fields) to the onAuth callback — not the partial {user, token, mfaChallenge} shape in PATTERNS.md. The PATTERNS.md example was inconsistent (declared captured: ReturnType<typeof useAuth> but only passed 3 fields); passing the full auth object matches the declared type and gives tests access to login/resolveMfa/cancelMfa"
    - "vi.useFakeTimers + runAllTimersAsync for the getCurrentUser fetch-error test — the api.get retry backoff is 500+1500+4500ms (6500ms+) which exceeds the 5s default vitest timeout; fake timers flush the backoff instantly. Same pattern as api.test.ts:146-164"
    - "fetchMock.mock.calls.length === 1 assertion for cancelMfa — proves cancelMfa does NOT fire any additional fetch (it only calls setMfaChallenge(null))"

key-files:
  created:
    - "kapwa-client/src/lib/auth-context.login.test.tsx (177 lines, 5 tests in 1 describe block)"
    - "kapwa-client/src/lib/auth-context.useauth.test.tsx (144 lines, 5 tests in 3 describe blocks)"
  modified: []

key-decisions:
  - "Split Task 1+2 into 2 atomic commits for git bisect: Task 1 (5 login/MFA tests) in 5a7722e, Task 2 (5 useAuth/getCurrentUser/cancelMfa tests) in e056b20 — same pattern as Plan 15-01's split"
  - "AuthProbe passes the full auth object (auth from useAuth()) instead of the partial {user, token, mfaChallenge} shape in PATTERNS.md — the partial shape doesn't have login/resolveMfa/cancelMfa which the tests need to invoke. This is a fix for an inconsistency in the patterns file, not a deviation from plan intent"

patterns-established:
  - "Self-contained AuthProbe per test file: the 2 new test files duplicate the AuthProbe helper (no shared test-utility module) per D-13 file-split pattern — keeps each file readable in isolation and avoids the cross-file import cycle that a shared helper would create"
  - "vi.useFakeTimers + runAllTimersAsync loop is the standard pattern for testing api.get retry paths (matches api.test.ts:146-164) — used here for the getCurrentUser fetch-error branch"

requirements-completed:
  - TST-02

# Metrics
duration: 12 min
completed: 2026-07-07
status: complete
---

# Phase 15 Plan 02: Auth-Context Coverage Tests Summary

**Added 10 new tests for the auth-context.tsx public surface (login + MFA + useAuth + getCurrentUser + cancelMfa) split across 2 new test files, pushing `auth-context.tsx` from 19.18% lines to 94.23% lines — all above the 70% per-file threshold required by TST-02.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-07T03:23:00Z
- **Completed:** 2026-07-07T03:35:00Z
- **Tasks:** 3
- **Files created:** 2 (auth-context.login.test.tsx, auth-context.useauth.test.tsx)
- **Files modified:** 0
- **Commits:** 2 (Task 1 + Task 2; Task 3 is verification + summary only, no commit per the plan)

## Accomplishments

- Created `auth-context.login.test.tsx` with 5 tests covering D-10 (login success, login+MFA, login error, resolveMfa success, resolveMfa error) — 177 lines, follows the existing `AuthProbe + MemoryRouter + AuthProvider + vi.stubGlobal('fetch') + localStorage.clear()` pattern
- Created `auth-context.useauth.test.tsx` with 5 tests covering D-11 (useAuth + getCurrentUser 3 cases) + D-12 (cancelMfa) — 144 lines, 3 describe blocks
- `auth-context.tsx` now at **93.1% statements / 80% branches / 100% functions / 94.23% lines** (all above the 70% per-file threshold)
- Full vitest suite: **254 tests passing across 49 test files** (244 from before + 10 new = no regression)
- Login success test asserts `localStorage.getItem('kapwa_token') === 'tok-1'` (the access token from the mock response)
- Login MFA test asserts `mfaChallenge === { tempToken: 'temp-1' }` AND `localStorage.getItem('kapwa_token')` is null (token NOT set until resolveMfa)
- Login error test asserts the promise rejects with `Error('Login failed')` AND token remains null
- resolveMfa success test asserts user is set + mfaChallenge is cleared + token is updated to the new access token
- resolveMfa error test asserts the promise rejects with `Error('MFA verification failed')` AND token remains null
- cancelMfa test asserts `mfaChallenge === null` AND `fetchMock.mock.calls.length === 1` (no additional fetch from cancelMfa)
- getCurrentUser tests cover all 3 branches: no token (returns null + no fetch), token + 200 (returns user), token + fetch error (returns null via catch — uses fake timers to flush the 6500ms+ retry backoff instantly)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth-context.login.test.tsx with 5 login + resolveMfa tests** — `5a7722e` (test)
2. **Task 2: Create auth-context.useauth.test.tsx with 5 useAuth + getCurrentUser + cancelMfa tests** — `e056b20` (test)
3. **Task 3: Verify coverage + full suite + plan summary** — no commit (verification only; SUMMARY.md committed by orchestrator)

## Files Created/Modified

- `kapwa-client/src/lib/auth-context.login.test.tsx` — NEW file, 177 lines, 5 tests in 1 describe block (D-10): login success sets user + token, login returns MFA challenge (token NOT set), login error throws + token null, resolveMfa success sets user + token + clears mfaChallenge, resolveMfa error throws + token null
- `kapwa-client/src/lib/auth-context.useauth.test.tsx` — NEW file, 144 lines, 5 tests in 3 describe blocks (D-11 + D-12): useAuth returns context with all 8 fields, getCurrentUser 3 branches (no token, token + 200, token + fetch error), cancelMfa clears state without firing additional fetch

## Decisions Made

- **AuthProbe passes the full auth object, not the partial {user, token, mfaChallenge} shape:** The PATTERNS.md example declared `captured: ReturnType<typeof useAuth> | null` (the full auth type) but the AuthProbe helper only passed `{user, token, mfaChallenge}` to onAuth. This is inconsistent — the test code calls `captured!.login(...)` etc. but the partial shape has no `login`. The fix is to pass the full auth object (`onAuth(auth)`), which matches the declared type and gives tests access to `login`, `resolveMfa`, `cancelMfa`. This is a fix for an inconsistency in the patterns file, not a deviation from plan intent — the plan's tests can't work without the full auth object.
- **vi.useFakeTimers + runAllTimersAsync for getCurrentUser fetch-error test:** The api.get retry path has 500+1500+4500ms backoff (6500ms+ total) which exceeds the 5s default vitest timeout. Using `vi.useFakeTimers()` + looping `await vi.runAllTimersAsync()` flushes the backoff instantly. This matches the established pattern in `api.test.ts:146-164` for the same retry-path testing. The plan's test description ("sets the token; mocks fetch to reject with TypeError; awaits `getCurrentUser()`; asserts return value is null") didn't explicitly call out fake timers, but the test would time out without them — Rule 1 auto-fix to make the test pass.
- **Split Task 1+2 into 2 atomic commits:** Same pattern as Plan 15-01's commit split — Task 1 covers the login/MFA flow, Task 2 covers the useAuth/getCurrentUser/cancelMfa flow. Two atomic commits for git bisect + makes the deviation (PATTERNS.md AuthProbe inconsistency fix) visible in the git history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AuthProbe passes full auth object instead of partial {user, token, mfaChallenge}**
- **Found during:** Task 1 (first test run)
- **Issue:** PATTERNS.md lines 181-186 show the AuthProbe helper passing only `{user, token, mfaChallenge}` to onAuth, but the test code declares `let captured: ReturnType<typeof useAuth> | null` and calls `captured!.login(...)` etc. The partial shape has no `login` function — the first test run failed with `TypeError: captured.login is not a function` on all 5 login tests.
- **Fix:** Changed AuthProbe to pass the full auth object (`onAuth(auth)`) so the declared type matches the runtime value. The new AuthProbe signature: `onAuth: (auth: ReturnType<typeof useAuth>) => void` and body: `onAuth(auth)`. The existing test file's AuthProbe (which only uses user + token) still works — it just receives more fields than it needs.
- **Files modified:** `kapwa-client/src/lib/auth-context.login.test.tsx`, `kapwa-client/src/lib/auth-context.useauth.test.tsx`
- **Verification:** All 5 tests in login.test.tsx pass, all 5 tests in useauth.test.tsx pass after this fix
- **Committed in:** `5a7722e` (Task 1 commit; same fix applied to Task 2 in `e056b20`)

**2. [Rule 1 - Blocking] Added vi.useFakeTimers + runAllTimersAsync to getCurrentUser fetch-error test**
- **Found during:** Task 2 (first test run)
- **Issue:** The plan's test 4 ("returns null on fetch error") mocks fetch to reject with TypeError, then calls `getCurrentUser()`. The api.get internally retries on TypeError with 500+1500+4500ms backoff (6500ms+), which exceeds the 5s default vitest timeout. The first test run failed with `Error: Test timed out in 5000ms`.
- **Fix:** Wrapped the test in `vi.useFakeTimers()` + looped `await vi.runAllTimersAsync()` to flush the backoff timers instantly. Then `vi.useRealTimers()` in a `finally` block. This matches the established pattern in `api.test.ts:146-164` for testing the same retry path.
- **Files modified:** `kapwa-client/src/lib/auth-context.useauth.test.tsx`
- **Verification:** Test passes in 484ms (the same suite run time) instead of timing out at 5000ms
- **Committed in:** `e056b20` (Task 2 commit)

**3. [Rule 3 - Blocking] Ran vitest from kapwa-client/ subdir, not project root**
- **Found during:** Task 1 verification
- **Issue:** First attempt ran `npx vitest run src/lib/auth-context.test.tsx` from the project root, which failed all 3 existing tests with `TypeError: Cannot read properties of undefined (reading 'setItem')` because the test config (vite.config.ts + tests/setup.ts) lives in `kapwa-client/`. Vitest from the project root can't find the config.
- **Fix:** Set `workdir: /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client` on all vitest invocations. Same for the existing tests (auth-context.test.tsx) — they pass when run from kapwa-client/.
- **Files modified:** None (no code change, just shell command correction)
- **Verification:** `npm run test:run` from kapwa-client/ shows 254/254 tests passing
- **Committed in:** N/A (no code change)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 environment)
**Impact on plan:** All deviations necessary for the tests to actually run and pass. No scope creep — the 10 new tests cover exactly the D-10, D-11, D-12 scenarios specified in the plan. The PATTERNS.md AuthProbe inconsistency was a plan/precedent bug that the patterns file's own example would have failed with.

## Issues Encountered

- **PATTERNS.md AuthProbe inconsistency:** The patterns file's AuthProbe example (lines 181-186) declares the type as the full `ReturnType<typeof useAuth>` but only passes `{user, token, mfaChallenge}` to onAuth. This inconsistency would cause ANY test using the patterns file's AuthProbe to fail with "captured.login is not a function". The plan's task code (e.g., line 209 `await captured!.login('a@b.com', 'pass')`) cannot work with the patterns file's AuthProbe. The fix is to pass the full auth object. The patterns file should be updated to reflect this — but that's a separate task (could be Plan 15-04 docs cleanup, or a future plan).
- **getCurrentUser fetch-error test timing out:** As documented in deviation #2 — the api.get retry backoff exceeds the 5s vitest default. Fixed with fake timers.
- **Vitest must run from kapwa-client/:** The vite.config.ts is in kapwa-client/ and tests/setup.ts is in kapwa-client/tests/. Running `npx vitest` from the project root fails to find the config. Fixed by setting workdir to kapwa-client/ on all vitest invocations.

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| File 1 exists | `ls -la kapwa-client/src/lib/auth-context.login.test.tsx` | exists, 177 lines ✓ |
| File 2 exists | `ls -la kapwa-client/src/lib/auth-context.useauth.test.tsx` | exists, 144 lines ✓ |
| 5/5 login tests pass | `npx vitest run src/lib/auth-context.login.test.tsx` | `Tests  5 passed (5)` ✓ |
| 5/5 useauth tests pass | `npx vitest run src/lib/auth-context.useauth.test.tsx` | `Tests  5 passed (5)` ✓ |
| 3/3 existing tests pass | `npx vitest run src/lib/auth-context.test.tsx` | `Tests  3 passed (3)` ✓ |
| 13/13 combined auth-context tests | `npx vitest run src/lib/auth-context*.test.tsx` | `Tests  13 passed (13)` ✓ |
| `auth-context.tsx` ≥70% statements | `npm run coverage` (auth-context.tsx row) | `93.1% Stmts` ✓ |
| `auth-context.tsx` ≥70% functions | `npm run coverage` (auth-context.tsx row) | `100% Funcs` ✓ |
| `auth-context.tsx` ≥70% lines | `npm run coverage` (auth-context.tsx row) | `94.23% Lines` ✓ |
| `auth-context.tsx` ≥60% branches | `npm run coverage` (auth-context.tsx row) | `80% Branches` ✓ |
| `api.ts` still ≥70% (no regression) | `npm run coverage` (api.ts row) | `74.19% Stmts / 74.1% Lines` ✓ |
| Full suite passes (no regression) | `npm run test:run` | `Tests  254 passed (254)` ✓ |
| Full suite test count | `npm run test:run` | `Test Files  49 passed (49)` ✓ |
| 2 task commits | `git log --oneline -3` | `5a7722e`, `e056b20` ✓ |

## Coverage Report (this plan's contribution)

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
api.ts             |   74.19 |     75.4 |   79.16 |    74.1 | 163-173,176,178,191-218
auth-context.tsx   |    93.1 |       80 |     100 |   94.23 | 54-59
offline-queue.ts   |   21.83 |     43.9 |       8 |   24.67 | 32-148,173,180-191
secure-storage.ts  |   21.42 |    16.66 |      50 |   21.42 | 7,16,21-49,57-69,78-86,93-106
```

- `auth-context.tsx` passes the per-file 70% threshold for all metrics (93.1/100/80/94.23) ✓ — TST-02 satisfied
- `api.ts` still passes the per-file 70% threshold (74.19/79.16/75.4/74.1) ✓ — no regression from Plan 15-01
- `offline-queue.ts` (24.67% lines) and `secure-storage.ts` (21.42% lines) are still below threshold — this is expected and will be fixed in Plans 15-03 and 15-04
- `api-error.ts` not shown in the table (it's at 100% statements/functions/lines per Plan 15-01)

## Self-Check: PASSED

- [x] `auth-context.login.test.tsx` exists at `kapwa-client/src/lib/` with 5 passing tests (1 describe block: `AuthProvider — login`)
- [x] `auth-context.useauth.test.tsx` exists at `kapwa-client/src/lib/` with 5 passing tests (3 describe blocks: `useAuth`, `getCurrentUser`, `cancelMfa`)
- [x] The 3 existing tests in `auth-context.test.tsx` still pass with no regression (verified via `npx vitest run src/lib/auth-context*.test.tsx` → 13/13 pass)
- [x] `auth-context.tsx` reports **94.23% lines** in the per-file coverage table (well above 70%)
- [x] Login success test asserts `localStorage.getItem('kapwa_token') === 'tok-1'` (the access token)
- [x] Login MFA test asserts `mfaChallenge === { tempToken: 'temp-1' }` AND `localStorage.getItem('kapwa_token')` is null
- [x] Login error test asserts the promise rejects with `Error('Login failed')` AND token is null
- [x] resolveMfa success test asserts user is set + mfaChallenge is cleared + token is updated to the new access token
- [x] resolveMfa error test asserts the promise rejects with `Error('MFA verification failed')` AND token remains null
- [x] cancelMfa test asserts `mfaChallenge === null` AND `fetchMock.mock.calls.length === 1` (only the original login call, no additional fetch)
- [x] getCurrentUser tests cover all 3 branches: no token (returns null + fetch never called), token + 200 (returns user object), token + fetch error (returns null via catch)
- [x] No code comments added beyond the `// Expose full auth context...` 1-line note in AuthProbe (matches the existing test file's comment style)
- [x] No emoji, no decorative formatting
- [x] `auth-context.tsx` is instrumented by the v8 coverage provider (per Plan 15-01's coverage block)
- [x] Plan summary `15-02-SUMMARY.md` created with 2 commit hashes (`5a7722e`, `e056b20`), list of 10 new tests, auth-context.tsx coverage %, and self-check
- [x] Full suite passes with no regression: 254 tests across 49 test files (244 before + 10 new)

## Known Stubs

None — all 10 new tests are real, executable tests that pass.

## Next Phase Readiness

- **Plan 15-03 ready:** `offline-queue.ts` is at 24.67% lines (below 70% threshold). The 3 new test files in Plan 15-03 (`offline-queue.queue.test.ts`, `offline-queue.conflict.test.ts`, `offline-queue.versions.test.ts`) will push it above the threshold.
- **Plan 15-04 ready:** `secure-storage.ts` is at 21.42% lines (below 70% threshold). The 2 new test files in Plan 15-04 (`secure-storage.browser.test.ts`, `secure-storage.native.test.ts`) will push it above the threshold.
- **Phase 17 (CI integration) ready:** Once Plans 15-03 and 15-04 are complete, `npm run coverage:check` will exit zero (all 4 modules above threshold). Phase 17 will add a GitHub Actions workflow that runs it on push.

---

*Phase: 15-core-module-tests*
*Plan: 02 — Auth-Context Coverage Tests*
*Completed: 2026-07-07*
