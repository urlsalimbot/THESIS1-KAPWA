import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

const OPERATIONS_RESPONSE = {
  data: [
    {
      id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing',
      createdAt: '2026-10-01T00:00:00Z', pending: 1, noMatch: 1, decided: 0, totalRows: 2,
    },
    {
      id: 'op2', source: 'Batch 0.xlsx', status: 'finalized',
      createdAt: '2026-09-20T00:00:00Z', pending: 0, noMatch: 0, decided: 5, totalRows: 5,
    },
  ],
  total: 2, page: 1, limit: 10,
};

const ROW_NO_MATCH = {
  id: 'r1', rowIndex: 1, lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21',
  barangay: 'Bigte', status: 'no_match', remarks: 'AICS',
};
const ROW_PENDING = {
  id: 'r2', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.',
  dob: '1988-03-21', barangay: 'Bigte', status: 'pending',
};

const ROWS_PENDING = { data: [ROW_NO_MATCH, ROW_PENDING], total: 2, page: 1, limit: 10 };
const ROWS_DECIDED = {
  data: [
    { ...ROW_NO_MATCH, status: 'primary' },
    { ...ROW_PENDING, status: 'deprioritized', remarks: 'Deprioritized — duplicate of row r1: Same person.' },
  ],
  total: 2, page: 1, limit: 10,
};

const MATCH_PAIR = {
  id: 'm3', targetType: 'import_row', score: 0.82, status: 'pending', signals: {},
  pairedRow: { id: 'r1', rowIndex: 1, lastName: 'Reyes', firstName: 'Pedro' },
};
const MATCHES_PENDING = { data: [MATCH_PAIR], total: 1, page: 1, limit: 20 };
const MATCHES_DECIDED = { data: [{ ...MATCH_PAIR, status: 'deprioritized', remark: 'Same person.' }], total: 1, page: 1, limit: 20 };

let rowsCall: number;
let matchesCall: number;
let pendingCount: number;

