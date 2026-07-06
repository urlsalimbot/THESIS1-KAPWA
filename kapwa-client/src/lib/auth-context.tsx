import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User { id: string; email: string; fullName: string; role: string; }

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; tempToken: string } | void>;
  logout: () => void;
  loading: boolean;
  mfaChallenge: { tempToken: string } | null;
  resolveMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
// Base URL is centralized in src/lib/api.ts (reads VITE_API_URL there).
// Pre-auth flows (/auth/login, /auth/mfa/verify) stay on raw fetch (D-15) and use this local constant
// because they fire before the api client has a token to attach.
const API = 'http://localhost:3000/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kapwa_token'));
  const [loading, setLoading] = useState(true);
  const [mfaChallenge, setMfaChallenge] = useState<{ tempToken: string } | null>(null);

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
    window.addEventListener('kapwa:auth:logout', handleLogout);
    return () => window.removeEventListener('kapwa:auth:logout', handleLogout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUser() {
    try {
      // api.get reads kapwa_token from localStorage internally and surfaces non-2xx as ApiError
      const data = await api.get<{ user: User }>('/auth/me');
      if (data && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('kapwa_token');
        setToken(null);
      }
    } catch {
      // ApiError(401) from /auth/me (after refresh) OR TypeError (network) — both clear the user
      setUser(null);
    }
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    if (data.mfaRequired) {
      setMfaChallenge({ tempToken: data.tempToken });
      return { mfaRequired: true as const, tempToken: data.tempToken };
    }
    localStorage.setItem('kapwa_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function resolveMfa(code: string) {
    if (!mfaChallenge) return;
    const res = await fetch(`${API}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: mfaChallenge.tempToken, code })
    });
    if (!res.ok) throw new Error('MFA verification failed');
    const data = await res.json();
    localStorage.setItem('kapwa_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    setMfaChallenge(null);
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
