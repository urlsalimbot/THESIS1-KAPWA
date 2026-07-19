import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User { id: string; email: string; fullName: string; role: string; phone?: string; }

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; tempToken: string } | User | void>;
  logout: () => void;
  loading: boolean;
  mfaChallenge: { tempToken: string; type: 'totp' | 'sms' } | null;
  resolveMfa: (code: string) => Promise<User | undefined>;
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
  const [mfaChallenge, setMfaChallenge] = useState<{ tempToken: string; type: 'totp' | 'sms' } | null>(null);

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
      const type = data.otpRequired ? 'sms' : 'totp';
      setMfaChallenge({ tempToken: data.tempToken, type });
      return { mfaRequired: true as const, tempToken: data.tempToken };
    }
    localStorage.setItem('kapwa_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function resolveMfa(code: string) {
    if (!mfaChallenge) return;
    const endpoint = mfaChallenge.type === 'sms' ? '/auth/login/otp-verify' : '/auth/mfa/verify';
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
    setToken(data.accessToken);
    setUser(data.user);
    setMfaChallenge(null);
    return data.user;
  }

  function cancelMfa() {
    setMfaChallenge(null);
  }

  function logout() {
    localStorage.removeItem('kapwa_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, mfaChallenge, resolveMfa, cancelMfa }}>
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
