import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyReferralsPage } from './AgencyReferralsPage';

const { mockApiGet, mockApiPatch, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: (...args: unknown[]) => mockApiPost(...args), patch: (...args: unknown[]) => mockApiPatch(...args), put: vi.fn(), del: vi.fn() },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'agency_staff', agencyId: 'ag-rhu' } }),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyReferralsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPatch.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('beneficiary-search')) {
        return Promise.resolve([
          { id: 'b1', fullName: 'Juan Santos', controlNo: 'KAPWA-C-1', barangay: 'Bigte' },
        ]);
      }
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve([
          {
            id: 'r1', personId: 'p1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
            status: 'referred', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
            toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            person: { id: 'p1', firstName: 'Juan', surname: 'Santos' },
          },
          {
            id: 'r2', personId: 'p2', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
            status: 'actioned', reason: 'Physical therapy', legalBasisCode: 'public_authority_sec13',
            createdAt: '2026-08-01T00:00:00.000Z',
            fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
            toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
            person: { id: 'p2', firstName: 'Ana', surname: 'Dizon' },
          },
        ]);
      }
      if (k.includes('agencies')) {
        return Promise.resolve([
          { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
          { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
        ]);
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders referral card and receive action for receiving agency', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyReferralsPage />);
    expect(await screen.findByText('Juan Santos')).toBeTruthy();
    const receiveButton = await screen.findByRole('button', { name: 'Receive' });
    await user.click(receiveButton);
    expect(mockApiPatch).toHaveBeenCalledWith('/inter-agency-referrals/r1/receive', undefined);
  });

  it('create flow: searches scoped beneficiaries, selects one, and posts a referral', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyReferralsPage />);

    await user.selectOptions(await screen.findByLabelText('To Agency *'), 'MSWDO — Municipal Social Welfare');

    await user.type(screen.getByPlaceholderText('Search beneficiary by name...'), 'juan');
    const resultButton = await screen.findByRole('button', { name: /Juan Santos/ }, { timeout: 3000 });
    await user.click(resultButton);

    await user.type(await screen.findByLabelText('Reason *'), 'Medical follow-up');
    await user.click(screen.getByRole('button', { name: 'Create Referral' }));

    await vi.waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/inter-agency-referrals',
        expect.objectContaining({
          beneficiaryId: 'b1',
          toAgencyId: 'ag-mswdo',
          reason: 'Medical follow-up',
        }),
      );
    });
  });

  it('close flow: actioned referral is closed with an outcome via PATCH', async () => {
    const user = userEvent.setup();
    renderWithSWR(<AgencyReferralsPage />);

    expect(await screen.findByText('Physical therapy')).toBeTruthy();
    const closeButton = await screen.findByRole('button', { name: 'Close' });
    expect(closeButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Outcome'), 'Completed');
    expect(closeButton).not.toBeDisabled();
    await user.click(closeButton);

    await vi.waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/inter-agency-referrals/r2/close', {
        outcome: 'Completed',
      });
    });
  });

  it('renders ErrorState with a retry button when referrals fail to load', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<AgencyReferralsPage />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load referrals')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('refetches when Try again is clicked after a load failure', async () => {
    const user = userEvent.setup();
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<AgencyReferralsPage />);
    await screen.findByRole('alert');
    mockApiGet.mockResolvedValue([]);
    const callsBefore = mockApiGet.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
