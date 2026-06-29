interface SyncStatusBannerProps {
  pendingCount: number;
  isOnline: boolean;
  onOpenQueue: () => void;
}

export function SyncStatusBanner({ pendingCount, isOnline, onOpenQueue }: SyncStatusBannerProps) {
  // When online and no pending items, hidden
  if (isOnline && pendingCount === 0) return null;

  const bannerText = isOnline
    ? `${pendingCount} change(s) pending sync`
    : `You are offline — ${pendingCount} change(s) pending sync`;

  const bgClass = isOnline
    ? 'bg-blue-500 text-white'
    : 'bg-amber-500 text-white';

  return (
    <button
      onClick={onOpenQueue}
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-1.5 text-center text-xs font-medium cursor-pointer ${bgClass}`}
      aria-label="Open sync queue"
    >
      {bannerText}
    </button>
  );
}
