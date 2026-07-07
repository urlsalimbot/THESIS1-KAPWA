# Phase 16: UI Polish — ErrorBoundary + A11Y + Core UI Tests — Research

**Researched:** 2026-07-07
**Domain:** React 19 + Vitest 4 test infrastructure + accessibility integration + offline-UI restoration
**Confidence:** HIGH (all stack components verified on disk and via npm registry)

## Summary

Phase 16 is a quality-polish milestone that closes three v1.2 requirement gaps in a single vertical slice:
**ERR-01 #2** (offline-detection in `<ErrorBoundary>`) was inadvertently dropped during the Phase 13
migration to `react-error-boundary` (see `13-02-SUMMARY.md` D-07) and must be re-introduced using the
existing `<EmptyState variant="offline" />` primitive. **TST-05** (smoke tests for Layout / Topbar /
Sidebar / ProtectedRoute) and **A11Y-01/A11Y-02** (vitest-axe integration on the core UI components)
share the same testing infrastructure. **TST-06** (1 smoke test per page) closes coverage across the
remaining 8 untested pages — note that CONTEXT.md estimates 29 missing page tests but the live state
on disk shows only **8 pages lack co-located tests** (AuditorPage, ContactPage, CoordinatorDashboardPage,
MayorReportsPage, MyAccessCardPage, ProgramsPage, IrfDetailPage, AccessCardPrintView). The planner
should use the on-disk truth (8), not the stale CONTEXT.md figure (29), and update the page test
count estimate accordingly.

The phase is well-decomposed into 3 plans per D-12: 16-01 re-introduces offline-UI in ErrorBoundary +
wires vitest-axe globally via `tests/setup.ts`; 16-02 adds the 4 component smoke tests with axe
integration on Layout/Topbar/Sidebar; 16-03 sweeps the 8 untested pages. All tooling is already
installed (vitest-axe 0.1.0, axe-core 4.12.1, jsdom 24, @testing-library/react 16.3.2, vitest 4.1.10)
and verified-working via `npx vitest run src/components/ErrorBoundary.test.tsx` (4/4 pass).

**Primary recommendation:** Use `import 'vitest-axe/extend-expect'` in `tests/setup.ts` to enable the
`toHaveNoViolations()` matcher globally, then assert `expect(results).toHaveNoViolations()` on the
Layout/Topbar/Sidebar smoke tests. Restore the offline branch in `ErrorFallback` using the
`isOfflineError(error)` predicate described in CONTEXT.md D-01. Add the 8 page smoke tests following
the `CaseTrackerPage.test.tsx` precedent (auth-context mock + MemoryRouter + render-only heading
assertion). No additional dependencies, no coverage-config edits, no new vite.config.ts changes
required.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Re-introduce `isOfflineError(error)` in `ErrorFallback`. Check: `typeof navigator !== 'undefined' && navigator.onLine === false` OR `error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message)`.
- **D-02:** When `isOfflineError(error)` is true, render `<EmptyState variant="offline" />` (already at `src/components/EmptyState.tsx`, uses `WifiOff` icon + "You appear to be offline" message + "Retry" button onAction). Wire `resetErrorBoundary` → `onAction`. Otherwise render the existing TriangleAlert + AriaLiveRegion UI.
- **D-03:** Add 1 new test in `ErrorBoundary.test.tsx` that throws `new TypeError('Failed to fetch')` and asserts the offline UI renders. Existing 4 tests must continue to pass.
- **D-04:** 12-16 tests across Layout/Topbar/Sidebar/ProtectedRoute (per-concern, not render-only):
  - **Layout (4-5):** renders without crash; SkipToContent is present and focusable; ErrorBoundary wraps `<Outlet>`; AriaLiveRegion renders the offline message when `navigator.onLine === false`; sync queue panel mounts.
  - **Topbar (3-4):** renders without crash; menu toggle button works; user dropdown/logout works; sync queue button works (per Role-based gating).
  - **Sidebar (2-3):** renders without crash; role-gated nav items appear for social_worker role; active link highlight reflects current path.
  - **ProtectedRoute (3-4):** redirects to /login when unauthenticated; renders children when authenticated with right role; returns nothing/spinner during loading state; redirects/forbids when role mismatch.
