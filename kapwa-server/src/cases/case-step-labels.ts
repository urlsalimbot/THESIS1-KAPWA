/**
 * The one home for the step vocabulary — the names, the per-category
 * templates, and the lifecycle position at which each step comes due. The
 * case-view stepper, the seal service's own rejection message, the seal
 * service's done-predicate, and the "every due step must be sealed" gate in
 * `CasesService` all read this module, so a single error message can never
 * spell one step two different ways, and a gate can never ask for a seal that
 * the done-predicate would refuse to grant.
 *
 * Steps are identified by *stable string keys* (`assessment`, `discernment`,
 * `closure`, …), never by position: category-specific steps interleave with
 * the common ones, and a key survives a template change. Order lives in the
 * per-category template arrays below.
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

/** The steps every case template carries, in display order. */
export const COMMON_STEPS: string[] = [
  'assessment', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure',
];

/**
 * The category steps injected into a category's template. Keyed by the stored
 * `cases.case_category` value (the subtype string, not the group), so a case
 * without a category (legacy) or with a non-statutory subtype gets the common
 * template. Adding a category step later is adding a template entry here, not
 * touching the stepper core.
 *
 * `court_hearings` sits **after `referrals`** in every template that carries it:
 * the case is referred out first, and the hearings the office attends are
 * recorded against a case that already has that hand-off on file. Its position
 * is load-bearing — the client's stepper derives step reachability from the
 * index, so placing it early made it completable before the referral existed.
 */
