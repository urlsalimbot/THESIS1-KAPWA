import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig, mutate } from 'swr';
import { axe } from 'vitest-axe';
import { AdminPage } from './AdminPage';

const { mockApiGet, mockApiPost, mockApiPut, mockApiDel } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiDel: vi.fn(),
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

describe('AdminPage', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPut.mockReset();
    mockApiDel.mockReset();
    // Default mock returns empty arrays for all admin endpoints
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({ ok: true });
    mockApiPut.mockResolvedValue({ ok: true });
    mockApiDel.mockResolvedValue({ ok: true });
    localStorage.setItem('kapwa_token', 'test-token');
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders PageShell heading', async () => {
    renderWithSWR(<AdminPage />);
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
  });

  it('renders tab navigation', async () => {
    renderWithSWR(<AdminPage />);
    expect(await screen.findByText(/Users/)).toBeTruthy();
    expect(screen.getByText(/Sync Queue/)).toBeTruthy();
    expect(screen.getByText(/Audit Log/)).toBeTruthy();
  });

  it('renders User Management card heading by default', async () => {
    renderWithSWR(<AdminPage />);
    expect(await screen.findByText('User Management')).toBeTruthy();
  });

  it('on default users tab, api.get is called for /users only', async () => {
    renderWithSWR(<AdminPage />);
    // Wait for the heading + the users fetch
    await screen.findByText('User Management');
    // All calls should reference the users endpoint
    expect(mockApiGet).toHaveBeenCalled();
    const calledUrls = mockApiGet.mock.calls.map((c) => JSON.stringify(c[0]));
    const hasUsers = calledUrls.some((u) => u.includes('users'));
    expect(hasUsers).toBe(true);
    // Inactive tabs (sync/audit) should NOT have been fetched
    const hasSync = calledUrls.some((u) => u.includes('sync-entries') || u.includes('sync/conflicts'));
    const hasAudit = calledUrls.some((u) => u.includes('audit-logs'));
    expect(hasSync).toBe(false);
    expect(hasAudit).toBe(false);
  });

  it('clicking the Sync tab fires an api.get call for sync entries', async () => {
    renderWithSWR(<AdminPage />);
    await screen.findByText('User Management');
    const initialCallCount = mockApiGet.mock.calls.length;
    const syncTab = screen.getByRole('tab', { name: /sync/i });
    await act(async () => {
      fireEvent.mouseDown(syncTab, { button: 0 });
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(mockApiGet.mock.calls.length).toBeGreaterThan(initialCallCount);
    const newCalls = mockApiGet.mock.calls.slice(initialCallCount);
    const hasSync = newCalls.some((c) => JSON.stringify(c[0]).includes('sync'));
    expect(hasSync).toBe(true);
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<AdminPage />);
    await screen.findByRole('heading', { name: 'Admin Panel' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

