import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, uploadWithProgress } from '@/lib/api';
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

interface RequirementFileUploadProps {
  caseId: string;
  requirementKey: string;
  canUpload?: boolean;
  docs: FilingDoc[];
  onChanged: () => void;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx';
const ACCEPTED = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx']);
const MAX_BYTES = 10 * 1024 * 1024;

interface InFlight {
  name: string;
  percent: number;
}

export function RequirementFileUpload({
  caseId,
  requirementKey,
  canUpload = true,
  docs,
  onChanged,
}: RequirementFileUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [preview, setPreview] = useState<FilingDoc | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
  const downloadUrl = (id: string) => api.url(`/filing/${id}/download`);

  function validate(file: File): string | null {
    if (!ACCEPTED.has(extOf(file.name))) {
      return t('caseView.documents.typeRejected', 'Unsupported file type: {{name}}', { name: file.name });
    }
    if (file.size > MAX_BYTES) {
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
      form.append('caseId', caseId);
      form.append('requirementKey', requirementKey);
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
              <div key={doc.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
                {isImage ? (
                  <img src={downloadUrl(doc.id)} alt="" className="h-8 w-8 rounded border object-cover" />
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
                  onClick={() => window.open(downloadUrl(doc.id), '_blank')}
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
          className={`ml-9 flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
          }`}
        >
          <Upload size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{t('caseView.documents.dropzone', 'Click to browse or drop files')}</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {inFlight && (
        <div className="ml-9 space-y-1">
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
            <img src={downloadUrl(preview.id)} alt={preview?.originalName} className="max-h-[60vh] w-full rounded border object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText size={40} className="text-muted-foreground" />
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl(preview?.id || '')} target="_blank" rel="noreferrer">
                  {t('caseView.documents.openFile', 'Open file')}
                </a>
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