import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as auth from '../lib/auth-context';

const roleRedirectMap: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
};

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (checkingRef.current) return;
    checkAuth();
  }, [navigate, roles]);

  async function checkAuth() {
    checkingRef.current = true;
    const token = localStorage.getItem('kapwa_token');
    if (!token) {
      checkingRef.current = false;
      navigate('/login', { replace: true });
      return;
    }

    const user = await auth.getCurrentUser();
    if (!user) {
      const storedToken = localStorage.getItem('kapwa_token');
      if (storedToken) {
        // Token exists but /auth/me failed (429, 5xx, network).
        // The api.ts interceptor will fire kapwa:auth:logout if refresh fails with 401.
        // Keep the session alive — don't de-auth on transient errors.
        setAuthorized(true);
        checkingRef.current = false;
        return;
      }
      checkingRef.current = false;
      navigate('/login', { replace: true });
      return;
    }

    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      checkingRef.current = false;
      navigate(roleRedirectMap[user.role] || '/dashboard', { replace: true });
      return;
    }

    setAuthorized(true);
    checkingRef.current = false;
  }

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Verifying access...</div>;
  }

  return <>{children}</>;
}
