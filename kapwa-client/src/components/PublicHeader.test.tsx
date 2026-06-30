import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../lib/auth-context';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

describe('PublicHeader', () => {
  it('shows Login button when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<BrowserRouter><PublicHeader user={null} loading={false} /></BrowserRouter>);
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
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<BrowserRouter><PublicHeader user={null} loading={false} /></BrowserRouter>);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
  });
});
