# Case Stepper File Upload UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the case stepper's icon-only requirement-doc uploads with a polished shared component: drag-and-drop dropzone, validation, real upload progress (XHR), thumbnails + preview modal, and download/remove.

**Architecture:** Add an XHR `uploadWithProgress` helper to `lib/api.ts`; build a reusable `RequirementFileUpload` component (dropzone + inline doc list + preview/remove dialogs); wire it into `StepInterventions` and `StepImplementHIP`, removing their duplicated upload code. New i18n keys in en + fil.

**Tech Stack:** React 18 + TypeScript, Tailwind, shadcn/ui (Dialog, AlertDialog, Button, Badge), sonner, react-i18next, Vitest.

## Global Constraints

- Only these files may change: `kapwa-client/src/lib/api.ts`, `kapwa-client/src/components/case-view/RequirementFileUpload.tsx` (new), `RequirementFileUpload.test.tsx` (new), `StepInterventions.tsx`, `StepImplementHIP.tsx`, `src/i18n/locales/en/index.ts`, `src/i18n/locales/fil/index.ts`.
- i18n: every new key must exist in BOTH en and fil with identical `{{placeholder}}` sets, fil values differing from en (parity suite). No HTML tags in values.
- The working tree contains unrelated uncommitted changes (card-overlap bug fix + user docs edits) — commits must NOT include them.
- Server untouched: `POST /filing/upload`, `GET /filing?caseId=`, `DELETE /filing/:id` already exist.
- Test: `npm run test:run` and `npm run typecheck` from `kapwa-client/`.

---

### Task 1: XHR upload helper + `RequirementFileUpload` component + i18n keys

**Files:**
- Modify: `kapwa-client/src/lib/api.ts` (add `uploadWithProgress` export after `api.upload`)
- Create: `kapwa-client/src/components/case-view/RequirementFileUpload.tsx`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` (new `caseView.documents.*` keys)

**Interfaces:**
- Produces: `uploadWithProgress<T>(path, formData, onProgress: (percent: number) => void, opts?): Promise<T>` and `RequirementFileUpload({ caseId, requirementKey, canUpload?, docs, onChanged })`. Both consumed by Task 2.

- [ ] **Step 1: Add `uploadWithProgress` to `lib/api.ts`**

Append this export to `kapwa-client/src/lib/api.ts` right after the `api` object's closing `};` (after line 204):

```ts
export async function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}${normalizePath(path)}`;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort());
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(undefined as unknown as T);
        }
      } else {
        let body: unknown = null;
        try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        reject(new ApiError(xhr.status, body, xhr.statusText));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(formData);
  });
}
```

`API_BASE`, `normalizePath`, `getToken`, and `ApiError` are all already defined in this file.

- [ ] **Step 2: Create `RequirementFileUpload.tsx`**

Create `kapwa-client/src/components/case-view/RequirementFileUpload.tsx` with exactly this content:

```tsx
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
```

- [ ] **Step 3: Add i18n keys (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"caseView": {` → `"documents": {` object add:

```json
    "cancel": "Cancel",
    "download": "Download",
    "dropzone": "Click to browse or drop files",
    "openFile": "Open file",
    "preview": "Preview",
    "remove": "Remove",
    "removeConfirm": "Remove this document? This cannot be undone.",
    "removeFailed": "Failed to remove document",
    "removeTitle": "Remove document?",
    "removed": "Document removed",
    "sizeRejected": "{{name}} is larger than 10 MB",
    "typeRejected": "Unsupported file type: {{name}}",
    "uploadFailed": "Failed to upload {{name}}",
    "uploaded": "Uploaded {{name}}",
    "uploading": "Uploading {{name}}…",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the same `"documents": {` object add the fil equivalents:

```json
    "cancel": "Kanselahin",
    "download": "I-download",
    "dropzone": "I-click para mag-browse o mag-drop ng mga file",
    "openFile": "Buksan ang file",
    "preview": "Silipin",
    "remove": "Alisin",
    "removeConfirm": "Alisin ang dokumentong ito? Hindi ito maaaring i-undo.",
    "removeFailed": "Nabigong alisin ang dokumento",
    "removeTitle": "Alisin ang dokumento?",
    "removed": "Naalis ang dokumento",
    "sizeRejected": "Ang {{name}} ay mas malaki sa 10 MB",
    "typeRejected": "Hindi suportadong uri ng file: {{name}}",
    "uploadFailed": "Nabigong i-upload ang {{name}}",
    "uploaded": "Na-upload ang {{name}}",
    "uploading": "Ina-upload ang {{name}}…",
```

Check the existing `caseView.documents.*` keys in both locales first (there may already be a `documents` namespace with `downloadFailed` etc.) and insert the new keys alongside.

- [ ] **Step 4: Verify parity + typecheck**

Run: `npm run test:run -- src/i18n/__tests__/fil-parity.test.ts` then `npm run typecheck` (from `kapwa-client/`)
Expected: parity PASS; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/lib/api.ts kapwa-client/src/components/case-view/RequirementFileUpload.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: reusable requirement file upload with dropzone, progress, preview, and remove"
```

---

### Task 2: Wire `RequirementFileUpload` into the stepper steps + component test

**Files:**
- Modify: `kapwa-client/src/components/case-view/StepInterventions.tsx`
- Modify: `kapwa-client/src/components/case-view/StepImplementHIP.tsx`
- Create: `kapwa-client/src/components/case-view/RequirementFileUpload.test.tsx`

**Interfaces:**
- Consumes: `RequirementFileUpload`, `uploadWithProgress`, `FilingDoc` (Task 1).

- [ ] **Step 1: Update `StepInterventions.tsx`**

1. Add import: `import { RequirementFileUpload } from './RequirementFileUpload';`
2. Remove the now-unused pieces:
   - `const [uploading, setUploading] = useState<string | null>(null);` (line 81)
   - `const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});` (line 82)
   - the `handleUpload` function (lines 133-148)
   - from the lucide-react import: `Upload` (keep the rest); from `@/lib/api`: `downloadFilingDoc` if it becomes unused (check other usages in the file first).
3. In the requirement row, replace the whole `{canUpload && (<> <input .../> <Button .../> </>)}` block AND the `{uploadedDocs.length > 0 && (<div className="px-3 pb-2 space-y-1"> … </div>)}` doc list (lines 347-390) with a single component render (place it right after the row header `<div className="flex items-center gap-3 px-3 py-2 ...">` closes, i.e. inside the same requirement `<div key={req}>`):

```tsx
                  <RequirementFileUpload
                    caseId={caseId}
                    requirementKey={req}
                    canUpload={canUpload}
                    docs={uploadedDocs}
                    onChanged={() => globalMutate(`/filing?caseId=${caseId}`)}
                  />
```

Keep the row-header count badge (`uploadedDocs.length > 0 && <Badge …>`).

- [ ] **Step 2: Update `StepImplementHIP.tsx`**

Apply the identical changes:
1. Add `import { RequirementFileUpload } from './RequirementFileUpload';`
2. Remove `const [uploading, setUploading] = ...`, `const fileInputRefs = useRef(...)`, the `handleUpload` function, and the `Upload` lucide import (check remaining usages).
3. Replace the upload input+button block and the doc-list block (its file input is at lines 352-361, the doc list at 378-391) with the same `<RequirementFileUpload … />` render using the same `onChanged={() => globalMutate(`/filing?caseId=${caseId}`)}`.

- [ ] **Step 3: Create `RequirementFileUpload.test.tsx`**

Create `kapwa-client/src/components/case-view/RequirementFileUpload.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequirementFileUpload, type FilingDoc } from './RequirementFileUpload';
import { api } from '@/lib/api';

