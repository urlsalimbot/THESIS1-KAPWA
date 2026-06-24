# Phase 6: Dashboards, Notifications & Role Completion - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-role dashboards with appropriate data visibility — Claimant self-service (case status, service history, Access Card, consent hub), Mayor's Office aggregate views (fund utilization, household counts, SLA compliance), Auditor read-only logs (hash-chain verification, consent ledger), Barangay Coordinator field-worker dashboard (SMS OTP 2FA, barangay-scoped case search + tracker). Consent-gated notifications (SMS + in-app, per-channel + per-category opt-in/opt-out enforced at send-time). DSWD/COA-compliant export reports (audit logs, service summaries, compliance data) in PDF + CSV/XLSX formats.

Requirements: ROL-02, ROL-03, ROL-04, ROL-05, CON-05, INF-04
</domain>

<decisions>
## Implementation Decisions

### Claimant Self-Service Dashboard & Access Card
- **D-01:** Access Card gets a separate `/my-access-card` route, not inline on the claimant dashboard.
- **D-02:** Access Card page is read-only for claimants — shows full card layout (code, remaining service slots, 18-row service log, print button).
- **D-03:** Replacement request button included on the Access Card page, triggering the existing loss/replacement workflow.

### Notification Consent Gating
- **D-04:** Notification consent preferences managed in the existing consent hub on the claimant dashboard — no separate settings page.
- **D-05:** Consent scope is both per-channel (SMS, in-app) and per-category (case_update, approval, disbursement, etc.) — both dimensions configurable.
- **D-06:** Enforced at send-time — notification record is always created (audit trail), but delivery is blocked if user has not consented to that channel/category combination.
- **D-07:** System category (OTP codes, password resets, critical alerts) always bypasses consent checks — never blocked.

### DSWD/COA Export Reports
- **D-08:** Both PDF and CSV/XLSX formats for all export reports.
- **D-09:** Three separate export endpoints:
  a. **Audit logs** — hash-chain verified, existing audit module as data source.
  b. **Service summaries** — fund utilization by program, service volumes by category.
  c. **Compliance data** — SLA rates and overdue counts.

### Barangay Coordinator Mobile PWA
- **D-10:** Dedicated `/coordinator` route with simplified navigation (fewer links than full staff dashboard).
- **D-11:** SMS OTP is 2FA on top of email/password — not standalone auth.
- **D-12:** Coordinator dashboard shows: quick case search by name, today's tracker log — both scoped to their assigned barangay.

### Mayor's Office Aggregate Views
- **D-13:** Separate aggregate reports endpoint for mayor role — NOT the same endpoint as the staff dashboard.
- **D-14:** Reports show counts and aggregate metrics only — no individual case or beneficiary data (zero PII).

### the agent's Discretion
- DashboardPage UI layout (stat cards, charts, navigation components)
- NotificationsController consent-gating implementation approach (which decorators/middleware)
- Export service implementation (PDF library, CSV generation library)
- Coordinator route UI design and component layout
- Mayor's Office report endpoint structure and aggregation query design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — ROL-02 through ROL-05, CON-05, INF-04
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, dependencies
- `.planning/STATE.md` — Accumulated decisions from prior phase execution

### Architecture & Codebase
- `.planning/codebase/ARCHITECTURE.md` — NestJS module pattern, guard pipeline, offline sync
- `.planning/codebase/STACK.md` — Technology stack, key dependencies
- `.planning/codebase/CONVENTIONS.md` — Naming, module structure, code patterns

### Prior Phase Context
- `.planning/phases/05-dynamic-programs-irf-module/05-CONTEXT.md` — IRF export patterns (PDF+JSON, audit-first)
- `.planning/phases/03-intervention-tracking-case-management/03-CONTEXT.md` — FSM patterns, SLA approach, SignaturePad

### Existing Code (MUST read for reuse)
- `kapwa-server/src/dashboard/dashboard.service.ts` — Existing metrics, recent cases, SLA
- `kapwa-server/src/dashboard/dashboard.controller.ts` — Existing dashboard endpoints with role handling
- `kapwa-server/src/notifications/notifications.service.ts` — Notification CRUD, SMS via Twilio
- `kapwa-server/src/notifications/notification.entity.ts` — Notification entity with channels/categories
- `kapwa-server/src/notifications/notifications.controller.ts` — Notification endpoints (create, my, unread, read)
- `kapwa-server/src/audit/audit.controller.ts` — Hash chain verification, COA export
- `kapwa-server/src/otp/otp.service.ts` — OTP generation and SMS sending
- `kapwa-server/src/otp/sms-gateway.service.ts` — Twilio SMS gateway
- `kapwa-client/src/pages/DashboardPage.tsx` — Staff dashboard UI
- `kapwa-client/src/pages/ClaimantDashboardPage.tsx` — Claimant self-service dashboard
- `kapwa-client/src/pages/AdminPage.tsx` — Admin user management (coordinator role creation)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardService` — getMetrics (aggregated counts, fund utilization, unique households), getRecentCases, getSlaCompliance, getDailyTracker. All support barangay filter for coordinator scoping.
- `DashboardPage.tsx` — Staff dashboard with StatsCard and RecentCases table. Reusable components for coordinator/mayor views.
- `ClaimantDashboardPage.tsx` — Already shows case status, service history, consent hub. Needs Access Card section added via separate page.
- `NotificationsModule` — Full CRUD, Twilio SMS sender, in-app notifications, category enum (system, case_update, sync_conflict, approval, disbursement). Notification entity has recipient_id, channel, category, phone, isRead, sent, sentAt fields.
- `SmsGatewayService` — Twilio client with dev-mode fallback logging.
- `AuditController` — GET /audit/hash-chain, /audit/verify-all, /audit/logs, /audit/coa-export.
- `IrfExportService` — Reference implementation for PDF generation with pdfkit (password-protected).
- Consent ledger — Grant/revoke tracking from Phase 2.

### Established Patterns
- Module pattern: Controller → Service → Entity → DTO → Zod schemas
- Guard pipeline: JwtAuthGuard → RolesGuard → AbacGuard with @Roles()
- Zod validation at API boundary via ZodPipe
- Existing dashboard controller already handles role-based barangay scope (coordinator filter)
- PDF export pattern from IRF (pdfkit with password protection)
- RLS policies for mayor/auditor read-only select

### Integration Points
- `routes.tsx` — Add `/my-access-card` and `/coordinator` routes
- `Layout.tsx` — Nav items for new routes (coordinator simplified nav, mayor/auditor limited nav)
- `DashboardController` — Mayor's aggregate reports endpoint (new), PII filter for mayor/auditor on existing endpoint
- `NotificationsService` — Add consent checking before send (send-time enforcement)
- `ConsentLedger` — Add notification preference fields (channel + category opt-in/opt-out)
- `BeneficiariesController` — `/beneficiaries/me/access-card` endpoint for claimant
</code_context>

<specifics>
## Specific Ideas

- Access Card view follows existing `AccessCardPage` component structure but read-only
- PDF export pattern from IRF module (pdfkit with userPassword) is directly reusable for report exports
- CSV generation likely needs a new utility (no existing pattern in codebase)
- Consent hub extension: add notification channel + category toggle columns to existing consent management UI
- Separate mayor/auditor nav should show only dashboard, reports, audit links — no edit/create actions
- Coordinator route should use larger touch targets for mobile field use
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Dashboards, Notifications & Role Completion*
*Context gathered: 2026-06-24*
