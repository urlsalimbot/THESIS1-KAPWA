# IRF & Announcements Photo Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add evidence-photo uploads to IRFs (upload by workers+admins, view admin-only, server-enforced) and photo galleries to announcements (public gallery + first photo as cover on list cards).

**Architecture:** Extend the filing module with `irf_id`/`announcement_id` columns and role-gated photo endpoints; add unguarded, category-gated photo endpoints for public announcements; extract the shared `FileUploadList` client component (from `RequirementFileUpload`) and use it for IRF + announcement photo sections; show the first photo as a cover on announcement cards.

**Tech Stack:** NestJS + TypeORM (server), React 18 + TS + Tailwind (client), Jest (server), Vitest (client).

## Global Constraints

- Server files in scope: `kapwa-server/src/filing/*`, `kapwa-server/src/announcements/*`, `kapwa-server/src/database/migrate.ts` (idempotent `ALTER TABLE … IF NOT EXISTS` only — never recreate/truncate).
- IRF photos: upload roles `admin|social_worker`; LIST/DOWNLOAD/DELETE admin-only, server-enforced (403 for non-admin, not silent empty — no existence leak concern since IRF ids are UUIDs, but download gating must return 403 not 404 to avoid revealing doc existence).
- Announcement photos: upload/manage roles `admin|social_worker|coordinator`; public list + stream unguarded but the stream MUST 404 unless `category === 'announcement_photo'`.
- The working tree contains unrelated uncommitted changes (card-overlap bug fix + user docs edits) — commits must NOT include them.
- i18n keys in BOTH en and fil with matching placeholders; fil values differ from en.
- Server tests: `npx jest <path> --silent`, typecheck `npm run typecheck` (kapwa-server). Client: `npm run test:run`, `npm run typecheck` (kapwa-client).

---

### Task 1: Server — filing columns, upload metadata, service persistence

**Files:**
- Modify: `kapwa-server/src/filing/filing.entity.ts` (add `irfId`, `announcementId`)
- Modify: `kapwa-server/src/database/migrate.ts` (idempotent ALTERs + indexes for `document_vault`)
- Modify: `kapwa-server/src/filing/dto/filing.zod.ts` (or wherever `UploadMetadataSchema` lives) (add `irfId`, `announcementId`)
- Modify: `kapwa-server/src/filing/filing.service.ts` (`upload` persists the new fields; add `findPhotosByIrf(id)` and `findPhotosByAnnouncement(id)` and `findOneByCategory(id, category)`)
- Test: `kapwa-server/src/filing/filing.service.spec.ts`

**Interfaces:**
- Produces: `FilingService.findPhotosByIrf(irfId): Promise<DocumentVault[]>` (category `irf_photo`, order created_at ASC), `findPhotosByAnnouncement(announcementId): Promise<DocumentVault[]>` (category `announcement_photo`, order ASC), `findOneByCategory(id, category): Promise<DocumentVault>` (throws `NotFoundException` when missing or category mismatch). Consumed by Tasks 2-3.

- [ ] **Step 1: Write the failing tests**

Append to `kapwa-server/src/filing/filing.service.spec.ts`:

```ts
describe('photo queries', () => {
  it('finds IRF photos by irfId ordered by created_at', async () => {
    (docRepo.find as jest.Mock).mockResolvedValue([{ id: 'p1' }]);
    const rows = await svc.findPhotosByIrf('irf-1');
    expect(docRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { category: 'irf_photo', irfId: 'irf-1' },
      order: { createdAt: 'ASC' },
    }));
    expect(rows).toHaveLength(1);
  });

  it('finds announcement photos by announcementId ordered by created_at', async () => {
    (docRepo.find as jest.Mock).mockResolvedValue([]);
    await svc.findPhotosByAnnouncement('ann-1');
    expect(docRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { category: 'announcement_photo', announcementId: 'ann-1' },
      order: { createdAt: 'ASC' },
    }));
  });

  it('findOneByCategory returns the doc only when the category matches', async () => {
    (docRepo.findOne as jest.Mock).mockResolvedValue({ id: 'p1', category: 'announcement_photo' });
    const doc = await svc.findOneByCategory('p1', 'announcement_photo');
    expect(doc.id).toBe('p1');
  });

  it('findOneByCategory throws NotFound when category mismatches', async () => {
    (docRepo.findOne as jest.Mock).mockResolvedValue({ id: 'p1', category: 'irf_photo' });
    await expect(svc.findOneByCategory('p1', 'announcement_photo')).rejects.toThrow('File not found');
  });
});
```

