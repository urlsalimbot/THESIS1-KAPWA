# IRF & Announcements Photo Uploads — Design

**Date:** 2026-08-27
**Status:** Approved by user (2026-08-27)
**Scope:** kapwa-server (filing module + announcements public controller + migration) and kapwa-client (generalized upload component + IRF section + announcement photo UI).

## Problem

Neither the IRF nor Announcements support photos. The IRF needs evidence photos whose **viewing is admin-only** (uploads by workers+admins); Announcements need a public photo gallery whose **first photo acts as a cover** on announcement list cards.

## Storage & serving

### Server — filing module extension

1. **Migration**: add nullable `irf_id uuid` and `announcement_id uuid` columns to the filing document table.
2. **Entity**: `FilingDoc.irfId?: string`, `FilingDoc.announcementId?: string` (mapped to the new columns).
3. **Upload DTO** (`UploadMetadataSchema`): accept optional `irfId` and `announcementId`; `POST /filing/upload` persists them with the category.
4. **New endpoints:**
   - `GET /filing/irf/:irfId/photos` — `@Roles('admin')`; returns filing rows where `category = 'irf_photo' AND irf_id = :irfId` (order created_at ASC).
   - `GET /filing/announcements/:announcementId/photos` — `@Roles('admin','social_worker','coordinator')`; rows where `category = 'announcement_photo' AND announcement_id = :announcementId` (order ASC).
   - `GET /announcements/public/:slug/photos` — unguarded; rows for the announcement's published article (id, originalName, mimeType, fileSize only — no paths).
   - `GET /announcements/public/photo/:id` — unguarded stream; **only when the doc's category is `announcement_photo`**, otherwise 404 (prevents arbitrary file disclosure).
5. **Download gating** (`GET /filing/:id/download`): if the doc's `category === 'irf_photo'` and the caller's role is not `admin` → 403.
6. **Delete gating** (`DELETE /filing/:id`): if `category === 'irf_photo'` and not admin → 403; `announcement_photo` → manage roles (admin/social_worker/coordinator).

### Client — generalized upload component

- Extract the shared logic from `RequirementFileUpload` into **`FileUploadList`** (`kapwa-client/src/components/case-view/FileUploadList.tsx`):
  ```ts
  interface FileUploadListProps {
    docs: FilingDoc[];
    canUpload?: boolean;
    onChanged: () => void;
    formExtras: Record<string, string>;   // appended to the upload FormData (e.g. { caseId, requirementKey } | { category, irfId } | { category, announcementId })
    accept?: string;                       // default same accept list
    maxBytes?: number;                     // default 10 MB
    compact?: boolean;                     // pl-9 indentation for the requirement rows
  }
  ```
  Behavior (moved verbatim from RequirementFileUpload): dropzone, type/size validation, XHR `uploadWithProgress`, thumbnails (authenticated blob URLs via `getFilingObjectUrl`), preview modal, `downloadFilingDoc` download, remove confirm → `api.del(['filing', id])`, toasts.
- `RequirementFileUpload` becomes a thin wrapper over `FileUploadList` passing `formExtras={{ caseId, requirementKey }}` + `compact`.

### Client — IRF photos

- `IrfDetailPage`: new **"Evidence Photos"** section:
  - Admin: `FileUploadList` with `formExtras={{ category: 'irf_photo', irfId }}`, docs fetched from `GET /filing/irf/:irfId/photos`; upload allowed (worker+admin), remove allowed (admin).
  - Social workers (and auditors, who already see redacted IRFs): the section is hidden; the server additionally enforces admin-only listing/download.
- Only the IRF detail page hosts this (photos attach to an existing IRF).

### Client — announcement photos

- **Manage detail + edit page** (`AnnouncementDetailPage`, `AnnouncementEditPage`): "Photos" section with `FileUploadList` (`formExtras={{ category: 'announcement_photo', announcementId }}`), docs from `GET /filing/announcements/:id/photos`. (Create has no id yet — photos are added after the announcement exists.)
- **Public article** (`AnnouncementPage`): photo gallery under the body; fetch `GET /announcements/public/:slug/photos`, render thumbnails via `GET /announcements/public/photo/:id`; first photo = cover shown at the top.
- **List cards** (`AnnouncementsPage` manage list + `LatestAnnouncements` public landing): show the **cover (first photo)** at the top of each card when present.

## Cross-cutting

- i18n keys (en + fil): `irf.photos.*` and `announcements.photos.*` (title, empty, upload, cover label).
- Tests: server — migration columns, admin-only IRF photo list/download/delete gating, public announcement photo list + category-gated stream; client — `FileUploadList` behaviors (already covered via RequirementFileUpload tests, adjusted), IRF section admin-only rendering, announcement cover on cards.

## Explicitly NOT changing

- The IRF create page (photos attach to an existing IRF from the detail page).
- The case-stepper `RequirementFileUpload` public API (it becomes a wrapper; its call sites unchanged).
- The announcement create form (no photo upload before save; photos added on edit/detail).
- Minio (filing on-disk storage reused).

## Verification

- Server: `npx jest src/filing src/announcements src/irf --silent` + `npm run typecheck` (kapwa-server).
- Client: `npm run test:run` + `npm run typecheck` (kapwa-client); fil parity.