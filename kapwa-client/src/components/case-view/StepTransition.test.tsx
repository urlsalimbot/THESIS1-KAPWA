import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { StepTransition } from './StepTransition';
import { formatDate } from '@/lib/format';

// Hoisted so the sealed-visits tests can read the payload the component actually
// sent; a `vi.mock` factory cannot close over a test-local `vi.fn()`.
const { mockPatch, mockPost } = vi.hoisted(() => ({ mockPatch: vi.fn(), mockPost: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { patch: (...a: unknown[]) => mockPatch(...a), post: (...a: unknown[]) => mockPost(...a), del: vi.fn(), get: vi.fn() },
}));

beforeEach(() => {
  mockPatch.mockReset();
  mockPatch.mockResolvedValue({});
  mockPost.mockReset();
  mockPost.mockResolvedValue({});
});

type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

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
    renderStep({
      status: 'active',
      selfRelianceLevel: 3,
      sustainabilityPlan: 'sari-sari store',
      caseCategory: 'Children in Conflict with the Law (CICL)',
      // Sealed: `active -> transitioning` now gates on the steps due at `active`
      // (the Implementation phase's own gate), so with them sealed the control is
      // offered rather than held back.
      stepLocks: ['assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'court_hearings', 'evaluate']
        .map((stepKey) => ({ stepKey, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01' })),
    });

    const control = screen.getByRole('button', { name: /Mark Ready for Graduation/i });
    expect(control).toBeEnabled();
    // And the copy that says what it does, which is the only thing standing in
    // for the confirm dialog this edge does not get.
    expect(screen.getByText(/Mark case as transitioning/i)).toBeTruthy();
    expect(screen.queryByText(/Lock these steps before transitioning/i)).toBeNull();
  });

  // The gate itself: the Implementation phase must be sealed before the case
  // leaves it. The button stays visible and names what is open rather than
  // greying out silently, so the admin meets the list here and not a 400.
  it('holds the control while a step due at active is unsealed, and names it', () => {
    renderStep({
      status: 'active',
      selfRelianceLevel: 3,
      sustainabilityPlan: 'sari-sari store',
      caseCategory: 'Children in Conflict with the Law (CICL)',
      // Everything sealed except Court Hearings — the step the gate is for.
      stepLocks: ['assessment', 'discernment', 'enrollments', 'interventions', 'referrals', 'evaluate']
        .map((stepKey) => ({ stepKey, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01' })),
    });

    const control = screen.getByRole('button', { name: /Mark Ready for Graduation/i });
    expect(control).toBeDisabled();
    expect(screen.getByText(/Lock these steps before transitioning/i)).toHaveTextContent('Court Hearings');
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
    const stepLock = { stepKey: 'evaluate', lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
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
    const stepLock = { stepKey: 'evaluate', lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
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
    const SEALED = { stepKey: 'evaluate', lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
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

describe('StepTransition — scheduled home visits', () => {
  const SCHEDULED = {
    id: 'e1', caseId: 'c1', eventType: 'home_visit', eventDate: '2026-10-24',
    startTime: '14:00', notes: 'Check-up', status: 'planned',
  };

  function renderWithEvents(events: unknown[], opts: { readOnly?: boolean } = {}) {
    const fetcher = vi.fn((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('events')) return Promise.resolve(events);
      return Promise.resolve(null);
    });
    return render(
      <SWRConfig value={{ provider: () => new Map(), fetcher }}>
        <StepTransition
          caseId="c1"
          caseData={{}}
          userRole="admin"
          readOnly={opts.readOnly}
        />
      </SWRConfig>,
    );
  }

  it('lists scheduled home visits and completes one', async () => {
    const user = userEvent.setup();
    renderWithEvents([SCHEDULED]);
    expect(await screen.findByText(/Check-up/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Complete/ }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(
      '/cases/c1/events/e1', expect.objectContaining({ status: 'done' }),
    ));
  });

  it('renders the visit time as HH:MM, not the raw HH:MM:SS column', async () => {
    renderWithEvents([{ ...SCHEDULED, startTime: '14:00:00' }]);
    const row = (await screen.findByText(/Check-up/)).closest('div') as HTMLElement;
    expect(row.textContent).toContain('14:00');
    expect(row.textContent).not.toContain('14:00:00');
  });

  it('schedules a new home visit for the case', async () => {
    const user = userEvent.setup();
    renderWithEvents([]);
    await user.click(await screen.findByRole('button', { name: /Schedule Home Visit/ }));
    fireEvent.change(await screen.findByLabelText(/Visit Date/), { target: { value: '2026-11-05' } });
    await user.click(screen.getByRole('button', { name: /Save Visit/ }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/cases/c1/events',
      expect.objectContaining({ eventType: 'home_visit', eventDate: '2026-11-05' }),
    ));
  });

  it('hides the scheduling controls when read-only', async () => {
    renderWithEvents([SCHEDULED], { readOnly: true });
    await screen.findByText(/Check-up/);
    expect(screen.queryByRole('button', { name: /Schedule Home Visit/ })).toBeNull();
  });
});
