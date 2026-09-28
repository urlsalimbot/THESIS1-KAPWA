import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CoordinatorReferralListPage } from './CoordinatorReferralListPage';

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

const referral = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  surname: 'Dela Cruz',
  firstName: 'Juan',
  barangay: 'Bigte',
  reason: 'Medical follow-up',
  status: 'pending',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/coordinator/referrals']}>
      <Routes>
        <Route path="/coordinator/referrals" element={<CoordinatorReferralListPage />} />
        <Route path="/coordinator/referrals/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoordinatorReferralListPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue([referral()]);
  });

  it('names a resident surname first', async () => {
    renderPage();

    expect(await screen.findByText('Dela Cruz, Juan')).toBeInTheDocument();
  });

  it('does not print a comma with nothing in front of it', async () => {
    // The server assembles the name parts from the joined person with a `?? ''`
    // fallback, so an empty surname reaches this table as a real value. Building
    // the label inline rendered ", Juan".
    mockApiGet.mockResolvedValue([referral({ surname: '' })]);

    renderPage();

    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(screen.queryByText(', Juan')).not.toBeInTheDocument();
  });

  it('shows an em dash for a referral with no name at all', async () => {
    mockApiGet.mockResolvedValue([referral({ surname: '', firstName: '' })]);

    renderPage();

    // The name column falls back to an em dash for a fully unnamed referral.
    expect((await screen.findAllByText('—')).length).toBeGreaterThanOrEqual(1);
  });

  it('opens the referral detail route when View is clicked', async () => {
    renderPage();
    (await screen.findByLabelText('View')).click();

    // The View button navigates to the coordinator detail route rather than
    // leaving the row inert — the route then fetches and renders the referral.
    expect(await screen.findByTestId('location')).toHaveTextContent('/coordinator/referrals/r1');
  });

  it('navigates to the detail of the row that was clicked', async () => {
    mockApiGet.mockResolvedValue([referral({ id: 'r1' }), referral({ id: 'r2', firstName: 'Ana' })]);
    renderPage();
    await screen.findByText('Dela Cruz, Juan');

    // Both rows have a View action; the second row must open its own detail.
    const viewButtons = screen.getAllByLabelText('View');
    viewButtons[1].click();
    expect(await screen.findByTestId('location')).toHaveTextContent('/coordinator/referrals/r2');
  });
});
