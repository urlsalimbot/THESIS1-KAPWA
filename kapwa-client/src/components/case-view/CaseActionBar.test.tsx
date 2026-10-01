import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { CaseActionBar } from './CaseActionBar';
import { stepsDueAt } from './CaseStepper';
import { ApiError } from '@/lib/api-error';

const { mockApiPatch, mockApiPost } = vi.hoisted(() => ({
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

// The due-step set must be *derived* from the shared floor constants, not written
// out again here. `stepsDueAt` is wrapped in a delegating spy so every other test
// still gets the real derivation, and the two tests that name it can prove the
// rendered list follows this function's answer rather than a local literal.
const { mockStepsDueAt } = vi.hoisted(() => ({ mockStepsDueAt: vi.fn() }));

vi.mock('./CaseStepper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CaseStepper')>();
  return {
    ...actual,
    stepsDueAt: (...args: Parameters<typeof actual.stepsDueAt>) => mockStepsDueAt(...args),
  };
});

const actualStepsDueAt = (
  await vi.importActual<typeof import('./CaseStepper')>('./CaseStepper')
).stepsDueAt;

const noop = () => {};
const locksFor = (steps: number[]) =>
  steps.map((stepIndex) => ({ stepIndex, lockedByName: 'Lorna Santos', lockedAt: '2026-10-01T09:00:00Z' }));

// The exact string the server sends when the all-locked gate fires from a stale
// client (cases.service.ts). It names the open steps in the stepper's own
// labels, so the bar must show it untouched — paraphrasing it would turn a
// precise answer into "something went wrong".
const SERVER_GATE_MESSAGE =
  'Lock every step before flagging this case for admin review. Still open: Inter-agency Referrals';

function renderBar(props: Partial<React.ComponentProps<typeof CaseActionBar>> = {}) {
  return render(
    <>
      <Toaster />
      <CaseActionBar caseId="c1" caseData={{ status: 'assessed' }} userRole="social_worker" onChanged={noop} {...props} />
    </>,
  );
}

const flagButton = () => screen.getByRole('button', { name: /flag for admin review/i });
const confirmButton = () => screen.getByRole('button', { name: /^confirm$/i });

describe('CaseActionBar', () => {
  beforeEach(() => {
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockResolvedValue({});
    mockApiPost.mockResolvedValue({});
    mockStepsDueAt.mockReset();
    mockStepsDueAt.mockImplementation(actualStepsDueAt);
  });

  // --- the worker's hand-off, gated on the steps *due* at `assessed` ---------

  it('enables Flag once steps 1-3 are sealed, because steps 4-5 are not due yet', () => {
    // THE test for the deadlock. At `assessed` the Phase-Out steps are floored at
    // `active`/`transitioning`, so their Lock buttons are disabled and the seal
    // endpoint rejects them — they can never appear in `stepLocks`. A rule asking
    // for all five leaves this button permanently disabled and no social worker
    // can ever flag a case. This fails against such a rule.
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) } });

    expect(flagButton()).toBeEnabled();
    expect(screen.queryByText(/seal these steps/i)).toBeNull();
  });

  it('names only the steps that are still open, and says so in the stepper\'s own words', () => {
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1]) } });

    expect(flagButton()).toBeDisabled();
    expect(screen.getByText('Inter-agency Referrals')).toBeTruthy();
    // The two steps that cannot be sealed here are named nowhere: a worker must
    // not be sent to a Lock button that is disabled and whose endpoint 400s.
    expect(screen.queryByText('Evaluate Help Given')).toBeNull();
    expect(screen.queryByText('Case Study & Closure')).toBeNull();
    expect(screen.queryByText('Intervention & Requirements')).toBeNull();
  });

  it('derives the open set by calling stepsDueAt with the case status', () => {
    mockStepsDueAt.mockReturnValue([1, 2]);
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0]) } });

    expect(mockStepsDueAt).toHaveBeenCalledWith('assessed');
    // Follows the derivation on both branches, so it cannot pass by rendering a
    // literal that happens to agree for one status.
    expect(screen.getByText('Intervention & Requirements')).toBeTruthy();
    expect(screen.getByText('Inter-agency Referrals')).toBeTruthy();

    mockStepsDueAt.mockReturnValue([]);
    renderBar({ caseData: { status: 'assessed', stepLocks: [] } });
    expect(screen.getAllByRole('button', { name: /flag for admin review/i })[1]).toBeEnabled();
  });

  it('disables Flag with a reason when nothing is sealed, and opens no dialog', async () => {
    const user = userEvent.setup();
    renderBar({ caseData: { status: 'assessed', stepLocks: [] } });

    expect(flagButton()).toBeDisabled();
    await user.click(flagButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  // --- the worker's hand-off, when it is allowed ---------------------------

  it('confirms, naming the effect, then flags the case for review', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) }, onChanged });

    await user.click(flagButton());

    // The dialog names what will happen, in a full sentence, before anything is
    // sent — the whole point of putting this behind a confirm.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(/flag for admin review/i);
    expect(within(dialog).getByText(/hands the case to an administrator/i)).toBeTruthy();
    expect(mockApiPatch).not.toHaveBeenCalled();

    await user.click(confirmButton());
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/cases/c1/status', { status: 'in_review' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sends the signature as `signature`, the field ApproveCaseSchema names', async () => {
    // The schema is `z.object({ status, signature: z.string().optional() })`. A
    // field spelled anything else is stripped or 400s, and the failure reads as
    // a server bug rather than a typo.
    const user = userEvent.setup();
    renderBar({ caseId: 'c1', caseData: { status: 'in_review' }, userRole: 'admin' });

    await user.click(screen.getByRole('button', { name: /approve & activate/i }));
    await user.type(screen.getByLabelText(/approver signature/i), 'Lorna Santos');
    await user.click(confirmButton());

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/cases/c1/approve', {
        status: 'active',
        signature: 'Lorna Santos',
      }),
    );
  });

  // --- a failed write is not a failed transition ---------------------------

  it('shows the server\'s own refusal verbatim and does not claim the case moved', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    mockApiPatch.mockRejectedValue(new ApiError(400, { message: SERVER_GATE_MESSAGE }));
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) }, onChanged });

    await user.click(flagButton());
    await user.click(confirmButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(SERVER_GATE_MESSAGE);
    // Nothing committed, so nothing to refresh — and no success toast, which is
    // what would send the worker off to re-flag a case that already moved.
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/case moved/i)).toBeNull();
  });

  it('reports a committed transition whose refresh failed as a refresh failure', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockRejectedValue(new Error('offline'));
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) }, onChanged });

    await user.click(flagButton());
    await user.click(confirmButton());

    // Same class of care as StepLockBar: the write landed. Telling the worker it
    // failed is what makes them click again.
    expect(await screen.findByText(/did not refresh/i)).toBeTruthy();
    expect(screen.queryByText(/could not be moved/i)).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  // --- admin: one named button per legal forward hop -----------------------

  it.each([
    ['assessed', /send to review/i],
    ['in_review', /approve & activate/i],
    ['transitioning', /close case/i],
  ] as const)('gives an admin exactly the %s hop and nothing else', (status, name) => {
    renderBar({ caseData: { status }, userRole: 'admin' });

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name })).toBeEnabled();
  });

  // Two edges are deliberately absent, and this is the test that keeps it that
  // way. `StepAssessment` owns `enrolled -> assessed` (it withholds the control
  // until an FRVA/SWDI score exists) and `StepTransition` owns
  // `active -> transitioning` (it sits beside the transition plan). Rendering
  // either here would mean a second, *ungated* button for the same transition —
  // the bypass shape Override 2 is about — or copying three server preconditions
  // into this component with nothing keeping the copies honest.
  it.each(['enrolled', 'active'])('renders nothing at %s, whose edge a step card owns', (status) => {
    renderBar({ caseData: { status }, userRole: 'admin' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('offers nothing at closed, which has no successor', () => {
    renderBar({ caseData: { status: 'closed' }, userRole: 'admin' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('offers nothing to a role the FSM does not admit from this status', () => {
    // `CASE_FSM_ROLES` admits no non-admin role from in_review — only the
    // /approve endpoint's admin is there. A coordinator or claimant must get
    // nothing, not a button that 403s.
    renderBar({ caseData: { status: 'in_review' }, userRole: 'coordinator' });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('gives an admin the assessed hop with no all-locked gate, matching the server', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ caseData: { status: 'assessed', stepLocks: [] }, userRole: 'admin', onChanged });

    const send = screen.getByRole('button', { name: /send to review/i });
    expect(send).toBeEnabled();

    await user.click(send);
    await user.click(confirmButton());
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/cases/c1/status', { status: 'in_review' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it.each([
    ['in_review', /approve & activate/i, '/cases/c1/approve'],
    ['transitioning', /close case/i, '/cases/c1/close'],
  ] as const)('sends the %s hop to its own endpoint', async (status, name, path) => {
    const user = userEvent.setup();
    renderBar({ caseData: { status }, userRole: 'admin' });

    await user.click(screen.getByRole('button', { name }));
    if (status === 'in_review') await user.type(screen.getByLabelText(/approver signature/i), 'Lorna');
    await user.click(confirmButton());

    await waitFor(() => expect(mockApiPatch.mock.calls[0][0]).toBe(path));
  });

  // --- the signature gate --------------------------------------------------

  it('will not approve on an empty signature', async () => {
    const user = userEvent.setup();
    renderBar({ caseData: { status: 'in_review' }, userRole: 'admin' });

    await user.click(screen.getByRole('button', { name: /approve & activate/i }));

    // Nothing is sent while the field is empty, and the requirement is stated
    // rather than left as a mysteriously dead button.
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText(/signature to approve/i)).toBeTruthy();
    expect(mockApiPatch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/approver signature/i), ' ');
    expect(confirmButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/approver signature/i), 'Lorna');
    expect(confirmButton()).toBeEnabled();
  });

  // --- Override 2: this bar is the only worker control for the hand-off ----

  it('offers one control for the hand-off, and clicking it is the only write', async () => {
    const user = userEvent.setup();
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) } });

    // Two controls for one transition means one of them carries the all-locked
    // gate and the other is a way around it — which is the bypass this feature
    // exists to remove. StepImplementHIP.test.tsx asserts the other side.
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await user.click(flagButton());
    await user.click(confirmButton());
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
  });

  it('closes without writing, so a second look costs nothing', async () => {
    const user = userEvent.setup();
    renderBar({ caseData: { status: 'assessed', stepLocks: locksFor([0, 1, 2]) } });

    await user.click(flagButton());
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

// --- the shared derivation itself -----------------------------------------

describe('stepsDueAt', () => {
  it('asks for the three steps that are due at assessed, never the Phase-Out pair', () => {
    expect(stepsDueAt('assessed')).toEqual([0, 1, 2]);
    expect(stepsDueAt('assessed').some((i) => i >= 3)).toBe(false);
  });

  it('widens with the lifecycle and stays empty-free at every real status', () => {
    expect(stepsDueAt('enrolled')).toEqual([0, 1, 2]);
    expect(stepsDueAt('active')).toEqual([0, 1, 2, 3]);
    expect(stepsDueAt('transitioning')).toEqual([0, 1, 2, 3, 4]);
    expect(stepsDueAt('closed')).toEqual([0, 1, 2, 3, 4]);
  });

  it('asks for the Phase-In work rather than waving through an unread status', () => {
    for (const unknown of ['something-else', null, undefined]) {
      expect(stepsDueAt(unknown).length).toBeGreaterThan(0);
      expect(stepsDueAt(unknown).every((i) => i < 3)).toBe(true);
    }
  });
});