- **D-05:** Test files use the same pattern as `CaseTrackerPage.test.tsx` — `<MemoryRouter>` + `vi.mock('@/lib/auth-context', ...)` + SWRConfig with stable mock fetcher. No live network/IndexedDB/Capacitor.
- **D-06:** Install `vitest-axe@^0.1.0` (verify wired). Wrap Layout/Topbar/Sidebar smoke tests with `axe(container) + expect(results).toHaveNoViolations()`. Do NOT add axe to ProtectedRoute (no DOM output of its own). Do NOT add axe to the 3 existing page snapshot tests (ROADMAP #5 limits axe to Layout/Topbar/Sidebar).
- **D-07:** Strict mode via `toHaveNoViolations()`. WCAG ruleset: `wcag2a` + `wcag2aa` (vitest-axe default). CI integration deferred to Phase 17 (TST-07).
- **D-08:** If a11y violations are found, document + fix in Phase 16 scope, or carve out a follow-up issue if out of scope.
- **D-09:** One render-only smoke test per currently-missing page. Mock `useAuth` + `<MemoryRouter>` + assert the page shell mounts (heading present, or main `<div>` in DOM). SWR returns undefined data — page renders loading skeleton, that's fine.
- **D-10:** Per-page test file co-located: `src/pages/SomePage.test.tsx`. ~15-25 lines per page, 1-2 tests per file. Total ~8 new test files (see Runtime State Inventory correction).
- **D-11:** Test pattern follows `CaseTrackerPage.test.tsx` precedent: `vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' }, token: 'test-tok', loading: false, login: vi.fn(), logout: vi.fn(), ... }) }))` + wrap in `<MemoryRouter>`.
- **D-12:** 3-plan bottom-up structure: 16-01 (offline UI + axe tooling), 16-02 (4 component smoke tests with axe), 16-03 (page smoke tests sweep).
- **D-13:** 16-01 establishes offline UI + axe tooling so 16-02 and 16-03 can leverage them. 16-02 proves the per-concern smoke test pattern works for the 4 core components before sweeping the pages in 16-03.

### the agent's Discretion

- Exact a11y ruleset for vitest-axe (default `wcag2a` + `wcag2aa` is recommended).
- Whether to add axe to the 3 existing page snapshot tests (Phase 13 D-12/D-13/D-14) — deferred to a follow-up.
- Whether to group some related pages into a single test file (e.g., 5 Intake form pages in 1 file) — recommended for related pages, but each page still gets its own render-only assertion.
- The minimal render-only assertion per page — e.g., the page title (if visible in a heading), a data-testid attribute (if the page has one), or the main `<div>` from Layout.

### Deferred Ideas (OUT OF SCOPE)

- **A11Y-02 CI integration of vitest-axe** — Phase 17 scope (TST-07).
- **TST-07 axe on all 49 pages** — Phase 17 follow-up.
- **ErrorBoundary per-page import (ERR-01 strict reading)** — Layout already wraps `<Outlet>` in `<ErrorBoundary>` at line 113, so all routed pages are error-bounded. ROADMAP #1 met.
- **TST-05 expansion to BottomNav / PageShell / EmptyState** — these already have tests (Phase 10-11 work). TST-05 only requires the 4 named components.
- **Coverage threshold extension to Layout/Topbar/Sidebar** — Phase 15 D-14 sets perFile threshold only on the 5 lib/ files (api, api-error, auth-context, offline-queue, secure-storage). Extending to components is a follow-up.

### CONTEXT.md Figure Correction (IMPORTANT)

CONTEXT.md was gathered 2026-07-07 and states "29 pages need new smoke tests in Plan 16-03".
**This figure is stale.** Live on-disk state (verified via `ls src/pages/*.tsx` minus `*.test.tsx`)
shows only **8 pages lack co-located tests**:

| Page | Notes |
|------|-------|
| `AccessCardPrintView.tsx` | Print view of access card; `useParams` + `useEffect`; uses `useSWR` via raw `api.get` |
| `AuditorPage.tsx` | Auditor dashboard; 2 tabs (hash chain, consent ledger); useSWR |
| `ContactPage.tsx` | Public contact form; no useSWR, no auth required |
| `CoordinatorDashboardPage.tsx` | Barangay coordinator dashboard; raw `api` calls |
| `IrfDetailPage.tsx` | IRF detail view; `useParams` + raw `api.get`; AES-256 decrypt form |
| `MayorReportsPage.tsx` | Mayor's office aggregate report; useSWR |
| `MyAccessCardPage.tsx` | Claimant's own access card; useSWR + `useNavigate` |
| `ProgramsPage.tsx` | Admin program config; uses `JsonSchemaForm` + `getCurrentUser` |

The planner should adjust the 16-03 effort estimate accordingly. The "8" figure is authoritative;
the CONTEXT.md "29" was apparently derived at a different phase state.

## Project Constraints (from AGENTS.md / codebase conventions)

| Directive | Source | Implication for Phase 16 |
|-----------|--------|--------------------------|
| Use `context-mode` MCP tools for analysis (Think in Code) | `AGENTS.md` | Use `ctx_batch_execute` / `ctx_search` for any bulk file analysis. Not relevant for code-writing, but page enumeration via shell should use the sandboxed path. |
| NO comments in tests unless asked | `AGENTS.md` + Phase 10-12 precedent | All new test files must omit `// ...` comments. Inherited `// Mock ...` 1-line notes from `CaseTrackerPage.test.tsx:6` precedent are allowed because Phase 12 set that pattern. |
| Relative imports only — NO `@/*` aliases | `CONVENTIONS.md` | Tests must use `vi.mock('../lib/api', ...)` not `vi.mock('@/lib/api', ...)`. The codebase already uses both patterns (existing page tests use `../lib/...`). Match the existing pattern. |
| `commit_docs: true` in `.planning/config.json` | Config | After RESEARCH.md is written, it must be committed via `gsd_run query commit`. |
| `nyquist_validation: true` in `.planning/config.json` | Config | Include the `## Validation Architecture` section in this RESEARCH.md (skip-if condition does not apply). |
| `security_enforcement: true` in `.planning/config.json` | Config | Include the `## Security Domain` section in this RESEARCH.md. Phase 16's security surface is minimal (no auth, no encryption, no PII handling in new code) — primarily V5 (input validation) and V6 (no hand-rolled crypto). |
| `human_verify_mode: "end-of-phase"` | Config | All test verification happens at end of phase, not per-task. |
| `branching_strategy: "none"` | Config | No worktrees, no branches. Commit to current branch (likely main). |
| `code_review: true` / `code_review_depth: "standard"` | Config | Standard code review applies to new code; depth is the default. |
| `use_worktrees: false` | Config | Do not create worktrees. |
| `search_gitignored: false` | Config | Standard gitignore-respecting file search. |

## Architectural Responsibility Map

Phase 16 spans three capability domains. Mapping to architectural tiers (per the standard
component-tier taxonomy used by GSD research) clarifies where each piece of work lives:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `<ErrorBoundary>` offline-detection (D-01/D-02/D-03) | Frontend Server (SSR) / Client | — | Runs in React render tree; no server-side work. ErrorBoundary is a client-only primitive (no SSR fallback in this app — Vite SPA). |
| vitest-axe `extend-expect` import (D-06/D-07) | Test infrastructure | — | Lives in `tests/setup.ts` which is the vitest setup hook. No production code impact. |
| Layout/Topbar/Sidebar/ProtectedRoute smoke tests (TST-05) | Test infrastructure | — | Test files in `src/components/*.test.tsx`. No production code change. |
| Per-page render-only smoke tests (TST-06) | Test infrastructure | — | Test files in `src/pages/*.test.tsx`. No production code change. |
| SkipToContent verification (A11Y-01) | Client | — | Already wired in Layout.tsx line 83. Phase 16 only adds a test that asserts the focusable link is present. |

**Net new production code:** ~15-25 lines in `ErrorBoundary.tsx` (the `isOfflineError` predicate +
branched render). **Net new test code:** ~400-500 lines (4 component test files + 8 page test files +
1 line in `tests/setup.ts`).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| `vitest` | `^4.1.9` (lockfile: 4.1.10) | Test runner | Phase 12 DEP-02 upgrade; v4 parallelization 30-50% faster than v1.2 | VERIFIED (package.json:71 + node_modules) |
| `@testing-library/react` | `^16.3.2` | DOM render + queries | React 19-compatible; jsdom-native; standard for vitest | VERIFIED (package.json:58) |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers (toBeInTheDocument etc.) | Phase 12 install; used implicitly via `screen.getByText` truthy checks | VERIFIED (package.json:57) |
| `@testing-library/dom` | `^10.4.1` | Underlying DOM testing utilities | Required by `@testing-library/react` | VERIFIED (package.json:56) |
| `jsdom` | `^24.0.0` | Browser environment for vitest | Required for `document.querySelector`, `localStorage`, etc. | VERIFIED (package.json:64 + vite.config.ts:27) |
| `@vitest/coverage-v8` | `^4.1.10` | Coverage with perFile: true | Phase 15 install; v8 provider | VERIFIED (package.json:62) |
| `vitest-axe` | `^0.1.0` | `toHaveNoViolations()` matcher + `axe()` runner | CONTEXT.md D-06; already in devDeps | VERIFIED (package.json:72 + node_modules/vitest-axe@0.1.0) |
| `axe-core` | `^4.12.1` | Underlying aXe engine | Pulled by vitest-axe and `@axe-core/playwright` | VERIFIED (package.json:51 + node_modules/axe-core@4.12.1) |
| `react-error-boundary` | `^6.1.2` | `<ErrorBoundary>` provider | Phase 13 install; replaces the old class component | VERIFIED (package.json:41) |
| `react-error-boundary` types | bundled | `FallbackProps` type | Imported in `ErrorBoundary.tsx:2` | VERIFIED |

### Supporting

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `react-router-dom` | `^6.21.1` | `<MemoryRouter>` for tests | All smoke tests; replaces `BrowserRouter` to avoid URL state | VERIFIED (package.json:43) |
| `swr` | `^2.2.4` | `SWRConfig` with mock fetcher | Page smoke tests that trigger `useSWR` | VERIFIED (package.json:46) |
| `lucide-react` | `^1.14.0` | Icons (TriangleAlert, WifiOff, Menu, etc.) | Component tests render the icons via the components they live in | VERIFIED (package.json:38) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest-axe` | `@axe-core/playwright` (e2e) | `@axe-core/playwright` requires Playwright + dev server running; not appropriate for unit/component tests. `src/__tests__/a11y/pages.test.ts` already uses this for the e2e path (Phase 17 TST-07). |
| `toHaveNoViolations()` matcher | Manual `expect(results.violations).toHaveLength(0)` | `toHaveNoViolations()` gives better failure messages (reporter output is formatted with selectors + help URLs). The existing `src/__tests__/a11y/components.test.tsx` uses the manual approach; CONTEXT.md D-07 wants the matcher. |
| `axe(container)` (container) | `axe(document.body)` (full body) | `container` is scoped to the rendered subtree only; avoids noise from global document state (Toaster, side panels). Recommended pattern. |
| One big smoke test per file | 12-16 per-concern tests (D-04) | Per-concern tests catch the right regression (e.g., a SyncStatusBanner bug that breaks Layout). |

**Installation:** No new packages required. `vitest-axe@^0.1.0` is already at `package.json:72` and
verified in `node_modules/vitest-axe/` (with `dist/index.js`, `dist/matchers.js`, `dist/extend-expect.d.ts`).
`axe-core@4.12.1` is in `node_modules/axe-core/`. `react-error-boundary@6.1.2` already provides
`FallbackProps` and the `ErrorBoundary` component. No `npm install` step needed for 16-01.

**Version verification:** All packages verified against `package.json` + `node_modules/` (lockfile
resolves to exact versions: vitest 4.1.10, @vitest/coverage-v8 4.1.10, vitest-axe 0.1.0, axe-core
4.12.1, jsdom 24.0.0). The only `^` ranges in `package.json` resolve to the same installed
versions per `package-lock.json`. No drift detected.

## Package Legitimacy Audit

> Required by the Package Legitimacy Gate protocol. Phase 16 does NOT install new external
> packages — every tool referenced is already in `package.json` and verified in `node_modules/`.

| Package | Registry | Installed Version | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|-------------|---------|-------------|
| `vitest-axe` | npm | `0.1.0` (lockfile) | `https://github.com/chaance/vitest-axe` | OK | Already installed; verify wiring only |
| `axe-core` | npm | `4.12.1` (lockfile) | `https://github.com/dequelabs/axe-core` | OK | Already installed (transitive + direct via `@axe-core/playwright`) |
| `@testing-library/react` | npm | `16.3.2` (lockfile) | `https://github.com/testing-library/react-testing-library` | OK | Already installed (Phase 12) |
| `@testing-library/jest-dom` | npm | `6.9.1` (lockfile) | `https://github.com/testing-library/jest-dom` | OK | Already installed (Phase 12) |
| `jsdom` | npm | `24.0.0` (lockfile) | `https://github.com/jsdom/jsdom` | OK | Already installed (Phase 12) |
| `react-error-boundary` | npm | `6.1.2` (lockfile) | `https://github.com/bvaughn/react-error-boundary` | OK | Already installed (Phase 13) |

**Audit findings:**
- `vitest-axe@0.1.0` is the only published version on the `latest` dist-tag. The `pre: 1.0.0-pre.5`
  tag exists but is unstable. The 0.1.0 release is ~1 year old and has 6 transitive deps
  (axe-core, chalk, redent, lodash-es, aria-query, dom-accessibility-api). All deps verified
  installed via `node_modules/`.
- `axe-core@4.12.1` is current (latest stable at time of research).
- No postinstall scripts in any of these packages that would require extra audit (verified
  `npm view vitest-axe scripts.postinstall` returns nothing concerning — package has no
  `postinstall` script in its `package.json`).
- No cross-ecosystem confusion (all are npm packages for Node/Vite environment).

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

*Per the provenance rule, `vitest-axe` was discovered via CONTEXT.md (user decision), not via
WebSearch or training data. It is `VERIFIED` because: (1) it exists in `package.json` at the user-
specified version `^0.1.0`, (2) `npm view vitest-axe` confirms it is published by `chancestrickland`
(the package's author per its `package.json` `author` field), and (3) the package contents in
`node_modules/vitest-axe/` match the published tarball. Tagged `[VERIFIED: npm registry]`.*

## Architecture Patterns

### System Architecture Diagram

```
                         (User opens page in app)
                                   |
                                   v
                  <Routes> from routes.tsx mounts <Private> wrapper
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
            <ProtectedRoute>                   <PublicLayout> etc.
            (uses getCurrentUser)              (no auth gate)
                  |
        +---------+---------+
        |                   |
        v                   v
   authorized: null    authorized: true
   ("Verifying...")    render <Layout>{children}</Layout>
                              |
                              v
   +------<Layout>-------------------+
   | <SkipToContent />          (a11y)  |
   | <AriaLiveRegion> (offline status) |
   | <SyncStatusBanner>                  |
   | <Topbar>                            |
   | <Sidebar>                           |
   | <main>                              |
   |   <ErrorBoundary>  <-- wraps <Outlet>; this is where offline detection lives
   |     {children}     <-- the actual page (or via Outlet)
   |   </ErrorBoundary>                  |
   | </main>                             |
   | <BottomNav>                         |
   +-------------------------------------+
```

The 4 component smoke tests exercise the *Layout* subtree; the 8 page smoke tests exercise the
*children* inside the `<ErrorBoundary>`. The offline-UI restoration (D-01/D-02) modifies only the
`ErrorFallback` component which is the visual content of `<ErrorBoundary>` when an error is caught.

### Recommended Project Structure

```
kapwa-client/
├── tests/
│   └── setup.ts                     <-- +1 line: import 'vitest-axe/extend-expect'
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx        <-- modified: +isOfflineError + branched render
│   │   ├── ErrorBoundary.test.tsx   <-- +1 test: offline branch
│   │   ├── Layout.test.tsx          <-- NEW (16-02): 4-5 tests
│   │   ├── Topbar.test.tsx          <-- NEW (16-02): 3-4 tests
│   │   ├── Sidebar.test.tsx         <-- NEW (16-02): 2-3 tests
│   │   └── ProtectedRoute.test.tsx  <-- NEW (16-02): 3-4 tests
│   └── pages/
│       ├── AccessCardPrintView.test.tsx   <-- NEW (16-03)
│       ├── AuditorPage.test.tsx           <-- NEW (16-03)
│       ├── ContactPage.test.tsx           <-- NEW (16-03)
│       ├── CoordinatorDashboardPage.test.tsx <-- NEW (16-03)
│       ├── IrfDetailPage.test.tsx         <-- NEW (16-03)
│       ├── MayorReportsPage.test.tsx      <-- NEW (16-03)
│       ├── MyAccessCardPage.test.tsx      <-- NEW (16-03)
│       └── ProgramsPage.test.tsx          <-- NEW (16-03)
```

**File count:** 11 new test files + 1 modified production file + 1 modified test file + 1 modified
setup file. All co-located per the existing convention.

### Pattern 1: Offline Detection in ErrorFallback (D-01/D-02)

**What:** Add a synchronous `isOfflineError(error)` predicate to `ErrorBoundary.tsx` and branch the
fallback render between the existing TriangleAlert UI (generic) and the `<EmptyState variant="offline" />`
UI (network/fetch failure).

**When to use:** When a React component throws `TypeError('Failed to fetch')` (most common) or
any error with `navigator.onLine === false` (offline mode).

**Example:**

```tsx
// src/components/ErrorBoundary.tsx (proposed modification)
import { EmptyState } from './EmptyState';
import { TriangleAlert } from 'lucide-react';
import { AriaLiveRegion } from './a11y/AriaLiveRegion';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Button } from './ui/button';
import { Link } from 'react-router-dom';

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof Error) {
    return error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message);
  }
  return false;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  if (isOfflineError(error)) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <EmptyState variant="offline" onAction={resetErrorBoundary} />
      </div>
    );
  }
  // ... existing TriangleAlert + AriaLiveRegion + Try Again + Go to Dashboard
}

// Existing export unchanged
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

**Note:** `EmptyState variant="offline"` already accepts an `onAction` prop (verified at
`EmptyState.tsx:49` — the `offline` variant calls `onAction?.()` instead of navigating). The
`resetErrorBoundary` from `react-error-boundary`'s `FallbackProps` is the perfect match.

### Pattern 2: vitest-axe Global Setup (D-06/D-07)

**What:** Add a single line to `tests/setup.ts` to enable the `toHaveNoViolations()` matcher
globally. No per-file setup required.

**When to use:** Once, in the vitest setup file.

**Example:**

```typescript
// tests/setup.ts (proposed addition)
import 'vitest-axe/extend-expect';

// ... existing setup (localStorage, crypto, navigator)
```

**Usage in any test file:**

```typescript
import { axe } from 'vitest-axe';

it('Layout has no a11y violations', async () => {
  const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Note:** The existing `src/__tests__/a11y/components.test.tsx` uses the raw `expect(results.violations).toHaveLength(0)`
pattern. After Phase 16, all axe tests should use the matcher for consistent failure messages
(the `vitest-axe` matcher's `message()` reporter prints violation IDs, selectors, HTML snippets,
and help URLs — see `node_modules/vitest-axe/dist/matchers.js`). The existing file does NOT need
to be modified in Phase 16 (out of scope per D-06: "Do NOT add axe to the 3 existing page snapshot
tests"), but the new Layout/Topbar/Sidebar tests should use the matcher.

### Pattern 3: Component Smoke Test with Mock Auth (D-04/D-05)

**What:** Render the component in `<MemoryRouter>` with a stubbed `useAuth` from
`@/lib/auth-context`. Assert on the rendered DOM (heading text, button presence, class names).

**When to use:** For all 4 component smoke tests (Layout, Topbar, Sidebar, ProtectedRoute).

**Example (Layout.test.tsx):**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Layout } from './Layout';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  }),
}));

