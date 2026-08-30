# Wave 3 — PLAN: Fix Migration Chain (fresh-DB replay)

**Goal:** Fresh-DB `npm run migration:run` (TypeORM chain) replays all 50
migrations cleanly, in intended chronological order, ending in a schema
equivalent to the `migrate.ts` bootstrap. Currently the chain breaks at
`UnifiedPersonModel` (positions 6 vs 40 scramble) due to class-name
timestamp-suffix width inconsistency.

**Why rename (not surgical order fix):** TypeORM 0.4-alpha sorts migrations only
by `parseInt(className.substr(-13))`. There is no ordering override. Making the
*body* of every migration idempotent to arbitrary execution order is far riskier
than normalizing the sort keys. Renaming is thereby the correct, verified lever.

## Task A — Normalize migration ordering (rename, 50 files)

Rename each migration file `X-Name.ts` and its class `Name…<old-suffix>` to
`Name00000000000NN` (zero-padded 13-digit sequential key = intended order),
preserving the human name prefix:

| New key | Old name → New class name |
|---|---|
| 0000000000001 | `AaUuidV7Function0000000000001` (unchanged) |
| 0000000000002 | `AaaInitialSchema0000000000002` (unchanged) |
| 0000000000003 | `AccessCardCategory1740000000003` → `AccessCardCategory0000000000003` |
| 0000000000004 | `ZAddFormVersion1741000000000` → `ZAddFormVersion0000000000004` |
| 0000000000005 | `ZAddFormVersionHistory1742000000000` → `ZAddFormVersionHistory0000000000005` |
| 0000000000006 | `ZAddCaseHistory1743000000000` → `ZAddCaseHistory0000000000006` |
| 0000000000007 | `ZAddBeneficiaryCategory1783940457174` → `ZAddBeneficiaryCategory0000000000007` |
| 0000000000008 | `ZAddChatSenderName1783940641010` → `ZAddChatSenderName0000000000008` |
| 0000000000009 | `ZAddConsentRevokedReason20260718000001` → `ZAddConsentRevokedReason0000000000009` |
| 0000000000010 | `ZAuditHashChain20260619000001` → `ZAuditHashChain0000000000010` |
| 0000000000011 | `CaseFsmLifecycle20260622000001` → `CaseFsmLifecycle0000000000011` |
| 0000000000012 | `InterventionFields20260622000002` → `InterventionFields0000000000012` |
| 0000000000013 | `ProgramDataTypes20260622000004` → `ProgramDataTypes0000000000013` |
| 0000000000014 | `IrfDispositionEncryption20260622000005` → `IrfDispositionEncryption0000000000014` |
| 0000000000015 | `ProgramAssignments20260622000006` → `ProgramAssignments0000000000015` |
| 0000000000016 | `NotificationPreferences20260624000001` → `NotificationPreferences0000000000016` |
| 0000000000017 | `ZAddIntakeFields2026071400003` → `ZAddIntakeFields0000000000017` |
| 0000000000018 | `ZAddFamilyIncomeStatus2026071500001` → `ZAddFamilyIncomeStatus0000000000018` |
| 0000000000019 | `ZAddFamilyMemberTimestamps2026071700004` → `ZAddFamilyMemberTimestamps0000000000019` |
| 0000000000020 | `ZAddEmailVerification20260719000001` → `ZAddEmailVerification0000000000020` |
| 0000000000021 | `ZAddEmailNotification20260719000002` → `ZAddEmailNotification0000000000021` |
| 0000000000022 | `UnifiedPersonModel20260720000001` → `UnifiedPersonModel0000000000022` |
| 0000000000023 | `DropCaseTrackerLog20260723000001` → `DropCaseTrackerLog0000000000023` |
| 0000000000024 | `KilosUnladPhaseAlignment20260726000001` → `KilosUnladPhaseAlignment0000000000024` |
| 0000000000025 | `DropInterventions20260727000001` → `DropInterventions0000000000025` |
| 0000000000026 | `DropFamilyMembers20260727000002` → `DropFamilyMembers0000000000026` |
| 0000000000027 | `DropProgramAssignments20260727000003` → `DropProgramAssignments0000000000027` |
| 0000000000028 | `CatchUpSchema20260728000001` → `CatchUpSchema0000000000028` |
| 0000000000029 | `BarangayCoordinatorModule20260729000001` → `BarangayCoordinatorModule0000000000029` |
| 0000000000030 | `CreatePhysicalFilesTable20260730000001` → `CreatePhysicalFilesTable0000000000030` |
| 0000000000031 | `AddCaseInterventionsHashChain20260730000002` → `AddCaseInterventionsHashChain0000000000031` |
| 0000000000032 | `MoveAccessCardToHousehold20260730000003` → `MoveAccessCardToHousehold0000000000032` |
| 0000000000033 | `DuplicateDetectionEnhancements20260730000004` → `DuplicateDetectionEnhancements0000000000033` |
| 0000000000034 | `CreateAnnouncements20260801000000` → `CreateAnnouncements0000000000034` |
| 0000000000035 | `CreateAgenciesTable20260803000001` → `CreateAgenciesTable0000000000035` |
| 0000000000036 | `CreateInterAgencyReferralsTable20260803000002` → `CreateInterAgencyReferralsTable0000000000036` |
| 0000000000037 | `AddAgencyIdToAccessCardServices20260803000003` → `AddAgencyIdToAccessCardServices0000000000037` |
| 0000000000038 | `AddUniqueHouseholdMembership20260805000001` → `AddUniqueHouseholdMembership0000000000038` |
| 0000000000039 | `CreatePersonContactsAddresses20260828000001` → `CreatePersonContactsAddresses0000000000039` |
| 0000000000040 | `CreateUserChildTables20260828000002` → `CreateUserChildTables0000000000040` |
| 0000000000041 | `CreateCaseChildTables` … | … |
| 0000000000042 | `CreateAgencyProgramChildTables` … | … |
| 0000000000043 | `AddReferralPersonId` … | … |
| 0000000000044 | `DedupBeneficiaryColumns` … | … |
| 0000000000045 | `DropPersonLegacyColumns20260829000001` → `DropPersonLegacyColumns0000000000045` |
| 0000000000046 | `DropUserLegacyColumns` … | … |
| 0000000000047 | `BeneficiaryDedup` … | … |
| 0000000000048 | `CaseDecompose` … | … |
| 0000000000049 | `ReferralPersonLink` … | … |
| 0000000000050 | `AgencyProgramDrop` … | … |

