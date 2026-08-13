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
import { useTranslation } from 'react-i18next';

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
  title,
  description,
}: BulkApproveDialogProps) {
  const { t } = useTranslation();
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
          <DialogTitle>{title || t('bulkActions.approveCases', 'Approve Cases')}</DialogTitle>
          <DialogDescription>
            {description || t('bulkActions.approveCount', 'You are about to approve {{count}} case(s).', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {t('bulkActions.selectedIds', 'Selected IDs: {{ids}}', { ids: selectedIds.slice(0, 5).join(', ') })}
            {selectedIds.length > 5 && t('bulkActions.andMore', ' and {{count}} more', { count: selectedIds.length - 5 })}
          </p>

          <div className="mt-4">
            <label htmlFor="reason" className="text-sm font-medium text-foreground">
              {t('bulkActions.reasonNotes', 'Reason / Notes (optional)')}
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('bulkActions.reasonPlaceholder', 'Add a reason for this bulk action...')}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('bulkActions.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? t('bulkActions.approving', 'Approving...') : t('bulkActions.confirm', 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
