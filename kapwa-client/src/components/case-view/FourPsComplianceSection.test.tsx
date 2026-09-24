import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    <MemoryRouter>
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <FourPsComplianceSection caseId="C-1" />
      </SWRConfig>
    </MemoryRouter>,
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

  it('renders the summary, condition breakdown and entries', async () => {
    renderSection();
    expect(await screen.findByText('1/2 complied · 50% rate')).toBeInTheDocument();
    // The condition label appears both in the per-condition tile and on the item.
    expect(screen.getAllByText('Family Development Session').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('School Attendance')).toBeInTheDocument();
  });

  it('groups items into compliance periods with a per-period bulk action', async () => {
    renderSection();
    expect(await screen.findByText('Oct 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all complied' }));
    // Only the unmet item is marked; the already-complied one is left alone.
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/fourps/compliance/e2/meet'));
    expect(mockApiPatch).not.toHaveBeenCalledWith('/fourps/compliance/e1/meet');
  });

  it('flags a member with two consecutive missed periods as a delisting risk', async () => {
    mockApiGet.mockResolvedValue({
      total: 2,
      complied: 0,
      rate: 0,
      byType: { fds: { total: 2, complied: 0, rate: 0 } },
      entries: [
        { id: 'a1', complianceType: 'fds', dueDate: '2026-09-01', monthLabel: 'Sep 2026', met: false, householdMemberId: 'p1', memberName: 'Ernesto Magbanua' },
        { id: 'a2', complianceType: 'fds', dueDate: '2026-10-01', monthLabel: 'Oct 2026', met: false, householdMemberId: 'p1', memberName: 'Ernesto Magbanua' },
      ],
    });
    renderSection();
    expect(await screen.findByText('Delisting risk')).toBeInTheDocument();
    // The member is named in the banner and on each of their period items.
    expect(screen.getAllByText('Ernesto Magbanua').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2 consecutive periods missed')).toBeInTheDocument();
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

  it('surfaces generate failures', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('boom'));
    renderSection();
    await screen.findByText('1/2 complied · 50% rate');
    fireEvent.click(screen.getByRole('button', { name: /Generate 12-Month Items/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Action failed. Please try again.');
  });

  it('surfaces mark failures', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('boom'));
    renderSection();
    await screen.findByText('School Attendance');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as complied' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Action failed. Please try again.');
  });

  it('detects 4Ps cases from service requests and category', () => {
    expect(isFourPsCase({ serviceRequested: ['4Ps — Pantawid Pamilyang Pilipino Program'] })).toBe(true);
    expect(isFourPsCase({ clientCategory: '4Ps' })).toBe(true);
    expect(isFourPsCase({ serviceRequested: ['Financial Assistance'] })).toBe(false);
    expect(isFourPsCase(null)).toBe(false);
  });
});
