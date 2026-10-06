import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { api, REFRESH_TOKEN_KEY } from './api';
import { clearDraft } from '../hooks/useIntakeAutosave';
import { clearPendingIdPhoto } from './intake-id-photo';

interface User { id: string; email: string; fullName: string; role: string; phone?: string; agencyId?: string; mustChangePassword?: boolean; assignedBarangay?: string; }

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; tempToken: string } | User | void>;
  logout: () => void;
  loading: boolean;
  refresh: () => Promise<void>;
  mfaChallenge: { tempToken: string; type: 'totp' | 'sms' | 'email' } | null;
  resolveMfa: (code: string) => Promise<User | undefined>;
  resendMfa: () => Promise<boolean>;
  cancelMfa: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
// Use VITE_API_URL from api.ts — in dev this uses Vite's proxy /api to avoid CORS.
// Falls back to relative /api so the current origin handles the request.
const API = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kapwa_token'));
  const [loading, setLoading] = useState(true);
  const [mfaChallenge, setMfaChallenge] = useState<{ tempToken: string; type: 'totp' | 'sms' | 'email' } | null>(null);

  // Track the current user id in a ref so the mount-scoped logout/storage handlers
  // (which close over first-render values) can purge the right user's intake draft.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    if (token) fetchUser();
    else setLoading(false);
  }, [token]);

  // Subscribe to kapwa:auth:logout — the api client dispatches this when /auth/refresh fails
  // (single-flight 401 interceptor). Calling logout() clears token + user state.
  useEffect(() => {
    function handleLogout(e: Event) {
      const reason = (e as CustomEvent).detail?.reason || 'unknown';
      console.warn('Auth logout triggered:', reason);
      logout();
    }
    function handleStorage(e: StorageEvent) {
      if (e.key === 'kapwa_token' && !e.newValue) {
        if (userIdRef.current) clearDraft(userIdRef.current);
        setToken(null);
        setUser(null);
      }
    }
    window.addEventListener('kapwa:auth:logout', handleLogout);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('kapwa:auth:logout', handleLogout);
      window.removeEventListener('storage', handleStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUser() {
    try {
      const data = await api.get<{ user: User }>('/auth/me');
      if (data && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('kapwa_token');
        setToken(null);
      }
    } catch {
      // Don't clear user state on transient errors (429, 5xx, network).
      // Only clear when the api.ts interceptor handles a 401 and fires kapwa:auth:logout.
    }
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Login failed');
    }
    const data = await res.json();
    if (data.mfaRequired || data.otpRequired) {
      const type: 'totp' | 'sms' | 'email' = data.otpRequired
        ? 'sms'
        : (data.mfaMethod === 'email' ? 'email' : 'totp');
      setMfaChallenge({ tempToken: data.tempToken, type });
      return { mfaRequired: true as const, tempToken: data.tempToken };
    }
    localStorage.setItem('kapwa_token', data.accessToken);
    // Persist the refresh token too. api.ts reads REFRESH_TOKEN_KEY on the first
    // 401; when it is missing, refreshToken() takes its "nothing to refresh with"
    // branch and gives up, so the session died the moment the 1 h access token
    // expired — every later write returned 401 and a reload bounced to /login.
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function resolveMfa(code: string) {
    if (!mfaChallenge) return;
    const endpoint = mfaChallenge.type === 'sms'
      ? '/auth/login/otp-verify'
      : mfaChallenge.type === 'email'
        ? '/auth/mfa/email/verify'
        : '/auth/mfa/verify';
    const body = mfaChallenge.type === 'sms'
      ? { tempToken: mfaChallenge.tempToken, otpCode: code }
      : { tempToken: mfaChallenge.tempToken, code };
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Verification failed');
    const data = await res.json();
    localStorage.setItem('kapwa_token', data.accessToken);
    // Same as login: every issuance path goes through issueTokens, so this
    // response carries a refresh token that must be stored or the session
    // still dies at the access-token TTL.
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setToken(data.accessToken);
    setUser(data.user);
    setMfaChallenge(null);
    return data.user;
  }

  async function resendMfa() {
    if (!mfaChallenge || mfaChallenge.type !== 'email') return false;
    const res = await fetch(`${API}/auth/mfa/email/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: mfaChallenge.tempToken })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to resend code');
    }
    const data = await res.json().catch(() => ({}));
    return data.emailDelivered !== false;
  }

  function cancelMfa() {
    setMfaChallenge(null);
  }

  function logout() {
    // Purge the intake draft for the current user — PII must not survive a session
    // handoff on a shared field tablet.
    if (userIdRef.current) clearDraft(userIdRef.current);
    clearPendingIdPhoto();
    localStorage.removeItem('kapwa_token');
    // Also drop the refresh token: leaving it behind let a background 401
    // silently mint a new access token for an already logged-out user.
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Leave the authenticated shell even when the logout came from a background
    // 401/refresh failure (kapwa:auth:logout event), not just the Topbar button.
    // Without this the last-rendered protected page stays on screen until a
    // reload. Guard on the current path so the redirect can't loop: an already
    // unauthenticated guard navigates to the same destination.
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      // Lazy import breaks the static cycle routes.tsx -> auth-context.tsx;
      // the module is already loaded by the time logout() runs.
      import('../routes')
        .then(({ router }) => router.navigate('/login', { replace: true }))
        .catch(() => {
          // Router unavailable (embedded/test edge) — the ProtectedRoute
          // unauthenticated guard redirects on its own.
        });
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refresh: fetchUser, mfaChallenge, resolveMfa, resendMfa, cancelMfa }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
export async function getCurrentUser(signal?: AbortSignal) {
  const token = localStorage.getItem('kapwa_token');
  if (!token) return null;
  try {
    const d = await api.get<{ user: User }>('/auth/me', { signal });
    return d?.user ?? null;
  } catch {
    return null;
  }
}
