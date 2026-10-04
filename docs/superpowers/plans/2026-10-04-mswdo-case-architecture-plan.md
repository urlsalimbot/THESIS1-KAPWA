# Implementation Plan — MSWDO Case Architecture Rework

> **STATUS: EXECUTED** (2026-10-04). Phases A–E complete; server 112 suites / 1293
> tests, client 152 files / 1286 tests; migrations 77–80 + fresh-boot bootstrap
> validated live on disposable Postgres 18; commits `4719112`, `519cc6a`,
> `68ac07e`, `c19ba15`.

**Spec:** `docs/superpowers/specs/2026-10-04-mswdo-case-architecture-design.md` (approved; catalogs
research-verified 2026-10-04, commit `c3bca83`)
**Branch:** `main`. Conventional commits; each phase ends in a verifiable state (`npx jest --silent`
or focused specs + `npm run typecheck` in both apps).

Every DB migration ships **both** files: `src/database/migrations/*.ts` (key ≥ `…0000000000077`,
check for ties) **and** idempotent statements in `src/database/migrate.ts`.

---

## A. Server data layer (schema)

- **A1 — Migration `…0077`: `program_enrollments`**
  - `program-enrollment.entity.ts`: `id uuid_pk`, `case_id → cases(id)` NOT NULL,
    `program_id → programs(id)` NOT NULL, `enrolled_at date NOT NULL`,
    `status text NOT NULL DEFAULT 'active'` (`active|completed|withdrawn`),
    `created_by uuid NULL`, `created_at`/`updated_at`, **UNIQUE `(case_id, program_id)`**,
    index on `case_id`.
  - `migrate.ts`: idempotent `CREATE TABLE IF NOT EXISTS` + unique index.
  - Spec §4.2. Verify: migration runs on disposable Postgres; fresh boot builds the table.
- **A2 — Migration `…0078`: `cases` columns + `aftercare` enum**
  - Columns (spec §4.1): `court_docket_number`, `discernment_assessed_at`, `discernment_result`,
    `discernment_notes`, `protection_order_type`, `protection_order_issued_at`,
    `protection_order_issued_by`, `protection_order_notes`, `enrollments_not_needed bool
    NOT NULL DEFAULT false`, `solo_parent_id_issued_date`, `solo_parent_id_number`,
    `solo_parent_notes`, `adoption_dvc_date`, `adoption_case_study_date`,
    `adoption_cdclaa_received`, `adoption_notes`; status enum gains `aftercare`.
  - `case.entity.ts` mirrors every column. `migrate.ts` idempotent `ADD COLUMN IF NOT EXISTS`.
- **A3 — Migration `…0079`: `case_step_locks` step_index → step_key**
  - `case-step-lock.entity.ts`: `step_key TEXT NOT NULL`, UNIQUE `(case_id, step_key)`;
    backfill `0→assessment, 1→interventions, 2→referrals, 3→evaluate, 4→closure`;
    drop unique `(case_id, step_index)` + column.
  - `sync.service.ts` column manifests for `case_step_locks` updated (spec §13 risk).
- **A4 — Migration `…0080`: program_type, program_services, intervention typing**
  - `programs.program_type TEXT NULL`; **`program_services`** table
    (`id`, `program_id → programs(id)`, `intervention_type TEXT`, UNIQUE `(program_id, intervention_type)`)
    + entity; `case_interventions.intervention_type TEXT NULL`, `program_enrollment_id uuid NULL
    → program_enrollments(id)` + entity columns.
  - `migrate.ts` for both new/changed tables.
- **A5 — Entities, typecheck + jest** after each migration (`npm run typecheck`, focused specs).

## B. Server logic (keys, FSM, endpoints)

- **B1 — Step templates & floors** — `case-step-labels.ts` → `CASE_STEP_TEMPLATES` keyed by
  category value + `COMMON_STEPS` (spec §3.1); `stepsDueAt` floors (spec §3.2); delete
  `CASE_STEP_MIN_STATUS`/`CASE_STATUS_INDEX` consumers.
