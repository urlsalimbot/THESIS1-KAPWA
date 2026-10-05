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
    expect(interventionRequirementsMet([], [program('p1', ['Valid ID'])], {})).toBe(true);
  });

  it('returns true when interventions link to programs with no required documents', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }, { id: 'i2', programId: null }];
    expect(interventionRequirementsMet(interventions, [{ id: 'p1', requiredDocuments: [] }], {})).toBe(true);
  });

  it('returns false when an intervention exists but required documents are not met', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID', 'Barangay Certificate'])];
    expect(interventionRequirementsMet(interventions, programs, {})).toBe(false);
    expect(interventionRequirementsMet(interventions, programs, { 'Valid ID': true })).toBe(false);
  });

  it('returns true once every required document is marked met', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID', 'Barangay Certificate'])];
    const checklist = { 'Valid ID': true, 'Barangay Certificate': true };
    expect(interventionRequirementsMet(interventions, programs, checklist)).toBe(true);
  });

  it('ignores checklist entries for unrelated programs', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [program('p1', ['Valid ID']), program('p2', ['Medical Abstract'])];
    expect(interventionRequirementsMet(interventions, programs, { 'Medical Abstract': true, 'Valid ID': true })).toBe(true);
  });

  it('treats programs that have not loaded yet as imposing nothing', () => {
    expect(interventionRequirementsMet([{ id: 'i1', programId: 'p1' }], [], {})).toBe(true);
  });

  it('requires every program document, including ones flagged non-mandatory', () => {
    const interventions = [{ id: 'i1', programId: 'p1' }];
    const programs = [{
      id: 'p1',
      name: 'p1',
      requiredDocumentDetails: [
        { key: 'Valid ID', mandatory: true },
        { key: 'Death certificate (if applicable)', mandatory: false },
      ],
    }];
    expect(interventionRequirementsMet(interventions, programs, { 'Valid ID': true })).toBe(false);
    expect(interventionRequirementsMet(interventions, programs, {
      'Valid ID': true,
      'Death certificate (if applicable)': true,
    })).toBe(true);
  });

  describe('crisis-mode intervention documents', () => {
    const ADHOC = [{ id: 'i1', interventionType: 'medical_assistance' }];
    const DOCS = [{ interventionType: 'medical_assistance', documentKey: 'medical_certificate' }];

    it('requires intervention documents for ad-hoc services in crisis mode', () => {
      expect(interventionRequirementsMet(ADHOC, [], {}, true, DOCS)).toBe(false);
    });

    it('does not require intervention documents when crisis mode is off', () => {
      expect(interventionRequirementsMet(ADHOC, [], {}, false, DOCS)).toBe(true);
      expect(interventionRequirementsMet(ADHOC, [], {}, undefined, DOCS)).toBe(true);
    });

    it('returns true once the intervention documents are met', () => {
      expect(interventionRequirementsMet(ADHOC, [], { medical_certificate: true }, true, DOCS)).toBe(true);
    });

    it('keeps program documents required alongside crisis docs', () => {
      const mixed = [{ id: 'i1', programId: 'p1' }, { id: 'i2', interventionType: 'medical_assistance' }];
      expect(interventionRequirementsMet(mixed, [program('p1', ['Valid ID'])], {}, true, DOCS)).toBe(false);
      expect(interventionRequirementsMet(mixed, [program('p1', ['Valid ID'])], { medical_certificate: true }, true, DOCS)).toBe(false);
      expect(interventionRequirementsMet(mixed, [program('p1', ['Valid ID'])], { 'Valid ID': true, medical_certificate: true }, true, DOCS)).toBe(true);
    });

    it('ignores intervention docs for types not in the case', () => {
      expect(interventionRequirementsMet([{ id: 'i1', interventionType: 'crisis_counseling' }], [], {}, true, DOCS)).toBe(true);
    });
  });
});
