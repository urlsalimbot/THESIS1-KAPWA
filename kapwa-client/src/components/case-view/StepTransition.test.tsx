import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { StepTransition } from './StepTransition';

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn(), post: vi.fn(), get: vi.fn() },
}));

function renderStep(caseData: any) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: vi.fn() }}>
      <StepTransition caseId="c1" caseData={caseData} userRole="admin" />
    </SWRConfig>,
  );
}

describe('StepTransition — self-reliance recommendation', () => {
  it('recommends closure when the level is self-sufficient', () => {
    renderStep({ selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });
    expect(screen.getByText(/proceed to Closure/i)).toBeTruthy();
  });

  it('flags renewal when the level is below the guide', () => {
    renderStep({ selfRelianceLevel: 2, sustainabilityPlan: 'sari-sari store' });
    expect(screen.getByText(/subject to case renewal/i)).toBeTruthy();
  });
});

describe('StepTransition — savable until closure', () => {
  it('keeps the Save Transition Plan button when the plan is saved but the case is not closed', () => {
    // Regression: CaseViewPage must not flip readOnly once stepDone[3] (plan
    // saved) — the worker still adds follow-up visits and must be able to save.
    renderStep({ selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });
    expect(screen.getByRole('button', { name: /Save Transition Plan/i })).toBeTruthy();
  });

  it('hides the Save Transition Plan button only when readOnly (case closed)', () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), fetcher: vi.fn() }}>
        <StepTransition caseId="c1" caseData={{ selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' }} userRole="admin" readOnly />
      </SWRConfig>,
    );
    expect(screen.queryByRole('button', { name: /Save Transition Plan/i })).toBeNull();
  });
});
