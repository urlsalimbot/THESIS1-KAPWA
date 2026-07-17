import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';

function AuthProbe({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  // Expose full auth context (including login, resolveMfa, cancelMfa) on every render
  act(() => { onAuth(auth); });
  return <div data-testid="probe">probe</div>;
}

describe('AuthProvider — login', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('login() with valid credentials sets user + token', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        accessToken: 'tok-1',
        user: { id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' },
      }),
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
      expect(captured!.user).toEqual({ id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' });
    });
    expect(localStorage.getItem('kapwa_token')).toBe('tok-1');
  });

  it('login() with MFA required sets mfaChallenge + returns { mfaRequired: true, tempToken }', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
    });

    let captured: ReturnType<typeof useAuth> | null = null;
    let result: Awaited<ReturnType<ReturnType<typeof useAuth>['login']>> = undefined;
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={(a) => { captured = a; }} />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => { result = await captured!.login('a@b.com', 'pass'); });

    expect(result).toEqual({ mfaRequired: true, tempToken: 'temp-1' });
    await waitFor(() => {
      expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1', type: 'totp' });
    });
    expect(localStorage.getItem('kapwa_token')).toBeNull();
  });

  it('login() with 4xx response throws Error', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid credentials' }),
    });

    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe onAuth={(a) => { captured = a; }} />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await expect(captured!.login('a@b.com', 'wrong')).rejects.toThrow('Login failed');
    });

    expect(localStorage.getItem('kapwa_token')).toBeNull();
  });

  it('resolveMfa() with valid code sets user + token + clears mfaChallenge', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    // First: login returns MFA challenge
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
    });
    // Then: /auth/mfa/verify returns the real token
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        accessToken: 'tok-2',
        user: { id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' },
      }),
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
      expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1', type: 'totp' });
    });

    await act(async () => { await captured!.resolveMfa('123456'); });

    await waitFor(() => {
      expect(captured!.user).toEqual({ id: 'u1', email: 'a@b.com', fullName: 'A B', role: 'admin' });
    });
    expect(captured!.mfaChallenge).toBeNull();
    expect(localStorage.getItem('kapwa_token')).toBe('tok-2');
  });

  it('resolveMfa() with 4xx response throws Error', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mfaRequired: true, tempToken: 'temp-1' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid code' }),
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
      expect(captured!.mfaChallenge).toEqual({ tempToken: 'temp-1', type: 'totp' });
    });

    await act(async () => {
      await expect(captured!.resolveMfa('wrong')).rejects.toThrow('Verification failed');
    });

    expect(localStorage.getItem('kapwa_token')).toBeNull();
  });
});
