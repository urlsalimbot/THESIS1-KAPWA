import { stepsDueAt, stepsBecomingDueAt, CASE_STEP_FLOORS, CASE_STEP_LABELS, CASE_STATUS_INDEX, stepsForCategory, COMMON_STEPS, categoryStepsFor } from './case-step-labels';

const COMMON = ['assessment', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'];
const CICL = ['assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure'];

/**
 * `stepsDueAt` is the whole fix for an unsatisfiable gate, so it is asserted
 * against the property that makes it correct rather than against the keys it
 * happens to return: **every step it names must be one the seal endpoint would
 * accept at that status.** The seal endpoint's acceptance is
 * `CaseStepLocksService.stepDone`, which floors each step at
 * `CASE_STEP_FLOORS[key]`.
 *
 * If someone raises a floor, this set shrinks with it automatically and the gate
 * can never again demand a step that cannot be sealed. If someone derived the
 * due-set from anything else, the property below is what fails.
 */
describe('stepsDueAt', () => {
  const LIFECYCLE = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];

  it('names only steps the done-predicate can accept at that status', () => {
    for (const status of LIFECYCLE) {
      const index = CASE_STATUS_INDEX[status];
      for (const stepKey of stepsDueAt(status)) {
        expect({ status, stepKey, floor: (CASE_STEP_FLOORS[stepKey] ?? 0) <= index }).toEqual({
          status, stepKey, floor: true,
        });
      }
    }
  });

  it('has a label for every step it can name', () => {
    for (const status of LIFECYCLE) {
      for (const stepKey of stepsDueAt(status)) {
        expect(typeof CASE_STEP_LABELS[stepKey]).toBe('string');
        expect(CASE_STEP_LABELS[stepKey].length).toBeGreaterThan(0);
      }
    }
  });

  it('grows monotonically with the lifecycle, and never drops a step', () => {
    let previous: string[] = [];
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
    expect(stepsDueAt(null).every((k) => (CASE_STEP_FLOORS[k] ?? 0) <= 0)).toBe(true);
  });

  it('puts the Phase-In and Implementation work first, as the ledger records', () => {
    // At `assessed` the gate asks for the Phase-In + Implementation steps, and
    // not for the phase-out steps whose Lock buttons are disabled at that status.
    expect(stepsDueAt('assessed')).toEqual(['assessment', 'enrollments', 'interventions', 'referrals']);
    expect(stepsDueAt('assessed').includes('evaluate')).toBe(false);
    expect(stepsDueAt('assessed').includes('closure')).toBe(false);
  });

  it('only asks for the phase-out steps once they exist in the lifecycle', () => {
    expect(stepsDueAt('active')).toEqual(['assessment', 'enrollments', 'interventions', 'referrals', 'evaluate']);
    expect(stepsDueAt('transitioning')).toEqual(COMMON);
    expect(stepsDueAt('closed')).toEqual(COMMON);
  });

  it('is limited to the case category template', () => {
    // A CICL case's due steps at `enrolled` include the injected discernment
    // step; a VAWC case's template names protection_order instead — but a common
    // (category-less) case never sees either.
    expect(stepsDueAt('enrolled', 'Children in Conflict with the Law (CICL)')).toContain('discernment');
    expect(stepsDueAt('enrolled', 'Violence Against Women and Their Children (VAWC)')).toContain('protection_order');
    expect(stepsDueAt('enrolled').includes('discernment')).toBe(false);
    expect(stepsDueAt('enrolled', 'Solo Parent')).toEqual(['assessment', 'solo_parent', 'enrollments', 'interventions', 'referrals']);
  });
});

/**
 * The Phase-Out gates ask for the step whose work *begins* at the status they
 * fire on, not for the step that is due — the two differ, which is how those two
 * steps ended up with no gate at all.
 */
describe('stepsBecomingDueAt', () => {
  it('names the step that comes due at exactly this lifecycle position', () => {
    expect(stepsBecomingDueAt('active')).toEqual(['evaluate']);
    expect(stepsBecomingDueAt('transitioning')).toEqual(['closure']);
  });

  it('names nothing at the positions where no step begins', () => {
    // `enrolled`, `assessed` and `in_review` share floor 0 for the Phase-In
    // steps, so no step *begins* at `in_review`.
    expect(stepsBecomingDueAt('in_review')).toEqual([]);
    expect(stepsBecomingDueAt('closed')).toEqual([]);
  });

  // The property the whole helper rests on: a step is only ever named at a status
  // the seal endpoint accepts it at, so a gate built on it cannot be stuck the way
  // the all-five version was. If a floor moves, this is what fails.
  it('only names steps the done-predicate can accept at that status', () => {
    const LIFECYCLE = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed'];
    for (const status of LIFECYCLE) {
      for (const stepKey of stepsBecomingDueAt(status)) {
        expect((CASE_STEP_FLOORS[stepKey] ?? 0) === CASE_STATUS_INDEX[status]).toBe(true);
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
      expect(becoming.every((k) => due.includes(k))).toBe(true);
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
      for (const stepKey of stepsBecomingDueAt(status)) {
        expect(typeof CASE_STEP_LABELS[stepKey]).toBe('string');
        expect(CASE_STEP_LABELS[stepKey].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('template registry', () => {
  it('defaults to the common template for a missing category', () => {
    expect(stepsForCategory(undefined)).toEqual(COMMON);
    expect(stepsForCategory(null)).toEqual(COMMON);
    expect(stepsForCategory('Some Unknown Category')).toEqual(COMMON);
    expect(stepsForCategory('Solo Parent')).toEqual(['assessment', 'solo_parent', 'enrollments', 'interventions', 'referrals', 'evaluate', 'closure']);
  });

  it('injects exactly one category step before enrollment for each statutory category', () => {
    expect(categoryStepsFor('Children in Conflict with the Law (CICL)')).toEqual(['discernment']);
    expect(categoryStepsFor('Violence Against Women and Their Children (VAWC)')).toEqual(['protection_order']);
    expect(categoryStepsFor('Solo Parent')).toEqual(['solo_parent']);
    expect(categoryStepsFor('Adoption & Foster Care Case')).toEqual(['adoption']);
    expect(categoryStepsFor(undefined)).toEqual([]);
  });

  it('every template starts with assessment and contains the common steps in order', () => {
    for (const category of ['Children in Conflict with the Law (CICL)', 'Violence Against Women and Their Children (VAWC)', 'Solo Parent', 'Adoption & Foster Care Case']) {
      const tpl = stepsForCategory(category);
      expect(tpl[0]).toBe('assessment');
      const commonKeys = tpl.filter((k) => COMMON_STEPS.includes(k));
      expect(commonKeys).toEqual(COMMON);
    }
  });

  it('every injected category step has a label and a floor of 0', () => {
    for (const category of ['Children in Conflict with the Law (CICL)', 'Violence Against Women and Their Children (VAWC)', 'Solo Parent', 'Adoption & Foster Care Case']) {
      for (const k of categoryStepsFor(category)) {
        expect(typeof CASE_STEP_LABELS[k]).toBe('string');
        expect(CASE_STEP_FLOORS[k]).toBe(0);
      }
    }
  });

  it('CICL due steps at enrolled include discernment, and fit the template order', () => {
    const due = stepsDueAt('enrolled', 'Children in Conflict with the Law (CICL)');
    expect(due).toEqual(['assessment', 'discernment', 'enrollments', 'interventions', 'referrals']);
    // The injected step sits between assessment and enrollment, never at the end.
    const tpl = stepsForCategory('Children in Conflict with the Law (CICL)');
    expect(tpl).toEqual(CICL);
  });
});