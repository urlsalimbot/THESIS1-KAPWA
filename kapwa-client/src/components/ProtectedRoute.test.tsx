import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

function authState(over: Record<string, unknown> = {}) {
  return { user: null, token: null, loading: false, ...over };
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects to /login when there is no token', async () => {
    mockUseAuth.mockReturnValue(authState());
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
    mockUseAuth.mockReturnValue(authState({
      token: 'test',
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' },
    }));
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
    mockUseAuth.mockReturnValue(authState({ loading: true, token: 'test' }));
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
    mockUseAuth.mockReturnValue(authState({
      token: 'test',
      user: { id: '1', email: 'a@b.com', fullName: 'A B', role: 'claimant' },
    }));
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

  it('keeps the session when the token exists but the user failed to load', async () => {
    // Transient /auth/me failure (429/5xx): the api interceptor decides on 401.
    mockUseAuth.mockReturnValue(authState({ token: 'test', user: null, loading: false }));
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

  it('redirects a must-change-password user to /settings from any other route', async () => {
    mockUseAuth.mockReturnValue(authState({
      token: 'test',
      user: { id: '1', email: 'claimant@example.test', fullName: 'Claimant', role: 'claimant', mustChangePassword: true },
    }));
    render(
      <MemoryRouter initialEntries={['/my-dashboard']}>
        <Routes>
          <Route
            path="/my-dashboard"
            element={
              <ProtectedRoute roles={['claimant']}>
                <div>Claimant Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Claimant Dashboard')).toBeNull();
    });
    expect(await screen.findByText('Settings Page')).toBeTruthy();
  });
});
