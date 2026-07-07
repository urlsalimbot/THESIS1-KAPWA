import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { MayorReportsPage } from './MayorReportsPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('MayorReportsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('reports') || k.includes('mayor')) {
        return Promise.resolve({
          totalCases: 100,
          uniqueHouseholds: 80,
          fundUtilization: 50000,
          servedToday: 5,
          caseStatusDistribution: [],
          slaCompliance: { slaStatus: 'compliant' },
        });
      }
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<MayorReportsPage />);
    expect(await screen.findByRole('heading', { name: /Reports|Mayor/i })).toBeTruthy();
  });
});
