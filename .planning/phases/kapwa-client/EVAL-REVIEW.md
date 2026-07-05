# EVAL-REVIEW.md — Phase: kapwa-client

**Generated:** 2026-07-05  
**Audit Type:** State B (no AI-SPEC.md — audited against general frontend best practices)  
**Scope:** kapwa-client React frontend (28 pages, 60 components, 17 lib modules, 5 hooks)  

---

## Overall Score: 53 / 100
### Verdict: NEEDS WORK

---

## Dimension Scores

| # | Dimension | Score | Verdict |
|---|-----------|-------|---------|
| D1 | State Correctness | 6/10 | GOOD |
| D2 | API Reliability | 5/10 | WEAK |
| D3 | Error Resilience | 4/10 | WEAK |
| D4 | Accessibility Compliance | 6/10 | GOOD |
| D5 | Loading UX | 7/10 | GOOD |
| D6 | Test Coverage | 3/10 | CRITICAL |
| D7 | Offline Readiness | 5/10 | WEAK |
| D8 | Architectural Cohesion | 6/10 | GOOD |

**Critical gaps:** 2 (D6 Test Coverage, D3 Error Resilience)  
**Weak areas:** 3 (D2 API, D7 Offline, D3 Error Resilience)  

---

## Detailed Findings

### D1 — State Correctness: 6/10  GOOD

**What's working:**
- 100% of pages with API calls (10/10) include try-catch error handling at the fetch level
- Console.error used consistently for unhandled rejections
- Loading states present in 14 pages with skeleton patterns, 13 with spinners

**Gaps:**
- No centralized state management (no Zustand/Redux/Jotai)
- SWR is imported as a dependency but not used — all data fetching is raw `fetch()`
- No stale-while-revalidate caching pattern
- No request deduplication — concurrent identical requests are not coalesced

### D2 — API Reliability: 5/10  WEAK

**What's working:**
- Auth tokens consistently sourced from localStorage (`kapwa_token`)
- Bearer tokens sent on all authenticated requests
- `api.ts` (67 functions) provides some API abstraction

**Gaps:**
- Raw `fetch()` calls scattered across 10+ page files instead of centralized API client
- No request retry logic for transient failures
- No request timeout handling
- SWR dependency installed but unused — no automatic refetching or cache invalidation
- No optimistic updates

### D3 — Error Resilience: 4/10  CRITICAL

**What's working:**
- `ErrorBoundary` component exists and handles offline/network errors
- Error states render fallback UI (retry button, dashboard link)

**Gaps (CRITICAL):**
- **0 of 28 pages are wrapped in `<ErrorBoundary>`** — the component exists but is unused at the page level
- Error handling is per-page catch blocks only; no centralized error boundary
- No global error reporting or telemetry
- `console.error` used for logging but not actionable in production

### D4 — Accessibility Compliance: 6/10  GOOD

**What's working:**
- 155 `aria-label` attributes across pages
- 59 semantic headings
- `PageShell` provides consistent layout with main/content landmarks
- `vitest-axe` and `@axe-core/playwright` installed
- `SkipToContent` component exists

**Gaps:**
- `SkipToContent` component unused (not imported in any page)
- Only 2 of 31 test files include a11y checks
- No axe checks integrated into CI pipeline
- No focus trap testing

### D5 — Loading UX: 7/10  GOOD

**What's working:**
- Skeleton components available: TableSkeleton, CardGridSkeleton, FormSkeleton
- 14 pages use skeleton patterns, 13 use spinners
- `EmptyState` component with 5 variants (no-data, no-results, no-access, error, no-messages)
- `SlaTimer` with 3 size variants (sm/md/lg)

**Gaps:**
- No progressive loading (prioritized content above the fold)
- No lazy image loading
- 6 pages lack `PageShell` wrapper (public-facing pages: Landing, Login, Register, etc.)

### D6 — Test Coverage: 3/10  CRITICAL

| Metric | Value |
|--------|-------|
| Production files | 110 |
| Test files | 31 |
| Tested production files | 19 (17%) |
| Untested production files | 91 (83%) |
| Test cases | 173 |
| Assertions | 260 |
| Avg assertions per test | 1.5 |
| A11y test files | 2/31 (6%) |
| Hooks tested | 0/5 |

