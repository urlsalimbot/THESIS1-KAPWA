import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';

function AuthProbe({ onAuth }: { onAuth: (auth: { user: unknown; token: string | null }) => void }) {
  const auth = useAuth();
  // Expose auth state via the onAuth callback on every render
  act(() => { onAuth({ user: auth.user, token: auth.token }); });
  return <div data-testid="probe">probe</div>;
}

describe('AuthProvider — kapwa:auth:logout subscriber', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('kapwa_token', 'test-tok');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('subscribes to kapwa:auth:logout and calls logout() on dispatch', async () => {
    // Mock /auth/me so AuthProvider reaches a stable state with user set
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' } }),
    });

    const onAuth = vi.fn();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={onAuth} />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait for fetchUser to resolve and set user
    await waitFor(() => {
      const lastCall = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
      expect(lastCall.user).not.toBeNull();
    });

    // Dispatch the logout event from the api client's 401-refresh-fail path
    await act(async () => {
      window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_failed' } }));
    });

    // After the event, the subscriber calls logout() — token + user are cleared
    await waitFor(() => {
      expect(localStorage.getItem('kapwa_token')).toBeNull();
    });

    // The auth context state reflects the cleared token + user
    await waitFor(() => {
      const lastCall = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
      expect(lastCall.token).toBeNull();
    });
  });

  it('dispatches the event from api client and subscriber clears user state', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b', fullName: 'A B', role: 'admin' } }),
    });

    const onAuth = vi.fn();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={onAuth} />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const lastCall = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
      expect(lastCall.user).not.toBeNull();
    });

    // Simulate the api client dispatching the event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('kapwa:auth:logout', { detail: { reason: 'refresh_network_error' } }));
    });

    await waitFor(() => {
      const lastCall = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
      expect(lastCall.user).toBeNull();
    });
  });
});
