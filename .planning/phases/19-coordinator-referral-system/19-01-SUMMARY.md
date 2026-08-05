---
phase: 19-coordinator-referral-system
plan: 01
subsystem: coordinator
tags: [referrals, coordinator, mswdo, queue]
requires:
  - phase: 18-kilos-case-management-alignment
    provides: CaseStatus enum used when an accepted referral creates a case
  - phase: 14-api-client-swr
    provides: typed api client + SWR query keys for referral endpoints
provides:
  - Referral lifecycle (pending → accepted/declined) with decline reason
  - Coordinator referral create/list (any barangay resident, not only beneficiaries)
  - MSWDO review queue with accept-into-intake and decline flows
  - Coordinator referral stats (counts, pending-count)
affects: [20-coordinator-access-card-management, final audit]
tech-stack:
  added: []
  patterns:
    - NestJS feature module: entity → service → controller → module → app.module registration
    - zod validation in dto/, enforced via ZodPipe
    - system-page visual patterns: Dialog, Card, Badge, Skeleton, Toast for coordinator UI
key-files:
  created:
    - kapwa-server/src/referrals/referral.entity.ts (status: pending/accepted/declined)
    - kapwa-server/src/referrals/referrals.controller.ts (POST/, GET/, GET mine, GET counts, GET pending-count, GET :id, PATCH :id/accept, PATCH :id/decline)
    - kapwa-server/src/referrals/referrals.service.ts
    - kapwa-server/src/referrals/referrals.module.ts
    - kapwa-client/src/pages/CoordinatorReferralFormPage.tsx
    - kapwa-client/src/pages/CoordinatorReferralListPage.tsx
    - kapwa-client/src/pages/ReferralReviewPage.tsx
    - kapwa-client/src/pages/ReferralsPage.tsx
key-decisions:
  - "Coordinator may refer any barangay resident — referral stores full resident snapshot (name, gender, dob, address, phone, reason) so acceptance can seed intake without the resident being a beneficiary first"
  - "Acceptance triggers intake creation + case creation (reusing the updated CaseStatus enum from Phase 18)"
  - "Decline is reason-required so the coordinator always sees why"
  - "Coordinator views only their own referrals via GET /referrals/mine; MSWDO sees the full queue"
requirements-completed: [COORD-01, COORD-02, COORD-03]
duration: 3d
completed: 2026-07-25
status: complete
---

# Phase 19: Barangay Coordinator Module — Referral System — Summary

**Built the end-to-end referral flow: coordinator refers any barangay resident → MSWDO accepts (into intake) or declines with a reason → coordinator tracks status on their dashboard**

## Performance

- **Duration:** ~3 days (2026-07-23 → 2026-07-25)
- **Key commits:** `0ede25b` (baranggay coordinators panel + IRF/AccessCard overhaul + CSR hooks), `46901d7` (CoordinatorReferralFormPage system-page patterns), `ab451c8` (CoordinatorReferralListPage patterns), `7331f79` (ReferralReviewPage patterns), `fd7c3d4` (ReferralsPage Task 4)

## Accomplishments

- **Backend module** `kapwa-server/src/referrals/`: referral entity with full resident snapshot, 7 endpoints covering create, MSWDO queue, coordinator-scoped list, stats, and accept/decline transitions
- **Coordinator UI**: `CoordinatorReferralFormPage` (create referral for any resident) and `CoordinatorReferralListPage` (own referrals + status)
- **MSWDO UI**: `ReferralReviewPage` (accept → seeds intake/case; decline with required reason) and `ReferralsPage` (full queue)
- **Dashboard integration**: coordinator referral stats via `GET /referrals/counts` and `GET /referrals/pending-count`
- Visual consistency applied across all 4 pages (Dialog, Card, Badge, Skeleton, Toast patterns)

## Decisions Made

- Referral carries a complete resident snapshot so acceptance does not require a pre-existing beneficiary record
- Accept transition reuses the Phase 18 `CaseStatus` enum when creating the case
- Coordinator sees only `mine`; MSWDO/Worker sees the entire queue

## Deviations from Plan

- Initial plan called for a standalone enhancement spec (`4483611`); UI polish (Dialog/Card/Badge/Skeleton/Toast) was folded directly into the 4 page commits rather than a separate plan pass
- `ReferralsPage` (MSWDO view) shipped as the last piece (Task 4) after the coordinator pages

## Known Stubs

- Accept → intake seeding is implemented but end-to-end acceptance into a fully-populated case record is exercised in the demo flow; deep assertion coverage deferred to the final audit phase

## Self-Check: PASSED

- [x] `referrals` backend module exists (entity/controller/service/module)
- [x] All 8 endpoints present on the controller
- [x] 4 coordinator/referral client pages exist
- [x] Status values pending/accepted/declined on the entity
- [x] Coordinator stats endpoints wired to dashboard

---
*Phase: 19-coordinator-referral-system*
*Completed: 2026-07-25*
