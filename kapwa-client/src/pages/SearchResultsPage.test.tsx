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

    expect(await screen.findByText('Pedro Reyes')).toBeTruthy();
    expect(screen.getByText('Bigte')).toBeTruthy();
  });

  it('shows the empty state when the response has no rows', async () => {
    mockApiGet.mockResolvedValue({ data: [], total: 0 });

    renderWithSWR('pedro');

    expect(await screen.findByText(/No results found/i)).toBeTruthy();
  });
});
