import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { CasesPage } from './CasesPage';

const { mockCases, mockApiGet, mockApiPost, mockApiPut, mockApiDel, mockQueueFsm, mockIsOnline } = vi.hoisted(() => ({
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'CN-001',
      status: 'approved',
      remarks: 'Monthly',
      updatedAt: '2026-06-28T00:00:00Z',
      slaOverdue: false,
      beneficiary: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        middleName: 'M',
        gender: 'M',
        address: 'Barangay 1',
      },
      serviceRequested: ['Senior'],
    },
  ],
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
  mockQueueFsm: vi.fn(),
  mockIsOnline: vi.fn(() => true),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

vi.mock('../lib/sync', () => ({
  isOnline: () => mockIsOnline(),
}));

vi.mock('../lib/offline-queue', () => ({
  queueFsmTransition: (...args: unknown[]) => mockQueueFsm(...args),
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </SWRConfig>,
  );
}

describe('CasesPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDel.mockReset();
    mockQueueFsm.mockReset();
    mockIsOnline.mockReset();
    mockIsOnline.mockReturnValue(true);
    mockApiGet.mockResolvedValue(mockCases);
    mockApiPut.mockResolvedValue({ ok: true });
    mockApiPost.mockResolvedValue({ ok: true });
    mockApiDel.mockResolvedValue({ ok: true });
    // Clear the global SWR cache so each test gets a fresh useSWR fetch.
    await mutate(() => true, undefined, { revalidate: false });
    // social_worker role to make Request Review button visible
    localStorage.setItem('kapwa_role', 'social_worker');
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<CasesPage />);
    expect(await screen.findByRole('heading', { name: 'Case Tracker' })).toBeTruthy();
  });

  it('renders beneficiary surname from mock', async () => {
    renderWithSWR(<CasesPage />);
    expect(await screen.findByText('Dela Cruz', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('renders search input', async () => {
    renderWithSWR(<CasesPage />);
    expect(await screen.findByPlaceholderText('Search records...')).toBeTruthy();
  });

  it('renders export CSV button', async () => {
    renderWithSWR(<CasesPage />);
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeTruthy();
  });

  it('snapshot: CasesPage rendered DOM with table layout + status badges + filter controls', async () => {
    const { container } = renderWithSWR(<CasesPage />);
    expect(await screen.findByRole('heading', { name: 'Case Tracker' })).toBeTruthy();
    expect(container).toMatchSnapshot();
  });

  it('api.get is called with a path containing /cases on mount', async () => {
    renderWithSWR(<CasesPage />);
    // Wait for SWR to fire the fetch
    await screen.findByText('Dela Cruz');
    expect(mockApiGet).toHaveBeenCalled();
    const lastCallArg = mockApiGet.mock.calls[mockApiGet.mock.calls.length - 1][0];
    expect(JSON.stringify(lastCallArg)).toContain('cases');
    expect(JSON.stringify(lastCallArg)).toContain('list');
  });

  it('a successful requestReview trigger calls api.put with /request-review', async () => {
    // Set role to social_worker + status to pending_assessment so the Request Review button shows
    mockApiGet.mockResolvedValue([
      { ...mockCases[0], status: 'pending_assessment' },
    ]);
    localStorage.setItem('kapwa_role', 'social_worker');

    renderWithSWR(<CasesPage />);
    // Wait for the button to appear
    const button = await screen.findByRole('button', { name: /Request Review/i });
    fireEvent.click(button);

    // Wait for the mutation to fire
    await vi.waitFor(() => {
      expect(mockApiPut).toHaveBeenCalled();
    });
    // The first call to api.put should be to /request-review
    const putCall = mockApiPut.mock.calls[0];
    expect(String(putCall[0])).toContain('/request-review');
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<CasesPage />);
    await screen.findByRole('heading', { name: 'Case Tracker' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

