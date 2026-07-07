# Phase 15: Core Module Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 15-Core Module Tests
**Areas discussed:** Coverage tool setup, Test depth per module, Secure-storage native path, Login + MFA test fixtures, Test file structure

---

## Coverage Tool Setup

### Provider (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| @vitest/coverage-v8 (Recommended) | V8's native coverage, fast, well-maintained. The default for Vitest 4.x. Includes line + branch + function coverage | ✓ |
| @vitest/coverage-istanbul | Older, more accurate for some edge cases, slower, transpiles | |
| No coverage tool, no threshold | Skip coverage tool — write tests, but no enforcement gate. (Violates ROADMAP success criteria #5) | |

**User's choice:** @vitest/coverage-v8 (Recommended)
**Notes:** Default for Vitest 4.x. v8 provider is fast and well-integrated.

### Threshold (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| CI gate (Recommended) | Configure v8 provider with thresholds.lines=70 per-file. Add npm script. CI gate in Phase 17 (TST-07) | ✓ |
| Local script + CI | Add coverage + coverage:check scripts; run in CI immediately | |
| Report only, no gate | Run npm run coverage, look at the report, decide manually. (Looser) | |

**User's choice:** CI gate (Recommended)
**Notes:** Script is wired and runnable in Phase 15; CI integration is Phase 17. Per-file threshold (70% lines) is the gate.

---

## Test Depth per Module

| Option | Description | Selected |
|--------|-------------|----------|
| 1 test per branch (~60 tests) | One test per exported function/symbol + 1-2 tests per edge case. ~50-70 total tests | ✓ |
| Exhaustive (~150 tests) | Every branch + boundary + error case + integration tests. 100-150+ tests | |
| Test pyramid: 80% per module | Each module gets a 1-test-per-symbol minimum + a deep test for the 1-2 highest-risk functions. ~80% target | |

**User's choice:** 1 test per branch (~60 tests)
**Notes:** Pragmatic — covers the public API surface + key edge cases without overengineering.

### offline-queue strategy (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Test via public API (Recommended) | Test the 14 public exports individually (1-3 tests each). ~25-30 tests | ✓ |
| Test via integration scenarios | Group by user-facing scenario: queue push, dequeue, conflict, version tracking. ~10-12 tests | |
| Mix: 80% public + 20% integration | 80% public-API + 20% integration. Catches both unit + interaction bugs. ~18-22 tests | |

**User's choice:** Test via public API (Recommended)
**Notes:** Simpler. Integration paths are exercised by `sync-conflict.test.ts` (out of Phase 15 scope but already exists).

---

## Secure-Storage Native Path

| Option | Description | Selected |
|--------|-------------|----------|
| vi.mock Capacitor (Recommended) | vi.mock('@capacitor-community/sqlite', ...). Test both browser and native paths in jsdom | ✓ |
| Skip native path, document carve-out | The native path requires an actual Android/iOS runtime. ~30-40% line coverage (browser path only) | |
| Capacitor.isNativePlatform() toggle | Mock isNativePlatform + dynamic SQLite import. More realistic but more setup | |

**User's choice:** vi.mock Capacitor (Recommended)
**Notes:** Standard pattern. Both paths fully tested in jsdom.

### Corruption path (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Test catch path returns null | Mock encryptedDb.getItem to throw / return malformed JSON. Test SecureStorage.getItem returns null + logs error. ~2-3 tests | ✓ |
| Skip corruption tests | encryptedDb is already well-tested. SecureStorage test focuses on routing/platform logic only | |
| Test JSON.parse exception path | Test JSON.parse exception path (encryptedDb returns unparseable string) explicitly | |

**User's choice:** Test catch path returns null
**Notes:** Catches the error boundary. Matches D-08 in CONTEXT.md.

---

## Login + MFA Test Fixtures

### Login flow (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Mock fetch, 4 scenarios | Mock global fetch (since /auth/login uses raw fetch per D-15). Test (1) login success, (2) login + MFA challenge, (3) login error, (4) resolveMfa success/error. ~4-5 tests | ✓ |
| Login only, defer MFA | Just test login() happy/error paths. Skip MFA | |
| Full flow integration | Test full login → token-set → user-set → logout flow including kapwa:auth:logout event | |

**User's choice:** Mock fetch, 4 scenarios
**Notes:** D-10 in CONTEXT.md. Matches Phase 14 D-15 carve-out (raw fetch for pre-auth).

### getCurrentUser (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| useAuth + getCurrentUser tests | Test useAuth() returns context value (mocked provider). Test getCurrentUser() with 3 cases. ~4-5 tests | ✓ |
| Defer (out of scope) | useAuth() is a thin wrapper; getCurrentUser() exercised indirectly. 1 smoke test for getCurrentUser with no token | |

**User's choice:** useAuth + getCurrentUser tests
**Notes:** D-11 in CONTEXT.md.

---

## Test File Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One test file per module (Recommended) | One file per module. Simple, single source | |
| Split each module into 2-3 files | auth-context.login.test.tsx + auth-context.logout.test.tsx + auth-context.mfa.test.tsx, etc. ~12 test files | ✓ |
| Topical grouping within single file | One file per module but organized with describe blocks. Same as option 1 but more structured | |

**User's choice:** Split each module into 2-3 files
**Notes:** D-13 in CONTEXT.md. ~12 test files total. Better maintainability for the larger modules (offline-queue, secure-storage).

### Plan structure (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| 1 plan: all tests in one shot | ~50-60 new tests + 12 test files. Single commit batch (or 4 atomic) | |
| 2 plans: coverage setup, then tests | Plan 15-01 = install coverage-v8 + config. Plan 15-02 = all tests + final check | |
| 4 plans: one per module | One per module: api, auth-context, offline-queue, secure-storage. Each independently shippable | ✓ |

**User's choice:** 4 plans: one per module
**Notes:** D-15/D-16 in CONTEXT.md. Each plan is independently shippable with its own coverage checkpoint.

---

## the agent's Discretion

The following are deferred to the agent:

- Specific test names (use descriptive: `login() with valid credentials sets user + token`, not `test1`)
- Whether to add `console.warn` mocks for the `kapwa:auth:logout` subscriber's log line
- Exact test ordering within `describe` blocks (logical flow: happy path → error path → edge case)
- Whether to use `vi.useFakeTimers()` for `incrementLocalVersion` / `updateServerVersion`

## Deferred Ideas

- **Property-based testing (fast-check)** — for offline-queue's `mergeRecords` rules. Deferred (D-04 says 1 test per branch only).
- **Coverage report badge** — embedding the coverage % as a README badge. Deferred (cosmetic).
- **Coverage diff in CI comments** — automatically posting the coverage delta to a PR. Deferred (CI integration is Phase 17 per TST-07).
- **Mutation testing (stryker, etc.)** — verifying that the tests actually catch bugs by mutating the source. Deferred (heavyweight).
- **Coverage of `kapwa-client/src/lib/sync.ts`** — currently has no test file. Out of Phase 15 scope.
- **Coverage of `kapwa-client/src/lib/encrypted-db.ts`** — already has its own test file. Out of Phase 15 scope.
