import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';
import { Button } from '@/components/ui/button';

// Reads the session from AuthProvider instead of fetching /auth/me per mount.
// The provider owns the single /auth/me call; navigating between routes no longer
// issues another request (which previously fanned out into 429s).
export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { t } = useTranslation();
  const { user, token, loading, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleKey = roles?.join(',') ?? '';

  const roleMismatch = !!user && !!roles?.length && !roles.includes(user.role);
  // A role with no entry in ROLE_REDIRECT_MAP has no home this client can send
  // it to. 16bda23 retired mayor/auditor/agency_staff from the shell while their
  // accounts still authenticate, so the old '/dashboard' fallback redirected to
  // a route that rejects the role — same path, same mismatch, forever. There is
  // no destination to navigate to, so the only honest exit is to end the session.
  const strandedRole = !!user && !ROLE_REDIRECT_MAP[user.role];

  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    // Token exists but /auth/me failed (429, 5xx, network): keep the session
    // alive. The api client fires kapwa:auth:logout only when refresh fails 401.
    if (!user) return;
    if (roleMismatch) {
      const home = ROLE_REDIRECT_MAP[user.role];
      if (home) {
        navigate(home, { replace: true });
      }
      return;
    }
    // Staff-provisioned accounts carry a temporary password: block every route
    // except Settings (which hosts Change Password) until it is changed.
    if (user.mustChangePassword && location.pathname !== '/settings') {
      navigate('/settings', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token, user, roleKey, location.pathname, navigate]);

  const mustChangeRedirect = !!user?.mustChangePassword && location.pathname !== '/settings';

  if (strandedRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldOff size={48} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-medium text-foreground">
          {t('shell.roleRetired', 'This account no longer has access to KAPWA.')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('shell.roleRetiredHint', 'Contact the MSWDO office to have your account updated.')}
        </p>
        <Button variant="outline" onClick={logout}>
          {t('topbar.logoutConfirm', 'Log out')}
        </Button>
      </div>
    );
  }

  // A token without a user means /auth/me has not succeeded yet (in flight, or a
  // transient 429/5xx). Render the gate, never the page: failing open here let a
  // throttled session load a route the role is not allowed — the API still 403s
  // the data, but the operator sees a screen they should not. The session is kept
  // (a 401 is what ends it) and, once the request has actually failed, the user
  // gets a retry instead of an indefinite wait.
  const sessionUnavailable = !!token && !user && !loading;

  if (loading || !token || !user || (roleMismatch && !strandedRole) || mustChangeRedirect) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <p>{t('shell.verifyingAccess', 'Verifying access...')}</p>
        {sessionUnavailable && (
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            {t('error.retry', 'Retry')}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
