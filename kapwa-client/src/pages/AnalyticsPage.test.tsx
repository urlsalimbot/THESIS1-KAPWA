import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AnalyticsPage } from './AnalyticsPage';

const { mockApiGet, mockUseAuth } = vi.hoisted(() => ({ mockApiGet: vi.fn(), mockUseAuth: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
  downloadAnalyticsCsv: vi.fn(),
}));
vi.mock('../lib/auth-context', () => ({ useAuth: (...a: unknown[]) => mockUseAuth(...a) }));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' }, loading: false });
    mockApiGet.mockResolvedValue({ barangays: [], summary: {}, ageSex: [], civilStatus: [], occupation: [], incomeBands: [], householdSize: [] });
  });

  it('renders the shell with all four tabs', async () => {
    render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <MemoryRouter initialEntries={['/analytics']}><AnalyticsPage /></MemoryRouter>
      </SWRConfig>,
    );
    expect(await screen.findByRole('heading', { name: /Analytics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Demographics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Clustering/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Concentration/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Equity/i })).toBeTruthy();
  });
});
