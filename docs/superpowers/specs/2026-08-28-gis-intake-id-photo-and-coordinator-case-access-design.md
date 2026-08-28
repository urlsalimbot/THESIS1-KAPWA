# GIS Intake ID Photo + Coordinator Case-Access Removal — Design

Date: 2026-08-28
Status: Approved

## Goal

1. Add an **optional, single government-ID photo** to the GIS Intake Form. The file is picked on the intake form, carried through the flow, and uploaded to the newly created case once it exists. The photo then appears on the case (viewable by admin/social_worker only).
2. **Remove all case access for coordinators** (server-enforced + client routes), including the case tracker. Coordinators keep their coordinator-dashboard, referrals, and announcement-management surfaces.

## Background

- The GIS intake is the client-registration flow: `IntakePage` → Beneficiary + Claimant + Family Composition → submit. Submission has two paths:
  - No prior-record match → `POST /intake` returns `{ caseId, controlNo }` immediately.
  - A prior-record match → flow detours to `/intake/review`; the `caseId` is created only when the worker confirms a match (`POST /intake/confirm/:householdId`) or chooses "continue as new client" (`POST /intake`).
- There is **no attachment UI** on the intake form today. A `File` cannot ride in `location.state` (it carries only the serialized `intakeData` payload).
- The filing module (recently extended for IRF/announcement photos) already stores uploaded files on disk + DB rows, tagged by `category` and `caseId`/`announcementId`/etc., and serves them via `/filing/*`. The ID photo reuses this — no new table or storage.

## Constraint decisions (from user)

- ID photo: **optional**, **single**, image of the beneficiary's **government ID**.
- ID photo is attached **on the intake form** AND shows on the **case documents** afterward ("Both").
- Viewers: **admin + social_worker** (coordinators lose case access entirely, so they never reach it — server-enforced).
- Coordinator case access: **full removal** — no `/cases`, `/cases/:id`, no case tracker, no case status/closure, no CSR PDF, no case documents/photos.
- Coordinators **keep**: `/coordinator/*` dashboard/referrals/access-cards, `/referrals`, `/messages`, and **announcement management** (including announcement photos).
- Implementation: **Approach A** — session-held file, upload once a case exists.

## Part 1 — ID photo on the GIS intake

### 1.1 Server: filing storage & access

- New document `category` value: `id_photo`. It is persisted by the existing `POST /filing/upload` (already carries `category` + `caseId`). No entity/migrate change needed — `category` is a free-text column.
- `FilingService`:
  - `findIdPhotoByCase(caseId: string)` → latest `id_photo` row for the case (`find` where `category='id_photo'` + `caseId`, order `createdAt: 'DESC'`, take 1, return first or null). Mirrors `findPhotosByIrf`.
- Endpoint: `GET /filing/case/:caseId/id-photo` → `@Roles('admin','social_worker')`; returns the single photo row or 404/empty. (Coordinators cannot call it.)

### 1.2 Server: coordinator case-access removal (filing)

Preserve coordinator **announcement-photo** management while removing all **case-document** access. The generic `/filing` routes keep `coordinator` in `@Roles`, but the *handlers* enforce category-aware gating:

- `FilingService.isPhotoAccessAllowed(role, category, action)` — change the generic branch to deny coordinators:
  ```
  if (role === 'admin') return true;
  if (category === 'irf_photo') return false;         // admin-only evidence
  if (category === 'announcement_photo') return ['admin','social_worker','coordinator'].includes(role);
  return action === 'delete' ? ['admin','social_worker'].includes(role)
                             : ['admin','social_worker','claimant'].includes(role);
  ```
  Effects:
  - `GET /filing/:id` and `GET /filing/:id/download` already call `isPhotoAccessAllowed(req.user.role, doc.category)` → coordinators now get 403 for any non-`announcement_photo` doc (case docs, `id_photo`, `irf_photo`), but still pass for `announcement_photo` (FileUploadList open/download keeps working for coordinators).
  - `DELETE /filing/:id` already calls `isPhotoAccessAllowed(req.user.role, doc.category, 'delete')` → coordinators can still delete `announcement_photo`; case docs become admin/social_worker only.
- `FilingService.findAll(caseId?, beneficiaryId?, role?)` — extend the non-admin guard: when `role === 'coordinator'`, additionally constrain results to announcement photos only (the only category coordinators may still view):
  ```
  const isCoordinator = role === 'coordinator';
  if (!caseId && !beneficiaryId && role !== 'admin') {
    where.category = Not(In(['irf_photo','announcement_photo']));
  }
  if (isCoordinator) {
    where.category = 'announcement_photo';
  }
  ```
  (Coordinators calling the generic `/filing` list only ever receive announcement photo rows; nothing case-scoped leaks.)

### 1.3 Client: `IntakePage` — ID photo field

