import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { StepIntegratedDelivery } from './StepIntegratedDelivery';

const { mockApiGet, mockDownloadLetter, mockDownloadLetterById } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockDownloadLetter: vi.fn(),
  mockDownloadLetterById: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
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

function renderStep(referrals: unknown[] = [], opts: { readOnly?: boolean; role?: string } = {}) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <Toaster />
      <StepIntegratedDelivery
        caseId="case-1"
        caseData={{ beneficiary: { id: 'b1', firstName: 'Juan', surname: 'Dela Cruz' }, status: 'assessed' }}
        userRole={opts.role ?? 'social_worker'}
        readOnly={opts.readOnly}
      />
    </SWRConfig>,
  );
}

describe('StepIntegratedDelivery — endorsement letter only', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockDownloadLetter.mockReset();
    mockDownloadLetterById.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) return Promise.resolve([]);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve(null);
    });
  });

  it('renders only the Issue Endorsement Letter button — no referral creation, no decision controls', async () => {
    renderStep();

    expect(await screen.findByRole('button', { name: /Issue Endorsement Letter/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create Referral/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark referral not needed/i })).toBeNull();
    expect(screen.queryByText(/Referral decision/i)).toBeNull();
    // Exactly one button.
    expect(screen.getAllByRole('button', { name: /Endorsement Letter/i })).toHaveLength(1);
  });

  it('issues the letter from the dialog and downloads it', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(await screen.findByRole('button', { name: /Issue Endorsement Letter/i }));

    await user.selectOptions(await screen.findByLabelText(/Target Agency/i), 'ag-rhu');
    await user.type(screen.getByLabelText(/Reason/i), 'Medical coordination');
    await user.click(screen.getByRole('button', { name: /Issue/i }));

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

    await user.click(await screen.findByRole('button', { name: /Issue Endorsement Letter/i }));
    await user.selectOptions(await screen.findByLabelText(/Target Agency/i), 'ag-rhu');
    await user.type(screen.getByLabelText(/Reason/i), 'Medical coordination');
    await user.click(screen.getByRole('button', { name: /Issue/i }));

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

    // One button, now a re-download rather than a request to create.
    const btn = await screen.findByRole('button', { name: /Endorsement Letter/i });
    expect(screen.queryByText(/Create Referral/i)).toBeNull();
    await user.click(btn);

    await waitFor(() => expect(mockDownloadLetterById).toHaveBeenCalledWith('r1'));
    expect(mockDownloadLetter).not.toHaveBeenCalled();
  });

  it('is inert in readOnly mode', async () => {
    renderStep([], { readOnly: true });

    await screen.findByText(/Inter-Agency Referrals/i);
    expect(screen.queryByRole('button', { name: /Endorsement Letter/i })).toBeNull();
  });
});