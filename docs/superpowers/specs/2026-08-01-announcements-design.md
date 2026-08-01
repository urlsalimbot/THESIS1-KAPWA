# Design: Public Announcements

**Date:** 2026-08-01
**Status:** Approved (approach A)

## Goal

A public announcements/news section on the KAPWA landing page, managed by
MSWDO workers (admin, social_worker, coordinator) from inside the app. Full
articles with a public detail page; draft → publish workflow with pinning.

## Decisions

- Workers + admin can manage; public read-only for everyone else.
- Draft → published workflow, pinned items float to top.
- Rich text body, sanitized server-side.
- Public section sits on the landing page after the hero, before Services.

## Data model

New `announcements` table (TypeORM migration, auto-runs via
`migrationsRun: true`):

| column | type | notes |
|--------|------|-------|
| id | uuid PK | default uuid_generate_v7() |
| title | text NOT NULL | |
| slug | text NOT NULL UNIQUE | slugified, de-duplicated |
| excerpt | text NOT NULL default '' | card teaser, plain text |
| body_html | text NOT NULL | sanitized rich text HTML |
| body_text | text NOT NULL default '' | plain-text extract |
| status | text | CHECK IN ('draft','published'), default 'draft' |
| pinned | boolean default false | |
| published_at | timestamptz NULL | set on publish |
| created_by | uuid → users(id) | from JWT, never body |
| created_at / updated_at | timestamptz | |

## Server — `announcements` module

entity + service + controller + module, registered in AppModule.

**Public (no auth):**
- `GET /api/v1/announcements/public` — published only, pinned first then
  published_at DESC, take 20. Returns id/slug/title/excerpt/published_at.
- `GET /api/v1/announcements/public/:slug` — full published article or 404.

**Workers/admin (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles` per method):**
- `GET /api/v1/announcements` (all, newest first), `GET /:id` (any status).
- `POST /` create — defaults draft, slugify + de-duplicate, sanitize body.
- `PATCH /:id` update — re-slug on title change; status flip draft↔published
  sets published_at on first publish.
- `PATCH /:id/pin` toggle pinned.
- `DELETE /:id` delete.

**Security:** `sanitize-html` (new server dep) strips scripts/tags on write;
excerpt is tag-stripped plain text. Public endpoints return only published
rows. `created_by` from JWT only.

## Client

**Public:**
- `LatestAnnouncements` — fetches `/announcements/public`, up to 4 cards
  (title, excerpt, date, pinned star), each linking to the article page.
  Inserted on LandingPage after hero, before Services.
- `AnnouncementPage` at `/announcements/:slug` (outside auth gate): title,
  date, pinned badge, body HTML, "Back to home" link.
- `api.get` already tolerates a null token — no new client helper.

**Management (workers/admin):**
- Sidebar: **Announcements** added to Operations nav group,
  roles `['admin','social_worker','coordinator']`, path `/announcements/manage`.
- `AnnouncementsPage` (`/announcements/manage`): table — title, status badge
  (Draft/Published), pinned, published date, updated date — actions Edit,
  Publish/Unpublish, Pin/Unpin, Delete (confirm), New Announcement.
- `AnnouncementEditPage` (`/announcements/manage/new`, `/announcements/manage/:id`):
  title, optional excerpt, TipTap rich text editor (bold, italic, headings,
  bullet/numbered lists, link) emitting HTML. Save as Draft, Save & Publish,
  Cancel.
- New deps: `@tiptap/react`, `@tiptap/starter-kit`; small reusable
  `RichTextEditor` component.
- Routes in `routes.tsx`: public `/announcements/:slug`, protected
  `/announcements/manage` + new/edit.

## Testing

**Server (jest):** service specs — create defaults to draft, slug uniqueness,
publish sets published_at, unpublish clears it, pin toggle, sanitize strips
`<script>`.

**Client (vitest + RTL):** landing section renders published announcements;
manage page lists + toggles publish/pin + deletes; edit page validates title
and submits; public detail page renders article.
