# Coordinator Dashboard Cleanup — Design

**Date:** 2026-08-25
**Status:** Approved by user (2026-08-25)
**Scope:** Frontend (kapwa-client) only. Single page: `CoordinatorDashboardPage.tsx`.

## Problem

The coordinator dashboard (`/coordinator/dashboard`) carries MSWDO/caseworker tools that are not part of the barangay coordinator's responsibilities. Per the use-case diagram (`docs/diagrams/02-use-case-diagram.md`) and the coordinator module design (`docs/coordinator-module-design.md`), coordinators:

- File referrals and track their own referral status
- Manage access cards for their barangay (verify / assign / log activity)
- Participate in intake match-check/confirmation, physical files, sync, announcements, chat

They do NOT manage cases (case work is an MSWDO/caseworker domain) and do not operate the daily tracker (admin/social_worker tool, hidden from coordinators in `nav-config.tsx`).

## Changes

### `kapwa-client/src/pages/CoordinatorDashboardPage.tsx`

1. **Remove two non-coordinator stat cards** — "Served Today" and "Pending Cases" — from both the loaded and offline-fallback stats arrays. Keep **My Referrals** and **Messages** (both coordinator responsibilities).
2. **Adjust the stats grid** — change `lg:grid-cols-4` to `lg:grid-cols-2` so the two remaining cards fill the row on large screens.
3. **Remove the Quick Case Search card** — case lookup by ID is not a coordinator responsibility.
4. **Delete dead state and handler** — `searchId`, `searchResult`, `searchError`, `searching`, and `handleSearch`.
5. **Trim imports** — remove `TrendingUp`, `Clock`, `ArrowRight`, `Search`, `Loader2`, and already-unused `ClipboardList` from the lucide-react import; remove the `Input` component import.

## Explicitly NOT changing

- Header buttons: **View Referrals**, **Access Cards**, **New Referral** (kept)
- **QuickScanCard** (access-card verification — core coordinator tool; existing tests depend on it)
- **Today's Tracker Entries** table with per-row **View** buttons and **View Full Tracker** (kept per user decision)
- i18n keys — `dashboard.servedToday`, `dashboard.quickCaseSearch`, `dashboard.enterCaseId`, `dashboard.caseNotFound`, `dashboard.viewDetails`, etc. are also referenced by `CoordinatorWidgets.tsx` and other pages; keys stay to avoid breakage
- `CoordinatorDashboardPage.test.tsx` — existing tests only exercise the QuickScanCard, which is untouched

## Verification

- Run `CoordinatorDashboardPage.test.tsx` via the kapwa-client test runner — must stay green
- Run typecheck/lint for kapwa-client