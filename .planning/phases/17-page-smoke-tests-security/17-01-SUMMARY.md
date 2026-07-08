---
phase: 17-page-smoke-tests-security
plan: 01
type: infrastructure
status: complete
tasks_completed: 3
files_created:
  - .github/workflows/ci.yml
  - .planning/SECURITY.md
files_modified:
  - kapwa-client/src/lib/api.ts
requirements: [TST-07, SEC-01]
duration: 12 min
completed: 2026-07-08
---

# Phase 17 Plan 01: CI Pipeline + SECURITY.md Summary

**Establish automated quality gates (CI) and make the existing SEC-01 token refresh interceptor discoverable and verifiable.**

## Task Results

### Task 17-01-01: Create CI workflow (`.github/workflows/ci.yml`)

- **Status:** Complete ✅
- **Commit:** `9227499`
- **Created:** `.github/workflows/ci.yml` (53 lines, 48 non-empty)
- **Structure:**
  - 3 jobs: `test` → `coverage` (needs: test) + `build` (parallel)
  - All jobs: `ubuntu-latest`, Node 20, `kapwa-client/` working directory
  - `test`: checkout@v4 → setup-node@v4 → `npm ci` → `npm run test:run`
  - `coverage`: checkout@v4 → setup-node@v4 → `npm ci` → `npm run coverage:check` → upload artifact (`kapwa-client/coverage/`, retention-days: 30, `if: always()`)
  - `build`: checkout@v4 → setup-node@v4 → `npm ci` → `npm run build`
  - No npm cache (per D-03), no manual dispatch, no schedule triggers
- **Verification:** YAML structure valid, all required fields present

### Task 17-01-02: Write SECURITY.md (`.planning/SECURITY.md`)

- **Status:** Complete ✅
- **Commit:** `833c30e`
- **Created:** `.planning/SECURITY.md` (156 lines)
- **Sections:**
  1. Supported Versions (table)
  2. Security Architecture (JWT bearer, 1h access + 7d refresh, ABAC roles)
  3. Authentication Flow (login → token storage → Bearer header)
  4. Token Refresh Flow — SEC-01 (ASCII sequence diagram with success + failure paths)
  5. Threat Model (5-entry table: replay, CSRF, XSS, MITM, token rotation bypass)
  6. Manual Verification (step-by-step DevTools instructions for ROADMAP #6)
  7. Integration Test Coverage (references api.test.ts:82-143 with 4 tests)
  8. Reporting a Vulnerability (GitHub Private Vulnerability Reporting)
- **Verification:** All 8 sections present, tables found, ASCII diagram markers present

### Task 17-01-03: Add JSDoc to api.ts 401 branch

- **Status:** Complete ✅
- **Commit:** `70f069f`
- **Modified:** `kapwa-client/src/lib/api.ts` (+5 lines, +1 JSDoc block)
- **Location:** Line 133 (before the 401 condition)
- **Content:**
  ```
  /**
   * On 401, attempt /auth/refresh exactly once via single-flight pattern.
   * Concurrent 401s share the same refresh promise.
   * See SECURITY.md for the full flow.
   */
  ```
- **Carve-out:** Explicit permission per D-11 from AGENTS.md "no comments" rule
- **Verification:** JSDoc found referencing "See SECURITY.md"

## Verification Results

| Check | Result |
|-------|--------|
| `.github/workflows/ci.yml` exists | ✅ (53 lines) |
| `.planning/SECURITY.md` exists | ✅ (156 lines, 8 sections) |
| JSDoc on api.ts 401 branch | ✅ (references SECURITY.md) |
| `npm run test:run` (api.test.ts) | ✅ 24/24 pass |
| `npm run build` | ✅ (670ms, 2 assets) |
| YAML syntax valid | ✅ |

## Deviations from Plan

### Pre-existing Test Failure (not caused by this plan)

- **Found during:** Verification
- **Issue:** `BeneficiaryViewPage.test.tsx > has no a11y violations` fails with `TypeError: Cannot read properties of undefined (reading 'filter')` in `FamilyGraph.tsx:126`
- **Root cause:** `byDepth[depth]` is undefined for some depth value — pre-existing bug in `FamilyGraph.tsx` that was exposed by an axe test added in parallel work (not from this plan)
- **Impact:** 315/316 tests pass (1 pre-existing failure). SEC-01 contract tests (`api.test.ts`) all pass.
- **Action:** Logged as deferred — not caused by Plan 17-01 changes

### Scope Boundary
Only issues directly caused by this plan's changes were considered for auto-fix. The `FamilyGraph.tsx` bug and the unrelated test modification are out of scope per deviation rules.

## Deferred Items

- **FamilyGraph.tsx crash** — `byDepth[depth].filter` fails when `byDepth[depth]` is undefined. This blocks the `BeneficiaryViewPage.test.tsx` axe assertion. Fix belongs in a future plan targeting the FamilyGraph component or the BeneficiaryViewPage tests.
- **Modified page test files** — 8 `src/pages/*.test.tsx` files have uncommitted axe-assertion additions from parallel work. Not part of Plan 17-01 scope.

## Self-Check: PASSED

- [x] `.github/workflows/ci.yml` — 53 lines, 3 jobs, valid structure
- [x] `.planning/SECURITY.md` — 156 lines, all 8 required sections
- [x] `kapwa-client/src/lib/api.ts` — JSDoc comment added on 401 branch
- [x] `npm run build` succeeds
- [x] SEC-01 contract tests pass (api.test.ts: 24/24)
- [x] All 3 commits verified in git log
