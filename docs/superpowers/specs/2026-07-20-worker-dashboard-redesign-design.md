# Worker/Admin Dashboard Redesign — Design Doc

## Overview

Redesign the social_worker/admin dashboard into a widget-based bento-grid layout with independent data fetching, role-based visibility, and drag-and-drop reordering of chart/alert widgets. Backed by research on social-services dashboard best practices (Harvard GovLab, ACF).

## Architecture

```
DashboardPage
└── DashboardEngine
    ├── Fixed: StatsRow (6 KPI cards)
    ├── DnD Zone: 3-column widget grid
    │   ├── CaseStatusChart
    │   ├── SlaWidget
    │   ├── TrendsChart
    │   ├── NeedsAttention
    │   └── BarangayBreakdown
    ├── Fixed: ActivityCalendar
    └── Fixed: RecentCases (DataTable)
```

- `DashboardEngine` wraps the DnD zone with `react-grid-layout`, saves layout to localStorage per-role, and restores on reload.
- Each widget is self-contained: own SWR query, own loading skeleton, own empty/error state.
- Role-based widget visibility is declarative (a config array on `DashboardPage`).
- StatCards, ActivityCalendar, and DataTable stay fixed — no DnD benefit justifies their weight.

## Widget Catalog

### Row 1 — StatsRow (6 cards, 3-col → 2-col → 1-col)

| Widget | Data Source | Priority |
|--------|------------|----------|
| Served Today | `dashboard` endpoint | High |
| Pending Review | `dashboard` endpoint | High |
| Overdue SLA | `dashboard` endpoint | High |
| Disbursed This Month | `dashboard` endpoint | Medium |
| Unique Households | `dashboard/metrics` endpoint | Medium |
| Recent Interventions (7d) | `dashboard/metrics` endpoint | Low |

Cards show icon + label + value + change indicator. Overdue SLA card turns red/highlights when >0.

### Row 2 — DnD Widget Grid (3 columns, ~5 widgets)

**CaseStatusChart** — Vertical bar chart rendering `byStatus` from `/dashboard/metrics`. Replaces the current pie chart which derives "approved" from `disbursedMonth / 1000` (a bug — `disbursedMonth` is a monetary amount). Each bar shows count + status label.

**SlaWidget** — Compact status indicator showing SLA compliance (compliant/violated) + count of overdue cases. Links to the Cases page filtered to overdue.

**TrendsChart** — Extracted from existing DashboardPage. 6-month bar chart (cases created vs disbursed) using recharts. Gets data from `/dashboard/trends`.

**NeedsAttention** — Lists cases in `pending_assessment` or `in_review` status with direct action buttons ("Review", "Approve"). Gets data from `/dashboard` recentCases filtered by status. Max 5 items with "View All" link.

**BarangayBreakdown** — Horizontal bar chart showing case count per barangay. Computed client-side from `recentCases` (each case already includes `barangay`). Shows top 8 barangays + "Others".

### Row 3 — ActivityCalendar (fixed)

Existing calendar heatmap component extracted to its own file. Shows current month's daily activity density.

### Row 4 — RecentCases DataTable (fixed)

Existing DataTable with actions column. No changes besides minor column consolidation.

## API Changes

- **Add `recentInterventions`** to `GET /dashboard` response (already computed in `getMetrics()`, just not returned)
- **Fix `caseStatusData`** — currently derives "approved" from `disbursedMonth / 1000` (a monetary amount → fake count). The widget should use the real `byStatus` array from `GET /dashboard/metrics` instead

## Drag-and-Drop Implementation

- Library: `react-grid-layout` (~30KB gzipped)
- Scope: Only the 5 chart/alert widgets in Row 2 (not stat cards, calendar, or table)
- Persistence: `localStorage` keyed by `dashboard-layout-{role}` — restored on mount; resets to default on clearance
- Responsive: DnD disabled below `lg` breakpoint (static 2-col fallback); `react-grid-layout` handles this via `breakpoints` prop
- Accessibility: Keyboard reordering via `aria-grabbed` and tab-index management per WAI-ARIA grid pattern

## Files Changed

**New files:**
- `src/components/dashboard/StatsRow.tsx`
- `src/components/dashboard/CaseStatusChart.tsx`
- `src/components/dashboard/SlaWidget.tsx`
- `src/components/dashboard/NeedsAttention.tsx`
- `src/components/dashboard/BarangayBreakdown.tsx`
- `src/components/dashboard/TrendsChart.tsx` (extract from DashboardPage)
- `src/components/dashboard/ActivityCalendar.tsx` (extract from DashboardPage)
- `src/components/dashboard/DashboardEngine.tsx` (DnD layout orchestrator)

**Modified files:**
- `src/pages/DashboardPage.tsx` — replace inline sections with DashboardEngine
- `kapwa-server/src/dashboard/dashboard.controller.ts` — add `recentInterventions` to GET /dashboard response
- `package.json` — add `react-grid-layout` and `@types/react-grid-layout`

## Testing

- Each widget: mount with mock SWR data, verify skeleton → loaded state transition, verify empty state
- DnD: simulate layout change via `onLayoutChange`, verify localStorage write + restore
- Responsive: verify DnD disabled below lg breakpoint and grid collapses to 2-col
