import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { StepIntegratedDelivery } from './StepIntegratedDelivery';
import { formatDate } from '@/lib/format';

const { mockApiGet, mockApiPatch, mockDownloadLetter, mockDownloadLetterById } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockDownloadLetter: vi.fn(),
  mockDownloadLetterById: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
  downloadEndorsementLetter: (...args: unknown[]) => mockDownloadLetter(...args),
  downloadEndorsementLetterById: (...args: unknown[]) => mockDownloadLetterById(...args),
}));

const AGENCIES = [
  { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
  { id: 'ag-deped', code: 'DepEd', name: 'DepEd Norzagaray' },
];

function renderStep(
  referrals: unknown[] = [],
  opts: {
    readOnly?: boolean;
    lockReadOnly?: boolean;
    role?: string;
    referralNotNeeded?: boolean;
    stepLock?: { stepIndex: number; lockedByName?: string; lockedAt: string } | null;
    caseDataOverrides?: Record<string, unknown>;
  } = {},
) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <Toaster />
      <StepIntegratedDelivery
        caseId="case-1"
        caseData={{
          beneficiary: { id: 'b1', firstName: 'Juan', surname: 'Dela Cruz' },
          status: 'assessed',
          referralNotNeeded: opts.referralNotNeeded,
          ...opts.caseDataOverrides,
        }}
        userRole={opts.role ?? 'social_worker'}
        readOnly={opts.readOnly}
        lockReadOnly={opts.lockReadOnly}
        stepLock={opts.stepLock}
      />
    </SWRConfig>,
  );
}

describe('StepIntegratedDelivery — referral or an explicit no-referral decision', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockDownloadLetter.mockReset();
    mockDownloadLetterById.mockReset();
    mockApiPatch.mockResolvedValue({});
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve(null);
    });
  });

  it('offers the two mutually exclusive completions side by side', async () => {
    renderStep();

    expect(await screen.findByRole('button', { name: /Add Referral/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /No Referrals issued/i })).toBeTruthy();
  });

  it('records "no referrals issued" through the decision endpoint', async () => {
    // The server's in_review -> active gate rejects a case for a missing
    // referral decision; before this control existed no client code could ever
    // call PATCH /cases/:id/referral-decision, so that rejection was
    // unavoidable in the UI.
    const user = userEvent.setup();
    renderStep();

    await user.click(await screen.findByRole('button', { name: /No Referrals issued/i }));

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/cases/case-1/referral-decision', { notNeeded: true }),
    );
  });

  it('hides both actions once "no referrals issued" is recorded, offering only Undo', async () => {
    const user = userEvent.setup();
    renderStep([], { referralNotNeeded: true });

    expect(await screen.findByText(/No referral needed/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Referral/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /No Referrals issued/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Undo decision/i }));
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/cases/case-1/referral-decision', { notNeeded: false }),
    );
  });

  it('withdraws both header actions once a live referral exists', async () => {
    // Both channels open at once is what the activation gate rejects, and a
    // second referral would silently orphan the first, so the header actions go
    // away entirely and only the re-download of the letter remains.
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([{ id: 'r1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }]);
      }
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve(null);
    });
    renderStep();

    expect(await screen.findByRole('button', { name: /Endorsement Letter/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Referral/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /No Referrals issued/i })).toBeNull();
  });

  it('issues the letter from the dialog and downloads it', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(await screen.findByRole('button', { name: /Add Referral/i }));

    await user.selectOptions(await screen.findByLabelText(/Target Agency/i), 'ag-rhu');
    await user.type(screen.getByLabelText(/Reason/i), 'Medical coordination');
    await user.click(screen.getByRole('button', { name: /^Issue$/i }));

    await waitFor(() => {
      expect(mockDownloadLetter).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({ toAgencyId: 'ag-rhu', reason: 'Medical coordination', legalBasisCode: expect.any(String) }),
      );
    });
  });

  it('shows why the issue failed instead of failing silently', async () => {
    mockDownloadLetter.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderStep();

    await user.click(await screen.findByRole('button', { name: /Add Referral/i }));
    await user.selectOptions(await screen.findByLabelText(/Target Agency/i), 'ag-rhu');
    await user.type(screen.getByLabelText(/Reason/i), 'Medical coordination');
    await user.click(screen.getByRole('button', { name: /^Issue$/i }));

    // The failure surfaces as a toast (sonner renders role="status"), not a
    // silent no-op.
    expect(await screen.findByText(/Could not issue the endorsement letter/i)).toBeTruthy();
  });

  it('re-downloads the issued letter when the case already has a referral', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          { id: 'r1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' },
        ]);
      }
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve(null);
    });
    const user = userEvent.setup();
    renderStep();

    const btn = await screen.findByRole('button', { name: /Endorsement Letter/i });
    await user.click(btn);

    await waitFor(() => expect(mockDownloadLetterById).toHaveBeenCalledWith('r1'));
    expect(mockDownloadLetter).not.toHaveBeenCalled();
  });

  it('is inert in readOnly mode', async () => {
    renderStep([], { readOnly: true });

    await screen.findByText(/Inter-Agency Referrals/i);
    expect(screen.queryByRole('button', { name: /Add Referral/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /No Referrals issued/i })).toBeNull();
  });
});

