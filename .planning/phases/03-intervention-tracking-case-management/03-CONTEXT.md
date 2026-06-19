# Phase 3: Intervention Tracking & Case Management - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can move cases through the full FSM lifecycle (pending_assessment → in_review → approved → disbursed → closed) and log post-disbursement interventions with mandatory signatures, eligibility checks, and fund source tracking. ARTA SLA timers auto-flag overdue approvals. Case Tracker Log auto-generates with daily sequencing.

Requirements: INT-01 through INT-08, CON-03, CON-04, SYNC-03
</domain>

<decisions>
## Implementation Decisions

### Approval Workflow & Separation
- **D-01:** Three-gate separation of duties — Social Worker initiates review (pending→in_review), Admin approves (in_review→approved), Finance/Admin disburses (approved→disbursed). Each gate requires the appropriate role.
- **D-02:** ARTA SLA — flag-only, no auto-advance. When a step exceeds its SLA, the case shows an overdue badge but is NOT automatically moved. Notification sent to the next approver.
- **D-03:** Fund source tracking (INT-08) — tag-only for reporting. No budget deduction or balance enforcement. The intervention records which fund source it used (Regular/PDAF/Legislative/Donation) for DSWD/COA reports.
- **D-04:** Offline transitions — social worker can initiate FSM moves (pending→in_review) offline. Approval and disbursement transitions require an online connection (server validates role + consent JIT).
- **D-05:** SLA period — 3 working days per gate (ARTA standard RA 11032). Assessment, review, and disbursement each get 3 days.
- **D-06:** Approval signature/reason — subject to stakeholder discussion. Default: reason field available but not blocking.

### Case Tracker Log Format
- **D-07:** Format: `NORZ-TRACK-YYYY-MMDD-NNN` (prefix + date + 3-digit sequential number per day)
- **D-08:** Sequence generation — client pre-generates using cached daily counter, server validates/resolves conflicts on sync

### FSM Transition Strictness
- **D-09:** Strictly sequential by default: pending_assessment → in_review → approved → disbursed → closed. No skipping.
- **D-10:** Admin override allowed for emergency release. Requires mandatory reason + audited as `override` in CaseHistory (not standard FSM transition).
- **D-11:** No backward transitions — a case cannot return to a previous state. If assessment fails, close the case and open a new one.

### Duplicate Detection (30-day sliding window)
- **D-12:** Hard block — API returns 409 Conflict when duplicate detected. Prevents creation. Worker must acknowledge before proceeding.
- **D-13:** Both DB-level exclusion constraint + service-level check (defense in depth). Uses PostgreSQL exclusion constraint on (household_id, intervention_type, daterange).

### Signature Collection Flow
- **D-14:** Canvas-based capture via existing `SignaturePad.tsx` preferred. File upload (photo of signed paper form) as fallback. Both methods accepted.
- **D-15:** Both signatures (worker + client) are mandatory but deferrable. Intervention created with `signatures_pending` status if signatures are missing. UI shows pending state until both collected.
- **D-16:** Signature images stored in MinIO/S3 (not local filesystem). Requires implementing MinIO client integration (INF-01 was marked Pending — now bundled with Phase 3).

### the agent's Discretion
- FSM transition UI design (how buttons/labels appear for each role's available actions)
- Case Tracker Log display format in BeneficiaryViewPage
- MinIO client implementation details (library choice, S3-compatible API surface)
- SLA timer implementation approach (DB cron vs application-level scheduling)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — INT-01 through INT-08, CON-03, CON-04, SYNC-03
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/STATE.md` — Accumulated decisions from Phase 1-2 execution

### Architecture & Codebase
- `.planning/codebase/ARCHITECTURE.md` — FSM flow (§Case FSM Flow), guard pipeline, offline sync pattern
- `.planning/codebase/INTEGRATIONS.md` — Local filesystem uploads (current), MinIO planned (not yet implemented)
- `.planning/codebase/STACK.md` — Technology stack, key dependencies

### Existing Code
- `kapwa-server/src/cases/cases.service.ts` — Existing FSM transitions, CaseHistory audit trail
- `kapwa-server/src/cases/cases.controller.ts` — Case status endpoints
- `kapwa-server/src/interventions/interventions.service.ts` — Existing intervention CRUD
- `kapwa-server/src/interventions/interventions.entity.ts` — Intervention entity fields
- `kapwa-server/src/cases/dto/cases.zod.ts` — Zod validation schemas for case operations
- `kapwa-client/src/lib/api.ts` — API client functions getInterventions, createIntervention
- `kapwa-client/src/components/forms/SignaturePad.tsx` — Existing canvas signature component
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SignaturePad.tsx` — Canvas-based signature capture component, reusable for both worker and client signature flows
- `upload` infrastructure in `api.ts` — File upload via Fetch API, reusable for signature upload fallback
- `CaseHistory` entity — Already tracks FSM transitions with who/when/what, extend for override flagging
- `InterventionsModule` — Existing controller + service + entity, needs enhancement for this phase

### Established Patterns
- Module pattern: `@Module({ controllers, providers, exports })` in NestJS — InterventionsModule follows this
- FSM transitions: `CasesService` already has `updateStatus()` pattern, extend for strict mode + override flagging
- ABAC guard pipeline: `@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)` — role gating per gate applies here
- Zod validation: `@Body(new ZodPipe(schema))` — use for intervention creation/status transitions
- Offline queue: `offline-queue.ts` handles queued writes; sync processor delegates to service (Phase 2 pattern)

### Integration Points
- `CasesController` — Add role-gated status transition endpoints (in_review, approve, disburse, close)
- `InterventionsController` — Enhance POST intervention with signature upload, fund source, duplicate check
- `SyncModule` — Add intervention sync handling for offline-created interventions
- `SignaturePad.tsx` → upload → MinIO — New MinIO integration needed (client library + service)
</code_context>

<specifics>
## Specific Ideas

- Case Tracker Log: format `NORZ-TRACK-YYYY-MMDD-NNN` (e.g., NORZ-TRACK-2026-0619-001)
- Client pre-generates daily sequence with cached counter; server validates on sync
- Admin override flagged in CaseHistory as distinct transition type for COA audit
- MinIO client implementation needed — signatures stored in S3-compatible bucket
</specifics>

<deferred>
## Deferred Ideas

- MinIO integration was planned for Phase 1 (INF-01) but never implemented. Phase 3 now incorporates it for signature storage. The MinIO client becomes a dependency of this phase.
- Access Card auto-append (INT-07) belongs to Phase 4 — not included here
- Full budget/financial management is out of scope — fund tracking is tag-only

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 3-Intervention Tracking & Case Management*
*Context gathered: 2026-06-19*
