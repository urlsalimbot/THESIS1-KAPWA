import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset();
    localStorage.clear();
  });

  it('redirects to /login when no token is in localStorage', async () => {
    localStorage.removeItem('kapwa_token');
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Protected')).toBeNull();
    });
  });

  it('renders children when authenticated with the right role', async () => {
    localStorage.setItem('kapwa_token', 'test');
    mockGetCurrentUser.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      fullName: 'A B',
      role: 'social_worker',
    });
    render(
      <MemoryRouter>
        <ProtectedRoute roles={['social_worker']}>
          <div>Protected</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeTruthy();
    });
  });

  it('shows Verifying access while loading', () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText(/Verifying access/i)).toBeTruthy();
  });

  it('redirects when role does not match', async () => {
    localStorage.setItem('kapwa_token', 'test');
    mockGetCurrentUser.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      fullName: 'A B',
      role: 'claimant',
    });
    render(
      <MemoryRouter>
        <ProtectedRoute roles={['social_worker']}>
          <div>Protected</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Protected')).toBeNull();
    });
  });
});
