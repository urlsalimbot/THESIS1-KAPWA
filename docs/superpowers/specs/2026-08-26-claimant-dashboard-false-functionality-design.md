# Remove False-Functionality Elements from Claimant Dashboard — Design

**Date:** 2026-08-26
**Status:** Approved by user (2026-08-26, scope: claimant dashboard only)
**Scope:** `kapwa-client/src/pages/ClaimantDashboardPage.tsx` + its test. No shared-component changes.

## Problem

The claimant dashboard shows interactive elements that convey functionality the claimant cannot perform:

1. **Two "Add first record" buttons from `EmptyState variant="no-data"`** (Service History card at `ClaimantDashboardPage.tsx:154`, Consent Management card at `:182`). The shared `EmptyState` renders a button that hard-navigates to `/intake` (`EmptyState.tsx:50-56`) — a route restricted to `admin`/`social_worker`. A claimant clicking it is bounced. (The same root cause affects other roles' pages, but per the approved scope those are out of bounds here.)
2. **The "Manage Consent" button** (`ClaimantDashboardPage.tsx:178`) has **no `onClick` at all** — a dead button. Claimants have no consent-management surface (`ConsentManager` exists only on the admin/social-worker `BeneficiaryViewPage`).

## Changes

### `kapwa-client/src/pages/ClaimantDashboardPage.tsx`

1. **Service History empty state** (lines 152-155): replace `<EmptyState variant="no-data" />` with a plain informational block — no button. Reuse the existing i18n key `claims.noServices` ("No services recorded yet."), already used by `ClaimantAccessCardPage`.
2. **Consent Management empty state** (lines 180-183): replace `<EmptyState variant="no-data" />` with the same plain pattern, reusing `dashboard.noConsentRecords` ("No consent records found", already used by `AuditorPage`).
3. **Remove the "Manage Consent" button** (line 178) from the Consent Management card header; keep the heading.
4. Remove the now-unused `EmptyState` import.

### `kapwa-client/src/pages/ClaimantDashboardPage.test.tsx`

Add two regression tests (mock returns empty services + consents, as the existing `beforeEach` does):
- The dashboard renders **no** "Add first record" button (`queryByRole('button', { name: 'Add first record' })` is null).
- The dashboard renders **no** "Manage Consent" button.

## Explicitly NOT changing

- The shared `EmptyState` component (used by 13 other pages — out of approved scope).
- Any other page's empty state.
- i18n keys (both replacement strings reuse existing keys; fil parity untouched).

## Verification

- `npm run test:run -- src/pages/ClaimantDashboardPage.test.tsx` — new + existing tests pass.
- Full `npm run test:run` + `npm run typecheck` (from `kapwa-client/`) stay green.