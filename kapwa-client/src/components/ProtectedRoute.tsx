import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';

// Reads the session from AuthProvider instead of fetching /auth/me per mount.
// The provider owns the single /auth/me call; navigating between routes no longer
// issues another request (which previously fanned out into 429s).
export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { t } = useTranslation();
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleKey = roles?.join(',') ?? '';

  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    // Token exists but /auth/me failed (429, 5xx, network): keep the session
    // alive. The api client fires kapwa:auth:logout only when refresh fails 401.
    if (!user) return;
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      navigate(ROLE_REDIRECT_MAP[user.role] || '/dashboard', { replace: true });
      return;
    }
    // Staff-provisioned accounts carry a temporary password: block every route
    // except Settings (which hosts Change Password) until it is changed.
    if (user.mustChangePassword && location.pathname !== '/settings') {
      navigate('/settings', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token, user, roleKey, location.pathname, navigate]);

  const roleMismatch = !!user && !!roles?.length && !roles.includes(user.role);
  const mustChangeRedirect = !!user?.mustChangePassword && location.pathname !== '/settings';

  if (loading || !token || roleMismatch || mustChangeRedirect) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t('shell.verifyingAccess', 'Verifying access...')}</div>;
  }

  return <>{children}</>;
}
