import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth-context';

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

  useEffect(() => {
    checkAuth();
  }, [navigate, roles]);

  async function checkAuth() {
    const token = localStorage.getItem('kapwa_token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) {
        localStorage.removeItem('kapwa_token');
        navigate('/login', { replace: true });
        return;
      }

      if (roles && roles.length > 0 && !roles.includes(user.role)) {
        navigate(roleRedirectMap[user.role] || '/dashboard', { replace: true });
        return;
      }

      setAuthorized(true);
    } catch {
      // Network error — backend unreachable. Don't redirect, let the page render.
      // The app components will handle offline state gracefully.
      setAuthorized(true);
    }
  }

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Verifying access...</div>;
  }

  return <>{children}</>;
}
