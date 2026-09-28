import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { AssociationsTab } from './AssociationsTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <AssociationsTab filters={{}} />
    </SWRConfig>,
  );
}

describe('AssociationsTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      totalTransactions: 40,
      rules: [
        { a: 'Food', b: 'Medical', countA: { value: 35 }, countB: { value: 40 }, countBoth: { value: 35 }, support: { value: 0.875 }, confidence: { value: 1 }, lift: { value: 1.14 } },
        { a: 'Food', b: 'Transport', countA: { value: 35 }, countB: { suppressed: true }, countBoth: { suppressed: true }, support: { suppressed: true }, confidence: { suppressed: true }, lift: { suppressed: true } },
      ],
    });
  });

  it('renders rules and suppressed cells', async () => {
    renderTab();
    expect((await screen.findAllByText('Food')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Medical').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByTitle('Suppressed (<5)').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the top-rules footnote', async () => {
    renderTab();
    expect(await screen.findByText(/Shows the top 20 rules by lift/i)).toBeTruthy();
  });

  it('renders the insufficient-data state', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), { body: { code: 'insufficient_data', required: 30, actual: 3 } }));
    renderTab();
    expect(await screen.findByText(/Not enough data/i)).toBeTruthy();
  });
});