- New optional "ID Photo (Government ID)" card, placed between the Family Composition section and the Data Privacy Consent section, following the existing card pattern.
- A single image picker: file input (accept `image/*`), name + thumbnail preview of the selected file, and a "Remove" control. Mirrors the visual of `FileUploadList` but single-file and read-only (just pick → preview → remove); no upload happens yet.
- Selected `File` is stored in a **session-scoped holder** created in a new module `kapwa-client/src/hooks/useIntakeIdPhoto.ts` (or a small module `intakeIdPhoto.ts`): `let pendingIdPhoto: File | null = null` with get/set/clear helpers. This survives SPA navigation to `/intake/review`. Cleared on draft-clear or logout.
- A shared upload helper (in the same module): `uploadIntakeIdPhoto(caseId: string)`: if a pending file exists, `uploadWithProgress('/filing/upload', form, cb)` with `form` = `{ file, category:'id_photo', caseId }`; on success clear the holder; on failure toast a non-fatal warning (optional field).

### 1.4 Client: submit wiring (both paths)

- `IntakePage.completeIntake(caseId)` — after a case is created via the direct `/intake` path, call `uploadIntakeIdPhoto(caseId)` (fire-and-forget with toast).
- `IntakeReviewPage.handleConfirm(...)` and `handleCreateNew(...)` — after they receive a `caseId`, call `uploadIntakeIdPhoto(caseId)` before/after navigating.
- The `CompleteIntake`/"batch" path (`handleBatchSubmit`) already navigates to the case; the ID photo (if pending) uploads at case creation in `completeIntake`, so batch-family is unaffected.
- Guard: only attempt upload when a file is pending and `caseId` is present.

### 1.5 Client: `CaseViewPage` — show the ID photo

- Fetch `GET /filing/case/:caseId/id-photo` (admin/social_worker). Render a small "ID Photo" read-only thumbnail panel (e.g. in the Documents card header or a dedicated panel). The photo also appears in the existing case Documents list (`queryKeys.filing.byCase`) since it's a filing row.
- Add a `queryKeys.filing` entry for the case ID photo.

### 1.6 i18n (en + fil)

New keys under `intake.idPhoto.*` (e.g. `title`, `optional`, `pick`, `remove`, `previewAlt`) and under `cases.*` for the case-page panel. Both locales, matching placeholders, differing values.

## Part 2 — Coordinator case-access removal

### 2.1 Client routes (`kapwa-client/src/routes.tsx`)

- `/cases` (line 98): `['admin','social_worker','coordinator']` → `['admin','social_worker']`
- `/cases/:id` (line 99): same change.
- `/tracker` (line 102): remove `'coordinator'` → `['admin','social_worker','mayor','auditor']`
- Unchanged: `/coordinator/*`, `/referrals`, `/messages`, `/announcements/manage*` still allow coordinator.

### 2.2 Server (`kapwa-server/src/cases/cases.controller.ts`)

Remove `'coordinator'` from the `@Roles` list of:
- `GET /cases` (list)
- `GET /cases/:id` (detail)
- `GET /cases/tracker/daily`, `tracker/range`, `tracker/stats`
- `PATCH /cases/:id/status`
- `PATCH /cases/:id/closure`
- `GET /cases/:id/csr-pdf`

Keep `coordinator` on anything not case-scoped (none of the remaining case routes are coordinator-only).

### 2.3 Server (`filing.*`) — see 1.2 (category-aware gating, not flat route removal).

## Testing

- Server (`kapwa-server/src/filing/filing.service.spec.ts`): `findIdPhotoByCase` returns latest `id_photo`; `isPhotoAccessAllowed` denies coordinators for generic/case docs + `id_photo`, allows for `announcement_photo`; `findAll` scopes coordinators to `announcement_photo` only.
- Server (`kapwa-server/src/intake/*`): none needed unless intake service changes (it doesn't — upload is client-side via filing).
- Client (`IntakePage.test.tsx`): ID-photo picker shows; selecting shows preview; submit (no-match path) triggers a filing upload with `category='id_photo'` + `caseId`, or leaves it pending for review.
- Client (`IntakeReviewPage.test.tsx`): confirm-with-case-created and create-new both trigger the pending upload.
- Client routes tests: coordinator blocked from `/cases`, `/cases/:id`, `/tracker`.
- Client (`CaseViewPage.test.tsx`): ID photo panel renders when a photo is returned.

## Explicitly NOT changing

- Announcement management/photos for coordinators (kept).
- Coordinator dashboard, referrals, access-cards, messages (kept).
- Minio/object storage (unchanged; filing on-disk storage reused).
- No IRF create-page photos, no announcement create-form photos.
- Intake batch-family logic (unchanged beyond the shared upload helper).

## Out of scope / assumptions

- The pending ID photo is lost if the worker abandons the flow mid-way (it is optional; acceptable).
- Deleting/replacing the ID photo on the case page is via the existing filing delete/document list.
