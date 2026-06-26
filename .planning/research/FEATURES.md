# Feature Research

**Domain:** Government Social Welfare Management System (MSWDO)
**Researched:** 2026-06-27
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Hero/Landing Page** | Public-facing entry point; citizens and partner agencies expect an "about" page before login | MODERATE | Government app needs: mission statement, program overview, contact info, "how to apply" guidance. Must work offline (cached). F pattern layout: hero → services → steps → CTA. |
| **Auth Page with Role Selection** | 6 roles (social_worker, admin, coordinator, claimant, mayor, auditor) must have clear login flows; claimant self-register vs staff login | MODERATE | Existing LoginPage needs shadcn migration + role-aware redirect post-login. Add "Register as Claimant" entry point for beneficiary self-service. |
| **Dashboard Shell (Sidebar + Topbar)** | Persistent navigation is the skeleton of any dashboard app | HIGH | Existing Layout.tsx has basic sidebar/topbar but needs: shadcn Sidebar component, collapsible behavior, role-filtered nav groups, mobile drawer. Sidebar = 240-280px fixed, topbar = 56-64px sticky. |
| **Loading Skeleton States** | Every data-fetching view must show skeleton placeholders instantly to avoid layout shift and perceived emptiness | LOW | shadcn Skeleton component exists; patterns: table skeletons (6-10 rows), card skeletons (3-4 cards), form skeletons, dashboard metric skeletons, detail page skeletons. Use `animate-pulse` with matching dimensions. |
| **Empty State Placeholders** | Tables, lists, and search results must show meaningful empty states (illustration + message + CTA) not blank areas | LOW | 4 types: "No data yet" (first use), "No results" (search), "Offline" (no connection), "No access" (role-gated). Each needs: icon/illustration, heading, description text, optional action button. |
| **Error Fallback Pages** | Route crashes, network failures, and backend errors must never produce white screens | MODERATE | `react-error-boundary` package with granular boundaries per feature section. Top-level boundary + per-widget boundaries. Fallback UI: error icon, message, "Try again" button, "Go home" link. Log errors to console + Sentry-ready. |
| **Toast Notifications (CRUD Feedback)** | Create/update/delete operations must show success/error feedback | LOW | Sonner (shadcn default): `toast.success("Case created")`, `toast.error("Failed to save")`, `toast.promise()` for async. Position: bottom-right. Max 3 visible. Use `loading → success/error` pattern. |
| **Modal Dialogs for Confirmations** | Destructive actions (delete case, revoke consent, remove beneficiary) need confirmation dialogs | LOW | shadcn AlertDialog: title + description + cancel + confirm (destructive variant). Also: Dialog for creating records inline, Sheet for mobile side panels. |
| **Responsive Data Tables** | All list views (beneficiaries, cases, interventions, users) need sortable, filterable, paginated tables that work on mobile | HIGH | TanStack Table v8 + shadcn DataTable pattern. Must support: column sorting, global search, per-column filters, row selection for bulk actions, pagination (client + server), responsive via horizontal scroll or card list on mobile. |
| **Print-Styled Report Views** | Social workers, auditors, and mayor's office need clean print output for case reports, CSR, Access Cards, intervention logs | LOW | `@media print` + `@page` CSS rules. Hide nav, sidebar, buttons. Show print-only section headers. A4/Legal size. Color branding via `print-color-adjust: exact`. Use `break-before`, `break-inside: avoid` for tables. Wrapped in a "Print Report" button per view. |
| **Mobile Navigation for Field Workers** | Coordinators and social workers operate on phones in the field; must navigate easily with one hand | MODERATE | Bottom tab bar for main sections (Dashboard, Cases, Beneficiaries, Profile) on mobile. Sheet/Drawer for secondary navigation. Same nav config as sidebar, rendered differently per breakpoint. Hamburger menu as fallback for complex nav trees. |
| **Accessibility (ARIA + Keyboard)** | Government software must comply with RA 10173, WCAG 2.1 AA standards. Keyboard-only navigation for social workers with disabilities. | MODERATE | shadcn/Radix provides ARIA by default. Need: focus trap in modals, keyboard nav in tables, skip-to-content link, proper heading hierarchy, color contrast ≥4.5:1, focus indicators, screen-reader labels for icon-only buttons. |
| **Offline-Aware UI Indicators** | Field workers lose connectivity; the UI must show offline status, queue count, and sync progress | MODERATE | Existing offline banner (Layout.tsx) works. Enhance with: sync progress bar, pending count badge in sidebar, "Saved offline" toast on queue, "Synced" confirmation when back online. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Government-Themed Design Token System** | Consistent, professional look across all screens with Philippine government branding (blue/navy palette, seal, official typography) | MODERATE | CSS custom properties for: --primary (Phil. govt blue #0038A8), --accent (gold #FCD116), --success (green), surface tones. Tailwind theme mapped to tokens. Dark mode optional but not primary. This makes Kapwa feel like a real government system, not a SaaS template. |
| **Role-Specific Dashboards with Appropriate Data Density** | Each of 6 roles sees a tailored dashboard matching their decision-making needs (not one-size-fits-all) | HIGH | Social Worker: caseload, pending tasks, daily schedule. Admin: system stats, user activity, program metrics. Coordinator: barangay-level aggregates, referral status. Claimant: service history, application status, Access Card. Mayor: aggregate only (no PII), budget usage, SLA compliance. Auditor: hash-chain verification, audit log search. Each dashboard uses KPI cards (4-6), trend charts, recent activity feed. |
| **Offline-First UI with Queue Transparency** | Unlike most SaaS apps, Kapwa works fully offline; users can see exactly what's pending sync and what conflicts exist | MODERATE | Sync queue indicator in sidebar + detail panel. Visual badges: pending (amber), syncing (blue), failed (red), conflicts (orange) with resolve action. "Force sync" button. Cache staleness indicators on data. This builds trust — users know their offline work is safe. |
| **Consent-Aware UI Masking** | When claimant revokes consent, PII fields mask immediately without page reload, satisfying RA 10173 | HIGH | Existing ABAC pipeline + consent ledger. UI must respond: dynamically mask/unmask fields based on consent status via context/hook. Show "Consent revoked — data masked" banner. Use `useConsent()` hook that wraps any PII rendering. |
| **Compliance Badges & ARTA SLA Timers** | Show SLA timer on case approvals and compliance badges on reports for COA/DSWD audits | MODERATE | Each case card shows remaining SLA time (color-coded: green → yellow → red). Reports carry a compliance footer with DSWD/COA standard references. ARTA auto-escalation timer visible to admin/mayor. |
| **Field Worker Quick Actions** | Mobile-optimized shortcuts for common field tasks: quick intake, photo capture, signature pad, offline form save | MODERATE | Bottom sheet quick-action menu: "New Intake", "Quick Search Beneficiary", "Take Photo", "Capture Signature". These are 1-tap actions optimized for field use with thumbs. |
| **Print-Ready CSR and Case Reports** | Social Case Study Reports (CSR) and intervention summaries print directly from the app with proper government formatting | LOW | Dedicated print layout with: MSWDO letterhead, proper margins (1" all sides), pagination, signature blocks, watermark "OFFICIAL DOCUMENT". CSS-based, no server PDF generation needed. |
| **Bulk Action Toolbar in Data Tables** | Select multiple rows → bulk approve/reject/assign actions for high-volume workflows | MODERATE | Appears when rows selected: "Approve (3)", "Assign to Worker", "Export Selected". Count badge on toolbar. Only on admin/social-worker views. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Heavy Page Animations / Framer Motion** | "Make it feel modern" | Hurts perceived performance on Capacitor mobile; PWA bundle bloat; animations compete with offline sync for CPU | Use CSS transitions for micro-interactions (hover states, sidebar collapse, skeleton fade-in). No page-level animation libraries. shadcn components already include basic transitions. |
| **Desktop-Only Responsive Patterns** | "Looks cleaner on my monitor" | 60%+ of field workers use phones; wide tables with many columns don't work on 360px viewports | Mobile-first design: bottom nav for field workers, horizontal-scroll tables with sticky first column, stacked card view as mobile table alternative. Test on 360px viewport before approving any layout. |
| **Real-Time Dashboard Updates via WebSocket** | "Data should update live" | WebSocket reconnection storms on flaky rural networks; drains mobile battery; adds complexity to offline reconciliation | SWR/React Query with stale-while-revalidate on a polling interval (30s). WebSocket only for chat (existing). Dashboards refresh on reconnect + manual pull-to-refresh. |
| **Custom Chart Animations** | "Charts should animate in" | Recharts animation delays data visibility; animation library adds 20-40KB to bundle | Recharts default entrance animation is sufficient (fade-in, 300ms). No custom spring physics. Exit animations disabled for performance. |
| **Server-Side PDF Generation** | "Generate official government PDFs server-side" | Requires Puppeteer/wkhtmltopdf on server, adds deployment complexity, increases hosting cost | CSS `@media print` → browser "Save as PDF" covers 95% of use cases. Only use server-side if digital signing is required (future phase). |
| **Drag-and-Drop Everything** | "Let users drag items to reorder/assign" | Poor mobile support; accessibility nightmare for screen readers; complex state management | Use dropdown selects, button-based ordering, and checkbox bulk actions instead. |
| **Dark Mode as Primary Theme** | "Dark mode is modern" | Government social workers work in well-lit offices; dark mode hampers reading printed documents; adds QA burden | Light mode primary. Dark mode optional via Tailwind `dark:` variant. Government apps should default to professional light theme. |

## Feature Dependencies

```
[Design Token System]
    └──requires──> [Tailwind Theme Config + CSS Variables]
                          └──requires──> [shadcn/ui initialized]

[Landing/Hero Page]
    └──requires──> [Design Token System]
    └──enhances──> [Auth Page (brand consistency)]

[Auth Page with Role Selection]
    └──requires──> [Design Token System]
    └──requires──> [Existing Auth/Login infrastructure]

[Dashboard Shell (Sidebar + Topbar)]
    └──requires──> [Design Token System]
    └──requires──> [shadcn Sidebar + Sheet components]
    └──enhances──> [All page content]

[Loading Skeletons]
    └──requires──> [shadcn Skeleton component]
    └──enhances──> [All data pages]

[Empty State Placeholders]
    └──requires──> [Design Token System]
    └──enhances──> [Tables, search results, lists]

[Error Boundaries]
    └──requires──> [react-error-boundary package]
    └──enhances──> [Every feature section]

[Toast Notifications]
    └──requires──> [shadcn Sonner component]
    └──enhances──> [All CRUD operations]

[Modal Dialogs]
    └──requires──> [shadcn Dialog + AlertDialog components]
    └──enhances──> [Confirmation flows]

[Responsive Data Tables]
    └──requires──> [@tanstack/react-table + shadcn DataTable]
    └──requires──> [Existing data fetching (SWR/api)]
    └──enhances──> [Beneficiaries, Cases, Interventions, etc.]

[Print-Styled Reports]
    └──requires──> [Design Token System]
    └──enhances──> [CSR, AccessCard, Case reports]

[Mobile Navigation]
    └──requires──> [shadcn Sheet/Drawer component]
    └──requires──> [Dashboard Shell]
    └──enhances──> [Field worker experience]

[Accessibility]
    └──enhances──> [Every component]

[Role-Specific Dashboards]
    └──requires──> [Dashboard Shell]
    └──requires──> [Existing role/permission infrastructure]
    └──requires──> [Design Token System]
    └──requires──> [Recharts or chart library]

[Offline Queue Transparency]
    └──requires──> [Existing offline-queue.ts]
    └──requires──> [Toast Notifications]
    └──enhances──> [Field worker trust]

[Consent-Aware UI Masking]
    └──requires──> [Existing ABAC + consent infrastructure]
    └──requires──> [Design Token System]

[Bulk Action Toolbar]
    └──requires──> [Responsive Data Tables]
```

### Dependency Notes

- **Design Token System is the foundation.** Almost every UI feature depends on it. Must be built first (or early Phase 1).
- **Dashboard Shell** is the second dependency hub — once sidebar/topbar exists, all page content slots in.
- **Loading Skeletons + Empty States + Error Boundaries** are independent of each other but all enhance every page. They can be built in parallel once the pages they enhance exist.
- **Responsive Data Tables** depend on TanStack Table v8 installation and the shadcn DataTable pattern. This is the highest-complexity table-stakes feature.
- **Print-Styled Reports** depend only on CSS — no library needed. Lowest implementation cost of all features.

## MVP Definition

### Launch With (v1.1) — This Milestone

These 12 features form the complete UI/UX overhaul:

- [ ] **Design Token System** — Foundation for everything, theme parity between Figma and code
- [ ] **Hero/Landing Page** — Public-facing: about, programs, how to apply, login CTA
- [ ] **Auth Page Migration** — shadcn-ified login with role-aware redirect
- [ ] **Dashboard Shell** — shadcn Sidebar, collapsible, role-filtered, mobile sheet
- [ ] **Loading Skeleton Components** — Table, card, form, metric, detail skeletons
- [ ] **Empty State Components** — 4 variants: no data, no results, offline, no access
- [ ] **Error Boundaries** — Granular (per-page + per-widget) with fallback UI + retry
- [ ] **Toast Notifications** — Sonner integration for all CRUD feedback
- [ ] **Modal Dialogs** — AlertDialog for confirmations, Dialog for inline creation
- [ ] **Responsive Data Tables** — TanStack Table powered, sort/filter/paginate on beneficiaries, cases, interventions
- [ ] **Print Styles** — `@media print` for CSR, Access Card, case reports
- [ ] **Mobile Navigation** — Bottom tabs or Sheet for field workers on phones

### Add After Validation (v1.2+)

- [ ] **Role-Specific Dashboards** — Requires user feedback on which KPI each role actually needs
- [ ] **Consent-Aware UI Masking** — Requires ABAC to be fully stable in production
- [ ] **Bulk Action Toolbar** — Requires data tables to be proven in production first
- [ ] **Offline Queue Dashboard** — Enhanced sync visibility panel
- [ ] **Compliance Badges & SLA Timers** — Nice-to-have for audit readiness
- [ ] **Field Worker Quick Actions** — Bottom sheet shortcuts

### Future Consideration (v2+)

- [ ] **Dark Mode** — Feature request driven, not built proactively
- [ ] **Full WCAG 2.1 AA Audit** — Formal accessibility audit after UI is stable
- [ ] **Server-Side PDF Export** — Only if digital signatures or e-sign required
- [ ] **Advanced Chart Dashboards** — Additional chart types if users request them

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Design Token System | HIGH | LOW | P1 |
| Hero/Landing Page | MEDIUM | MODERATE | P1 |
| Auth Page Migration | HIGH | LOW | P1 |
| Dashboard Shell | HIGH | MODERATE | P1 |
| Loading Skeletons | HIGH | LOW | P1 |
| Empty State Placeholders | MEDIUM | LOW | P1 |
| Error Boundaries | CRITICAL | LOW | P1 |
| Toast Notifications | HIGH | LOW | P1 |
| Modal Dialogs | HIGH | LOW | P1 |
| Responsive Data Tables | HIGH | HIGH | P1 |
| Print Styles | MEDIUM | LOW | P1 |
| Mobile Navigation | HIGH | MODERATE | P1 |
| Role-Specific Dashboards | MEDIUM | HIGH | P2 |
| Consent-Aware UI Masking | MEDIUM | HIGH | P2 |
| Bulk Action Toolbar | MEDIUM | MODERATE | P2 |
| Offline Queue Dashboard | MEDIUM | MODERATE | P2 |
| Compliance Badges & SLA Timers | LOW | MODERATE | P3 |
| Field Worker Quick Actions | MEDIUM | MODERATE | P3 |
| Dark Mode | LOW | MODERATE | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Component Inventory — shadcn/ui to Add

Current `components/ui/`: button, avatar, badge, card, input, popover, separator.

**Must add for v1.1 (listed by feature):**

| shadcn Component | Used For | Also Requires |
|-----------------|----------|---------------|
| `skeleton` | Loading placeholders | — |
| `sonner` | Toast notifications | `Toaster` in root layout |
| `dialog` | Modal dialogs for forms | `@radix-ui/react-dialog` |
| `alert-dialog` | Confirmation dialogs | `@radix-ui/react-alert-dialog` |
| `sheet` | Mobile sidebar / bottom panels | `@radix-ui/react-dialog` |
| `table` | Data table base | — |
| `dropdown-menu` | Row actions, user menu | `@radix-ui/react-dropdown-menu` |
| `tooltip` | Icon descriptions | `@radix-ui/react-tooltip` |
| `select` | Form dropdowns | `@radix-ui/react-select` |
| `checkbox` | Row selection, form inputs | `@radix-ui/react-checkbox` |
| `tabs` | Tabbed content in dashboards | `@radix-ui/react-tabs` |
| `command` | Command palette / search | `cmdk` package |
| `navigation-menu` | Landing page nav | `@radix-ui/react-navigation-menu` |
| `breadcrumb` | Page hierarchy in dashboard | — |
| `progress` | Sync progress, SLA timers | — |

**Nice to add:**
- `carousel` — Landing page testimonials
- `accordion` — FAQ section on landing page
- `toggle` / `toggle-group` — Filter toggles in tables
- `switch` — Form toggle controls

## Existing Code Analysis

### What Already Exists (in kapwa-client/src)

- `components/ui/` — 7 shadcn UI primitives
- `components/Layout.tsx` — Basic sidebar + topbar + mobile hamburger
- `components/ErrorBoundary.tsx` — Error boundary component
- `components/ProtectedRoute.tsx` — Route guard
- `components/NotificationsDropdown.tsx` — Notification bell
- `components/MessagesPopover.tsx` — Chat popover
- `pages/LoginPage.tsx` — Custom CSS (not shadcn), no role UI
- `main.tsx` — Routes entry, no Toaster, no ErrorBoundary provider
- `lib/utils.ts` — `cn()` utility exists

### What Needs Migration

1. **LoginPage.tsx** — Replace `form-input`, `btn`, `form-label`, `error-msg` CSS classes with shadcn `Input`, `Button`, `Label`, `Alert` components. Add role-specific redirect.
2. **Layout.tsx** — Upgrade sidebar to shadcn `Sidebar` with collapsible groups, add `Sheet` for mobile, improve topbar structure.
3. **All page files** — Add skeleton loading states, empty states, error boundaries, responsive data tables.

## Sources

- [GOV.UK Service Toolkit](https://www.gov.uk/service-toolkit) — Government design standards reference
- [GOV.UK Design System](https://design-system.service.gov.uk/) — Government service design patterns
- [sennalabs.com - UX/UI Government Websites](https://sennalabs.com/blog/ux-ui-government-websites-citizen-usability) — Government UX best practices
- [ui.shadcn.com](https://ui.shadcn.com/docs/components/skeleton) — Official shadcn component docs
- [shadcn/ui best practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) — Production shadcn patterns
- [Dashboard Design Patterns research paper](https://dashboarddesignpatterns.github.io/) — Academic dashboard design patterns
- [artofstyleframe.com - Dashboard Design Patterns 2026](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps) — Dashboard UX patterns
- [shadcncraft.com - Production data tables with shadcn](https://shadcncraft.com/blog/building-production-ready-data-tables-with-shadcn-ui) — TanStack Table + shadcn
- [jsmanifest.com - React Error Boundaries Production Patterns](https://jsmanifest.com/react-error-boundaries-production-patterns) — Error boundary strategies
- [blog.stackademic.com - Sonner toast notifications](https://blog.stackademic.com/shadcn-ui-react-series-part-19-sonner-modern-toast-notifications-done-right-903757c5681f) — Toast patterns
- [gabriel-rodrigues.com - CSS Print Styles for A4](https://gabriel-rodrigues.com/en/blog/css-print-styles-a4-pages-then-vs-now) — Print CSS patterns
- [designstudiouiux.com - Mobile Navigation UX 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux) — Mobile nav patterns
- [GOV.UK Service Manual](https://www.gov.uk/service-manual) — Government digital service standards
- [MDN Web Docs - CSS Print](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) — Print media queries reference
- [react-error-boundary npm](https://www.npmjs.com/package/react-error-boundary) — Error boundary library

---
*Feature research for: Kapwa v1.1 UI/UX Overhaul*
*Researched: 2026-06-27*
