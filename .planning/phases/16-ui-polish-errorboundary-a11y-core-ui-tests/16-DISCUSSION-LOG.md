# Phase 16: UI Polish — ErrorBoundary + A11Y + Core UI Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 16-UI Polish — ErrorBoundary + A11Y + Core UI Tests
**Areas discussed:** Offline-UI requirement (ERR-01 #2), Smoke test depth, vitest-axe integration, Page smoke tests (TST-06)

---

## Offline-UI Requirement (ERR-01 #2)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-add in ErrorFallback (Recommended) | Re-add navigator.onLine + error.name === 'TypeError' check. Show EmptyState offline variant | |
| Defer to Layout level | Layout already shows offline via AriaLiveRegion. ErrorBoundary shows generic | |
| Defer entirely to future phase | ROADMAP #2 is unmet. Document the gap and add to follow-up | |

**User's choice:** "best practice" — interpreted as **re-add offline detection in ErrorFallback with the canonical `navigator.onLine === false` OR `error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message)` check**. Show `<EmptyState variant="offline" />` when `isOfflineError(error)` is true; otherwise show the generic TriangleAlert UI.

**Notes:** The original Phase 10 implementation was too broad (fired on any TypeError mentioning "fetch"). The corrected check is more robust — only fires on confirmed-offline OR fetch-failure-while-online. The EmptyState offline variant already exists and is reusable.

---

## Smoke Test Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Render-only (4 tests) | 1 test per component, minimal providers, ~5-10 lines each | |
| Per-concern (12-16 tests) | Layout renders + SkipToContent + ErrorBoundary + Outlet. Topbar + menu toggle. Sidebar + active link. ProtectedRoute + auth states. ~12-16 tests | ✓ |
| Per-component + axe (8-10 tests) | 1 render-only + 1-2 per-component a11y assertions. ~8-10 tests | |

**User's choice:** Per-concern (12-16 tests)
**Notes:** Better regression coverage. The 4 components have distinct concerns (Layout composes everything, Topbar has menu, Sidebar has active link, ProtectedRoute has auth states).

### ProtectedRoute auth states (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-state tests (Recommended) | 2 auth states: unauthed → redirect, authed → renders. Plus loading state. ~3 tests | |
| Authenticated only | Test only the authenticated case. ~1 test | |
| Auth + role check | All 3 + role-based access. ~4 tests | ✓ |

**User's choice:** Auth + role check
**Notes:** ProtectedRoute may have role prop per the existing code (line ~30 of ProtectedRoute.tsx). All 4 auth states (unauthed, authed, loading, role-mismatch) get explicit test coverage.

---

## vitest-axe Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Layout/Topbar/Sidebar only | Install vitest-axe. Wrap the 3 component smoke tests (not ProtectedRoute) with axe. 3 tests wrapped | ✓ |
| All 7 tests | Wrap the 3 components + 3 page snapshot tests + 1 Layout test. 7 tests wrapped | |
| Layout only | Only Layout's smoke test gets axe. 1 test wrapped | |

**User's choice:** Layout/Topbar/Sidebar only
**Notes:** Matches ROADMAP #5 exactly. ProtectedRoute has no DOM output of its own (just decides what to render), so axe is not relevant.

### Strictness (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict (Recommended) | Use toHaveNoViolations() — any violation fails the test. CI integration in Phase 17 | ✓ |
| Lenient (log only) | console.warn but pass. CI integration in a later phase | |

**User's choice:** Strict (Recommended)
**Notes:** shadcn primitives are designed for WCAG 2 AA compliance. Strict mode catches regressions early.

---

## Page Smoke Tests (TST-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip — defer TST-06 to Phase 17 | Phase 16 only adds the 4 Layout/Topbar/Sidebar/ProtectedRoute tests + axe. Phase 17 sweeps the 28 pages | |
| Add 10 most-visited smoke tests | Add 10-12 tests for the most-visited pages. Defer remaining 17 to Phase 17 | |
| All 29 missing pages | Add 29 smoke tests in Phase 16. One test per page. ~29 test files added | ✓ |

**User's choice:** All 29 missing pages
**Notes:** Compresses Phase 16 + Phase 17 work. Each page gets render-only smoke coverage. ~30-50 new test files (some pages may share a file if related).

### Auth state mocking (sub-question)

| Option | Description | Selected |
|--------|-------------|----------|
| Mock useAuth directly (Recommended) | vi.mock useAuth to return social_worker user. Wrap in MemoryRouter. ~10-15 lines per test | ✓ |
| Mock useAuth + SWRConfig | Mock useAuth + all api calls. ~20-30 lines per test | |
| Render without auth wrapper | No auth mock. Crashes if useAuth has no provider. Flakier | |

**User's choice:** Mock useAuth directly (Recommended)
**Notes:** Simpler. Pages render the loading skeleton (useSWR returns undefined) which is fine for a smoke test. Doesn't exercise the data layer but catches page-import + page-render regressions.

---

## the agent's Discretion

The following are deferred to the agent:

- Exact a11y ruleset for vitest-axe (default `wcag2a` + `wcag2aa` is recommended)
- Whether to add axe to the 3 existing page snapshot tests (Phase 13 D-12/D-13/D-14) — deferred to a follow-up
- The exact list of 29 pages missing tests — derived at execution time via `ls src/pages/ | sort` minus `ls src/pages/*.test.tsx | sort`
- Whether to group some related pages into a single test file (e.g., 5 Intake form pages in 1 file) — recommended for related pages, but each page still gets its own render-only assertion
- The minimal render-only assertion per page — e.g., the page title (if visible in a heading), a data-testid attribute (if the page has one), or the main `<div>` from Layout

## Deferred Ideas

- **A11Y-01 SkipToContent on keyboard focus** — already wired in Layout (line 83); Phase 16 verifies via the Layout smoke test (D-04). No new code needed.
- **A11Y-02 CI integration of vitest-axe** — Phase 17 scope (TST-07). Phase 16 wires vitest-axe + adds test assertions.
- **TST-07 axe on all 49 pages** — Phase 17 follow-up. Phase 16 only adds axe to Layout/Topbar/Sidebar per ROADMAP #5.
- **ErrorBoundary per-page import (ERR-01 strict reading)** — Layout already wraps `<Outlet>` in `<ErrorBoundary>`. ROADMAP #1 is met.
- **TST-05 expansion to BottomNav / PageShell / EmptyState** — these already have tests (Phase 10-11). Out of scope.
- **ErrorBoundary 6 existing tests** — Phase 13 dropped 2; current count is 4. Phase 16 adds 1 (D-03), total 5. The "6 tests" criterion is no longer exact — interpret as "all existing tests continue to pass".