- **B2 — Lock service keys** — `case-step-locks.service.ts` `lock/unlock/assertUnsealed/isSealed`
  on `step_key`; done-predicates per §3.3 (enrollments: ≥1 row **or** `enrollments_not_needed`).
- **B3 — `cases.service.ts`** — `generateControlNo` → `MSWD-<year>-<seq>` (spec §8);
  `aftercare` FSM edge `closed → aftercare` (admin, social_worker); `caseCategory` immutable
  once case leaves `enrolled` (spec §9); `updateAssessmentV2` field list += new columns.
- **B4 — Enrollments endpoints** — `GET/POST/DELETE /cases/:id/enrollments`,
  `PATCH /cases/:id/enrollments-decision { notNeeded }` (spec §6.1, §10).
- **B5 — Category-step endpoints** — `PATCH /cases/:id/{discernment,protection-order,solo-parent,adoption}`
  + `PATCH /cases/:id/meta { courtDocketNumber }` (spec §10); gates by category value.
- **B6 — Typed interventions** — `POST /cases/:id/interventions` accepts
  `interventionType` + `programEnrollmentId` (validate against the enrollment's program services
  when both present); enrollment status auto-complete on last service? (no — keep manual).
- **B7 — Shared catalogs** — server/client parity constants for step keys, `programType`,
  `interventionType` (22 codes, spec §4.4) + parity spec.

## C. Seeds

- **C1 — `seed-programs.ts`** — Appendix B matrix: program_type per program; `program_services`
  rows; AICS consolidation (drop merged assistance-type programs + duplicated Livelihood
  Assistance); new rows (VAWC Protection & Women's Welfare, Parent Effectiveness Service,
  Family Casework Service, Crisis Intervention & Psychosocial Support, Emergency Shelter
  Assistance, Juvenile Diversion & Intervention Program (CICL), enriched Aftercare Support).
- **C2 — `seed-demo.ts`** — intervention rows get `interventionType` (legacy mapping
  FA→financial_grant, C→crisis_counseling, CSR→scsr_generated, R→referral_pao, …) and
  program references reconciled to the surviving seed programs.
- **C3 — seed tests** — update pinned names/counts (spec §13 seed-program churn risk).

## D. Client UI

- **D1 — Shared constants** — `constants.ts`: step templates by category, program/intervention
  catalogs, aftercare status.
- **D2 — Stepper by template** — `CaseStepper.tsx` + `StepLockBar` render from
  `CASE_STEP_TEMPLATES[category]`; `StepImplementHIP` New Intervention dialog service select
  derives from chosen program's services (all services when none chosen); category gating on
  step-1 save (already shipped) restricts edits once assessed.
- **D3 — Category step UIs** — `StepDiscernment`, `StepProtectionOrder`, `StepSoloParent`,
  `StepAdoption` (+ court-docket meta in CaseViewPage header); hint texts from spec §5.
- **D4 — Enrollments step UI** — `StepEnrollments`: list/add/remove enrollments +
  "not needed" decision (mirrors referrals decision).
- **D5 — Typed quick log** — `BeneficiaryViewPage` "Log Intervention": program select +
  service derivation; `interventionType` in payload.
- **D6 — Aftercare** — action-bar "Move to Aftercare" when closed; banner + sealed template
  when aftercare; SLA alerts exclude aftercare.
- **D7 — Test migration** — index-pinning specs → keys (`StepLocksAcrossSteps`,
  `CaseStepper.done`, lock-service specs, stepper template specs per category); new UIs tested.

## E. Verification gate

- Server `npm run typecheck` + `npx jest --silent`; client `npm run typecheck` +
  `npm run test:run`; full CI green; single cohesive change set on `main`; run
  `migration:run` on the stack.

## Open items (tracked, out of scope)
Statutory alerts, SCSR/Certificate-of-Indigency doc generators, AICS budget — later phases.
`programs.approval_workflow` — kept (spec §4.4).