---
phase: 08
phase_name: layout-shell
plan: 08
completed: 2026-06-28
tasks: 7
tasks_completed: 7
tasks_skipped: 0
requirements_covered: LAY-01, LAY-02, LAY-03, LAY-04, DSG-05
---

# Phase 08 — Layout Shell: Summary

## What Was Built

The monolithic `Layout.tsx` (182 lines) was split into a modular composition of:

- **Sidebar.tsx** (64 lines) — Desktop 256px sidebar with ScrollArea, plus shared `SidebarNavContent` for the mobile Sheet. Role-filtered nav groups from `nav-config.tsx`.
- **Topbar.tsx** (149 lines) — Logo, role badge, search bar, NotificationsDropdown, MessagesPopover, help button, and user DropdownMenu with dark mode toggle, settings link, and logout.
- **Layout.tsx** (98 lines) — Composition shell: SkipToContent → OfflineBanner → Topbar → (Sidebar | Sheet) → BreadcrumbNav → main content. Uses `useAuth()` context instead of `getCurrentUser()` call, eliminating double-fetch with ProtectedRoute.

Supporting files:
- **nav-config.tsx** — 5 groups (Core, Operations, Admin, Reports & Tracker, Claimant), 13 items, role-filtered
- **breadcrumbs.ts** — `createBreadcrumbs()` resolver + `BREADCRUMB_LABELS` map (21 routes)
- **scroll-area.tsx** — shadcn ScrollArea installed
- **routes.tsx** — Wrapped `<AuthProvider>` with `<ThemeProvider attribute="class">` (next-themes at ^0.4.6)

## Files Created
- `kapwa-client/src/lib/nav-config.tsx`
- `kapwa-client/src/lib/breadcrumbs.ts`
- `kapwa-client/src/components/Sidebar.tsx`
- `kapwa-client/src/components/Topbar.tsx`
- `kapwa-client/src/components/ui/scroll-area.tsx`

## Files Modified
- `kapwa-client/src/components/Layout.tsx` — Complete rewrite as composition shell
- `kapwa-client/src/routes.tsx` — Added ThemeProvider wrapper
- `kapwa-client/src/lib/nav-config.ts` → `nav-config.tsx` (renamed for JSX)

## Files Preserved
- `kapwa-client/src/components/NotificationsDropdown.tsx`
- `kapwa-client/src/components/MessagesPopover.tsx`
- `kapwa-client/src/components/ProtectedRoute.tsx`
- All existing shadcn/ui components
- All page components

## Requirements Covered

| # | Requirement | Status |
|---|-------------|--------|
| LAY-01 | Sidebar with role-filtered nav groups, active highlighting | ✓ |
| LAY-02 | Topbar with user menu, notifications, messages | ✓ |
| LAY-03 | Breadcrumb navigation from route segments | ✓ |
| LAY-04 | Skip-to-content link for keyboard accessibility | ✓ |
| DSG-05 | Dark mode toggle in user menu (next-themes) | ✓ |

## Key Metrics
- `Layout.tsx`: 182 lines → 98 lines (-46%)
- New files created: 5
- Files modified: 2 (plus rename)
- Build: passes
- Dark mode: `next-themes` `attribute="class"` strategy, `.dark` class on `<html>`
- Auth: No double-fetch (Layout uses `useAuth()` context, ProtectedRoute handles fetch)
- Mobile: Sheet slide-from-left on `<lg` breakpoint, closes on route change

## Decisions Applied
- D-01: Non-collapsible 256px sidebar (desktop), Sheet (mobile)
- D-05: next-themes ThemeProvider wrapping with class strategy
- D-08: Breadcrumbs derived from route segments
- D-14: Layout split into Layout.tsx, Sidebar.tsx, Topbar.tsx
- D-16: Skip-to-content as first focusable element
- D-22: NotificationsDropdown, MessagesPopover preserved unchanged

## Deviations
- nav-config.ts renamed to nav-config.tsx (JSX content requires .tsx extension)
- BreadcrumbNav extracted to standalone function above Layout component (prevents remount on every render)
- Topbar does not import `createBreadcrumbs` (breadcrumbs render in Layout.tsx per UI-SPEC layout diagram)
