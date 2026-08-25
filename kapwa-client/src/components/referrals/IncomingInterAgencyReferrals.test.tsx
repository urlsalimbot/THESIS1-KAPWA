import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { IncomingInterAgencyReferrals } from './IncomingInterAgencyReferrals';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'social_worker', agencyId: 'ag-mswdo' } }),
}));

const inbox = [
  {
    id: 'r1', personId: 'p1', fromAgencyId: 'ag-rhu', toAgencyId: 'ag-mswdo',
    status: 'referred', reason: 'Medical follow-up', legalBasisCode: 'public_authority_sec13',
    createdAt: '2026-08-01T00:00:00.000Z',
    fromAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
    toAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
    person: { id: 'p1', firstName: 'Maria', surname: 'Santos' },
  },
  {
    id: 'r2', personId: 'p2', fromAgencyId: 'ag-mswdo', toAgencyId: 'ag-rhu',
    status: 'actioned', reason: 'Physical therapy', legalBasisCode: 'public_authority_sec13',
    createdAt: '2026-08-01T00:00:00.000Z',
    fromAgency: { id: 'ag-mswdo', code: 'MSWDO', name: 'Municipal Social Welfare' },
    toAgency: { id: 'ag-rhu', code: 'RHU', name: 'Rural Health Unit - Norzagaray' },
    person: { id: 'p2', firstName: 'Juan', surname: 'Dela Cruz' },
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/referrals']}>
        <Routes>
          <Route path="/referrals" element={ui} />
          <Route path="/agency/referrals/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('IncomingInterAgencyReferrals', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) {
        return Promise.resolve(inbox);
      }
      return Promise.resolve(null);
    });
  });

  it('renders only incoming referrals (same toAgencyId as caller agency)', async () => {
    renderWithSWR(<IncomingInterAgencyReferrals />);
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
    expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
  });

  it('shows the empty state when there are no incoming referrals', async () => {
    mockApiGet.mockResolvedValue([]);
    renderWithSWR(<IncomingInterAgencyReferrals />);
    expect(await screen.findByText('No incoming inter-agency referrals')).toBeTruthy();
  });

  it('navigates to /agency/referrals/:id when a row is clicked', async () => {
    const user = userEvent.setup();
    renderWithSWR(<IncomingInterAgencyReferrals />);
    const row = await screen.findByRole('button', { name: /View details for Maria Santos/ });
    await user.click(row);
    expect(await screen.findByTestId('location')).toHaveTextContent('/agency/referrals/r1');
  });
});