const { mockUpload, mockDel, mockUrl } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDel: vi.fn(),
  mockUrl: vi.fn((p: string) => 'https://cdn.test' + p),
}));

vi.mock('@/lib/api', () => ({
  api: { del: (...a: unknown[]) => mockDel(...a), url: (p: string) => mockUrl(p) },
  uploadWithProgress: (...args: unknown[]) => mockUpload(...args),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const docs: FilingDoc[] = [
  { id: 'd1', originalName: 'scan.png', fileSize: 2048, mimeType: 'image/png' },
  { id: 'd2', originalName: 'report.pdf', fileSize: 102400, mimeType: 'application/pdf' },
];

function renderUpload() {
  const onChanged = vi.fn();
  const utils = render(
    <RequirementFileUpload caseId="c1" requirementKey="req1" docs={docs} onChanged={onChanged} />,
  );
  return { ...utils, onChanged };
}

describe('RequirementFileUpload', () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockDel.mockReset();
    mockUpload.mockResolvedValue({ id: 'new' });
    mockDel.mockResolvedValue({});
  });

  it('renders existing docs with names and size', () => {
    renderUpload();
    expect(screen.getByText('scan.png')).toBeTruthy();
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
    expect(screen.getByText('100 KB')).toBeTruthy();
  });

  it('uploads a file with the correct form data', async () => {
    const { onChanged } = renderUpload();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'receipt.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [path, form, onProgress] = mockUpload.mock.calls[0];
    expect(path).toBe('/filing/upload');
    expect(form.get('caseId')).toBe('c1');
    expect(form.get('requirementKey')).toBe('req1');
    expect(form.get('file') instanceof File).toBe(true);
    expect(typeof onProgress).toBe('function');
    expect(onChanged).toHaveBeenCalled();
  });

  it('rejects an oversized file and does not upload', async () => {
    const { onChanged } = renderUpload();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [big], configurable: true });
    fireEvent.change(input);

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('confirming remove deletes the document', async () => {
    const { onChanged } = renderUpload();
    fireEvent.click(screen.getAllByLabelText('Remove')[0]);
    fireEvent.click(await screen.findByText('Remove'));
    expect(mockDel).toHaveBeenCalledWith(['filing', 'd1']);
    expect(onChanged).toHaveBeenCalled();
  });
});
```

(Adjust the `Remove` confirm-click selector to the AlertDialog's action if needed; the AlertDialog renders "Remove" as the action button text.)

- [ ] **Step 4: Run the new test + full suite + typecheck**

Run: `npm run test:run -- src/components/case-view/RequirementFileUpload.test.tsx` then `npm run test:run` then `npm run typecheck` (from `kapwa-client/`)
Expected: new tests pass; full suite green; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/case-view/StepInterventions.tsx kapwa-client/src/components/case-view/StepImplementHIP.tsx kapwa-client/src/components/case-view/RequirementFileUpload.test.tsx
git commit -m "feat: use RequirementFileUpload in case stepper steps"
```

---

## Self-Review

**1. Spec coverage:** XHR helper (Task 1 Step 1), dropzone+validation+progress+thumbnails+preview+remove component (Task 1 Step 2), i18n en+fil (Task 1 Step 3), both step call sites wired (Task 2 Steps 1-2), component test (Task 2 Step 3). "Explicitly NOT changing" respected — CaseViewPage Documents card, signatures, server untouched. ✓

**2. Placeholder scan:** All steps carry complete code/commands; no TBD/TODO. ✓

**3. Type consistency:** `uploadWithProgress` signature matches its call in `RequirementFileUpload`; `FilingDoc` exported and consumed by the test; `onChanged` invoked after upload/remove; `api.del(['filing', id])` matches the existing array-path pattern. ✓