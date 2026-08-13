import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { CasesPage } from './CasesPage';

const { mockCases, mockApiGet, mockApiPost, mockApiPut, mockApiPatch, mockApiDel, mockQueueFsm, mockIsOnline } = vi.hoisted(() => ({
  mockCases: [
    {
      id: 'C-001',
      controlNo: 'CN-001',
      status: 'active',
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
  mockApiPatch: vi.fn(),
  mockApiDel: vi.fn(),
  mockQueueFsm: vi.fn(),
  mockIsOnline: vi.fn(() => true),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
}));

vi.mock('../lib/sync', () => ({
  isOnline: () => mockIsOnline(),
}));

vi.mock('../lib/offline-queue', () => ({
  queueFsmTransition: (...args: unknown[]) => mockQueueFsm(...args),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: '1', email: 'worker@test.com', fullName: 'Test Worker', role: 'social_worker' } }),
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
    mockApiPatch.mockReset();
    mockApiDel.mockReset();
    mockQueueFsm.mockReset();
    mockIsOnline.mockReset();
    mockIsOnline.mockReturnValue(true);
    mockApiGet.mockResolvedValue({ data: mockCases, total: 1 });
    mockApiPut.mockResolvedValue({ ok: true });
    mockApiPatch.mockResolvedValue({ ok: true });
    mockApiPost.mockResolvedValue({ ok: true });
    mockApiDel.mockResolvedValue({ ok: true });
    // Clear the global SWR cache so each test gets a fresh useSWR fetch.
    await mutate(() => true, undefined, { revalidate: false });
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
  });

  it('a successful requestReview trigger calls api.patch with /request-review', async () => {
    // Set role to social_worker + status to enrolled so the Request Review button shows
    mockApiGet.mockResolvedValue({ data: [{ ...mockCases[0], status: 'enrolled' }], total: 1 });

    renderWithSWR(<CasesPage />);
    // Wait for the button to appear
    const button = await screen.findByRole('button', { name: /Request Review/i });
    fireEvent.click(button);

    // Wait for the mutation to fire
    await vi.waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });
    // The first call to api.patch should be to /request-review
    const patchCall = mockApiPatch.mock.calls[0];
    expect(String(patchCall[0])).toContain('/request-review');
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<CasesPage />);
    await screen.findByRole('heading', { name: 'Case Tracker' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders ErrorState with a retry button when the list fails to load', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<CasesPage />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load cases')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('refetches when Try again is clicked after a load failure', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    renderWithSWR(<CasesPage />);
    await screen.findByRole('alert');
    mockApiGet.mockResolvedValue(mockCases);
    const callsBefore = mockApiGet.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await vi.waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});

