# Roadmap: Kapwa — MSWDO Norzagaray

## Overview

Kapwa's v1.0 delivered the full backend infrastructure (NestJS 11 + PostgreSQL 16 + MinIO) and core case management flows — GIS intake, intervention tracking, Access Card system, IRF module, and role-specific dashboards. v1.1 shifts focus entirely to the frontend: a production-ready UI/UX overhaul of the React 18 SPA using shadcn/ui design system, responsive layouts for field workers, public-facing pages, and accessibility compliance. Six phases deliver this transformation — starting with design tokens and layout shell, building shared page-state components, migrating every page to shadcn, and finishing with accessibility audit and differentiating features.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-06-27)
- 🚧 **v1.1 UI/UX Overhaul** — Phases 7-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-06-27</summary>

- [x] **Phase 1: Foundation — Deploy & Authenticate** - Infrastructure, roles, basic sync, and audit foundation
- [x] **Phase 2: GIS Intake & Beneficiary Registration** - Dual-mode GIS intake with consent management
- [x] **Phase 3: Intervention Tracking & Case Management** - End-to-end case workflow with post-disbursement logging
- [x] **Phase 4: Access Card System** - One-step generate-and-assign, printable card view, soft No Card guard
- [x] **Phase 5: Dynamic Programs & IRF Module** - Program configuration and encrypted incident reports
- [x] **Phase 6: Dashboards, Notifications & Role Completion** - Role-specific UIs, notifications, compliance exports

</details>

### 🚧 v1.1 UI/UX Overhaul (In Progress)

**Milestone Goal:** Polish the entire Kapwa frontend to production-ready quality with a unified shadcn design system, responsive layouts, loading/empty/error states on every page, accessibility improvements, public-facing pages, and print styles for government reports.

- [ ] **Phase 7: Foundation & Design System** - Design tokens, CSS cleanup, and infrastructure established
- [x] **Phase 8: Dashboard Shell & Layout** - App shell with sidebar, topbar, breadcrumbs, and dark mode toggle (completed 2026-06-28)
- [ ] **Phase 9: Landing Page & Auth Flow** - Public-facing pages and polished auth flow
- [x] **Phase 10: Shared Components & Responsive** - Reusable page-state components and mobile-responsive infrastructure (completed 2026-06-29)
- [ ] **Phase 11: Page Migration, Print & Offline UI** - All pages migrated to shadcn with print styles and offline awareness
- [ ] **Phase 12: Accessibility & Differentiators** - Accessibility compliance and production-differentiating features

## Phase Details

### Phase 7: Foundation & Design System

**Goal**: Design token system, CSS cleanup, and infrastructure established — enabling every subsequent phase to use consistent, theme-aware styling without specificity conflicts.

**Depends on**: Nothing (first v1.1 phase)

**Requirements**: DSG-01, DSG-02, DSG-03, DSG-04

**Success Criteria** (what must be TRUE):

1. CSS custom properties (colors, spacing, typography, shadows, radii) are defined as `:root` + `.dark` blocks and used throughout all component styling
2. Tailwind theme colors map 1:1 to CSS custom properties — changing `--primary` in `index.css` updates all primary-colored elements across the app
3. All legacy component classes (`.btn`, `.table`, `.form-input`, `.badge-*`) are moved to `@layer legacy` — no specificity conflicts with shadcn/Tailwind utilities
4. `@base-ui/react` dependency removed from `package.json` with zero remaining imports

**Plans:** 2 plans

Plans:

- [x] 10-01-PLAN.md — Page-state components: PageShell, skeletons, EmptyState, ErrorBoundary, Sonner, Layout/routes integration
- [x] 10-02-PLAN.md — Mobile & responsive: BottomNav, DataTable system (TanStack Table), 44px touch targets

**Plan list:**

- [ ] 07-01-PLAN.md — Design token system (DSG-01, DSG-02, DSG-04): Expand :root CSS custom properties, define .dark block, update tailwind.config.js, remove @base-ui/react
- [ ] 07-02-PLAN.md — Legacy CSS cleanup & shadcn components (DSG-01, DSG-03): Move legacy CSS to @layer legacy, install 14 shadcn components via CLI

**Dependencies**: Existing `components.json` verified, shadcn CLI configured, app builds without error

### Phase 8: Dashboard Shell & Layout

**Goal**: Users can navigate the app through a polished dashboard shell with collapsible sidebar, topbar with user controls, breadcrumb navigation, and dark mode preference.

