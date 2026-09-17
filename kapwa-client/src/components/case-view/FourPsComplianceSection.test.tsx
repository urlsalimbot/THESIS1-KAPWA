import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { FourPsComplianceSection, isFourPsCase } from './FourPsComplianceSection';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
}));

function renderSection() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <FourPsComplianceSection caseId="C-1" />
    </SWRConfig>,
  );
}

describe('FourPsComplianceSection', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockApiGet.mockResolvedValue({
      total: 2,
      complied: 1,
      rate: 0.5,
      byType: { fds: { total: 2, complied: 1, rate: 0.5 } },
      entries: [
        { id: 'e1', complianceType: 'fds', dueDate: '2026-10-01', monthLabel: 'Oct 2026', met: true },
        { id: 'e2', complianceType: 'school_attendance', dueDate: '2026-10-01', monthLabel: 'Oct 2026', met: false },
      ],
    });
    mockApiPatch.mockResolvedValue({ met: true });
    mockApiPost.mockResolvedValue({ generated: 12 });
  });

  it('renders the summary and entries', async () => {
    renderSection();
    expect(await screen.findByText('1/2 complied · 50% rate')).toBeInTheDocument();
    expect(screen.getByText('Family Development Session')).toBeInTheDocument();
    expect(screen.getByText('School Attendance')).toBeInTheDocument();
  });

  it('marks a pending item as complied', async () => {
    renderSection();
    await screen.findByText('School Attendance');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as complied' }));
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/fourps/compliance/e2/meet'));
  });

  it('generates 12-month items', async () => {
    renderSection();
    await screen.findByText('1/2 complied · 50% rate');
    fireEvent.click(screen.getByRole('button', { name: /Generate 12-Month Items/ }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/fourps/C-1/generate-compliance'));
  });

  it('detects 4Ps cases from service requests and category', () => {
    expect(isFourPsCase({ serviceRequested: ['4Ps — Pantawid Pamilyang Pilipino Program'] })).toBe(true);
    expect(isFourPsCase({ clientCategory: '4Ps' })).toBe(true);
    expect(isFourPsCase({ serviceRequested: ['Financial Assistance'] })).toBe(false);
    expect(isFourPsCase(null)).toBe(false);
  });
});