**Untested pages (24/28):** FilingPage, ClaimantDashboardPage, CaseTrackerPage, CsrPage, AccessCardPage, IrfPage, MfaSetupPage, AccessCardPrintView, ProgramsPage, IrfDetailPage, MyAccessCardPage, MayorReportsPage, AuditorPage, AdminPage, CasesPage, InterventionsPage, BeneficiariesPage, MessagesPage, CoordinatorDashboardPage, DashboardPage, BeneficiaryViewPage, ApprovalPipelinePage, ContactPage, IntakePage

**Untested components (47):** All non-shadcn components including CriticalPath components (Layout, Topbar, Sidebar, ProtectedRoute, SyncQueuePanel, offline-queue, secure-storage)

**Untested lib modules (15/17):** Including api.ts (67 functions), auth-context, offline-queue, secure-storage, sync, database, encrypted-db

**Untested hooks (5/5):** useSlaTimer, usePiiMasking, useDebouncedSearch, use-cache-staleness, use-media-query

### D7 — Offline Readiness: 5/10  WEAK

**What's working:**
- Offline queue implementation (`offline-queue.ts` with version vectors)
- SQLite-backed encrypted database (`encrypted-db.ts`)
- Offline-aware UI patterns in 9 files
- Sync queue panel with retry/conflict resolution UI
- `IntakePage` has "Queue for Sync" button in offline mode

**Gaps:**
- No service worker for asset caching
- Only 5 files actively use the offline queue
- Offline detection not unified — `navigator.onLine` checks are manual per-component
- No background sync registration

### D8 — Architectural Cohesion: 6/10  GOOD

**What's working:**
- Consistent shadcn/ui component usage (Radix primitives)
- `PageShell` pattern used in 22/28 pages
- Tailwind CSS for styling (no CSS modules or CSS-in-JS)
- `nav-config.tsx` centralizes navigation configuration
- Design system tokens via CSS variables

**Gaps:**
- API calls scattered across pages — no centralized API client
- Auth tokens from localStorage directly — no token refresh/rotation
- 6 pages bypass PageShell (inconsistent layout wrapper)
- Mixed styling patterns: IntakePage still uses `bg-white`, `text-gray-700` after partial cleanup

---

## Remediation Plan

### Priority 1 — Critical (before production deploy)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| P1.1 | Write tests for core data modules: api.ts, auth-context, offline-queue, secure-storage | Large | D6 +4 |
| P1.2 | Write tests for core UI components: Layout, Topbar, Sidebar, ProtectedRoute | Medium | D6 +2 |
| P1.3 | Wrap all 28 pages in ErrorBoundary | Small | D3 +3 |
| P1.4 | Add at least 1 smoke test per page (renders without error) | Large | D6 +2 |

### Priority 2 — Strongly Recommended

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| P2.1 | Create centralized API client with retry/timeout/interceptor pattern | Medium | D2 +2 |
| P2.2 | Activate SWR for data fetching with stale-while-revalidate caching | Medium | D1 +1, D2 +1 |
| P2.3 | Integrate axe-core into test suite (add a11y assertions to all page tests) | Medium | D4 +2 |
| P2.4 | Enable SkipToContent component in Layout | Small | D4 +1 |
| P2.5 | Add token refresh/rotation to auth-context | Medium | D2 +1 |

### Priority 3 — Nice to Have

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| P3.1 | Add service worker for offline asset caching | Large | D7 +2 |
| P3.2 | Unified offline detection hook | Small | D7 +1 |
| P3.3 | Complete IntakePage design token migration (remove all bg-white/text-gray-*) | Small | D8 +1 |
| P3.4 | Add lazy loading for page-level code splitting | Medium | D5 +1 |

---

## Estimated Effort to PRODUCTION READY (70+)

| Level | Tasks | Est. Days |
|-------|-------|-----------|
| Minimum (70) | P1.1 + P1.2 + P1.3 + P1.4 + P2.1 | 8-12 days |
| Solid (80) | All P1 + P2 | 14-18 days |
| Excellent (90+) | All P1 + P2 + P3 | 20-25 days |

---

## Summary

```
Score: 53/100 — NEEDS WORK
Critical gaps: 2 (Test Coverage, Error Resilience)
Auto-fixable: 6 (P1.3, P2.1, P2.3, P2.4, P3.3, P3.4)
Pattern-dependent: 4 (P1.4, P2.2, P2.5, P3.1)
Requires design: 3 (P1.1, P1.2, P3.2)
```
