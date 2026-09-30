import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, uploadWithProgress, downloadFilingDoc, getFilingObjectUrl } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Upload, Download, Trash2, Loader2, MoreHorizontal } from 'lucide-react';

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
  /**
   * Extra controls rendered inside the single file row (on-site status). Injected
   * by callers that own per-document workflow state, so a document is never
   * listed twice just to carry that state.
   */
  renderDocExtras?: (doc: FilingDoc) => ReactNode;
  /**
   * Controls rendered in the preview dialog's footer. Actions that mean "I have
   * read this document" belong here, not on the row: a confirm button sitting
   * one row above its own file can be fired without ever opening the file.
   */
  renderPreviewFooter?: (doc: FilingDoc) => ReactNode;
}

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx';
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif']);

function extOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Classify a document by mime type *or* extension. An upload that lost its
 * recorded mimeType is still a PDF on disk, and treating it as unviewable would
 * silently downgrade a readable document to a download button.
 */
function docKind(doc: FilingDoc): 'image' | 'pdf' | 'other' {
  if (doc.mimeType?.startsWith('image/') || (!doc.mimeType && IMAGE_EXTS.has(extOf(doc.originalName || '')))) {
    return 'image';
  }
  if (doc.mimeType === 'application/pdf' || extOf(doc.originalName || '') === 'pdf') {
    return 'pdf';
  }
  return 'other';
}

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
  renderDocExtras,
  renderPreviewFooter,
}: FileUploadListProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inFlight, setInFlight] = useState<InFlight | null>(null);
  const [preview, setPreview] = useState<FilingDoc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const indent = compact ? 'pl-9' : '';
  const indentX = compact ? 'ml-9' : '';
  const accepted = new Set(
    accept.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean),
  );
  const previewKind = preview ? docKind(preview) : 'other';
  // "No bytes yet and no failure yet" is still loading — the effect that sets
  // previewLoading runs after the dialog's first paint, and without this an
  // image would flash a broken src in that gap.
  const previewBusy = previewLoading || (!!preview && !previewUrl && !previewFailed);

  useEffect(() => {
    const urls: Record<string, string> = {};
    let cancelled = false;
    const imageDocs = docs.filter((d) => docKind(d) === 'image');
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

  // The preview blob is tracked apart from the row thumbnails on purpose: the
  // thumbnail effect above re-runs on every list revalidation and revokes what
  // it created, which would blank an open preview mid-read.
  useEffect(() => {
    if (!preview) return;
    let revoked = false;
    let url: string | null = null;
    setPreviewUrl(null);
    setPreviewFailed(false);
    setPreviewLoading(true);
    (async () => {
      try {
        const fetched = await getFilingObjectUrl(preview.id);
        if (revoked) {
          URL.revokeObjectURL(fetched);
          return;
        }
        url = fetched;
        setPreviewUrl(fetched);
      } catch (e) {
        if (!revoked) {
          setPreviewFailed(true);
          toast.error(t('caseView.documents.previewFailed', 'Could not open the document'), {
            description: humanizeError(e),
          });
        }
      } finally {
        if (!revoked) setPreviewLoading(false);
      }
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview, t]);

  function closePreview() {
    setPreview(null);
    setPreviewUrl(null);
  }

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
      toast.error(t('caseView.documents.uploadFailed', 'Upload failed'), {
        description: t('caseView.documents.uploadFailedDesc', '{{name}} could not be uploaded. {{reason}}', {
          name: file.name,
          reason: humanizeError(e, 'Please check the file and try again.'),
        }),
      });
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
      toast.error(t('caseView.documents.removeFailed', 'Could not remove document'), {
        description: humanizeError(e),
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="px-3 pb-2 space-y-2">
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map(doc => {
            const isImage = docKind(doc) === 'image';
            const name = doc.originalName || doc.id;
            return (
              <div key={doc.id} className={`flex items-center gap-1.5 text-xs ${indent}`}>
                {isImage ? (
                  <img src={thumbs[doc.id]} alt="" className="h-8 w-8 rounded border object-cover shrink-0" />
                ) : (
                  <FileText size={16} className="shrink-0" />
                )}
                {/* The row itself is the preview target — no link styling, so it
                    cannot be mistaken for one of several similar-looking links. */}
                <button
                  type="button"
                  onClick={() => setPreview(doc)}
                  aria-label={t('caseView.documents.previewNamed', 'Preview {{name}}', { name })}
                  className="min-w-0 flex-1 cursor-pointer rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  title={t('caseView.documents.preview', 'Preview')}
                >
                  <span className="block truncate font-medium text-foreground">{name}</span>
                  <span className="block text-[10px] text-muted-foreground">{(doc.fileSize / 1024).toFixed(0)} KB</span>
                </button>
                {renderDocExtras?.(doc)}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 px-0"
                      aria-label={t('caseView.documents.actions', 'Actions')}
                    >
                      <MoreHorizontal size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => { downloadFilingDoc(doc.id, doc.originalName || 'document').catch(() =>
                        toast.error(t('caseView.documents.downloadFailed', 'Download failed')),
                      ); }}
                    >
                      <Download size={12} className="mr-1.5" aria-hidden="true" />
                      {t('caseView.documents.download', 'Download')}
                    </DropdownMenuItem>
                    {canUpload && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setRemoveId(doc.id)}
                      >
                        <Trash2 size={12} className="mr-1.5" aria-hidden="true" />
                        {t('caseView.documents.remove', 'Remove')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        </div>
      )}
      {canUpload && (
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          aria-label={t('caseView.documents.dropzone', 'Click to browse or drop files')}
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
        />
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

      <Dialog
        open={!!preview}
        onOpenChange={(open) => { if (!open) closePreview(); }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.originalName || preview?.id}</DialogTitle>
            <DialogDescription>
              {preview
                ? `${(preview.fileSize / 1024).toFixed(0)} KB${preview.mimeType ? ` · ${preview.mimeType}` : ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {previewBusy && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-busy="true">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {t('caseView.documents.previewLoading', 'Loading document…')}
            </div>
          )}

          {!previewBusy && previewFailed && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileText size={40} className="text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t('caseView.documents.previewUnavailable', 'This document could not be loaded.')}
              </p>
            </div>
          )}

          {!previewBusy && !previewFailed && preview && previewKind === 'image' && (
            <img
              src={previewUrl ?? undefined}
              alt={preview.originalName || preview.id}
              className="max-h-[70vh] w-full rounded border object-contain"
            />
          )}

          {/* A PDF blob URL renders in the browser's own viewer, so paging and
              zoom come for free and need no PDF dependency. */}
          {!previewBusy && !previewFailed && preview && previewKind === 'pdf' && previewUrl && (
            <iframe
              src={previewUrl}
              title={t('caseView.documents.previewNamed', 'Preview {{name}}', { name: preview.originalName || preview.id })}
              className="h-[70vh] w-full rounded border"
            />
          )}

          {!previewBusy && !previewFailed && preview && previewKind === 'other' && (
            /* No browser renders .doc/.docx, and handing the blob to
               window.open is not a preview: pop-up blockers eat it silently and
               it navigates the worker off the case. Say so and offer the file. */
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileText size={40} className="text-muted-foreground" aria-hidden="true" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {t('caseView.documents.notViewable', 'This file type cannot be shown in the browser. Download it to view.')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { downloadFilingDoc(preview.id, preview.originalName || 'document').catch(() =>
                  toast.error(t('caseView.documents.downloadFailed', 'Download failed')),
                ); }}
              >
                <Download size={14} className="mr-1.5" aria-hidden="true" />
                {t('caseView.documents.download', 'Download')}
              </Button>
            </div>
          )}

          {renderPreviewFooter && preview && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              {renderPreviewFooter(preview)}
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