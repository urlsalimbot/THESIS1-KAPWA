import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import ClientDedupPage from './ClientDedupPage';

const { mockApiGet, mockApiPost, mockApiUpload } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiUpload: vi.fn(),
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
      createdAt: '2026-10-01T00:00:00Z', pending: 3, noMatch: 1, decided: 8, totalRows: 12,
    },
    {
      id: 'op2', source: 'Batch 0.xlsx', status: 'finalized',
      createdAt: '2026-09-20T00:00:00Z', pending: 0, noMatch: 0, decided: 5, totalRows: 5,
    },
  ],
  total: 2, page: 1, limit: 10,
};

describe('ClientDedupPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiUpload.mockReset();
    mockApiGet.mockImplementation((key: unknown) => {
      const k = String(key);
      if (k.includes('/client-dedup/operations/op9')) {
        return Promise.resolve({ id: 'op9', source: 'Batch 2.xlsx', status: 'reviewing', pending: 4, totalRows: 10 });
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
    expect(screen.getByText(/3 pending/i)).toBeTruthy();
    expect(screen.getByText(/12 rows/i)).toBeTruthy();
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
});
