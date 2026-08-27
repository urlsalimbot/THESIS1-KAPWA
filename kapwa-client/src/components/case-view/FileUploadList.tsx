import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, uploadWithProgress, downloadFilingDoc, getFilingObjectUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Upload, Download, Trash2, Loader2 } from 'lucide-react';

export interface FilingDoc {
  id: string;
  originalName?: string;
  fileSize: number;
  mimeType?: string;
}

export interface FileUploadListProps {
  docs: FilingDoc[];
  canUpload?: boolean;
  onChanged: () => void;
  formExtras: Record<string, string>;
  accept?: string;
  maxBytes?: number;
  compact?: boolean;
}

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx';
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

interface InFlight {
  name: string;
  percent: number;
}

export function FileUploadList({
  docs,
  canUpload = true,
  onChanged,
  formExtras,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX_BYTES,
  compact = false,
}: FileUploadListProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [preview, setPreview] = useState<FilingDoc | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const indent = compact ? 'pl-9' : '';
  const indentX = compact ? 'ml-9' : '';
  const accepted = new Set(
    accept.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean),
  );

  useEffect(() => {
    const urls: Record<string, string> = {};
    let cancelled = false;
    const imageDocs = docs.filter((d) => d.mimeType?.startsWith('image/'));
    (async () => {
      for (const d of imageDocs) {
        try {
          const url = await getFilingObjectUrl(d.id);
          if (!cancelled) urls[d.id] = url;
        } catch { /* skip broken thumbnail */ }
      }
      if (!cancelled) setThumbs((prev) => ({ ...prev, ...urls }));
    })();
    return () => {
      cancelled = true;
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

  function validate(file: File): string | null {
    if (!accepted.has(extOf(file.name))) {
      return t('caseView.documents.typeRejected', 'Unsupported file type: {{name}}', { name: file.name });
    }
    if (file.size > maxBytes) {
      return t('caseView.documents.sizeRejected', '{{name}} is larger than 10 MB', { name: file.name });
    }
    return null;
  }

  async function uploadOne(file: File) {
    const err = validate(file);
    if (err) {
      toast.error(err);
      return;
    }
    setInFlight({ name: file.name, percent: 0 });
    try {
      const form = new FormData();
      form.append('file', file);
      for (const [k, v] of Object.entries(formExtras)) form.append(k, v);
      await uploadWithProgress('/filing/upload', form, (pct) => setInFlight({ name: file.name, percent: pct }));
      toast.success(t('caseView.documents.uploaded', 'Uploaded {{name}}', { name: file.name }));
      onChanged();
    } catch (e: any) {
      toast.error(
        t('caseView.documents.uploadFailed', 'Failed to upload {{name}}', { name: file.name }) +
          (e?.message ? `: ${e.message}` : ''),
      );
    } finally {
      setInFlight(null);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      await uploadOne(f);
    }
  }

  async function confirmRemove() {
    if (!removeId) return;
    setRemoving(true);
    try {
      await api.del(['filing', removeId]);
      toast.success(t('caseView.documents.removed', 'Document removed'));
      setRemoveId(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || t('caseView.documents.removeFailed', 'Failed to remove document'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="px-3 pb-2 space-y-2">
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map(doc => {
            const isImage = doc.mimeType?.startsWith('image/');
            return (
              <div key={doc.id} className={`flex items-center gap-2 text-xs text-muted-foreground ${indent}`}>
                {isImage ? (
                  <img src={thumbs[doc.id]} alt="" className="h-8 w-8 rounded border object-cover" />
                ) : (
                  <FileText size={16} className="shrink-0" />
                )}
                <button
                  onClick={() => setPreview(doc)}
                  className="min-w-0 flex-1 text-left hover:underline"
                  title={t('caseView.documents.preview', 'Preview')}
                >
                  <span className="block truncate">{doc.originalName || doc.id}</span>
                  <span className="text-[10px]">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={() => downloadFilingDoc(doc.id, doc.originalName || 'document').catch(() =>
                    toast.error(t('caseView.documents.downloadFailed', 'Download failed')),
                  )}
                  aria-label={t('caseView.documents.download', 'Download')}
                >
                  <Download size={12} />
                </Button>
                {canUpload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-destructive"
                    onClick={() => setRemoveId(doc.id)}
                    aria-label={t('caseView.documents.remove', 'Remove')}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canUpload && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          role="button"
          tabIndex={0}
          className={`${indentX} flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
          }`}
        >
          <Upload size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{t('caseView.documents.dropzone', 'Click to browse or drop files')}</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {inFlight && (
        <div className={`${indentX} space-y-1`}>
          <div className="flex items-center gap-2 text-xs">
            <Loader2 size={12} className="animate-spin" />
            <span className="truncate">{t('caseView.documents.uploading', 'Uploading {{name}}…', { name: inFlight.name })}</span>
            <span className="ml-auto tabular-nums">{Math.round(inFlight.percent)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${inFlight.percent}%` }} />
          </div>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.originalName || preview?.id}</DialogTitle>
            <DialogDescription>{preview ? `${(preview.fileSize / 1024).toFixed(0)} KB` : ''}</DialogDescription>
          </DialogHeader>
          {preview?.mimeType?.startsWith('image/') ? (
            <img src={thumbs[preview.id]} alt={preview?.originalName} className="max-h-[60vh] w-full rounded border object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText size={40} className="text-muted-foreground" />
              <Button variant="outline" size="sm" onClick={async () => {
                if (!preview) return;
                try {
                  window.open(await getFilingObjectUrl(preview.id), '_blank');
                } catch {
                  toast.error(t('caseView.documents.downloadFailed', 'Download failed'));
                }
              }}>
                {t('caseView.documents.openFile', 'Open file')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(open) => { if (!open) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('caseView.documents.removeTitle', 'Remove document?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('caseView.documents.removeConfirm', 'Remove this document? This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('caseView.documents.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removing}>
              {t('caseView.documents.remove', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}