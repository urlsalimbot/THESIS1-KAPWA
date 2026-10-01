/**
 * The one home for the step vocabulary — the names, and the lifecycle position
 * at which each step comes due. The case-view stepper, the seal service's own
 * rejection message, the seal service's done-predicate, and the "every due step
 * must be sealed" gate in `CasesService` all read this module, so a single error
 * message can never spell one step two different ways, and a gate can never ask
 * for a seal that the done-predicate would refuse to grant.
 *
 * Its own module because it has to be readable from both of those services, and
 * `CaseStepLocksService` depends on `CasesService`. Re-exported from
 * `case-step-locks.service.ts` so the labels keep one import path for callers
 * that reach for the locks service; importing the const from there instead made
 * the two files require each other, and with `emitDecoratorMetadata` the locks
 * service's own `CasesService` parameter came out of the cycle as `undefined` —
 * a Nest DI failure at boot that no unit test can see, because the tests
 * construct the services by hand. `case-step-di.spec.ts` loads the real modules in
 * both orders to keep that true. Re-exporting rather than moving outright also
 * keeps the lock service's public surface unchanged for the specs.
 */
export const CASE_STEP_LABELS: Record<number, string> = {
  0: 'Assess & Interview',
  1: 'Intervention & Requirements',
  2: 'Inter-agency Referrals',
  3: 'Evaluate Help Given',
  4: 'Case Study & Closure',
};

/**
 * Lifecycle position of each status, ascending. The order the FSM moves in.
 */
export const CASE_STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5,
};

/**
 * Minimum lifecycle position at which each step may be "done". Steps 3 (Evaluate
 * Help Given) and 4 (Case Study & Closure) are Phase-Out work: prefilled data on
 * an earlier-status case must not make them look complete.
 *
 * This is the array `CaseStepLocksService.stepDone` reads to floor each step, and
 * `stepsDueAt` below reads to answer "which steps exist yet at this position" —
 * so the two cannot disagree about what a worker may seal at a given status.
 */
export const CASE_STEP_MIN_STATUS: number[] = [0, 0, 0, 3, 4];

/**
 * The steps that are *due* at a lifecycle position: the Phase-In and
 * Implementation work that exists once a case has reached that far.
 *
 * The all-locked gate asks for these, not for all five. Requiring all five meant
 * the gate could never be satisfied by the role it exists for: it fires on
 * `assessed -> in_review`, where status index is 1, while steps 4 and 5 are
 * floored at `active`(3) and `transitioning`(4) — so their Lock buttons are
 * disabled in the UI and `CaseStepLocksService.lock()` rejects them with a 400.
 * A social worker could never flag a case for admin review, and only `admin`
 * bypassed the gate at all.
 *
 * Derived from `CASE_STEP_MIN_STATUS` rather than listed separately, which is the
 * point: the set the gate demands is by construction the set the seal endpoint
 * will accept, so "you have not sealed enough" cannot name a step that cannot be
 * sealed. An unknown or missing status is treated as position 0 — before the
 * first step — so it asks for the Phase-In work rather than waving a case through.
 */
/**
 * Payload keys a seal does **not** guard, per step.
 *
 * A seal claims the *step's own data* is finished, so it refuses writes to that
 * data. It does not claim the rest of the case file is frozen, and one route
 * carries both. `PATCH /cases/:id/transition-plan` writes step 4's self-reliance
 * assessment — which is what the seal means — and also the case's follow-up /
 * home visits, which are ongoing progress monitoring that keeps accruing *after*
 * the assessment is done and are in no step's done-predicate at all. Refusing
 * them would mean a worker who sealed the assessment could never record another
 * home visit, which is the `StepTransition` comment's warning taken as fact:
 * "the worker is left adding follow-up visits with the only Save Transition Plan
 * button hidden".
 *
 * So the rule is *which fields*, not *which route*: a body touching only these
 * keys is not changing the sealed step and is allowed through; anything else is
 * refused. Empty for every other step, which keeps the blanket refusal — the
 * routes for steps 1, 2 and 5 each write that step's own data and nothing else.
 *
 * Declared here, beside the floors, because it is a statement about what a step
 * *is* — the same kind of fact as `CASE_STEP_LABELS` — and because the guard in
 * `CaseStepLocksService` and the comment in `CaseViewPage` must not be allowed to
 * disagree about it.
 */
export const CASE_STEP_UNGUARDED_FIELDS: Record<number, string[]> = {
  3: ['followUpVisits', 'followUpDate'],
};

export function stepsDueAt(status: string | null | undefined): number[] {
  // An unknown or missing status is treated as position 0 — before the first
  // step — which asks for the Phase-In work rather than claiming everything is
  // due. It cannot ask for more than the seal endpoint accepts, because the seal
  // endpoint's own `statusAtLeast` treats an unknown status as uncapped, so
  // every step is acceptable here.
  const index = (status == null ? undefined : CASE_STATUS_INDEX[status]) ?? 0;
  return CASE_STEP_MIN_STATUS
    .map((min, stepIndex) => ({ min, stepIndex }))
    .filter(({ min }) => min <= index)
    .map(({ stepIndex }) => stepIndex);
}
