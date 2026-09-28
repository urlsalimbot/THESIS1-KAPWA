import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { InequalityTab } from './InequalityTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <InequalityTab filters={{}} />
    </SWRConfig>,
  );
}

describe('InequalityTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      gini: 0.42, top10Share: 0.31, count: 120, excludedMissing: 3,
      lorenz: [{ p: 0, share: 0 }, { p: 0.5, share: 0.2 }, { p: 1, share: 1 }],
      deciles: [2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    });
  });

  it('renders Gini, top-10 share, and deciles', async () => {
    renderTab();
    expect(await screen.findByText('0.420')).toBeTruthy();
    expect(screen.getByText(/31/)).toBeTruthy();
    expect(screen.getByText('₱10,000')).toBeTruthy();
    expect(screen.getByText('Excluded (missing income): 3')).toBeTruthy();
  });

  it('renders the insufficient-data state', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), { body: { code: 'insufficient_data', required: 20, actual: 4 } }));
    renderTab();
    expect(await screen.findByText(/Not enough data/i)).toBeTruthy();
  });
});
