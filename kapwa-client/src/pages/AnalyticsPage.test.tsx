import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AnalyticsPage } from './AnalyticsPage';

const { mockApiGet, mockUseAuth } = vi.hoisted(() => ({ mockApiGet: vi.fn(), mockUseAuth: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
  downloadAnalyticsCsv: vi.fn(),
}));
vi.mock('../lib/auth-context', () => ({ useAuth: (...a: unknown[]) => mockUseAuth(...a) }));

function renderPage() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/analytics']}><AnalyticsPage /></MemoryRouter>
    </SWRConfig>,
  );
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' }, loading: false });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('clustering') && k.includes('runs')) {
        if (k.includes('members')) return Promise.resolve({ rows: [], total: 0 });
        if (k.includes('"runs"')) return Promise.resolve([]);
        return Promise.resolve({ run: { id: 'r1', status: 'completed', params: {}, metrics: {}, createdAt: '2026-09-25T00:00:00Z' }, clusters: [] });
      }
      if (k.includes('concentration')) {
        return Promise.resolve({ hhiCases: 0.2, hhiCasesLabel: 'moderate', hhiAssistance: 0.3, hhiAssistanceLabel: 'concentrated', totalCases: 0, totalAmount: 0, barangays: [] });
      }
      if (k.includes('equity')) {
        return Promise.resolve({ barangays: [] });
      }
      if (k.includes('inequality')) {
        return Promise.resolve({ gini: 0.4, top10Share: 0.3, count: 25, lorenz: [], deciles: [] });
      }
      if (k.includes('forecast')) {
        return Promise.resolve({ metric: 'cases', months: 24, history: [], fitted: [], forecast: [], mape: null, baselineMape: null, alpha: 0.5, beta: 0.3 });
      }
      if (k.includes('associations')) {
        return Promise.resolve({ totalTransactions: 0, rules: [] });
      }
      return Promise.resolve({
        summary: { personsServed: { suppressed: true }, householdsCovered: { suppressed: true }, barangaysCovered: { suppressed: true } },
        ageSex: [], civilStatus: [], occupation: [], incomeBands: [], householdSize: [], dependencyRatio: null, philhealthCoverage: { suppressed: true },
      });
    });
  });

  it('renders the shell with all seven tabs', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Analytics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Demographics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Clustering/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Concentration/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Equity/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Inequality/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Forecast/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Associations/i })).toBeTruthy();
  });

  it('renders each tab panel', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Analytics/i })).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Demographics/i }), { button: 0 });
    expect((await screen.findAllByText(/Age and sex/i)).length).toBeGreaterThanOrEqual(1);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Clustering/i }), { button: 0 });
    expect(await screen.findByText(/New clustering run/i)).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Concentration/i }), { button: 0 });
    expect(await screen.findByText(/Case concentration \(HHI\)/i)).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Equity/i }), { button: 0 });
    expect(await screen.findByText(/Ratios compare each barangay/i)).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Inequality/i }), { button: 0 });
    expect((await screen.findAllByText(/Gini coefficient/i)).length).toBeGreaterThanOrEqual(1);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Forecast/i }), { button: 0 });
    expect(await screen.findByText(/Model MAPE/i)).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Associations/i }), { button: 0 });
    expect(await screen.findByText(/Min support/i)).toBeTruthy();
  });
});
