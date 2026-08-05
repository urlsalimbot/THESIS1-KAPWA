---
phase: 23-dashboard-redesign
plan: 01
subsystem: dashboard
tags: [dashboard, widgets, react-grid-layout, roles]
requires:
  - phase: 13-major-version-upgrades
    provides: React 19 + shadcn/ui components used by the widget sets
  - phase: 14-api-client-swr
    provides: typed client + query keys for dashboard data
provides:
  - DashboardEngine + StaticDashboard (react-grid-layout draggable grid)
  - Role-based widget sets: Claimant, Mayor, Auditor, Coordinator
  - Shared dashboard widgets (StatsRow, SlaWidget, CaseStatusChart, TrendsChart, NeedsAttention, BarangayBreakdown, ActivityCalendar, QuickActionPanel)
  - Dashboard cases table aligned with Cases page columns
affects: [final audit]
tech-stack:
  added:
    - react-grid-layout ^2.2.3 + @types/react-grid-layout
  patterns:
    - role widget sets: each role gets its own widget bundle (ClaimantWidgets/MayorWidgets/AuditorWidgets/CoordinatorWidgets) so dashboards differ per audience
    - shared chart primitives: SlaWidget, CaseStatusChart, TrendsChart reused across roles
key-files:
  created:
    - kapwa-client/src/components/dashboard/DashboardEngine.tsx
    - kapwa-client/src/components/dashboard/StaticDashboard.tsx
    - kapwa-client/src/components/dashboard/dashboard-engine.css
    - kapwa-client/src/components/dashboard/widgets/{ClaimantWidgets,MayorWidgets,AuditorWidgets,CoordinatorWidgets}.tsx
    - kapwa-client/src/components/dashboard/{StatsRow,SlaWidget,CaseStatusChart,TrendsChart,NeedsAttention,BarangayBreakdown,ActivityCalendar,QuickActionPanel}.tsx
  modified:
    - kapwa-client/src/pages/DashboardPage.tsx (role widget wiring + cases table columns)
key-decisions:
  - "Role-based widget sets rather than one dashboard for everyone — claimant, mayor, auditor, and coordinator see different cards"
  - "Drag-and-drop grid was built (react-grid-layout) then switched out (ac89555) to keep the layout deterministic; the static role-widget composition is the shipped approach"
  - "Dashboard cases table reuses the Cases page column definitions so both views stay consistent"
requirements-completed: [DASH-01, DASH-02]
duration: 2d
completed: 2026-07-20
status: complete
---

# Phase 23: Worker/Admin Dashboard Redesign — Summary

**Replaced the single monolithic dashboard with role-aware widget sets and a cases table consistent with the Cases page**

## Performance

- **Duration:** ~2 days (completed 2026-07-20)
- **Key commits:** `a33bedb` (Phase 12 context — role dashboards), `6470acf` (PublicLayout + route restructure), `7db4993` (dashboard cases table matches cases page), `ac89555` (switched out DnD dashboard)

## Accomplishments

- Built `DashboardEngine` + `StaticDashboard` supporting a draggable widget grid (react-grid-layout installed)
- Created four role-specific widget bundles: `ClaimantWidgets`, `MayorWidgets`, `AuditorWidgets`, `CoordinatorWidgets`
- Added shared chart/stat widgets (StatsRow, SlaWidget, CaseStatusChart, TrendsChart, NeedsAttention, BarangayBreakdown, ActivityCalendar, QuickActionPanel)
- Aligned the dashboard cases table columns with the Cases page so both views show identical data
- Kept layout deterministic by switching out the drag-and-drop dashboard in favor of static role composition

## Decisions Made

- Role-differentiated dashboards: each role sees relevant widgets only
- Deterministic layout over user-draggable: the DnD engine was dropped to avoid non-deterministic grid snapshots and layout drift
- Column parity between dashboard and Cases page reduces cognitive load for workers switching views

## Deviations from Plan

- `react-grid-layout` remains installed but unused at runtime — the DnD path was replaced by StaticDashboard composition (`ac89555`)
- Role widget sets shipped before the per-role data endpoints for some metrics; some widgets read shared dashboard data

## Known Stubs

- Per-widget granular data endpoints for each role are partially shared; final audit may split metric queries per role

## Self-Check: PASSED

- [x] `DashboardEngine.tsx` + `StaticDashboard.tsx` exist
- [x] 4 role widget bundles exist under `components/dashboard/widgets/`
- [x] Shared widget files exist
- [x] `react-grid-layout` in package.json
- [x] Cases-table column parity commit present (`7db4993`)

---
*Phase: 23-dashboard-redesign*
*Completed: 2026-07-20*
