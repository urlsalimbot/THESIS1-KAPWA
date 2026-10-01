import { describe, it, expect } from 'vitest';
import fixture from '../../../../docs/superpowers/specs/case-step-done-fixture.json';
import { stepperStepDone } from './CaseStepper';
import { interventionRequirementsMet } from '@/lib/case-progress';

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

/**
 * The other half of step 1's rule.
 *
 * `opts.requirementsMet` is the given the loop above consumes; `interventionRequirementsMet`
 * is what the case view derives it from before handing it to `stepperStepDone`.
 * The fixture's `requirements` block is that derivation's inputs, and until now
 * only the server spec read it — so a change to the client's copy would have
 * passed the client suite while the server half stayed honest. Drive the client
 * function from the same block, the way the server spec drives its own.
 *
 * `interventionCount > 0` because that is the only state in which step 1's
 * branch consults requirements at all (the server spec filters on the same
 * condition, and its justification is executable there).
 */
describe('interventionRequirementsMet against the shared fixture', () => {
  const withRequirements = fixture.filter((fx: any) => fx.requirements && fx.interventionCount > 0);

  it('has entries to drive', () => {
    expect(withRequirements.length).toBeGreaterThan(0);
  });

  for (const fx of withRequirements as any[]) {
    it(fx.name, () => {
      const interventions = fx.requirements.interventionProgramIds.map((programId: string | null) => ({ programId }));
      const programs = fx.requirements.programs.map((p: any) => ({
        id: p.id,
        requiredDocumentDetails: p.documentKeys,
      }));
      expect(interventionRequirementsMet(interventions, programs, fx.requirements.checklist)).toBe(fx.expected);
    });
  }
});
