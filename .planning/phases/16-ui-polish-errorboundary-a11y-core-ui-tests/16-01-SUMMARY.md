---
phase: 16-ui-polish-errorboundary-a11y-core-ui-tests
plan: 01
subsystem: ui
tags: [error-boundary, react-error-boundary, vitest-axe, a11y, offline-ui, empty-state, axe-core]

# Dependency graph
requires:
  - phase: 13-major-version-upgrades
    plan: 02
    provides: "react-error-boundary function-component wrapper (37 lines) with TriangleAlert + Try Again + Go to Dashboard fallback; offline-detection branch dropped per D-07"
  - phase: 10-shared-components-responsive
    plan: 01
    provides: "EmptyState component with 4 variants including 'offline' (WifiOff icon + 'You appear to be offline' + Retry CTA + 'Please check your connection and try again' hint); ErrorBoundary test file with 4 baseline tests"
provides:
  - "Re-introduced offline-detection in ErrorFallback via isOfflineError(error) predicate"
  - "Branched render in ErrorFallback: offline branch renders <EmptyState variant='offline' onAction={resetErrorBoundary} />; generic branch preserved"
  - "5/5 ErrorBoundary tests pass (4 existing + 1 new offline branch)"
  - "Global toHaveNoViolations() matcher registered in tests/setup.ts via vitest-axe/extend-expect + expect.extend(matchers)"
  - "ROADMAP success criterion #2 satisfied: TypeError('Failed to fetch') shows offline UI at the ErrorBoundary level (Layout.tsx:113 wraps <Outlet> in <ErrorBoundary>, so all 28 routed pages inherit the behavior)"
