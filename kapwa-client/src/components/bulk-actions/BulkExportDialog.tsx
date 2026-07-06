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
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export type ExportFormat = 'csv' | 'pdf';

export interface BulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onComplete?: () => void;
}

export function BulkExportDialog({
  open,
  onOpenChange,
  selectedIds,
  onComplete,
}: BulkExportDialogProps) {
  const [masked, setMasked] = useState(true);
  const [unmaskReason, setUnmaskReason] = useState('');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setError('');

    if (!masked && !unmaskReason.trim()) {
      setError('You must provide a reason for requesting unmasked data.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/cases/bulk-export', { ids: selectedIds, format, masked, unmaskReason: masked ? null : unmaskReason.trim() });
      onOpenChange(false);
      setUnmaskReason('');
      setMasked(true);
      onComplete?.();
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Cases</DialogTitle>
          <DialogDescription>
            Export {selectedIds.length} case{selectedIds.length === 1 ? '' : 's'}.
            PII is masked by default per data protection policy.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label>Format</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="accent-primary"
                />
                CSV
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  className="accent-primary"
                />
                PDF
              </label>
            </div>
          </div>

          <div>
            <Label>PII Masking</Label>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="masking"
                  checked={masked}
                  onChange={() => setMasked(true)}
                  className="accent-primary"
                />
                Masked (default)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="masking"
                  checked={!masked}
                  onChange={() => setMasked(false)}
                  className="accent-primary"
                />
                Unmasked
              </label>
            </div>
          </div>

          {!masked && (
            <div>
              <Label htmlFor="unmaskReason">
                Justification for Unmasked Export
              </Label>
              <p className="text-xs text-muted-foreground mb-1">
                State your justification for requesting unmasked data (logged to audit trail).
              </p>
              <Textarea
                id="unmaskReason"
                value={unmaskReason}
                onChange={(e) => setUnmaskReason(e.target.value)}
                placeholder="e.g., Court order #12345 requires full beneficiary details..."
                className="mt-1"
                rows={3}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
