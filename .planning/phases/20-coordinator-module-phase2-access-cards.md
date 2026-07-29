# Phase 20: Barangay Coordinator Module — Phase 2 (Access Card Management)

**Goal:** Coordinator can assign, verify, and log activities on access cards for barangay beneficiaries.

**Depends on:** Phase 19 (Referral System — same coordinator workspace)

---

## Task 1: Backend — Permission Updates

**File:** `kapwa-server/src/access-cards/access-cards.controller.ts`

- Add `'coordinator'` to `@Roles()` on:
  - `POST assign/:beneficiaryId`
  - `GET beneficiary/:id/card/summary`
  - `GET beneficiary/:id/card`
  - `POST log`
  - `GET :cardCode`
  - `GET` (list)

## Task 2: Backend — Migration + Entity Updates

**Files:** migration file, `access-card-service.entity.ts`

- Add `loggedBy` column (FK→users, nullable)
- Add `sourceBarangay` column (text, nullable)
- These let us track which coordinator logged which activity, and from which barangay

## Task 3: Backend — Barangay-Scoped Beneficiary Lookup

**File:** `kapwa-server/src/access-cards/access-cards.service.ts` or `beneficiaries.controller.ts`

- When coordinator searches beneficiaries for card assignment, filter by barangay
- Coordinator's `assignedBarangay` vs the beneficiary's address barangay

## Task 4: Frontend — Coordinator Access Cards Page

**Files:** `kapwa-client/src/pages/CoordinatorAccessCardsPage.tsx`

- Tab: **Verify** — text input for card code → shows beneficiary info + service history + "Log Activity" button
- Tab: **Assign** — search beneficiary (scoped to barangay) → show details → "Assign Card" button
- Tab: **History** — paginated table of all services logged by this coordinator

## Task 5: Frontend — Log Activity Form

**File:** Shared component or inline on CoordinatorAccessCardsPage

- Fields: service type (community_service|seminar|distribution|other), remarks, date
- Pre-filled with card code, logged_by from current user

## Task 6: Client Router Update

**File:** `kapwa-client/src/routes.tsx`

- Add route for `/coordinator/access-cards`
