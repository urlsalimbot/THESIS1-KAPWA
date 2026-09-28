import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage() {
  return render(
    <MemoryRouter>
      <CoordinatorReferralListPage />
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

    // Two em dashes: this column, and the Referred By column beside it, which
    // has no coordinator on this record either.
    expect((await screen.findAllByText('—')).length).toBeGreaterThanOrEqual(1);
  });

  it('names the resident in the detail dialog too', async () => {
    renderPage();
    (await screen.findByLabelText('View')).click();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Dela Cruz, Juan')).toBeInTheDocument();
    expect(within(dialog).getByText(/Referral information for Dela Cruz, Juan/)).toBeInTheDocument();
  });

  it('does not print a bare comma in the detail dialog either', async () => {
    // The dialog built the same label by hand as the table did, so it carried
    // the same empty-surname bug — in two places, the Name field and the
    // description above it.
    mockApiGet.mockResolvedValue([referral({ surname: '' })]);
    renderPage();
    (await screen.findByLabelText('View')).click();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(', Juan')).not.toBeInTheDocument();
    expect(within(dialog).getAllByText('Juan').length).toBeGreaterThanOrEqual(1);
    // Not "Referral information for , Juan".
    expect(within(dialog).getByText(/Referral information for/)).toHaveTextContent(
      'Referral information for Juan',
    );
  });
});