describe('StepIntegratedDelivery — sealing step 3', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockDownloadLetter.mockReset();
    mockDownloadLetterById.mockReset();
    mockApiPatch.mockResolvedValue({});
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve(null);
    });
  });

  it('disables Lock while neither a referral nor the no-referral decision exists', async () => {
    renderStep();

    // The step's own state has to be on screen first, or the disabled button
    // would be asserting nothing about the predicate.
    expect(await screen.findByText(/Inter-Agency Referrals/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  // The defect this pins: a worker issued the endorsement letter, the row landed
  // in `inter_agency_referrals`, and step 3 still reported not-done forever —
  // because the predicate read `case.referrals` (`case_referrals`), a table with
  // 0 rows, while this step lists its referrals from its own SWR. A `case_referrals`
  // row is deliberately asserted to *not* count on the other side of this test, in
  // `CaseStepper.done.test.ts` and the shared fixture.
  it('enables Lock once the case carries an inter-agency referral', async () => {
    renderStep([], { caseDataOverrides: { interAgencyReferralCount: 1 } });

    // Wait for the step to render: the button is disabled on first paint and
    // enabled after, so asserting synchronously would pass on the wrong value.
    await waitFor(() => expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled());
  });

  /**
   * The seal and the server must count the same rows.
   *
   * The seal endpoint counts every `inter_agency_referrals` row for the case,
   * while this step's list is caller-scoped by agency. A second unlinked worker
   * therefore saw an empty list, could never seal step 2, and the workflow
   * stalled — even though the server would have accepted the seal. The count the
   * seal weighs is a case-level fact and travels on the case row, so the scoped
   * list can stay scoped for display.
   */
  it('enables Lock on the case-level count even when the scoped list is empty', async () => {
    renderStep([], { caseDataOverrides: { interAgencyReferralCount: 1 } });

    expect(await screen.findByText(/Inter-Agency Referrals/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled());
  });

  it('leaves Lock disabled when only a case_referrals row exists', async () => {
    // `caseData.referrals` is the transition plan's agency list. It is not an
    // inter-agency referral and must not satisfy the step that issues one.
    renderStep([], { caseDataOverrides: { referrals: [{ agencyName: 'RHU', status: 'referred' }] } });

    expect(await screen.findByText(/Inter-Agency Referrals/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
  });

  // The other half of the live defect: a referral on record also hid this step's
  // own "no referrals issued" action, so a worker whose referral had not landed
  // in the table the predicate read had no route out at all. With the predicate
  // reading the same list the action's visibility is keyed on, the two cannot
  // disagree.
  it('leaves the no-referral escape hatch reachable when no referral exists', async () => {
    renderStep();

    expect(await screen.findByRole('button', { name: /Add Referral/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /No Referrals issued/i })).toBeTruthy();
    // …and the step it unlocks is the same one the seal is now offered on.
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
  });

  it('enables Lock on the case row\'s own no-referral decision, without the page restating it', async () => {
    renderStep([], { referralNotNeeded: true });

    expect(await screen.findByText(/No referral needed/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepIndex: 2, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep([], { referralNotNeeded: true, stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', async () => {
    renderStep([], { readOnly: true, lockReadOnly: true });

    expect(await screen.findByText(/Inter-Agency Referrals/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepIndex: 2, lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderStep([], { referralNotNeeded: true, readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});
