import { useTranslation } from 'react-i18next';

interface SyncStatusBannerProps {
  pendingCount: number;
  isOnline: boolean;
  onOpenQueue: () => void;
}

export function SyncStatusBanner({ pendingCount, isOnline, onOpenQueue }: SyncStatusBannerProps) {
  const { t } = useTranslation();
  // When online and no pending items, hidden
  if (isOnline && pendingCount === 0) return null;

  const bannerText = isOnline
    ? t('sync.pendingChanges', '{{count}} change(s) pending sync', { count: pendingCount })
    : t('sync.offlinePendingChanges', 'You are offline — {{count}} change(s) pending sync', { count: pendingCount });

  const bgClass = isOnline
    ? 'bg-primary/50 text-white'
    : 'bg-amber-500 text-white';

  return (
    <button
      type="button"
      onClick={onOpenQueue}
      // In-flow (not fixed): the strip pushes the topbar down instead of
      // overlaying it, so the account badge and the rest of the header stay
      // tappable while offline or syncing. `min-h-0` keeps it a thin strip —
      // the global 44px button min-height would otherwise cover the header.
      className={`no-print w-full shrink-0 min-h-0 px-4 py-1.5 text-center text-xs font-medium cursor-pointer ${bgClass}`}
      aria-label={t('sync.openQueue', 'Open sync queue')}
    >
      {bannerText}
    </button>
  );
}