vi.mock('@/lib/offline-queue', () => ({
  loadQueue: () => [],
}));

describe('Layout', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
    expect(container.querySelector('main')).toBeTruthy();
  });

  it('renders SkipToContent link that is focusable', () => {
    render(<MemoryRouter><Layout /></MemoryRouter>);
    const skip = screen.getByText('Skip to content');
    expect(skip).toBeTruthy();
    expect(skip.closest('a')?.getAttribute('href')).toBe('#main-content');
  });

  it('wraps Outlet in ErrorBoundary', () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
    // The ErrorBoundary is invisible when no error is thrown. Verify the
    // main container is present and the Layout's structure is correct.
    const main = container.querySelector('main#main-content');
    expect(main).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Note:** `Layout` requires the auth mock to satisfy `useAuth()` on line 51. It also requires
`loadQueue` from `@/lib/offline-queue` to be mocked because `computePendingCount` (line 22) reads
`localStorage` on mount and falls back to `0` if empty. The mock prevents any `localStorage` I/O
in jsdom from interfering with the test.

### Pattern 4: Per-Page Render-Only Smoke Test (D-09/D-10/D-11)

**What:** Render the page in `<MemoryRouter>` with stubbed `useAuth` and an SWRConfig that
returns `undefined` data (so the page renders the loading skeleton). Assert the page shell is
mounted (heading or main div present).

**When to use:** For all 8 untested pages in Plan 16-03.

**Example (AuditorPage.test.tsx):**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AuditorPage } from './AuditorPage';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'auditor@test.com', fullName: 'A B', role: 'auditor' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('AuditorPage', () => {
  it('renders the page shell', async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter>
          <AuditorPage />
        </MemoryRouter>
      </SWRConfig>
    );
    // The page renders a PageShell with a "Reports" or "Audit" heading.
    // We assert SOMETHING mounted; the exact text is page-specific.
    expect(screen.getByRole('heading', { name: /audit|hash|consent/i })).toBeTruthy();
  });
});
```

**Note:** Some pages (e.g., `ContactPage`) have no `useSWR` and no auth dependency. For those,
the test is even simpler — just `render(<MemoryRouter><ContactPage /></MemoryRouter>)` and
assert the page-specific heading or button is in the DOM. The auth mock is included for
consistency; it's a no-op if the page doesn't call `useAuth`.

### Anti-Patterns to Avoid

- **Anti-pattern: Re-rendering the whole app in `<App />` for page tests.** The existing pattern
  uses `<MemoryRouter><Page /></MemoryRouter>` directly. Rendering the full app requires the
  AuthProvider, ThemeProvider, SWRConfig, and is overkill for a render-only smoke test. (Per
  CaseTrackerPage.test.tsx:43-48 precedent.)
- **Anti-pattern: Mocking `navigator.onLine` globally instead of per-test.** Use
  `Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })` in
  `beforeEach` for the specific test, then restore in `afterEach`. The Phase 10
  `setupOffline()/setupOnline()` helpers used this pattern (see
  `ErrorBoundary.test.tsx:14-20` for the `vi.spyOn(console, 'error')` precedent; the offline
  helper was removed in Phase 13 but the pattern is still applicable).
- **Anti-pattern: Adding `axe()` to the 3 existing page snapshot tests.** D-06 explicitly defers
  this to Phase 17 (TST-07). Adding it now would inflate the scope and could surface unrelated
  a11y violations in pages that the team hasn't yet reviewed.
- **Anti-pattern: Skipping the auth mock for Topbar.test.tsx because it has multiple `useAuth`
  consumers.** Topbar reads `user`, `logout`, `theme`, and `setTheme` — all of which require
  stubs. The same applies to Layout (reads `user`) and Sidebar (reads `user`).
- **Anti-pattern: Importing from `@/` in tests.** The codebase convention is relative imports
  in tests (per `CONVENTIONS.md`); the existing page tests use `vi.mock('../lib/api', ...)` and
  `import { PageName } from './PageName'`. The new test files must follow this convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG 2 AA violation detection | A custom linter or rule-checker for `aria-*` props | `axe(container)` from `vitest-axe` | axe-core implements ~80 WCAG rules with edge-case handling (e.g., contrast calculation, ARIA role validation, landmark discovery). Hand-rolling would miss edge cases. |
| Network/offline detection | Custom event listeners + manual `navigator.onLine` polling | The existing `Layout.tsx:60-66` `online`/`offline` event handlers + the proposed `isOfflineError` predicate in `ErrorBoundary.tsx` | The Layout-level handler already manages state; the ErrorBoundary just needs to read `navigator.onLine` at error time. No new event infrastructure needed. |
| `SkipToContent` link | A custom keyboard handler that hides/shows a link on focus | The existing `<SkipToContent />` component (`src/components/a11y/SkipToContent.tsx`) with Tailwind `sr-only focus:not-sr-only` | Standard pattern; already wired in Layout. |
| Async/await in jsdom for axe | Custom `setTimeout` waits | `await axe(container)` directly | vitest-axe returns a Promise; awaiting is sufficient. |
| Test for a `useSWR`-fetching page | A real fetch mock with `nock` or `msw` | `<SWRConfig value={{ fetcher: ... }}>` wrapper with a `vi.fn()` that resolves to the page's expected data | The existing 20 page tests use this pattern. SWRConfig dedupes requests and handles loading states cleanly. |

**Key insight:** The whole point of CONTEXT.md D-06 is to bring the `vitest-axe` matcher into the
project. Hand-rolling any a11y check would defeat the purpose. The `toHaveNoViolations()` matcher
is the contract that the Phase 17 CI gate will rely on.

## Common Pitfalls

### Pitfall 1: `toHaveNoViolations()` not recognized as a matcher

**What goes wrong:** Tests fail with `TypeError: results.toHaveNoViolations is not a function` or
`expect(results).toHaveNoViolations is not a function`.

**Why it happens:** The `vitest-axe/extend-expect` import is missing from `tests/setup.ts`. The
matcher is registered globally when this import is loaded.

**How to avoid:** Plan 16-01 Task 1 must add `import 'vitest-axe/extend-expect';` to
`tests/setup.ts` BEFORE any test that uses `toHaveNoViolations()` is added. The import is a
side-effect import — it just augments Vitest's `expect` type. No usage in the setup file itself.

**Warning signs:** If Task 2 or 3 of 16-01 (or any task in 16-02) uses `toHaveNoViolations()` and
the import is missing, the error appears on the first test that uses the matcher. Catch this in
Wave 0 with a single dry-run: `npx vitest run --reporter=verbose src/__tests__/a11y/components.test.tsx`
should still pass (it doesn't use the matcher, but confirms the setup didn't break).

### Pitfall 2: `EmptyState` for the offline variant calls `navigate()` if `onAction` is not provided

**What goes wrong:** When the ErrorBoundary renders `<EmptyState variant="offline" />` without
the `onAction` prop, clicking "Retry" calls `useNavigate` to navigate to `/dashboard` (per
`EmptyState.tsx:49-54`). This is a side effect that could be wrong for a Try Again button.

**Why it happens:** Looking at `EmptyState.tsx:48-55`, the handleAction function checks the
variant. For `no-results` and `offline`, it calls `onAction?.()`. But if `onAction` is undefined
(it would be for a no-data or no-access variant, not offline), the click is a no-op. CONTEXT.md
D-02 explicitly says to pass `onAction={resetErrorBoundary}` so the click triggers the boundary
reset, not a navigation.

**How to avoid:** The 16-01 implementation must pass `onAction={resetErrorBoundary}` explicitly
to the `<EmptyState variant="offline" />`. The D-03 test should also assert the click triggers
a reset (similar to the existing "Try Again button resets error state" test).

**Warning signs:** If the test for the offline branch doesn't assert the button text or behavior,
the missing `onAction` prop could go undetected until a user clicks Retry and gets navigated
away unexpectedly.

### Pitfall 3: Layout test fails because `loadQueue` is not mocked

**What goes wrong:** `<Layout>` calls `computePendingCount()` on mount, which calls
`loadQueue()` from `@/lib/offline-queue`. If `loadQueue` reads `localStorage` (which it does,
at `offline-queue.ts:27`), and the localStorage mock in `tests/setup.ts:4-12` is empty, it
returns `[]` — so the test passes. BUT the test runs in jsdom where `localStorage` may already
have `kapwa_sync_queue` from a previous test (the `afterEach` in `tests/setup.ts:58-60` does
`localStorage.clear()`).

**Why it happens:** If the test file runs AFTER another test that wrote `kapwa_sync_queue` to
localStorage, and the Layout test doesn't mock `@/lib/offline-queue`, the layout may render
the SyncStatusBanner unexpectedly (because `pendingCount > 0`).

**How to avoid:** Plan 16-02's Layout.test.tsx should mock `@/lib/offline-queue`:
`vi.mock('@/lib/offline-queue', () => ({ loadQueue: () => [] }))`. This ensures the banner is
hidden and the offline state matches the test's expectations. The `afterEach: localStorage.clear()`
in the global setup is a backstop but not a primary defense.

**Warning signs:** If a Layout test "passes" locally but fails in CI with a different test
ordering, this is the most likely cause. The mock removes the dependency entirely.

### Pitfall 4: `ProtectedRoute` test for "redirects to /login" doesn't actually redirect

**What goes wrong:** `ProtectedRoute.tsx:22-48` uses `useEffect` to call `getCurrentUser()`,
which makes an HTTP-like call to `/auth/me`. The test should not test the redirect path with
real network calls. The component is async — `authorized` starts as `null` and only updates
after the `useEffect` runs.

**Why it happens:** The component is fundamentally async. Testing it requires either:
1. Mocking `getCurrentUser` from `@/lib/auth-context` to return a Promise that resolves
   immediately (or rejects) and then asserting the `navigate('/login')` call.
2. Asserting the "Verifying access..." state is shown initially, then resolving the Promise
   and asserting the children are rendered.

**How to avoid:** Plan 16-02's ProtectedRoute.test.tsx must mock `getCurrentUser`:
```tsx
vi.mock('../lib/auth-context', () => ({
  getCurrentUser: vi.fn(),
}));
// In test:
vi.mocked(getCurrentUser).mockResolvedValue({ id: '1', role: 'social_worker', ... } as any);
```
Use `await waitFor(() => ...)` to wait for the state transition. This is a test pattern that
doesn't exist elsewhere in the codebase — it's new for Phase 16.

**Warning signs:** Tests that check the final rendered state without `await waitFor` will be
flaky and intermittently pass/fail. The 3-4 ProtectedRoute tests should all use `await waitFor`
or `findBy*` queries to handle the async state.

### Pitfall 5: Counting "missing page tests" against CONTEXT.md's 29 figure

**What goes wrong:** The planner uses CONTEXT.md's "29 pages missing tests" as the plan size for
16-03, but the on-disk count is 8. This leads to over-engineering (e.g., grouping unrelated pages
or skipping per-concern tests).

**Why it happens:** CONTEXT.md was gathered 2026-07-07 and references a page count that has
since changed (the project added tests in the interim or removed some pages).

**How to avoid:** Use the corrected list of 8 pages from the User Constraints section above. The
planner should adjust task sizing in 16-03 accordingly — 8 small test files is significantly less
work than 29. The per-file pattern is the same; just the count is different.

**Warning signs:** If 16-03's task list has >8 "add smoke test" tasks, the planner misread the
context. Verify the file list against the live filesystem at the start of 16-03.

### Pitfall 6: `axe()` on Layout hits the Sheet (sidebar) and flags a "focusable-but-not-visible" violation

**What goes wrong:** `Layout.tsx:106-110` renders a `<Sheet>` (Radix UI Dialog) that contains
the mobile sidebar nav. The Sheet is `closed` by default but Radix may render some focusable
children. `axe()` may flag "elements with role='dialog' that are not visible" or similar.

**Why it happens:** Radix UI's Sheet (and Dialog) renders content into a Portal that is
technically in the DOM but not visible (display: none or hidden). `axe-core` 4.12.1 handles
this correctly for most rules, but custom Radix portals can occasionally trigger false
positives in jsdom (where CSS doesn't apply the same way as a browser).

**How to avoid:** If a violation is found, the first step is to verify it's not a false
positive — render the same component in a real browser and run axe-core there. If it's a real
violation, fix the component (e.g., add `aria-hidden` to the closed Sheet). If it's a false
positive, configure `axe` to ignore the selector: `await axe(container, { rules: { 'aria-hidden-focus': { enabled: false } } })`.
But CONTEXT.md D-08 says to fix the violation or carve out a follow-up — not to disable rules.

**Warning signs:** A failure with a selector like `[role="dialog"]` or `radix-*` is likely
Radix-related. Inspect the rendered HTML to confirm.

## Code Examples

Verified patterns from the existing codebase. All examples come from files in this repo
(`/home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client/`).

### ErrorFallback with Offline Branch (16-01 D-01/D-02)

```tsx
// Source: src/components/ErrorBoundary.tsx (current, lines 8-26)
// Source: src/components/EmptyState.tsx (current, lines 43-68)
// Source: src/components/EmptyState.test.tsx (current, lines 49-54 for the offline onAction test)
// Proposed modification pattern:

