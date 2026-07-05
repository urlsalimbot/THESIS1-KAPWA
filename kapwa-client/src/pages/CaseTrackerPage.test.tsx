import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaseTrackerPage } from './CaseTrackerPage';

// Mock fetch since this page uses raw fetch() calls (not API module)
const { mockEntries } = vi.hoisted(() => ({
  mockEntries: [
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
  ],
}));

vi.mock('../lib/constants', () => ({
  BARANGAYS: ['Barangay 1', 'Barangay 2'],
  AGE_RANGES: ['0-17', '18-59', '60+'],
  CLIENT_CATEGORIES: ['Senior', 'PWD', 'Child'],
}));

describe('CaseTrackerPage', () => {
  beforeEach(() => {
    // Mock fetch to return entries and stats
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEntries),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalCasesLogged: 10, todayEntries: 3 }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders PageShell heading', async () => {
    render(<MemoryRouter><CaseTrackerPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Daily Case Tracker' })).toBeTruthy();
  });

  it('renders stats after loading', async () => {
    render(<MemoryRouter><CaseTrackerPage /></MemoryRouter>);
    expect(await screen.findByText('Total Cases Logged', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders date input', async () => {
    render(<MemoryRouter><CaseTrackerPage /></MemoryRouter>);
    expect(await screen.findByLabelText('Tracker Date')).toBeTruthy();
  });
});
