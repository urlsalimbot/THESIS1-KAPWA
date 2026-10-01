# Case step locks, deliberate case actions, and the endorsement-letter 403

Date: 2026-09-30
Status: draft for review

## Problem

Three separate things are wrong in the case view, plus one dead link.

1. **The intervention step is laid out backwards.** `StepInterventions.tsx` renders a
   summary card, then the add-intervention form, then the list, then `CaseRequirements`
   as a separate card at the bottom. A worker picks a program in one card and only finds
   out what documents it needs in another, after the fact. There is also no lock: nothing
   stops a case being flagged for admin review with no intervention recorded at all.

2. **A case can be flagged for admin before its work is done.** `requestReview` moves
   `enrolled → assessed` and `PATCH /:id/status` moves `assessed → in_review`; both are
   `social_worker`, and `validateTransition` checks only assessment fields on the first
   edge and an FRVA/SWDI score on the second. Nothing checks interventions, required
   documents, or referrals. The FSM's own comment calls `assessed → social_worker` the
   "submit for review" edge, so the gap is on the edge the workflow names.

3. **Issuing a case referral 403s for social workers.**
   `inter-agency-referrals.service.ts:489-495` exempts only `admin` from the agency scope
   check, but `create()` at line 63 treats **both** `admin` and `social_worker` as MSWDO
   staff with no `agencyId`, substituting the MSWDO agency as `fromAgencyId`. A social
   worker therefore creates the referral successfully, then the PDF render runs with
   `agencyId = null` against a real `fromAgencyId`, matches none of the three conditions,
   and throws. The endpoint's `@Roles` and `create()` both admit social workers, so the
   PDF check is the outlier.

4. **Dead link.** `CaseViewPage.tsx:787` navigates to `/agency/referrals/:id`, a route
   `9fa73f5` deleted. The inter-agency referral rows in the case view 404 on click.

## Scope

In: step lock storage and endpoints, the all-locked gate on `assessed → in_review`, the
intervention-step layout, a shared lock control across all five steps, a deliberate action
bar for both roles, the PDF scope fix, the dead link.

Out: the inter-agency referral lifecycle (retired by `9fa73f5`); the MSWDO↔barangay
referral flow (restored separately as `/referrals`); the `findOne()` agency check in the
IAR service, which belongs to the retired lifecycle and has its own passing tests.

## Terminology

The two referral flows in this codebase are different things and this spec keeps them
apart. **Case referrals** are the inter-agency referral issued from a case, whose only
remaining surface is the endorsement letter. **Barangay referrals** are the MSWDO↔barangay
flow behind `/referrals`, which is a separate module and is not touched here.

**done** — a step's data is complete. Existing predicate, unchanged: `stepperStepDone` in
`kapwa-client/src/components/case-view/CaseStepper.tsx`.

**locked** — a worker has deliberately sealed a done step. New, separate, orthogonal.

## Key decision: locks are orthogonal to done

A step can be done and unlocked. `stepperStepDone` is shared with the approval-pipeline
cards (`ApprovalPipelinePage.tsx:120`), so feeding lock state into it would make sealing a
step silently change what the admin's pipeline reports. `done` stays a fact about data;
`locked` is a separate axis. The stepper renders both; the pipeline renders `done` only.

## Design

### 1. Storage

New table `case_step_locks`:

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `case_id` | uuid | FK → `cases(id)` |
| `step_index` | smallint | 0–4 |
| `locked_by` | uuid | FK → `users(id)` |
| `locked_by_name` | text | snapshot; the strip renders without a join and survives user deletion |
| `locked_at` | timestamptz | |

Unique on `(case_id, step_index)`. Per repo convention this ships as **both** a TypeORM
migration (next sequential key `…0000000000074`; the chain currently ends at
`ZAddTeamScheduleBlockEndDateCheck0000000000073` across 76 files) **and** an idempotent
`CREATE TABLE IF NOT EXISTS` plus index inside `src/database/migrate.ts`, so a fresh boot
gets the complete schema.

