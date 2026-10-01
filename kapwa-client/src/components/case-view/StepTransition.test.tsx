import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { StepTransition } from './StepTransition';
import { formatDate } from '@/lib/format';

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn(), post: vi.fn(), del: vi.fn(), get: vi.fn() },
}));

type Seal = { stepIndex: number; lockedByName?: string; lockedAt: string } | null;

function renderStep(caseData: any, opts: { readOnly?: boolean; stepLock?: Seal } = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: vi.fn() }}>
      <StepTransition
        caseId="c1"
        caseData={caseData}
        userRole="admin"
        readOnly={opts.readOnly}
        stepLock={opts.stepLock}
      />
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

describe('StepTransition — owns the active -> transitioning edge', () => {
  // The positive half of `CaseActionBar`'s `ownedByStepCard` suppression, and it
  // has to live *here*. The bar renders nothing for `active`, so this card is the
  // only control for `active -> transitioning`; if it stopped rendering, the
  // bar's own "renders nothing at active" assertion would keep passing — a bar
  // that renders nothing at all satisfies it — and nobody could move the case on.
  // `renderStep` mounts as `admin`, which is the only role `CASE_FSM_ROLES`
  // admits from `active` once the admin short-circuit is accounted for, so this
  // is the whole set the bar suppresses for.
  it('is the only control for active -> transitioning, and offers it to an admin', () => {
    renderStep({ status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });

    const control = screen.getByRole('button', { name: /Mark Ready for Graduation/i });
    expect(control).toBeEnabled();
    // And the copy that says what it does, which is the only thing standing in
    // for the confirm dialog this edge does not get.
    expect(screen.getByText(/Mark case as transitioning/i)).toBeTruthy();
  });

  it('offers it on an active case only — an admin looking at a different status gets nothing', () => {
    renderStep({ status: 'transitioning', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });
    expect(screen.queryByRole('button', { name: /Mark Ready for Graduation/i })).toBeNull();
  });
});

describe('StepTransition — sealing step 4', () => {
  // `stepperStepDone(3, …)` wants a self-reliance level AND a sustainability
  // plan, and `active` is the earliest status that clears the step's floor.
  it('disables Lock while the transition plan is not done', () => {
    renderStep({ status: 'active', selfRelianceLevel: 3 });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once the transition plan is saved', () => {
    renderStep({ status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepIndex: 3, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' }, { stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', () => {
    renderStep({ status: 'active', selfRelianceLevel: 3 }, { readOnly: true });

    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepIndex: 3, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' }, { readOnly: true, stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});
