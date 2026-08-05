---
phase: 18-kilos-case-management-alignment
plan: 01
subsystem: case-management
tags: [kilos-unlad, dswd, case-status, lifecycle, stepper]
requires:
  - phase: 16-ui-polish-errorboundary-a11y-core-ui-tests
    provides: core UI test infrastructure (vitest, axe matchers)
provides:
  - 6-state DSWD KILOS UNLAD CaseStatus enum (enrolled/assessed/in_review/active/transitioning/closed)
  - KILOS assessment fields on Case entity (FRVA, SWDI, family dialogue, sustainability, closure)
  - 5-stage CaseViewPage stepper lifecycle matching the official 6-step framework
affects: [19-coordinator-referral-system, final audit]
tech-stack:
  added: []
  patterns:
    - stepper lifecycle: CaseStepper drives stage-gated CaseViewPage, each stage is an isolated Step* component
    - enum as single source of truth: CaseStatus values power both backend transitions and client stepper stages
key-files:
  created:
    - kapwa-server/src/cases/case.entity.ts (CaseStatus enum + KILOS fields)
    - kapwa-client/src/components/cases/CaseStepper.tsx
    - kapwa-client/src/components/cases/StepEnrollment.tsx
    - kapwa-client/src/components/cases/StepAssessment.tsx
    - kapwa-client/src/components/cases/StepImplementHIP.tsx
    - kapwa-client/src/components/cases/StepIntegratedDelivery.tsx
    - kapwa-client/src/components/cases/StepTransition.tsx
    - kapwa-client/src/components/cases/StepClosure.tsx
  modified:
    - kapwa-client/src/pages/CaseViewPage.tsx (5-stage stepper rewrite)
    - kapwa-server/src/cases/cases.controller.ts, cases.service.ts (KILOS transition endpoints)
key-decisions:
  - "Map the official DSWD KILOS UNLAD 3-phase / 6-step framework to a 5-stage client stepper (Enrollment → Assessment → Implement HIP → Integrated Delivery → Transition → Closure shown as 5 UI stages)"
  - "Add KILOS-specific scoring/notes fields (frva_score, swdi_score, family_dialogue_notes, self_reliance_level, sustainability_plan, transition_date, closure_outcome, closure_date, follow_up_visits) to Case entity so field data captures the framework's CM forms"
  - "Keep CaseStatus enum as the shared contract between backend transition guards and client stepper rendering"
requirements-completed: [KILOS-01, KILOS-02, KILOS-03, KILOS-04, KILOS-05, KILOS-06, KILOS-07, KILOS-08]
duration: 2d
completed: 2026-07-23
status: complete
---

# Phase 18: DSWD KILOS UNLAD Case Management Alignment — Summary

**Aligned Kapwa's case workflow with the official DSWD KILOS UNLAD framework — 6-state lifecycle, KILOS assessment fields, and a 5-stage CaseViewPage stepper**

## Performance

- **Duration:** ~2 days (planned 2026-07-22, completed 2026-07-23)
- **Key commits:** `43b05df` (CaseViewPage 5-stage stepper rewrite), `bb426e8` (CaseStepper component), `bd5b40e` (stepper + API endpoints), `61c664b`

## Accomplishments

- Replaced the previous 4-step stepper with a 5-stage KILOS lifecycle stepper on `CaseViewPage`
- Added the 6-state `CaseStatus` enum (`enrolled`, `assessed`, `in_review`, `active`, `transitioning`, `closed`) in `case.entity.ts`
- Added KILOS field coverage on the `Case` entity: FRVA/SWDI scores, family dialogue notes, self-reliance level, sustainability plan, transition date, closure outcome/date, follow-up visits
- Built per-stage client components (`StepEnrollment`, `StepAssessment`, `StepImplementHIP`, `StepIntegratedDelivery`, `StepTransition`, `StepClosure`) with shared `CaseStepper` navigation
- Wired KILOS transition endpoints on the backend so stage changes are guarded by the new enum

## Decisions Made

- The client shows **5 UI stages** for the 6-step DSWD framework (Integrated Delivery absorbs the referral step), keeping the stepper readable while covering all CM forms
- Backend transitions use the `CaseStatus` enum as the single source of truth so the client stepper and API stay in sync

## Deviations from Plan

- KILOS step 4 (Integrated Delivery) is represented inside the stepper rather than as a standalone step — visual density tradeoff, all data points still captured
- Follow-up visit tracking added as `follow_up_visits` on the entity to satisfy the framework's progress-monitoring requirement

## Known Stubs

- CaseViewPage stepper relies on a small number of mock/sample transitions during demo; full production data seeding for every stage remains for the final audit phase

## Self-Check: PASSED

- [x] `CaseStatus` enum present with all 6 states in `case.entity.ts`
- [x] KILOS fields present on `Case` entity
- [x] `CaseStepper` + Step* components exist under `kapwa-client/src/components/cases/`
- [x] `CaseViewPage` uses the stepper lifecycle

---
*Phase: 18-kilos-case-management-alignment*
*Completed: 2026-07-23*
