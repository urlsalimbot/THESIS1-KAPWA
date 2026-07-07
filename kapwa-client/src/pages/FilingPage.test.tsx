import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { FilingPage } from './FilingPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel, mockFetch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('FilingPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDel.mockReset();
    mockFetch.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({ ok: true });
    mockApiPut.mockResolvedValue({ ok: true });
    mockApiDel.mockResolvedValue({ ok: true });
    // Raw fetch (for handleUpload/handleDownload FormData + blob flows) is
    // mocked globally so jsdom can render the upload input without errors.
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    localStorage.setItem('kapwa_token', 'test-token');
    await mutate(() => true, undefined, { revalidate: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<FilingPage />);
    expect(await screen.findByRole('heading', { name: 'Digital Filing' })).toBeTruthy();
  });

  it('renders description text', async () => {
    renderWithSWR(<FilingPage />);
    expect(await screen.findByText(/Upload and manage case documents/i)).toBeTruthy();
  });

  it('renders Upload Document button', async () => {
    renderWithSWR(<FilingPage />);
    expect(await screen.findByText('Upload Document')).toBeTruthy();
  });

  it('renders search placeholder', async () => {
    renderWithSWR(<FilingPage />);
    expect(await screen.findByPlaceholderText('Search documents...')).toBeTruthy();
  });

  it('api.get is called with a path containing /filing on mount', async () => {
    renderWithSWR(<FilingPage />);
    // Wait for the initial fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiGet).toHaveBeenCalled();
    const lastCallArg = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
    expect(JSON.stringify(lastCallArg)).toContain('filing');
  });

  it('api.del is called with a /filing/ path when the delete button is clicked and confirmed', async () => {
    // Mock the confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Mock the data to have one document so the delete button appears
    mockApiGet.mockResolvedValue([
      { id: 'doc-123', fileName: 'foo.pdf', originalName: 'foo.pdf', mimeType: 'application/pdf', fileSize: 1024, caseId: 'C-001', beneficiaryId: 'BEN-001', category: 'general', notes: '', uploadedBy: 'u1', createdAt: '2026-06-28' },
    ]);

    renderWithSWR(<FilingPage />);
    // Wait for the document to render
    await screen.findByText('foo.pdf');
    // Click the delete button (aria-label="Delete")
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Wait for the api.del call
    await vi.waitFor(() => {
      expect(mockApiDel).toHaveBeenCalled();
    });
    const lastCallArg = mockApiDel.mock.calls[mockApiDel.mock.calls.length - 1][0];
    expect(String(lastCallArg)).toContain('/filing/');
    expect(String(lastCallArg)).toContain('doc-123');
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<FilingPage />);
    await screen.findByRole('heading', { name: 'Digital Filing' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

