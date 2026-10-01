import { stepsDueAt, stepsBecomingDueAt, CASE_STEP_MIN_STATUS, CASE_STEP_LABELS, CASE_STATUS_INDEX } from './case-step-labels';

/**
 * `stepsDueAt` is the whole fix for an unsatisfiable gate, so it is asserted
 * against the property that makes it correct rather than against the numbers it
 * happens to return: **every step it names must be one the seal endpoint would
 * accept at that status.** The seal endpoint's acceptance is
 * `CaseStepLocksService.stepDone`, which floors each step at
 * `CASE_STEP_MIN_STATUS[i]` (except steps 0 and 1, which are status-independent).
 *
 * If someone raises a floor, this set shrinks with it automatically and the gate
 * can never again demand a step that cannot be sealed. If someone derived the
 * due-set from anything else, the property below is what fails.
 */
describe('stepsDueAt', () => {
  const LIFECYCLE = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];

  /**
   * The floor `stepDone` actually applies to a step, honouring the
   * status-independent exemption. Steps 0 and 1 are exempt because step 1 is the
   * step that *submits* an assessed case — flooring it on a later status made
   * "Submit for Review" unreachable.
   */
  const effectiveFloor = (stepIndex: number): number =>
    stepIndex === 0 || stepIndex === 1 ? 0 : CASE_STEP_MIN_STATUS[stepIndex];

  it('names only steps the done-predicate can accept at that status', () => {
    for (const status of LIFECYCLE) {
      const index = CASE_STATUS_INDEX[status];
      for (const stepIndex of stepsDueAt(status)) {
        expect({ status, stepIndex, floor: effectiveFloor(stepIndex) <= index }).toEqual({
          status, stepIndex, floor: true,
        });
      }
    }
  });

  it('has a label for every step it can name', () => {
    for (const status of LIFECYCLE) {
      for (const stepIndex of stepsDueAt(status)) {
        expect(typeof CASE_STEP_LABELS[stepIndex]).toBe('string');
        expect(CASE_STEP_LABELS[stepIndex].length).toBeGreaterThan(0);
      }
    }
  });

  it('grows monotonically with the lifecycle, and never drops a step', () => {
    let previous: number[] = [];
    for (const status of LIFECYCLE) {
      const due = stepsDueAt(status);
      // Every previously-due step is still due, and the set is in step order.
      expect(due.slice(0, previous.length)).toEqual(previous);
      previous = due;
    }
  });

  it('treats an unknown or missing status as before the first step', () => {
    // Fail closed: an unrecognised status must not wave a case through by
    // asking for nothing. Both of these ask for the Phase-In minimum rather than
    // claiming everything is due (or that nothing is).
    expect(stepsDueAt('something-else').length).toBeGreaterThan(0);
    expect(stepsDueAt(null).length).toBeGreaterThan(0);
    expect(stepsDueAt(undefined).length).toBeGreaterThan(0);
    // And those sets are still sealable, or the gate would be stuck the other way.
    expect(stepsDueAt(null).every((i) => effectiveFloor(i) <= 0)).toBe(true);
  });

  it('puts the Phase-In and Implementation work first, as the ledger records', () => {
    // The concrete expectation behind the ruling: at `assessed` the gate asks for
    // assessment, intervention and referrals, and not for the phase-out steps
    // whose Lock buttons are disabled at that status.
    expect(stepsDueAt('assessed')).toEqual([0, 1, 2]);
    expect(stepsDueAt('assessed').some((i) => i >= 3)).toBe(false);
  });

  it('only asks for the phase-out steps once they exist in the lifecycle', () => {
    expect(stepsDueAt('active')).toEqual([0, 1, 2, 3]);
    expect(stepsDueAt('transitioning')).toEqual([0, 1, 2, 3, 4]);
    expect(stepsDueAt('closed')).toEqual([0, 1, 2, 3, 4]);
  });
});

/**
 * The Phase-Out gates ask for the step whose work *begins* at the status they
 * fire on, not for the step that is due — the two differ, which is how those two
 * steps ended up with no gate at all.
 */
describe('stepsBecomingDueAt', () => {
  it('names the step that comes due at exactly this lifecycle position', () => {
    expect(stepsBecomingDueAt('active')).toEqual([3]);
    expect(stepsBecomingDueAt('transitioning')).toEqual([4]);
  });

  it('names nothing at the positions where no step begins', () => {
    // `enrolled` and `assessed` share floor 0, so two steps begin there and the
    // lifecycle has no position with no newly-due step until `in_review`.
    expect(stepsBecomingDueAt('in_review')).toEqual([]);
    expect(stepsBecomingDueAt('closed')).toEqual([]);
  });

  // The property the whole helper rests on: a step is only ever named at a status
  // the seal endpoint accepts it at, so a gate built on it cannot be stuck the way
  // the all-five version was. If a floor moves, this is what fails.
  it('only names steps the done-predicate can accept at that status', () => {
    const LIFECYCLE = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];
    const effectiveFloor = (i: number): number =>
      i === 0 || i === 1 ? 0 : CASE_STEP_MIN_STATUS[i];
    for (const status of LIFECYCLE) {
      for (const stepIndex of stepsBecomingDueAt(status)) {
        expect(effectiveFloor(stepIndex) === CASE_STATUS_INDEX[status]).toBe(true);
      }
    }
  });

  // A subset of `stepsDueAt` at the same status, so it can never ask for a step
  // the gate it sits beside would not already accept.
  it('is always a subset of the steps due at that status', () => {
    const LIFECYCLE = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];
    for (const status of LIFECYCLE) {
      const due = stepsDueAt(status);
      const becoming = stepsBecomingDueAt(status);
      expect(becoming.every((i) => due.includes(i))).toBe(true);
      expect(becoming.length <= due.length).toBe(true);
    }
  });

  it('treats an unknown or missing status as before the first step', () => {
    expect(stepsBecomingDueAt('something-else')).toEqual(stepsBecomingDueAt('enrolled'));
    expect(stepsBecomingDueAt(null)).toEqual(stepsBecomingDueAt('enrolled'));
    expect(stepsBecomingDueAt(undefined)).toEqual(stepsBecomingDueAt('enrolled'));
  });

  it('has a label for every step it can name', () => {
    for (const status of ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed']) {
      for (const stepIndex of stepsBecomingDueAt(status)) {
        expect(typeof CASE_STEP_LABELS[stepIndex]).toBe('string');
        expect(CASE_STEP_LABELS[stepIndex].length).toBeGreaterThan(0);
      }
    }
  });
});
