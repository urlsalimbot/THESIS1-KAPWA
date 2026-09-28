import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CoordinatorReferralDetailPage } from './CoordinatorReferralDetailPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'coordinator' }, loading: false }),
}));

const referral = {
  id: 'r1',
  surname: 'Dela Cruz',
  firstName: 'Juan',
  barangay: 'Bigte',
  reason: 'Medical follow-up',
  status: 'pending',
  createdAt: '2026-08-01T00:00:00.000Z',
  addressLine: '123 Mabini St, Poblacion',
  coordinator: { fullName: 'Ana Reyes' },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/coordinator/referrals/r1']}>
      <Routes>
        <Route path="/coordinator/referrals/:id" element={<CoordinatorReferralDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoordinatorReferralDetailPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(referral);
  });

  it("renders the referral's person, barangay, address, reason, and status", async () => {
    renderPage();

    expect(await screen.findByText('Dela Cruz, Juan')).toBeInTheDocument();
    expect(screen.getByText('Bigte')).toBeInTheDocument();
    expect(screen.getByText('123 Mabini St, Poblacion')).toBeInTheDocument();
    expect(screen.getByText('Medical follow-up')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows the referral chain (coordinator to MSWDO) and the date', async () => {
    renderPage();

    expect(await screen.findByText(/Ana Reyes/)).toBeInTheDocument();
    expect(screen.getByText(/MSWDO Norzagaray/)).toBeInTheDocument();
    expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
  });

  it('shows the decline reason when the referral was declined', async () => {
    mockApiGet.mockResolvedValue({ ...referral, status: 'declined', declineReason: 'Needs additional documents' });
    renderPage();

    expect(await screen.findByText('Needs additional documents')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('shows the linked case control number when one exists', async () => {
    mockApiGet.mockResolvedValue({ ...referral, case: { controlNo: 'NORZ-2026-0101' } });
    renderPage();

    expect(await screen.findByText('NORZ-2026-0101')).toBeInTheDocument();
  });

  it('renders a not-found state when the referral cannot be loaded', async () => {
    mockApiGet.mockRejectedValue(new Error('not found'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/may have been removed or you do not have access/i)).toBeInTheDocument();
    });
  });
});