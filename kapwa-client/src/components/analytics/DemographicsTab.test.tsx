import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { DemographicsTab, toPyramidRows } from './DemographicsTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <DemographicsTab filters={{}} />
    </SWRConfig>,
  );
}

describe('DemographicsTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      summary: { personsServed: { value: 120 }, householdsCovered: { value: 40 }, barangaysCovered: { value: 7 } },
      ageSex: [{ bracket: '0-5', male: { value: 12 }, female: { suppressed: true } }],
      civilStatus: [{ label: 'Married', count: { value: 60 } }, { label: 'Widowed', count: { suppressed: true } }],
      occupation: [{ label: 'Farmer', count: { value: 30 } }],
      incomeBands: [{ label: '<5k', count: { value: 20 } }],
      householdSize: [{ label: '1', count: { value: 10 } }, { label: '8+', count: { suppressed: true } }],
      dependencyRatio: 0.8,
      philhealthCoverage: { value: 0.55 },
    });
  });

  it('renders summary cards and suppressed cells as hidden', async () => {
    renderTab();
    expect(await screen.findByText('120')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('Suppressed (<5)').length).toBeGreaterThanOrEqual(1);
  });

  it('maps suppressed pyramid cells to null instead of fabricating zero', () => {
    const rows = toPyramidRows([
      { bracket: '0-5', male: { value: 12 }, female: { suppressed: true } },
      { bracket: '60+', male: { suppressed: true }, female: { value: 9 } },
    ]);
    expect(rows).toEqual([
      { bracket: '0-5', male: 12, female: null },
      { bracket: '60+', male: null, female: 9 },
    ]);
  });

  it('renders the no-data state on error', async () => {
    mockApiGet.mockRejectedValue(new Error('nope'));
    renderTab();
    expect(await screen.findByText(/No data for the selected filters/i)).toBeTruthy();
  });
});
