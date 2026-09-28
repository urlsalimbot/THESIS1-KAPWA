import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { CoordinatorAccessCardsPage } from './CoordinatorAccessCardsPage';

const { mockApiGet, mockApiPost, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

const AGENCIES = [{ id: 'ag-1', code: 'MSWDO', name: 'MSWDO Norzagaray' }];

function service(n: number) {
  return {
    id: `s${n}`,
    accessCardCode: 'NORZ-AC-2026-0001',
    serviceDate: '2026-09-01',
    serviceRendered: `Service ${n}`,
    category: 'community_service',
    sourceBarangay: 'Bigte',
  };
}

function renderPage() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <MemoryRouter initialEntries={['/coordinator/access-cards']}>
        <CoordinatorAccessCardsPage />
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe('CoordinatorAccessCardsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'coordinator', assignedBarangay: 'Bigte' },
      loading: false,
    });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve({ data: [], total: 0 });
    });
  });

  it('states the barangay scope the server enforces', () => {
    renderPage();
    expect(
      screen.getByText(/Showing access cards for Bigte only/i),
    ).toBeInTheDocument();
  });

  it('omits the scope notice when the coordinator has no assignment', () => {
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'coordinator' }, loading: false });
    renderPage();
    expect(screen.queryByText(/Showing access cards for/i)).not.toBeInTheDocument();
  });

  it('exposes the three panels as real tabs', async () => {
    const user = userEvent.setup();
    renderPage();
    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map(t => t.textContent?.trim())).toEqual(['Verify', 'Assign', 'History']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tablist).getByRole('tab', { name: /History/i }));
    await waitFor(() =>
      expect(within(tablist).getByRole('tab', { name: /History/i })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  // Regression: rowCount was the page length, so pageCount pinned to 1 and page 2
  // was unreachable even though the API reported more rows.
  it('paginates on the server total, not the length of the current page', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve({ data: [service(1), service(2)], total: 57 });
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /History/i }));

    await waitFor(() => expect(screen.getByText('Service 1')).toBeInTheDocument());
    // 57 rows at 10/page is 6 pages. A page-length rowCount would render
    // "Page 1 of 2 (1–2 of 2 total)" and make page 2 unreachable.
    expect(screen.getByText(/Page 1 of 6 \(1–10 of 57 total\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/go to next page/i)).toBeInTheDocument();
  });

  it('reports a load failure instead of rendering a silently empty table', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.reject(new Error('boom'));
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /History/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i));
  });

  it('surfaces a failed beneficiary lookup instead of showing a nameless card', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      if (k.includes('/card')) return Promise.reject(new Error('no beneficiary'));
      return Promise.resolve([service(1), service(2)]);
    });

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/enter card code/i), 'NORZ-AC-2026-0001');
    await user.click(screen.getByRole('button', { name: /^Verify$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/beneficiary record could not be loaded/i),
    );
    // The card itself still resolved, so its history is shown.
    expect(screen.getByText('Service 1')).toBeInTheDocument();
  });

  it('reports an unknown card code', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.reject(new Error('not found'));
    });

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/enter card code/i), 'NOPE-1');
    await user.click(screen.getByRole('button', { name: /^Verify$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/access card not found/i),
    );
  });

  it('confirms a logged activity and keeps the verified card on screen', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      if (k.includes('/card')) {
        return Promise.resolve({ beneficiary: { surname: 'Reyes', first_name: 'Pedro' } });
      }
      return Promise.resolve([service(1)]);
    });
    mockApiPost.mockResolvedValue({ id: 's9' });

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/enter card code/i), 'NORZ-AC-2026-0001');
    await user.click(screen.getByRole('button', { name: /^Verify$/i }));
    await waitFor(() => expect(screen.getByText('Reyes, Pedro')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/agency/i), 'ag-1');
    await user.type(screen.getByLabelText(/remarks/i), 'Pantry pack distributed');
    await user.click(screen.getByRole('button', { name: /log activity/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/activity logged/i));
    // The card stays verified so the coordinator can see the row they wrote.
    expect(screen.getByText('Reyes, Pedro')).toBeInTheDocument();
  });

  it('reports a failed log instead of silently clearing the form', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      if (k.includes('/card')) {
        return Promise.resolve({ beneficiary: { surname: 'Reyes', first_name: 'Pedro' } });
      }
      return Promise.resolve([service(1)]);
    });
    mockApiPost.mockRejectedValue(new Error('nope'));

    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/enter card code/i), 'NORZ-AC-2026-0001');
    await user.click(screen.getByRole('button', { name: /^Verify$/i }));
    await waitFor(() => expect(screen.getByText('Reyes, Pedro')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/agency/i), 'ag-1');
    await user.type(screen.getByLabelText(/remarks/i), 'Pantry pack');
    await user.click(screen.getByRole('button', { name: /log activity/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to log/i));
    expect(screen.getByLabelText(/remarks/i)).toHaveValue('Pantry pack');
  });

  it('reports a failed beneficiary search and does not claim there are no results', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.reject(new Error('boom'));
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Assign/i }));
    await user.type(screen.getByLabelText(/search by name/i), 'Reyes');
    await user.click(screen.getByRole('button', { name: /^Search$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/search failed/i));
    expect(screen.queryByText(/no beneficiaries matched/i)).not.toBeInTheDocument();
  });

  it('distinguishes an empty search result from a failed one', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      return Promise.resolve({ data: [], total: 0 });
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Assign/i }));
    await user.type(screen.getByLabelText(/search by name/i), 'Nobody');
    await user.click(screen.getByRole('button', { name: /^Search$/i }));

    await waitFor(() => expect(screen.getByText(/no beneficiaries matched/i)).toBeInTheDocument());
  });

  it('updates the row in place after assigning a card', async () => {
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('agencies')) return Promise.resolve(AGENCIES);
      if (k.includes('beneficiaries')) {
        return Promise.resolve([{ id: 'b1', surname: 'Reyes', first_name: 'Pedro', access_card_code: null }]);
      }
      return Promise.resolve({ data: [], total: 0 });
    });
    mockApiPost.mockResolvedValue({ accessCardCode: 'NORZ-AC-2026-0009' });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Assign/i }));
    await user.type(screen.getByLabelText(/search by name/i), 'Reyes');
    await user.click(screen.getByRole('button', { name: /^Search$/i }));

    await waitFor(() => expect(screen.getByText('Reyes, Pedro')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /assign card/i }));

    await waitFor(() => expect(screen.getByText('NORZ-AC-2026-0009')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /has card/i })).toBeDisabled();
  });
});