(Adapt to the spec file's existing mock variable names — check whether the repo mock is called `docRepo` or `filingRepo` first.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/filing/filing.service.spec.ts --silent` (from `kapwa-server/`)
Expected: FAIL — methods don't exist.

- [ ] **Step 3: Implement entity + migrate + DTO + service**

1. `filing.entity.ts` — add after `beneficiaryId`:
```ts
  @Column({ name: 'irf_id', nullable: true })
  irfId?: string;

  @Column({ name: 'announcement_id', nullable: true })
  announcementId?: string;
```
2. `migrate.ts` — after the existing `document_vault` block, add (matching the file's `await q.query(...)` style):
```ts
  await q.query(`ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS irf_id UUID`);
  await q.query(`ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS announcement_id UUID`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_irf ON document_vault(irf_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_doc_announcement ON document_vault(announcement_id)`);
```
3. `UploadMetadataSchema` — add `irfId: z.string().optional(),` and `announcementId: z.string().optional(),`.
4. `filing.service.ts`:
   - Extend the `upload` metadata type + `docRepo.create({...})` with `irfId: metadata.irfId, announcementId: metadata.announcementId`.
   - Add the three methods:
```ts
  async findPhotosByIrf(irfId: string) {
    return this.docRepo.find({ where: { category: 'irf_photo', irfId }, order: { createdAt: 'ASC' } });
  }

  async findPhotosByAnnouncement(announcementId: string) {
    return this.docRepo.find({ where: { category: 'announcement_photo', announcementId }, order: { createdAt: 'ASC' } });
  }

  async findOneByCategory(id: string, category: string) {
    const doc = await this.findOne(id);
    if (!doc || doc.category !== category) throw new NotFoundException('File not found');
    return doc;
  }
```
5. `filing.controller.ts` upload endpoint — pass `irfId`/`announcementId` from the body into the service (the handler already forwards the metadata object; add the fields to the forwarded object).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/filing/filing.service.spec.ts --silent` then `npm run typecheck` (from `kapwa-server/`)
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/filing/filing.entity.ts kapwa-server/src/filing/filing.service.ts kapwa-server/src/filing/filing.controller.ts kapwa-server/src/filing/dto/filing.zod.ts kapwa-server/src/database/migrate.ts kapwa-server/src/filing/filing.service.spec.ts
git commit -m "feat: filing photos for IRF and announcements (storage + queries)"
```

---

### Task 2: Server — role-gated IRF photo endpoints + download/delete gating

**Files:**
- Modify: `kapwa-server/src/filing/filing.controller.ts`
- Modify: `kapwa-server/src/filing/filing.service.spec.ts` (or a new `filing.controller.spec.ts` if one exists — check first)

**Interfaces:**
- Consumes: `FilingService.findPhotosByIrf` (Task 1), `req.user.role` (guards).
- Produces: `GET /filing/irf/:irfId/photos` (`@Roles('admin')`) and hardened `GET /filing/:id/download` + `DELETE /filing/:id`.

- [ ] **Step 1: Write the failing tests**

If a controller spec exists, extend it; otherwise add tests to `filing.service.spec.ts` for a new `isPhotoAccessAllowed(role, category)` helper in the service:

```ts
describe('photo access gating', () => {
  it('allows admins for irf_photo', () => {
    expect(svc.isPhotoAccessAllowed('admin', 'irf_photo')).toBe(true);
  });
  it('denies non-admins for irf_photo', () => {
    expect(svc.isPhotoAccessAllowed('social_worker', 'irf_photo')).toBe(false);
  });
  it('allows manage roles for announcement_photo', () => {
    expect(svc.isPhotoAccessAllowed('social_worker', 'announcement_photo')).toBe(true);
  });
  it('allows only admins for other document categories', () => {
    expect(svc.isPhotoAccessAllowed('coordinator', 'case_document')).toBe(false);
    expect(svc.isPhotoAccessAllowed('admin', 'case_document')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/filing/filing.service.spec.ts --silent` (from `kapwa-server/`)
Expected: FAIL — `isPhotoAccessAllowed` doesn't exist.

- [ ] **Step 3: Implement the gating + endpoints**

1. `filing.service.ts` — add the helper:
```ts
  // IRF photos are evidence and only MSWDO admins may view them; announcement
  // photos are managed by the announcement roles; other docs stay admin-delete.
  isPhotoAccessAllowed(role: string | undefined, category?: string | null, action: 'view' | 'delete' = 'view'): boolean {
    if (role === 'admin') return true;
    if (category === 'irf_photo') return false;
    if (category === 'announcement_photo') {
      return ['admin', 'social_worker', 'coordinator'].includes(role ?? '');
    }
    return action === 'delete' ? false : ['admin', 'social_worker', 'coordinator', 'claimant'].includes(role ?? '');
  }
```
2. `filing.controller.ts`:
   - Add the IRF photo list endpoint (after `@Get()`):
```ts
  @Get('irf/:irfId/photos')
  @Roles('admin')
  @ApiOperation({ summary: 'List IRF evidence photos (admin only)' })
  async irfPhotos(@Param('irfId') irfId: string) {
    return this.filingService.findPhotosByIrf(irfId);
  }
```
   - Harden `download` — before streaming:
```ts
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category)) {
      throw new ForbiddenException('You do not have access to this document');
    }
```
   (add `@Request() req` to the handler; the handler already imports `Request`.)
   - Harden `delete` — the decorator currently is `@Roles('admin')`. Change to `@Roles('admin', 'social_worker', 'coordinator')` and add:
```ts
    const doc = await this.filingService.findOne(id);
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category, 'delete')) {
      throw new ForbiddenException('Only admins can remove documents');
    }
```
   (add `@Request() req`.)
   - Also gate `findOne` (`GET :id`) with the same view check.

- [ ] **Step 4: Run the tests + typecheck**

Run: `npx jest src/filing/filing.service.spec.ts --silent` then `npm run typecheck` (from `kapwa-server/`)
Expected: PASS; exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/filing/filing.controller.ts kapwa-server/src/filing/filing.service.ts kapwa-server/src/filing/filing.service.spec.ts
git commit -m "feat: admin-only IRF photo endpoints and document access gating"
```

---

### Task 3: Server — public announcement photo endpoints

**Files:**
- Modify: `kapwa-server/src/announcements/announcements-public.controller.ts`
- Modify: `kapwa-server/src/announcements/announcements.module.ts` (import `FilingModule`; export what's needed)
- Modify: `kapwa-server/src/filing/filing.module.ts` (export `FilingService`)
- Test: extend `kapwa-server/src/filing/filing.service.spec.ts` or add controller coverage where feasible

**Interfaces:**
- Consumes: `FilingService.findPhotosByAnnouncement`, `findOneByCategory` (Task 1).
- Produces: `GET /announcements/public/:slug/photos` (unguarded) and `GET /announcements/public/photo/:id` (unguarded, category-gated).

- [ ] **Step 1: Verify `FilingModule` exports**

Check `filing.module.ts` — ensure `FilingService` is in `providers` AND `exports`. If not, add it to `exports`. Ensure `announcements.module.ts` imports `FilingModule`.

- [ ] **Step 2: Implement the public endpoints**

`announcements-public.controller.ts` — inject `FilingService` and add:

```ts
  @Get(':slug/photos')
  @ApiOperation({ summary: 'List photos for a published announcement (public)' })
  async photos(@Param('slug') slug: string) {
    const announcement = await this.svc.findBySlug(slug);
    if (!announcement) throw new NotFoundException('Announcement not found');
    const rows = await this.filingService.findPhotosByAnnouncement(announcement.id);
    return rows.map((d) => ({ id: d.id, originalName: d.originalName, mimeType: d.mimeType, fileSize: d.fileSize }));
  }

  @Get('photo/:id')
  @ApiOperation({ summary: 'Stream an announcement photo (public, category-gated)' })
  async photo(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.filingService.findOneByCategory(id, 'announcement_photo');
    const filePath = path.resolve(process.cwd(), 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
    return new StreamableFile(stream);
  }
```

Route ordering: declare `@Get('photo/:id')` BEFORE `@Get(':slug')` would shadow it? No — `:slug/photos` (2 segments) and `photo/:id` (2 segments) vs `:slug` (1 segment) don't collide. Keep `:slug/photos` and `photo/:id` — NestJS matches by declaration order among same-shape routes; `photo/:id` and `:slug/photos` differ in segment count, no conflict. Add the missing imports (`Res`, `Response`, `StreamableFile`, `path`, `fs`, `FilingService`).

- [ ] **Step 3: Add a service-level test for `findOneByCategory`**

If not already covered in Task 1, ensure `findOneByCategory` has a category-mismatch 404 test in `filing.service.spec.ts`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest src/filing src/announcements --silent` then `npm run typecheck` (from `kapwa-server/`)
Expected: PASS; exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/announcements/announcements-public.controller.ts kapwa-server/src/announcements/announcements.module.ts kapwa-server/src/filing/filing.module.ts kapwa-server/src/filing/filing.service.spec.ts
git commit -m "feat: public announcement photo list and category-gated stream"
```

---

### Task 4: Client — extract `FileUploadList` from `RequirementFileUpload`

**Files:**
- Create: `kapwa-client/src/components/case-view/FileUploadList.tsx`
- Modify: `kapwa-client/src/components/case-view/RequirementFileUpload.tsx` (become a thin wrapper)
- Modify: `kapwa-client/src/components/case-view/RequirementFileUpload.test.tsx` (adjust if needed)

**Interfaces:**
- Produces: `FileUploadList({ docs, canUpload?, onChanged, formExtras: Record<string,string>, accept?, maxBytes?, compact? })` — same dropzone/validation/progress/thumbnails/preview/remove behavior as today's `RequirementFileUpload`, but the upload FormData is built from `formExtras` (every key appended) and the `pl-9`/`ml-9` indentation only applies when `compact`. Consumed by Tasks 5-6.

- [ ] **Step 1: Create `FileUploadList.tsx`**

Copy the current `RequirementFileUpload.tsx` implementation into `FileUploadList.tsx` with these changes:
1. Props become:
```ts
export interface FileUploadListProps {
  docs: FilingDoc[];
  canUpload?: boolean;
  onChanged: () => void;
  formExtras: Record<string, string>;
  accept?: string;
  maxBytes?: number;
  compact?: boolean;
}
```
2. The upload FormData loop:
```ts
      const form = new FormData();
      form.append('file', file);
      for (const [k, v] of Object.entries(formExtras)) form.append(k, v);
```
3. Replace the `pl-9` / `ml-9` classes with a `const indent = compact ? 'pl-9' : '';` / `const indentX = compact ? 'ml-9' : '';` applied in the same places.
4. Keep `FilingDoc` export here; re-export from `RequirementFileUpload` for compatibility.
5. `validate` uses the `accept`/`maxBytes` props (defaults: the current `ACCEPT`/`MAX_BYTES`).

- [ ] **Step 2: Rewrite `RequirementFileUpload.tsx` as a wrapper**

```tsx
import { FileUploadList, type FilingDoc } from './FileUploadList';

export type { FilingDoc };

interface RequirementFileUploadProps {
  caseId: string;
  requirementKey: string;
  canUpload?: boolean;
  docs: FilingDoc[];
  onChanged: () => void;
}

export function RequirementFileUpload(props: RequirementFileUploadProps) {
  return (
    <FileUploadList
      compact
      docs={props.docs}
      canUpload={props.canUpload}
      onChanged={props.onChanged}
      formExtras={{ caseId: props.caseId, requirementKey: props.requirementKey }}
    />
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test:run -- src/components/case-view/RequirementFileUpload.test.tsx` then `npm run test:run` then `npm run typecheck` (from `kapwa-client/`)
Expected: all pass (the test's `api`/`uploadWithProgress` mocks still match the wrapper's behavior).

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/components/case-view/FileUploadList.tsx kapwa-client/src/components/case-view/RequirementFileUpload.tsx
git commit -m "refactor: extract reusable FileUploadList from RequirementFileUpload"
```

---

### Task 5: Client — IRF Evidence Photos section

**Files:**
- Modify: `kapwa-client/src/pages/IrfDetailPage.tsx`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` + `fil/index.ts` (new `irf.photos.*` keys)
- Create: `kapwa-client/src/pages/IrfDetailPage.test.tsx` (if a test file doesn't exist — check first)

**Interfaces:**
- Consumes: `FileUploadList` (Task 4), `GET /filing/irf/:irfId/photos` (Task 2), `useAuth().user.role`.

- [ ] **Step 1: Add i18n keys (en + fil)**

`"irf": {` → add (en):
```json
    "photos": "Evidence Photos",
    "photosEmpty": "No evidence photos attached.",
    "photosAdminOnly": "Evidence photos are visible to the MSWDO administrator only.",
```
fil equivalents (translate; `photosAdminOnly` → "Ang mga larawan ng ebidensya ay makikita lamang ng administrador ng MSWDO.").

- [ ] **Step 2: Add the section to `IrfDetailPage.tsx`**

In the main `return` of `IrfDetailPage` (the PageShell around line 320+), after the ExportSection-style blocks and before the closing, add a section following the existing card pattern:

```tsx
      {isAdmin && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">{t('irf.photos', 'Evidence Photos')}</h2>
          </div>
          <Separator />
          <div className="px-4 py-4">
            <FileUploadList
              docs={photos}
              canUpload={canUploadPhotos}
              onChanged={loadPhotos}
              formExtras={{ category: 'irf_photo', irfId: id! }}
            />
            {photos.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('irf.photosEmpty', 'No evidence photos attached.')}</p>
            )}
          </div>
        </div>
      )}
```

Component wiring:
- `const { user } = useAuth();` (add import if missing) and `const isAdmin = user?.role === 'admin';`
- `const canUploadPhotos = ['admin', 'social_worker'].includes(user?.role ?? '');`
- `const [photos, setPhotos] = useState<FilingDoc[]>([]);` with a `loadPhotos` that fetches `GET /filing/irf/${id}/photos` only when `isAdmin` (in a `useEffect` on `[id, isAdmin]`).
- Import `FileUploadList`, `type FilingDoc`, `useAuth`, `ImageIcon` from lucide.
- The whole section renders only when `isAdmin` — the server additionally enforces admin-only listing/download.

- [ ] **Step 3: Add a test**

If no `IrfDetailPage.test.tsx` exists, create a minimal one (mock `@/lib/api`, `@/lib/auth-context` with an admin user, `useIrfOperations`) asserting: admin sees "Evidence Photos"; a social-worker render does NOT show the section. Follow the repo's existing test patterns.

- [ ] **Step 4: Run tests + typecheck + parity**

Run: `npm run test:run -- src/pages/IrfDetailPage.test.tsx src/i18n/__tests__/fil-parity.test.ts` then `npm run test:run` then `npm run typecheck` (from `kapwa-client/`)
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/IrfDetailPage.tsx kapwa-client/src/pages/IrfDetailPage.test.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: IRF evidence photos (admin view, worker+admin upload)"
```

---

### Task 6: Client — announcement photos (gallery + cover on cards)

**Files:**
- Modify: `kapwa-client/src/components/announcements/AnnouncementForm.tsx` (no photo UI — unchanged)
- Modify: `kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx` (photo gallery section)
- Modify: `kapwa-client/src/components/announcements/AnnouncementEditPage.tsx` (photo gallery section below the form)
- Modify: `kapwa-client/src/pages/AnnouncementPage.tsx` (public gallery + cover)
- Modify: `kapwa-client/src/components/announcements/LatestAnnouncements.tsx` (cover on cards)
- Modify: `kapwa-client/src/components/announcements/AnnouncementsPage.tsx` (cover on cards)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` + `fil/index.ts` (new `announcements.photos.*` keys)
- Create: tests where missing

**Interfaces:**
- Consumes: `FileUploadList` (Task 4), `GET /filing/announcements/:id/photos`, `GET /announcements/public/:slug/photos`, `GET /announcements/public/photo/:id`.

- [ ] **Step 1: Add i18n keys (en + fil)**

`"announcements": {` → add (en):
```json
    "photos": "Photos",
    "photosEmpty": "No photos attached.",
    "photoCover": "Cover photo",
```
fil equivalents (e.g. "Mga Larawan", "Walang naka-attach na larawan.", "Larawan ng pabalat").

- [ ] **Step 2: Manage-side gallery (detail + edit)**

- `AnnouncementDetailPage.tsx`: below the existing detail `Card`, add a Photos card (same pattern as Task 5): fetch `GET /filing/announcements/${data.id}/photos`, render `FileUploadList` with `formExtras={{ category: 'announcement_photo', announcementId: data.id }}`, `onChanged` re-fetches.
- `AnnouncementEditPage.tsx`: below `<AnnouncementForm …/>`, add the same Photos card using `data.id`.

- [ ] **Step 3: Public gallery + cover**

- `AnnouncementPage.tsx` (public detail): fetch `GET /announcements/public/${slug}/photos` (public endpoint, no auth needed — but `api.get` sends a token if present; verify `api.get` works without a token, or use raw `fetch` with the URL). Render after the article body:
```tsx
      {photos.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">{t('announcements.photos', 'Photos')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map(p => (
              <a key={p.id} href={`/announcements/public/photo/${p.id}`} target="_blank" rel="noreferrer">
                <img src={`/announcements/public/photo/${p.id}`} alt={p.originalName} className="w-full rounded-lg border object-cover aspect-video" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
```
(Use the site-relative `/announcements/public/photo/…` URL so it works through Caddy; the public controller serves it unguarded. If the client's `api.get` rejects unauthenticated public calls, use a raw `fetch` for this list instead — verify with the existing public announcement fetch pattern in `AnnouncementPage`.)

- `LatestAnnouncements.tsx` (public landing cards) + `AnnouncementsPage.tsx` (manage cards): when an announcement has photos, show the FIRST photo as a cover at the top of the card. The list endpoints (`/announcements/public` and `/announcements`) currently don't include photo info — extend the DTOs minimally: add `photoCount` (and `coverPhotoId`) to the public list + manage list responses. Update `AnnouncementsPage`'s `Announcement` interface and the `LatestAnnouncements` card to render `<img src={/announcements/public/photo/${coverPhotoId}} …/>` when present.

- [ ] **Step 4: Server DTO additions for cover**

In `announcements.service.ts` `findPublished` and the manage `findAll` (or the controller map), add for each announcement:
```ts
const photoRows = await this.filingService.findPhotosByAnnouncement(a.id); // or a count query
photoCount: photoRows.length,
coverPhotoId: photoRows[0]?.id ?? null,
```
(For efficiency, prefer a single grouped query if practical; correctness first — N+1 acceptable here for a thesis scale.) Update the public list controller map and the manage list to include these fields.

- [ ] **Step 5: Tests**

- `AnnouncementPage` public gallery test (mock the photo list fetch; assert the first photo `<img>` renders).
- `AnnouncementsPage`/`LatestAnnouncements` cover test (announcement with `coverPhotoId` renders an `<img>` with the public photo URL).
- Keep existing suites green.

- [ ] **Step 6: Run full client suite + typecheck + parity**

Run: `npm run test:run` then `npm run test:run -- src/i18n/__tests__/fil-parity.test.ts` then `npm run typecheck` (from `kapwa-client/`)
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx kapwa-client/src/components/announcements/AnnouncementEditPage.tsx kapwa-client/src/pages/AnnouncementPage.tsx kapwa-client/src/components/announcements/LatestAnnouncements.tsx kapwa-client/src/components/announcements/AnnouncementsPage.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts kapwa-server/src/announcements/announcements.service.ts
git commit -m "feat: announcement photo gallery with cover on list cards"
```

---

## Self-Review

**1. Spec coverage:** filing columns + queries (Task 1), admin-only IRF endpoints + download/delete gating (Task 2), public announcement photo endpoints (Task 3), FileUploadList extraction (Task 4), IRF Evidence Photos (Task 5), announcement gallery + cover (Task 6). i18n en+fil in Tasks 5-6. "Explicitly NOT changing" respected (no IRF create-page photos, no announcement create-form photos, minio untouched). ✓

**2. Placeholder scan:** Steps carry concrete code/commands; the only adaptive instructions are "match the existing spec's mock variable names" and "check if a test file exists first" — both are explicit checks, not placeholders. ✓

**3. Type consistency:** `FilingService.findPhotosByIrf/findPhotosByAnnouncement/findOneByCategory/isPhotoAccessAllowed` signatures used consistently across Tasks 2-3; `FileUploadList` props consumed identically in Tasks 5-6; `coverPhotoId`/`photoCount` added in Task 6 Step 4 and consumed in the same task's cards. ✓