# Phase 10: Shared Components & Responsive - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build reusable page-state components and responsive patterns that every authenticated page uses. This phase delivers: a PageShell wrapper for consistent page layout, skeleton components for data-loading states, empty state views (4 variants), error boundary for crash recovery, Sonner toast notifications, bottom tab navigation for mobile, responsive table patterns, and 44px touch target compliance.

These components are consumed by Phase 11 (page migration) and Phase 12 (accessibility/differentiators).

</domain>

<decisions>
## Implementation Decisions

### PageShell Wrapper
- **D-01:** PageShell includes title + description + actions in a sticky header section
- **D-02:** Responsive spacing — gap-4 on mobile, gap-8 on desktop between header and content
- **D-03:** Breadcrumbs remain in Layout.tsx (Phase 08) — PageShell handles per-page title/actions only, separation of concerns
- **D-04:** Description is a single line of muted subtitle text below the title (not metadata chips or render-prop slots)

### Skeleton Components
- **D-05:** Table skeletons are row-based, matching table column layout with variable widths (3–5 rows)
- **D-06:** Card grid skeletons match the actual grid count (2 cols desktop, 1 mobile)
- **D-07:** Default shadcn pulse animation — no shimmer or static variants
- **D-08:** Form skeletons render full form layout matching all fields (labels + input blocks + button)

### Empty State Views
- **D-09:** Single reusable EmptyState component with variant prop: `no-data`, `no-results`, `offline`, `no-access`
- **D-10:** Lucide icons for all 4 variants (already in project dependencies)
- **D-11:** Named CTA per variant — "Add first item" (no-data), "Clear filters" (no-results), "Retry" (offline), "Go to dashboard" (no-access)
- **D-12:** Professional/informative message tone — "No cases found", "No results match your search"

### Error Boundary
- **D-13:** Single global `<ErrorBoundary>` wrapping `<main>` in Layout.tsx
- **D-14:** Displays error icon + "Something went wrong" message + Retry button (resets state) + "Go Home" link
- **D-15:** Retry resets error boundary state (React ErrorBoundary default — does NOT reload the page)
- **D-16:** Differentiates network errors ("Check your connection" + retry) vs render errors (generic "Something went wrong" + home link)

### Sonner Toast Notifications
- **D-17:** Toasts positioned top-center
- **D-18:** Manual dismiss only — no auto-dismiss for any toast variant
- **D-19:** Error toasts are also manual dismiss only (same behavior as success/info)
- **D-20:** Simple/default Sonner styling with app color tokens — no custom rich toast component

### Bottom Tab Navigation
- **D-21:** 5 tabs: Dashboard, Cases, Beneficiaries, Profile + center Quick Action button
- **D-22:** Visible on mobile (<768px) always, optionally on tablet (<1024px); desktop uses sidebar (Phase 08)
- **D-23:** Active tab uses pill/highlight background behind icon
- **D-24:** Center Quick Action button opens GIS intake form directly

### 44px Touch Targets
- **D-25:** Audit existing interactive elements AND enforce on all new components
- **D-26:** Primary targets: inline action buttons, icon-only buttons, clickable badges/pills
- **D-27:** Global CSS override approach — `min-h-[44px]` and `min-w-[44px]` on all interactive elements

### Table Interaction Patterns
- **D-28:** Server-side sorting (sort params sent to API)
- **D-29:** Single search bar above table filtering across columns
- **D-30:** Page numbers + prev/next (shadcn Pagination component)
- **D-31:** Native horizontal scroll wrapper (`overflow-x-auto`) for mobile tables

### the agent's Discretion
- Exact column layout for each table (varies by page)
- Search debounce timing and minimum character threshold
- Empty state icon selection per variant (Lucide has many options)
- Toast component integration details (Sonner wrapper setup)
- Error boundary component implementation details
- Bottom nav bar height and animation specifics
- Touch target CSS selector strategy for global override

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & State
- `.planning/REQUIREMENTS.md` §STT-01–STT-05 — Page states (loading, empty, error, success)
- `.planning/REQUIREMENTS.md` §RES-01–RES-03 — Responsive design, mobile navigation, touch targets
- `.planning/ROADMAP.md` §Phase 10 — Goal, success criteria, plan breakdown

### Prior Phase Context (locked decisions to maintain)
- `.planning/phases/07-foundation-design-system/07-CONTEXT.md` — Design tokens, shadcn component list (skeleton, table, sonner, sheet, tabs), dark mode CSS
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-17: bottom tab nav deferred to Phase 10; Layout shell with breadcrumbs/sidebar/topbar

### Codebase Maps
- `.planning/codebase/STACK.md` — React 18, Vite 8, Tailwind 3.4, shadcn/ui
- `.planning/codebase/STRUCTURE.md` — Component locations, page directory layout
- `.planning/codebase/CONVENTIONS.md` — Naming, imports, styling patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn `<Skeleton>` component — installed in Phase 07, ready for skeleton variants
- shadcn `<Table>`, `<Pagination>`, `<Tabs>`, `<Sheet>` — all installed in Phase 07
- `sonner` (`<Toaster>`, `toast()`) — installed in Phase 07, needs wrapper setup
- `lucide-react` — already in dependencies, used for icons throughout app
- Sidebar/Topbar/Layout shell — Phase 08, bottom nav needs to coexist/overlap on mobile

### Established Patterns
- CSS custom properties + Tailwind utility classes — standard styling approach
- `useAuth()` context — auth state available for role-aware UI
- `next-themes` `<ThemeProvider>` with `class` strategy — dark mode integration

### Integration Points
- `<main id="main-content">` in Layout.tsx — PageShell wraps content here
- `src/components/Layout.tsx` — ErrorBoundary wraps `<main>`, bottom nav appends after `<main>`
- Router routes in `src/routes.tsx` — each page consumes PageShell
- Sonner `<Toaster>` — added in root layout or routes.tsx near ThemeProvider

</code_context>

<specifics>
## Specific Ideas

- Bottom nav Quick Action is a GIS intake shortcut — social workers' most common field action
- Error boundary should ship with both a generic render-error view and a network-error detection path (check `navigator.onLine` or failed fetch detection)
- Table sort/filter/paginate params should be URL-encoded (query params) for shareable/bookmarkable state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-shared-components-responsive*
*Context gathered: 2026-06-28*
