import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseStepper, stepperStepDone, stepperStatus } from './CaseStepper';

describe('CaseStepper — lifecycle labels', () => {
  it('renders the five lifecycle step labels', () => {
    render(<CaseStepper currentStep={0} onStepClick={() => {}} caseData={{}} interventionCount={0} />);
    ['Assess & Interview', 'Intervention & Requirements', 'Inter-agency Referrals', 'Evaluate Help Given', 'Case Study & Closure']
      .forEach((label, i) => {
        expect(screen.getByRole('button', { name: `${i + 1}. ${label}` })).toBeTruthy();
      });
  });
});

describe('stepperStepDone — Implement HIP gating', () => {
  it('requires an intervention before step 2 completes', () => {
    expect(stepperStepDone(1, {}, 0, {})).toBe(false);
    expect(stepperStepDone(1, {}, 1, {})).toBe(true);
  });

  it('does not check step 2 until required documents are uploaded', () => {
    const caseData = { status: 'assessed' };
    expect(stepperStepDone(1, caseData, 1, { requirementsMet: false })).toBe(false);
  });

  it('checks step 2 once the intervention exists and requirements are met', () => {
    const caseData = { status: 'assessed' };
    expect(stepperStepDone(1, caseData, 1, { requirementsMet: true })).toBe(true);
  });

  it('falls back to the intervention-only check when no progress data is supplied', () => {
    expect(stepperStepDone(1, {}, 1)).toBe(true);
    expect(stepperStepDone(1, {}, 0)).toBe(false);
  });
});

describe('stepperStepDone — Service Delivery gating', () => {
  it('is NOT done on interventions alone anymore', () => {
    const caseData = { referrals: undefined };
    expect(stepperStepDone(2, caseData, 2, {})).toBe(false);
  });

  it('is done when a referral is issued', () => {
    const caseData = { referrals: [{ agencyName: 'DSWD', status: 'pending', reason: 'x' }] };
    expect(stepperStepDone(2, caseData, 0, {})).toBe(true);
  });

  it('is done when the social worker decides a referral is not needed', () => {
    const caseData = { referrals: undefined };
    expect(stepperStepDone(2, caseData, 0, { referralNotNeeded: true })).toBe(true);
  });

  it('is NOT done when no referral exists and no decision was recorded', () => {
    const caseData = { status: 'active', referrals: undefined };
    expect(stepperStepDone(2, caseData, 3, { referralNotNeeded: false })).toBe(false);
  });
});

describe('CaseStepper rendering', () => {
  const baseCase = {
    status: 'assessed',
    selfRelianceLevel: null,
    sustainabilityPlan: null,
    clientSignature: null,
    closureOutcome: null,
  };

  function stepButton(label: string) {
    return screen.getByText(label).closest('button')!;
  }

  it('shows the step number, not a check, when step 2 requirements are missing', () => {
    render(
      <CaseStepper currentStep={0} onStepClick={vi.fn()} caseData={baseCase} interventionCount={1} requirementsMet={false} />,
    );
    expect(stepButton('Intervention & Requirements').textContent).toContain('2');
  });

  it('shows a check on step 2 once an intervention and all required documents exist', () => {
    render(
      <CaseStepper currentStep={0} onStepClick={vi.fn()} caseData={baseCase} interventionCount={2} requirementsMet={true} />,
    );
    const step2 = stepButton('Intervention & Requirements');
    expect(step2.textContent).not.toContain('2');
    expect(step2.querySelector('svg')).not.toBeNull();
  });

  it('shows a check on step 3 when the referral-not-needed decision is recorded', () => {
    render(
      <CaseStepper
        currentStep={0}
        onStepClick={vi.fn()}
        caseData={{ ...baseCase, referralNotNeeded: true }}
        interventionCount={2}
        requirementsMet={true}
      />,
    );
    const step3 = stepButton('Inter-agency Referrals');
    expect(step3.textContent).not.toContain('3');
    expect(step3.querySelector('svg')).not.toBeNull();
  });

  it('keeps step 3 unchecked when there is no referral and no decision recorded', () => {
    render(
      <CaseStepper currentStep={0} onStepClick={vi.fn()} caseData={baseCase} interventionCount={2} requirementsMet={true} referralNotNeeded={false} />,
    );
    expect(stepButton('Inter-agency Referrals').textContent).toContain('3');
  });
});

describe('stepperStepDone — Phase-Out steps require the case to reach Phase-Out', () => {
  it('does not mark Evaluate Help Given done before the case is active', () => {
    const prefilled = { status: 'in_review', selfRelianceLevel: 3, sustainabilityPlan: 'plan' };
    expect(stepperStepDone(3, prefilled, 1, {})).toBe(false);
    expect(stepperStepDone(3, { ...prefilled, status: 'active' }, 1, {})).toBe(true);
  });

  it('does not mark Case Study & Closure done before Phase-Out', () => {
    const prefilled = { status: 'active', clientSignature: 'sig', closureOutcome: 'graduated' };
    expect(stepperStepDone(4, prefilled, 1, {})).toBe(false);
    expect(stepperStepDone(4, { ...prefilled, status: 'transitioning' }, 1, {})).toBe(true);
    expect(stepperStepDone(4, { ...prefilled, status: 'closed' }, 1, {})).toBe(true);
  });

  it('does not cap steps when the status is unknown (partial payload)', () => {
    expect(stepperStepDone(3, { selfRelianceLevel: 3, sustainabilityPlan: 'plan' }, 1, {})).toBe(true);
  });
});

describe('stepperStatus', () => {
  it('maps each step through stepperStepDone with progress opts', () => {
    const status = stepperStatus({ status: 'assessed' }, 1, { requirementsMet: false, referralNotNeeded: true });
    expect(status).toEqual([false, false, true, false, false]);
  });
});