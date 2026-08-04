import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { ClaimantAccessCardPage } from './ClaimantAccessCardPage';

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

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<ClaimantAccessCardPage />);
    await screen.findByRole('heading', { name: 'My Access Card' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
