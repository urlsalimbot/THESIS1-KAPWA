import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import ClientDedupPage from './ClientDedupPage';

const { mockApiGet, mockApiPost, mockApiUpload, mockDownload } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiUpload: vi.fn(),
  mockDownload: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    del: vi.fn(),
    patch: vi.fn(),
    upload: (...args: unknown[]) => mockApiUpload(...args),
  },
  downloadClientDedupOutput: (...args: unknown[]) => mockDownload(...args),
}));

// The review of an operation lives at /client-dedup/:operationId — the page
// reads the param, so tests render it inside BOTH routes the app defines.
function renderPage(initialPath = '/client-dedup') {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/client-dedup" element={<ClientDedupPage />} />
          <Route path="/client-dedup/:id" element={<ClientDedupPage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

const OPERATIONS_RESPONSE = {
  data: [
    {
      id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing', interventionType: 'food_pack',
      createdAt: '2026-10-01T00:00:00Z', pending: 1, noMatch: 1, disqualified: 1, decided: 0, totalRows: 2,
    },
    {
      id: 'op2', source: 'Batch 0.xlsx', status: 'finalized',
      createdAt: '2026-09-20T00:00:00Z', pending: 0, noMatch: 0, decided: 5, totalRows: 5,
    },
  ],
  total: 2, page: 1, limit: 10,
};

const ROW_NO_MATCH = {
  id: 'r1', rowIndex: 1, lastName: 'Mata', firstName: 'Clara', dob: '1991-04-12',
  barangay: 'Bigte', status: 'no_match', eligibility: 'allowed', remarks: 'AICS',
};
const ROW_ALLOWED = {
  id: 'r2', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.',
  dob: '1988-03-21', barangay: 'Bigte', status: 'retained', eligibility: 'allowed',
};
const ROW_DISQUALIFIED = {
  ...ROW_ALLOWED,
  status: 'deprioritized',
  eligibility: 'disqualified',
  eligibilityReason: 'Received food_pack on 2026-09-25 — within the last 30 days',
  remarks: 'AICS | Deprioritized — Received food_pack on 2026-09-25 — within the last 30 days',
};

const ROWS_ALLOWED = { data: [ROW_NO_MATCH, ROW_ALLOWED], total: 2, page: 1, limit: 10 };
const ROWS_DISQ = { data: [ROW_NO_MATCH, ROW_DISQUALIFIED], total: 2, page: 1, limit: 10 };
const ROWS_CONFIRMED = {
  data: [ROW_NO_MATCH, { ...ROW_DISQUALIFIED, eligibilityDecision: 'confirm' }],
  total: 2, page: 1, limit: 10,
};

const MATCH_EVIDENCE = {
  data: [
    {
      id: 'm1', targetType: 'db_person', score: 0.91, status: 'primary', signals: {},
      person: { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
      interventions: 0, cases: [],
    },
  ],
  total: 1, page: 1, limit: 20,
};

let rowsCall: number;
let pendingCount: number;
let disqualifiedCount: number;
let rowsAfter: Record<string, unknown>;

describe('ClientDedupPage', () => {
  beforeEach(async () => {
    rowsCall = 0;
    pendingCount = 1;
    disqualifiedCount = 1;
    rowsAfter = ROWS_ALLOWED;
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiUpload.mockReset();
    mockDownload.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('/rows') && k.includes('/matches')) return Promise.resolve(MATCH_EVIDENCE);
      if (k.includes('/rows')) {
        rowsCall += 1;
        return Promise.resolve(rowsCall === 1 ? ROWS_DISQ : rowsAfter);
      }
      if (k.includes('/client-dedup/operations/op1')) {
        return Promise.resolve({
          id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing', interventionType: 'food_pack',
          pending: pendingCount, disqualified: disqualifiedCount, totalRows: 2,
        });
      }
      if (k.includes('/client-dedup/operations')) return Promise.resolve(OPERATIONS_RESPONSE);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the operations list with source, status and pending count', async () => {
    renderPage();
    expect(await screen.findByText('Batch 1.xlsx')).toBeTruthy();
    expect(screen.getByText(/reviewing/i)).toBeTruthy();
    expect(screen.getByText(/1 pending/i)).toBeTruthy();
    expect(screen.getByText(/2 rows/i)).toBeTruthy();
    expect(screen.getByText('Batch 0.xlsx')).toBeTruthy();
    expect(screen.getByText(/finalized/i)).toBeTruthy();
  });

  it('opens the row-definition wizard with the six baseline columns pre-filled', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    expect(screen.getByDisplayValue('Last Name')).toBeTruthy();
    expect(screen.getByDisplayValue('First Name')).toBeTruthy();
    expect(screen.getByDisplayValue('Middle Name')).toBeTruthy();
    expect(screen.getByDisplayValue('Birthday')).toBeTruthy();
    expect(screen.getByDisplayValue('Barangay')).toBeTruthy();
    expect(screen.getByDisplayValue('Remarks')).toBeTruthy();
    expect(screen.getByLabelText(/intervention type/i)).toBeTruthy();
  });

  it('declares extra fields beyond the baseline six', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    expect(screen.queryByPlaceholderText(/field name/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /declare extra field/i }));
    expect(screen.getByPlaceholderText(/field name/i)).toBeTruthy();
  });

  it('creates the operation with its intervention type, uploads the file, and enters review', async () => {
    mockApiPost.mockResolvedValue({ id: 'op9' });
    mockApiUpload.mockResolvedValue({ id: 'op9', status: 'reviewing' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    await userEvent.type(screen.getByLabelText(/list name/i), 'Batch 2.xlsx');

    // Pick the intervention type from the dropdown.
    await userEvent.click(screen.getByLabelText(/intervention type/i));
    await userEvent.click(await screen.findByText('Food pack'));

    const file = new File(['Last Name,First Name\n'], 'batch2.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/client list file/i), { target: { files: [file] } });

    await userEvent.click(screen.getByRole('button', { name: /create & upload/i }));

    expect(mockApiPost).toHaveBeenCalledWith(
      '/client-dedup/operations',
      expect.objectContaining({
        source: 'Batch 2.xlsx',
        interventionType: 'food_pack',
        columnMap: expect.objectContaining({
          baseline: expect.objectContaining({ lastName: 'Last Name', birthDate: 'Birthday' }),
        }),
      }),
    );
    expect(mockApiUpload).toHaveBeenCalledWith(
      '/client-dedup/operations/op9/upload',
      expect.any(FormData),
    );
    expect(await screen.findByTestId('review-view')).toBeTruthy();
  });

  async function openReview() {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
    return screen.findByTestId('review-view');
  }

  it('shows the disqualification chip for undecided rows and keeps no-match rows closed', async () => {
    await openReview();
    expect(await screen.findByText('No match')).toBeTruthy();
    expect(await screen.findByText(/Disqualified — review needed/i)).toBeTruthy();

    const expandButtons = screen.getAllByRole('button', { name: /review matches/i });
    expect(expandButtons).toHaveLength(1);

    await userEvent.click(expandButtons[0]);
    expect(await screen.findByText('Matched')).toBeTruthy();
    expect(screen.getByText(/91%/)).toBeTruthy();
    expect((await screen.findAllByText(/within the last 30 days/)).length).toBeGreaterThan(0);
  });

  it('waives a disqualified row and it moves into service', async () => {
    mockApiPost.mockResolvedValue({});
    await openReview();
    await userEvent.click(await screen.findByRole('button', { name: /review matches/i }));

    await userEvent.click(await screen.findByRole('button', { name: /waive — serve anyway/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/client-dedup/operations/op1/rows/r2/eligibility', {
        decision: 'waive',
      }),
    );
    expect(await screen.findByText(/^Retained$/i)).toBeTruthy();
  });

  it('decides a single disqualified match and the row stays blocked while others pend', async () => {
    mockApiPost.mockResolvedValue({});
    const pendingMatches = {
      data: [
        {
          id: 'm1', targetType: 'db_person', score: 0.91, status: 'pending', signals: {},
          person: { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
          interventions: 0, cases: [],
        },
      ],
      total: 1, page: 1, limit: 20,
    };
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('/rows') && k.includes('/matches')) return Promise.resolve(pendingMatches);
      if (k.includes('/rows')) return Promise.resolve(ROWS_DISQ);
      if (k.includes('/client-dedup/operations/op1')) {
        return Promise.resolve({ id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing', pending: 0, disqualified: 1, totalRows: 2 });
      }
      if (k.includes('/client-dedup/operations')) return Promise.resolve(OPERATIONS_RESPONSE);
      return Promise.resolve(null);
    });
    await openReview();
    await userEvent.click(await screen.findByRole('button', { name: /review matches/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^waive$/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/client-dedup/operations/op1/rows/r2/eligibility', {
        decision: 'waive',
        matchId: 'm1',
      }),
    );
    // A second match is still pending — after closing the dialog the row is
    // still undecided and the finalize bar stays blocked.
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/0 pending 1 disqualified/)).toBeTruthy();
  });

  it('confirms a disqualification and the row stays deprioritized', async () => {
    mockApiPost.mockResolvedValue({});
    rowsAfter = ROWS_CONFIRMED;
    await openReview();
    const chipRow = await screen.findByText(/Disqualified — review needed/i);
    const rowCell = chipRow.closest('tr');
    await userEvent.click(within(rowCell as HTMLElement).getByRole('button', { name: /review matches/i }));

    await userEvent.click(await screen.findByRole('button', { name: /confirm disqualified/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/client-dedup/operations/op1/rows/r2/eligibility', {
        decision: 'confirm',
      }),
    );
    expect(await screen.findByText(/^Deprioritized$/i)).toBeTruthy();
  });

  it('shows the finalize bar blocking while disqualified rows await a decision', async () => {
    await openReview();
    expect(await screen.findByText(/1 pending 1 disqualified/i)).toBeTruthy();
    const finalizeBtn = screen.getByRole('button', { name: /finalize & save priority list/i }) as HTMLButtonElement;
    expect(finalizeBtn.disabled).toBe(true);
    expect(finalizeBtn.getAttribute('title')).toMatch(/disqualified row/);
  });

  it('confirms, finalizes, shows the save summary and downloads the priority list', async () => {
    pendingCount = 0;
    disqualifiedCount = 0;
    mockApiPost.mockImplementation((path: string) =>
      path.endsWith('/finalize')
        ? Promise.resolve({ created: 1, updated: 0, deprioritized: 1, barangayUpdates: 0 })
        : Promise.resolve({}),
    );
    mockDownload.mockResolvedValue(undefined);

    await openReview();
    await userEvent.click(await screen.findByRole('button', { name: /finalize & save priority list/i }));
    expect(await screen.findByText(/finalize this import\?/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^finalize$/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/client-dedup/operations/op1/finalize', {}),
    );
    expect(await screen.findByTestId('output-view')).toBeTruthy();
    expect(screen.getByTestId('stat-created').textContent).toContain('1');
    expect(screen.getByTestId('stat-deprioritized').textContent).toContain('1');

    await userEvent.click(screen.getByRole('button', { name: /download priority list/i }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('op1'));
  });
});

