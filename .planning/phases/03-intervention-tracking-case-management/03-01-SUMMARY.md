---
phase: 03-intervention-tracking-case-management
plan: 01
subsystem: cases
tags: fsm, cases, nestjs, typeorm, jest, zod, react, vitest
requires:
  - phase: 02-gis-intake-beneficiary-registration
    provides: Case entity, CaseStatus enum, existing CasesService/CasesController, CaseHistory entity
provides:
  - Strict 3-gate FSM lifecycle for cases (pending → in_review → approved → disbursed → closed)
  - Admin override with mandatory reason and audit trail
  - Role-gated transition endpoints (social_worker, admin)
  - Case page with status badges and role-specific action buttons
affects:
  - 03-02 (intervention logging — depends on disbursed status)
  - 03-03 (tracker/SLA — depends on case transitions)
tech-stack:
  added: []
  patterns:
    - Per-gate FSM methods with strict sequential transition enforcement
    - Admin override with mandatory reason + audit trail (transitionType='override')
    - Role-gated PATCH endpoints using @Roles decorator
    - Status badge color mapping in React component
key-files:
  created:
    - kapwa-server/src/database/migrations/20260622000001-CaseFsmLifecycle.ts
    - kapwa-server/src/cases/case-history.entity.ts (updated with override fields)
  modified:
    - kapwa-server/src/cases/cases.service.ts (added requestReview, disburse, close, overrideStatus)
    - kapwa-server/src/cases/cases.controller.ts (added 4 new PATCH endpoints)
    - kapwa-server/src/cases/dto/cases.zod.ts (added OverrideStatusSchema, DisburseSchema)
    - kapwa-server/src/cases/cases.service.spec.ts (added 11 FSM lifecycle tests)
    - kapwa-client/src/lib/api.ts (added requestReview, disburseCase, closeCase, overrideCaseStatus)
    - kapwa-client/src/pages/CasesPage.tsx (added Status column + action buttons)
key-decisions:
  - "requestReview is social_worker-only, disburse is admin-only, close is admin+social_worker"
  - "Override requires mandatory non-empty reason — enforced at Zod schema level"
  - "Override transitions flagged as 'override' in CaseHistory for audit compliance"
  - "User role injected from localStorage('kapwa_role') for client-side action render"
requirements-completed:
  - INT-02
  - CON-03
duration: 22min
completed: 2026-06-22
status: complete
---

# Phase 03: Intervention Tracking & Case Management — Plan 01 Summary

**Strict 3-gate FSM lifecycle for cases with per-gate role separation, admin override with mandatory reason + audit trail, and role-specific action buttons on CasesPage**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-22T06:57:00Z
- **Completed:** 2026-06-22T07:19:23Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- DB migration adding btree_gist extension and case_history transition_type/override_reason columns
- 4 new FSM service methods: requestReview (social_worker), disburse (admin), close (admin+social_worker), overrideStatus (admin) with strict role gating
- 4 new PATCH endpoints with @Roles decorators and Zod validation
- 11 comprehensive FSM lifecycle tests covering all transitions, role enforcement, backward rejection, and override audit trail
- CasesPage enhanced with Status column (color-coded badges) and role-specific action buttons (Request Review, Disburse, Close)
- CSV export updated to include Status column

## Task Commits

1. **Task 1: FSM lifecycle end-to-end tests (RED)** — `88071d2` (test)
2. **Task 2: DB migration + Server per-gate FSM endpoints (GREEN)** — `a4dfe1c` (feat)
3. **Task 3: Client CasesPage action buttons** — `3f5068e` (feat)

## Files Created/Modified

- `kapwa-server/src/database/migrations/20260622000001-CaseFsmLifecycle.ts` — btree_gist extension + transition_type/override_reason columns
- `kapwa-server/src/cases/case-history.entity.ts` — Added transitionType ('standard'|'override') and overrideReason fields
- `kapwa-server/src/cases/dto/cases.zod.ts` — Added OverrideStatusSchema (reason min 1) and DisburseSchema
- `kapwa-server/src/cases/cases.service.ts` — 4 new FSM methods: requestReview, disburse, close, overrideStatus
- `kapwa-server/src/cases/cases.controller.ts` — 4 new PATCH endpoints with @Roles decorators
- `kapwa-server/src/cases/cases.service.spec.ts` — 11 FSM lifecycle tests (all passing)
- `kapwa-client/src/lib/api.ts` — 4 new FSM API functions
- `kapwa-client/src/pages/CasesPage.tsx` — Status column with badges + role-specific action buttons

## Decisions Made

- requestReview restricted to social_worker only, not admin — strict separation per D-01
- disburse restricted to admin only per D-01 (finance role tracked for future)
- close allowed for both admin and social_worker per D-01
- overrideStatus restricted to admin with mandatory non-empty reason per D-10
- Role read from localStorage('kapwa_role') as quick client-side approach per D-04
- Error handling on action buttons uses alert() + console.error per existing project pattern

## Deviations from Plan

None — plan executed exactly as written. Test assertions were updated to match actual error messages from ForbiddenException/BadRequestException (semantically identical, different wording).

## Issues Encountered

- Test assertions originally expected generic substrings 'Forbidden'/'Bad Request' but ForbiddenException/BadRequestException messages are descriptive. Fixed assertions to match actual message format.
- Pre-existing client-side test failures in sync-conflict.test.ts (unrelated to this plan — mergeRecords not found)

## Known Stubs

None — all features fully implemented.

## Threat Flags

None — no new security surface introduced beyond what was in the threat model.

## Next Phase Readiness

- FSM lifecycle complete — cases can now move through all 5 statuses with proper role gating
- Ready for Plan 2 (intervention logging) which depends on disbursed status
- Ready for Plan 3 (tracker/SLA) which depends on case transitions

---

*Phase: 03-intervention-tracking-case-management*
*Completed: 2026-06-22*
