import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ForecastTab } from './ForecastTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ForecastTab filters={{}} />
    </SWRConfig>,
  );
}

const RESPONSE = {
  metric: 'cases', months: 24,
  history: [{ month: '2026-07', value: 10 }, { month: '2026-08', value: 12 }],
  fitted: [{ month: '2026-07', value: 9 }, { month: '2026-08', value: 11 }],
  forecast: [
    { month: '2026-09', value: 13, lower: 10, upper: 16 },
    { month: '2026-10', value: 14, lower: 9, upper: 19 },
  ],
  mape: 0.08, baselineMape: 0.15, alpha: 0.3, beta: 0.1,
};

describe('ForecastTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(RESPONSE);
  });

  it('renders MAPE and baseline cards', async () => {
    renderTab();
    expect(await screen.findByText('8.0%')).toBeTruthy();
    expect(screen.getByText('15.0%')).toBeTruthy();
  });

  it('refetches when the metric changes', async () => {
    renderTab();
    await screen.findByText('8.0%');
    fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'disbursement' } });
    await waitFor(() => {
      const called = mockApiGet.mock.calls.some(args => JSON.stringify(args[0]).includes('disbursement'));
      expect(called).toBe(true);
    });
  });
});
