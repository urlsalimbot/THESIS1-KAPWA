import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { StepLockBar } from './StepLockBar';
import { formatDate } from '@/lib/format';
import type { StepperProgressOpts } from './CaseStepper';

const { mockApiPost, mockApiDel } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockApiDel: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    patch: vi.fn(),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

// The bar must *call* the shared predicate rather than restate it: the
// predicate already exists twice (this module's `CaseStepper` and the server's
// `CaseStepLocksService`) and the shared `case-step-done-fixture.json` keeps
// those two honest. A third copy inside StepLockBar would be the one nobody
// tests. So the real `stepperStepDone` is wrapped in a *delegating* spy: every
// other test still gets the real predicate, and the two tests below can prove
// the rendered state follows this function's answer instead of a local one.
const { mockStepperStepDone } = vi.hoisted(() => ({ mockStepperStepDone: vi.fn() }));

vi.mock('./CaseStepper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CaseStepper')>();
  return {
    ...actual,
    stepperStepDone: (...args: Parameters<typeof actual.stepperStepDone>) => mockStepperStepDone(...args),
  };
});

const actualStepperStepDone = (
  await vi.importActual<typeof import('./CaseStepper')>('./CaseStepper')
).stepperStepDone;

const noop = () => {};
const NOT_DONE_HINT = /Complete this step before sealing it/;

// Step 0 reads problemsPresented + clientCategory, so this case is done at step
// 0 and nowhere else.
const doneCaseData = { status: 'enrolled', problemsPresented: 'a', clientCategory: 'b' };
const lockedRow = { stepIndex: 0, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };

function renderBar(props: Partial<React.ComponentProps<typeof StepLockBar>> = {}) {
  return render(
    <>
      <Toaster />
      <StepLockBar
        caseId="c1"
        stepIndex={0}
        caseData={doneCaseData}
        interventionCount={0}
        onChanged={noop}
        {...props}
      />
    </>,
  );
}

