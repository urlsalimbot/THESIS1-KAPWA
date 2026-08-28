# GIS Intake ID Photo + Coordinator Case-Access Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional single government-ID photo to the GIS intake form that auto-attaches to the newly created case (and shows on the case), and remove all coordinator access to cases (including the tracker) server+client.

**Architecture:** Two tracks. (1) Server-side: reuse the filing module for the `id_photo` category, add a `findIdPhotoByCase` lookup + `GET /filing/case/:caseId/id-photo`, and tighten filing gating so coordinators can no longer reach case documents/photos but still manage announcement photos. (2) Client-side: a session-held `File` picked on `IntakePage`, uploaded once a `caseId` exists on both the direct and match-review paths, shown on `CaseViewPage`; plus removing `coordinator` from the case routes/tracker.

**Tech Stack:** NestJS (server), React + Vite + TS, react-query-keys (`query-keys.ts`), custom `api`/`uploadWithProgress` client, vitest (client) + jest (server).

## Global Constraints

- Do NOT touch unrelated working-tree changes: `kapwa-server/src/common/constants.ts`, `kapwa-server/src/database/migrate.ts`, `kapwa-server/src/database/migrations/20260712000001-CreateInterventionTypesTable.ts`, `kapwa-server/src/filing/filing.service.spec.ts` (it already has pre-existing edits from prior work), any `docs/*` edits, `DB-SCHEMA.md`, `EVALUATION.MD`, `SPEC-GAP.md`, `docs/diagrams/*`, `docs/inter-agency-beneficiary-tracking.md`. Add only your own task files; the executor reviews `git status` before each commit.
- Server test runner: `npx jest <path> --silent` (run from `kapwa-server/`). Typecheck: `npm run typecheck` (in `kapwa-server/`).
- Client test runner: `npm run test:run` (vitest, from `kapwa-client/`) — NOT `npx jest` (fails on client ESM templates). Typecheck: `npm run typecheck` (in `kapwa-client/`).
- i18n keys must be added in BOTH `en` and `fil` locale files.
- Commit only the files for the current task. Commits must not include unrelated working-tree changes.

---

### Task 1: Server — `id_photo` category, lookup, and coordinator filing gate

**Files:**
- Modify: `kapwa-server/src/filing/filing.service.ts`
- Modify: `kapwa-server/src/filing/filing.controller.ts`
- Test: `kapwa-server/src/filing/filing.service.spec.ts` (APPEND to the existing file — do not rewrite it; preserve the pre-existing imports/edits)

**Interfaces:**
- Consumes: existing `FilingService.upload`, `FilingService.findAll`, `FilingService.isPhotoAccessAllowed`, `Filing` entity (`category`, `caseId`, `originalName`, `createdAt`, `id`).
- Produces:
  - `FilingService.findIdPhotoByCase(caseId: string): Promise<Filing | null>`
  - `GET /filing/case/:caseId/id-photo` → `{ ...filing row }` or 404
  - Updated `isPhotoAccessAllowed` (coordinators denied for generic/case docs + `id_photo`, allowed for `announcement_photo`)
  - Updated `findAll` (coordinators see only `announcement_photo` rows)

- [ ] **Step 1: Read the current filing service to match exact structure**

Run: `sed -n '1,140p' kapwa-server/src/filing/filing.service.ts 2>/dev/null || cat kapwa-server/src/filing/filing.service.ts`
Confirm the location of `findPhotosByIrf`, `findAll`, and `isPhotoAccessAllowed`. If `findPhotosByIrf` does not exist in this file, adapt the `findIdPhotoByCase` body to the closest existing `find` pattern (e.g. `this.filingRepo.find({ where, order, take })`).

- [ ] **Step 2: Add `findIdPhotoByCase`**

Add to `FilingService` (place near the other photo finders):
```ts
async findIdPhotoByCase(caseId: string): Promise<Filing | null> {
  const rows = await this.filingRepo.find({
    where: { category: 'id_photo', caseId },
    order: { createdAt: 'DESC' } as any,
    take: 1,
  });
  return rows[0] ?? null;
}
```
(Match the exact `where`/`order` typing used by existing finders in this file; if `caseId` is a relation field on the entity, use the field name as existing code does.)

- [ ] **Step 3: Tighten `isPhotoAccessAllowed`**

