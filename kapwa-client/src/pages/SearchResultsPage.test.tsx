import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { SearchResultsPage } from './SearchResultsPage';

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

function renderWithSWR(q: string) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={[`/search?q=${encodeURIComponent(q)}`]}>
        <SearchResultsPage />
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('SearchResultsPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders results from the paginated { data, total } response', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'BEN-001',
          firstName: 'Pedro',
          surname: 'Reyes',
          address: 'Purok 2, Bigte',
          dob: '1990-05-01',
          gender: 'Male',
          category: 'Senior',
        },
      ],
      total: 1,
    });

    renderWithSWR('pedro');

    // The name is the card's heading; the matched part of it is marked up, so
    // the accessible name is asserted rather than a single text node.
    expect(await screen.findByRole('heading', { name: 'Pedro Reyes' })).toBeTruthy();
    expect(screen.getByText('Bigte')).toBeTruthy();
    // identifying fields, not just the name
    expect(screen.getByText(/May 0?1, 1990/)).toBeTruthy();
    // no card has been issued for this record, so no shortcut to one
    expect(screen.queryByRole('link', { name: /view access card/i })).toBeNull();
  });

  it('reads the barangay from the household and shows the identifiers', async () => {
    // The list endpoint nests the person and household and carries no `address`
    // (the person's address was normalised out), so the household is the only
    // source of the barangay — the old card rendered an empty one.
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'BEN-002',
          firstName: 'Ana',
          middleName: 'Lontok',
          surname: 'Fernandez',
          dob: '1985-02-11',
          gender: 'Female',
          accessCardCode: 'NORZ-AC-2026-0002',
          interventionCount: 5,
          lastInterventionDate: '2026-06-02',
          household: { barangay: 'Minuyan', familyMemberCount: 4, nhtsPrId: 'NHTS-0001' },
        },
      ],
      total: 1,
    });

    renderWithSWR('ana');

    expect(await screen.findByRole('heading', { name: 'Ana L. Fernandez' })).toBeTruthy();
    expect(screen.getByText('Minuyan')).toBeTruthy();
    expect(screen.getByText('NORZ-AC-2026-0002')).toBeTruthy();
    expect(screen.getByText('NHTS-0001')).toBeTruthy();
    // the intervention history the list now enriches each row with
    expect(screen.getByText(/5 interventions/)).toBeTruthy();
    expect(screen.getByText(/Jun 2, 2026/)).toBeTruthy();
    // and the access card, for the record that has one
    expect(screen.getByRole('link', { name: /view access card/i }).getAttribute('href')).toBe(
      '/beneficiary/BEN-002/access-card',
    );
  });

  it('shows the empty state when the response has no rows', async () => {
    mockApiGet.mockResolvedValue({ data: [], total: 0 });

    renderWithSWR('pedro');

    expect(await screen.findByText(/No results found/i)).toBeTruthy();
  });
});
