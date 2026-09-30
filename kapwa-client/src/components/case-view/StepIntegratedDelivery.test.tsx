import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { StepIntegratedDelivery } from './StepIntegratedDelivery';

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
  opts: { readOnly?: boolean; role?: string; referralNotNeeded?: boolean } = {},
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
        }}
        userRole={opts.role ?? 'social_worker'}
        readOnly={opts.readOnly}
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