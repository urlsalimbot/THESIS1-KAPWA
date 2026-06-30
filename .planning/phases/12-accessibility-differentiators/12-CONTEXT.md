# Phase 12: Accessibility & Differentiators - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver WCAG 2.1 AA accessibility compliance and production-differentiating features: role-specific dashboards, consent-aware PII masking per RA 10173, SLA timers per RA 11032, quick actions with global search, and bulk operations for approval/reassignment/export.

Consumes from prior phases: shadcn/PageShell pattern (Phase 11), DataTable system (Phase 10), EmptyState/skeleton variants (Phase 10), role-based nav config (Phase 8), ConsentManager (existing), existing layout shell (Phase 8).

This is the final phase of the v1.1 UI/UX Overhaul milestone.

</domain>

<decisions>
## Implementation Decisions

### WCAG 2.1 AA Accessibility
- **D-01:** Automated axe-core checks integrated into CI test suite for regression prevention
- **D-02:** Screen reader testing targets NVDA (most common on Windows, 97% of desktop screen reader users)
- **D-03:** Full keyboard navigation — all interactive elements reachable and operable via keyboard, including custom components (DataTable row actions, FamilyGraph)
- **D-04:** Color contrast audit of existing pages → fix failures (brand colors, form inputs, data tables)

### Role-Specific Dashboards
- **D-05:** Single dashboard page with role-conditionally filtered widgets — not separate pages per role
- **D-06:** Claimant self-service dashboard: case status timeline, intervention history, Access Card view — read-only, no edit capabilities
- **D-07:** Mayor's Office dashboard: aggregate statistics, charts, SLA compliance rates — no PII exposed
- **D-08:** Auditor dashboard: audit log viewer, SHA-256 hash-chain verification, consent ledger
- **D-09:** Barangay Coordinator dashboard: data scoped to their assigned barangay only — consistent with ROL-02 mobile PWA scoping

### PII Masking (RA 10173 Data Privacy Act)
- **D-10:** Everything identifier masked for non-worker roles (name, phone, complete address). Only MSWDO workers see full data
- **D-11:** Click-to-reveal mechanism for authorized roles — temporarily unmask a field, logged to consent ledger (who/when/why), auto-mask after configurable timeout
- **D-12:** Masking follows consent status — if consent is revoked, data masked for everyone including workers. If active, per-role masking rules apply
- **D-13:** CSV/PDF exports mask PII by default; user can request unmasked export with reason logged to audit trail

### SLA Timers (RA 11032 Ease of Doing Business)
- **D-14:** SLA tracking on Intake→Assessment and Assessment→Approval workflow stages
- **D-15:** Per-case display in tables/approval lists — color indicator (green/amber/red) showing days elapsed vs SLA
- **D-16:** SLA thresholds configurable per program type (not a single fixed limit) — stored in program configuration
- **D-17:** SLA breach triggers visual warning (red indicator) + admin notification. No automatic reassignment

### Quick Actions
- **D-18:** New Intake + Approvals Queue + Global Search as primary quick actions
- **D-19:** Quick action buttons in topbar (always visible) + expanded quick action panel on dashboard
- **D-20:** Global search bar in topbar searching beneficiaries by name, ID, and barangay — using existing trigram + BM25 search infrastructure (GIS-04)

### Bulk Operations
- **D-21:** Bulk approve pending cases, bulk reassign cases, bulk export records
- **D-22:** Checkbox per row + "Select all N records" in DataTable — standard selection pattern
- **D-23:** Summary dialog before execution: "You are about to approve 12 cases" with count and preview
- **D-24:** Sonner toast with live progress: "Approving 12 cases: 5/12 complete" — per-item success/failure feedback

### the agent's Discretion
- Auto-mask timeout duration for click-to-reveal (default 30s suggested)
- Layout specifics for role widgets within shared dashboard
- Exact keyboard shortcut keys (if any beyond standard Tab/Escape/Enter)
- Bulk operation page size and timeout limits

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System & Components
- `.planning/phases/07-foundation-design-system/07-CONTEXT.md` — Design tokens, CSS custom properties, dark mode decisions
- `.planning/phases/10-shared-components-responsive/10-CONTEXT.md` — PageShell, DataTable, EmptyState, skeleton patterns
- `.planning/phases/11-page-migration-print-offline-ui/11-CONTEXT.md` — Page migration pattern, print/offline infrastructure

### Layout & Navigation
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — Sidebar, topbar, breadcrumb layout decisions
- `kapwa-client/src/lib/nav-config.tsx` — Role-based navigation groups (6 roles)

### Authentication & Roles
- `kapwa-client/src/lib/auth.ts` — AuthUser interface with role enum (social_worker, admin, coordinator, claimant, mayor, auditor)
- `kapwa-client/src/lib/auth-context.tsx` — Auth context provider
- `.planning/PROJECT.md` §ROL-01 through ROL-05 — Role requirements

### Existing Components
- `kapwa-client/src/components/consent/ConsentManager.tsx` — Existing consent management UI
- `kapwa-client/src/components/PageShell.tsx` — Page shell wrapper (consistent with Phase 11 migration)
- `kapwa-client/src/components/EmptyState.tsx` — Empty state variants
- `kapwa-client/src/components/skeletons/` — Skeleton loading components
- `kapwa-client/src/components/data-table/` — DataTable system with filtering, sorting, pagination

### Regulatory References
- RA 10173 (Data Privacy Act) — PII protection requirements
- RA 11032 (Ease of Doing Business) — Processing timeline requirements
- DSWD standards for social welfare case management

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConsentManager` component — Can be extended with masking logic or used alongside PII masking hook
- `DataTable` — Already supports filtering, sorting, pagination; needs checkbox column for bulk ops
- `PageShell` — `cachedAt` prop pattern from Phase 11 can be extended with `masked` prop for sensitive data pages
- `nav-config.tsx` — Role-based routing already defined; role widgets can key off same role enum
- Shadcn Toast (Sonner) — Already configured; progress variant for bulk ops

### Established Patterns
- Phase 11 page migration pattern: wrap in PageShell → use shadcn components → add skeleton/empty/error states → test
- Role-based filtering via `hasPermission()` utility
- Focus-visible rings on all shadcn components (existing Tailwind classes)

### Integration Points
- Search: connect to existing backend search endpoint (trigram + BM25, GIS-04)
- SLA timers: backend already tracks case state machine timestamps; frontend needs elapsed time calculation
- PII masking: server-side masking at API layer or client-side via role-check hook?
</code_context>

<specifics>
## Specific Ideas

- Quick action buttons in topbar modeled after Gmail/Linear pattern — small icon buttons with tooltips
- Color contrast audit to use browser DevTools contrast checker + axe-core automated scan
- Click-to-reveal pattern similar to password field "eye" toggle — familiar UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-Accessibility-Differentiators*
*Context gathered: 2026-06-30*