affects:
  - phase 16-ui-polish-errorboundary-a11y-core-ui-tests plan 02 (will use toHaveNoViolations() in Layout/Topbar/Sidebar smoke tests)
  - phase 16-ui-polish-errorboundary-a11y-core-ui-tests plan 03 (page smoke tests can use the same matcher pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Network-aware ErrorFallback: isOfflineError(error) returns true for navigator.onLine === false OR TypeError with fetch|network|failed to fetch message"
    - "EmptyState onAction wiring: offline variant with onAction={resetErrorBoundary} triggers re-mount of error boundary on Retry click"
    - "vitest-axe global matcher registration: import 'vitest-axe/extend-expect' for types + expect.extend(axeMatchers) at runtime"

key-files:
  created: []
  modified:
    - "kapwa-client/src/components/ErrorBoundary.tsx (isOfflineError predicate + branched render; +17 lines, -1 line)"
    - "kapwa-client/src/components/ErrorBoundary.test.tsx (+1 offline-branch test in new describe block; +30 lines)"
    - "kapwa-client/tests/setup.ts (+4 lines: extend-expect import, matchers import, expect.extend call)"

key-decisions:
  - "isOfflineError accepts `error: unknown` (not Error) — matches react-error-boundary's FallbackProps.error type which is `unknown`"
  - "isOfflineError regex matches /fetch|network|failed to fetch/i (case-insensitive) to catch common fetch-failure messages regardless of casing or minor wording variations"
  - "Offline branch wraps EmptyState in a div with 'flex flex-col items-center justify-center py-16' to match the existing TriangleAlert branch's layout classes"
  - "EmptyState.onAction wired to resetErrorBoundary (not navigate) — clicking Retry re-renders the error boundary's children, allowing retry without navigation"
  - "vitest-axe@0.1.0 extend-expect is TYPE-ONLY — runtime matcher registration requires explicit expect.extend(axeMatchers) per package README"

patterns-established:
  - "vi.spyOn(console, 'error').mockImplementation(() => {}) in beforeEach silences react-error-boundary's caught-error log in tests"
  - "FetchBomb helper mirrors the existing Bomb helper pattern ({ shouldThrow } prop, returns 'Safe content' when false)"
  - "Global axe matcher setup pattern: side-effect type import + expect.extend(axeMatchers) at top of tests/setup.ts before any other code"

requirements-completed:
  - ERR-01
  - A11Y-02

# Metrics
duration: 5 min
completed: 2026-07-07
status: complete
---

# Phase 16 Plan 01: ErrorBoundary Offline-UI + vitest-axe Global Setup Summary

**Re-introduced offline-detection in `ErrorFallback` (per D-01/D-02), added the new offline-branch test (D-03), and wired `toHaveNoViolations()` globally via `tests/setup.ts` (D-06) — 5/5 ErrorBoundary tests pass and the full 289-test suite remains green**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-07T17:45:26Z
- **Completed:** 2026-07-07T17:49:30Z
- **Tasks:** 3
- **Files modified:** 3 (1 production + 1 test + 1 setup)

## Accomplishments

- `isOfflineError(error: unknown): boolean` predicate added to `ErrorBoundary.tsx` — returns true for `navigator.onLine === false` OR `error.name === 'TypeError'` with `/fetch|network|failed to fetch/i` message
- `ErrorFallback` now branches: offline branch renders `<EmptyState variant="offline" onAction={resetErrorBoundary} />`; generic branch (TriangleAlert + AriaLiveRegion + Try Again + Go to Dashboard) preserved for non-offline errors
- New test in `ErrorBoundary.test.tsx` throws `new TypeError('Failed to fetch')` via the `FetchBomb` helper and asserts the offline UI renders: "You appear to be offline" + "Please check your connection and try again" + Retry button
- Global `toHaveNoViolations()` matcher wired in `tests/setup.ts` via `import 'vitest-axe/extend-expect'` (type-only) + `expect.extend(axeMatchers)` (runtime registration)
- Full test suite: 289/289 tests pass across 54 test files (no regression)
- `npm run build` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `isOfflineError` predicate + offline branch in ErrorFallback** - `30edf78` (feat)
2. **Task 2: Add offline-branch test in ErrorBoundary.test.tsx** - `572d812` (test)
3. **Task 3: Wire `vitest-axe/extend-expect` globally in tests/setup.ts** - `4c475ad` (chore)

## Files Created/Modified

### Modified

- `kapwa-client/src/components/ErrorBoundary.tsx` — Added `isOfflineError` predicate (lines 9-15) and branched render in `ErrorFallback` (lines 17-23). Imported `EmptyState` from `./EmptyState`. 4 existing tests + 1 new offline-branch test all pass.
- `kapwa-client/src/components/ErrorBoundary.test.tsx` — Added `FetchBomb` helper (lines 77-82) and new `describe('ErrorBoundary — offline branch', ...)` block (lines 84-103) with 1 test that throws `new TypeError('Failed to fetch')` and asserts the offline UI renders.
- `kapwa-client/tests/setup.ts` — Added `import 'vitest-axe/extend-expect'` (line 1, type-only), `import * as axeMatchers from 'vitest-axe/matchers'` (line 2), and `expect.extend(axeMatchers)` (line 5) to register the `toHaveNoViolations()` matcher globally.

## Decisions Made

- **`isOfflineError` accepts `error: unknown`** — matches `react-error-boundary`'s `FallbackProps.error` type which is `unknown` (not `Error`). The `error instanceof Error` guard inside the predicate handles the `unknown` type safely.
- **Offline branch layout matches the generic branch** — same `flex flex-col items-center justify-center py-16` wrapper so the visual treatment is consistent (only the inner content differs: EmptyState vs TriangleAlert + AriaLiveRegion + buttons).
- **`EmptyState.onAction={resetErrorBoundary}`** — the offline variant's handleAction (in `EmptyState.tsx:48-55`) calls `onAction?.()` for the offline case. Wiring it to `resetErrorBoundary` (not `navigate`) means clicking Retry re-renders the error boundary's children, allowing the user to retry the failed operation without navigating away.
- **vitest-axe@0.1.0 requires explicit `expect.extend()` at runtime** — the `extend-expect` import is type-only (extends `Vi.Assertion` interface for TypeScript intellisense). The README explicitly states "Import the matchers from `vitest-axe/matchers` once (preferably in your tests setup file), then pass them to Vitest's `expect.extend` method". Without the runtime call, `expect(results).toHaveNoViolations()` throws "Invalid Chai property: toHaveNoViolations".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit `expect.extend(axeMatchers)` runtime call in `tests/setup.ts`**
- **Found during:** Task 3 verification (testing the new matcher with a smoke test)
- **Issue:** The plan's Task 3 acceptance criterion requires "`expect(results).toHaveNoViolations()` is recognized as a matcher in any test file". The plan specified only `import 'vitest-axe/extend-expect';` as line 1 — but in vitest-axe@0.1.0, this import is TYPE-ONLY (the file `node_modules/vitest-axe/dist/extend-expect.js` is 0 bytes; the `.d.ts` only extends the `Vi.Assertion` interface). At runtime, the matcher is not registered, and `expect(results).toHaveNoViolations()` throws "Invalid Chai property: toHaveNoViolations". The vitest-axe@0.1.0 README explicitly requires `import * as matchers from 'vitest-axe/matchers'; expect.extend(matchers);` to register the matcher at runtime.
- **Fix:** Added 2 more lines after the extend-expect import: `import * as axeMatchers from 'vitest-axe/matchers';` and `import { expect, vi } from 'vitest';` (consolidated with the existing `import { vi } from 'vitest'`). Then `expect.extend(axeMatchers);` after the imports. This registers the matcher at runtime while keeping the type-only extend-expect import for TypeScript intellisense.
- **Files modified:** `kapwa-client/tests/setup.ts`
- **Verification:** Created a smoke test asserting `expect({ violations: [] }).toHaveNoViolations();` — test passes. Also tested the failure path: `expect({ violations: [{ id: 'color-contrast', help: '...', helpUrl: '...', nodes: [...] }] }).toHaveNoViolations();` — throws with formatted reporter output. Full test suite: 289/289 pass.
- **Committed in:** `4c475ad` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** The deviation is essential for the matcher to work at runtime. Without it, 16-02's Layout/Topbar/Sidebar smoke tests would not be able to use `expect(results).toHaveNoViolations()` — the plan's strict acceptance criterion would fail. The fix is documented in the vitest-axe@0.1.0 package README and is the canonical setup pattern. No scope creep.

## Issues Encountered

- The plan's RESEARCH.md section "State of the Art" and "Pattern 2" claimed `import 'vitest-axe/extend-expect'` is a "side-effect import that augments Vitest's `expect` type with the `toHaveNoViolations()` matcher — no usage in the setup file itself". This is incorrect for vitest-axe@0.1.0: the import is TYPE-ONLY and does not register the matcher at runtime. The fix (explicit `expect.extend()`) follows the package's own README. This is a documentation drift between the plan's RESEARCH.md and the package's actual behavior.

## User Setup Required

None - no external service configuration required. All changes are local to `kapwa-client/`.

## Next Phase Readiness

- **Plan 16-02 ready to execute:** The 4 component smoke tests (Layout, Topbar, Sidebar, ProtectedRoute) can now use `import { axe } from 'vitest-axe';` + `expect(results).toHaveNoViolations()` in their assertions.
- **ROADMAP #2 satisfied:** Throwing `TypeError('Failed to fetch')` inside any page now shows the offline UI (Layout.tsx:113 wraps `<Outlet>` in `<ErrorBoundary>`, so all 28 routed pages inherit the behavior).
- **A11Y-02 infrastructure ready:** The `toHaveNoViolations()` matcher is globally available. CI integration (Phase 17 / TST-07) can be added by running `npm run test:run` in the CI workflow and relying on test failures to block merges.
- **ERR-01 complete:** All 28 pages are wrapped in `<ErrorBoundary>` via Layout.tsx:113. The offline branch is the second-level fallback (first-level being the layout-level AriaLiveRegion "You are offline" announcement).

---

*Phase: 16-ui-polish-errorboundary-a11y-core-ui-tests*
*Completed: 2026-07-07*

## Self-Check: PASSED

- [x] `kapwa-client/src/components/ErrorBoundary.tsx` contains `function isOfflineError` (D-01)
- [x] `ErrorFallback` branches: offline branch renders `<EmptyState variant="offline" onAction={resetErrorBoundary} />` (D-02)
- [x] `ErrorBoundary.test.tsx` has new `describe('ErrorBoundary — offline branch', ...)` block with 1 new test
- [x] New test passes; existing 4 tests continue to pass; total = 5/5 in `npx vitest run src/components/ErrorBoundary.test.tsx`
- [x] `kapwa-client/tests/setup.ts` line 1 is `import 'vitest-axe/extend-expect';` (D-06 — type-only side-effect import)
- [x] `expect.extend(axeMatchers)` registers the matcher at runtime (Rule 2 auto-fix)
- [x] `npm run test:run` shows full suite green (289/289 tests, 54 test files)
- [x] `npm run build` exits 0 with no TypeScript errors
- [x] `toHaveNoViolations()` is callable in any test file (smoke-tested: passes on empty violations, throws with formatted reporter on non-empty)
- [x] All 3 task commits verified in git log: `30edf78`, `572d812`, `4c475ad`
