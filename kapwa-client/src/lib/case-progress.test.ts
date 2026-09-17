import { describe, it, expect } from 'vitest';
import { isAssessmentStepDone, interventionRequirementsMet } from './case-progress';

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

describe('interventionRequirementsMet', () => {
  const program = (id: string, requiredDocuments: string[]) => ({ id, name: id, requiredDocuments });

  it('returns true when no interventions exist', () => {
    expect(interventionRequirementsMet([], [program('p1', ['Valid ID'])], [])).toBe(true);
  });

  it('returns true when interventions link to programs with no required documents', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }, { id: 'i2', programId: null }];
    expect(interventionRequirementsMet(interventions, [{ id: 'p1', requiredDocuments: [] }], [])).toBe(true);
  });

  it('returns false when an intervention exists but required documents are missing', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID', 'Barangay Certificate'])];
    expect(interventionRequirementsMet(interventions, programs, [])).toBe(false);
    expect(interventionRequirementsMet(
      interventions,
      programs,
      [{ requirementKey: 'Valid ID' }],
    )).toBe(false);
  });

  it('returns true once every required document has been uploaded', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID', 'Barangay Certificate'])];
    const docs = [{ requirementKey: 'Valid ID' }, { requirementKey: 'Barangay Certificate' }];
    expect(interventionRequirementsMet(interventions, programs, docs)).toBe(true);
  });

  it('ignores uploads that are not tied to a requirement and unrelated programs', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID']), program('p2', ['Medical Abstract'])];
    const docs = [{ requirementKey: 'Medical Abstract' }, { requirementKey: 'Valid ID' }];
    expect(interventionRequirementsMet(interventions, programs, docs)).toBe(true);
  });

  it('treats programs that have not loaded yet as imposing nothing', () => {
    expect(interventionRequirementsMet([{ id: 'i1', programId: 'p1' }], [], [])).toBe(true);
  });
});
