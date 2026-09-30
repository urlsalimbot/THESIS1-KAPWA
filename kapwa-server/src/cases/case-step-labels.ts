/**
 * The one home for step names. The case-view stepper, the seal service's own
 * rejection message, and the "every step must be sealed" gate in `CasesService`
 * all read these, so a single error message can never spell one step two
 * different ways. Keys are the `step_index` values in the URL.
 *
 * Its own module because it has to be readable from both of those services, and
 * `CaseStepLocksService` depends on `CasesService`. Re-exported from
 * `case-step-locks.service.ts` so the labels keep one import path for callers
 * that reach for the locks service; importing the const from there instead made
 * the two files require each other, and with `emitDecoratorMetadata` the locks
 * service's own `CasesService` parameter came out of the cycle as `undefined` —
 * a Nest DI failure at boot that no unit test can see, because the tests
 * construct the services by hand. Re-exporting rather than moving outright also
 * keeps the lock service's public surface unchanged for the specs.
 */
export const CASE_STEP_LABELS: Record<number, string> = {
  0: 'Assess & Interview',
  1: 'Intervention & Requirements',
  2: 'Inter-agency Referrals',
  3: 'Evaluate Help Given',
  4: 'Case Study & Closure',
};
