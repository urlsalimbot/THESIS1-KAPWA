# Legacy Code / Deprecated Inventory

Three categories: **REMOVED** (cleanup done), **DROP MIGRATION** (new migration will remove from schema), **KEPT** (consumer exists, needs migration).

---

## Client Pages — Removed

| Page | Status | Reason |
|------|--------|--------|
| `InterventionsPage.tsx` | **REMOVED** | Called `GET /interventions` — no server controller exists. Superseded by CaseViewPage stepper's StepInterventions. |
| `CreateInterventionPage.tsx` | **REMOVED** | Called `POST /interventions` — no server controller exists. Superseded by `POST /cases/:caseId/interventions`. |

## Client Routes — Removed

| Route | Status | Reason |
|-------|--------|--------|
| `/interventions` | **REMOVED** | Referenced InterventionsPage (removed) |
| `/interventions/new` | **REMOVED** | Referenced CreateInterventionPage (removed) |

## Client Hooks — Kept (still used)

| Hook | Status | Issue |
|------|--------|-------|
| `useCaseActions.ts` | **KEPT** | Used by `CasesPage.tsx`. Still references old statuses (`'disbursed'`, `'approved'`) in endpoint calls. Blocked on client-side status migration. |

## Client Utilities — Broken but Shared

| Function | File | Status | Notes |
|----------|------|--------|-------|
| `uploadSignature` | `lib/api.ts:219` | **BROKEN** | Calls `/interventions/upload-signature` which has no server handler. Also used by `BeneficiaryViewPage.tsx`. |
| `uploadReceipt` | `lib/api.ts:221` | **BROKEN** | Calls `/interventions/upload-receipt` which has no server handler. Also used by `BeneficiaryViewPage.tsx`. |

## Client BeneficiaryViewPage — Broken Intervention Sub-Form

| Location | Status | Notes |
|----------|--------|-------|
| `BeneficiaryViewPage.tsx:260` | **BROKEN** | Posts to `POST /interventions` which has no server handler. The in-page intervention form is non-functional. Must redirect to `POST /cases/:caseId/interventions`. |

---

## Server — Dead Tables (Drop Migration Created)

| Table | Migration | Status | Replacement |
|-------|-----------|--------|-------------|
| `interventions` | `20260727000001-DropInterventions` | **DROP MIGRATION** | `case_interventions` (via CaseInterventionsModule) |
| `family_members` | `20260727000002-DropFamilyMembers` | **DROP MIGRATION** | `household_memberships` + `persons` |
| `program_assignments` | `20260727000003-DropProgramAssignments` | **DROP MIGRATION** | No replacement — feature never shipped |
| `program_assignment_steps` | `20260727000003-DropProgramAssignments` | **DROP MIGRATION** | No replacement — feature never shipped |

All four drop migrations use `DROP TABLE IF EXISTS ... CASCADE` — safe on production (already exists) and fresh installs (no-op if absent).

### Impact on Earlier Migrations (fresh installs)

On a fresh install these tables are created and altered by earlier migrations, then dropped by the new drop migrations. This is safe but wasteful. A future cleanup could consolidate migrations to skip creation of dead tables.

| Earlier Migration | Table Referenced | Failure if Pre-Dropped |
|-------------------|-----------------|------------------------|
| `20260622000002-InterventionFields` | `interventions`, `case_tracker_log` | Would fail — but table exists when this runs (created by AaaInitialSchema), so it works |
| `20260712000001-CreateInterventionTypesTable` | `interventions` | Same — works because table exists at that point |
| `20260714000003-AddIntakeFields` | `family_members` | Same |
| `20260715000001-AddFamilyIncomeStatus` | `family_members` | Same |
| `20260717000004-AddFamilyMemberTimestamps` | `family_members` | Same |
| `20260622000006-ProgramAssignments` | `program_assignments` + steps | Creates the tables (not alter) — creates then later drops |

## Server — Status-Model Updates Applied

| File | What Changed | Old Value | New Value |
|------|-------------|-----------|-----------|
| `sync/sync.service.ts` | `VALID_FSM_TRANSITIONS` | `pending_assessment→approved→disbursed→closed` | `enrolled→assessed→in_review→active→transitioning→closed` |
| `sync/sync.service.ts` | Default status fallback | `pending_assessment` | `enrolled` |
| `sync/sync.service.ts` | `ALLOWED_COLUMNS` | Included `daily_seq_num`, `transaction_date`, `age_range`, `client_category`, `intervention_remarks` | Removed (columns on dead `case_tracker_log` table) |
| `sync/conflict-resolver.ts` | `FINANCIAL_TABLES` | `['interventions', 'disbursements', 'financial_assistance']` | `[]` (none of these tables exist or have app code) |
| `sla/sla.service.ts` | `statusLabel()` | `pending_assessment`/`approved`/`disbursed` | `enrolled`/`assessed`/`active`/`transitioning` |
| `intake/intake.service.ts:238` | SQL status filter | `c.status = 'approved'` | `c.status = 'active'` |
| `database/seed.ts` | Case seed statuses | `pending_assessment` → `enrolled`, `approved` → `active`, `disbursed` → `transitioning` | Updated |
| `database/seed-comprehensive.ts` | Case seed statuses | Same mapping | Updated |
| `database/seed-comprehensive.ts` | Family member seeding | `INSERT INTO family_members` (dead table) | `INSERT INTO persons` + `household_memberships` |