describe('StepLockBar', () => {
  beforeEach(() => {
    mockApiPost.mockReset();
    mockApiDel.mockReset();
    mockApiPost.mockResolvedValue({});
    mockApiDel.mockResolvedValue({});
    // Re-established every test: the global afterEach calls restoreAllMocks.
    mockStepperStepDone.mockReset();
    mockStepperStepDone.mockImplementation(actualStepperStepDone);
  });

  // --- not done ---------------------------------------------------------

  it('disables Lock and names the reason when the step is not done', () => {
    // Step 3 needs a self-reliance level *and* a sustainability plan; `active`
    // is the earliest status that clears its status floor, so the only thing
    // missing is the data.
    renderBar({ stepIndex: 3, caseData: { status: 'active' } });

    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(lock).toBeDisabled();
    // The reason is two mechanisms, and both are asserted: the disabled button
    // carries it as its accessible description (via `title`, which a
    // `pointer-events-none` button can never show as a tooltip), and it is
    // rendered as text for the sighted user who cannot hover a disabled button.
    expect(lock).toHaveAccessibleDescription(NOT_DONE_HINT);
    expect(screen.getByText(NOT_DONE_HINT)).toBeTruthy();
  });

  // --- done -------------------------------------------------------------

  it('enables Lock once the step is done', () => {
    renderBar();

    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(lock).toBeEnabled();
    expect(screen.queryByText(NOT_DONE_HINT)).toBeNull();
  });

  // --- the predicate is borrowed, not restated ----------------------------

  it('follows the shared predicate when it answers the other way', () => {
    // Both directions, so this cannot pass by accident on either branch: a
    // locally-restated predicate would ignore the spy entirely and keep
    // answering from caseData.
    mockStepperStepDone.mockReturnValueOnce(false);
    const { unmount } = renderBar();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    unmount();

    mockStepperStepDone.mockReturnValueOnce(true);
    renderBar({ caseData: { status: 'enrolled' } });
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  const rows: Array<{ stepIndex: number; caseData: any; interventionCount: number; opts: StepperProgressOpts }> = [
    // Every step in both states, so no branch of the borrowed predicate is
    // left unexercised by the component that borrows it.
    { stepIndex: 0, caseData: doneCaseData, interventionCount: 0, opts: {} },
    { stepIndex: 0, caseData: { status: 'enrolled', problemsPresented: 'a' }, interventionCount: 0, opts: {} },
    { stepIndex: 1, caseData: { status: 'enrolled' }, interventionCount: 1, opts: {} },
    { stepIndex: 1, caseData: { status: 'enrolled' }, interventionCount: 0, opts: {} },
    { stepIndex: 2, caseData: {}, interventionCount: 0, opts: { interAgencyReferralCount: 1 } },
    { stepIndex: 2, caseData: {}, interventionCount: 0, opts: {} },
    // The shape this predicate used to read. Present so the bar's coverage keeps
    // proving it asks `stepperStepDone` rather than holding its own idea — and,
    // incidentally, that the shape does not now complete the step.
    { stepIndex: 2, caseData: { referrals: [{ id: 'r1' }] }, interventionCount: 0, opts: {} },
    { stepIndex: 3, caseData: { status: 'active', selfRelianceLevel: 2, sustainabilityPlan: 'p' }, interventionCount: 0, opts: {} },
    { stepIndex: 3, caseData: { status: 'active', selfRelianceLevel: 2 }, interventionCount: 0, opts: {} },
    { stepIndex: 4, caseData: { status: 'transitioning', clientSignature: 'sig', closureOutcome: 'out' }, interventionCount: 0, opts: {} },
    { stepIndex: 4, caseData: { status: 'transitioning', clientSignature: 'sig' }, interventionCount: 0, opts: {} },
    // The opts-gated branches: a referral / intervention recorded as not needed
    // is the only thing that satisfies these steps with no rows behind them.
    { stepIndex: 1, caseData: { status: 'enrolled' }, interventionCount: 0, opts: { interventionNotNeeded: true } },
    { stepIndex: 2, caseData: { status: 'enrolled' }, interventionCount: 0, opts: { referralNotNeeded: true } },
  ];

  it.each(rows)(
    'enables Lock iff stepperStepDone is true for step $stepIndex',
    ({ stepIndex, caseData, interventionCount, opts }) => {
      const expected = actualStepperStepDone(stepIndex, caseData, interventionCount, opts);
      const { container } = renderBar({ stepIndex, caseData, interventionCount, opts });

      const lock = within(container).getByRole('button', { name: /^lock$/i });
      if (expected) expect(lock).toBeEnabled();
      else expect(lock).toBeDisabled();

      // And it is *this* function that decided, with the props it was handed.
      expect(mockStepperStepDone).toHaveBeenLastCalledWith(stepIndex, caseData, interventionCount, opts);
    },
  );

  // --- locked ------------------------------------------------------------

  it('shows who locked it and when, and offers Unlock', () => {
    renderBar({ locked: lockedRow });

    // Exact string: the name, the formatted date and the separator between
    // them. Computing the date with the same formatDate the component uses is
    // also what proves it went through that helper.
    expect(
      screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(lockedRow.lockedAt)}`),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('still names the seal when the locker row has no name', () => {
    // `displayName()` on the server returns undefined for a user row with no
    // name parts at all, so the strip must not render "Locked by  · <date>".
    renderBar({ locked: { stepIndex: 0, lockedAt: lockedRow.lockedAt } });

    expect(
      screen.getByText(`Locked by Unknown · ${formatDate(lockedRow.lockedAt)}`),
    ).toBeTruthy();
  });

  it('hides both controls in readOnly but keeps the record readable', () => {
    renderBar({ locked: lockedRow, readOnly: true });

    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.getByText(/Juan Dela Cruz/)).toBeTruthy();
  });

  it('offers no control at all in readOnly on an unsealed step', () => {
    // The live Lock here would be a seal a viewer with no write role could take.
    // A read-only viewer also gets no hint: "complete this step before sealing
    // it" asks for an action they cannot perform.
    renderBar({ readOnly: true });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(NOT_DONE_HINT)).toBeNull();
  });

  it('offers no control at all in readOnly on a step that is ready to seal', () => {
    // The same hole on the *enabled* button, which is the one a user would
    // actually click: a done step renders a live Lock without the readOnly gate.
    renderBar({ readOnly: true, caseData: { status: 'transitioning', clientSignature: 'sig', closureOutcome: 'out' }, stepIndex: 4 });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  // --- the predicate also owns the not-needed fallback -------------------

  it('reads a recorded no-referral decision off the case row, not just off opts', () => {
    // `CaseStepper` falls back to the case row for these two decisions and the
    // server does too; a bar that passed `opts` raw would leave a step the
    // stepper calls done with no way to seal it, and the server's 400 is the
    // only thing the user would ever see about it.
    renderBar({ stepIndex: 2, caseData: { status: 'active', referrals: [], referralNotNeeded: true } });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('reads a recorded no-intervention decision off the case row too', () => {
    renderBar({ stepIndex: 1, caseData: { status: 'enrolled', interventionNotNeeded: true }, interventionCount: 0 });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  // --- the two requests --------------------------------------------------

  it('POSTs the lock and refreshes onChanged', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ onChanged });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/cases/c1/steps/0/lock');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('DELETEs the lock on unlock and refreshes onChanged', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ locked: lockedRow, onChanged });

    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(mockApiDel).toHaveBeenCalledWith('/cases/c1/steps/0/lock');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('addresses the endpoint of the step it is mounted on', async () => {
    const user = userEvent.setup();
    renderBar({ stepIndex: 4, caseData: { status: 'transitioning', clientSignature: 'sig', closureOutcome: 'out' } });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/cases/c1/steps/4/lock');
  });

  // `busy` is the whole of the double-click defence: it is the button's
  // `disabled`, so the second click never reaches the handler. Both verbs, since
  // each button carries its own `disabled`.
  it('does not re-send a seal while the first request is in flight', async () => {
    const user = userEvent.setup();
    let release = () => {};
    mockApiPost.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ stepIndex: 0, lockedByName: 'Ana Reyes', lockedAt: '2026-10-02T08:00:00Z' }); }));
    renderBar();

    const lock = screen.getByRole('button', { name: /^lock$/i });
    await user.click(lock);
    await waitFor(() => expect(lock).toBeDisabled());
    await user.click(lock);

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    release();
    // The seal landed, so the bar shows it — and the release it now offers is
    // live, which is also what says `busy` came back down.
    await waitFor(() => expect(screen.getByRole('button', { name: /unlock/i })).toBeEnabled());
  });

  it('does not re-send a release while the first request is in flight', async () => {
    const user = userEvent.setup();
    let release = () => {};
    mockApiDel.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({}); }));
    renderBar({ locked: lockedRow });

    const unlock = screen.getByRole('button', { name: /unlock/i });
    await user.click(unlock);
    await waitFor(() => expect(unlock).toBeDisabled());
    await user.click(unlock);

    expect(mockApiDel).toHaveBeenCalledTimes(1);
    release();
    // The release landed, so the bar is back to offering the seal, and that
    // button is live — which is also what says `busy` came back down.
    await waitFor(() => expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled());
  });

  // --- failures ----------------------------------------------------------
  //
  // Each of these pins the *identity* of the message it is about — its title and
  // its description — because the two verbs raise their own copy. Asserting only
  // one half of the pair would let the two messages be swapped in the component
  // and leave every test green.

  it('names the seal failure with the server’s own reason', async () => {
    // The server answers 400 when the step is not done — the one error a user
    // can provoke from the UI, and the reason the disabled state exists.
    mockApiPost.mockRejectedValueOnce(new Error('"Assess & Interview" is not complete yet — finish it before sealing it.'));
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ onChanged });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));

    expect(await screen.findByText('Could not seal this step')).toBeTruthy();
    expect(screen.getByText(/is not complete yet/)).toBeTruthy();
    expect(screen.queryByText('Could not release the lock')).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('names the release failure with its own reason', async () => {
    mockApiDel.mockRejectedValueOnce(new Error('That record could not be found.'));
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderBar({ locked: lockedRow, onChanged });

    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByText('Could not release the lock')).toBeTruthy();
    expect(screen.getByText(/could not be found/)).toBeTruthy();
    expect(screen.queryByText('Could not seal this step')).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  // --- a failed write leaves the control usable --------------------------

  it('re-enables the Lock button after a failed seal', async () => {
    // `busy` is cleared on the failure path too. A control that failed once and
    // stayed disabled would be a silent lockout: the reason would be on a toast
    // that has since gone, and nothing would say why it could not be pressed.
    mockApiPost.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderBar();

    const lock = screen.getByRole('button', { name: /^lock$/i });
    await user.click(lock);
    await screen.findByText('Could not seal this step');

    // The button the user pressed is the one that comes back — the failed write
    // must not have left a seal record behind either.
    await waitFor(() => expect(lock).toBeEnabled());
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('re-enables the Unlock button after a failed release, strip intact', async () => {
    mockApiDel.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderBar({ locked: lockedRow });

    const unlock = screen.getByRole('button', { name: /unlock/i });
    await user.click(unlock);
    await screen.findByText('Could not release the lock');

    await waitFor(() => expect(unlock).toBeEnabled());
    expect(screen.getByText(/Juan Dela Cruz/)).toBeTruthy();
  });

  // --- a failed refresh is not a failed write ----------------------------

  it('reports a failed refresh as its own thing, never as a failed write', async () => {
    // The write committed and the seal exists. Reporting it as "Could not seal
    // this step" would be a lie the user acts on: the bar would still show Lock,
    // and the retry would write a second audit row for a step already sealed.
    mockApiPost.mockResolvedValue({ stepIndex: 0, lockedByName: 'Ana Reyes', lockedAt: '2026-10-02T08:00:00Z' });
    const onChanged = vi.fn().mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    renderBar({ onChanged });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));

    expect(await screen.findByText('Saved, but the case did not refresh')).toBeTruthy();
    expect(screen.queryByText('Could not seal this step')).toBeNull();
  });

  it('stops offering a seal the server has already accepted', async () => {
    // The deliberate half of the previous test: the seal exists, so the bar
    // must say so from the POST's own answer rather than keep the button that
    // invites a duplicate.
    mockApiPost.mockResolvedValue({ stepIndex: 0, lockedByName: 'Ana Reyes', lockedAt: '2026-10-02T08:00:00Z' });
    const onChanged = vi.fn().mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    renderBar({ onChanged });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));

    await screen.findByText(/Ana Reyes/);
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('reports a failed refresh after a release the same way', async () => {
    mockApiDel.mockResolvedValue({});
    const onChanged = vi.fn().mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    renderBar({ locked: lockedRow, onChanged });

    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByText('Saved, but the case did not refresh')).toBeTruthy();
    expect(screen.queryByText('Could not release the lock')).toBeNull();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });

  it('defers to the parent once its data says what this bar last wrote', async () => {
    // The override only stands while the parent still reports the pre-write
    // state. Once the parent moves — a refresh that lands later, or another
    // worker — its answer wins, so the bar cannot go on disagreeing with the
    // record it is meant to be showing.
    mockApiPost.mockResolvedValue({ stepIndex: 0, lockedByName: 'Ana Reyes', lockedAt: '2026-10-02T08:00:00Z' });
    const onChanged = vi.fn().mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    const { rerender } = renderBar({ onChanged });

    await user.click(screen.getByRole('button', { name: /^lock$/i }));
    await screen.findByText(/Ana Reyes/);

    // The parent catches up and reports a different locker: a fresh read, not
    // the stale snapshot this bar was holding.
    rerender(
      <>
        <Toaster />
        <StepLockBar
          caseId="c1"
          stepIndex={0}
          caseData={doneCaseData}
          interventionCount={0}
          onChanged={onChanged}
          locked={{ ...lockedRow, lockedByName: 'Bela Santos' }}
        />
      </>,
    );

    expect(await screen.findByText(/Bela Santos/)).toBeTruthy();
  });

  it('lets a second writer take over after a release', async () => {
    // The presence-only comparison this replaces could not see a second writer
    // swap one sealed row for a different one: `present` stayed true, so the
    // override survived and the bar kept offering a Lock for a step that was
    // sealed again. Row identity is what makes the parent win.
    const user = userEvent.setup();
    const { rerender } = renderBar({ locked: lockedRow });

    await user.click(screen.getByRole('button', { name: /unlock/i }));
    // The release is reflected before the parent re-reads it.
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeTruthy();

    rerender(
      <>
        <Toaster />
        <StepLockBar
          caseId="c1"
          stepIndex={0}
          caseData={doneCaseData}
          interventionCount={0}
          onChanged={noop}
          locked={{ stepIndex: 0, lockedByName: 'Bela Santos', lockedAt: '2026-10-03T09:00:00Z' }}
        />
      </>,
    );

    // A different seal, so the parent's answer wins — no Lock on a sealed step.
    expect(await screen.findByText(/Bela Santos/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });
});