export const CATEGORY_STEP_TEMPLATES: Record<string, string[]> = {
  'Children in Conflict with the Law (CICL)': [
    'assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Violence Against Women and Their Children (VAWC)': [
    'assessment', 'protection_order', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  // CNSP and Court-Ordered SCS used to fall back to the common template; both
  // are legal categories, so they gain an explicit template carrying the
  // hearings step (spec §5.1).
  'Children in Need of Special Protection (CNSP)': [
    'assessment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Indigency / Court-Ordered Social Case Study': [
    'assessment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
  'Solo Parent': [
    'assessment', 'solo_parent', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure',
  ],
  'Adoption & Foster Care Case': [
    'assessment', 'adoption', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate', 'closure',
  ],
};

/** The display label of every step key that can appear in a template. */
export const CASE_STEP_LABELS: Record<string, string> = {
  assessment: 'Assess & Interview',
  enrollments: 'Program Enrollments',
  interventions: 'Intervention & Requirements',
  referrals: 'Inter-agency Referrals',
  evaluate: 'Evaluate Help Given',
  closure: 'Case Study & Closure',
  discernment: 'Discernment Assessment',
  protection_order: 'Protection Order',
  solo_parent: 'Solo Parent ID',
  adoption: 'Adoption & Foster Care',
  court_hearings: 'Court Hearings',
};

/** Every key that may appear in any template, for the "unknown step" guard. */
export const KNOWN_STEP_KEYS: string[] = Object.keys(CASE_STEP_LABELS);

/** The ordered template for a case category value (common when absent). */
export function stepsForCategory(category: string | null | undefined): string[] {
  return (category && CATEGORY_STEP_TEMPLATES[category]) || [...COMMON_STEPS];
}

/** The category steps a category template injects (empty for common). */
export function categoryStepsFor(category: string | null | undefined): string[] {
  return stepsForCategory(category).filter((k) => !COMMON_STEPS.includes(k));
}

/**
 * Lifecycle position of each status, ascending. The order the FSM moves in.
 * `aftercare` is the terminal post-closure phase; nothing transitions out of it.
 */
export const CASE_STATUS_INDEX: Record<string, number> = {
  enrolled: 0, assessed: 1, in_review: 2, active: 3, transitioning: 4, closed: 5, aftercare: 6,
};

/**
 * Minimum lifecycle position at which each step may be "done". The Phase-In
 * and Implementation steps come due at `enrolled`; `evaluate` (Evaluate Help
 * Given) and `closure` (Case Study & Closure) are Phase-Out work: prefilled
 * data on an earlier-status case must not make them look complete.
 *
 * This is the map `CaseStepLocksService.stepDone` reads to floor each step, and
 * `stepsDueAt` below reads to answer "which steps exist yet at this position" —
 * so the two cannot disagree about what a worker may seal at a given status.
 */
export const CASE_STEP_FLOORS: Record<string, number> = {
  assessment: 0,
  enrollments: 0,
  interventions: 0,
  referrals: 0,
  discernment: 0,
  protection_order: 0,
  solo_parent: 0,
  adoption: 0,
  // Court hearings are *implementation* work: the office attends a hearing on a
  // case that is already active, not on one still being triaged. Floored at
  // `active`(3) for two reasons that are really one:
  //
  //  1. Before `active` the step is Phase-In-inaccessible — the seal endpoint
  //     rejects it with a 400 and the client's reachability rule keeps the
  //     stepper entry disabled, so a worker cannot record hearings against a
  //     case that has not been handed up for review yet.
  //  2. It drops out of `stepsDueAt('assessed')`, which is the set the
  //     `assessed -> in_review` gate demands. Left at 0 that gate required a
  //     sealable-only-at-`active` step while the same step was refusing to be
  //     sealed — an unsatisfiable gate, the exact shape of the `evaluate`/
  //     `closure` bug fixed in `5964197`.
  //
  // The `active -> transitioning` gate picks it back up via `stepsDueAt('active')`.
  court_hearings: 3,
  evaluate: 3,
  closure: 4,
};

/**
 * The steps that are *due* at a lifecycle position: the Phase-In and
 * Implementation work that exists once a case has reached that far, in
 * template order.
 *
 * The all-locked gate asks for these, not for all steps. Requiring every step
 * of the template meant the gate could never be satisfied by the role it exists
 * for: it fires on `assessed -> in_review`, where status index is 1, while
 * `evaluate` and `closure` are floored at `active`(3) and `transitioning`(4) —
 * so their Lock buttons are disabled in the UI and
 * `CaseStepLocksService.lock()` rejects them with a 400. A social worker could
 * never flag a case for admin review, and only `admin` bypassed the gate at all.
 *
 * Derived from `CASE_STEP_FLOORS` rather than listed separately, which is the
 * point: the set the gate demands is by construction the set the seal endpoint
 * will accept, so "you have not sealed enough" cannot name a step that cannot be
 * sealed. An unknown or missing status is treated as position 0 — before the
 * first step — so it asks for the Phase-In work rather than waving a case
 * through.
 */
export function stepsDueAt(
  status: string | null | undefined,
  category: string | null | undefined = undefined,
): string[] {
  const index = (status == null ? undefined : CASE_STATUS_INDEX[status]) ?? 0;
  return stepsForCategory(category).filter((k) => (CASE_STEP_FLOORS[k] ?? 0) <= index);
}

/**
 * The steps that *begin* at this lifecycle position — the subset of `stepsDueAt`
 * whose floor is exactly this status, rather than at or before it.
 *
 * The Phase-Out gates ask for one of these, and the difference from `stepsDueAt`
 * is the whole point. A case study begins when a case goes `active` and the
 * closure begins when it goes `transitioning`, so those are the two steps whose
 * work is *completed* by leaving the status the gate fires on. `stepsDueAt` at
 * `transitioning` already returns every template step, which is why gating
 * `closed` on "every step due" would have named a step that had nothing to do
 * with closing — and why asking for every step at `assessed` was unsatisfiable.
 * Neither problem is about the *set*; it is about naming a step that belongs to
 * a different status.
 *
 * Derived from the same `CASE_STEP_FLOORS` as everything else, so it cannot
 * disagree with the floor the seal endpoint enforces. Being "due at exactly this
 * position" is also what makes it sealable *here*: the effective floor equals the
 * current index, so `stepDone`'s `statusAtLeast` accepts it — the property
 * `case-step-labels.spec.ts` asserts across the whole lifecycle.
 *
 * An unknown or missing status is position 0, matching `stepsDueAt`, so a payload
 * the gate cannot read asks for the Phase-In work rather than waving a case
 * through.
 */
export function stepsBecomingDueAt(
  status: string | null | undefined,
  category: string | null | undefined = undefined,
): string[] {
  const index = (status == null ? undefined : CASE_STATUS_INDEX[status]) ?? 0;
  return stepsForCategory(category).filter((k) => (CASE_STEP_FLOORS[k] ?? 0) === index);
}

/**
 * Payload keys a seal does **not** guard, per step.
 *
 * A seal claims the *step's own data* is finished, so it refuses writes to that
 * data. It does not claim the rest of the case file is frozen, and one route
 * carries both. `PATCH /cases/:id/transition-plan` writes the `evaluate`
 * step's self-reliance assessment — which is what the seal means — and also the
 * case's follow-up / home visits, which are ongoing progress monitoring that
 * keeps accruing *after* the assessment is done and are in no step's
 * done-predicate at all. Refusing them would mean a worker who sealed the
 * assessment could never record another home visit, which is the
 * `StepTransition` comment's warning taken as fact: "the worker is left adding
 * follow-up visits with the only Save Transition Plan button hidden".
 *
 * So the rule is *which fields*, not *which route*: a body touching only these
 * keys is not changing the sealed step and is allowed through; anything else is
 * refused. Empty for every other step, which keeps the blanket refusal — the
 * routes for the other steps each write that step's own data and nothing else.
 *
 * Declared here, beside the floors, because it is a statement about what a step
 * *is* — the same kind of fact as `CASE_STEP_LABELS` — and because the guard in
 * `CaseStepLocksService` and the comment in `CaseViewPage` must not be allowed to
 * disagree about it.
 */
export const CASE_STEP_UNGUARDED_FIELDS: Record<string, string[]> = {
  evaluate: ['followUpVisits', 'followUpDate'],
};