const AUTH_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'current_user';

export interface AuthUser {
  id: string;
  email: string;
  role: 'social_worker' | 'admin' | 'coordinator' | 'claimant' | 'mayor' | 'auditor';
  fullName?: string;
}

export async function saveAuthToken(token: string, refreshToken: string, user: AuthUser): Promise<void> {
  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem(AUTH_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return localStorage.getItem(REFRESH_KEY);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export async function clearAuth(): Promise<void> {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function refreshAuthToken(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;

  try {
    const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refresh}` }
    });

    if (!res.ok) {
      await clearAuth();
      return false;
    }

    const data = await res.json() as { accessToken: string };
    localStorage.setItem(AUTH_KEY, data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export function hasPermission(user: AuthUser | null, requiredRole: string[]): boolean {
  if (!user) return false;
  return requiredRole.includes(user.role);
}