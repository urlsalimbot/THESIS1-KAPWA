---
phase: 04-access-card-system
plan: 03
subsystem: api, sync
tags: soft-warning, override, dto, zod, access-card, sync, table-map
requires:
  - phase: 03-intervention-tracking-case-management
    provides: interventions.service.ts, sync.service.ts structure
provides:
  - Soft warning No Card guard with overrideNoCardCheck flag in interventions.service.ts
  - overrideNoCardCheck field in CreateInterventionSchema (optional boolean)
  - access_card_services table in sync service tableMap
  - service_rendered, cost, worker_name_sign, intervention_id in ALLOWED_COLUMNS
affects: 04-02 (print view — card services synced offline), 05-access-card-client
tech-stack:
  added: []
  patterns:
    - "Soft warning with explicit override flag — API returns warning instead of blocking"
    - "Return wrapping: { intervention, warning? } instead of bare entity"
    - "TDD RED → GREEN per task with atomic commits"
key-files:
  created: []
  modified:
    - kapwa-server/src/interventions/dto/interventions.zod.ts
    - kapwa-server/src/interventions/interventions.service.ts
    - kapwa-server/src/interventions/interventions.service.spec.ts
    - kapwa-server/src/sync/sync.service.ts
    - kapwa-server/src/sync/sync.service.spec.ts
key-decisions:
  - "D-03 implemented as soft warning: no card + no override → 400, no card + override → 200 + warning"
  - "Return type changed from Intervention to { intervention, warning? } — existing tests updated"
  - "Added ALLOWED_COLUMNS as near-duplicate from interventions table; threat accepted per T-04-08"
patterns-established:
  - "Soft warning pattern: check pre-condition, set warning variable, return wrapped result with conditional warning field"
  - "TDD per-task: test commit (RED) → feat commit (GREEN) per task boundary"
requirements-completed: [AC-04, AC-02]
duration: 12min
completed: 2026-06-22
status: complete
---

# Phase 04 Plan 03: No Card Soft Warning & Sync Summary

**Soft warning No Card guard with overrideNoCardCheck flag in intervention creation, plus access_card_services table mapping for offline sync**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-22T16:41:00Z
- **Completed:** 2026-06-22T16:53:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- No Card block changed from hard BadRequestException to soft warning with overrideNoCardCheck flag per D-03
- `overrideNoCardCheck: z.boolean().optional()` added to CreateInterventionSchema in interventions.zod.ts
- `create()` now accepts `Partial<Intervention> & { overrideNoCardCheck?: boolean }` and returns `{ intervention, warning? }`
- `access_card_services` mapping added to sync service tableMap (alphabetically first)
- `service_rendered`, `cost`, `worker_name_sign`, `intervention_id` added to ALLOWED_COLUMNS
- All 13 intervention tests pass (10 existing + 3 new)
- All 38 sync tests pass (5 test suites)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED — Failing tests for No Card guard** — `6a2e028` (test)
2. **Task 2: GREEN — Soft warning in service + DTO** — `4d9fa2f` (feat)
3. **Task 3: Sync tableMap + ALLOWED_COLUMNS** — `c994c30` (feat)

## Files Created/Modified

- `kapwa-server/src/interventions/dto/interventions.zod.ts` - Added `overrideNoCardCheck: z.boolean().optional()`
- `kapwa-server/src/interventions/interventions.service.ts` - Soft warning No Card guard per D-03; return type change
- `kapwa-server/src/interventions/interventions.service.spec.ts` - 3 new No Card guard tests; existing tests updated for new return shape
- `kapwa-server/src/sync/sync.service.ts` - Added `access_card_services` to tableMap; 4 new columns to ALLOWED_COLUMNS
- `kapwa-server/src/sync/sync.service.spec.ts` - Added Access Card sync test

## Decisions Made

- **D-03 implementation:** Soft warning with override flag — no card defaults to 400 error, explicit overrideNoCardCheck=true allows proceeding with warning returned in response
- **Return type wrapping:** Changed from bare `Intervention` to `{ intervention, warning? }` — keeps backward compatibility by wrapping rather than adding warning to entity
- **ALLOWED_COLUMNS:** Added `service_rendered`, `cost`, `worker_name_sign`, `intervention_id` — near-duplicates from interventions table columns, accepted per threat T-04-08 (non-sensitive service log data)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Pre-existing: trackerServiceMock lacks `createEntry` mock in spec** — The `trackerServiceMock` uses `generateTrackerId` instead of `createEntry`, causing non-blocking console.error on every create() call. This is a pre-existing issue from a prior phase (the mock was never updated after tracker service signature changed). Logged to deferred-items.md.

## TDD Gate Compliance

- RED gate: ✅ `test(04-03): add failing tests for No Card soft warning guard` — `6a2e028`
- GREEN gate: ✅ `feat(04-03): soft warning No Card guard with overrideNoCardCheck flag` — `4d9fa2f`
- REFACTOR gate: Skipped — no refactor needed

## Known Stubs

None — all code is functional and wired.

## Threat Flags

None — all changes are within the scope of the plan's threat model (T-04-07 mitigate with audit trail via warning field, T-04-08 accept, T-04-09 mitigate via ALLOWED_COLUMNS).

## Next Phase Readiness

- Intervention creation now supports No Card override for offline/missing-card scenarios
- Sync service is ready to sync access_card_services entries
- Next phases (04-01/02 card UI, print view) can consume the override pattern in client

---

*Phase: 04-access-card-system / Plan: 03*
*Completed: 2026-06-22*