Rules: keep human prefix; new suffix = standalone `import`-safe; update class
declaration AND `name = '…'` field identically; file renamed to match new class
name. **Never partially rename** (data-source glob would then load stale
duplicates whose sort keys collide).

## Task B — Fix DropPersonLegacyColumns.up dependency order

Move the two `DROP POLICY IF EXISTS` statements (`ben_barangay_scope` on
`beneficiaries`, `cases_barangay_scope` on `cases`) to **before**
`ALTER TABLE persons DROP COLUMN address`. The migration already re-creates both
policies after the drop, scoped to `person_addresses` — so this is purely a
reorder, no semantic change.

## Task C — Verification (acceptance)

1. Fresh-DB replay: `DB_PORT=5433 DB_HOST=/tmp/opencode/kapwa-pg npm run
   migration:run -d src/database/data-source.ts` → all 50 executed.
2. End-state schema: `\dt` shows the expected ~43 tables (matches research run).
3. `npm run typecheck` clean.
4. `npx jest --silent` → 51 suites / 411 tests PASS (existing wave-2 tests).
5. `npm run lint` clean.
6. Idempotency re-run: `migration:run` again reports "0 migrations pending"
   (guards: must not double-run on already-migrated DB).

## Task D — Compatibility contract (existing DBs)

- **Fresh DB:** renamed classes record new names via `migrate.ts` / chain — fine.
- **Existing DBs bootstrapped by `migrate.ts`:** it inserts `m.name` with
  `WHERE NOT EXISTS`, so after rename it records the new names alongside old;
  schema is unchanged. Safe.
- **Existing DBs where someone previously ran `migration:run`:** old class names
  are recorded; after rename, a NEW `migration:run` would try to re-run all
  50 against a schema that already has the shapes → unsupported. Prod path is
  `migrate.ts`; document this in AGENTS.md note ("migration-chain fresh-boot is
  for new deployments; existing DBs upgrade via migrate.js bootstrap only").

## Out of scope (deferred)
- Rehosting `uuid_generate_v7()` outside migration 1.
- Making every migration order-idempotent as an alternative to renames.
- Wave-2 closed items (deferred Minors, sync hardening).

## Risks
- Renaming 50 files/classes: mechanical but wide; mitigated by a script + the
  disposable-PG verification gate (Task C).
- `migrations` identity change on already-chained DBs (Task D note).