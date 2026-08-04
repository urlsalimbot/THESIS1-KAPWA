import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
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

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem('kapwa_token');
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<MayorReportsPage />);
    expect(await screen.findByRole('heading', { name: /Reports|Mayor/i })).toBeTruthy();
  });

  it('renders an Export Fund Utilization button', async () => {
    renderWithSWR(<MayorReportsPage />);
    expect(await screen.findByRole('button', { name: /Export Fund Utilization/i })).toBeTruthy();
  });

  it('triggers a download for /export/monthly-funds with the current month', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('kapwa_token', 'test-token');

    renderWithSWR(<MayorReportsPage />);
    const button = await screen.findByRole('button', { name: /Export Fund Utilization/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/export/monthly-funds?month=${month}`),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
      );
    });
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<MayorReportsPage />);
    await screen.findByRole('heading', { name: /Reports|Mayor/i });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
