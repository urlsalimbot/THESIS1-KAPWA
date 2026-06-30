import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadQueue, type QueuedChange } from '@/lib/offline-queue';
import { Clock, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Trash2, Eye } from 'lucide-react';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

const QUEUE_KEY = 'kapwa_sync_queue';
const POLL_INTERVAL = 2000;

interface SyncQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

// Helper: update a single queue item
function updateQueueItem(id: string, updates: Partial<QueuedChange>): void {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const items: QueuedChange[] = JSON.parse(raw);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...updates };
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

// Helper: remove a queue item
function removeQueueItem(id: string): void {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const items: QueuedChange[] = JSON.parse(raw);
  const filtered = items.filter(i => i.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ${mins % 60} min ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function operationLabel(op: string): string {
  switch (op) {
    case 'INSERT': return 'INSERT';
    case 'UPDATE': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return op;
  }
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  syncing: 'default',
  failed: 'destructive',
  conflict: 'outline',
};

const statusBadgeClass: Record<string, string> = {
  pending: '',
  syncing: '',
  failed: '',
  conflict: 'border-orange-500 text-orange-600',
};

export function SyncQueuePanel({ open, onClose }: SyncQueuePanelProps) {
  const [items, setItems] = useState<QueuedChange[]>([]);
  const [conflictItem, setConflictItem] = useState<QueuedChange | null>(null);
  const itemsRef = useRef<string>('');

  const refreshItems = useCallback(() => {
    const loaded = loadQueue();
    const hash = JSON.stringify(loaded);
    if (hash !== itemsRef.current) {
      itemsRef.current = hash;
      setItems(loaded);
    }
  }, []);

  // Poll every 2s when open
  useEffect(() => {
    if (!open) return;
    refreshItems();
    const interval = setInterval(refreshItems, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      itemsRef.current = '';
    };
  }, [open, refreshItems]);

  // Listen for storage events (cross-tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === QUEUE_KEY) refreshItems();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshItems]);

  const handleRetry = (id: string) => {
    updateQueueItem(id, { status: 'pending', lastError: undefined, retryCount: 0 });
    refreshItems();
  };

  const handleRemove = (id: string, label: string) => {
    if (window.confirm(`Remove sync item: This will discard this operation. You may lose data. Continue?`)) {
      removeQueueItem(id);
      refreshItems();
    }
  };

  const handleResolveConflict = (id: string) => {
    removeQueueItem(id);
    setConflictItem(null);
    refreshItems();
  };

  const pending = items.filter(i => i.status === 'pending');
  const syncing = items.filter(i => i.status === 'syncing');
  const failed = items.filter(i => i.status === 'failed');
  const conflicts = items.filter(i => i.status === 'conflict');

  const hasItems = items.length > 0;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-[380px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Sync Queue</SheetTitle>
            <SheetDescription>
              {hasItems ? `${items.length} pending change(s)` : 'No pending sync operations'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
            {!hasItems ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <CheckCircle2 size={40} className="text-muted-foreground" />
                <p className="text-base font-medium">All caught up</p>
                <p className="text-sm text-muted-foreground">No pending sync operations.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending group */}
                {pending.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Pending ({pending.length})
                    </h4>
                    {pending.map(item => (
                      <QueueItemCard
                        key={item.id}
                        item={item}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onViewConflict={() => setConflictItem(item)}
                      />
                    ))}
                  </div>
                )}

                {/* Syncing group */}
                {syncing.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Syncing ({syncing.length})
                    </h4>
                    {syncing.map(item => (
                      <QueueItemCard
                        key={item.id}
                        item={item}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onViewConflict={() => setConflictItem(item)}
                      />
                    ))}
                  </div>
                )}

                {/* Failed group */}
                {failed.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Failed ({failed.length})
                    </h4>
                    {failed.map(item => (
                      <QueueItemCard
                        key={item.id}
                        item={item}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onViewConflict={() => setConflictItem(item)}
                      />
                    ))}
                  </div>
                )}

                {/* Conflict group */}
                {conflicts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Conflicts ({conflicts.length})
                    </h4>
                    {conflicts.map(item => (
                      <QueueItemCard
                        key={item.id}
                        item={item}
                        onRetry={handleRetry}
                        onRemove={handleRemove}
                        onViewConflict={() => setConflictItem(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ConflictResolutionDialog
        item={conflictItem}
        open={conflictItem !== null}
        onOpenChange={(v) => { if (!v) setConflictItem(null); }}
      />
    </>
  );
}

// --- Queue Item Card ---

interface QueueItemCardProps {
  item: QueuedChange;
  onRetry: (id: string) => void;
  onRemove: (id: string, label: string) => void;
  onViewConflict: () => void;
}

function QueueItemCard({ item, onRetry, onRemove, onViewConflict }: QueueItemCardProps) {
  const isSyncing = item.status === 'syncing';
  const isConflict = item.status === 'conflict';
  const isFailed = item.status === 'failed';

  const statusIcon = isSyncing ? (
    <RefreshCw size={16} className="text-blue-500 animate-spin" />
  ) : isFailed ? (
    <XCircle size={16} className="text-destructive shrink-0" />
  ) : isConflict ? (
    <AlertTriangle size={16} className="text-orange-500 shrink-0" />
  ) : (
    <Clock size={16} className="text-muted-foreground shrink-0" />
  );

  const statusLabel = isSyncing ? 'Syncing…' : item.status === 'failed' ? 'Sync failed' : item.status === 'conflict' ? 'Conflict' : 'Pending';

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card mb-2">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">{operationLabel(item.operation)}</span>
          <Badge
            variant={statusBadgeVariant[item.status] || 'secondary'}
            className={statusBadgeClass[item.status] || ''}
          >
            {statusLabel}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground truncate">
          {item.tableName} #{item.recordId}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTimestamp(item.clientUpdatedAt)}
        </p>
        {item.lastError && (
          <p className="text-xs text-destructive mt-1 truncate">{item.lastError}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isFailed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRetry(item.id)}
            title="Retry Sync"
            aria-label="Retry Sync"
          >
            <RefreshCw size={16} />
          </Button>
        )}
        {isConflict && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onViewConflict}
            title="View Diff"
            aria-label="View Diff"
          >
            <Eye size={16} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.id, `${item.tableName} #${item.recordId}`)}
          title="Remove Item"
          aria-label="Remove Item"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}