import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';
import { EmptyState } from './EmptyState';

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof Error) {
    return error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message);
  }
  return false;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  if (isOfflineError(error)) {
    return (
      <div className="flex flex-col items-center justify-center py-16" data-testid="error-offline">
        <EmptyState variant="offline" onAction={resetErrorBoundary} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <TriangleAlert size={48} className="text-destructive" />
      <AriaLiveRegion role="alert" aria-live="assertive" message="Something went wrong">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
      </AriaLiveRegion>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Please try again later.
      </p>
      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

### Offline Test (16-01 D-03)

```tsx
// Source: src/components/ErrorBoundary.test.tsx (current, lines 13-44 for the existing pattern)
// Proposed new test (added after the 4 existing tests):

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

function FetchBomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new TypeError('Failed to fetch');
  }
  return <div>Safe content</div>;
}

describe('ErrorBoundary — offline branch', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders offline UI when TypeError("Failed to fetch") is thrown', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <FetchBomb />
        </ErrorBoundary>
      </MemoryRouter>
    );
    // The EmptyState offline variant shows the WifiOff icon and "You appear to be offline" message.
    expect(screen.getByText('You appear to be offline')).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });
});
```

### vitest-axe Setup (16-01)

```typescript
// Source: tests/setup.ts (current, lines 1-61)
// Proposed addition at the top of the file:

import 'vitest-axe/extend-expect';
// ... rest of existing setup
```

### Component Smoke Test (16-02 D-04)

```tsx
// Source: src/components/PublicLayout.test.tsx (current, lines 1-13) — pattern reference
// Source: src/components/BottomNav.test.tsx (current, lines 1-16) — pattern reference
// New file: src/components/Layout.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Layout } from './Layout';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  }),
}));

vi.mock('@/lib/offline-queue', () => ({
  loadQueue: () => [],
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Layout />
    </MemoryRouter>
  );
}

describe('Layout', () => {
  it('renders main container', () => {
    const { container } = renderLayout();
    expect(container.querySelector('main#main-content')).toBeTruthy();
  });

  it('renders SkipToContent link as the first focusable element', () => {
    renderLayout();
    const skip = screen.getByText('Skip to content');
    expect(skip.closest('a')?.getAttribute('href')).toBe('#main-content');
  });

  it('has no a11y violations', async () => {
    const { container } = renderLayout();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Page Smoke Test (16-03 D-09/D-10/D-11)

```tsx
// Source: src/pages/CaseTrackerPage.test.tsx (current, lines 1-49) — pattern reference
// New file: src/pages/AuditorPage.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AuditorPage } from './AuditorPage';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'auditor@test.com', fullName: 'A B', role: 'auditor' },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('AuditorPage', () => {
  it('renders the page shell', () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter>
          <AuditorPage />
        </MemoryRouter>
      </SWRConfig>
    );
    // The page renders a PageShell. The exact heading depends on the
    // page's data-fetching state; assert SOMETHING mounted.
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `expect(results.violations).toHaveLength(0)` | `expect(results).toHaveNoViolations()` with `import 'vitest-axe/extend-expect'` | Phase 16 (16-01) | Better failure messages with violation IDs, selectors, HTML snippets, help URLs. |
| Class component `<ErrorBoundary>` with `componentDidCatch` | `<ReactErrorBoundary>` from `react-error-boundary@6.1.2` (function component wrapper) | Phase 13 (13-02) | Smaller code (37 lines vs 83), modern API. Phase 16 re-adds the offline-detection that was dropped in the migration. |
| 29 untested pages | 8 untested pages | Between Phase 13 (13-02) and Phase 15 | Phase 15 added more page tests. The "29" figure in CONTEXT.md is stale. |
| Per-page custom fetch mocks | `<SWRConfig value={{ fetcher: vi.fn() }}>` wrapper | Phase 14 (API-02) + Phase 15 | Standardized test pattern; no need for `nock`/`msw`. |
| `getByText('text').toBeTruthy()` | `findByRole('heading', { name: 'text' })` (async, role-based) | Phase 12 (test infra) | More semantic; catches missing `aria-label`/`role` regressions. |
| 4 existing ErrorBoundary tests (after Phase 13) | 5 tests after Phase 16 adds the offline branch | Phase 16 (16-01) | ROADMAP #6 says "6 existing tests" but that's stale; the actual current state is 4 tests, and Phase 16 adds 1 to make 5. The "6" figure is no longer exact (per CONTEXT.md "Deferred Ideas" — interpret as "all existing tests continue to pass"). |

**Deprecated/outdated:**
- **`<EmptyState variant="offline" onAction={navigate('/dashboard')} />`**: was the default
  behavior before Phase 16's ErrorBoundary wiring. The `offline` variant with no `onAction` does
  nothing on click (calls `onAction?.()` which is undefined → no-op). Phase 16 wires
  `onAction={resetErrorBoundary}` explicitly. This is a behavior CHANGE for the EmptyState's
  usage in ErrorBoundary only — other consumers (e.g., page-level empty states for offline)
  are unaffected.
- **Class-based `ErrorBoundary`**: removed in Phase 13. Phase 16 continues the function-component
  pattern. The `componentDidCatch` logging is preserved via the `onError` prop on
  `<ReactErrorBoundary>`.

## Assumptions Log

> Lists claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section
> to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The on-disk page count (8) is correct, not CONTEXT.md's 29. | User Constraints "CONTEXT.md Figure Correction" | If a page was created/moved/deleted between CONTEXT.md gathering and plan execution, the count changes. Mitigation: Plan 16-03 should run `ls src/pages/*.tsx | grep -v '\.test\.'` at the start to confirm. |
| A2 | `vitest-axe@0.1.0`'s `toHaveNoViolations()` matcher works with the existing vitest 4.1.10 setup. | Standard Stack + Pattern 2 | If vitest 4.1.10 changed the matcher registration API, the import in `tests/setup.ts` would silently fail. Mitigation: The first task of 16-01 should add the import + verify with a 1-line smoke test before Plan 16-02 lands. |
| A3 | `axe-core` 4.12.1's default ruleset (`wcag2a` + `wcag2aa`) is sufficient for the ROADMAP #5 a11y requirement. | D-07 in User Constraints | If the project needs `wcag21aa` or `best-practice`, the test config needs an explicit `rules` parameter. Mitigation: If a Phase 16 a11y test fails with `wcag2aa` only, the fix is to add `wcag21aa` to the test config. |
| A4 | The existing `src/__tests__/a11y/components.test.tsx` test continues to pass with `import 'vitest-axe/extend-expect'` added to `tests/setup.ts` (the import is a side-effect import and doesn't affect the existing tests' manual `expect(results.violations).toHaveLength(0)` assertions). | Pattern 2 / Pitfall 1 | If the global import breaks the existing tests, Phase 16 regresses previously-green tests. Mitigation: The first task of 16-01 should run `npx vitest run` after adding the import to confirm 197+ tests still pass. |
| A5 | `EmptyState`'s `offline` variant correctly accepts an `onAction` callback that is invoked when the Retry button is clicked. | Pattern 1 / Pitfall 2 | If the EmptyState's handleAction logic has a bug (e.g., always navigates regardless of onAction), the Phase 16 wiring won't work. Mitigation: `EmptyState.test.tsx:49-54` already tests this behavior with `no-results` variant, but NOT `offline` (the test only checks `no-results` and the inline `onAction` is invoked). The Phase 16 implementation should add a test confirming `offline` also respects onAction, OR rely on the existing `no-results` test as evidence of the same code path. |
| A6 | The 8 missing pages all have a heading or main `<div>` that can be asserted in a render-only smoke test. | Pattern 4 | If a page is render-only with no DOM landmarks (e.g., just a portal to a Canvas), the test cannot easily assert "page mounted". Mitigation: A11y-axe-style tests don't help here (axe needs content). The fallback is `expect(container.innerHTML).not.toBe('')` + a `console.error` spy. |
| A7 | The Layout, Topbar, Sidebar components are a11y-compliant as built (the shadcn primitives they use are designed for WCAG 2 AA). | Common Pitfall 6 + D-08 | If `axe()` finds a real violation in Layout/Topbar/Sidebar, Phase 16 must fix the component or carve out a follow-up. The 8 pages don't get axe, so the surface is limited. |

**If this table is empty:** All claims in this research were verified or cited — no user
confirmation needed. (A1 is a correction; A2-A7 are minor verification steps that are
self-resolving in 16-01 Task 1.)

## Open Questions

1. **Should `axe()` be run on the *full* Layout subtree (including the Sidebar Sheet that may
   render in a closed Portal), or on a more limited container?**
   - What we know: `Layout.tsx:106-110` renders a Radix `<Sheet>` for the mobile sidebar. Radix
     may render some children even when closed.
   - What's unclear: Whether `axe-core` 4.12.1's default ruleset flags the closed Sheet as a
     violation.
   - Recommendation: Run `axe()` on the full `container` first. If a false positive appears,
     switch to a limited container like `container.querySelector('main')`.

2. **Should the 8 page smoke tests use the same SWRConfig mock pattern as the existing 20
   page tests, or a simpler "no fetcher" approach?**
   - What we know: The existing pattern is `<SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>`
     where `mockApiGet.mockResolvedValue(...)` returns the expected data. The CONTEXT.md D-09
     suggests "useSWR returns undefined data, the page renders the loading skeleton — that's
     fine for a smoke test", which implies NO mock fetcher is needed.
   - What's unclear: Whether some pages (e.g., IrfDetailPage, AccessCardPrintView) crash on
     render if useSWR is unmocked and tries to fetch.
   - Recommendation: Try the no-mock approach first (simpler). If a page crashes, fall back to
     the SWRConfig-with-mock pattern from the existing 20 tests. Most pages are tolerant of
     undefined data.

3. **Should the page smoke tests be grouped (e.g., all 8 in one file) or 1 file per page?**
   - What we know: CONTEXT.md D-10 says "per-page test file is co-located" but allows grouping
     "for related pages". The existing 20 page tests follow 1-file-per-page convention.
   - What's unclear: Whether the 8 remaining pages are related enough to group.
   - Recommendation: 1 file per page. Each is small (15-25 lines), co-located, and easy to
     find. Grouping adds friction without significant benefit at this size.

4. **What role should the auth mock use for the 8 page tests?**
   - What we know: Each page is role-gated by `<ProtectedRoute roles={[...]}>` in `routes.tsx`.
     The page itself may not check roles, but the smoke test should not trigger redirect logic.
   - What's unclear: Whether the smoke test should mock the role that matches the page (e.g.,
     `auditor` for AuditorPage, `claimant` for MyAccessCardPage) or use a generic `social_worker`.
   - Recommendation: Use the role that matches the page's primary consumer (e.g., `auditor`
     for AuditorPage, `coordinator` for CoordinatorDashboardPage, `claimant` for MyAccessCardPage).
     This ensures the page's content (which may be role-gated internally) is rendered, not the
     empty fallback.

