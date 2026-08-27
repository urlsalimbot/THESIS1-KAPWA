# Case Stepper File Upload UI/UX — Design

**Date:** 2026-08-27
**Status:** Approved by user (2026-08-27; subagent-driven execution)
**Scope:** kapwa-client only. Shared `RequirementFileUpload` component + XHR progress helper + the two case-stepper call sites.

## Problem

The case stepper's requirement-document uploads (`StepInterventions` and `StepImplementHIP`) share an identical, minimal UX: a tiny icon-only ghost button + hidden `type="file"` per requirement row, an indeterminate spinner while uploading, no file validation feedback, no success/error toasts (failures are `console.error`-silent), no drag-and-drop, no remove/delete, no preview, and the upload logic + doc list are duplicated across the two components.

## Changes

### 1. `kapwa-client/src/lib/api.ts` — add XHR upload with progress

Add an `uploadWithProgress` helper (XMLHttpRequest POST, `Authorization` header, `upload.onprogress → percentage`):

```ts
export async function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void,
  opts?: { signal?: AbortSignal },
): Promise<T>
```

Reuses `API_BASE` + `normalizePath`; throws `ApiError` on non-OK; calls `onProgress(0..100)`.

### 2. New component `kapwa-client/src/components/case-view/RequirementFileUpload.tsx`

```ts
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
  onChanged: () => void;   // revalidate the filing list
}
```

Behavior:
- **Dropzone**: dashed rounded border with an upload icon + "Click to browse or drop files" (reuses existing i18n pattern); click opens a hidden `<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx">`; drag-over shows a highlighted state; drop uploads the files. Rendered only when `canUpload`.
- **Validation**: per file — extension must be in the accept list, size ≤ 10 MB; otherwise `toast.error` and skip.
- **Upload**: files upload sequentially via `uploadWithProgress('/filing/upload', formData, pct => …)`; the form appends `file`, `caseId`, `requirementKey`. Each in-flight file shows an inline progress bar + percent. On success `toast.success('Uploaded <name>')` and call `onChanged()`; on failure `toast.error`.
- **Inline doc list**: for each doc — image thumbnail `<img>` when `mimeType` starts with `image/`, else `FileText` icon; name (truncated), size in KB; actions: **preview** (opens modal), **download** (via `api.url('/filing/:id/download')`), **remove** (confirm dialog → `api.del('/filing/:id')` → `onChanged()`).
- **Preview modal**: dialog showing the image inline when `image/*`; PDF/others render an "Open file" link to the download URL.
- `count` badge moved from the call sites into the component header row.

### 3. `StepInterventions.tsx` and `StepImplementHIP.tsx`

- Replace the per-row `<input type="file">` + ghost upload button + uploaded-docs list with:
  `<RequirementFileUpload caseId={caseId} requirementKey={req} docs={uploadedDocs} canUpload={canUpload} onChanged={() => globalMutate('/filing?caseId=' + caseId)} />`
- Remove the now-dead `handleUpload`, `uploading` state, `fileInputRefs`, `fileInputRefs.current` refs, and the duplicated doc-list JSX from both components.
- Keep the requirement row checkbox/name layout; the component renders below the row header.

### 4. i18n (en + fil)

New keys (both locales, fil values differing; no HTML tags; placeholders mirrored):
- `caseView.documents.dropzone` — "Click to browse or drop files"
- `caseView.documents.uploading` — "Uploading {{name}}…"
- `caseView.documents.uploaded` — "Uploaded {{name}}"
- `caseView.documents.uploadFailed` — "Failed to upload {{name}}"
- `caseView.documents.typeRejected` — "Unsupported file type: {{name}}"
- `caseView.documents.sizeRejected` — "{{name}} is larger than 10 MB"
- `caseView.documents.preview` — "Preview"
- `caseView.documents.openFile` — "Open file"
- `caseView.documents.removeConfirm` — "Remove this document? This cannot be undone."
- `caseView.documents.remove` — "Remove"
- `caseView.documents.download` — "Download"

## Explicitly NOT changing

- CaseViewPage Documents card (read-only list; may reuse the list rows later).
- Signatures (canvas-drawn, not file uploads) and the `/minio/upload` helpers.
- Server (filing endpoints `POST /filing/upload`, `GET /filing`, `DELETE /filing/:id` already exist).

## Testing

- New `kapwa-client/src/components/case-view/RequirementFileUpload.test.tsx`: renders existing docs with thumbnails/icon; clicking the dropzone triggers the file input; uploading calls `uploadWithProgress` with the right form data and shows success; oversized/unsupported files are rejected with a toast; remove shows a confirm then calls `api.del`.
- Full client suite + `tsc` stay green.