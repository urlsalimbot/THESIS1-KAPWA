# Announcement & Inter-Agency Referral Detail/Create Pages — Design

**Date:** 2026-08-25
**Status:** Approved by user (2026-08-25)
**Scope:** kapwa-client frontend + kapwa-server (one new endpoint). Two features: announcements detail/create pages, inter-agency referral detail page with MSWDO integration.

## Problem

Two gaps versus the system's List → Detail (`/:id`) → Create (`/new`) page pattern (Cases, Programs, IRF):

1. **Announcements** — the manage list links straight into a combined create+edit form. There is no manage-side detail (read) view, create and edit share one component/route, and the public detail page (`/announcements/:slug`) is not surfaced from the manage list.
2. **Inter-agency referrals** — only a list of `ReferralCard`s with inline actions; no detail page, no `GET /inter-agency-referrals/:id` endpoint, and no MSWDO-side surface for these referrals (outgoing should appear in the case, incoming in the referrals page).

## 1. Announcements

### Routes (`kapwa-client/src/routes.tsx`)

| Path | Component | Notes |
|------|-----------|-------|
| `/announcements/manage` | `AnnouncementsPage` (list) | unchanged |
| `/announcements/manage/:id` | `AnnouncementDetailPage` (new) | read-only detail + actions |
| `/announcements/manage/:id/edit` | `AnnouncementEditPage` | edit mode (route moved from `/:id`) |
| `/announcements/manage/new` | `CreateAnnouncementPage` (new) | dedicated create |
| `/announcements/:slug` (public) | `AnnouncementPage` | unchanged |

Static segments outrank dynamic in the data router, so `/new` and `/:id/edit` resolve correctly regardless of declaration order.

### Components

- **`AnnouncementDetailPage`** (`kapwa-client/src/components/announcements/AnnouncementDetailPage.tsx`):
  - Fetches `GET /announcements/:id` via new `queryKeys.announcements.detail(id)`.
  - Renders: title, status badge (Draft/Published), pinned badge, published & updated dates, excerpt, body HTML in the existing `prose` wrapper, slug.
  - Actions: **Edit** → `/announcements/manage/:id/edit`, **Delete** (confirm), **Publish/Unpublish**, **Pin/Unpin**, **View public** link → `/announcements/:slug` (only when `status === 'published'`).
  - Uses `PageShell` with `backTo` → `/announcements/manage`.
- **`AnnouncementForm`** (extracted shared component): title, optional excerpt, body via existing `RichTextEditor` (Write/Preview tabs), Save as Draft + Save & Publish buttons. Used by:
  - **`CreateAnnouncementPage`** → `POST /announcements` (status draft|published).
  - **`AnnouncementEditPage`** → `PATCH /announcements/:id`.
- **`AnnouncementsPage`** (list): announcement title becomes a link to the detail page; **Edit** button targets `/announcements/manage/:id/edit`; add a **View** action opening the detail page. Keep publish/pin/delete inline actions.

## 2. Inter-agency referrals

### Server (`kapwa-server/src/inter-agency-referrals/`)

- **`GET /inter-agency-referrals/:id`** in `inter-agency-referrals.controller.ts`, declared AFTER the static GETs (`inbox`, `person/:personId`, `case/:caseId`, `beneficiary-search`). Roles `admin|social_worker|agency_staff`. Uses `ParseUUIDPipe`.
- Service `findOne(id, caller)`: loads with relations `['fromAgency', 'toAgency', 'person', 'case']`. Scoping: caller must be `admin`/`social_worker` OR the referral's `fromAgencyId`/`toAgencyId` must equal the caller's agency — otherwise `NotFoundException` (404, no existence leak).

### Client

- **`queryKeys.interAgencyReferrals.detail(id)`** added.
- **`AgencyReferralDetailPage`** (`kapwa-client/src/pages/AgencyReferralDetailPage.tsx`) at `/agency/referrals/:id`, roles `admin|social_worker|agency_staff`:
  - Fetches `GET /inter-agency-referrals/:id`.
  - Renders: person name, from→to agency (code/name), status badge + `StatusTimeline`, reason, legal basis, notes, outcome, declined reason, created date, linked case control number (link to `/cases/:id` when `caseId` present).
  - Transition actions (Receive/Decline, Mark Actioned, Close-with-outcome) via shared **`ReferralActions`**.
  - `PageShell` with `backTo` to the originating page (passed via location state, defaulting to `/agency/referrals`).
- **`ReferralActions`** (extracted from `ReferralCard` into `kapwa-client/src/components/referrals/ReferralActions.tsx`): the Receive/Decline dialog, Mark Actioned, and Close-with-outcome dialog logic, driven by the same `canReceive/canAction/canClose/canDecline` rules. `ReferralCard` and `AgencyReferralDetailPage` both use it.
- **`ReferralCard`**: adds a **View details** link → `/agency/referrals/:id`; keeps inline quick actions.

### MSWDO integration

- **`CaseViewPage`**: new "Inter-Agency Referrals" section. Fetches existing `GET /inter-agency-referrals/case/:caseId` (`queryKeys.interAgencyReferrals.byCase` already exists). Lists every inter-agency referral linked to this case (covers referrals MSWDO referred out of the case, plus any case-linked referrals received), each row links to `/agency/referrals/:id`. Empty state: small "No inter-agency referrals" note.
- **`ReferralsPage`** (MSWDO `/referrals`, worker view): new "Incoming Inter-Agency Referrals" section. Fetches `GET /inter-agency-referrals/inbox` and filters `toAgencyId === myAgencyId` (MSWDO). Rows/cards link to `/agency/referrals/:id`. Empty state: "No incoming inter-agency referrals".

## 3. Cross-cutting

- `queryKeys` additions: `announcements.detail(id)`, `interAgencyReferrals.detail(id)`.
- Every new/visible string is added to BOTH `en` and `fil` locales (the fil parity test enforces this). Reuse existing keys where possible.
- Error/loading states follow existing page patterns (`Skeleton`, `EmptyState`, `ErrorState`).
- Mutations use `try/catch` + `toast` per repo convention; SWR revalidation via `mutate` after transitions.
- The referral detail route serves all three roles from `/agency/referrals/:id` (role gate widened); entry points link there.

## 4. Testing

- **Server (jest):** `findOne` — returns full object for participant/admin; 404 for non-participant; 404 for missing id; controller route resolves after static GETs.
- **Client (vitest):** `AnnouncementDetailPage` renders article + actions; `CreateAnnouncementPage` submits POST; `AnnouncementEditPage` submits PATCH; `AnnouncementsPage` links to detail; `AgencyReferralDetailPage` renders fields + transitions; `ReferralCard` has View link; CaseViewPage + ReferralsPage render the new sections.

## 5. Non-goals

- No new announcement fields or schema changes.
- No changes to the inter-agency referral data model or transition rules (only the read endpoint is added).
- Coordinator referrals (barangay) are untouched — the MSWDO ReferralsPage section is additive alongside the existing barangay referral queue.