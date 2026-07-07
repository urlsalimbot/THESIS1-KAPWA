import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { ClaimantDashboardPage } from './ClaimantDashboardPage';

const { mockApiGet, mockApiPost, mockApiPut } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
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

describe('ClaimantDashboardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    localStorage.setItem('kapwa_token', 'test-token');
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('services')) return Promise.resolve({ services: [], caseStatus: 'No active case' });
      if (k.includes('consent')) return Promise.resolve([]);
      if (k.includes('preferences')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<ClaimantDashboardPage />);
    expect(await screen.findByRole('heading', { name: 'My Dashboard' })).toBeTruthy();
  });

  it('renders Access Card section', async () => {
    renderWithSWR(<ClaimantDashboardPage />);
    expect(await screen.findByText('View your KAPWA Access Card')).toBeTruthy();
  });

  it('renders View Card link', async () => {
    renderWithSWR(<ClaimantDashboardPage />);
    expect(await screen.findByRole('link', { name: 'View Card' })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<ClaimantDashboardPage />);
    await screen.findByRole('heading', { name: 'My Dashboard' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
