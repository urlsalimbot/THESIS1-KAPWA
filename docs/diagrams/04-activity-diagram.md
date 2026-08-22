# Activity Diagrams

This document expresses four decision-heavy business workflows of the KAPWA social welfare information system — intake, case FSM transitions, offline sync, and inter-agency referrals — as Mermaid activity diagrams tied to functional requirements FR-01..FR-16 and to the implementation files that enforce them.

## 1. Purpose

Documents the 4 decision-heavy business workflows (intake, case lifecycle transitions, sync delta processing, and inter-agency referral lifecycle) as activity diagrams, showing every decision point, branch, and terminal state as implemented in the source files listed in Section 5.

## 2. Functional Specification

| ID | Requirement |
|----|-------------|
| FR-01 | Intake starts with the worker filling the beneficiary/claimant/family form; a match-check endpoint scores the applicant against existing households (0.6 * beneficiary name similarity + 0.4 * family name similarity, threshold >= 0.6) and returns up to 10 candidate households (`IntakeService.matchCheck`). |
| FR-02 | When the match-check finds a duplicate, the worker confirms the match and the data is merged into the existing household (dedup by philhealth number or surname+first name+DOB scoped to barangay) via `confirmMatch`; when no duplicate is found the new-record path is taken. |
| FR-03 | Submitting the intake creates a Case with status `enrolled`, a generated control number, an `active` consent ledger row, and beneficiary/claimant/household links, all in one SERIALIZABLE transaction (`IntakeService.submitIntake`). |
| FR-04 | While the form is being filled, the draft is autosaved after a 2s debounce to a user-scoped localStorage key (`kapwa:intake:draft:<userId>`) and can be recovered later via `loadDraft` (`useIntakeAutosave.ts`). |
| FR-05 | Case transitions are guarded per status: an assessment must be completed before `assessed`; FRVA/SWDI scores before `in_review`; at least one intervention before `active`; self-reliance level and sustainability plan before `transitioning`; client signature and closure outcome before `closed` (`CasesService.validateTransition`). |
| FR-06 | Review transitions are role-gated: `CASE_FSM_ROLES` restricts transitions out of `in_review` to `admin`/`coordinator`, and review approvals flow through `in_review` before a case can become `active`. |
| FR-07 | Disburse — `ACTIVE` → `TRANSITIONING` — is admin-only: `CASE_FSM_ROLES[ACTIVE] = ['admin']`, enforced by `canTransition` in `case-fsm.ts`. |
| FR-08 | Closing from `TRANSITIONING` is allowed for `social_worker`/`coordinator` (`CASE_FSM_ROLES[TRANSITIONING]`); admin overrides all role checks (`canTransition` returns true for admin) and can close from any state. |
| FR-09 | A sync delta is validated server-side before any processing: unknown `_`-prefixed meta fields are rejected with `400 BadRequest` (`assertNoUnknownMetaFields`, S-06); only `_fsmTransition` and `_clientUpdatedAt` are permitted control fields. |
| FR-10 | The delta batch must carry a valid Ed25519 signature over `{deviceId, changes}` (device id hex-decoded as the public key), else `403 Forbidden` (`verifySignature`). |
| FR-11 | The batch `idempotencyKey` is checked against an in-memory cache + `idempotency_keys` DB table (24h TTL); an idempotent replay returns the cached result without re-applying the change. |
| FR-12 | On conflict, the resolver applies policy: financial tables (`interventions`, `disbursements`, `financial_assistance`, `case_interventions`, `access_card_services`) are server-wins; note tables append client notes; consent ledger is server-wins (`ConflictResolver.FINANCIAL_TABLES`). |
| FR-13 | A referral is created with status `referred` after source-agency resolution (MSWDO fallback for unlinked staff), target-agency validation (must exist, must differ), and person resolution from beneficiary/case/personId; `notifyAgency` then notifies every `agency_staff` of the receiving agency. |
| FR-14 | The receiving agency (or admin) acknowledges the referral: status `received`, `receivedAt` set, and `notifyCreator` notifies the original creator. |
| FR-15 | The receiving agency actions the referral: status `actioned`, `actionedAt` set; `assertReceiver` (receiving agency or admin only) and `assertTransition` (`referred → received → actioned → closed`, or `referred → declined`) guard every step with 403/409 otherwise. |
| FR-16 | The referral is closed (outcome recorded, `closedAt`) or declined (reason recorded); `notifyCreator` fires at each receive/action/close/decline step, all notification calls wrapped in try/catch so a notification failure never fails the referral operation. |

