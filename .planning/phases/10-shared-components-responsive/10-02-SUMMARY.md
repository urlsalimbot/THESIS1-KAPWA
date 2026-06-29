---
phase: 10-shared-components-responsive
plan: 02
subsystem: ui
tags: [react, bottom-nav, data-table, tanstack-table, shadcn, pagination, touch-targets, mobile, responsive, accessibility]

requires:
  - phase: 07-foundation-design-system
    provides: shadcn components (Table, Pagination, Button, Input), Lucide icons, Tailwind CSS layers
  - phase: 08-layout-shell
    provides: Layout.tsx with <main> insertion point, pb-16 clearance for bottom nav
  - phase: 10-shared-components-responsive-01
    provides: useMediaQuery hook, @tanstack/react-table dependency, shadcn Pagination component

provides:
  - BottomNav mobile bottom tab navigation with 5 tabs + center Quick Action button
  - DataTable controlled component system with TanStack Table (server-side sort/search/paginate pattern)
  - DataTableColumnHeader with sort direction indicators (ArrowUp/ArrowDown/ArrowUpDown)
  - DataTableToolbar with single search bar and Search icon
  - DataTablePagination with shadcn Pagination prev/next + page numbers
  - 44px touch target global CSS rule in @layer components with .touch-sm opt-out

affects:
  - phase 11-page-migration
  - phase 12-accessibility

tech-stack:
  added: []
  patterns:
    - Controlled DataTable pattern: sorting/pagination state managed externally, passed as props
    - Mobile bottom navigation: BottomNav rendered after </main>, hidden on desktop via lg:hidden
    - Global touch target enforcement: @layer components CSS targets all interactive elements
    - Barrel export pattern for data-table subsystem

key-files:
  created:
    - kapwa-client/src/components/BottomNav.tsx
    - kapwa-client/src/components/BottomNav.test.tsx
    - kapwa-client/src/components/data-table/DataTable.tsx
    - kapwa-client/src/components/data-table/DataTablePagination.tsx
    - kapwa-client/src/components/data-table/DataTableToolbar.tsx
    - kapwa-client/src/components/data-table/DataTableColumnHeader.tsx
    - kapwa-client/src/components/data-table/index.ts
    - kapwa-client/src/components/data-table/DataTable.test.tsx
  modified:
    - kapwa-client/src/components/Layout.tsx
    - kapwa-client/src/index.css

key-decisions:
  - "BottomNav uses lg:hidden for desktop hiding (matching Sidebar's hidden lg:block pattern) — consistent with existing layout approach"
  - "DataTableToolbar does not implement debounce — parent pages debounce onSearchChange to keep toolbar a simple controlled input"
  - "44px touch target rule targets button, a[href], input, select, textarea, [role=button] — covers all interactive elements without breaking shadcn Button's existing h-10 dimension"
  - "Quick Action Plus icon button uses w-12 h-12 rounded-full bg-primary with -mt-4 shadow-lg — stands out as the primary action"

patterns-established:
  - "Controlled DataTable: sorting/pagination state is URL-encoded (bookmarkable), DataTable receives props and fires callback on change"
  - "Barrel index pattern for component subsystems: data-table/index.ts re-exports all public types and components"
  - "BottomNav renders at Layout level (after </main> in the top-level fragment), not inside individual pages"

requirements-completed:
  - RES-01
  - RES-02
  - RES-03

duration: 3 min
completed: 2026-06-29
status: complete
---

# Phase 10 Plan 02: Mobile BottomNav, DataTable System, and 44px Touch Targets

**BottomNav mobile tab navigation, DataTable component system with TanStack Table + shadcn Pagination, and 44px global touch target CSS**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-29T04:18:08Z
- **Completed:** 2026-06-29T04:21:08Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- Built BottomNav with 5 tabs (Dashboard, Cases, Quick Action +, Beneficiaries, Profile) — visible on <768px via useMediaQuery, hidden on desktop via lg:hidden, active tab gets bg-muted pill highlight
- Built center Quick Action button (rounded-full bg-primary w-12 h-12 -mt-4 shadow-lg) opening GIS intake at /intake
- Wired BottomNav into Layout.tsx after `</main>` as a sibling of the flex container
- Created DataTable controlled component with TanStack Table — server-side sorting/pagination pattern via props
- Created DataTableColumnHeader with sort direction indicators (ArrowUp for asc, ArrowDown for desc, muted ArrowUpDown for unsorted)
- Created DataTableToolbar with single search bar (Search icon + Input, debounce handled by parent pages)
- Created DataTablePagination with shadcn Pagination (prev/next + page number buttons)
- Barrel export index.ts for clean data-table imports
- Added 44px global touch target CSS rule in @layer components with .touch-sm opt-out for small decorative elements (covers button, a[href], input, select, textarea, [role=button])
- Full test suite: 105 tests passing across 22 test files (10 new tests from this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BottomNav component and wire into Layout.tsx** - `0d3228d` (feat)
2. **Task 2: Create DataTable component system** - `9579edb` (feat)
3. **Task 3: Enforce 44px touch targets globally via CSS** - `29723e8` (feat)

## Files Created/Modified

### Created
- `kapwa-client/src/components/BottomNav.tsx` — Mobile bottom tab navigation with 5 tabs + center Quick Action
- `kapwa-client/src/components/BottomNav.test.tsx` — 5 tests for BottomNav rendering, active state, Quick Action, desktop hide
- `kapwa-client/src/components/data-table/DataTable.tsx` — Controlled TanStack Table wrapper with server-side sort/search/paginate pattern
- `kapwa-client/src/components/data-table/DataTablePagination.tsx` — shadcn Pagination prev/next + page numbers
- `kapwa-client/src/components/data-table/DataTableToolbar.tsx` — Single search bar with Search icon and controlled Input
- `kapwa-client/src/components/data-table/DataTableColumnHeader.tsx` — Sortable column header with ArrowUp/ArrowDown/ArrowUpDown indicators
- `kapwa-client/src/components/data-table/index.ts` — Barrel re-export for all data-table components
- `kapwa-client/src/components/data-table/DataTable.test.tsx` — 5 tests for rendering, loading, empty state, toolbar slot

### Modified
- `kapwa-client/src/components/Layout.tsx` — Imported and rendered `<BottomNav />` after `</main>`
- `kapwa-client/src/index.css` — Added `@layer components` block with 44px touch target rule and `.touch-sm` opt-out

## Decisions Made

- **BottomNav desktop hiding strategy:** Uses `lg:hidden` to match the existing Sidebar's `hidden lg:block` pattern — consistent Layout approach
- **Debounce responsibility:** DataTableToolbar is a controlled input — parent pages are responsible for debouncing the `onSearchChange` callback before making API calls
- **Touch target selector scope:** Targets `button, a[href], input, select, textarea, [role="button"]` — broad enough to catch all interactive elements without breaking shadcn Button (which is already h-10)
- **Quick Action visual treatment:** Raised circular button with shadow (-mt-4) and bg-primary — intentionally different from flat tabs to signal primary action affordance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All components ready for consumption by Phase 11 page migration
- BottomNav provides mobile navigation for authenticated pages
- DataTable provides reusable table with sort/search/paginate for all data-display pages
- 44px touch targets automatically apply to all existing and new interactive elements
- Phase complete — ready for next plan

---

*Phase: 10-shared-components-responsive*
*Completed: 2026-06-29*

## Self-Check: PASSED

- [x] All created files verified on disk (10/10)
- [x] All 3 commits verified in git log
- [x] Full test suite: 105 tests passing across 22 test files
- [x] `npm run build` succeeds (no TypeScript or import errors)
