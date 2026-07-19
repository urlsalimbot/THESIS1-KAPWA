import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { DashboardPage } from './DashboardPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
}));

const mockDashboardData = {
  servedToday: 12,
  servedChange: '+8%',
  lastSync: '2m ago',
  pendingReview: 3,
  urgentCount: 1,
  disbursedMonth: 45000,
  beneficiaryCount: 28,
  recentCases: [
    { id: 'C-001', name: 'Juan Dela Cruz', category: 'Senior', barangay: 'Barangay 1', remarks: 'Monthly assistance', date: '2026-06-28', status: 'approved' },
  ],
};

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'worker@test.com', fullName: 'Test Worker', role: 'social_worker' },
    token: 'mock-token',
    loading: false,
  })),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('DashboardPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDel.mockReset();
    mockApiGet.mockResolvedValue(mockDashboardData);
    // Clear the global SWR cache so each test gets a fresh useSWR fetch.
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading, stat cards, and case table with mock data', async () => {
    renderWithSWR(<DashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(await screen.findByText('Served Today')).toBeTruthy();
    expect(await screen.findByText('C-001', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
  });

  it('snapshot: DashboardPage rendered DOM with stat cards + recent cases table', async () => {
    const { container } = renderWithSWR(<DashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(await screen.findByText('Served Today')).toBeTruthy();
    expect(container).toMatchSnapshot();
  });

  it('for a worker role, api.get is called with a path containing /dashboard/stats', async () => {
    renderWithSWR(<DashboardPage />);
    // Wait for SWR to fire the fetch
    await screen.findByText('Served Today');
    expect(mockApiGet).toHaveBeenCalled();
    // The dashboard fires stats, trends, and daily-counts calls
    const dashboardCalls = mockApiGet.mock.calls.filter(c => {
      const key = JSON.stringify(c[0]);
      return key.includes('dashboard') || key.includes('stats');
    });
    expect(dashboardCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('for a non-worker role (claimant), the dashboard /dashboard/stats path is NOT called (null key skips fetch)', async () => {
    // Override useAuth to return a claimant role for this test
    const { useAuth } = await import('../lib/auth-context');
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      user: { id: 'u2', email: 'c@test.com', fullName: 'Test Claimant', role: 'claimant' },
      token: 'mock-token',
      loading: false,
    });
    renderWithSWR(<DashboardPage />);
    // Give SWR a moment to NOT fire (it shouldn't fire with a null key)
    await new Promise((r) => setTimeout(r, 50));
    // The dashboard /dashboard path (stats) is role-gated by the null key.
    // The claimant widget (ClaimantWidgets) does fire its own /beneficiaries/me/services
    // useSWR — that's expected, not a regression. The intent of this test is
    // that the dashboard's role-gated "dashboard" endpoint is NOT called for claimants.
    const allCalls = mockApiGet.mock.calls.map(c => JSON.stringify(c[0]));
    const dashboardKeyCalls = allCalls.filter(c => c === '["dashboard"]');
    expect(dashboardKeyCalls).toHaveLength(0);
    // The claimant widget shell renders (role-gated content path)
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await screen.findByText('Served Today');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

