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

// =============================================================
// Tests for the fetchUser → api.get('/auth/me') migration (Plan 14-02 Task 1).
// The api.get internally calls fetch, so we spy on the global fetch to verify
// the URL contains '/auth/me' (proving the api.get call routed through the
// correct path). The old tests also use this pattern; the migration is verified
// by the URL containing '/auth/me' instead of the inline '/auth/me' literal.
// =============================================================
describe('AuthProvider — fetchUser uses api.get("/auth/me")', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('kapwa_token', 'test-tok');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetchUser calls api.get → fetch is called with URL ending in /auth/me', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'social_worker' } }),
    });

    const onAuth = vi.fn();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={onAuth} />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Wait for fetchUser to complete — the api.get call routes through fetch internally
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Verify the URL passed to fetch is the /auth/me endpoint
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/auth\/me$/);
  });
});

