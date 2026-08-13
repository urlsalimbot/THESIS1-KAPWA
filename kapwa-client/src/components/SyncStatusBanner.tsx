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
    ? 'bg-blue-500 text-white'
    : 'bg-amber-500 text-white';

  return (
    <button
      onClick={onOpenQueue}
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-1.5 text-center text-xs font-medium cursor-pointer ${bgClass}`}
      aria-label={t('sync.openQueue', 'Open sync queue')}
    >
      {bannerText}
    </button>
  );
}
