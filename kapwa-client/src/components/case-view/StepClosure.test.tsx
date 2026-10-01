import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepClosure } from './StepClosure';
import { formatDate } from '@/lib/format';

// The generated-document helpers are imported at module scope by StepClosure, so
// the mock has to name them even though this spec never presses a download.
vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), patch: vi.fn(), del: vi.fn(), get: vi.fn() },
  downloadCsrPdf: vi.fn(),
  downloadFilingDoc: vi.fn(),
  filingDocIdFromUrl: () => null,
}));

type Seal = { stepIndex: number; lockedByName?: string; lockedAt: string } | null;

const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';

function renderStep(
  caseData: any,
  opts: { readOnly?: boolean; lockReadOnly?: boolean; stepLock?: Seal } = {},
) {
  return render(
    <StepClosure
      caseId="c1"
      caseData={{ id: 'c1', ...caseData }}
      readOnly={opts.readOnly}
      {...(opts.lockReadOnly === undefined ? {} : { lockReadOnly: opts.lockReadOnly })}
      stepLock={opts.stepLock}
    />,
  );
}

describe('StepClosure — sealing step 5', () => {
  // `stepperStepDone(4, …)` wants an outcome AND a captured signature, and
  // `transitioning` is the earliest status that clears this step's floor — a
  // prefilled outcome on an earlier case must not read as a finished closure.
  it('disables Lock while the closure is not done', () => {
    renderStep({ status: 'transitioning', closureOutcome: 'graduated' });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once the outcome and the signature are recorded', () => {
    renderStep({ status: 'transitioning', closureOutcome: 'graduated', clientSignature: SIGNATURE });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'transitioning', closureOutcome: 'graduated', clientSignature: SIGNATURE }, { stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', () => {
    renderStep({ status: 'transitioning' }, { readOnly: true, lockReadOnly: true });

    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('still offers the seal when the body is readOnly but lockReadOnly is not', () => {
    // The trap this step has to survive: its `readOnly` flips true exactly when
    // the closure is complete, which is exactly when the step becomes sealable.
    // Routed to the bar, that signal renders `null` and step 5 can never be
    // sealed at all — so the bar reads `lockReadOnly` instead.
    renderStep(
      { status: 'transitioning', closureOutcome: 'graduated', clientSignature: SIGNATURE },
      { readOnly: true, lockReadOnly: false },
    );

    // The body really is read-only — the form is locked down, as it should be
    // once the data is complete.
    expect(screen.queryByRole('button', { name: /Save Progress/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Close Case/i })).toBeNull();
    // And the one control that step still owes is on screen.
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('defaults lockReadOnly to false, so a sealed step always offers its release', () => {
    // The fail-safe half: a caller that omits `lockReadOnly` on a sealed step
    // must still get the Unlock. Defaulting it to `readOnly` reproduced the
    // Critical lockout — the step body is read-only *because* it is sealed, so
    // the release is the one control that has to survive.
    const stepLock = { stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'transitioning', closureOutcome: 'graduated', clientSignature: SIGNATURE }, { readOnly: true, stepLock });

    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep({ status: 'transitioning', closureOutcome: 'graduated', clientSignature: SIGNATURE }, { readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});
