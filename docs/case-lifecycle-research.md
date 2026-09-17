# Case Lifecycle Research — how KAPWA handles cases, and where 4Ps fits

Research date: 2026-09-04. Sources: `cases/case-fsm.ts`, `cases/case.entity.ts`,
`cases/cases.service.ts`, `intake/intake.service.ts`, `sla/sla.service.ts`,
`components/case-view/CaseStepper.tsx` + step components, `routes.tsx`, and the
older `docs/superpowers/plans/2026-07-30-spec-gap-implementation.md`.

---

## 1. The model: one case per assistance episode

An intake submission always **creates a new Case** (`status = enrolled`), while
the **beneficiary and household are reused** when they already exist
(`intake.service.ts` steps 2–6). Consequences:

- A household enrolled in a recurring program (e.g. 4Ps) gets **one case per
  assistance episode/cycle** — every re-enrollment is a fresh `enrolled` case
  linked to the same `beneficiary_id` + `household_id`.
- The **BeneficiaryViewPage case list is the de-facto recurrence history** —
  the pattern across years shows up as multiple case rows.
- Each new intake now also **auto-assigns a household access card**
  (`AccessCardsService.ensureHouseholdCard`), so every cycle's case carries the
  same household card.

There is **no explicit "renewal" or "cycle" linkage between cases** — no
`renewal_of_case_id`, no `program_cycle` column.

---

## 2. The case FSM

`case-fsm.ts` defines the lifecycle and who may drive it:

```
enrolled ──► assessed ──► in_review ──► active ──► transitioning ──► closed
    │            │             │            │            │
    └────────────┴─────────────┴────────────┴────────────┘  (closed is
       (closed reachable from every non-final state)         terminal)
```

| Status | Meaning | Who may act | Guard rails (must be complete first) |
|---|---|---|---|
| `enrolled` | Intake accepted; awaiting assessment | social_worker, coordinator | — (created by intake) |
| `assessed` | SW assessment + client category recorded | social_worker, coordinator | `problemsPresented`, `socialWorkerAssessment`, `clientCategory` |
| `in_review` | MSWDO Head / admin review (FRVA–SWDI) | admin, coordinator | at least one of `frvaScore` / `swdiScore` |
| `active` | Service implementation (HIP + delivery) | admin | ≥ 1 logged intervention |
| `transitioning` | Graduation readiness / phase-out | social_worker, coordinator | `selfRelianceLevel`, `sustainabilityPlan` |
| `closed` | Formal exit | admin, social_worker, coordinator | `clientSignature`, `closureOutcome` |

Every transition: writes the case **history log** (`logHistory`), an **audit
record** (`case.transition`), and a **case-update notification** to the assigned
worker. Unauthorized roles or invalid transitions are rejected server-side
(`isValidTransition` / `canTransition`), so the UI cannot force a state.

## 3. The UI lifecycle (DSWD-style phases)

`CaseViewPage` renders a 5-step stepper in 3 phases — the case-management
vocabulary of the DSWD, layered on top of the 6 FSM statuses:

| Phase | Step | Backing data |
|---|---|---|
| **Phase-In** | 1. Assessment | FRVA & SWDI analysis → `assessed` |
| **Implementation** | 2. Implement HIP | interventions logged → enables `active` |
| **Implementation** | 3. Service Delivery | referrals & resources (optional per protocol) |
| **Phase-Out** | 4. Transition | graduation readiness → `transitioning` |
| **Phase-Out** | 5. Closure | formal exit → `closed` |

Steps unlock sequentially (`CaseStepper` blocks jumps until the prerequisite
data exists), and each step component writes the corresponding case columns
(`StepAssessment`, `StepImplementHIP`, `StepIntegratedDelivery`,
`StepTransition`, `StepClosure`).

## 4. SLA / escalation

`sla.service.ts` runs every 30 minutes and ages cases by **working days**:
- `enrolled` (pending assessment): warn > 2 days, escalate > 3 days
- `in_review`: warn > 2, escalate > 3
- `active`: warn > 2, escalate > 3

Escalation creates `sla_escalation` notifications (which now route to the case
from the notifications UI) — this is the recurring-program guardrail that
catches a case stuck in a phase.

## 5. Program metadata: defined but not wired into the case flow

`Program` carries rich metadata — `category`, `legalBasis`, `waitingPeriodDays`,
`fundSources`, `requiredDocuments`, `approvalWorkflow` (steps with
`approverRole` + `slaDays`), `formTemplate`. **However:**

- `approvalWorkflow` is **display-only** today (ProgramDetailPage). Intake does
  **not** read it, cases do **not** instantiate it, and no review step consumes
  `slaDays`. The case flow uses its own fixed FSM instead.
- `waitingPeriodDays` and `requiredDocuments` are not enforced at intake either.

This is the main integration gap between "program" and "case" today.

---

## 6. 4Ps specifically

**Pantawid Pamilyang Pilipino Program (4Ps)** is a long-running conditional
cash transfer: annual/bi-annual cycles, re-certification, compliance
checkoffs (health/education), and scheduled payouts.

### How it maps onto the current model

1. **One case per cycle** — each 4Ps enrollment/recertification = a new
   `enrolled` case on the same beneficiary/household. The case history on the
   beneficiary page is the cycle timeline.
2. **The 5-step DSWD flow fits 4Ps well**: Assessment (FRVA/SWDI →
   `assessed`), HIP implementation (compliance activities → `active`),
   service delivery (referrals), transition (graduation readiness —
   `selfRelianceLevel`/`sustainabilityPlan`), closure (`exitNotes`,
   `closureOutcome`).
3. **SLA covers stuck cycles** (e.g., a case sitting in `active` without a
   transition escalates to admins).
4. **Household access card** ties every cycle to the same household code.

### What 4Ps needs that does NOT exist yet

> Addressed 2026-09-17: conditionality checkoffs (`case_compliance_items`), payout
> schedule tracking (`case_payouts`), the 4Ps program seed, and the compliance UI
> (case-detail section + `cases/:caseId/4ps-compliance` + `cases/:caseId/payouts`)
> now exist. Cycle linkage (`cases.renewal_of_case_id`, migration
> `CaseRenewalLink0000000000052`) shipped earlier. Applying
> `Program.approvalWorkflow` per program remains open
> (tracked as a follow-up). See
> docs/superpowers/specs/2026-09-17-4ps-and-comanaged-programs-design.md.

### Recommended design if 4Ps compliance is required (historical design record — superseded by the note above)

| Gap | Minimal additive change |
|---|---|
| Compliance checkoffs | `case_compliance_items` table (case_id, item_key, met, due_date) + an `in-compliance` tab on CaseViewPage |
| Payout schedule | `case_payouts` table (case_id, cycle_no, amount, scheduled_at, status) + tracker UI |
| Cycle linkage | `cases.renewal_of_case_id` column + "Renew case" action (prefills intake from the prior case) |
| Program-driven workflow | Apply `Program.approvalWorkflow` at intake: instantiate the configured steps as the case's review chain (falls back to the fixed FSM when absent) |

All four are additive — the existing FSM, history log, audit trail, SLA
escalations, and access-card auto-assignment keep working unchanged.