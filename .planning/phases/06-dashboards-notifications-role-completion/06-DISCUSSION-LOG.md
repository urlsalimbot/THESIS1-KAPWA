# Phase 6: Dashboards, Notifications & Role Completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 6-Dashboards, Notifications & Role Completion
**Areas discussed:** Claimant Access Card View, Notification Consent Gating, Export Formats & Scope, Barangay Coordinator Mobile PWA, Mayor's Office PII Guard

---

## Claimant Access Card View

| Option | Description | Selected |
|--------|-------------|----------|
| Inline card on dashboard | Compact Access Card on /my-dashboard | |
| Separate page | /my-access-card route with full details | ✓ |
| Modal from dashboard | Trigger modal, close to return to dashboard | |

**User's choice:** Separate page
**Notes:** Read-only for claimants. Full layout: card code, remaining slots, 18-row service log, print, replacement request button.

---

## Notification Consent Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Per-channel scope | Opt out of SMS, keep in-app | |
| Per-category scope | No approval notifs but ok with case updates | |
| Both | Per-channel + per-category | ✓ |
| Check at create-time | Don't create if not consented | |
| Check at send-time | Create for audit, check before delivery | ✓ |
| Check at display-time | Hide in-app | |

**User's choice:** Both per-channel + per-category, enforced at send-time. System category always bypasses consent checks.

---

## Export Formats & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| PDF | Like IRF export | ✓ |
| CSV/XLSX | Spreadsheet for COA | ✓ |
| Single combined report | One endpoint with sections | |
| Three separate endpoints | Audit logs, service summaries, compliance | ✓ |

**User's choice:** Both PDF and CSV/XLSX. Three separate endpoints.

---

## Barangay Coordinator Mobile PWA

| Option | Description | Selected |
|--------|-------------|----------|
| Existing layout sufficient | Same staff dashboard scoped to barangay | |
| Simplified coordinator-only layout | Fewer nav items, larger touch targets | |
| Dedicated coordinator route | /coordinator page | ✓ |

**User's choice:** Dedicated /coordinator route. SMS OTP as 2FA on top of email/password. Dashboard shows quick case search by name + today's tracker log, scoped to barangay.

---

## Mayor's Office PII Guard

| Option | Description | Selected |
|--------|-------------|----------|
| Controller-level filter | Strip PII from response for mayor role | |
| Separate aggregate reports endpoint | Mayor gets counts/charts only, no case rows | ✓ |
| RLS column masking | PostgreSQL column-level security | |

**User's choice:** Separate aggregate reports endpoint for mayor. No PII.

---

## the agent's Discretion

- DashboardPage UI layout (stat cards, charts, nav components)
- NotificationsController consent-gating implementation approach
- Export service implementation (PDF library, CSV generation)
- Coordinator route UI design and component layout
- Mayor's Office report endpoint structure and aggregation queries

## Deferred Ideas

None — discussion stayed within phase scope.