**Depends on**: Phase 7

**Requirements**: LAY-01, LAY-02, LAY-03, LAY-04, DSG-05

**Success Criteria** (what must be TRUE):

1. User can collapse/expand the sidebar navigation and see role-filtered nav groups with active route highlighting
2. User can access the user menu (profile, logout) and notification/messages popover from the topbar
3. Breadcrumb trail shows the current page location and updates on every navigation
4. Keyboard user can skip directly to main content via skip-to-content link (first focusable element)
5. Admin can toggle between light and dark mode via a toggle in the user menu

**Plans:** 1/1 plans complete

- [x] 08-PLAN.md

**UI hint**: yes

### Phase 9: Landing Page & Auth Flow

**Goal**: Public visitors can learn about Kapwa, log in with role-aware redirect, or find the claimant self-registration entry point — through polished, mobile-friendly pages.

**Depends on**: Phase 7

**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04

**Success Criteria** (what must be TRUE):

1. Visitor on the landing page sees hero section, services overview, application steps, about section, and contact information — all offline-cached
2. Visitor on the about page sees the MSWDO mission, team, and program details
3. User can log in with a shadcn-ified form and is redirected to the correct dashboard based on role (or to `/unauthorized` for wrong-role access)
4. Claimant can find and use the self-registration entry point on the login page

**Plans:** 3 plans

Plans:

- [ ] 09-01-PLAN.md — Foundation: Packages, PublicLayout, route restructuring, reusable display components
- [ ] 09-02-PLAN.md — Public pages: LandingPage, AboutPage, ContactPage
- [ ] 09-03-PLAN.md — Auth pages: LoginPage (shadcn rewrite), RegisterPage

**UI hint**: yes

### Phase 10: Shared Components & Responsive

**Goal**: Every data page uses consistent page-state components (PageShell, skeletons, empty states, error boundaries, toasts) and works correctly on mobile devices with responsive tables and touch-friendly controls.

**Depends on**: Phase 7, Phase 8

**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, RES-01, RES-02, RES-03

**Success Criteria** (what must be TRUE):

1. Every page uses `PageShell` wrapper with consistent title, description header, and proper spacing
2. Data-fetching pages show skeleton components matching real content dimensions (table skeletons, card skeletons, form skeletons)
3. Empty list/search views display icon + message + optional CTA instead of blank areas (4 variants: no data, no results, offline, no access)
4. Route crashes show an error boundary with error icon, message, retry button, and home link — not a white screen
5. CRUD operations show toast notifications (success, error, promise/loading states) via Sonner
6. Mobile users see bottom tab navigation for main sections (Dashboard, Cases, Beneficiaries, Profile)
7. Data tables are sortable, filterable, and paginated with horizontal scroll on mobile
8. All form controls have minimum 44px touch targets with proper spacing (`gap-3` between interactive elements)

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Page-state components: PageShell, skeletons, EmptyState, ErrorBoundary, Sonner, Layout/routes integration

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 10-02-PLAN.md — Mobile & responsive: BottomNav, DataTable system (TanStack Table), 44px touch targets

**UI hint**: yes

### Phase 11: Page Migration, Print & Offline UI

**Goal**: All internal pages use shadcn components with proper loading/empty/error states, print styles for government reports, and offline-aware indicators for field workers.

**Depends on**: Phase 7, Phase 8, Phase 10

**Requirements**: PGM-01, PGM-02, PGM-03, PGM-04, PGM-05, PGM-06, PRN-01, PRN-02, OFF-01, OFF-02, OFF-03, DIF-02

**Success Criteria** (what must be TRUE):

1. Beneficiaries, cases/interventions, Access Card, IRF, dashboard, and admin pages all use shadcn components (`<Table>`, `<Input>`, `<Button variant>`, `<Badge variant>`, `<Card>`) with zero remaining legacy CSS class usage
2. Each migrated page shows loading skeleton (cold load), empty state (zero results), and error state with retry — using shared page-state components from Phase 10
3. Print view of reports hides navigation, sidebar, and buttons — shows clean A4 layout with government branding, proper margins, and `break-inside-avoid` on table rows
4. Print-ready case documents (Access Card, CSR, intervention log) have proper pagination and signature blocks
5. Sync status banner shows connection state, pending operation count, and sync progress; user can open the queue detail panel from the sidebar to view pending/syncing/failed/conflict items with resolve actions
6. Cache staleness indicators appear on data when viewing cached (not fresh) information — visual badge shows data age

