import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, X } from 'lucide-react';
import {
  KAPWA_ACCESS_DENIED_EVENT,
  type AccessDeniedDetail,
} from '@/lib/api';

interface AccessDeniedBannerProps {
  /** Clears the banner on navigation so a past refusal cannot haunt a new page. */
  routeKey?: string;
}

/**
 * Bodies that restate the refusal without adding anything. Appending these to
 * the banner title would read as "Access denied — Forbidden resource", which is
 * worse than saying nothing.
 */
const UNINFORMATIVE = new Set([
  'forbidden resource',
  'forbidden',
  'unauthorized resource',
]);

function isInformative(message: string): boolean {
  const m = message.trim().toLowerCase();
  return m.length > 0 && !UNINFORMATIVE.has(m);
}

/**
 * Persistent notice for a 403 refusal.
 *
 * A refused request otherwise renders as an empty table, which reads as "there
 * is nothing here" rather than "you may not see this". This keeps the server's
 * own reason on screen until dismissed or until the user navigates away.
 *
 * In-flow like SyncStatusBanner, not fixed: it pushes the topbar down instead of
 * overlaying it, so the account badge stays tappable.
 */
export function AccessDeniedBanner({ routeKey }: AccessDeniedBannerProps) {
  const { t } = useTranslation();
  const [denial, setDenial] = useState<AccessDeniedDetail | null>(null);

  useEffect(() => {
    const onDenied = (event: Event) => {
      setDenial((event as CustomEvent<AccessDeniedDetail>).detail);
    };
    window.addEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
    return () => window.removeEventListener(KAPWA_ACCESS_DENIED_EVENT, onDenied);
  }, []);

  const dismiss = useCallback(() => setDenial(null), []);
  useEffect(dismiss, [routeKey, dismiss]);

  if (!denial) return null;

  return (
    <div
      role="alert"
      data-testid="access-denied-banner"
      className="no-print flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-destructive"
    >
      <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-xs leading-snug">
        <span className="font-semibold">
          {t('accessDenied.title', 'Access denied — you do not have permission to view this.')}
        </span>
        {isInformative(denial.message) && <span className="ml-1">{denial.message}</span>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('accessDenied.dismiss', 'Dismiss access denied notice')}
        className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
