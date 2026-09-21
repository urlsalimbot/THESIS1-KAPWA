import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { axe } from 'vitest-axe';
import { AgencyReferralDetailPage } from './AgencyReferralDetailPage';

const { mockApiGet, mockApiPatch, mockNavigate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

// Keep MemoryRouter/Routes/Route real, but capture navigation.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
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
  // Flat identity surface (the API's name schema) carries the middle name ...
  surname: 'Santos',
  firstName: 'Maria',
  middleName: 'Reyes',
  gender: 'Female',
  dob: '1990-05-15',
  // ... while the deprecated `person` relation does not. Assertions below prove
  // the component reads the flat fields.
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
    mockApiPatch.mockReset();
    mockNavigate.mockReset();
    mockApiGet.mockResolvedValue(referral);
    mockApiPatch.mockResolvedValue({ ...referral, status: 'received' });
  });

  it('renders referral details with the full name schema', async () => {
    renderPage();
    // Middle name present: the previous `firstName + surname` dropped it.
    expect(await screen.findByRole('heading', { name: 'Maria Reyes Santos' })).toBeTruthy();
    expect(screen.getByText(/Medical follow-up/)).toBeTruthy();
    expect(screen.getByText(/Rural Health Unit/)).toBeTruthy();
    expect(screen.getByText(/public_authority_sec13/)).toBeTruthy();
  });

  it('shows receive/decline actions for the receiving agency on referred status', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Receive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('hands off to a pre-filled intake when MSWDO receives', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Receive' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const [path, opts] = mockNavigate.mock.calls[0];
    expect(path).toBe('/intake');
    expect(opts.state.sourceReferral).toEqual({
      type: 'inter_agency',
      id: 'r1',
      reason: 'Medical follow-up',
    });
    expect(opts.state.prefill.firstName).toBe('Maria');
    expect(opts.state.prefill.middleName).toBe('Reyes');
  });

  it('does not redirect when an external agency receives', async () => {
    mockApiGet.mockResolvedValue({
      ...referral,
      toAgency: { id: 'ag-2', code: 'RHU', name: 'Rural Health Unit' },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Receive' }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows not-found state on error', async () => {
    mockApiGet.mockRejectedValue(new Error('404'));
    renderPage();
    expect(await screen.findByText(/Referral not found/)).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Maria Reyes Santos' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