## 3. Activity Diagrams (Mermaid)

### A1 — Intake: fill form, autosave, match-check, duplicate decision

```mermaid
flowchart TD
    A([start]) --> B[Fill intake form - beneficiary, claimant, family]
    B --> C[Draft autosave runs in parallel]
    C --> D[Match-check against existing beneficiaries]
    D --> E{Duplicate found?}
    E -- yes --> F[Confirm match - merge into existing household]
    E -- no --> G[Create new beneficiary record]
    F --> H[Submit intake]
    G --> H
    H --> I[Case created - status enrolled]
    I --> J([end])
    N[Note: autosave - 2s debounce, user-scoped localStorage key, recoverable via loadDraft]
    C -.-> N
```

### A2 — Case FSM: validated transition with role guard

```mermaid
flowchart TD
    A([start]) --> B[Transition attempt - current status to target]
    B --> C{isValidTransition?}
    C -- no --> D[400 BadRequest - invalid FSM edge]
    D --> Z([end])
    C -- yes --> E{canTransition role?}
    E -- no --> F[403 Forbidden - role not in CASE_FSM_ROLES]
    F --> Z
    E -- yes --> G[Update case status + case_history row]
    G --> H[Notify assigned worker]
    H --> Z
    N[Note: disburse ACTIVE to TRANSITIONING is admin-only - admin overrides CASE_FSM_ROLES in canTransition]
    N -.-> E
```

### A3 — Sync: validation, signature, idempotency, conflict resolution

```mermaid
flowchart TD
    A([start]) --> B[Client sends delta batch]
    B --> C{Unknown underscore meta fields?}
    C -- yes --> D[Reject - 400 BadRequest]
    D --> Z([end])
    C -- no --> E{Ed25519 signature valid?}
    E -- no --> F[Reject - 403 Forbidden]
    F --> Z
    E -- yes --> G{Idempotent replay?}
    G -- yes --> H[Return cached result]
    H --> Z
    G -- no --> I[Apply change]
    I --> J{Conflict?}
    J -- yes --> K[Conflict resolution - server-wins for financial tables]
    K --> L[Record queue entry]
    J -- no --> L
    L --> Z
```

### A4 — Referral: create, notify, receive, action, close/decline

```mermaid
flowchart TD
    A([start]) --> B[Create referral - status referred]
    B --> C[Notify receiving agency]
    C --> D{Received by agency?}
    D -- no --> E[Decline - status declined with reason]
    D -- yes --> F[Action - status actioned]
    F --> G[Close - status closed with outcome]
    E --> H[Notify creator]
    G --> H
    H --> I([end])
```

## 4. Diagram Narrative

**A1 — Intake (FR-01..FR-04).** The workflow starts when the worker begins filling the intake form (FR-01). While the form is being filled, the draft is autosaved in parallel after a 2s debounce to a user-scoped localStorage key (`kapwa:intake:draft:<userId>`), so an interrupted session can be recovered with `loadDraft` (FR-04). On submission, a match-check scores the applicant against existing households (60% beneficiary name similarity + 40% family name similarity, threshold 0.6, barangay-scoped). The decision `{Duplicate found?}` (FR-02) branches: on `yes`, the worker confirms the match and `confirmMatch` merges the applicant into the existing household (dedup by philhealth number or surname+first name+DOB), reusing the household's recent case if one exists within 30 days; on `no`, a new beneficiary record is created. Both branches converge on submission (FR-03), which creates the case with status `enrolled`, a generated control number, and the consent ledger row inside a SERIALIZABLE transaction, terminating at `([end])`.

