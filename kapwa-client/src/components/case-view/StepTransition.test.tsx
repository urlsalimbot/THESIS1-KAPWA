import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { StepTransition } from './StepTransition';
import { formatDate } from '@/lib/format';

// Hoisted so the sealed-visits tests can read the payload the component actually
// sent; a `vi.mock` factory cannot close over a test-local `vi.fn()`.
const { mockPatch } = vi.hoisted(() => ({ mockPatch: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { patch: (...a: unknown[]) => mockPatch(...a), post: vi.fn(), del: vi.fn(), get: vi.fn() },
}));

beforeEach(() => {
  mockPatch.mockReset();
  mockPatch.mockResolvedValue({});
});

type Seal = { stepIndex: number; lockedByName?: string; lockedAt: string } | null;

function renderStep(caseData: any, opts: { readOnly?: boolean; lockReadOnly?: boolean; stepLock?: Seal } = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: vi.fn() }}>
      <StepTransition
        caseId="c1"
        caseData={caseData}
        userRole="admin"
        readOnly={opts.readOnly}
        lockReadOnly={opts.lockReadOnly}
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
    renderStep({ status: 'active', selfRelianceLevel: 3 }, { readOnly: true, lockReadOnly: true });

    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepIndex: 3, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' }, { readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });

  /**
   * A seal freezes the assessment, not the visits.
   *
   * `PATCH /cases/:id/transition-plan` carries both, and the server's
   * `CASE_STEP_UNGUARDED_FIELDS` judges the *keys the body carries*: a body of
   * follow-up visits alone passes a sealed step 4, a body that also carries
   * `selfRelianceLevel` is refused. So the client has to send only the visits once
   * the seal is down, or the whole write is refused and the visits become
   * unsaveable — which is the outcome the mount's own comment warns against.
   *
   * Two tests because the bug has two halves: the control disappearing (a locked
   * UI) and the payload still carrying the assessment (a locked API). Either alone
   * would pass a test of the other.
   */
  describe('follow-up visits stay savable while step 4 is sealed', () => {
    const SEALED = { stepIndex: 3, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    const done = { status: 'active', selfRelianceLevel: 3, sustainabilityPlan: 'sari-sari store' };

    it('keeps the Add Visit control and a save button', () => {
      renderStep(done, { stepLock: SEALED });

      expect(screen.getByRole('button', { name: /Add Visit/i })).toBeTruthy();
      // Relabelled, because it no longer saves the assessment.
      expect(screen.getByRole('button', { name: /Save Follow-up Visits/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Save Transition Plan/i })).toBeNull();
    });

    it('sends only the visits, so the server does not refuse the whole body', async () => {
      const user = userEvent.setup();
      // The visits are seeded on the case rather than added through the form:
      // jsdom does not drive React's `onChange` for a `type="date"` input, so an
      // added visit would silently never register and the assertion would be
      // reading `null`. The form's own behaviour is not what is under test — the
      // payload is.
      renderStep({ ...done, followUpVisits: [{ date: '2026-10-01', type: 'Home Visit' }] }, { stepLock: SEALED });

      // The seeded visit is on screen first, so a null payload below is the
      // component's doing rather than an empty case.
      expect(screen.getByText('Home Visit')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /Save Follow-up Visits/i }));

      await waitFor(() => expect(mockPatch).toHaveBeenCalled());
      // Indexed rather than `.at(-1)`: the client's tsconfig targets es2020, so
      // `Array.prototype.at` is not in the lib types.
      const calls = mockPatch.mock.calls;
      const [path, body] = calls[calls.length - 1];
      expect(path).toBe('/cases/c1/transition-plan');
      // The assessment fields are absent — not present-and-unchanged, because the
      // guard reads the keys, so sending them would make the write a refusal.
      expect(Object.keys(body).some((k) => k === 'selfRelianceLevel')).toBe(false);
      expect(Object.keys(body).some((k) => k === 'sustainabilityPlan')).toBe(false);
      expect(body.followUpVisits.length).toBe(1);
    });

    it('freezes the assessment fields while leaving the visits editable', () => {
      renderStep(done, { stepLock: SEALED });

      // The visits half is untouched, asserted here rather than in the test above
      // so this one is only about the assessment.
      expect(screen.getByRole('button', { name: /Add Visit/i })).toBeTruthy();
      // The three level radios and the two assessment textareas are all disabled.
      // `every`, not `some`: a partial freeze is the bug, and `some` would pass on
      // one frozen input out of five.
      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios.length).toBe(3);
      expect(radios.every((r) => r.disabled)).toBe(true);
      const plan = screen.getByPlaceholderText(/Describe the client's plan/i) as HTMLTextAreaElement;
      expect(plan.disabled).toBe(true);
      const steps = screen.getByPlaceholderText(/Recommendations for skills training/i) as HTMLTextAreaElement;
      expect(steps.disabled).toBe(true);
    });

    it('leaves the assessment editable while the step is unsealed', () => {
      renderStep(done);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios.some((r) => r.disabled)).toBe(false);
      const plan = screen.getByPlaceholderText(/Describe the client's plan/i) as HTMLTextAreaElement;
      expect(plan.disabled).toBe(false);
    });

    // The unsealed shape, so the two tests above cannot both pass on a component
    // that simply never sends the assessment.
    it('sends the assessment with the visits while the step is unsealed', async () => {
      const user = userEvent.setup();
      renderStep(done);

      await user.click(screen.getByRole('button', { name: /Save Transition Plan/i }));

      await waitFor(() => expect(mockPatch).toHaveBeenCalled());
      const calls = mockPatch.mock.calls;
      const [, body] = calls[calls.length - 1];
      expect(Object.keys(body).some((k) => k === 'selfRelianceLevel')).toBe(true);
      expect(Object.keys(body).some((k) => k === 'sustainabilityPlan')).toBe(true);
    });
  });
});