## Server — Clientside-Dependent (Cannot Remove)

| Method | File | Client Caller | Notes |
|--------|------|--------------|-------|
| `cases.service.ts approve()` | Line 305 | `ApprovalPipelinePage.tsx` calls `PUT /cases/:id/approve` | 90% duplicated with `updateStatus`. Merge when client migrates. |
| `cases.service.ts disburse()` | Line 383 | `CasesPage.tsx` via `useCaseActions` calls `PUT /cases/:id/disburse` | Legacy terminology — old status `disbursed` → now `transitioning` |
| `cases.service.ts updateAssessment()` (v1) | Line 444 | `CaseViewPage.tsx` calls `PATCH /cases/:id/assessment` | Superseded by `updateAssessmentV2`. Remove when client migrates. |

## Server — `database/migrate.ts` Legacy Bootstrap

| Item | Status | Notes |
|------|--------|-------|
| `family_members` table creation | **REMOVED** | Superseded by `household_memberships` + `persons` |
| `interventions` table creation | **REMOVED** | Dead table — no entity, service, or controller reads it |
| `case_tracker_log` table creation | **REMOVED** | Dropped by `DropCaseTrackerLog` migration |
| Related indexes and RLS policies | **REMOVED** | On removed tables |

## Server — Sync Service Legacy References

| Item | File | Status | Notes |
|------|------|--------|-------|
| `VALID_FSM_TRANSITIONS` | `sync.service.ts:51-57` | **UPDATED** | Now mirrors `CaseStatus` enum transitions |
| `ALLOWED_COLUMNS` dead entries | `sync.service.ts:13-37` | **UPDATED** | Removed `daily_seq_num`, `transaction_date`, `age_range`, `client_category`, `intervention_remarks` |
| `FINANCIAL_TABLES` | `conflict-resolver.ts:20` | **UPDATED** | Cleared — `interventions`/`disbursements`/`financial_assistance` tables don't exist |

## Migration History (immutable — cannot change, but awareness)

| Migration | Issue | Notes |
|-----------|-------|-------|
| `20260622000002-InterventionFields` | Modifies `interventions` (now dead) | Adds `signature_status` enum, exclusion constraint, `tracker_id` on `case_tracker_log`. Net effect zeroed by drop migration. |
| `20260714000003-AddIntakeFields` | Modifies `family_members` (now dead) | Adds/removes columns. Net effect zeroed by drop migration. |
| `20260715000001-AddFamilyIncomeStatus` | Modifies `family_members` (now dead) | Adds `income`, `status`. Net effect zeroed. |
| `20260717000004-AddFamilyMemberTimestamps` | Modifies `family_members` (now dead) | Adds `created_at`, `updated_at`. Net effect zeroed. |
| `20260712000001-CreateInterventionTypesTable` | Modifies `interventions` (now dead) | Drops constraint on dead table. Net effect zeroed. |
| `20260622000006-ProgramAssignments` | Creates orphaned tables | Tables created then later dropped. |

## Client-Side Legacy Status Values (Separate Workstream)

The client (`kapwa-client/src/`) still uses the old status model in several pages:

| Old Status | New Status | Files |
|-----------|-----------|-------|
| `pending_assessment` | `enrolled` | `CasesPage.tsx`, `DashboardPage.tsx`, `BeneficiaryViewPage.tsx` |
| `approved` | `active` | `CasesPage.tsx`, `ApprovalPipelinePage.tsx` |
| `disbursed` | `transitioning` | `CasesPage.tsx`, `useCaseActions.ts` |

The KilosUnladPhaseAlignment migration updated the server. The client must be updated to match.
This is tracked as a separate workstream.

## Summary

| Action | Count |
|--------|-------|
| **REMOVED** (client pages) | 2 pages, 2 routes |
| **DROP MIGRATION** (dead tables) | 4 tables across 3 migrations |
| **UPDATED** (server status model) | 8 files changed |
| **KEPT** (client dependency blocks) | `approve`, `disburse`, `updateAssessment` v1, `useCaseActions` |
| **BROKEN** (no server endpoint) | `uploadSignature`, `uploadReceipt`, BeneficiaryViewPage intervention form |
| **KEPT** (separate workstream) | Client-side status migration |

---

*Generated 2026-07-27. Update this file when legacy items are resolved.*
