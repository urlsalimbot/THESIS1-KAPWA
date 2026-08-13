import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { Topbar } from './Topbar';

const mockUseAuth = vi.hoisted(() => vi.fn(() => ({
  user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
  token: 'test-tok',
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  mfaChallenge: null,
  resolveMfa: vi.fn(),
  cancelMfa: vi.fn(),
})));

const mockOnline = vi.hoisted(() => ({ value: true }));
const mockPending = vi.hoisted(() => ({ value: 0 }));
const mockThemeState = vi.hoisted(() => ({ theme: 'light', resolved: 'light' }));
const mockSetTheme = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/theme-context', () => ({
  useTheme: () => ({
    theme: mockThemeState.theme,
    resolvedTheme: mockThemeState.resolved,
    setTheme: mockSetTheme,
  }),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useConnectivity: () => mockOnline.value,
}));

vi.mock('@/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ pending: mockPending.value }),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/dashboard']}>{ui}</MemoryRouter>);
}

describe('Topbar', () => {
  afterEach(() => {
    localStorage.removeItem('kapwa-lang');
    document.documentElement.lang = 'en';
  });

  it('renders without crashing', () => {
    const { container } = renderWithRouter(<Topbar />);
    expect(container.querySelector('header')).toBeTruthy();
  });

  it('shows role-gated buttons (New Intake, Approvals Queue) for social_worker', () => {
    renderWithRouter(<Topbar />);
    expect(screen.getByLabelText('New Intake')).toBeTruthy();
    expect(screen.getByLabelText('Approvals Queue')).toBeTruthy();
  });

  it('hides role-gated buttons for claimant role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'claimant' },
      token: 'test-tok',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      mfaChallenge: null,
      resolveMfa: vi.fn(),
      cancelMfa: vi.fn(),
    });
    renderWithRouter(<Topbar />);
    expect(screen.queryByLabelText('New Intake')).toBeNull();
    expect(screen.queryByLabelText('Approvals Queue')).toBeNull();
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
      token: 'test-tok',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      mfaChallenge: null,
      resolveMfa: vi.fn(),
      cancelMfa: vi.fn(),
    });
  });

  it('has no axe violations', async () => {
    const { container } = renderWithRouter(<Topbar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders Language menu items and switches locale', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Topbar />);
    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Filipino')).toBeTruthy();
    await user.click(screen.getByText('Filipino'));
    expect(document.documentElement.lang).toBe('fil-PH');
    expect(localStorage.getItem('kapwa-lang')).toBe('fil');
    // switch back for isolation
    await user.click(screen.getByRole('button', { name: 'Open user menu' }));
    await user.click(screen.getByText('English'));
    expect(document.documentElement.lang).toBe('en');
  });
});

function renderWithTopbar({ role, pathname = '/dashboard' }: { role?: string; pathname?: string } = {}) {
  const resolvedRole = role ?? 'social_worker';
  mockUseAuth.mockReturnValue({
    user: { id: '1', email: 'a@b.com', fullName: 'A B', role: resolvedRole },
    token: 'test-tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    mfaChallenge: null,
    resolveMfa: vi.fn(),
    cancelMfa: vi.fn(),
  });
  return render(<MemoryRouter initialEntries={[pathname]}><Topbar /></MemoryRouter>);
}

describe('role-gated shell widgets', () => {
  afterEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
      token: 'test-tok',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      mfaChallenge: null,
      resolveMfa: vi.fn(),
      cancelMfa: vi.fn(),
    });
  });
  it('does not render MessagesPopover for agency_staff', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'agency_staff' });
    expect(queryByLabelText(/messages/i)).toBeNull();
  });

  it('does not render NotificationsDropdown for mayor', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'mayor' });
    expect(queryByLabelText(/notifications/i)).toBeNull();
  });

  it('renders NotificationsDropdown for auditor', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'auditor' });
    expect(queryByLabelText(/notifications/i)).not.toBeNull();
  });
});

describe('theme toggle menu', () => {
  afterEach(() => {
    mockSetTheme.mockClear();
    mockThemeState.theme = 'light';
    mockThemeState.resolved = 'light';
  });

  it('offers Light, Dark, and System options', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Topbar />);
    await user.click(screen.getByLabelText('Open user menu'));
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('selecting System calls setTheme with system', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Topbar />);
    await user.click(screen.getByLabelText('Open user menu'));
    await user.click(screen.getByText('System'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('selecting Dark calls setTheme with dark', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Topbar />);
    await user.click(screen.getByLabelText('Open user menu'));
    await user.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});

describe('breadcrumbs on deep pages', () => {
  it('shows breadcrumbs on a deep page like /cases/123', () => {
    const { container } = renderWithTopbar({ pathname: '/cases/123' });
    const nav = container.querySelector('nav[aria-label="breadcrumb"]');
    expect(nav).not.toBeNull();
  });

  it('shows breadcrumbs on a case detail page with a UUID id', () => {
    const { container } = renderWithTopbar({ pathname: '/cases/0193e5a1-2b3c-4d5e-8f6a-7b8c9d0e1f2a' });
    const nav = container.querySelector('nav[aria-label="breadcrumb"]');
    expect(nav).not.toBeNull();
  });

  it('renders two crumbs with the case label for a UUID case path', () => {
    const uuid = '0193e5a1-2b3c-4d5e-8f6a-7b8c9d0e1f2a';
    const { container } = renderWithTopbar({ pathname: `/cases/${uuid}` });
    const nav = container.querySelector('nav[aria-label="breadcrumb"]');
    expect(nav).not.toBeNull();
    const items = nav!.querySelectorAll('li:not([role="presentation"])');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(nav!.textContent).toContain('Case 0193e5a1');
  });
});

describe('offline and pending indicators', () => {
  afterEach(() => {
    mockOnline.value = true;
    mockPending.value = 0;
  });

  it('shows offline badge when offline', () => {
    mockOnline.value = false;
    renderWithRouter(<Topbar />);
    expect(screen.getByLabelText('Offline indicator')).toBeTruthy();
  });

  it('hides offline badge when online', () => {
    renderWithRouter(<Topbar />);
    expect(screen.queryByLabelText('Offline indicator')).toBeNull();
  });

  it('shows pending badge when online with pending changes', () => {
    mockPending.value = 3;
    renderWithRouter(<Topbar />);
    expect(screen.getByLabelText('Pending sync count')).toBeTruthy();
    expect(screen.getByText('3 pending')).toBeTruthy();
  });

  it('hides pending badge when offline', () => {
    mockOnline.value = false;
    mockPending.value = 3;
    renderWithRouter(<Topbar />);
    expect(screen.queryByLabelText('Pending sync count')).toBeNull();
  });

  it('shows persistent banner when offline with pending changes', () => {
    mockOnline.value = false;
    mockPending.value = 2;
    renderWithRouter(<Topbar />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/You are offline/)).toBeTruthy();
    expect(screen.getByText(/2 change\(s\) pending sync/)).toBeTruthy();
  });

  it('hides persistent banner when online', () => {
    mockOnline.value = true;
    mockPending.value = 2;
    renderWithRouter(<Topbar />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides persistent banner when offline but no pending changes', () => {
    mockOnline.value = false;
    mockPending.value = 0;
    renderWithRouter(<Topbar />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
