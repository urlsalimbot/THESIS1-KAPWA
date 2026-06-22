---
phase: 05-dynamic-programs-irf-module
plan: 05-02
subsystem: api, ui
tags: program-assignments, fsm, approval-workflow, typeorm, nestjs, postgres
requires:
  - phase: 05-dynamic-programs-irf-module-05-01
    provides: Program entity with approvalWorkflow JSONB column
provides:
  - Program assignment CRUD with FSM lifecycle
  - Step-level approval tracking (PENDING → IN_REVIEW → APPROVED/REJECTED)
  - Intervention materialization on full approval
  - Client-side assignment management UI with approve/reject/override actions
affects:
  - Next plan: Intervention tracking, SLA monitoring
tech-stack:
  added: []
  patterns:
    - FSM-based approval workflow with per-step roles and SLA timers
    - Step materialization from program config on assignment creation
    - Intervention creation on final step approval
key-files:
  created:
    - kapwa-server/src/database/migrations/20260622000006-ProgramAssignments.ts
  modified:
    - kapwa-server/src/programs/programs.module.ts
    - kapwa-client/src/lib/api.ts
    - kapwa-client/src/pages/ProgramsPage.tsx
    - kapwa-client/src/routes.tsx
key-decisions:
  - "D-03: Program assignment creates intervention record on full approval via InterventionsService.create()"
  - "D-04: Steps materialized from Program.approvalWorkflow JSONB as ProgramAssignmentStep records on creation"
  - "D-05: Rejection at any step sets assignment REJECTED; worker can resubmit via new assignment"
  - "D-06: SLA timers from program step config; pattern follows Phase 3 SLA approach"
  - "D-07: Fully approved assignments call InterventionsService.create() via cross-module import"
patterns-established: []
requirements-completed: []
duration: 25min
completed: 2026-06-24
status: complete
---

# Phase 5 Plan 05-02: Program Assignment & Approval Workflow FSM

**Program assignment FSM with step-level approval tracking, role-based authorization, intervention materialization on full approval, and client-side management UI**

## Performance

- **Duration:** 25min
- **Started:** 2026-06-24T10:00:00Z
- **Completed:** 2026-06-24T10:25:00Z
- **Tasks:** 3 (Tasks 2-4 GREEN; Task 1 RED pre-committed)
- **Files modified:** 5

## Accomplishments

- Migration file creating `program_assignments` and `program_assignment_steps` tables with proper FKs and indexes
- Module wiring — registered entities, controller, service; imported InterventionsModule and NotificationsModule
- Client API functions for assignment CRUD and step-level approve/reject/override
- Assignment management tab in ProgramsPage with status badges, step expansion, role-gated actions, and modals

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED - Test)** - pre-committed as `f6e06c5` (test)
2. **Task 2 (GREEN - Migration)** - `1391321` (feat)
3. **Task 3 (GREEN - Module)** - `aa42f11` (feat)
4. **Task 4 (GREEN - Client UI)** - `711518f` (feat)

**Plan metadata:** `d293f41` (docs: complete plan)

## Files Created/Modified

- `kapwa-server/src/database/migrations/20260622000006-ProgramAssignments.ts` — Migration creating program_assignments and program_assignment_steps tables
- `kapwa-server/src/programs/programs.module.ts` — Registered assignment entities, service, controller; imported InterventionsModule and NotificationsModule
- `kapwa-client/src/lib/api.ts` — Added program-assignment API functions (CRUD + step approve/reject/override)
- `kapwa-client/src/pages/ProgramsPage.tsx` — Added Assignments tab with status badges, step-level workflow actions, modals
- `kapwa-client/src/routes.tsx` — Added social_worker role to /programs route for assignment approvals

## Decisions Made

- **D-03:** Fully approved assignments call InterventionsService.create() to materialize intervention — error is caught and notification sent to worker instead of failing
- **D-04:** Steps are materialized from Program's approvalWorkflow JSONB array sorted by order field
- **D-05:** Single-step rejection cascades to full assignment REJECTED status
- **D-06:** SLA timing follows Phase 3 conventions (slaDays on each ApprovalStep)
- **D-07:** InterventionsModule is imported directly (not forwardRef) as there's no circular dependency

## Deviations from Plan

None — plan executed exactly as written. The entities, DTO, service, and controller were already scaffolded (from prior RED phase work), requiring only migration, module wiring, and client UI.

## Issues Encountered

None — all 7 tests passed, server and client compiled cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Program assignment FSM is complete with approve/reject/override flows
- Intervention materialization on final approval is wired
- Ready for next plan: SLA escalation monitoring, assignment dashboard, or program assignment reporting

---

*Phase: 05-dynamic-programs-irf-module*
*Completed: 2026-06-24*

## Self-Check: PASSED

- All 3 created files exist
- All 4 commits verified in git log
- All 7 tests pass
