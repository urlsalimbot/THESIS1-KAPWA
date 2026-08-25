# Announcement & Inter-Agency Referral Detail/Create Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manage-side announcement detail page + dedicated announcement create page, and an inter-agency referral detail page with MSWDO integration (case view + referrals page), aligned with the system's List → Detail → Create pattern.

**Architecture:** One new server endpoint (`GET /inter-agency-referrals/:id`, scoped). Client: extract a shared `AnnouncementForm` from `AnnouncementEditPage`, add `CreateAnnouncementPage`, `AnnouncementDetailPage`, and `AgencyReferralDetailPage`; extract `ReferralActions` from `ReferralCard`; add inter-agency sections to `CaseViewPage` and the MSWDO `ReferralsPage`. New i18n keys are added to both en and fil locales.

**Tech Stack:** NestJS (server), React 18 + TypeScript + react-i18next + SWR + Tailwind (client), Vitest + Testing Library (client tests), Jest (server tests).

## Global Constraints

- New i18n keys MUST be added to BOTH `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` with identical `{{placeholder}}` sets (the `fil-parity.test.ts` suite enforces key-for-key mirroring, non-identical values outside the allowlist, no HTML tags, and placeholder equality). Reuse existing keys before adding new ones.
- No changes to the inter-agency referral data model, transition rules, or the announcements schema — only the read endpoint is added.
- New pages must follow existing `PageShell` + SWR (`useSWR(key, (key) => api.get(key))`) + `toast` + `Skeleton`/`EmptyState`/`ErrorState` patterns.
- Server tests: run focused with `npx jest <path> --silent` from `kapwa-server/`; server typecheck: `npm run typecheck`.
- Client tests: `npm run test:run -- <path>` and typecheck `npm run typecheck` from `kapwa-client/`.
- Coordinator (barangay) referrals are untouched — the ReferralsPage addition is a new section, not a replacement.
- Do not modify files outside those listed per task.

---

### Task 1: Server — scoped `GET /inter-agency-referrals/:id`

