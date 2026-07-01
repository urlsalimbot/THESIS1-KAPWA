# Phase 08: Dashboard Shell & Layout - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the app shell (sidebar, topbar, layout wrapper) that every authenticated page renders inside. This phase replaces the monolithic Layout.tsx with a modular Sidebar + Topbar + Layout shell, wires dark mode through next-themes, adds breadcrumbs derived from route state, ships the user menu with settings and dark mode toggle, and adds skip-to-content for keyboard accessibility.

Downstream phases (10-12) import these components to wrap every page. Phase 09 (Landing & Auth) runs independently — it depends on design tokens (Phase 07) but not the app shell.
</domain>

<decisions>
## Implementation Decisions

### Sidebar Behavior
- **D-01:** Sidebar is non-collapsible on desktop — always visible at 256px width. No icon-only/mini mode.
- **D-02:** On mobile (<1024px), sidebar slides in via shadcn `<Sheet>` component. Triggered by hamburger button in topbar.
- **D-03:** Sidebar shows role-filtered navigation grouped by category headers:
  - **Core:** Dashboard, GIS Intake, Cases, Beneficiaries
  - **Operations:** Interventions, Approvals, CSR Generator, Digital Filing, Programs
  - **Admin:** Admin Panel, MFA Settings
  - **Reports & Tracker:** Daily Tracker, Reports (mayor), Audit Logs (auditor)
  - **Claimant:** My Dashboard, My Access Card
- **D-04:** Active route highlighted with `bg-muted text-foreground`. Route grouping derived from path prefix.

### Dark Mode
- **D-05:** Use `next-themes` `<ThemeProvider>` wrapping the entire app. Attribute strategy: `class`.
- **D-06:** Persist preference to `localStorage`. Respect `prefers-color-scheme` on first visit.
- **D-07:** Toggle in user menu dropdown — Sun/Moon icon toggles `setTheme('light' | 'dark')`.

### Breadcrumbs
- **D-08:** Breadcrumbs derived from current route path segments — not a hardcoded map.
- **D-09:** A `BREADCRUMB_LABELS` constant maps route patterns to labels:
  '/' → 'Dashboard', '/intake' → 'GIS Intake', '/cases' → 'Cases', etc.
- **D-10:** For parameterized routes, breadcrumb uses entity name from route state or generic "View {Entity}" label.
- **D-11:** Renders using shadcn `<Breadcrumb>` component.

### User Menu & Topbar
- **D-12:** User menu triggered by avatar click, rendered as shadcn `<DropdownMenu>` with:
  - Profile info card (name + role)
  - Dark Mode toggle
  - Settings link → Change Phone Number, Change Password
  - Separator
  - Logout
- **D-13:** Settings page implementation deferred to Phase 12 — menu shell only.

### Layout File Structure
- **D-14:** Split into `Layout.tsx`, `Sidebar.tsx`, `Topbar.tsx` in `src/components/`.
- **D-15:** Existing Layout.tsx is replaced entirely.

### Accessibility
- **D-16:** First focusable element is "Skip to content" link targeting `<main id="main-content">`.

### Mobile
- **D-17:** No bottom tab nav yet — deferred to Phase 10.
- **D-18:** Mobile sidebar uses shadcn `<Sheet>`.
- **D-19:** Offline banner preserved as-is.

### Preservation
- **D-20:** NotificationsDropdown.tsx, MessagesPopover.tsx, ProtectedRoute.tsx unchanged.
- **D-21:** routes.tsx structure unchanged.
- **D-22:** NAV_ITEMS data preserved (moved into a shared nav config).

</decisions>

<canonical_refs>
## Canonical References

### Files To Modify
- `kapwa-client/src/components/Layout.tsx` — Replace with modular shell
- `kapwa-client/src/routes.tsx` — Add ThemeProvider wrapper

### Files To Create
- `kapwa-client/src/components/Sidebar.tsx`
- `kapwa-client/src/components/Topbar.tsx`
- `kapwa-client/src/lib/breadcrumbs.ts` — Label map + resolver

### Files To Preserve
- `NotificationsDropdown.tsx`, `MessagesPopover.tsx`, `ProtectedRoute.tsx`
- All `src/components/ui/*.tsx` (22 components)

### References
- `tailwind.config.js` — darkMode: "class"
- `index.css` — .dark block defined
- `package.json` — next-themes ^0.4.6 installed

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Layout.tsx (182 lines)
- Monolithic: sidebar, topbar, nav items, offline banner, mobile overlay.
- 15 NAV_ITEMS with path/label/icon/roles.
- No DropdownMenu on avatar — static display.
- Mobile via translate-x backdrop overlay (to be replaced with Sheet).
- NotificationsDropdown and MessagesPopover already imported.

### Current Routing
- routes.tsx: AuthProvider → ErrorBoundary → RouterProvider.
- 24 flat routes, 3 parameterized (:id).
- Private() wrapper: ProtectedRoute → Layout → page.

### Theme
- next-themes installed, no ThemeProvider in tree.
- darkMode: "class" and .dark block ready.

</code_context>

<specifics>
## Specific Ideas

- **Breadcrumb resolver**: `createBreadcrumbs(pathname)` splits path by `/`, maps through BREADCRUMB_LABELS (longest-prefix match), returns `{label, href}[]`.
- **Nav groups**: `{ label: string, items: NavItem[] }` — group hides if zero visible items after role filter.
- **ThemeProvider placement**: Wrap AuthProvider in routes.tsx, or the root in main.tsx. Agent discretion.
- **Skip-to-content**: `<a href="#main-content" className="sr-only focus:not-sr-only">` at top of Layout.
- **Dark toggle**: Sun/Moon icon button, `setTheme(theme === 'dark' ? 'light' : 'dark')`.

</specifics>

<deferred>
## Deferred Ideas

- **Settings page** (phone + password forms) — menu entry only in Phase 08, implementation in Phase 12.
- **Bottom tab nav** — Phase 10 shared components.
- **Search wiring** — placeholder exists, deferred.
- **Help content** — keep icon, no content.

</deferred>

---

*Phase: 08-Dashboard Shell & Layout*
*Context gathered: 2026-06-27*
