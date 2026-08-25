import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { axe } from 'vitest-axe';
import { AgencyReferralDetailPage } from './AgencyReferralDetailPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { role: 'agency_staff', agencyId: 'ag-2' } }),
}));

const referral = {
  id: 'r1',
  personId: 'p1',
  fromAgencyId: 'ag-1',
  toAgencyId: 'ag-2',
  status: 'referred',
  reason: 'Medical follow-up',
  notes: 'Bring records',
  legalBasisCode: 'public_authority_sec13',
  person: { id: 'p1', surname: 'Santos', firstName: 'Maria' },
  fromAgency: { id: 'ag-1', code: 'RHU', name: 'Rural Health Unit' },
  toAgency: { id: 'ag-2', code: 'MSWDO', name: 'MSWDO Norzagaray' },
  createdAt: '2026-08-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/agency/referrals/r1']}>
        <Routes>
          <Route path="/agency/referrals/:id" element={<AgencyReferralDetailPage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('AgencyReferralDetailPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(referral);
  });

  it('renders referral details', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Maria Santos' })).toBeTruthy();
    expect(screen.getByText(/Medical follow-up/)).toBeTruthy();
    expect(screen.getByText(/Rural Health Unit/)).toBeTruthy();
    expect(screen.getByText(/public_authority_sec13/)).toBeTruthy();
  });

  it('shows receive/decline actions for the receiving agency on referred status', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Receive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('shows not-found state on error', async () => {
    mockApiGet.mockRejectedValue(new Error('404'));
    renderPage();
    expect(await screen.findByText(/Referral not found/)).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Maria Santos' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});