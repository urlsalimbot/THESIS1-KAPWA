---
phase: 24-public-announcements
plan: 01
subsystem: announcements
tags: [announcements, tiptap, rich-text, public, landing]
requires:
  - phase: 21-settings-notifications-ui
    provides: notification/announcement preference groundwork
  - phase: 23-dashboard-redesign
    provides: dashboard widget patterns reused for LatestAnnouncements
provides:
  - AnnouncementsModule (entity, service+spec, authenticated controller, public controller)
  - Announcement management UI (list + TipTap edit page)
  - Public AnnouncementPage detail + LatestAnnouncements landing section
  - RichTextEditor component (TipTap)
affects: [final audit]
tech-stack:
  added:
    - TipTap rich-text editor for announcement bodies
  patterns:
    - public vs. admin split: announcements-public.controller.ts serves unauthenticated reads; announcements.controller.ts guards management
key-files:
  created:
    - kapwa-server/src/announcements/{announcement.entity.ts,announcements.controller.ts,announcements-public.controller.ts,announcements.module.ts,announcements.service.ts,announcements.service.spec.ts}
    - kapwa-client/src/components/announcements/RichTextEditor.tsx
    - kapwa-client/src/pages/AnnouncementsPage.tsx
    - kapwa-client/src/pages/AnnouncementEditPage.tsx
    - kapwa-client/src/pages/AnnouncementPage.tsx
    - kapwa-client/src/components/announcements/LatestAnnouncements.tsx
  modified:
    - kapwa-client/src/pages/LandingPage.tsx (LatestAnnouncements section)
    - kapwa-client/src/routes.tsx + sidebar nav + query keys
key-decisions:
  - "Announcements use a rich-text editor (TipTap) so staff can publish formatted posts without markdown knowledge"
  - "Public reads hit a separate unauthenticated controller so the landing page renders announcements without auth state"
  - "Mutations hardened: revalidation on edit, typography consistency, idempotent save (10c47ef)"
requirements-completed: [ANN-01, ANN-02]
duration: 2d
completed: 2026-08-02
status: complete
---

# Phase 24: Public Announcements — Summary

**Shipped a full announcements feature: admin publish workflow with a TipTap rich-text editor, public detail pages, and a landing-page Latest Announcements section — E2E verified**

## Performance

- **Duration:** ~2 days (2026-08-01 → 2026-08-02)
- **Key commits:** `2fa529d` (query keys + sidebar nav), `0346086` (RichTextEditor), `11452e9` (AnnouncementsPage), `36adada` (AnnouncementEditPage), `99d3b9f` (LatestAnnouncements section), `8bab1a5` (public AnnouncementPage), `718becd` (landing LatestAnnouncements), `d347772` (client routes), `10c47ef` (mutation hardening), `2c9041a` (styling + restore point)

## Accomplishments

- **Server**: `AnnouncementsModule` with entity, service (+ spec), guarded management controller, and an unauthenticated public controller
- **Management UI**: `AnnouncementsPage` list and `AnnouncementEditPage` backed by the TipTap `RichTextEditor`
- **Public UI**: `AnnouncementPage` detail view and `LatestAnnouncements` section on the landing page
- **Integration**: routes, sidebar nav, and query keys wired; typography and mutation hardening applied
- **Verification**: E2E flow (publish → see on landing → open detail) verified end-to-end

## Decisions Made

- Separate public controller keeps landing-page reads auth-free and cacheable
- TipTap chosen so non-technical staff can format announcements
- Hardened edit-form revalidation to prevent stale save states

## Deviations from Plan

- No dedicated announcement list pagination endpoint in the first pass — the management list loads all published announcements; pagination deferred to final audit

## Known Stubs

- Announcement list pagination and scheduled publish-at dates are future enhancements, not in the shipped scope

## Self-Check: PASSED

- [x] `announcements/` server module exists (entity/controller/public-controller/service/spec)
- [x] `AnnouncementsModule` registered in app.module
- [x] `RichTextEditor.tsx`, `AnnouncementsPage.tsx`, `AnnouncementEditPage.tsx`, `AnnouncementPage.tsx` exist
- [x] `LatestAnnouncements` on LandingPage
- [x] E2E flow verified

---
*Phase: 24-public-announcements*
*Completed: 2026-08-02*