Note: `AGENTS.md` states the chain ends at `…0000000000055` across 55 files. That is stale —
it is at `…0000000000073`. The key above is read off the filesystem, not off the doc. Worth
correcting `AGENTS.md` separately.

Lock state is returned inside the existing `GET /cases/:id` payload as `stepLocks[]`
(`{ stepIndex, lockedByName, lockedAt }`). Cheaper than a new SWR key and suspense
boundary, and the case view already refetches the detail on every step mutation.

### 2. Endpoints

```
POST   /cases/:caseId/steps/:stepIndex/lock     @Roles('admin','social_worker')
DELETE /cases/:caseId/steps/:stepIndex/lock     @Roles('admin','social_worker')
```

Server owns two rules:

- A step may only be locked when it is **done**. A 400 naming the unmet predicate.
- Unlocking is open to the same two roles. Option (a) — soft and reversible, no
  admin-only escape hatch. A mistaken lock must not need an admin.

Locks and unlocks are written to the audit log (`case.step_lock` / `case.step_unlock`) with
the case control number. They are not case-history rows: history records status movement,
and locking does not move status.

### 3. The all-locked gate

Enforced in `validateTransition` on the `assessed → in_review` edge: reject unless all five
steps are locked, and name the unlocked ones in the message.

Placed in `validateTransition` rather than in a new endpoint so that **every** route into
`in_review` is covered. A gate behind the case-view button alone would be bypassed by the
existing `PATCH /cases/:id/status`, which the same worker can call.

**This is a behaviour change, deliberately.** Today a worker can flag a case for admin with
no intervention recorded. After this change they cannot. That is the point of the rule, but
it will block cases that previously slipped through, so it ships with the server gate and
the client button landing together.

### 4. `StepLockBar`

One component, five mounts — steps 0–4. Props: `caseId`, `stepIndex`, `done`, `locked`,
`onChanged`.

- Not locked, not done → Lock button, disabled, with the unmet reason.
- Not locked, done → Lock button, enabled.
- Locked → collapsed strip: "Locked by {name} · {date}" plus Unlock.

Each step file keeps its own concerns; the lock affordance is one shared unit.

### 5. Intervention step layout

`StepInterventions.tsx` becomes:

1. **"Intervention to be issued"** — heading on the add-intervention card. Program select,
   ad-hoc service name, delivery date, amount, mode of delivery, fund source, notes. Below a
   separator, **inside the same card**, the required-documents checklist.
2. **Intervention list** — unchanged, its own card.

The checklist currently derives its requirements from programs already linked to saved
interventions (`CaseRequirements.tsx:49-53`). To make the merged card useful, the checklist
must preview the **selected but unsaved** program's requirements. That needs an
`extraProgramIds` prop on `CaseRequirements`.

> **AMENDED (Task 9, commit 8054ba7):** the union covers the **checklist only**, not the
> lock predicate. The checklist previews saved ∪ selected so the worker can see what a
> program demands *before* committing to it; the lock predicate covers **saved
> interventions only**. An unsaved selection is not part of the case record, so sealing is
> not about it — and the server cannot know about it, so extending the client alone would
> make the two implementations of one rule disagree, which is the exact failure the shared
> `case-step-done-fixture.json` exists to prevent. Where no intervention is saved at all the
> predicate is already false via `interventionCount > 0`.

Lock for this step is enabled when the step is done: at least one intervention exists (or
the recorded "no intervention" decision) and every requirement in scope reads complete.

### 6. Deliberate actions

One `CaseActionBar` in the case view.

**Worker (`social_worker`)** — "Flag for admin review", targeting `assessed → in_review`.
Disabled until all five steps are locked; when disabled it **lists which steps are
missing** rather than greying out silently. Enabled, it opens a confirm dialog naming the
effect before calling `PATCH /cases/:id/status`.

**Admin** — one named button per legal next hop, and only the legal one renders:

