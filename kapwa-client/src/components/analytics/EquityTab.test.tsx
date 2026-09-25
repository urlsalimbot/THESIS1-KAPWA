import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { EquityTab } from './EquityTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <EquityTab filters={{}} />
    </SWRConfig>,
  );
}

describe('EquityTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      barangays: [
        { barangay: 'Poblacion', householdsShare: { value: 0.4 }, servedShare: { value: 0.8 }, assistanceShare: { value: 0.7 }, coverageRatio: { value: 2 }, coverageQuartile: { value: 4 }, fourPsShare: { value: 0.3 } },
        { barangay: 'Bigte', householdsShare: { suppressed: true }, servedShare: { suppressed: true }, assistanceShare: { suppressed: true }, coverageRatio: { suppressed: true }, coverageQuartile: { suppressed: true }, fourPsShare: { suppressed: true } },
      ],
    });
  });

  it('renders the equity table with quartiles and suppressed cells', async () => {
    renderTab();
    expect(await screen.findByText('Poblacion')).toBeTruthy();
    expect(screen.getByText(/Coverage quartile/i)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6);
  });

  it('renders the methodology note', async () => {
    renderTab();
    expect(await screen.findByText(/How this is computed/i)).toBeTruthy();
    expect(screen.getByText(/zero-served|no served households/i)).toBeTruthy();
  });

  it('renders the insufficient-data message with counts for a 422 response', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), {
      body: { code: 'insufficient_data', required: 3, actual: 2 },
    }));
    renderTab();
    expect(await screen.findByText(/Not enough data \(needs 3, found 2\)/)).toBeTruthy();
  });

  it('renders the no-data message for other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('nope'));
    renderTab();
    expect(await screen.findByText(/No data for the selected filters/i)).toBeTruthy();
  });
});
