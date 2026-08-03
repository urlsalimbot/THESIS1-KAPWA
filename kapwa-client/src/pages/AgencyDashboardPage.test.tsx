import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { AgencyDashboardPage } from './AgencyDashboardPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
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

describe('AgencyDashboardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agency-portal')) {
        return Promise.resolve({
          agency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray', type: 'health' },
          counts: { total: 5, sent: 2, received: 3, byStatus: { referred: 2, received: 1, actioned: 0, closed: 1, declined: 1 } },
          recent: [
            {
              id: 'r1', personId: 'p1', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
              status: 'referred', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13',
              createdAt: '2026-08-01T00:00:00.000Z',
              fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
              toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
              person: { id: 'p1', firstName: 'Juan', surname: 'Santos' },
            },
          ],
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders agency name and stat cards', async () => {
    renderWithSWR(<AgencyDashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Rural Health Unit - Norzagaray' })).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('renders recent referrals with status', async () => {
    renderWithSWR(<AgencyDashboardPage />);
    expect(await screen.findByText('Medical follow-up')).toBeTruthy();
    expect(screen.getByText('Referred')).toBeTruthy();
  });

  it('renders an error message when the dashboard fetch fails', async () => {
    mockApiGet.mockReset();
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<AgencyDashboardPage />);
    expect(await screen.findByText('Failed to load dashboard')).toBeTruthy();
  });
});