**Plans:** 4 plans

Plans:

- [ ] 11-01-PLAN.md — Print & offline UI infrastructure (print stylesheet, PageShell cachedAt, SyncQueuePanel, ConflictResolutionDialog, cache staleness hook)
- [ ] 11-02-PLAN.md — Dashboard & Beneficiaries migration (DashboardPage, ClaimantDashboardPage, BeneficiariesPage, BeneficiaryViewPage, IntakePage)
- [ ] 11-03-PLAN.md — Cases, Access Card & IRF migration (CasesPage, InterventionsPage, CaseTrackerPage, ApprovalPipelinePage, AccessCardPage, CsrPage, IrfPage) with print-ready layouts
- [ ] 11-04-PLAN.md — Admin pages & final verification (AdminPage, MfaSetupPage, FilingPage, MessagesPage, ClaimantDashboardPage + test pass)

### Phase 12: Accessibility & Differentiators

**Goal**: The frontend meets WCAG 2.1 AA accessibility standards and delivers differentiating features — role-specific dashboards, consent-aware masking, SLA timers, quick actions, and bulk operations.

**Depends on**: Phase 11

**Requirements**: ACC-01, ACC-02, ACC-03, ACC-04, DIF-01, DIF-03, DIF-04, DIF-05, DIF-06

**Success Criteria** (what must be TRUE):

1. All interactive elements are keyboard-reachable with visible focus rings and no focus traps; screen reader announcements play for toast notifications, loading state changes, and errors
2. All text colors meet WCAG 2.1 AA minimum contrast (4.5:1 for body text, 3:1 for large text)
3. Role-specific dashboards show tailored KPI cards, trend data, and recent activity per role (social worker, admin, coordinator, claimant, mayor, auditor)
4. Consent-aware UI dynamically masks PII fields on consent revoke without page reload; case cards show color-coded SLA countdown timers (green → yellow → red)
5. Field workers access quick actions (new intake, search, photo, signature) via bottom-sheet shortcuts on mobile
6. Data tables support row selection with a bulk action toolbar (approve/reject/assign/export) on selected rows

**Plans:** 4 plans

Plans:

- [ ] 11-01-PLAN.md — Print & offline UI infrastructure (print stylesheet, PageShell cachedAt, SyncQueuePanel, ConflictResolutionDialog, cache staleness hook)
- [ ] 11-02-PLAN.md — Dashboard & Beneficiaries migration (DashboardPage, ClaimantDashboardPage, BeneficiariesPage, BeneficiaryViewPage, IntakePage)
- [ ] 11-03-PLAN.md — Cases, Access Card & IRF migration (CasesPage, InterventionsPage, CaseTrackerPage, ApprovalPipelinePage, AccessCardPage, CsrPage, IrfPage) with print-ready layouts
- [ ] 11-04-PLAN.md — Admin pages & final verification (AdminPage, MfaSetupPage, FilingPage, MessagesPage, ClaimantDashboardPage + test pass)

## Progress

**Execution Order:** Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation — Deploy & Authenticate | v1.0 | 4/4 | Complete | 2026-06-19 |
| 2. GIS Intake & Beneficiary Registration | v1.0 | 4/4 | Complete | 2026-06-19 |
| 3. Intervention Tracking & Case Management | v1.0 | 3/3 | Complete | 2026-06-22 |
| 4. Access Card System | v1.0 | 3/3 | Complete | 2026-06-22 |
| 5. Dynamic Programs & IRF Module | v1.0 | 4/4 | Complete | 2026-06-22 |
| 6. Dashboards, Notifications & Role Completion | v1.0 | 4/4 | Complete | 2026-06-24 |
| 7. Foundation & Design System | v1.1 | 0/0 | Not started | - | Design System | v1.1 | 0/2 | Not started | - |
| 8. Dashboard Shell & Layout | v1.1 | 1/1 | Complete    | 2026-06-28 |
| 9. Landing Page & Auth Flow | v1.1 | 3/3 | Complete | 2026-06-28 |
| 10. Shared Components & Responsive | v1.1 | 2/2 | Complete   | 2026-06-29 |
| 11. Page Migration, Print & Offline UI | v1.1 | 0/0 | Not started | - |
| 12. Accessibility & Differentiators | v1.1 | 0/0 | Not started | - |