describe('ClientDedupPage', () => {
  beforeEach(async () => {
    rowsCall = 0;
    matchesCall = 0;
    pendingCount = 1;
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiUpload.mockReset();
    mockDownload.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('/rows') && k.includes('/matches')) {
        matchesCall += 1;
        return Promise.resolve(matchesCall === 1 ? MATCHES_PENDING : MATCHES_DECIDED);
      }
      if (k.includes('/rows')) {
        rowsCall += 1;
        return Promise.resolve(rowsCall === 1 ? ROWS_PENDING : ROWS_DECIDED);
      }
      if (k.includes('/client-dedup/operations/op9')) {
        return Promise.resolve({ id: 'op9', source: 'Batch 2.xlsx', status: 'reviewing', pending: 4, totalRows: 10 });
      }
      if (k.includes('/client-dedup/operations/op1')) {
        return Promise.resolve({ id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing', pending: pendingCount, totalRows: 2 });
      }
      if (k.includes('/client-dedup/operations')) return Promise.resolve(OPERATIONS_RESPONSE);
      return Promise.resolve(null);
    });
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the operations list with source, status and pending count', async () => {
    renderWithSWR(<ClientDedupPage />);
    expect(await screen.findByText('Batch 1.xlsx')).toBeTruthy();
    expect(screen.getByText(/reviewing/i)).toBeTruthy();
    expect(screen.getByText(/1 pending/i)).toBeTruthy();
    expect(screen.getByText(/2 rows/i)).toBeTruthy();
    expect(screen.getByText('Batch 0.xlsx')).toBeTruthy();
    expect(screen.getByText(/finalized/i)).toBeTruthy();
  });

  it('opens the row-definition wizard with the six baseline columns pre-filled', async () => {
    renderWithSWR(<ClientDedupPage />);
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    expect(screen.getByDisplayValue('Last Name')).toBeTruthy();
    expect(screen.getByDisplayValue('First Name')).toBeTruthy();
    expect(screen.getByDisplayValue('Middle Name')).toBeTruthy();
    expect(screen.getByDisplayValue('Birthday')).toBeTruthy();
    expect(screen.getByDisplayValue('Barangay')).toBeTruthy();
    expect(screen.getByDisplayValue('Remarks')).toBeTruthy();
  });

  it('declares extra fields beyond the baseline six', async () => {
    renderWithSWR(<ClientDedupPage />);
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    expect(screen.queryByPlaceholderText(/field name/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /declare extra field/i }));
    expect(screen.getByPlaceholderText(/field name/i)).toBeTruthy();
    expect(screen.getByText(/text/i)).toBeTruthy();
  });

  it('creates the operation then uploads the file as FormData and enters review', async () => {
    mockApiPost.mockResolvedValue({ id: 'op9' });
    mockApiUpload.mockResolvedValue({ id: 'op9', status: 'reviewing' });
    renderWithSWR(<ClientDedupPage />);
    await userEvent.click(await screen.findByRole('button', { name: /new deduplication/i }));

    await userEvent.type(screen.getByLabelText(/list name/i), 'Batch 2.xlsx');
    const file = new File(['Last Name,First Name\n'], 'batch2.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/client list file/i), { target: { files: [file] } });

    await userEvent.click(screen.getByRole('button', { name: /create & upload/i }));

    expect(mockApiPost).toHaveBeenCalledWith(
      '/client-dedup/operations',
      expect.objectContaining({
        source: 'Batch 2.xlsx',
        columnMap: expect.objectContaining({
          baseline: expect.objectContaining({ lastName: 'Last Name', birthDate: 'Birthday' }),
        }),
      }),
    );
    expect(mockApiUpload).toHaveBeenCalledWith(
      '/client-dedup/operations/op9/upload',
      expect.any(FormData),
    );
    const formData = mockApiUpload.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);

    expect(await screen.findByTestId('review-view')).toBeTruthy();
  });

  async function openReview() {
    renderWithSWR(<ClientDedupPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Review' }));
    return screen.findByTestId('review-view');
  }

  it('keeps no-match rows unexpandable and expands a pending row into its candidates', async () => {
    await openReview();
    expect(await screen.findByText('No match')).toBeTruthy();

    const expandButtons = screen.getAllByRole('button', { name: /review matches/i });
    expect(expandButtons).toHaveLength(1);

    await userEvent.click(expandButtons[0]);
    expect(await screen.findByRole('button', { name: /keep import row 1 \(b\)/i })).toBeTruthy();
    expect(screen.getByText(/82%/)).toBeTruthy();
  });

  it('records an intra-import decision and re-renders the pair under the kept row', async () => {
    mockApiPost.mockResolvedValue({});
    await openReview();
    await userEvent.click(await screen.findByRole('button', { name: /review matches/i }));

    await userEvent.click(await screen.findByRole('button', { name: /keep import row 1 \(b\)/i }));
    await userEvent.type(screen.getByPlaceholderText(/why is this a duplicate/i), 'Same person.');
    await userEvent.click(screen.getByRole('button', { name: /save decision/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/client-dedup/operations/op1/matches/m3/decision',
        { keep: 'other_import_row', remark: 'Same person.' },
      ),
    );
    const chip = await screen.findAllByText(/^deprioritized$/i);
    expect(chip.length).toBeGreaterThan(0);
    expect(screen.getByText(/primary — kept/i)).toBeTruthy();
  });

  it('reverts a decision and returns the row to pending', async () => {
    mockApiPost.mockResolvedValue({});
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('/rows') && k.includes('/matches')) {
        matchesCall += 1;
        return Promise.resolve(matchesCall === 1 ? MATCHES_DECIDED : MATCHES_PENDING);
      }
      if (k.includes('/rows')) {
        rowsCall += 1;
        return Promise.resolve(rowsCall === 1 ? ROWS_DECIDED : ROWS_PENDING);
      }
      if (k.includes('/client-dedup/operations/op1')) {
        return Promise.resolve({ id: 'op1', source: 'Batch 1.xlsx', status: 'reviewing', pending: 0, totalRows: 2 });
      }
      if (k.includes('/client-dedup/operations')) return Promise.resolve(OPERATIONS_RESPONSE);
      return Promise.resolve(null);
    });

    await openReview();
    const expandButtons = await screen.findAllByRole('button', { name: /review matches/i });
    await userEvent.click(expandButtons[1]);
    await userEvent.click(await screen.findByRole('button', { name: /revert decision/i }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/client-dedup/operations/op1/matches/m3/revert'),
    );
    expect(await screen.findByText(/^pending review$/i)).toBeTruthy();
  });

  it('shows the pending count on the finalize bar and blocks finalizing while decisions are pending', async () => {
    await openReview();
    expect(await screen.findByText(/1 pending decision/i)).toBeTruthy();
    const finalizeBtn = screen.getByRole('button', { name: /finalize & save priority list/i }) as HTMLButtonElement;
    expect(finalizeBtn.disabled).toBe(true);
    expect(finalizeBtn.getAttribute('title')).toMatch(/1 match still pending/i);
  });

  it('confirms, finalizes, shows the save summary and downloads the priority list', async () => {
    pendingCount = 0;
    mockApiPost.mockImplementation((path: string) =>
      path.endsWith('/finalize')
        ? Promise.resolve({ created: 1, updated: 1, deprioritized: 2, barangayUpdates: 1 })
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
    expect(screen.getByTestId('stat-updated').textContent).toContain('1');
    expect(screen.getByTestId('stat-deprioritized').textContent).toContain('2');
    expect(screen.getByTestId('stat-barangay').textContent).toContain('1');
    expect(screen.getByText(/New records saved/)).toBeTruthy();
    expect(screen.getByText(/Existing records updated/)).toBeTruthy();
    expect(screen.getByText(/Rows deprioritized/)).toBeTruthy();
    expect(screen.getByText(/Barangay updates/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /download priority list/i }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('op1'));
  });
});
