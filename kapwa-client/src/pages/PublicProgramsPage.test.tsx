import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { PublicProgramsPage } from './PublicProgramsPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}));

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter><PublicProgramsPage /></MemoryRouter>
    </SWRConfig>,
  );
}

describe('PublicProgramsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it('renders active programs with fund sources', async () => {
    mockApiGet.mockResolvedValue([
      { id: 'p1', name: 'AICS', category: 'Financial Assistance', waitingPeriodDays: 5, fundSources: ['LGU'], legalBasis: 'RA 11165' },
    ]);
    renderPage();
    expect(await screen.findByText('AICS')).toBeTruthy();
    expect(screen.getByText('LGU')).toBeTruthy();
    expect(screen.getByText(/Waiting period: 5 days/)).toBeTruthy();
  });

  it('lists every required document per program', async () => {
    mockApiGet.mockResolvedValue([
      {
        id: 'p1', name: 'Medical Assistance', category: 'Health',
        waitingPeriodDays: 15, fundSources: ['LGU'],
        requiredDocuments: ['Barangay Certificate of Indigency', 'Valid ID', 'Medical Abstract'],
      },
      {
        id: 'p2', name: 'Burial Assistance', category: 'Burial',
        requiredDocuments: ['Death Certificate'],
      },
      { id: 'p3', name: 'No Docs Program', category: 'Other' },
    ]);
    renderPage();
    expect(await screen.findByText('Medical Assistance')).toBeTruthy();
    expect(screen.getByText('Barangay Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('Medical Abstract')).toBeTruthy();
    expect(screen.getByText('Burial Assistance')).toBeTruthy();
    expect(screen.getByText('Death Certificate')).toBeTruthy();
    expect(screen.getAllByText(/Required Documents/).length).toBe(2);
  });

  it('shows empty state when no programs', async () => {
    mockApiGet.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No programs are currently listed.')).toBeTruthy();
  });
});