| from | to | label |
|---|---|---|
| `enrolled` | `assessed` | Mark assessed |
| `assessed` | `in_review` | Send to review |
| `in_review` | `active` | Approve & activate |
| `active` | `transitioning` | Begin transition |
| `transitioning` | `closed` | Close case |

Each behind a confirm dialog naming its effect. Prerequisite hints are computed
client-side for the disabled state; the server stays authoritative and its message wins.

`approve` requires a signature today (`cases.service.ts:467`); the bar must collect it for
`in_review → active` rather than sending an empty one.

### 7. The PDF scope fix

`endorsementLetterPdf` gains the same MSWDO carve-out `create()` has, single-sourced in a
private helper so the two checks cannot drift again:

```ts
private isMswdoStaff(caller: User): boolean {
  return caller.role === UserRole.ADMIN || caller.role === UserRole.SW;
}
```

Used by `endorsementLetterPdf` only. `findOne()`'s near-identical check is left alone: it
serves the retired lifecycle and has its own tests.

### 8. Dead link

`CaseViewPage.tsx:787` — the inter-agency referral rows stop navigating to
`/agency/referrals/:id`. The row shows the referral's status and letter affordance inline;
there is no detail page to go to.

## Data flow

```
worker completes step data
  → step reads done (existing predicate)
  → worker presses Lock
  → POST /cases/:id/steps/N/lock
  → server re-checks done, writes case_step_locks, audits
  → GET /cases/:id returns stepLocks[]
  → stepper shows the locked strip
  → ...repeat for all five...
worker presses "Flag for admin review"
  → confirm dialog
  → PATCH /cases/:id/status { in_review }
  → validateTransition: all five locked? no → 400 naming the gaps
  → yes → transition, history + audit + notifications
admin sees in_review on the pipeline
  → case view shows "Approve & activate" + signature prompt
```

## Error handling

- Lock on a not-done step → 400, message names the unmet predicate. The client shows the
  server's text rather than inventing one.
- Flag with unlocked steps → 400, message lists them; the bar already showed the same list,
  so this is the backstop for a stale client.
- Admin transition with a missing prerequisite → the existing 400s from
  `validateTransition`, surfaced verbatim.
- Every lock mutation refreshes the case detail so the stepper, the bar and the pipeline
  cannot disagree.

## Testing

**Server** — lock/unlock happy path; lock rejected when not done, with the right message;
unlock rejected for a role outside the gate; `assessed → in_review` rejected with
unlocked steps and accepted with all five; `endorsementLetterPdf` renders for a social
worker with no `agencyId` and still 403s an agency staff member outside the referral.

**Client** — `StepLockBar` in all three states including the disabled reason; the
intervention card contains the checklist and shows the selected program's documents before
save; the lock is enabled exactly when the step is done; the flag button is disabled and
lists gaps until all five are locked; the admin bar renders one button per status and
collects a signature for approve.

**Cross-surface** — a test that the stepper and the approval-pipeline cards agree on `done`
with locks present, so the orthogonality decision cannot be quietly undone.

**Shared fixture** — the `done` predicate now exists on both sides of the wire. Rather than
two hand-kept copies, the server implementation is written against a table of named
predicates that the client test also asserts, so a change to one is a failing test in the
other. This mirrors the existing `requiredDocumentKeys` / activation-gate split rather than
inventing a new problem, but the drift risk is real and worth the fixture.

## Risks

- **The `done` predicate is duplicated across the wire.** Mitigated by the shared fixture
  above. This is the main thing to review.
- **The all-locked gate blocks cases that used to slip through.** Intended. Existing
  in-flight cases will hit it; the error names the gaps so the worker knows what to finish.
- **Five new lock buttons multiply the surface for a mistake.** Mitigated by soft,
  reversible locks: a wrong lock is one click to undo, no admin involved.
- **`in_review → active` needs a signature in the new bar.** If the confirm dialog is built
  without it, approve fails at runtime. Called out in the action-bar section.
