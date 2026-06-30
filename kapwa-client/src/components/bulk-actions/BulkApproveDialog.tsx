import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface BulkApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  onConfirm: (reason?: string) => void;
  title?: string;
  description?: string;
}

export function BulkApproveDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  onConfirm,
  title = 'Approve Cases',
  description,
}: BulkApproveDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(reason || undefined);
    } finally {
      setLoading(false);
      onOpenChange(false);
      setReason('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || `You are about to approve ${selectedCount} case${selectedCount === 1 ? '' : 's'}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Selected IDs: {selectedIds.slice(0, 5).join(', ')}
            {selectedIds.length > 5 && ` and ${selectedIds.length - 5} more`}
          </p>

          <div className="mt-4">
            <label htmlFor="reason" className="text-sm font-medium text-foreground">
              Reason / Notes (optional)
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a reason for this bulk action..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Approving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
