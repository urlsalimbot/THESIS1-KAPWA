import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth, getCurrentUser } from './auth-context';

function AuthProbe({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  // Expose full auth context (including login, resolveMfa, cancelMfa) on every render
  act(() => { onAuth(auth); });
  return <div data-testid="probe">probe</div>;
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('useAuth() returns the context value via mocked provider + consumer', () => {
    const onAuth = vi.fn();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={onAuth} />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(onAuth).toHaveBeenCalled();
    const value = onAuth.mock.calls[onAuth.mock.calls.length - 1][0];
    expect(value).toHaveProperty('user');
    expect(value).toHaveProperty('token');
    expect(value).toHaveProperty('login');
    expect(value).toHaveProperty('logout');
    expect(value).toHaveProperty('loading');
    expect(value).toHaveProperty('mfaChallenge');
    expect(value).toHaveProperty('resolveMfa');
    expect(value).toHaveProperty('cancelMfa');
    expect(value.user).toBeNull();
    expect(value.token).toBeNull();
    expect(value.mfaChallenge).toBeNull();
    expect(typeof value.login).toBe('function');
    expect(typeof value.logout).toBe('function');
    expect(typeof value.resolveMfa).toBe('function');
    expect(typeof value.cancelMfa).toBe('function');
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when no token in localStorage', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const result = await getCurrentUser();
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns user when token present and /auth/me 200s', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' } }),
    });

    const result = await getCurrentUser();
    expect(result).toEqual({ id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' });
  });

  it('returns null on fetch error (catches TypeError)', async () => {
    localStorage.setItem('kapwa_token', 'tok');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new TypeError('network'));

    // Use fake timers so the 500+1500+4500ms api.get backoff completes instantly.
    vi.useFakeTimers();
    try {
      const resultPromise = getCurrentUser();
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
      }
      const result = await resultPromise;
      expect(result).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('cancelMfa', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears mfaChallenge state without firing any additional fetch', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
    });

    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={(a) => { captured = a; }} />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => { await captured!.login('a@b.com', 'pass'); });
    await waitFor(() => {
      expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1' });
    });
    expect(fetchMock.mock.calls.length).toBe(1);

    await act(async () => { captured!.cancelMfa(); });

    expect(captured!.mfaChallenge).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(1);
  });
});
