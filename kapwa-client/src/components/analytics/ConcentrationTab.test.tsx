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
      hhiCases: 0.31, hhiAssistance: 0.4, totalCases: 120, totalAmount: 50000,
      barangays: [
        { barangay: 'Poblacion', cases: { value: 60 }, interventions: { value: 90 }, amount: { value: 30000 }, caseShare: { value: 0.5 }, amountShare: { value: 0.6 } },
        { barangay: 'Bigte', cases: { suppressed: true }, interventions: { suppressed: true }, amount: { suppressed: true }, caseShare: { suppressed: true }, amountShare: { suppressed: true } },
      ],
    });
  });

  it('renders HHI cards and suppressed rows', async () => {
    renderTab();
    expect(await screen.findByText(/0\.31/)).toBeTruthy();
    expect(screen.getByText('Poblacion')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
