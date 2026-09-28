import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('opens the appearance switcher with Light / Dark / System', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    await user.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('switches language through the language menu', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Filipino')).toBeTruthy();
    await user.click(screen.getByText('Filipino'));
    expect(mockSetLang).toHaveBeenCalledWith('fil');
  });
});