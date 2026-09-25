import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ConcentrationTab } from './ConcentrationTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ConcentrationTab filters={{}} />
    </SWRConfig>,
  );
}

describe('ConcentrationTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      hhiCases: 0.31,
      hhiCasesLabel: 'concentrated',
      hhiAssistance: 0.2,
      hhiAssistanceLabel: 'moderate',
      totalCases: 120, totalAmount: 50000,
      barangays: [
        { barangay: 'Poblacion', cases: { value: 60 }, interventions: { value: 90 }, amount: { value: 30000 }, caseShare: { value: 0.5 }, amountShare: { value: 0.6 } },
        { barangay: 'Bigte', cases: { suppressed: true }, interventions: { suppressed: true }, amount: { suppressed: true }, caseShare: { suppressed: true }, amountShare: { suppressed: true } },
      ],
    });
  });

  it('renders HHI cards with dispersion labels and suppressed rows', async () => {
    renderTab();
    expect(await screen.findByText(/0\.31/)).toBeTruthy();
    expect(screen.getByText('concentrated')).toBeTruthy();
    expect(screen.getByText('moderate')).toBeTruthy();
    expect(screen.getByText('Poblacion')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a dash and no label when the HHI is null (one or more suppressed cells)', async () => {
    mockApiGet.mockResolvedValue({
      hhiCases: null,
      hhiCasesLabel: null,
      hhiAssistance: null,
      hhiAssistanceLabel: null,
      totalCases: 6, totalAmount: 6000,
      barangays: [
        { barangay: 'Bigte', cases: { value: 6 }, interventions: { value: 10 }, amount: { value: 6000 }, caseShare: { value: 1 }, amountShare: { value: 1 } },
      ],
    });
    renderTab();
    expect(await screen.findByText('Bigte')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('dispersed')).toBeNull();
    expect(screen.queryByText('moderate')).toBeNull();
    expect(screen.queryByText('concentrated')).toBeNull();
  });

  it('renders the methodology note', async () => {
    renderTab();
    expect(await screen.findByText(/How this is computed/i)).toBeTruthy();
    expect(screen.getByText(/sum of squared shares/i)).toBeTruthy();
  });

  it('renders the insufficient-data message with counts for a 422 response', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), {
      body: { code: 'insufficient_data', required: 3, actual: 1 },
    }));
    renderTab();
    expect(await screen.findByText(/Not enough data \(needs 3, found 1\)/)).toBeTruthy();
  });

  it('renders the no-data message for other errors', async () => {
    mockApiGet.mockRejectedValue(new Error('nope'));
    renderTab();
    expect(await screen.findByText(/No data for the selected filters/i)).toBeTruthy();
  });
});
