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
    expect(await screen.findByText(/Programs/)).toBeTruthy();
    expect(screen.getByText(/Users/)).toBeTruthy();
    expect(screen.getByText(/Sync Queue/)).toBeTruthy();
    expect(screen.getByText(/Audit Log/)).toBeTruthy();
  });

  it('renders Program Configurator card heading', async () => {
    renderWithSWR(<AdminPage />);
    expect(await screen.findByText('Program Configurator')).toBeTruthy();
  });

  it('on default programs tab, api.get is called for /programs only', async () => {
    renderWithSWR(<AdminPage />);
    // Wait for the heading + the programs fetch
    await screen.findByText('Program Configurator');
    // All calls should reference the programs endpoint
    expect(mockApiGet).toHaveBeenCalled();
    const calledUrls = mockApiGet.mock.calls.map((c) => JSON.stringify(c[0]));
    const hasPrograms = calledUrls.some((u) => u.includes('programs'));
    expect(hasPrograms).toBe(true);
    // Inactive tabs (users/sync/audit) should NOT have been fetched
    const hasUsers = calledUrls.some((u) => u.includes('users') && !u.includes('programs'));
    const hasSync = calledUrls.some((u) => u.includes('sync-entries') || u.includes('sync/conflicts'));
    const hasAudit = calledUrls.some((u) => u.includes('audit-logs'));
    expect(hasUsers).toBe(false);
    expect(hasSync).toBe(false);
    expect(hasAudit).toBe(false);
  });

  it('clicking the Users tab fires an api.get call for /users', async () => {
    renderWithSWR(<AdminPage />);
    await screen.findByText('Program Configurator');
    const initialCallCount = mockApiGet.mock.calls.length;
    // Find the Users tab — Radix TabsTrigger has role="tab"
    const usersTab = screen.getByRole('tab', { name: /users/i });
    // Radix UI TabsTrigger activates on pointerdown, not click. fireEvent.mouseDown
    // is the closest equivalent to a user event for this Radix component.
    await act(async () => {
      fireEvent.mouseDown(usersTab, { button: 0 });
    });
    // Wait for the user fetch — small wait for SWR to dispatch
    await new Promise((r) => setTimeout(r, 100));
    expect(mockApiGet.mock.calls.length).toBeGreaterThan(initialCallCount);
    const newCalls = mockApiGet.mock.calls.slice(initialCallCount);
    const hasUsers = newCalls.some((c) => JSON.stringify(c[0]).includes('users'));
    expect(hasUsers).toBe(true);
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithSWR(<AdminPage />);
    await screen.findByRole('heading', { name: 'Admin Panel' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

