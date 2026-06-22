---
phase: 03-intervention-tracking-case-management
plan: 03
subsystem: cases, sync, sla
tags: tracker, offline, fsm, cron, sla, sync, interventions

requires:
  - phase: 02-crud
    provides: cases, beneficiaries, interventions CRUD
provides:
  - Case Tracker Log with NORZ-TRACK daily sequence format
  - Auto-creation of tracker entries on intervention logging
  - 30-minute SLA escalation cron with overdue badges
  - Offline FSM transition queuing (pending→in_review)
  - FSM transition validation on sync with conflict messages
  - Fund Source column in interventions table
affects:
  - 04-reports
  - 05-dashboard

tech-stack:
  added: ['@nestjs/schedule']
  patterns:
    - Cron-based SLA escalation with working-days calculation
    - FSM state validation in sync conflict resolution
    - Offline-first queued state transitions

key-files:
  created:
    - kapwa-server/src/tracker/tracker.entity.ts
    - kapwa-server/src/tracker/tracker.service.ts
    - kapwa-server/src/tracker/tracker.controller.ts
    - kapwa-server/src/sla/constants.ts
    - kapwa-server/src/sla/sla.module.ts
    - kapwa-server/src/sla/sla.service.ts
  modified:
    - kapwa-server/src/cases/cases.service.ts
    - kapwa-server/src/cases/cases.controller.ts
    - kapwa-server/src/interventions/interventions.service.ts
    - kapwa-server/src/interventions/interventions.module.ts
    - kapwa-server/src/sync/sync.service.ts
    - kapwa-client/src/lib/api.ts
    - kapwa-client/src/lib/offline-queue.ts
    - kapwa-client/src/lib/sync.ts
    - kapwa-client/src/pages/CasesPage.tsx
    - kapwa-client/src/pages/InterventionsPage.tsx
    - kapwa-client/src/pages/BeneficiaryViewPage.tsx
    - kapwa-server/package.json
    - kapwa-server/package-lock.json

key-decisions:
  - "NORZ-TRACK format for daily sequence numbering (YYYY-MM/DD/SEQ)"
  - "Uniform 3-day SLA thresholds per D-05 (pending, review, approved all 3 days)"
  - "Used CronExpression.EVERY_30_MINUTES for SLA escalation cron"
  - "Only pending→in_review FSM transition allowed offline per D-04; other transitions require online"
  - "FSM control fields (_fsmTransition, _clientUpdatedAt) stripped from sync payloads before DB write"
  - "ConflictResolver used for standard collisions; FSM transitions pre-validated against current case status"

patterns-established:
  - "SLA cron pattern: @Cron decorator + computeWorkingDaysElapsed utility"
  - "Offline FSM: queueFsmTransition → server validates via handleFsmTransition → reject with currentState/requestedState on failure"
  - "Fund source stored at intervention level, displayed via blue badge in UI"

requirements-completed: []

duration: 65min
completed: 2026-06-22
status: complete
---

# Phase 3 Plan 3: Intervention Tracker + SLA + Offline FSM + Fund Source

**Case tracker auto-logging with NORZ-TRACK sequence, 30-minute SLA escalation cron, offline-capable FSM transitions with sync conflict handling, and fund source display in interventions**

## Performance

- **Duration:** 65 min
- **Started:** 2026-06-22T* (continued from wave, 3 commits)
- **Completed:** 2026-06-22
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Case Tracker Log with NORZ-TRACK format (YYYY-MM/DD/SEQ) auto-creates daily entries when interventions are logged and serves via GET endpoint
- SLA escalation cron runs every 30 minutes via @nestjs/schedule, marking cases overdue if they exceed their threshold (uniform 3 days per D-05)
- SLA overdue badge displayed on CasesPage with red AlertTriangle styling
- Offline pending→in_review FSM transition queued via queueFsmTransition() when offline; server validates transition validity on sync
- FSM conflict handling on both client (sync.ts) and server (sync.service.ts) with rich error messages (currentState, requestedState)
- Fund Source column added to InterventionsPage table between Amount and Agency columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Case Tracker Log with NORZ-TRACK format + auto-creation** - `3be3887` (feat)
2. **Task 2: SLA cron with @nestjs/schedule + overdue badge** - `2f8f05d` (feat)
3. **Task 3: Offline FSM transitions + sync conflict resolution + fund source display** - `549c211` (feat)

## Files Created/Modified
- `kapwa-server/src/tracker/tracker.entity.ts` - Tracker entity with dailySeqNum, trackerId
- `kapwa-server/src/tracker/tracker.service.ts` - Next sequence, auto-create on intervention log
- `kapwa-server/src/tracker/tracker.controller.ts` - GET /tracker endpoint
- `kapwa-server/src/sla/constants.ts` - Uniform 3-day escalation thresholds
- `kapwa-server/src/sla/sla.module.ts` - Module importing ScheduleModule.forRoot()
- `kapwa-server/src/sla/sla.service.ts` - 30-min cron, computeWorkingDaysElapsed
- `kapwa-server/src/cases/cases.service.ts` - computeSlaOverdue, tracker log on status change
- `kapwa-server/src/cases/cases.controller.ts` - slaOverdue in response
- `kapwa-server/src/interventions/interventions.service.ts` - Create tracker entry on intervention
- `kapwa-server/src/interventions/interventions.module.ts` - Import TrackerModule
- `kapwa-server/src/sync/sync.service.ts` - FSM validation, handleFsmTransition, VALID_FSM_TRANSITIONS map
- `kapwa-client/src/lib/api.ts` - getCaseTrackerLog API function
- `kapwa-client/src/lib/offline-queue.ts` - queueFsmTransition export
- `kapwa-client/src/lib/sync.ts` - FSM conflict handling, isFsmTransition helper
- `kapwa-client/src/pages/CasesPage.tsx` - SLA overdue badge, offline/online action routing
- `kapwa-client/src/pages/InterventionsPage.tsx` - Fund Source column
- `kapwa-client/src/pages/BeneficiaryViewPage.tsx` - Fund source display on interventions
- `kapwa-server/package.json`, `kapwa-server/package-lock.json` - @nestjs/schedule dependency

## Decisions Made
- Uniform 3-day SLA thresholds per D-05 (was 3/5/7, now all 3 days)
- NORZ-TRACK format for daily sequence numbering aligns with MSWDO-NORZ case numbering convention
- Only pending→in_review FSM transition is offline-capable per D-04 design constraint
- FSM control fields stripped from sync payloads before DB write to prevent column rejection
- @nestjs/schedule CronExpression.EVERY_30_MINUTES chosen for SLA cron frequency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TS error in kapwa-client/src/lib/secure-storage.ts (unrelated to this plan)
- Two TS errors in sync.service.ts after initial write: fsmResult null-safety and 'rejected' status not in union type — fixed via null-conditional operator and 'conflict' status alignment

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Case transitions tracked with NORZ-TRACK sequence ready for Phase 4 (reports)
- SLA data available for dashboard widgets in Phase 5
- Offline queue infrastructure ready for more offline-capable transitions

---

*Phase: 03-intervention-tracking-case-management*
*Completed: 2026-06-22*
