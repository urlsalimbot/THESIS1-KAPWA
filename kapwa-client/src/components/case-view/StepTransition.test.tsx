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
