# Requirements: Kapwa — MSWDO Norzagaray

**Defined:** 2026-06-27
**Core Value:** Social workers can register any claimant, conduct a full social case study, manage the complete approval workflow, log interventions post-disbursement, and track every service rendered — reliably offline in the field with automatic sync when connected.

## v1.1 UI/UX Overhaul

Requirements for production-ready frontend polish with unified shadcn design system, responsive layouts, and public-facing pages.

### Foundation & Design Tokens

- [ ] **DSG-01**: Design token system defined as CSS custom properties (colors, spacing, typography, shadows, radii)
- [ ] **DSG-02**: Tailwind CSS theme config fully mapped to design tokens
- [ ] **DSG-03**: Legacy CSS classes cleaned up — unused `@layer components` classes removed, remaining ones wrapped in `@layer legacy`
- [ ] **DSG-04**: Unused `@base-ui/react` dependency removed from package.json
- [ ] **DSG-05**: Admin can toggle dark/light mode via a toggle in the user menu

### Dashboard Shell & Layout

- [ ] **LAY-01**: Sidebar with collapsible navigation, role-filtered nav groups, active route highlighting
- [ ] **LAY-02**: Topbar with user menu (profile, logout), notification bell, messages popover
- [ ] **LAY-03**: Breadcrumb navigation showing current page location
- [ ] **LAY-04**: Skip-to-content link for keyboard accessibility

### Landing Page & Auth

- [ ] **PUB-01**: Public landing page with hero section, services overview, application steps, about section, and contact information
- [ ] **PUB-02**: Public about page with mission, team, and program details
- [ ] **PUB-03**: Polished login page (shadcn) with role-aware redirect post-login
- [ ] **PUB-04**: Claimant self-registration entry point on login page

### Page-State Components

- [ ] **STT-01**: `PageShell` wrapper component providing consistent padding, title, and breadcrumbs
- [ ] **STT-02**: Loading skeleton states on every data-fetching page (table skeletons, card skeletons, form skeletons)
- [ ] **STT-03**: Empty state placeholders with icon, message, and optional CTA for all list/search views
- [ ] **STT-04**: Error boundaries with fallback UI (error icon, message, retry button, home link) at route and widget level
- [ ] **STT-05**: Toast notifications via Sonner for all CRUD operations (success, error, promise/loading states)

### Mobile & Responsive

- [ ] **RES-01**: Mobile bottom tab navigation for main sections (Dashboard, Cases, Beneficiaries, Profile)
- [ ] **RES-02**: Responsive data tables using TanStack Table + shadcn DataTable (sortable, filterable, paginated, horizontal scroll on mobile)
- [ ] **RES-03**: Touch-friendly form controls (min 44px touch targets, proper spacing, mobile keyboard handling)

### Print Styles

- [ ] **PRN-01**: Print stylesheet for reports — hide nav/sidebar/buttons, show proper A4 layout with government branding
- [ ] **PRN-02**: Print-ready case documents (CSR, Access Card, intervention log) with proper margins, pagination, signature blocks

### Offline-Aware UI

- [ ] **OFF-01**: Enhanced sync status banner showing connection state, pending operation count, sync progress
- [ ] **OFF-02**: Sync queue detail panel accessible from sidebar — shows pending/syncing/failed/conflict items with resolve actions
- [ ] **OFF-03**: Cache staleness indicators on data — visual badge when viewing cached data

### Accessibility

- [ ] **ACC-01**: ARIA landmarks, labels, and descriptions on all interactive elements
- [ ] **ACC-02**: Full keyboard navigation (focus order, focus traps in modals, visible focus rings)
- [ ] **ACC-03**: Color contrast meeting WCAG 2.1 AA minimum (4.5:1 for text, 3:1 for large text)
- [ ] **ACC-04**: Screen-reader-friendly announcements for dynamic content (toasts, loading changes, errors)

### Per-Page shadcn Migration

- [ ] **PGM-01**: Beneficiaries pages (list, view, intake form) migrated to shadcn + loading/empty/error states
- [ ] **PGM-02**: Cases & interventions pages migrated to shadcn + states
- [ ] **PGM-03**: Access Card pages migrated to shadcn + print styles
- [ ] **PGM-04**: IRF module pages migrated to shadcn + states
- [ ] **PGM-05**: Dashboard pages for all roles migrated to shadcn + states
- [ ] **PGM-06**: Admin/settings pages migrated to shadcn + states

### Differentiators

- [ ] **DIF-01**: Role-specific dashboards with tailored KPI cards, trend data, and recent activity per role (social worker, admin, coordinator, claimant, mayor, auditor)
- [ ] **DIF-02**: Offline queue transparency panel — pending/syncing/failed/conflict items with resolve actions
- [ ] **DIF-03**: Consent-aware UI masking — PII fields dynamically mask on consent revoke without page reload
- [ ] **DIF-04**: SLA countdown timers on case cards (color-coded green → yellow → red) and compliance badges on reports
- [ ] **DIF-05**: Field worker quick actions — bottom-sheet shortcuts for new intake, search, photo, signature
- [ ] **DIF-06**: Bulk action toolbar in data tables — select multiple rows for approve/reject/assign/export

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Future

- **DIF-07**: Print-ready CSR with official MSWDO letterhead and watermark
- **PLG-01**: Integration with national databases (PhilSys/DSWD)
- **CHT-01**: Real-time chat between beneficiaries and staff
- **SCH-01**: Scheduling/appointment system

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Heavy page animation libraries | Frame Motion hurts PWA bundle size and Capacitor mobile performance; CSS transitions cover all needs |
| Server-side PDF generation | CSS `@media print` + browser "Save as PDF" covers 95% of use cases |
| Dark mode as primary theme | Government social workers work in well-lit offices; light mode is standard |
| Drag-and-drop reordering | Poor mobile support and accessibility; use dropdown/button ordering instead |
| Real-time WebSocket dashboard updates | SWR stale-while-revalidate on 30s polling interval is sufficient; WebSocket adds complexity for offline |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DSG-01 | | Pending |
| DSG-02 | | Pending |
| DSG-03 | | Pending |
| DSG-04 | | Pending |
| DSG-05 | | Pending |
| LAY-01 | | Pending |
| LAY-02 | | Pending |
| LAY-03 | | Pending |
| LAY-04 | | Pending |
| PUB-01 | | Pending |
| PUB-02 | | Pending |
| PUB-03 | | Pending |
| PUB-04 | | Pending |
| STT-01 | | Pending |
| STT-02 | | Pending |
| STT-03 | | Pending |
| STT-04 | | Pending |
| STT-05 | | Pending |
| RES-01 | | Pending |
| RES-02 | | Pending |
| RES-03 | | Pending |
| PRN-01 | | Pending |
| PRN-02 | | Pending |
| OFF-01 | | Pending |
| OFF-02 | | Pending |
| OFF-03 | | Pending |
| ACC-01 | | Pending |
| ACC-02 | | Pending |
| ACC-03 | | Pending |
| ACC-04 | | Pending |
| PGM-01 | | Pending |
| PGM-02 | | Pending |
| PGM-03 | | Pending |
| PGM-04 | | Pending |
| PGM-05 | | Pending |
| PGM-06 | | Pending |
| DIF-01 | | Pending |
| DIF-02 | | Pending |
| DIF-03 | | Pending |
| DIF-04 | | Pending |
| DIF-05 | | Pending |
| DIF-06 | | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 0
- Unmapped: 42 ⚠️

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after v1.1 milestone definition*
