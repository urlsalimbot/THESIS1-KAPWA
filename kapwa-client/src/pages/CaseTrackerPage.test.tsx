import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { CaseTrackerPage } from './CaseTrackerPage';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

const mockEntries = [
  {
    id: 'TRK-001',
    dailySeqNum: 1,
    transactionDate: '2026-06-30',
    surname: 'Dela Cruz',
    firstName: 'Juan',
    middleName: 'M',
    gender: 'M',
    ageRange: '60-70',
    clientCategory: 'Senior',
    barangay: 'Barangay 1',
    interventionRemarks: 'FA',
  },
];

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../lib/constants', () => ({
  BARANGAYS: ['Barangay 1', 'Barangay 2'],
  AGE_RANGES: ['0-17', '18-59', '60+'],
  CLIENT_CATEGORIES: ['Senior', 'PWD', 'Child'],
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('CaseTrackerPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('stats')) return Promise.resolve({ totalCasesLogged: 10, todayEntries: 3 });
      if (k.includes('daily')) return Promise.resolve(mockEntries);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<CaseTrackerPage />);
    expect(await screen.findByRole('heading', { name: 'Daily Case Tracker' })).toBeTruthy();
  });

  it('renders stats after loading', async () => {
    renderWithSWR(<CaseTrackerPage />);
    expect(await screen.findByText('Total Cases Logged', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders date inputs', async () => {
    renderWithSWR(<CaseTrackerPage />);
    expect(await screen.findByLabelText('Date from')).toBeTruthy();
    expect(await screen.findByLabelText('Date to')).toBeTruthy();
  });

  it('api.get is called with tracker.daily or tracker.range and tracker.stats on mount', async () => {
    renderWithSWR(<CaseTrackerPage />);
    await screen.findByText('Total Cases Logged', {}, { timeout: 3000 });
    const allCalls = mockApiGet.mock.calls.map(c => JSON.stringify(c[0]));
    const hasTracker = allCalls.some(c => c.includes('tracker') && (c.includes('daily') || c.includes('range')));
    expect(hasTracker).toBe(true);
    expect(allCalls.some(c => c.includes('tracker') && c.includes('stats'))).toBe(true);
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<CaseTrackerPage />);
    await screen.findByRole('heading', { name: 'Daily Case Tracker' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
