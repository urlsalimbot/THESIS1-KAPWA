import { describe, it, expect } from 'vitest';
import fixture from '../../../../docs/superpowers/specs/case-step-done-fixture.json';
import { stepperStepDone } from './CaseStepper';

// The server must answer "is this step done" independently (case step locks), so
// the predicate is no longer a client-only detail. The fixture at the repo-root
// specs dir is the single source of truth for both sides: a change to either
// implementation that does not change the fixture fails here or in the server
// spec. Do not inline these cases — edit the JSON.
describe('stepperStepDone against the shared fixture', () => {
  for (const c of fixture) {
    it(c.name, () => {
      expect(stepperStepDone(c.step, c.caseData, c.interventionCount, c.opts)).toBe(c.expected);
    });
  }
});