## Environment Availability

> Skipped: this section applies to phases that depend on external tools, services, or runtimes
> beyond the project's own code. Phase 16 is entirely code/test changes with no external
> dependencies — no new CLIs, databases, or services.

**Skip reason:** Phase 16 only modifies existing test files, the ErrorBoundary component, and
the test setup. All tooling (vitest 4.1.10, @testing-library/react 16.3.2, jsdom 24.0.0,
vitest-axe 0.1.0, axe-core 4.12.1) is already installed and verified working via
`npx vitest run src/components/ErrorBoundary.test.tsx` (4/4 pass).

**Pre-existing tooling verified:**
| Tool | Version | Path | Notes |
|------|---------|------|-------|
| vitest | 4.1.10 | `node_modules/vitest/` + `node_modules/.bin/vitest` | Confirmed via `npx vitest --version` |
| @vitest/coverage-v8 | 4.1.10 | `node_modules/@vitest/coverage-v8/` | Phase 15 install |
| jsdom | 24.0.0 | `node_modules/jsdom/` | Vite `test.environment: 'jsdom'` config |
| axe-core | 4.12.1 | `node_modules/axe-core/` | Pulled by `vitest-axe` and `@axe-core/playwright` |
| vitest-axe | 0.1.0 | `node_modules/vitest-axe/` | Matchers + extend-expect + axe() runner |

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — include this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + jsdom 24.0.0 + @testing-library/react 16.3.2 |
| Config file | `kapwa-client/vite.config.ts` (test block at lines 26-46) |
| Quick run command | `cd kapwa-client && npx vitest run src/components/ErrorBoundary.test.tsx` |
| Full suite command | `cd kapwa-client && npx vitest run` (excludes e2e + a11y/pages) |
| Coverage command | `cd kapwa-client && npm run coverage:check` (v8 provider, perFile: true) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-01 #2 | `TypeError('Failed to fetch')` shows offline UI in ErrorBoundary | unit | `npx vitest run src/components/ErrorBoundary.test.tsx -t "offline"` | ❌ Wave 0 (16-01) |
| TST-05 | Layout renders + axe clean | unit | `npx vitest run src/components/Layout.test.tsx` | ❌ Wave 0 (16-02) |
| TST-05 | Topbar renders + user dropdown + role-gated sync queue | unit | `npx vitest run src/components/Topbar.test.tsx` | ❌ Wave 0 (16-02) |
| TST-05 | Sidebar renders + role-gated nav items + active highlight | unit | `npx vitest run src/components/Sidebar.test.tsx` | ❌ Wave 0 (16-02) |
| TST-05 | ProtectedRoute redirects when unauth | unit | `npx vitest run src/components/ProtectedRoute.test.tsx` | ❌ Wave 0 (16-02) |
| TST-05 | ProtectedRoute renders children when authorized | unit | `npx vitest run src/components/ProtectedRoute.test.tsx` | ❌ Wave 0 (16-02) |
| TST-06 | 8 page smoke tests (render without crash) | unit | `npx vitest run src/pages/{AuditorPage,ContactPage,CoordinatorDashboardPage,MayorReportsPage,MyAccessCardPage,ProgramsPage,IrfDetailPage,AccessCardPrintView}.test.tsx` | ❌ Wave 0 (16-03) |
| A11Y-01 | SkipToContent is present and focusable in Layout | unit (assertion in Layout.test.tsx) | `npx vitest run src/components/Layout.test.tsx` | ❌ Wave 0 (16-02) |
| A11Y-02 | CI fails on a11y violations | deferred to TST-07 (Phase 17) | — | — (out of scope per CONTEXT.md) |