**A2 — Case FSM (FR-05..FR-08).** Every status change enters the shared FSM from `case-fsm.ts`. The first decision, `{isValidTransition?}`, checks the `CASE_FSM` adjacency table (enrolled → assessed/closed, assessed → in_review/closed, in_review → active/closed, active → transitioning/closed, transitioning → closed, closed → none) plus per-status field preconditions — assessment required before `assessed`, FRVA/SWDI scores before `in_review`, interventions before `active`, self-reliance plan before `transitioning`, signature + outcome before `closed` (FR-05) — and a violation terminates at `400 BadRequest` (FR-09 in the sync numbering maps to FSM rejection in `handleFsmTransition`). The second decision, `{canTransition role?}`, checks `CASE_FSM_ROLES` (FR-06): `in_review` is admin/coordinator-only, `ACTIVE` is admin-only — making the disburse edge `ACTIVE → TRANSITIONING` exclusively admin (FR-07) — and `TRANSITIONING` allows social_worker/coordinator to close (FR-08). The annotated note records that admin overrides every role check because `canTransition` short-circuits to true for the admin role, so admin can also close from any state. On success the case status is saved, a `case_history` row is logged with the transition type, and the assigned worker is notified before `([end])`.

**A3 — Sync (FR-09..FR-12).** A client delta batch enters `processDelta`. The first decision, `{Unknown underscore meta fields?}`, rejects any `_`-prefixed key other than the two FSM control fields with `400 BadRequest` (FR-09, `assertNoUnknownMetaFields`) before any caching or processing. The second decision, `{Ed25519 signature valid?}`, rejects an invalid signature over `{deviceId, changes}` with `403 Forbidden` (FR-10, `verifySignature`). The third decision, `{Idempotent replay?}`, returns the cached result for a known batch `idempotencyKey` (in-memory map + `idempotency_keys` DB, 24h TTL) instead of re-applying (FR-11). Otherwise the change is applied (`applyChange`, transactional INSERT/UPDATE/DELETE; intake-table changes delegate to `submitIntake`; case `_fsmTransition` changes pre-check the FSM). The final decision, `{Conflict?}`, detects a newer server record; on conflict the resolver enforces policy — `server-wins` for financial tables (`FINANCIAL_TABLES`), note append for note tables, server-wins for consent — and the outcome is recorded as a queue entry with status `applied` or `conflict` (FR-12), terminating at `([end])`.

**A4 — Referral (FR-13..FR-16).** A referral is created with status `referred` after source-agency resolution (MSWDO fallback for unlinked staff), target-agency validation, and person resolution (FR-13). `notifyAgency` then pushes an in-app notification to every `agency_staff` of the receiving agency. The decision `{Received by agency?}` (FR-14) branches: on `no`, the referral is declined (status `declined` with a reason, allowed only from `referred` per the `TRANSITIONS` table); on `yes`, the referral is actioned (status `actioned`, FR-15) and then closed (status `closed` with an outcome, allowed only from `actioned`). Both branches converge on `notifyCreator`, which notifies the original creator at each lifecycle step (FR-16), before terminating at `([end])`. All notification calls are try/catch guarded so a notification failure never fails the referral operation.

## 5. Cross-References

| Item | Location |
|------|----------|
| `CASE_FSM` transition table, `CASE_FSM_ROLES`, `isValidTransition`, `canTransition` (admin override) | `kapwa-server/src/cases/case-fsm.ts` |
| `transition`/`updateStatus`, per-status preconditions, disburse, close, override, `logHistory`, worker notification | `kapwa-server/src/cases/cases.service.ts` |
| Sync: `assertNoUnknownMetaFields`, `verifySignature` (Ed25519), idempotency cache, `applyChange`, FSM pre-check | `kapwa-server/src/sync/sync.service.ts` |
| Conflict policy: `FINANCIAL_TABLES` server-wins, note append, consent server-wins | `kapwa-server/src/sync/conflict-resolver.ts` |
| Intake: `matchCheck`, `submitIntake`, `confirmMatch`, dedup + barangay scoping | `kapwa-server/src/intake/intake.service.ts` |
| Referral lifecycle: `create`/`receive`/`action`/`close`/`decline`, `notifyAgency`/`notifyCreator` (try/catch) | `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts` |
| Draft autosave: 2s debounce, user-scoped key, `loadDraft`/`clearDraft` | `kapwa-client/src/hooks/useIntakeAutosave.ts` |