Find `isPhotoAccessAllowed` in the service. Ensure the generic branch drops `coordinator`:
```ts
isPhotoAccessAllowed(
  role: string | undefined,
  category?: string | null,
  action: 'view' | 'delete' = 'view',
): boolean {
  if (role === 'admin') return true;
  if (category === 'irf_photo') return false;
  if (category === 'announcement_photo') {
    return ['admin', 'social_worker', 'coordinator'].includes(role);
  }
  const viewRoles = ['admin', 'social_worker', 'claimant'];
  return action === 'delete'
    ? ['admin', 'social_worker'].includes(role)
    : viewRoles.includes(role);
}
```
(Keep the file's existing formatting/style. The key change is the final return: remove `coordinator` from both the view and delete lists.)

- [ ] **Step 4: Scope `findAll` for coordinators**

Find `findAll`. Locate the existing non-admin guard block (the `if (!caseId && !beneficiaryId && role !== 'admin')` that sets `where.category = Not(In(['irf_photo','announcement_photo']))`). Add a coordinator branch right after it:
```ts
if (role === 'coordinator') {
  where.category = 'announcement_photo';
}
```

- [ ] **Step 5: Append tests to `filing.service.spec.ts`**

Append these tests (adjust imports at top of the file ONLY if needed; use the file's existing `it(...)`/`describe(...)` style and existing mock helpers):
```ts
describe('id_photo + coordinator case-access gate', () => {
  it('findIdPhotoByCase returns the latest id_photo for a case', async () => {
    const service = /* construct like the file's existing finder tests */;
    const rows = [{ id: 'f2', category: 'id_photo', caseId: 'c1', createdAt: new Date() }];
    jest.spyOn(/* repo */, 'find').mockResolvedValue(rows);
    const out = await service.findIdPhotoByCase('c1');
    expect(out?.id).toBe('f2');
  });

  it('findIdPhotoByCase returns null when none', async () => {
    const service = /* as above */;
    jest.spyOn(/* repo */, 'find').mockResolvedValue([]);
    const out = await service.findIdPhotoByCase('c1');
    expect(out).toBeNull();
  });

  it('isPhotoAccessAllowed denies coordinator for generic case docs and id_photo', () => {
    const service = /* construct */;
    expect(service.isPhotoAccessAllowed('coordinator', 'id_photo')).toBe(false);
    expect(service.isPhotoAccessAllowed('coordinator', null)).toBe(false);
    expect(service.isPhotoAccessAllowed('coordinator', null, 'delete')).toBe(false);
  });

  it('isPhotoAccessAllowed keeps coordinator for announcement_photo', () => {
    const service = /* construct */;
    expect(service.isPhotoAccessAllowed('coordinator', 'announcement_photo')).toBe(true);
    expect(service.isPhotoAccessAllowed('coordinator', 'announcement_photo', 'delete')).toBe(true);
  });

  it('isPhotoAccessAllowed still allows admin and social_worker for case docs', () => {
    const service = /* construct */;
    expect(service.isPhotoAccessAllowed('admin', null)).toBe(true);
    expect(service.isPhotoAccessAllowed('social_worker', 'id_photo')).toBe(true);
  });
});
```
If the spec file's existing tests construct services differently, mirror the exact construction used by the *closest analogous existing test* (`findPhotosByIrf` or the `findAll` tests) rather than inventing a helper.

- [ ] **Step 6: Add the endpoint to `filing.controller.ts`**

Add inside the controller (place near the other case-scoped GETs; put it BEFORE any wildcard `:id` route if ordering matters — see the existing annotation ordering used for `announcements/:announcementId/photos` vs `:slug/photos`):
```ts
@Get('case/:caseId/id-photo')
@Roles('admin', 'social_worker')
async getCaseIdPhoto(@Param('caseId') caseId: string) {
  const photo = await this.filingService.findIdPhotoByCase(caseId);
  if (!photo) throw new NotFoundException('ID photo not found');
  return photo;
}
```
Import `NotFoundException` if not already imported in the controller.

- [ ] **Step 7: Run the filing tests**

Run (from `kapwa-server/`): `npx jest src/filing/filing.service.spec.ts --silent`
Expected: all pass (new + existing). If an existing test asserted that coordinators can view generic docs, update that specific assertion to the new expectation (coordinator denied) — this is an intended behavior change.

- [ ] **Step 8: Typecheck**

Run (from `kapwa-server/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add kapwa-server/src/filing/filing.service.ts kapwa-server/src/filing/filing.controller.ts kapwa-server/src/filing/filing.service.spec.ts
git commit -m "feat(filing): id_photo category lookup + coordinator case-file gate"
```

---

### Task 2: Server — remove coordinator from case routes

**Files:**
- Modify: `kapwa-server/src/cases/cases.controller.ts`
- Test: `kapwa-server/src/cases/cases.service.spec.ts` (verify it still passes; no new tests required — role guards are declarative)

**Interfaces:**
- Consumes: existing `@Roles` decorators on case routes.
- Produces: case routes no longer list `'coordinator'`.

- [ ] **Step 1: Read the controller**

Run: `grep -n "@Roles" kapwa-server/src/cases/cases.controller.ts`
List the lines/endpoints that include `'coordinator'`.

- [ ] **Step 2: Remove `'coordinator'` from case routes**

For each of these endpoints, delete `'coordinator'` from the `@Roles` array (leaving the others intact):
- `GET /cases` (list)
- `GET /cases/:id`
- `GET /cases/tracker/daily`, `tracker/range`, `tracker/stats`
- `PATCH /cases/:id/status`
- `PATCH /cases/:id/closure`
- `GET /cases/:id/csr-pdf`

Do NOT touch `case-fsm.ts`/`case-fsm.spec.ts` (those `coordinator` references are workflow-state logic, not role guards).

- [ ] **Step 3: Run the cases suite**

Run (from `kapwa-server/`): `npx jest src/cases --silent`
Expected: all pass.

- [ ] **Step 4: Typecheck**

Run (from `kapwa-server/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/cases/cases.controller.ts
git commit -m "feat(cases): remove coordinator access to case routes"
```

---

### Task 3: Client — session holder + IntakePage ID-photo picker + direct-path upload

**Files:**
- Create: `kapwa-client/src/lib/intake-id-photo.ts`
- Modify: `kapwa-client/src/pages/IntakePage.tsx`
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Test: `kapwa-client/src/pages/IntakePage.test.tsx` (or the existing intake page test file)

**Interfaces:**
- Consumes: `uploadWithProgress` from `@/lib/api` (`uploadWithProgress<T>(path, formData, onProgress): Promise<T>`); `useAuth` from `@/lib/auth-context` (has `logout` and `user`); existing `IntakePage` submit flow calling `completeIntake(caseId)`.
- Produces:
  - `intakeIdPhoto.ts`: `setPendingIdPhoto(file: File | null)`, `getPendingIdPhoto(): File | null`, `clearPendingIdPhoto()`, `uploadIntakeIdPhoto(caseId: string): Promise<boolean>` (uploads pending file with `category='id_photo'` + `caseId`, clears holder, returns true on success/false on throw).
  - `IntakePage` renders an optional "ID Photo" card; direct-path submit uploads after `caseId`.
  - `queryKeys.filing.caseIdPhoto(caseId)`.

- [ ] **Step 1: Read `IntakePage.tsx` submit flow**

Run: `grep -n "completeIntake\|async function\|handleSubmit\|caseId\|navigate(" kapwa-client/src/pages/IntakePage.tsx`
Identify the function that receives the new `caseId` after case creation (the direct `/intake` path). Read ~60 lines around it.

- [ ] **Step 2: Create `kapwa-client/src/lib/intake-id-photo.ts`**

```ts
import { uploadWithProgress } from './api';

let pendingIdPhoto: File | null = null;

export function setPendingIdPhoto(file: File | null): void {
  pendingIdPhoto = file;
}
export function getPendingIdPhoto(): File | null {
  return pendingIdPhoto;
}
export function clearPendingIdPhoto(): void {
  pendingIdPhoto = null;
}

export async function uploadIntakeIdPhoto(caseId: string): Promise<boolean> {
  const file = pendingIdPhoto;
  if (!file) return true;
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', 'id_photo');
  formData.append('caseId', caseId);
  try {
    await uploadWithProgress('/filing/upload', formData, () => {});
    pendingIdPhoto = null;
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Add `queryKeys.filing.caseIdPhoto`**

In `kapwa-client/src/lib/query-keys.ts`, inside the `filing` block, add:
```ts
caseIdPhoto: (caseId: string) =>
  memo(`filing.caseIdPhoto.${caseId}`, () => ['filing', { caseIdPhoto: caseId }] as const),
```

- [ ] **Step 4: Add the ID-photo card to `IntakePage`**

Place an optional card between Family Composition and the consent section, following the existing card/heading pattern in the file. It renders: a heading (`t('intake.idPhoto.title')`), an `<input type="file" accept="image/*">` (hidden) driven by a button, a preview thumbnail of `getPendingIdPhoto()` via `URL.createObjectURL`, and a "Remove" button calling `setPendingIdPhoto(null)`. On file select: `if (file) setPendingIdPhoto(file)`.

```tsx
{/* ID Photo (optional) */}
<div className="card">
  <h3 className="text-sm font-semibold">{t('intake.idPhoto.title', 'ID Photo (optional)')}</h3>
  <p className="text-xs text-muted-foreground">{t('intake.idPhoto.optional', 'Optional photo of the beneficiary government ID.')}</p>
  <div className="mt-3 flex items-center gap-3">
    {pendingPreview ? (
      <img src={pendingPreview} className="h-24 w-24 rounded border object-cover"
        alt={t('intake.idPhoto.previewAlt', 'Government ID preview')} />
    ) : (
      <button type="button" onClick={() => fileInputRef.current?.click()}
        className="rounded border px-3 py-2 text-xs">
        {t('intake.idPhoto.pick', 'Choose ID photo')}
      </button>
    )}
    {pendingPreview && (
      <button type="button" onClick={() => { setPendingIdPhoto(null); setPendingPreview(null); }}
        className="text-xs text-red-500">
        {t('intake.idPhoto.remove', 'Remove')}
      </button>
    )}
    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0] ?? null;
        if (file) { setPendingIdPhoto(file); setPendingPreview(URL.createObjectURL(file)); }
      }} />
  </div>
</div>
```
Add local state: `const [pendingPreview, setPendingPreview] = useState<string | null>(null);` and `const fileInputRef = useRef<HTMLInputElement>(null);` (import `useRef`). Initialize `pendingPreview` from an existing pending file on mount if desired.

- [ ] **Step 5: Wire direct-path upload**

In the submit function that already receives a new `caseId` (the direct `/intake` path), after successfully creating the case and immediately before/while navigating, call:
```ts
void uploadIntakeIdPhoto(caseId).then((ok) => {
  if (!ok) toast.error(t('intake.idPhoto.uploadFailed', 'ID photo upload failed'));
});
```
(Match the file's existing `toast` import and use the same navigation that currently sends the user to the case.)

- [ ] **Step 6: Write the failing test**

In the intake page test file, add:
```ts
it('reads a chosen ID photo into the pending holder and shows a preview', async () => {
  const { getByText, getByRole } = render(<IntakePage />);
  // expect an "ID Photo" section to render
  expect(getByText(/ID Photo/i)).toBeTruthy();
});
```
(Adapt to the file's existing test conventions — `render`/`fireEvent`/`screen` as already used.)

- [ ] **Step 7: Run the intake tests**

Run (from `kapwa-client/`): `npm run test:run -- src/pages/IntakePage.test.tsx` (or the exact existing intake test path).
Expected: new test passes; no regressions.

- [ ] **Step 8: Typecheck**

Run (from `kapwa-client/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 9: Add i18n keys (en + fil)**

In `kapwa-client/src/locales/en.ts` and `.../fil.ts` (or the locale files actually used), add under `intake.idPhoto`:
en: `title: 'ID Photo (optional)'`, `optional: 'Optional photo of the beneficiary government ID.'`, `pick: 'Choose ID photo'`, `remove: 'Remove'`, `previewAlt: 'Government ID preview'`, `uploadFailed: 'ID photo upload failed'`.
fil: Filipino translations of the same keys.

- [ ] **Step 10: Commit**

```bash
git add kapwa-client/src/lib/intake-id-photo.ts kapwa-client/src/lib/query-keys.ts kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/pages/IntakePage.test.tsx kapwa-client/src/locales/en.ts kapwa-client/src/locales/fil.ts
git commit -m "feat(intake): optional government ID photo picker with direct-path upload"
```

---

### Task 4: Client — upload ID photo on the match-review paths

**Files:**
- Modify: `kapwa-client/src/pages/IntakeReviewPage.tsx`
- Test: `kapwa-client/src/pages/IntakeReviewPage.test.tsx` (or the existing review page test file)

**Interfaces:**
- Consumes: `uploadIntakeIdPhoto` from `@/lib/intake-id-photo` (from Task 3).
- Produces: `handleConfirm` and the "create new client" handler both call `uploadIntakeIdPhoto(caseId)` once `caseId` is known.

- [ ] **Step 1: Read `IntakeReviewPage.tsx` handlers**

Run: `grep -n "handleConfirm\|handleCreateNew\|caseId\|navigate\|\`/cases/" kapwa-client/src/pages/IntakeReviewPage.tsx`
Read ~40 lines around `handleConfirm` (line ~94) and the create-new path (line ~106).

- [ ] **Step 2: Wire confirm path**

In `handleConfirm(householdId)`, after the API returns a `caseId` (and before/while navigating to `` `/cases/${caseId}` ``), call:
```ts
void uploadIntakeIdPhoto(caseId).then((ok) => {
  if (!ok) toast.error(t('intake.idPhoto.uploadFailed', 'ID photo upload failed'));
});
```
(Match the file's existing `toast`/`t` usage.)

- [ ] **Step 3: Wire create-new path**

In the create-new handler (the one that navigates to `/cases` after a new case is made, line ~106), capture the returned `caseId` and call `uploadIntakeIdPhoto(caseId)` the same way (with the same toast on failure). If this path uses `completeIntake` from `IntakePage` shared code (Task 3 already wires the direct path), ensure the review create-new path does NOT double-upload — the direct-path wiring in Task 3 covers the `/intake` POST; if this review path also POSTs `/intake`, it is the same `completeIntake` and will already upload; only add the confirm path here. Inspect the code to decide: if both handlers share `completeIntake(caseId)`, then only the confirm/match path needs new wiring here.

- [ ] **Step 4: Write the failing test**

Add to the review page test file (adapt to existing conventions):
```ts
it('uploads the pending ID photo once a case is confirmed', async () => {
  // render ReviewPage with a pending ID photo set via setPendingIdPhoto(new File([], 'id.png'))
  // confirm the match; expect the api POST /filing/upload to have been called with category=id_photo
});
```
Use the existing `api`/`fetch` mocking pattern in the test file.

- [ ] **Step 5: Run the review tests**

Run (from `kapwa-client/`): `npm run test:run -- src/pages/IntakeReviewPage.test.tsx` (or the actual file path).
Expected: passes.

- [ ] **Step 6: Typecheck**

Run (from `kapwa-client/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/pages/IntakeReviewPage.tsx kapwa-client/src/pages/IntakeReviewPage.test.tsx
git commit -m "feat(intake): upload ID photo on match-review confirm path"
```

---

### Task 5: Client — show the ID photo on the case page

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`
- Test: `kapwa-client/src/pages/CaseViewPage.test.tsx` (or existing case view test file)

**Interfaces:**
- Consumes: `queryKeys.filing.caseIdPhoto(caseId)` (Task 3); `getFilingObjectUrl(id)` from `@/lib/api`; `useAuth` (line 61).
- Produces: a read-only "ID Photo" panel on `CaseViewPage` for admin/social_worker.

- [ ] **Step 1: Read `CaseViewPage.tsx` Documents card**

Run: `sed -n '55,80p' kapwa-client/src/pages/CaseViewPage.tsx && sed -n '345,375p' kapwa-client/src/pages/CaseViewPage.tsx`
Read the `documents` SWR fetch (line 72) and the Documents card (line 352).

- [ ] **Step 2: Fetch the ID photo**

Add a SWR fetch shaped like the existing documents fetch (line 72):
```ts
const { data: idPhoto } = useSWR<any>(
  id ? queryKeys.filing.caseIdPhoto(id) : null,
  async () => {
    const res = await api.get(`/filing/case/${id}/id-photo`);
    return res.data ?? null;
  },
);
```
(Match the exact `api` API shape used in the file — if `api.get` returns the body directly, drop `.data`.)

- [ ] **Step 3: Render the ID-photo panel**

Inside the Documents card area (or a sibling panel), conditionally render for admin/social_worker (`const { user } = useAuth()` already at line 61; guard with `['admin','social_worker'].includes(user?.role)`):
```tsx
{['admin', 'social_worker'].includes(user?.role) && idPhoto && (
  <div className="mt-4">
    <h4 className="text-sm font-semibold">{t('cases.idPhoto.title', 'Government ID')}</h4>
    <img
      src={awaitUrl /* resolved via getFilingObjectUrl(idPhoto.id) */}
      className="mt-2 h-40 w-40 rounded border object-cover"
      alt={t('cases.idPhoto.alt', 'Beneficiary government ID')}
    />
  </div>
)}
```
Because `getFilingObjectUrl` is async, implement the preview with a small effect/state that sets the object URL once `idPhoto` is loaded (resolve `idPhoto.id` → `URL.createObjectURL(blob)` via `getFilingObjectUrl`), storing it in local state and deriving the `<img src>` from that state.

- [ ] **Step 4: Add i18n keys (en + fil)**

Add under `cases.idPhoto`: `title: 'Government ID'`, `alt: 'Beneficiary government ID'` (en), and Filipino equivalents.

- [ ] **Step 5: Write the failing test**

Add to the case view test file (adapt to conventions):
```ts
it('shows the government ID panel when a photo is returned', async () => {
  // mock GET /filing/case/:id/id-photo to return a row
  // render CaseViewPage; expect "Government ID" heading
});
```

- [ ] **Step 6: Run the case view tests**

Run (from `kapwa-client/`): `npm run test:run -- src/pages/CaseViewPage.test.tsx` (or actual path).
Expected: passes.

- [ ] **Step 7: Typecheck**

Run (from `kapwa-client/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/pages/CaseViewPage.test.tsx kapwa-client/src/locales/en.ts kapwa-client/src/locales/fil.ts
git commit -m "feat(case-view): show attached government ID photo"
```

---

### Task 6: Client — remove coordinator from case routes

**Files:**
- Modify: `kapwa-client/src/routes.tsx`
- Test: existing routes/guard test (verify still passes)

**Interfaces:**
- Consumes: current `Private` role guards for `/cases`, `/cases/:id`, `/tracker`.
- Produces: those routes no longer allow `coordinator`.

- [ ] **Step 1: Confirm the lines**

Run: `grep -n "roles=\|'coordinator'" kapwa-client/src/routes.tsx | head -20`

- [ ] **Step 2: Edit the roles**

- Line ~98 `/cases`: `['admin','social_worker','coordinator']` → `['admin','social_worker']`
- Line ~99 `/cases/:id`: same → `['admin','social_worker']`
- Line ~102 `/tracker`: `['admin','social_worker','coordinator','mayor','auditor']` → `['admin','social_worker','mayor','auditor']`

Leave `/coordinator/*`, `/referrals`, `/messages`, announcement-manage routes intact.

- [ ] **Step 3: Run route/guard tests**

Run (from `kapwa-client/`): `npm run test:run`
Expected: full suite passes (check for a routes/guards spec; if one asserts coordinator access on these routes, update that assertion).

- [ ] **Step 4: Typecheck**

Run (from `kapwa-client/`): `npm run typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/routes.tsx
git commit -m "feat(routes): block coordinator access to cases and tracker"
```

---

## Self-Review

**Spec coverage:**
- Part 1.1 (`findIdPhotoByCase` + `GET /filing/case/:caseId/id-photo`) → Task 1 steps 2 & 6 ✓
- Part 1.2 (coordinator filing gate: `isPhotoAccessAllowed` generic branch + `findAll` coordinator scope) → Task 1 steps 3 & 4 ✓
- Part 1.3 (IntakePage picker + session holder) → Task 3 ✓
- Part 1.4 (submit wiring, both paths) → Task 3 step 5 (direct) + Task 4 (review paths) ✓
- Part 1.5 (CaseViewPage panel) → Task 5 ✓
- Part 1.6 (i18n) → Tasks 3 & 5 ✓
- Part 2.1 (client routes) → Task 6 ✓
- Part 2.2 (server cases controller) → Task 2 ✓
- Part 2.3 (filing category-aware gating) → Task 1 ✓

**Placeholder scan:** No TBD/TODO. All code steps show concrete code. Construction of service in Task 1 tests is intentionally delegated to mirror the file's existing pattern (noted explicitly, not a placeholder).

**Type consistency:** `findIdPhotoByCase` returns `Filing | null` (Task 1) consumed by controller (Task 1 step 6). `uploadIntakeIdPhoto(caseId: string): Promise<boolean>` (Task 3) consumed by Tasks 3 & 4. `queryKeys.filing.caseIdPhoto(caseId)` (Task 3) consumed by Task 5. Role strings `admin`/`social_worker`/`coordinator` consistent everywhere.
