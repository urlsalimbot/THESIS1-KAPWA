import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { loadQueue, type QueuedChange } from '@/lib/offline-queue';

const QUEUE_KEY = 'kapwa_sync_queue';

interface ConflictResolutionDialogProps {
  item: QueuedChange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function removeQueueItem(id: string): void {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const items: QueuedChange[] = JSON.parse(raw);
  const filtered = items.filter(i => i.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

function updateQueueItem(id: string, updates: Partial<QueuedChange>): void {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const items: QueuedChange[] = JSON.parse(raw);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...updates };
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function ConflictResolutionDialog({ item, open, onOpenChange }: ConflictResolutionDialogProps) {
  if (!item) return null;

  const handleKeepLocal = () => {
    // Keep local changes — mark as pending to retry sync
    updateQueueItem(item.id, { status: 'pending', lastError: undefined, retryCount: 0 });
    onOpenChange(false);
  };

  const handleKeepServer = () => {
    // Accept server version — remove local change from queue
    removeQueueItem(item.id);
    onOpenChange(false);
  };

  const handleKeepBoth = () => {
    // Merge strategy: re-queue as pending with merge flag
    updateQueueItem(item.id, {
      status: 'pending',
      lastError: undefined,
      payload: { ...item.payload, mergeStrategy: 'both' as unknown },
    });
    onOpenChange(false);
  };

  const localPayload = item.payload || {};
  // For server payload, we show the same payload with a "server" context
  // In a real scenario this would come from the sync engine
  const serverPayload = item.payload || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Sync Conflict — {item.tableName} #{item.recordId}
          </DialogTitle>
          <DialogDescription>
            This item was modified by another user while you were offline. Choose how to resolve.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 text-foreground">Local (Your Changes)</h4>
            <ScrollArea className="h-40">
              <pre className="text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(localPayload, null, 2)}
              </pre>
            </ScrollArea>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 text-foreground">Server</h4>
            <ScrollArea className="h-40">
              <pre className="text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(serverPayload, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        </div>
        <Separator />
        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button variant="outline" onClick={handleKeepServer}>
            Keep Server
          </Button>
          <Button variant="default" onClick={handleKeepLocal}>
            Keep Local
          </Button>
          <Button variant="outline" onClick={handleKeepBoth}>
            Keep Both
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
