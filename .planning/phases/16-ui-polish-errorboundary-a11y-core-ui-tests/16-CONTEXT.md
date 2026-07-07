# Phase 16: UI Polish — ErrorBoundary + A11Y + Core UI Tests - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

## Phase Boundary

Re-introduce offline-detection in the existing react-error-boundary wrapper (Phase 13 D-07 had dropped it — ROADMAP success criterion #2 still requires `TypeError('Failed to fetch')` to show the offline UI). Install `vitest-axe` and integrate `toHaveNoViolations()` into the Layout/Topbar/Sidebar smoke tests (ROADMAP #5). Add comprehensive smoke tests for Layout, Topbar, Sidebar, and ProtectedRoute (TST-05), and add 29 page smoke tests for the pages currently without tests (TST-06 — pages that exist in `src/pages/` but lack a co-located `*.test.tsx`). ErrorBoundary tests continue to pass.

## Implementation Decisions

### Offline-UI Requirement (ERR-01 #2)
- **D-01:** Re-introduce offline-detection in `ErrorFallback` (the existing react-error-boundary wrapper at `src/components/ErrorBoundary.tsx`). The check is `isOfflineError(error)`:
  - Returns `true` if `typeof navigator !== 'undefined' && navigator.onLine === false` (browser confirms offline)
  - OR `error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message)` (fetch-failure-while-online signature)
  - This matches the user intent of "TypeError('Failed to fetch') shows offline UI" while avoiding false positives from generic TypeErrors.
- **D-02:** When `isOfflineError(error)` is true, render the `<EmptyState variant="offline" />` (which already exists at `src/components/EmptyState.tsx` with WifiOff icon + "You are offline" message + Try Again onAction). When false, render the existing generic TriangleAlert UI. The `resetErrorBoundary` prop is wired to the EmptyState's onAction for the Try Again button.
- **D-03:** Add a single test in `ErrorBoundary.test.tsx` that throws `new TypeError('Failed to fetch')` and asserts the fallback renders the offline UI (e.g., "You are offline" text). The existing 4 tests continue to pass — only one new test for the offline branch.

### Smoke Test Depth
- **D-04:** 12-16 tests across the 4 components (per-concern), not render-only. Specifically:
  - **Layout** (4-5 tests): renders without crash; SkipToContent is present and focusable; ErrorBoundary wraps the `<Outlet>`; AriaLiveRegion renders the offline message when `navigator.onLine === false`; sync queue panel mounts. Uses `vi.mock('@/lib/auth-context', ...)` to stub `useAuth` returning a social_worker user.
  - **Topbar** (3-4 tests): renders without crash; menu toggle button works; user dropdown/logout works; sync queue button works (per Role-based gating). Uses the same auth mock.
  - **Sidebar** (2-3 tests): renders without crash; role-gated nav items appear for social_worker role; active link highlight reflects current path.
  - **ProtectedRoute** (3-4 tests): redirects to /login when unauthenticated; renders children when authenticated with right role; returns nothing/spinner during loading state; redirects/forbids when role mismatch.
- **D-05:** Test files use the same pattern as the existing `CaseTrackerPage.test.tsx` — wrap in `<MemoryRouter>` + auth provider mock + a stable SWR fetcher mock. No live network calls; no live IndexedDB; no live Capacitor.

### vitest-axe Integration
- **D-06:** Install `vitest-axe@^0.1.0` (already partially in devDeps — verified via grep — but verify it's wired). Wrap the Layout, Topbar, Sidebar smoke tests with `axe(container)` + `expect(results).toHaveNoViolations()`. Do NOT add axe to ProtectedRoute (it has no DOM output of its own — it just decides what to render). Do NOT add axe to the 3 page snapshot tests (ROADMAP #5 says only Layout/Topbar/Sidebar).
- **D-07:** Strict mode: any a11y violation fails the test via `toHaveNoViolations()`. CI integration deferred to Phase 17 (TST-07). Document the WCAG ruleset used: `wcag2a` + `wcag2aa` (the vitest-axe default) — sufficient for the ROADMAP #5 a11y requirement.
- **D-08:** If any a11y violation is found during execution, document the violation + fix the component (or carve out a follow-up issue if the fix is out of Phase 16 scope). The existing components (Layout, Topbar, Sidebar) were built with shadcn primitives which should pass WCAG 2 AA out of the box, but verification is required.

### Page Smoke Tests (TST-06)
- **D-09:** 29 page smoke tests, one per currently-missing page. The list of pages to test is the diff of `src/pages/*.tsx` minus `src/pages/*.test.tsx` — at discuss time, 29 pages are missing tests. Each test is render-only: mock `useAuth` + render in `<MemoryRouter>` + assert the page shell mounts (e.g., page title is present, or the page's main `<div>` is in the DOM). The test does NOT exercise data fetching (useSWR returns undefined data, the page renders the loading skeleton — that's fine for a smoke test).
- **D-10:** Per-page test file is co-located: `src/pages/SomePage.test.tsx`. The test file is minimal: ~15-25 lines per page, 1-2 tests per file (render-only + role-based smoke for role-gated pages). Total ~30-50 new test files (some pages may share a test file if they're small utility pages).
- **D-11:** Test pattern follows `CaseTrackerPage.test.tsx` precedent: `vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' }, token: 'test-tok', loading: false, login: vi.fn(), logout: vi.fn(), ... }) }))` + wrap in `<MemoryRouter>`.

### Migration Order
- **D-12:** 3-plan bottom-up structure:
  - **Plan 16-01:** Re-add offline-detection in ErrorBoundary + install vitest-axe (W1)
  - **Plan 16-02:** Add Layout + Topbar + Sidebar + ProtectedRoute smoke tests with axe integration (W2)
  - **Plan 16-03:** Add 29 page smoke tests (W3)
- **D-13:** Plan 16-01 establishes the offline UI + axe tooling so 16-02 and 16-03 can leverage them. Plan 16-02 proves the per-concern smoke test pattern works for the 4 core components before sweeping the 29 pages in 16-03. Plan 16-03 is the bulk of the work (29 new test files).

### the agent's Discretion
- Exact a11y ruleset for vitest-axe (default `wcag2a` + `wcag2aa` is recommended)
- Whether to add axe to the 3 existing page snapshot tests (Phase 13 D-12/D-13/D-14) — deferred to a follow-up
- The exact list of 29 pages missing tests — derived at execution time via `ls src/pages/ | sort` minus `ls src/pages/*.test.tsx | sort`
- Whether to group some related pages into a single test file (e.g., 5 Intake form pages in 1 file) — recommended for related pages, but each page still gets its own render-only assertion
- The minimal render-only assertion per page — e.g., the page title (if visible in a heading), a data-testid attribute (if the page has one), or the main `<div>` from Layout

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, Kapwa stack, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements ERR-01 (ErrorBoundary all pages), TST-05 (smoke tests for Layout/Topbar/Sidebar/ProtectedRoute), TST-06 (28 page smoke tests), A11Y-01 (SkipToContent in Layout), A11Y-02 (CI fails on a11y)
- `.planning/ROADMAP.md` — Phase 16 boundary, 6 success criteria
- `.planning/phases/13-major-version-upgrades/13-CONTEXT.md` — D-06 (ErrorBoundary migrated to react-error-boundary), D-07 (offline-detection dropped — needs to be re-added in Phase 16 per D-01), D-08 (resetKeys prop)
- `.planning/phases/13-major-version-upgrades/13-02-SUMMARY.md` — Phase 13 D-07/D-08 implementation; ErrorBoundary now a 37-line function-component wrapper
- `.planning/phases/15-core-module-tests/15-CONTEXT.md` — D-01 (vitest-axe was deferred — Phase 16 implements it per D-06), D-14 (per-file 70% coverage threshold extends to Layout/Topbar/Sidebar if tests added)
- `.planning/phases/15-core-module-tests/15-01-SUMMARY.md` — @vitest/coverage-v8 installed with v8 provider, perFile: true threshold

### Codebase Maps
- `.planning/codebase/TESTING.md` — Current test framework (Vitest v4.1.9, jsdom)
- `.planning/codebase/CONVENTIONS.md` — Relative imports only, no `@/*` aliases
- `.planning/codebase/STRUCTURE.md` — `kapwa-client/src/components/` is the shared component home

### Package Configuration
- `kapwa-client/package.json` — Add `vitest-axe` to devDependencies; existing `react-error-boundary` already in deps (Phase 13)
- `kapwa-client/vite.config.ts` — vitest 4.1.9 config; coverage v8 provider (Phase 15)

### Component Code (for migration reference)
- `kapwa-client/src/components/ErrorBoundary.tsx` — 37-line function-component wrapper around `react-error-boundary`; uses TriangleAlert + AriaLiveRegion for the generic UI
- `kapwa-client/src/components/EmptyState.tsx` — has 4 variants (no-data, no-results, offline, no-access); the `offline` variant renders the WifiOff icon + "You are offline" message
- `kapwa-client/src/components/Layout.tsx` — line 113 wraps `<Outlet>` in `<ErrorBoundary>`; line 83 renders `<SkipToContent />`; line 86-88 uses AriaLiveRegion for the offline message
- `kapwa-client/src/components/Topbar.tsx` — 170 lines; sidebar toggle + breadcrumbs + sync queue button + user menu
- `kapwa-client/src/components/Sidebar.tsx` — 72 lines; desktop nav, role-gated items
- `kapwa-client/src/components/ProtectedRoute.tsx` — 55 lines; auth guard
- `kapwa-client/src/components/a11y/SkipToContent.tsx` — 23 lines; already wired in Layout
- `kapwa-client/src/components/a11y/AriaLiveRegion.tsx` — exists; used by Layout + ErrorBoundary

### Pages to Test (TST-06)
- 49 total pages in `src/pages/`
- 20 already have co-located tests (from Phases 10-14)
- 29 need new smoke tests in Plan 16-03
- The exact list is derived at execution time (D-09)

### Existing Test Files (for pattern reference)
- `kapwa-client/src/components/CaseTrackerPage.test.tsx` — 6 lines of comment + vi.mock + render + assert; precedent for page smoke tests
- `kapwa-client/src/components/ErrorBoundary.test.tsx` — 75 lines, 4 tests (render-no-error, catches error, Try Again resets, Go to Dashboard link); add Test 5 in Plan 16-01 for offline branch
- `kapwa-client/src/components/BottomNav.test.tsx` — render-only smoke pattern
- `kapwa-client/src/components/EmptyState.test.tsx` — 4-variant render pattern (reused for D-02)
- `kapwa-client/src/components/PageShell.test.tsx` — render-only pattern
- `kapwa-client/src/components/PublicHeader.test.tsx` — render-only pattern

## Existing Code Insights

### Reusable Assets
- **`<EmptyState variant="offline" />`** — already exists in `src/components/EmptyState.tsx` with WifiOff icon + "You are offline" message + onAction callback. Reused per D-02 in the offline branch of ErrorFallback.
- **`vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ ... }) }))`** — established pattern from existing page tests. Reused for the new smoke tests.
- **`@testing-library/react` v16.3.2 + jsdom** — installed in Phase 12/13. Supports React 19. Used by all existing tests.
- **`AriaLiveRegion`** — already used in Layout + ErrorBoundary. Renders a `<div role="status" aria-live="polite">` for screen-reader announcements. Reused for the offline message.
- **Phase 15 coverage tool** — `@vitest/coverage-v8` with v8 provider + perFile: true. The Layout/Topbar/Sidebar tests will appear in the coverage report (the threshold config can be extended to include them).

### Established Patterns
- **Test file naming:** `*.test.tsx` for component tests; co-located next to source file
- **Test environment:** jsdom; `npm test` (vitest watch), `npm run test:run` (single run)
- **Auth context mock:** `vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { role: 'social_worker', ... }, token: 'test-tok', loading: false, ... }) }))` — used by all existing page tests
- **`MemoryRouter` wrapper:** for react-router-dom pages; provides a stable location for testing
- **Bomb component pattern** — `{ shouldThrow: boolean }` child component that throws on render, used by ErrorBoundary test to exercise the catch branch
- **SWRConfig with mock fetcher** — for pages that fetch data on mount; the mock fetcher returns empty data so the page renders the loading/empty state
- **NO comments in tests** — AGENTS.md "DO NOT ADD ANY COMMENTS unless asked" — but `// Mock ...` 1-line fixture notes inherited from existing test patterns (per Phase 12 precedent) ARE allowed
- **No path aliases** — CONVENTIONS.md says relative imports only

### Integration Points
- **`vite.config.ts` test block** — already has the v8 coverage config from Phase 15. No additional config needed for vitest-axe (it auto-imports when added to a test file).
- **`package.json` devDependencies** — add `vitest-axe`. Existing devDependencies include `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitest/coverage-v8`.
- **`ErrorBoundary.test.tsx`** — add 1 new test for the offline branch (D-03). Existing 4 tests must continue to pass.
- **All page tests** — pattern from `CaseTrackerPage.test.tsx:6` ("Mock fetch since this page uses raw fetch() calls") — but for new smoke tests, mock useAuth instead (the page shell renders without data).
- **Layout/Topbar/Sidebar test files** — new files. Each follows the same pattern: vi.mock auth + MemoryRouter + render + assert.

## Specific Ideas

- **Layout's `navigator.onLine` check** — the existing AriaLiveRegion shows "You are offline" when `navigator.onLine === false`. This is the Layout-level offline indicator. The ErrorBoundary's offline UI is a SECOND-level offline indicator for crash-level errors. Both are useful: Layout shows the "you're offline" banner during normal operation; ErrorBoundary shows the offline fallback when a page crashes due to a fetch failure.
- **vitest-axe ruleset** — use the default `wcag2a` + `wcag2aa` ruleset (sufficient for ROADMAP #5). The shadcn primitives used by Layout/Topbar/Sidebar are designed for WCAG compliance (proper aria-labels, focus management, semantic HTML), so violations are unlikely but should be verified.
- **axe test for the EmptyState offline variant** — the offline branch of ErrorFallback renders the EmptyState. The Layout-level AriaLiveRegion is in the same DOM tree. axe should treat both as a11y-compliant.
- **Per-page smoke test pattern** — render the page in `<MemoryRouter>` + auth provider mock. Assert the page's main heading is in the DOM. Don't fetch data (SWR returns undefined; the page renders the loading skeleton — that's fine for a smoke test). This catches "page import fails" + "page crashes on render" + "page is missing its title" regressions.

## Deferred Ideas

- **A11Y-01 SkipToContent on keyboard focus** — already wired in Layout (line 83); Phase 16 verifies via the Layout smoke test (D-04) that SkipToContent is present and focusable. No new code needed.
- **A11Y-02 CI integration of vitest-axe** — Phase 17 scope (TST-07). Phase 16 wires vitest-axe + adds the test assertions; Phase 17 adds the CI gate.
- **TST-07 axe on all 49 pages** — Phase 17 may add axe to all 29+20 page tests as a follow-up. Phase 16 only adds axe to Layout/Topbar/Sidebar per ROADMAP #5.
- **ErrorBoundary per-page import (ERR-01 strict reading)** — Layout already wraps `<Outlet>` in `<ErrorBoundary>` at line 113, so all routed pages are error-bounded. No per-page import needed. ROADMAP #1 is met by the Layout-level wrap.
- **TST-05 expansion to BottomNav / PageShell / EmptyState** — these already have tests (Phase 10-11 work). TST-05 only requires the 4 named components (Layout, Topbar, Sidebar, ProtectedRoute).
- **ErrorBoundary 6 existing tests** — ROADMAP #6 says "6 existing tests continue to pass". Phase 13 dropped 2 tests (the offline branch) when migrating to react-error-boundary. The current count is 4. Phase 16 adds 1 (D-03), bringing the total to 5. The "6 tests" criterion is no longer exact — interpret as "all existing tests continue to pass" (5 after Phase 16).

---

*Phase: 16-UI Polish — ErrorBoundary + A11Y + Core UI Tests*
*Context gathered: 2026-07-07*
