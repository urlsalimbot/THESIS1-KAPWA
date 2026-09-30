import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

function authState(over: Record<string, unknown> = {}) {
  return { user: null, token: null, loading: false, logout: vi.fn(), ...over };
}

// A role the client no longer ships a home for (16bda23 retired mayor, auditor
// and agency_staff, but those accounts still authenticate against the API).
const retiredRoleUser = {
  id: '9',
  email: 'auditor@mswdo.test',
  fullName: 'A Auditor',
  role: 'auditor',
};

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

  it('offers a way out instead of looping when the role has no home route', async () => {
    // Regression: a retired role fell through ROLE_REDIRECT_MAP to '/dashboard',
    // which rejects the role, so the guard redirected to the path it was already
    // on and rendered "Verifying access..." forever. The user must get a real
    // screen with a sign-out action.
    mockUseAuth.mockReturnValue(authState({ token: 'test', user: retiredRoleUser }));
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['admin', 'social_worker']}>
                <div>Worker Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/log out/i)).toBeTruthy();
    });
    // The spinner is the loop's symptom: it must not be what the user is left with.
    expect(screen.queryByText(/Verifying access/i)).toBeNull();
    expect(screen.queryByText('Worker Dashboard')).toBeNull();
  });

  it('signs out a retired-role user from the no-home screen', async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue(authState({ token: 'test', user: retiredRoleUser, logout }));
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute roles={['admin', 'social_worker']}>
          <div>Worker Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    const signOut = await screen.findByText(/log out/i);
    fireEvent.click(signOut.closest('button')!);
    expect(logout).toHaveBeenCalled();
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
