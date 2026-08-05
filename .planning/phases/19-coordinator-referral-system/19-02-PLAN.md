# Phase 19: Barangay Coordinator Module — Phase 1 (Referral System)

**Goal:** Build the referral flow — barangay coordinator refers any resident to MSWDO, MSWDO accepts/declines, status visible to coordinator.

**Depends on:** Phase 18 (DSWD KILOS UNLAD) — uses updated CaseStatus enum

---

## Task 1: Backend — Referral Entity + Migration

**Files:** `kapwa-server/src/referrals/referral.entity.ts`, migration

- Create `referral.entity.ts` with columns: id, coordinator_id, barangay, surname, first_name, middle_name, extension, gender, dob, address (JSONB), phone, reason, status (pending/accepted/declined), decline_reason, case_id (nullable FK→cases), created_at, updated_at
- Create migration to add `referrals` table
- Add `ReferralsModule` to `app.module.ts`

## Task 2: Backend — Referral Controller + Service

**Files:** `kapwa-server/src/referrals/referrals.controller.ts`, `referrals.service.ts`, `dto/`

- `POST /referrals` — coordinator creates referral (zod-validated)
- `GET /referrals` — admin/social_worker list (filtered by barangay, status)
- `GET /referrals/mine` — coordinator lists own referrals
- `GET /referrals/:id` — detail view
- `PATCH /referrals/:id/accept` — admin/social_worker accepts → copies data, calls intake flow, creates case, updates status
- `PATCH /referrals/:id/decline` — admin/social_worker declines with reason
- Barangay scoping via ABAC + manual filter
- Inject `CasesService` for `generateControlNo()` and `IntakeService` for the accept flow

## Task 3: Frontend — Coordinator Referral Pages

**Files:** `kapwa-client/src/pages/CoordinatorReferralFormPage.tsx`, `CoordinatorReferralListPage.tsx`

- Form page: fields matching referral schema (surname, first_name, middle_name, extension, gender, dob, address, phone, reason)
- List page: table with status badges (pending → yellow, accepted → green, declined → red), click for detail
- Wire into router at `/coordinator/referrals` and `/coordinator/referrals/new`

## Task 4: Frontend — MSWDO Referral Review Page

**File:** `kapwa-client/src/pages/ReferralReviewPage.tsx`

- Table of pending referrals: name, barangay, coordinator, reason, date
- Accept button → confirmation → calls accept endpoint → removes from queue
- Decline button → modal with reason input → calls decline endpoint
- Route: `/intake/referrals`

## Task 5: Frontend — Dashboard Updates

**Files:** `kapwa-client/src/pages/CoordinatorDashboardPage.tsx`, `DashboardPage.tsx`

- Coordinator dashboard: add "My Referrals" stat card (total + pending count), add recent referrals table
- MSWDO dashboard: add "Pending Referrals" count

## Task 6: Client Router Update

**File:** `kapwa-client/src/routes.tsx`

- Add routes for `/coordinator/dashboard`, `/coordinator/referrals`, `/coordinator/referrals/new`, `/intake/referrals`
- Update `/coordinator` → redirect to `/coordinator/dashboard`
