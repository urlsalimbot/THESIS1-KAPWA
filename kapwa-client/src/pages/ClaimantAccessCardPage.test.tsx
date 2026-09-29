import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { ClaimantAccessCardPage } from './ClaimantAccessCardPage';
import { ApiError } from '../lib/api-error';

const mockApiGet = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

// jsdom lacks canvas — axe probes canvas for icon ligatures when inspecting
// the rendered card, so stub getContext for the a11y run.
HTMLCanvasElement.prototype.getContext = (() => ({
  measureText: () => ({ width: 0 }),
  getImageData: () => ({ data: [] }),
})) as any;

describe('ClaimantAccessCardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    localStorage.setItem('kapwa_token', 'test-token');
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('access-card')) {
        return Promise.resolve({
          code: 'NORZ-AC-2026-0042',
          beneficiary: { name: 'Juan Dela Cruz', barangay: 'Poblacion' },
          services: [],
          remainingSlots: 18,
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the access card code', async () => {
    renderWithSWR(<ClaimantAccessCardPage />);
    expect(await screen.findByText(/NORZ-AC-2026-0042/)).toBeTruthy();
  });

  it('renders the page heading', async () => {
    renderWithSWR(<ClaimantAccessCardPage />);
    expect(await screen.findByRole('heading', { name: 'My Access Card' })).toBeTruthy();
  });

  it('shows empty state when no services', async () => {
    renderWithSWR(<ClaimantAccessCardPage />);
    expect(await screen.findByText(/No services recorded yet/)).toBeTruthy();
  });

  it('shows each service in words, with a readable date and its category', async () => {
    // This row used to print the raw ISO date and nothing else — no category at
    // all — so a claimant saw "2026-07-20" where the office sees "Jul 20, 2026".
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('access-card')) {
        return Promise.resolve({
          code: 'NORZ-AC-2026-0042',
          beneficiary: { name: 'Juan Dela Cruz', barangay: 'Poblacion' },
          services: [
            {
              serviceRendered: 'Medical Consultation',
              serviceDate: '2026-07-20',
              cost: 1500,
              category: 'community_service',
            },
          ],
          remainingSlots: 17,
        });
      }
      return Promise.resolve(null);
    });

    renderWithSWR(<ClaimantAccessCardPage />);
    await screen.findByText('Medical Consultation');

    expect(screen.getByText('Jul 20, 2026')).toBeTruthy();
    expect(screen.queryByText('2026-07-20')).toBeNull();
    expect(screen.getByText('Community Service')).toBeTruthy();
    expect(screen.queryByText('community_service')).toBeNull();
    expect(screen.getByText('₱1,500')).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<ClaimantAccessCardPage />);
    await screen.findByRole('heading', { name: 'My Access Card' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders a friendly empty state when no card is on record ({ card: null })', async () => {
    // A beneficiary without an access card gets 200 `{ card: null }` from
    // /beneficiaries/me/access-card. That is "you have no card yet", not a
    // broken page — no SWR error path, just the empty state.
    mockApiGet.mockResolvedValue({ card: null });

    renderWithSWR(<ClaimantAccessCardPage />);

    expect(await screen.findByText(/You don't have an access card yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Visit the MSWDO office to get one/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to My Dashboard/i })).toHaveAttribute('href', '/my-dashboard');
    expect(screen.queryByText(/Could not load your access card/i)).not.toBeInTheDocument();
  });

  it('keeps the load-failure error for genuine failures', async () => {
    // 500s and network errors are real problems and must still surface as such.
    mockApiGet.mockRejectedValue(new ApiError(500, { message: 'boom' }));

    renderWithSWR(<ClaimantAccessCardPage />);

    expect(await screen.findByText(/Could not load your access card/i)).toBeInTheDocument();
    expect(screen.queryByText(/You don't have an access card yet/i)).not.toBeInTheDocument();
  });
});
