import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyReferralsPage } from './AgencyReferralsPage';

const { mockApiGet, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: (...args: unknown[]) => mockApiPatch(...args), put: vi.fn(), del: vi.fn() },
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
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
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
});
