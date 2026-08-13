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
import { useTranslation } from 'react-i18next';

export type ExportFormat = 'csv';

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
  const { t } = useTranslation();
  const [masked, setMasked] = useState(true);
  const [unmaskReason, setUnmaskReason] = useState('');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setError('');

    if (!masked && !unmaskReason.trim()) {
      setError(t('bulkActions.unmaskReasonRequired', 'You must provide a reason for requesting unmasked data.'));
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}/cases/bulk-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: selectedIds,
          format,
          masked,
          unmaskReason: masked ? null : unmaskReason.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'cases-bulk-export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      onOpenChange(false);
      setUnmaskReason('');
      setMasked(true);
      onComplete?.();
    } catch (err: any) {
      setError(err?.message || t('bulkActions.exportFailed', 'Export failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bulkActions.exportCases', 'Export Cases')}</DialogTitle>
          <DialogDescription>
            {t('bulkActions.exportCount', 'Export {{count}} case(s).', { count: selectedIds.length })}
            {' '}
            {t('bulkActions.maskPolicy', 'PII is masked by default per data protection policy.')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label>{t('bulkActions.format', 'Format')}</Label>
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
            </div>
          </div>

          <div>
            <Label>{t('bulkActions.piiMasking', 'PII Masking')}</Label>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="masking"
                  checked={masked}
                  onChange={() => setMasked(true)}
                  className="accent-primary"
                />
                {t('bulkActions.masked', 'Masked (default)')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="masking"
                  checked={!masked}
                  onChange={() => setMasked(false)}
                  className="accent-primary"
                />
                {t('bulkActions.unmasked', 'Unmasked')}
              </label>
            </div>
          </div>

          {!masked && (
            <div>
              <Label htmlFor="unmaskReason">
                {t('bulkActions.unmaskJustification', 'Justification for Unmasked Export')}
              </Label>
              <p className="text-xs text-muted-foreground mb-1">
                {t('bulkActions.unmaskHint', 'State your justification for requesting unmasked data (logged to audit trail).')}
              </p>
              <Textarea
                id="unmaskReason"
                value={unmaskReason}
                onChange={(e) => setUnmaskReason(e.target.value)}
                placeholder={t('bulkActions.unmaskPlaceholder', 'e.g., Court order #12345 requires full beneficiary details...')}
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
            {t('bulkActions.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? t('bulkActions.exporting', 'Exporting...') : t('bulkActions.export', 'Export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
