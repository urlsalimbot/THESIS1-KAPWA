# Phase 11: Page Migration, Print & Offline UI - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate 16 existing authenticated pages to shadcn components with proper loading/empty/error states using shared components from Phase 10 (PageShell, skeletons, EmptyState, ErrorBoundary, DataTable). Add print-ready A4 layouts for government reports (CSR, Access Card, Intervention Log, IRF). Build offline-aware UI: sync status banner, queue panel in sidebar, and cache staleness indicators.

Consumes from Phase 10: PageShell, 3 skeleton variants, EmptyState (4 variants), ErrorBoundary, Sonner Toaster, DataTable system, BottomNav, useMediaQuery, 44px touch targets.
Depends on Phase 07 (design tokens) and Phase 08 (layout shell with sidebar/topbar/breadcrumbs).

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **D-01:** Incremental page-by-page migration — each page group gets its own plan task, deploy independently
- **D-02:** Migrate order: Dashboard first (most-viewed, pattern-setter), then Beneficiaries, Cases, Access Card/CSR, IRF, Admin/Settings, Claimant Dashboard
- **D-03:** Refactor in place — keep existing business logic, swap DOM/CSS for shadcn components + PageShell wrappers. No rewrites from scratch for complex pages (Intake, Cases, Approvals)
- **D-04:** Each migrated page gets a regression test verifying key elements render (headings, tables, buttons) with mock data. Run all page tests in CI.

### Print Layout
- **D-05:** Print-ready layouts for CSR, Access Card, Intervention Log, and IRF
- **D-06:** MSWDO Norzagaray header (logo + office name + address) at top. Footer: page numbers, print date, control number. DSWD seal and RA 11032 reference in footer
- **D-07:** A4 portrait, 20mm margins, 12pt serif base font. Tables in intervention log remain portrait with column adjustments
- **D-08:** Signature block (Worker name + signature + date, Client signature + date) on last page only. `break-inside-avoid` on signature block. Page X of Y on every page
- **D-09:** `@media print` CSS hides navigation, sidebar, buttons. Shows clean A4 layout with branding

### Sync Queue Panel
- **D-10:** Sidebar sliding panel (shadcn Sheet) triggered by sync status button in sidebar/topbar. Calendar-accessible from any page without navigation
- **D-11:** All pending sync operations visible: operation type, entity name, timestamp, status (pending/syncing/failed/conflict)
- **D-12:** Failed items: Retry button. Conflict items: View diff + Resolve (keep local / keep server / keep both). All items: swipe to remove
- **D-13:** Live updates via sync engine events — items show real-time progress (spinner during sync, checkmark on done, X on failure)

### Cache Staleness Indicators
- **D-14:** Time-based staleness: show "Cached X min ago" badge based on elapsed time since last successful sync
- **D-15:** Subtitle badge on PageShell — "Cached data — last sync X min ago" with clock icon. Not per-card
- **D-16:** All data-fetching pages show staleness indicator when viewing cached data
- **D-17:** Staleness threshold: 5 minutes (matches SWR stale-while-revalidate interval)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — All requirements: PGM-01 through PGM-06, PRN-01, PRN-02, OFF-01, OFF-02, OFF-03, DIF-02

### Project Context
- `.planning/PROJECT.md` — Project overview, core value, milestone goals
- `.planning/ROADMAP.md` — Phase 11 goal, success criteria, dependencies

### Prior Phase Artifacts (shared components consumed)
- `.planning/phases/10-shared-components-responsive/10-CONTEXT.md` — Phase 10 decisions (PageShell, skeletons, EmptyState, ErrorBoundary, DataTable, BottomNav)
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — Phase 08 decisions (sidebar, topbar, breadcrumbs, dark mode)
- `.planning/phases/07-foundation-design-system/07-CONTEXT.md` — Phase 07 design token decisions

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` — File layout and page list
- `.planning/codebase/ARCHITECTURE.md` — Architecture patterns
- `.planning/codebase/CONVENTIONS.md` — Coding conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 10)
- `kapwa-client/src/components/PageShell.tsx` — Page wrapper with sticky title/description/actions header
- `kapwa-client/src/components/skeletons/TableSkeleton.tsx` — Row-based table loading skeleton
- `kapwa-client/src/components/skeletons/CardGridSkeleton.tsx` — Card grid loading skeleton
- `kapwa-client/src/components/skeletons/FormSkeleton.tsx` — Form layout loading skeleton
- `kapwa-client/src/components/EmptyState.tsx` — 4-variant empty state (no-data, no-results, offline, no-access)
- `kapwa-client/src/components/ErrorBoundary.tsx` — Network-aware error boundary wrapping `<main>` in Layout.tsx
- `kapwa-client/src/components/data-table/DataTable.tsx` — TanStack Table with server-side sort/search/paginate
- `kapwa-client/src/components/BottomNav.tsx` — Mobile bottom tab navigation
- `kapwa-client/src/hooks/use-media-query.ts` — Responsive breakpoint detection hook
- Sonner Toaster in routes.tsx — Global notification system for CRUD operations

### Pages to Migrate (16 total)
- **Dashboard**: DashboardPage, ClaimantDashboardPage
- **Beneficiaries**: BeneficiariesPage, BeneficiaryViewPage, IntakePage
- **Cases**: CasesPage, InterventionsPage, CaseTrackerPage, ApprovalPipelinePage
- **Access Card**: AccessCardPage, CsrPage
- **IRF**: IrfPage
- **Admin**: AdminPage, MfaSetupPage, FilingPage, MessagesPage

### Established Patterns
- PageShell wrapper for consistent page header (title + description + actions)
- DataTable with server-side sort/search/paginate for all list views
- ErrorBoundary at `<main>` level in Layout.tsx (single global crash boundary)
- EmptyState named CTAs per variant (no-data → /intake, no-results → onAction, offline → Retry)
- Sidebar Sheet pattern for mobile menus — reusable for sync queue panel

### Integration Points
- Sync engine already exists (delta sync with Ed25519 signatures, version vectors)
- Sync queue panel needs to interface with existing offline sync protocol
- Print CSS must hide sidebar/topbar/BottomNav — this is per-page `@media print` in each page, OR a global print stylesheet with display:none on layout elements

</code_context>

<specifics>
## Specific Ideas

- Dashboard migration sets the pattern all other pages follow — invest in getting it right
- Print CSS: prefer global print stylesheet approach (single file) over per-page overrides, with `display: none` on `.no-print` class applied to layout elements

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-page-migration-print-offline-ui*
*Context gathered: 2026-06-29*
