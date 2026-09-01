import { describe, it, expect } from 'vitest';
import { isAssessmentStepDone } from './case-progress';

describe('isAssessmentStepDone', () => {
  it('returns false when basic assessment fields are missing', () => {
    expect(isAssessmentStepDone({})).toBe(false);
    expect(isAssessmentStepDone({ problemsPresented: 'p' })).toBe(false);
    expect(isAssessmentStepDone({ problemsPresented: 'p', clientCategory: 'Indigent' })).toBe(false);
  });

  it('returns false when assessment is complete but no FRVA/SWDI score is captured', () => {
    // F10: the review gate needs an FRVA or SWDI score, so the step must not lock
    // the worker out of entering a score.
    expect(isAssessmentStepDone({
      problemsPresented: 'p',
      socialWorkerAssessment: 's',
      clientCategory: 'Indigent',
      frvaScore: null,
      swdiScore: null,
    })).toBe(false);
    expect(isAssessmentStepDone({
      problemsPresented: 'p',
      socialWorkerAssessment: 's',
      clientCategory: 'Indigent',
      frvaScore: 0,
      swdiScore: 0,
    })).toBe(false);
  });

  it('returns true when assessment is complete and an FRVA or SWDI score exists', () => {
    expect(isAssessmentStepDone({
      problemsPresented: 'p',
      socialWorkerAssessment: 's',
      clientCategory: 'Indigent',
      frvaScore: 65,
    })).toBe(true);
    expect(isAssessmentStepDone({
      problemsPresented: 'p',
      socialWorkerAssessment: 's',
      clientCategory: 'Indigent',
      swdiScore: 70,
    })).toBe(true);
  });
});
