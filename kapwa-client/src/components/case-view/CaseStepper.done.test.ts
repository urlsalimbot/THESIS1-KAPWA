import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stepperStepDone } from './CaseStepper';
import { interventionRequirementsMet } from '@/lib/case-progress';

/**
 * Read, not imported.
 *
 * The client's Docker build context is `kapwa-client/`, so the fixture at the
 * repo root is not in the image — while this package's `build` script runs
 * `tsc --noEmit` over `src`, test files included. A static JSON import therefore
 * makes the typecheck resolve a file that is not there and the image build dies
 * with TS2307. Reading it keeps the fixture in the typecheck's blind spot, which
 * is what the server spec already does for the same reason.
 *
 * The path is still the repo-root fixture: this file lives four levels below it,
 * and both suites must read one file or the shared-fixture guarantee is void.
 */
interface DoneFixtureCase {
  name: string;
  step: string;
  enrollmentCount?: number;
  caseData: any;
  interventionCount: number;
  opts: any;
  expected: boolean;
  requirements?: {
    interventionProgramIds: (string | null)[];
    programs: Array<{ id: string; documentKeys: string[] }>;
    checklist: Record<string, boolean>;
  };
}

const FIXTURE_PATH = join(
  import.meta.dirname,
  '..', '..', '..', '..',
  'docs', 'superpowers', 'specs', 'case-step-done-fixture.json',
);
const fixture: DoneFixtureCase[] = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

// The server must answer "is this step done" independently (case step locks), so
// the predicate is no longer a client-only detail. The fixture at the repo-root
// specs dir is the single source of truth for both sides: a change to either
// implementation that does not change the fixture fails here or in the server
// spec. Do not inline these cases — edit the JSON.
describe('stepperStepDone against the shared fixture', () => {
  for (const c of fixture) {
    it(c.name, () => {
      expect(stepperStepDone(c.step, c.caseData, c.interventionCount, c.enrollmentCount ?? 0, c.opts)).toBe(c.expected);
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
