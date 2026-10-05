import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

const { mockSetTheme, mockSetLang, mockTheme, mockLang } = vi.hoisted(() => ({
  mockSetTheme: vi.fn(),
  mockSetLang: vi.fn(),
  mockTheme: { theme: 'system', resolvedTheme: 'light' },
  mockLang: { lang: 'en' },
}));

vi.mock('@/lib/theme-context', () => ({
  useTheme: () => ({ ...mockTheme, setTheme: mockSetTheme }),
}));

vi.mock('@/i18n/useLanguage', () => ({
  useLanguage: () => ({ ...mockLang, setLang: mockSetLang }),
}));

import { useAuth } from '../lib/auth-context';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function renderHeader() {
  return render(<BrowserRouter><PublicHeader user={null} loading={false} /></BrowserRouter>);
}

describe('PublicHeader', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockSetTheme.mockReset();
    mockSetLang.mockReset();
  });

  it('shows Login button when not authenticated', () => {
    renderHeader();
    expect(screen.getByText('Login')).toBeTruthy();
  });

  it('shows Go to Dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'social_worker' }, loading: false });
    render(<BrowserRouter><PublicHeader user={{ id: '1', email: 'test@test.com', fullName: 'Test', role: 'social_worker' }} loading={false} /></BrowserRouter>);
    expect(screen.getByText('Go to Dashboard')).toBeTruthy();
  });

  it('renders empty header bar when loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<BrowserRouter><PublicHeader user={null} loading={true} /></BrowserRouter>);
    expect(container.querySelector('header')).toBeTruthy();
  });

  it('renders nav links', () => {
    renderHeader();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
  });

  it('renders exactly one close control in the mobile drawer', async () => {
    // The drawer's header used to render its own X on top of the one
    // SheetContent already provides, so mobile users saw two close buttons.
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByRole('button', { name: /close menu/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);
  });

  // The drawer trigger is `md:hidden`, so at md and up the only controls that
  // can be reached are the ones rendered outside the drawer. These two assert
  // exactly that, without opening the menu first — the drawer's contents are
  // portaled and unmounted while it is closed, so a control that only exists
  // inside it is unreachable on a desktop viewport.
  it('offers the appearance control without opening the mobile drawer', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    await user.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('offers the language control without opening the mobile drawer', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Filipino')).toBeTruthy();
    await user.click(screen.getByText('Filipino'));
    expect(mockSetLang).toHaveBeenCalledWith('fil');
  });

  it('opens the appearance switcher with Light / Dark / System', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = within(screen.getByRole('dialog'));
    await user.click(drawer.getByRole('button', { name: 'Theme' }));
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    await user.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('switches language through the language menu', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = within(screen.getByRole('dialog'));
    await user.click(drawer.getByRole('button', { name: 'Language' }));
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Filipino')).toBeTruthy();
    await user.click(screen.getByText('Filipino'));
    expect(mockSetLang).toHaveBeenCalledWith('fil');
  });
});