### Sampling Rate

- **Per task commit:** `cd kapwa-client && npx vitest run src/components/ErrorBoundary.test.tsx` (16-01) or `npx vitest run src/components/Layout.test.tsx` (16-02) or `npx vitest run src/pages/<NewPage>.test.tsx` (16-03).
- **Per wave merge (end of plan):** `cd kapwa-client && npx vitest run` — full suite must pass.
- **Phase gate:** Full suite green + `npm run build` succeeds before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/components/ErrorBoundary.test.tsx` — add 1 test for the offline branch (16-01)
- [ ] `src/components/Layout.test.tsx` — create with 4-5 tests (16-02)
- [ ] `src/components/Topbar.test.tsx` — create with 3-4 tests (16-02)
- [ ] `src/components/Sidebar.test.tsx` — create with 2-3 tests (16-02)
- [ ] `src/components/ProtectedRoute.test.tsx` — create with 3-4 tests (16-02)
- [ ] `src/pages/AuditorPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/ContactPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/CoordinatorDashboardPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/MayorReportsPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/MyAccessCardPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/ProgramsPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/IrfDetailPage.test.tsx` — create with 1 test (16-03)
- [ ] `src/pages/AccessCardPrintView.test.tsx` — create with 1 test (16-03)
- [ ] `tests/setup.ts` — add `import 'vitest-axe/extend-expect';` (16-01)
- [ ] `src/components/ErrorBoundary.tsx` — add `isOfflineError` + branched render (16-01)

**Wave 0 test count:** 0 → 12-16 component tests + 8 page tests + 1 ErrorBoundary test =
**21-25 new tests** (within the 12-16 component budget of D-04 plus 8 page tests).

## Security Domain

> `security_enforcement: true` in `.planning/config.json` — include this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Tests run in isolated jsdom; no production code paths touch user data |
| V2 Authentication | no | Phase 16 does NOT modify auth logic; ProtectedRoute is tested but unchanged |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes (tested) | ProtectedRoute's role-gating is the test target, not a new control |
| V5 Input Validation | yes (tested) | The 8 page tests verify pages render without crashing from valid auth context |
| V6 Cryptography | no | No crypto changes; vitest-axe + axe-core are test-only, not production crypto |
| V7 Error Handling and Logging | yes (modified) | ErrorBoundary's offline branch is an error-handling improvement; `onError` prop logs to `console.error` (preserved from Phase 13) |
| V9 Communications | no | No network changes |
| V10 Malicious Code | yes (verified) | All test deps are verified via package legitimacy audit (see Package Legitimacy Audit section). No slop packages. |
| V11 Business Logic | yes (verified) | The 8 page smoke tests verify each page's render-only contract; role-gated pages tested with the correct role to assert content renders. |
| V12 Files and Resources | no | No file handling in Phase 16 |
| V13 API and Web Service | no | No API changes |
| V14 Configuration | no | vite.config.ts test block is unchanged (Phase 15 already configured v8 coverage) |

### Known Threat Patterns for {vitest-axe + axe-core stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| axe-core running untrusted HTML in test suite | Tampering | All test HTML is generated by React components, not user input. jsdom is isolated. No risk. |
| vitest-axe @0.1.0 ~1 year old (no new releases) | Repudiation | Verified package contents match npm registry tarball; no postinstall scripts; no suspicious deps. Acceptable. |
| axe-core 4.12.1 in devDependencies | — | Test-only dep; not in production bundle. Confirmed by Vite's tree-shaking and the absence of axe imports in `src/**/*.{ts,tsx}` (production code). |
| `import 'vitest-axe/extend-expect'` in `tests/setup.ts` (side-effect import) | Tampering | The import is verified via `node_modules/vitest-axe/dist/extend-expect.d.ts` to only augment Vitest's `expect` types — no runtime side effects beyond matchers registration. |
| Auth-context mock in page tests bypasses real auth | Spoofing (test-only) | Tests are in `.test.tsx` files excluded from production builds. The mock is scoped to `vi.mock('@/lib/auth-context', ...)` per test file. No risk. |
| EmptyState's `onAction` callback executing side effects in ErrorBoundary | Elevation of Privilege | The callback is `resetErrorBoundary` from `react-error-boundary`, which only resets the boundary state. No privileged action. |

**Security verdict:** Phase 16 is a low-risk quality-polish phase. The only production-code change
is the ErrorBoundary offline branch (~15 lines). No auth, crypto, or PII handling changes. The
test additions use isolated mocks and standard testing patterns.

## Sources

### Primary (HIGH confidence)

- **node_modules/vitest-axe/dist/index.d.ts** — confirmed `axe` and `configureAxe` exports, AxeCore re-export
- **node_modules/vitest-axe/dist/matchers.js** — confirmed `toHaveNoViolations` implementation with filterViolations + reporter
- **node_modules/vitest-axe/dist/extend-expect.d.ts** — confirmed global Vi.Assertion augmentation with AxeMatchers
- **node_modules/vitest-axe/README.md** — confirmed `vitest-axe/extend-expect` is the recommended setup import
- **npm registry** — `npm view vitest-axe` confirmed version 0.1.0 published by chancestrickland
- **kapwa-client/package.json:71-72** — confirmed vitest 4.1.9 + vitest-axe 0.1.0 in devDependencies
- **kapwa-client/vite.config.ts:26-46** — confirmed vitest test config (jsdom, setup files, v8 coverage, perFile threshold)
- **kapwa-client/src/components/ErrorBoundary.tsx:1-37** — confirmed current 37-line function-component wrapper, no offline branch
- **kapwa-client/src/components/EmptyState.tsx:30-35, 48-55** — confirmed `offline` variant and onAction handling
- **kapwa-client/src/components/Layout.tsx:51, 83, 106-110, 112-116** — confirmed `useAuth` use, SkipToContent, Sheet, ErrorBoundary wrap of Outlet
- **kapwa-client/src/components/Topbar.tsx:4, 27, 38-42** — confirmed `useAuth` use, role-based gating (isAdmin, isSocialWorker, etc.)
- **kapwa-client/src/components/Sidebar.tsx:2, 11-12, 17-19** — confirmed `useAuth` use, role-based `visibleItems` filter
- **kapwa-client/src/components/ProtectedRoute.tsx:1-55** — confirmed auth check, roleRedirectMap, useEffect-driven authorize
- **kapwa-client/src/lib/nav-config.tsx:18-58** — confirmed NAV_GROUPS with role lists (admin, social_worker, coordinator, claimant, mayor, auditor)
- **kapwa-client/src/lib/offline-queue.ts:26-29** — confirmed `loadQueue` reads `localStorage`
- **kapwa-client/src/pages/routes.tsx (well, src/routes.tsx:52-89)** — confirmed all 27 routed pages (20 tested + 8 untested) and their role gates
- **kapwa-client/tests/setup.ts:1-61** — confirmed current setup (localStorage mock, crypto, navigator.onLine, afterEach clear)
- **kapwa-client/src/__tests__/a11y/components.test.tsx:1-167** — confirmed existing axe usage (raw pattern, not matcher)
- **.planning/phases/16-ui-polish-errorboundary-a11y-core-ui-tests/16-CONTEXT.md:1-141** — confirmed all D-01..D-13 decisions
- **.planning/REQUIREMENTS.md:25-44** — confirmed ERR-01, TST-05, TST-06, A11Y-01, A11Y-02
- **.planning/ROADMAP.md:75-87** — confirmed Phase 16 success criteria (6 criteria)
- **.planning/config.json:24, 45-46** — confirmed `nyquist_validation: true` and `security_enforcement: true`

### Secondary (MEDIUM confidence)

- **.planning/phases/13-major-version-upgrades/13-02-SUMMARY.md:73-98** — confirmed the Phase 13 ErrorBoundary rewrite (D-07 dropped offline detection)
- **.planning/phases/15-core-module-tests/15-CONTEXT.md:1-200** — confirmed vitest-axe was deferred from Phase 15 to Phase 16
- **.planning/phases/12-toolchain-cleanup-vitest-upgrade/12-02-SUMMARY.md** — confirmed vitest v4 upgrade and 70% coverage threshold pattern (per Phase 12)

### Tertiary (LOW confidence)

- **CONTEXT.md figure of 29 missing pages** — superseded by live on-disk count of 8 (A1 assumption). Plan 16-03 should verify the on-disk count at execution time.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | All packages verified in `package.json` + `node_modules/` + npm registry. No new installs. |
| Architecture | HIGH | Existing component file structure verified on disk (Layout, Topbar, Sidebar, ProtectedRoute, ErrorBoundary, EmptyState). |
| Test patterns | HIGH | 20 existing page tests + 4 ErrorBoundary tests + 1 a11y test reviewed. Precedent for all 3 patterns (component smoke, page smoke, axe). |
| Pitfalls | MEDIUM | 6 pitfalls identified from code reading + Phase 10-13 lessons learned. The "offline branch in ErrorBoundary" path is new (Phase 16) and has no prior tests, so Pitfall 2 (`onAction` wiring) is MEDIUM confidence. |
| Page count correction | MEDIUM | On-disk count verified via `ls + comm -23` (8 pages), but the CONTEXT.md "29" figure was provided by the user in discussion — user may have intended a different state. Plan 16-03 should verify. |
| vitest-axe API | HIGH | `vitest-axe@0.1.0` API verified via `node_modules/vitest-axe/dist/*.d.ts` and the README. |

**Research date:** 2026-07-07
**Valid until:** 2026-08-07 (30 days — stack is stable, all deps locked, no fast-moving dependencies)