**Files:**
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts` (add `findOne` after `findInbox`)
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts` (add `@Get(':id')` after `@Get('beneficiary-search')`)
- Test: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts` (extend with a `findOne` describe block)

**Interfaces:**
- Produces: `InterAgencyReferralsService.findOne(id: string, caller: User): Promise<InterAgencyReferral>` — throws `NotFoundException` when missing or not visible to the caller. Used by Task 5's detail page.

- [ ] **Step 1: Write the failing tests**

Append this block to `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts` (after the `inbox scoping` describe block):

```ts
  describe('findOne', () => {
    const baseRef = { id: 'r1', fromAgencyId: 'ag-1', toAgencyId: 'ag-2', status: 'referred', personId: 'p1', createdBy: 'u1' };

    it('returns the referral for a participating agency', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef, fromAgency: { id: 'ag-1' }, toAgency: { id: 'ag-2' }, person: { id: 'p1' } });
      const result = await service.findOne('r1', agencyUser('u2', 'ag-2'));
      expect(result.id).toBe('r1');
      expect(result.toAgency).toEqual({ id: 'ag-2' });
    });

    it('admin sees any referral', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      const result = await service.findOne('r1', { id: 'u-admin', role: 'admin' } as any);
      expect(result.id).toBe('r1');
    });

    it('social worker without agency sees referrals they created', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      const result = await service.findOne('r1', agencyUser('u1', ''));
      expect(result.id).toBe('r1');
    });

    it('throws NotFound for a non-participating caller', async () => {
      repoMock.findOne.mockResolvedValue({ ...baseRef });
      await expect(service.findOne('r1', agencyUser('u3', 'ag-3'))).rejects.toThrow('Inter-agency referral not found');
    });

    it('throws NotFound for a missing referral', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing', agencyUser('u2', 'ag-2'))).rejects.toThrow('Inter-agency referral not found');
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/inter-agency-referrals/inter-agency-referrals.service.spec.ts --silent`
Expected: FAIL — `service.findOne is not a function`.

- [ ] **Step 3: Implement `findOne` in the service**

Add this method to `InterAgencyReferralsService` immediately after `findInbox` (line 112):

```ts
  async findOne(id: string, caller: User): Promise<InterAgencyReferral> {
    const ref = await this.repo.findOne({
      where: { id },
      relations: ['fromAgency', 'toAgency', 'person', 'case'],
    });
    if (!ref) throw new NotFoundException('Inter-agency referral not found');
    if (caller.role === 'admin') return ref;
    if (caller.agencyId && (ref.fromAgencyId === caller.agencyId || ref.toAgencyId === caller.agencyId)) return ref;
    if (caller.role === UserRole.SW && ref.createdBy === caller.id) return ref;
    throw new NotFoundException('Inter-agency referral not found');
  }
```

- [ ] **Step 4: Add the controller route**

In `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts`, insert after the `@Get('beneficiary-search')` method (line 65) and BEFORE `@Post()`:

```ts
  @Get(':id')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Get a single referral (participant or MSWDO staff only)' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.findOne(id, req.user);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/inter-agency-referrals/inter-agency-referrals.service.spec.ts --silent`
Expected: PASS — all tests including the 5 new `findOne` tests.

- [ ] **Step 6: Typecheck the server**

Run: `npm run typecheck` (from `kapwa-server/`)
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts
git commit -m "feat: add scoped GET /inter-agency-referrals/:id endpoint"
```

---

### Task 2: Announcements — shared `AnnouncementForm` + dedicated `CreateAnnouncementPage`

**Files:**
- Create: `kapwa-client/src/components/announcements/AnnouncementForm.tsx`
- Create: `kapwa-client/src/components/announcements/CreateAnnouncementPage.tsx`
- Modify: `kapwa-client/src/components/announcements/AnnouncementEditPage.tsx` (rewrite to edit-only, use `AnnouncementForm`)
- Modify: `kapwa-client/src/routes.tsx` (`/announcements/manage/new` → `CreateAnnouncementPage`)

**Interfaces:**
- Produces: `AnnouncementForm({ isNew, initial?, saving, onSave })` — `initial?: { title; excerpt; bodyHtml; pinned; status }`, `saving: 'draft' | 'published' | null`, `onSave: (status: 'draft' | 'published', values: { title: string; excerpt: string; bodyHtml: string }) => void`. Used by Task 3's edit route too.
- Produces: `CreateAnnouncementPage` — page component for `/announcements/manage/new`.

- [ ] **Step 1: Create `AnnouncementForm.tsx`**

Create `kapwa-client/src/components/announcements/AnnouncementForm.tsx` with exactly this content:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Megaphone, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RichTextEditor } from './RichTextEditor';

export interface AnnouncementFormValues {
  title: string;
  excerpt: string;
  bodyHtml: string;
}

interface AnnouncementFormProps {
  isNew: boolean;
  initial?: AnnouncementFormValues & { pinned: boolean; status: 'draft' | 'published' };
  saving: 'draft' | 'published' | null;
  onSave: (status: 'draft' | 'published', values: AnnouncementFormValues) => void;
}

export function AnnouncementForm({ isNew, initial, saving, onSave }: AnnouncementFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? '');

  const save = (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error(t('announcements.titleRequired', 'Title is required'));
      return;
    }
    onSave(status, { title, excerpt, bodyHtml });
  };

  const excerptHint = `${excerpt.length}/160 ${t('announcements.characters', 'characters')}`;

  return (
    <>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">{t('announcements.title', 'Title')}</Label>
              {title && (
                <span className="text-xs text-muted-foreground">{title.length} {t('announcements.chars', 'chars')}</span>
              )}
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('announcements.titlePlaceholder', 'e.g. Barangay Cleanup Drive Schedule')}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="excerpt">{t('announcements.excerpt', 'Excerpt')}</Label>
              <span className={excerpt.length > 160 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {excerptHint}
              </span>
            </div>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t('announcements.excerptPlaceholder', 'Short summary shown on the public website')}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('announcements.body', 'Body')}</Label>
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">{t('announcements.write', 'Write')}</TabsTrigger>
                <TabsTrigger value="preview">{t('announcements.preview', 'Preview')}</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-2">
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
              </TabsContent>
              <TabsContent value="preview" className="mt-2">
                <div className="border rounded-md p-6 bg-background min-h-[240px]">
                  {bodyHtml ? (
                    <div
                      className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('announcements.nothingToPreview', 'Nothing to preview yet.')}</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {isNew ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Megaphone size={13} />
            {t('announcements.publicHint', 'Announcements appear on the public home page once published.')}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                initial?.pinned
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-muted text-muted-foreground border border-transparent'
              }`}
            >
              <Pin size={11} />
              {initial?.pinned ? t('announcements.pinned', 'Pinned') : t('announcements.notPinned', 'Not pinned')}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                initial?.status === 'published'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {initial?.status === 'published' ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={() => save('draft')} disabled={saving !== null} variant="outline">
            {saving === 'draft' && <Loader2 size={16} className="animate-spin mr-1" />}
            {t('announcements.saveDraft', 'Save as Draft')}
          </Button>
          <Button onClick={() => save('published')} disabled={saving !== null}>
            {saving === 'published' && <Loader2 size={16} className="animate-spin mr-1" />}
            {t('announcements.savePublish', 'Save & Publish')}
          </Button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `CreateAnnouncementPage.tsx`**

Create `kapwa-client/src/components/announcements/CreateAnnouncementPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { AnnouncementForm, type AnnouncementFormValues } from './AnnouncementForm';

export function CreateAnnouncementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);

  const save = async (status: 'draft' | 'published', values: AnnouncementFormValues) => {
    setSaving(status);
    try {
      await api.post(['announcements'], { ...values, status });
      toast.success(status === 'published' ? t('announcements.publishSuccess', 'Published!') : t('announcements.savedDraft', 'Saved as draft'));
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.saveFailed', 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <PageShell
      title={t('announcements.newTitle', 'New Announcement')}
      description={t('announcements.newDesc', 'Draft and publish a public announcement.')}
      backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
    >
      <div className="max-w-3xl space-y-4">
        <AnnouncementForm isNew saving={saving} onSave={save} />
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 3: Rewrite `AnnouncementEditPage.tsx` to edit-only**

Replace the entire contents of `kapwa-client/src/components/announcements/AnnouncementEditPage.tsx` with:

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AnnouncementForm, type AnnouncementFormValues } from './AnnouncementForm';
import { useTranslation } from 'react-i18next';

interface AnnouncementDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
}

export function AnnouncementEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);

  const { data, isLoading } = useSWR(
    id ? ['announcements', id] : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const save = async (status: 'draft' | 'published', values: AnnouncementFormValues) => {
    if (!id) return;
    setSaving(status);
    try {
      await api.patch(['announcements', id], { ...values, status });
      toast.success(t('announcements.updated', 'Updated'));
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.saveFailed', 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <PageShell
      title={t('announcements.editTitle', 'Edit Announcement')}
      description={t('announcements.editDesc', 'Update this announcement.')}
      backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
    >
      <div className="max-w-3xl space-y-4">
        {data && (
          <AnnouncementForm
            key={data.id}
            isNew={false}
            initial={data}
            saving={saving}
            onSave={save}
          />
        )}
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 4: Point `/announcements/manage/new` at `CreateAnnouncementPage`**

In `kapwa-client/src/routes.tsx`:
- Add import: `import { CreateAnnouncementPage } from './components/announcements/CreateAnnouncementPage';`
- Change line 134 from `<AnnouncementEditPage />` to `<CreateAnnouncementPage />` for the `/announcements/manage/new` route.

- [ ] **Step 5: Run the client tests and typecheck**

Run: `npm run test:run` (from `kapwa-client/`) then `npm run typecheck`
Expected: no failures; `tsc` exits 0. (No new test files exist for these components; existing suites must stay green.)

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/components/announcements/AnnouncementForm.tsx kapwa-client/src/components/announcements/CreateAnnouncementPage.tsx kapwa-client/src/components/announcements/AnnouncementEditPage.tsx kapwa-client/src/routes.tsx
git commit -m "feat: dedicated announcement create page with shared AnnouncementForm"
```

---

### Task 3: Announcements — manage `AnnouncementDetailPage` + list links + routes

**Files:**
- Create: `kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx`
- Modify: `kapwa-client/src/components/announcements/AnnouncementsPage.tsx` (title links to detail; Edit targets `/:id/edit`; add View action)
- Modify: `kapwa-client/src/lib/query-keys.ts` (add `announcements.detail(id)`)
- Modify: `kapwa-client/src/routes.tsx` (`/:id` → detail, add `/:id/edit` → edit)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` (new `announcements.*` keys)

**Interfaces:**
- Consumes: `queryKeys.announcements.detail(id)` (defined here, used by the detail page).
- Produces: `AnnouncementDetailPage` — page component for `/announcements/manage/:id`.

- [ ] **Step 1: Add `queryKeys.announcements.detail`**

In `kapwa-client/src/lib/query-keys.ts`, inside the `announcements` object (after `list`):

```ts
    detail: (id: string) => memo(`announcements.detail.${id}`, () => ['announcements', id] as const),
```

- [ ] **Step 2: Add i18n keys (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"announcements": {` object, add after `"backToHome": "Back to home",`:

```json
    "backToManage": "Back to Announcements",
    "detailDesc": "View announcement details and manage publishing.",
    "detailTitle": "Announcement Details",
    "notFoundManage": "Announcement not found",
    "notFoundManageBody": "This announcement may have been deleted.",
    "slugLabel": "Slug",
    "view": "View",
    "viewAria": "View {{title}}",
    "viewPublic": "View Public Page",
    "viewPublicAria": "View public page for {{title}}",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the `"announcements": {` object, add the same keys with these values:

```json
    "backToManage": "Bumalik sa Mga Anunsyo",
    "detailDesc": "Tingnan ang mga detalye ng anunsyo at pamahalaan ang paglalathala.",
    "detailTitle": "Mga Detalye ng Anunsyo",
    "notFoundManage": "Hindi nahanap ang anunsyo",
    "notFoundManageBody": "Maaaring nabura na ang anunsyong ito.",
    "slugLabel": "Slug (URL)",
    "view": "Tingnan",
    "viewAria": "Tingnan ang {{title}}",
    "viewPublic": "Tingnan ang Pampublikong Pahina",
    "viewPublicAria": "Tingnan ang pampublikong pahina para sa {{title}}",
```

- [ ] **Step 3: Create `AnnouncementDetailPage.tsx`**

Create `kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx`:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/PageShell';
import { toast } from 'sonner';
import { Loader2, Pin, PinOff, Pencil, Trash2, Eye, ExternalLink } from 'lucide-react';

interface AnnouncementDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export function AnnouncementDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, mutate, isLoading, error } = useSWR(
    id ? queryKeys.announcements.detail(id) : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const handleDelete = async () => {
    if (!data) return;
    if (!window.confirm(t('announcements.deleteConfirm', 'Delete "{{title}}"?', { title: data.title }))) return;
    try {
      await api.del(['announcements', data.id]);
      toast.success(t('announcements.deleted', 'Deleted'));
      navigate('/announcements/manage');
    } catch {
      toast.error(t('announcements.deleteFailed', 'Failed to delete announcement'));
    }
  };

  const handlePublishToggle = async () => {
    if (!data) return;
    try {
      await api.patch(['announcements', data.id], { status: data.status === 'published' ? 'draft' : 'published' });
      toast.success(data.status === 'published' ? t('announcements.unpublished', 'Unpublished') : t('announcements.publishSuccess', 'Published!'));
      mutate();
    } catch {
      toast.error(t('announcements.publishFailed', 'Failed to publish announcement'));
    }
  };

  const handlePinToggle = async () => {
    if (!data) return;
    try {
      await api.patch(['announcements', data.id, 'pin']);
      toast.success(data.pinned ? t('announcements.unpinned', 'Unpinned') : t('announcements.pinnedToast', 'Pinned'));
      mutate();
    } catch {
      toast.error(data.pinned ? t('announcements.unpinFailed', 'Failed to unpin announcement') : t('announcements.pinFailed', 'Failed to pin announcement'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <PageShell
        title={t('announcements.notFoundManage', 'Announcement not found')}
        description=""
        backTo={{ label: t('announcements.manage', 'Announcements'), onClick: () => navigate('/announcements/manage') }}
      >
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">{t('announcements.notFoundManageBody', 'This announcement may have been deleted.')}</p>
        </div>
      </PageShell>
    );
  }

  const published = data.status === 'published';

  return (
    <PageShell
      title={t('announcements.detailTitle', 'Announcement Details')}
      description={t('announcements.detailDesc', 'View announcement details and manage publishing.')}
      backTo={{ label: t('announcements.backToManage', 'Back to Announcements'), onClick: () => navigate('/announcements/manage') }}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/announcements/manage/${data.id}/edit`)}>
            <Pencil size={14} className="mr-1" /> {t('announcements.edit', 'Edit')}
          </Button>
          {published && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/announcements/${data.slug}`} target="_blank" rel="noreferrer" aria-label={t('announcements.viewPublicAria', 'View public page for {{title}}', { title: data.title })}>
                <ExternalLink size={14} className="mr-1" /> {t('announcements.viewPublic', 'View Public Page')}
              </a>
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-semibold font-heading">{data.title}</h2>
                {data.pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                    <Pin size={12} /> {t('announcements.pinned', 'Pinned')}
                  </span>
                )}
                <Badge variant={published ? 'default' : 'secondary'}>
                  {published ? t('announcements.published', 'Published') : t('announcements.draft', 'Draft')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {published
                  ? `${t('announcements.publishedOn', 'Published')} ${new Date(data.publishedAt!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                  : `${t('announcements.updatedOn', 'Updated')} ${new Date(data.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`}
              </p>
            </div>

            {data.excerpt && (
              <p className="text-sm text-muted-foreground border-l-2 border-accent/40 pl-4">{data.excerpt}</p>
            )}

            <div>
              <span className="text-xs text-muted-foreground font-medium">{t('announcements.slugLabel', 'Slug')}</span>
              <p className="text-sm font-mono">{data.slug}</p>
            </div>

            {data.bodyHtml && (
              <div
                className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-a:text-primary dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePublishToggle}>
              <Eye size={14} className="mr-1" />
              {published ? t('announcements.unpublish', 'Unpublish') : t('announcements.publish', 'Publish')}
            </Button>
            <Button size="sm" variant="outline" onClick={handlePinToggle}>
              {data.pinned ? <PinOff size={14} className="mr-1" /> : <Pin size={14} className="mr-1" />}
              {data.pinned ? t('announcements.unpin', 'Unpin') : t('announcements.pin', 'Pin')}
            </Button>
          </div>
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            <Trash2 size={14} className="mr-1" /> {t('announcements.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 4: Wire the routes**

In `kapwa-client/src/routes.tsx`:
- Add import: `import { AnnouncementDetailPage } from './components/announcements/AnnouncementDetailPage';`
- Change line 135 `/announcements/manage/:id` element from `<AnnouncementEditPage />` to `<AnnouncementDetailPage />`.
- Add after that route: `{ path: '/announcements/manage/:id/edit', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementEditPage /></Private> },`

- [ ] **Step 5: Update `AnnouncementsPage.tsx` list links**

In `kapwa-client/src/components/announcements/AnnouncementsPage.tsx`:
- Make the `<h3 className="font-semibold font-heading truncate">{a.title}</h3>` clickable — wrap it in a button/link that navigates to `/announcements/manage/${a.id}`:
  Replace line 144 `<h3 className="font-semibold font-heading truncate">{a.title}</h3>` with:
  ```tsx
  <button
    className="text-left hover:underline truncate"
    onClick={() => navigate(`/announcements/manage/${a.id}`)}
    aria-label={t('announcements.viewAria', 'View {{title}}', { title: a.title })}
  >
    <h3 className="font-semibold font-heading truncate">{a.title}</h3>
  </button>
  ```
- Change the Edit button navigation (line 180) from `` `/announcements/manage/${a.id}` `` to `` `/announcements/manage/${a.id}/edit` ``.
- Add a View action button before Edit (after the `TooltipProvider` opens, before the Edit Tooltip):
  ```tsx
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('announcements.viewAria', 'View {{title}}', { title: a.title })}
        onClick={() => navigate(`/announcements/manage/${a.id}`)}
      >
        <Eye size={16} />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{t('announcements.view', 'View')}</TooltipContent>
  </Tooltip>
  ```

- [ ] **Step 6: Verify parity, tests, typecheck**

Run: `npm run test:run -- src/i18n/__tests__/fil-parity.test.ts` (from `kapwa-client/`) — expected PASS.
Run: `npm run test:run` — expected no failures.
Run: `npm run typecheck` — expected exit 0.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx kapwa-client/src/components/announcements/AnnouncementsPage.tsx kapwa-client/src/lib/query-keys.ts kapwa-client/src/routes.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: announcement manage detail page with actions"
```

---

### Task 4: Inter-agency — extract `ReferralActions` + `ReferralCard` View link

**Files:**
- Create: `kapwa-client/src/components/referrals/ReferralActions.tsx`
- Modify: `kapwa-client/src/components/referrals/ReferralCard.tsx` (use `ReferralActions`, add View details link)

**Interfaces:**
- Produces: `ReferralActions({ referral, myAgencyId, onTransition, disabled })` — same props as today's inline block in `ReferralCard`. Consumed by Task 5's detail page.

- [ ] **Step 1: Create `ReferralActions.tsx`**

Create `kapwa-client/src/components/referrals/ReferralActions.tsx` by moving the action logic out of `ReferralCard` (keep the exact JSX, translated strings, and logic):

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { InterAgencyReferral } from './referral-utils';
import { useTranslation } from 'react-i18next';

export function ReferralActions({
  referral,
  myAgencyId,
  onTransition,
  disabled = false,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState('');
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const isReceiver = referral.toAgencyId === myAgencyId;
  const canReceive = isReceiver && referral.status === 'referred';
  const canAction = isReceiver && referral.status === 'received';
  const canClose = isReceiver && referral.status === 'actioned';
  const canDecline = isReceiver && referral.status === 'referred';

  if (!canReceive && !canAction && !canClose && !canDecline) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {canReceive && (
        <>
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')} disabled={disabled}>
            {t('referrals.receive', 'Receive')}
          </Button>
          <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={disabled}>
                {t('referrals.decline', 'Decline')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('referrals.declineTitle', 'Decline Referral?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('referrals.declineDesc', 'This will decline the referral for this beneficiary. This action cannot be undone.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('referrals.keepReferral', 'Keep Referral')}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'decline', { declinedReason: 'Unable to accommodate' });
                  setDeclineDialogOpen(false);
                }}>
                  {t('referrals.decline', 'Decline')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          {t('referrals.markActioned', 'Mark Actioned')}
        </Button>
      )}
      {canClose && (
        <>
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder={t('referrals.outcome', 'Outcome')}
            className="flex-1 min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={disabled || !outcome.trim()}>
                {t('referrals.close', 'Close')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('referrals.closeTitle', 'Close Referral?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('referrals.closeDesc', 'This will permanently close the referral for this beneficiary. This action cannot be undone.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('referrals.keepOpen', 'Keep Open')}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  await onTransition(referral.id, 'close', { outcome });
                  setCloseDialogOpen(false);
                }}>
                  {t('referrals.closeReferral', 'Close Referral')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ReferralCard.tsx` to use `ReferralActions` + add View link**

Replace the entire contents of `kapwa-client/src/components/referrals/ReferralCard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { InterAgencyReferral, StatusTimeline } from './referral-utils';
import { ReferralActions } from './ReferralActions';
import { useTranslation } from 'react-i18next';
import { referralStatusLabel } from '@/i18n/display';

export function ReferralCard({
  referral,
  myAgencyId,
  onTransition,
  disabled = false,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const personName = referral.person
    ? `${referral.person.firstName} ${referral.person.surname}`.trim()
    : t('referrals.person', 'Person');

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{personName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {referral.fromAgency?.name || referral.fromAgencyId} →{' '}
            {referral.toAgency?.name || referral.toAgencyId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {referral.status !== 'declined' && <StatusTimeline status={referral.status} />}
          <Badge variant={referral.status === 'declined' ? 'destructive' : 'default'}>
            {referralStatusLabel(t, referral.status)}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: personName })}
            onClick={() => navigate(`/agency/referrals/${referral.id}`)}
          >
            <Eye size={16} />
          </Button>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        {t('referrals.basis', 'Basis: {{code}}', { code: referral.legalBasisCode })} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">{t('referrals.notesLabel', 'Notes: {{notes}}', { notes: referral.notes })}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">{t('referrals.outcomeLabel', 'Outcome: {{outcome}}', { outcome: referral.outcome })}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">{t('referrals.declinedLabel', 'Declined: {{reason}}', { reason: referral.declinedReason })}</p>
      )}
      <ReferralActions referral={referral} myAgencyId={myAgencyId} onTransition={onTransition} disabled={disabled} />
    </div>
  );
}
```

- [ ] **Step 3: Add the `viewDetailsAria` i18n key (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"referrals": {` object add:

```json
    "viewDetailsAria": "View details for {{name}}",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the `"referrals": {` object add:

```json
    "viewDetailsAria": "Tingnan ang mga detalye para kay {{name}}",
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run test:run -- src/pages/AgencyReferralsPage.test.tsx src/components/referrals` (from `kapwa-client/`) then `npm run test:run` then `npm run typecheck`
Expected: existing `AgencyReferralsPage` tests stay green; no failures; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/referrals/ReferralActions.tsx kapwa-client/src/components/referrals/ReferralCard.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: extract ReferralActions, add view link to referral cards"
```

---

### Task 5: Inter-agency — `AgencyReferralDetailPage` + route + query key

**Files:**
- Create: `kapwa-client/src/pages/AgencyReferralDetailPage.tsx`
- Modify: `kapwa-client/src/lib/query-keys.ts` (add `interAgencyReferrals.detail(id)`)
- Modify: `kapwa-client/src/routes.tsx` (add `/agency/referrals/:id`)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` (new `referrals.*` keys)

**Interfaces:**
- Consumes: `InterAgencyReferralsService.findOne` (Task 1), `ReferralActions` (Task 4), `queryKeys.interAgencyReferrals.detail(id)` (defined here).
- Produces: `AgencyReferralDetailPage` — page component for `/agency/referrals/:id`, roles `admin|social_worker|agency_staff`.

- [ ] **Step 1: Add the query key**

In `kapwa-client/src/lib/query-keys.ts`, inside `interAgencyReferrals` (after `byCase`):

```ts
    detail: (id: string) => memo(`iar.detail.${id}`, () => ['inter-agency-referrals', id] as const),
```

- [ ] **Step 2: Add i18n keys (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"referrals": {` object add:

```json
    "backToReferrals": "Back to Referrals",
    "createdOn": "Created on {{date}}",
    "detailsDesc": "Full information for this inter-agency referral.",
    "detailsTitle": "Referral Details",
    "fromAgency": "From Agency",
    "legalBasis": "Legal Basis",
    "linkedCase": "Linked Case",
    "noLinkedCase": "No linked case",
    "notFound": "Referral not found",
    "notFoundBody": "This referral may have been removed or you do not have access to it.",
    "reasonLabel": "Reason",
    "toAgency": "To Agency",
    "viewDetails": "View Details",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the `"referrals": {` object add:

```json
    "backToReferrals": "Bumalik sa Mga Referral",
    "createdOn": "Ginawa noong {{date}}",
    "detailsDesc": "Kumpletong impormasyon para sa inter-agency referral na ito.",
    "detailsTitle": "Mga Detalye ng Referral",
    "fromAgency": "Mula sa Ahensya",
    "legalBasis": "Legal na Batayan",
    "linkedCase": "Kaugnay na Kaso",
    "noLinkedCase": "Walang kaugnay na kaso",
    "notFound": "Hindi nahanap ang referral",
    "notFoundBody": "Maaaring naalis ang referral na ito o wala kang access dito.",
    "reasonLabel": "Dahilan",
    "toAgency": "Papunta sa Ahensya",
    "viewDetails": "Tingnan ang mga Detalye",
```

- [ ] **Step 3: Create `AgencyReferralDetailPage.tsx`**

Create `kapwa-client/src/pages/AgencyReferralDetailPage.tsx`:

```tsx
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import { InterAgencyReferral, StatusTimeline } from '@/components/referrals/referral-utils';
import { ReferralActions } from '@/components/referrals/ReferralActions';
import { referralStatusLabel } from '@/i18n/display';

export function AgencyReferralDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const myAgencyId = user?.agencyId;

  const backTo = (location.state as { from?: string } | null)?.from || '/agency/referrals';

  const { data, isLoading, error } = useSWR(
    id ? queryKeys.interAgencyReferrals.detail(id) : null,
    (key) => api.get<InterAgencyReferral>(key),
  );

  async function transition(transitionId: string, action: string, body?: Record<string, string>) {
    try {
      await api.patch(`/inter-agency-referrals/${transitionId}/${action}`, body);
      if (id) await mutate(queryKeys.interAgencyReferrals.detail(id));
    } catch (err: any) {
      alert(err?.message || t('agency.transitionFailed', 'Transition failed'));
    }
  }

  if (isLoading) {
    return (
      <PageShell title={t('referrals.detailsTitle', 'Referral Details')} description="" backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title={t('referrals.notFound', 'Referral not found')} description="" backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">{t('referrals.notFoundBody', 'This referral may have been removed or you do not have access to it.')}</p>
        </div>
      </PageShell>
    );
  }

  const personName = data.person
    ? `${data.person.firstName} ${data.person.surname}`.trim()
    : t('referrals.person', 'Person');

  return (
    <PageShell
      title={`${personName} — ${t('referrals.detailsTitle', 'Referral Details')}`}
      description={t('referrals.detailsDesc', 'Full information for this inter-agency referral.')}
      backTo={{ label: t('referrals.backToReferrals', 'Back to Referrals'), onClick: () => navigate(backTo) }}
    >
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold font-heading">{personName}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('referrals.fromAgency', 'From Agency')}: {data.fromAgency?.name || data.fromAgencyId} →{' '}
                  {t('referrals.toAgency', 'To Agency')}: {data.toAgency?.name || data.toAgencyId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {data.status !== 'declined' && <StatusTimeline status={data.status} />}
                <Badge variant={data.status === 'declined' ? 'destructive' : 'default'}>
                  {referralStatusLabel(t, data.status)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.reasonLabel', 'Reason')}</span>
                <p className="font-medium">{data.reason}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.legalBasis', 'Legal Basis')}</span>
                <p className="font-medium">{data.legalBasisCode}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referral.date', 'Date')}</span>
                <p className="font-medium">{new Date(data.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium">{t('referrals.linkedCase', 'Linked Case')}</span>
                {data.caseId ? (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/cases/${data.caseId}`)}>
                    {data.case?.controlNo || data.caseId} <ExternalLink size={12} className="ml-1" />
                  </Button>
                ) : (
                  <p className="font-medium text-muted-foreground">{t('referrals.noLinkedCase', 'No linked case')}</p>
                )}
              </div>
            </div>

            {data.notes && (
              <p className="text-sm text-muted-foreground">{t('referrals.notesLabel', 'Notes: {{notes}}', { notes: data.notes })}</p>
            )}
            {data.outcome && (
              <p className="text-sm text-muted-foreground">{t('referrals.outcomeLabel', 'Outcome: {{outcome}}', { outcome: data.outcome })}</p>
            )}
            {data.declinedReason && (
              <p className="text-sm text-destructive">{t('referrals.declinedLabel', 'Declined: {{reason}}', { reason: data.declinedReason })}</p>
            )}

            <div className="border-t pt-4">
              <ReferralActions referral={data} myAgencyId={myAgencyId} onTransition={transition} />
            </div>
          </CardContent>
        </Card>

        <Button variant="ghost" size="sm" onClick={() => navigate(backTo)}>
          <ArrowLeft size={14} className="mr-1" /> {t('referrals.backToReferrals', 'Back to Referrals')}
        </Button>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 4: Register the route**

In `kapwa-client/src/routes.tsx`:
- Add import: `import { AgencyReferralDetailPage } from './pages/AgencyReferralDetailPage';`
- Add after line 122 (`/agency/referrals`):

```tsx
  { path: '/agency/referrals/:id', element: <Private roles={['admin','social_worker','agency_staff']}><AgencyReferralDetailPage /></Private> },
```

- [ ] **Step 5: Add a client test for the detail page**

Create `kapwa-client/src/pages/AgencyReferralDetailPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { AgencyReferralDetailPage } from './AgencyReferralDetailPage';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { role: 'agency_staff', agencyId: 'ag-2' } }),
}));

const referral = {
  id: 'r1',
  personId: 'p1',
  fromAgencyId: 'ag-1',
  toAgencyId: 'ag-2',
  status: 'referred',
  reason: 'Medical follow-up',
  notes: 'Bring records',
  legalBasisCode: 'public_authority_sec13',
  person: { id: 'p1', surname: 'Santos', firstName: 'Maria' },
  fromAgency: { id: 'ag-1', code: 'RHU', name: 'Rural Health Unit' },
  toAgency: { id: 'ag-2', code: 'MSWDO', name: 'MSWDO Norzagaray' },
  createdAt: '2026-08-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agency/referrals/r1']}>
      <Routes>
        <Route path="/agency/referrals/:id" element={<AgencyReferralDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgencyReferralDetailPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(referral);
  });

  it('renders referral details', async () => {
    renderPage();
    expect(await screen.findByText(/Maria Santos/)).toBeTruthy();
    expect(screen.getByText(/Medical follow-up/)).toBeTruthy();
    expect(screen.getByText(/Rural Health Unit/)).toBeTruthy();
    expect(screen.getByText(/public_authority_sec13/)).toBeTruthy();
  });

  it('shows receive/decline actions for the receiving agency on referred status', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Receive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
  });

  it('shows not-found state on error', async () => {
    mockApiGet.mockRejectedValue(new Error('404'));
    renderPage();
    expect(await screen.findByText(/Referral not found/)).toBeTruthy();
  });

  it('has no a11y violations', async () => {
    const { container } = renderPage();
    await screen.findByText(/Maria Santos/);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

- [ ] **Step 6: Run tests, parity, typecheck**

Run: `npm run test:run -- src/pages/AgencyReferralDetailPage.test.tsx src/pages/AgencyReferralsPage.test.tsx` then `npm run test:run -- src/i18n/__tests__/fil-parity.test.ts` then `npm run typecheck`
Expected: all pass; `tsc` exit 0.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/pages/AgencyReferralDetailPage.tsx kapwa-client/src/pages/AgencyReferralDetailPage.test.tsx kapwa-client/src/lib/query-keys.ts kapwa-client/src/routes.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: inter-agency referral detail page"
```

---

### Task 6: Inter-agency — `CaseViewPage` section

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (add section after the Documents card, line 444)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` (new `cases.*` keys)

**Interfaces:**
- Consumes: `queryKeys.interAgencyReferrals.byCase(caseId)` (already exists), `referralStatusLabel`, `/agency/referrals/:id` route (Task 5).

- [ ] **Step 1: Add i18n keys (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"cases": {` object add:

```json
    "interAgencyReferrals": "Inter-Agency Referrals",
    "noInterAgencyReferrals": "No inter-agency referrals for this case",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the `"cases": {` object add:

```json
    "interAgencyReferrals": "Mga Referral sa Pagitan ng mga Ahensya",
    "noInterAgencyReferrals": "Walang inter-agency referral para sa kasong ito",
```

- [ ] **Step 2: Add the section to `CaseViewPage.tsx`**

In `kapwa-client/src/pages/CaseViewPage.tsx`:
1. Make these exact import edits (the file's current imports are shown in `Self-Review` notes; merge precisely):
   - Line 4: `import { statusLabel } from '@/i18n/display';` → `import { referralStatusLabel, statusLabel } from '@/i18n/display';`
   - Line 6: add `Send, ExternalLink` to the lucide-react import so it reads:
     ```tsx
     import { User, Users, Clock, AlertTriangle, Phone, MapPin, FileText, Download, FileWarning, Plus, Lock, Send, ExternalLink } from 'lucide-react';
     ```
   - Add after line 21 (the `StepClosure` import): `import { InterAgencyReferral } from '@/components/referrals/referral-utils';`
   - `useSWR`, `queryKeys`, `Badge`, `Separator` are already imported — do not re-add them.
2. Inside the component body (after the existing `caseData`/`interventions` SWR hooks, before the `if (isLoading)` return), add:
   ```tsx
   const { data: iarReferrals, isLoading: iarLoading } = useSWR(
     id ? queryKeys.interAgencyReferrals.byCase(id) : null,
     (key) => api.get<InterAgencyReferral[]>(key),
   );
   ```
3. Insert this block immediately after the closing `)}` of the `{/* Documents card */}` block (line 444) and before `{/* Claimant card */}`:

```tsx
          {/* Inter-Agency Referrals card */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <Send size={20} className="text-primary" />
              <h3 className="text-sm font-semibold">{t('cases.interAgencyReferrals', 'Inter-Agency Referrals')}</h3>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2">
              {iarLoading ? (
                <p className="text-xs text-muted-foreground">{t('cases.loadingCase', 'Loading case...')}</p>
              ) : (iarReferrals || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('cases.noInterAgencyReferrals', 'No inter-agency referrals for this case')}</p>
              ) : (
                (iarReferrals || []).map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/agency/referrals/${r.id}`)}
                    className="w-full text-left rounded-md border border-border/60 px-3 py-2 hover:bg-muted/50 transition-colors"
                    aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.fromAgency?.name || r.fromAgencyId} → {r.toAgency?.name || r.toAgencyId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={r.status === 'declined' ? 'destructive' : 'default'}>{referralStatusLabel(t, r.status)}</Badge>
                        <ExternalLink size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
```

4. `Badge` is already imported in `CaseViewPage.tsx`; confirm `Separator` is imported (it is — used at line 256).

- [ ] **Step 3: Run tests and typecheck**

Run: `npm run test:run` then `npm run typecheck` (from `kapwa-client/`)
Expected: no failures; `tsc` exit 0.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: show inter-agency referrals on case view"
```

---

### Task 7: Inter-agency — incoming referrals section on MSWDO `ReferralsPage`

**Files:**
- Create: `kapwa-client/src/components/referrals/IncomingInterAgencyReferrals.tsx`
- Modify: `kapwa-client/src/pages/ReferralsPage.tsx` (render the section in `WorkerReferralView`)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` and `kapwa-client/src/i18n/locales/fil/index.ts` (new `agency.*` keys)

**Interfaces:**
- Consumes: `queryKeys.interAgencyReferrals.inbox()` (exists), `useAuth().user.agencyId`, `/agency/referrals/:id` route (Task 5).
- Produces: `IncomingInterAgencyReferrals` — component rendered inside `WorkerReferralView` below the pending referrals table.

- [ ] **Step 1: Add i18n keys (en + fil)**

In `kapwa-client/src/i18n/locales/en/index.ts`, inside the `"agency": {` object add:

```json
    "incomingReferrals": "Incoming Inter-Agency Referrals",
    "noIncomingReferrals": "No incoming inter-agency referrals",
```

In `kapwa-client/src/i18n/locales/fil/index.ts`, inside the `"agency": {` object add:

```json
    "incomingReferrals": "Mga Papasok na Inter-Agency Referral",
    "noIncomingReferrals": "Walang papasok na inter-agency referral",
```

- [ ] **Step 2: Create `IncomingInterAgencyReferrals.tsx`**

Create `kapwa-client/src/components/referrals/IncomingInterAgencyReferrals.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, ExternalLink } from 'lucide-react';
import { InterAgencyReferral } from './referral-utils';
import { referralStatusLabel } from '@/i18n/display';

export function IncomingInterAgencyReferrals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myAgencyId = user?.agencyId;

  const { data, isLoading } = useSWR(
    queryKeys.interAgencyReferrals.inbox(),
    (key) => api.get<InterAgencyReferral[]>(key),
  );

  if (isLoading) return null;

  const incoming = (data || []).filter(r => r.toAgencyId === myAgencyId);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Send size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('agency.incomingReferrals', 'Incoming Inter-Agency Referrals')}</h2>
      </div>
      {incoming.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {t('agency.noIncomingReferrals', 'No incoming inter-agency referrals')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {incoming.map(r => (
            <button
              key={r.id}
              onClick={() => navigate(`/agency/referrals/${r.id}`)}
              className="w-full text-left rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
              aria-label={t('referrals.viewDetailsAria', 'View details for {{name}}', { name: r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id })}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.person ? `${r.person.firstName} ${r.person.surname}`.trim() : r.id}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('referrals.fromAgency', 'From Agency')}: {r.fromAgency?.name || r.fromAgencyId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.status === 'declined' ? 'destructive' : 'default'}>{referralStatusLabel(t, r.status)}</Badge>
                  <ExternalLink size={14} className="text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render it in `WorkerReferralView`**

In `kapwa-client/src/pages/ReferralsPage.tsx`:
- Add import: `import { IncomingInterAgencyReferrals } from '@/components/referrals/IncomingInterAgencyReferrals';`
- In `WorkerReferralView`'s main return (`<>...</>`), add `<IncomingInterAgencyReferrals />` right after the closing of the pending-referrals conditional block (after the `) : (` … `)}` that ends the Card/heading block, line ~296) and before the `<Dialog ...>`:

```tsx
      <IncomingInterAgencyReferrals />
```

- [ ] **Step 4: Run tests, parity, typecheck**

Run: `npm run test:run` then `npm run test:run -- src/i18n/__tests__/fil-parity.test.ts` then `npm run typecheck` (from `kapwa-client/`)
Expected: no failures; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/referrals/IncomingInterAgencyReferrals.tsx kapwa-client/src/pages/ReferralsPage.tsx kapwa-client/src/i18n/locales/en/index.ts kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat: show incoming inter-agency referrals on MSWDO referrals page"
```

---

### Task 8: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Server tests + typecheck**

Run: `npx jest src/inter-agency-referrals/inter-agency-referrals.service.spec.ts --silent` and `npm run typecheck` (from `kapwa-server/`)
Expected: PASS, exit 0.

- [ ] **Step 2: Client suite + parity + typecheck**

Run: `npm run test:run` and `npm run typecheck` (from `kapwa-client/`)
Expected: full client suite green (including `fil-parity.test.ts`), `tsc` exit 0.

- [ ] **Step 3: Report**

Report the final state: task list, commits, test counts, any pre-existing failures observed (with evidence they predate this work).

---

## Self-Review

**1. Spec coverage:** Announcements — manage detail page (Task 3), dedicated create page (Task 2), edit at `/:id/edit` (Task 3 routes), shared form (Task 2), list links to detail (Task 3), public link on detail (Task 3). Inter-agency — `GET /:id` endpoint (Task 1), detail page with transitions (Task 5), `ReferralActions` extraction + card View link (Task 4), CaseViewPage section (Task 6), ReferralsPage incoming section (Task 7). Cross-cutting — query keys (Tasks 3, 5), en+fil i18n (Tasks 3–7), tests per page (Tasks 1, 5), final sweep (Task 8). No gaps.

**2. Placeholder scan:** All steps carry complete code or exact commands; no TBD/TODO/descriptive-only steps.

**3. Type consistency:** `InterAgencyReferralsService.findOne(id, caller)` is defined in Task 1 and consumed by Task 5's `api.get('/inter-agency-referrals/:id')` (same route). `ReferralActions` props defined in Task 4 and used identically in Tasks 4 and 5. `queryKeys.announcements.detail(id)` (Task 3) and `queryKeys.interAgencyReferrals.detail(id)` (Task 5) match the `memo(...)` patterns in `query-keys.ts`. i18n keys added in one task are never redefined; placeholders in fil values match en ({{title}}, {{name}}, {{date}}).