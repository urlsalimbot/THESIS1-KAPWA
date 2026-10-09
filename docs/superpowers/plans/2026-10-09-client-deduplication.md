# Client Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import client lists (xlsx/csv) into a reviewable deduplication operation — Fellegi-Sunter-style matching against the database, within the file, and across households — with human retain/dedupe decisions, a guarded finalize, persisted remark history, and a stored Excel priority list.

**Architecture:** New `src/dedup/` NestJS module (entities + parser + matcher + operations service + controller) and a new client page `ClientDedupPage` at `/client-dedup`. The matcher extends the existing probabilistic matcher in `src/intake/match-scoring.ts` with frequency-based weights and household signals. The beneficiary view's Log Intervention card is replaced by a Remarks History card fed by `beneficiary_remarks`.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (pg_trgm), exceljs (server file read/write — used via `require('exceljs')` as in `src/export/export.service.ts`), React 19 + Vite + SWR + shadcn/Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-09-client-deduplication-design.md`

## Global Constraints

- Roles: `@Roles('admin', 'social_worker')` on every `client-dedup` route; the client page is `Private roles={['admin','social_worker']}`.
- Schema changes need BOTH a TypeORM migration in `src/database/migrations/` (class name ends `…0000000000086`) AND an idempotent `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN` block in `src/database/migrate.ts`. Never renumber existing keys; check duplicates with the grep in AGENTS.md.
- New tables: `client_import_operations`, `client_import_rows`, `client_import_matches`, `beneficiary_remarks` (snake_case columns per the repo naming strategy).
- 2-space indent, eslint config as-is; server tests via `npx jest <file>`, client via `npx vitest run <file>`; server typecheck `npm run typecheck`, client same.
- `exceljs` is imported as `const ExcelJS = require('exceljs')` in server code (pattern in `src/export/export.service.ts`).
- Commit style: conventional commits; stage explicit paths.
- The matcher must not alter intake behaviour: extend `match-scoring` signal inputs, do not change `assessMatchCandidate` results for intake callers.

## Review Focus

- Import row with **missing gender**: `createBeneficiary` requires `gender` — the dedup save path must create person+beneficiary without a gender when the file has none (own insert, not `createBeneficiary`) — Task 7 test.
- A row with **no declared barangay** must still match/score (barangay signal absent, never crashes) — Task 4 test.
- **Two identical rows in one file** (same name+dob) must both surface as an intra-import pair with A/B primary choice, not silently fold — Task 6 test.
- **Finalize retried after failure** must not double-insert persons (transaction + status guard) — Task 7 test.
- **Household with a served member**: candidate must show `householdServed: true` and the member's intervention summary — Task 4 test.

---

### Task 1: Dedup entities + migration + migrate.ts

**Files:**
- Create: `kapwa-server/src/dedup/dedup.entity.ts`
- Create: `kapwa-server/src/database/migrations/ZAddClientDeduplication0000000000086.ts`
- Modify: `kapwa-server/src/database/migrate.ts`

**Interfaces:**
- Produces: `ClientImportOperation`, `ClientImportRow`, `ClientImportMatch`, `BeneficiaryRemark` entities (TypeORM `@Entity` + `@Column` snake_case names).

- [ ] **Step 1: Write migration (single file, 4 tables)**

Contents: `CREATE TABLE IF NOT EXISTS client_import_operations (id uuid PRIMARY KEY DEFAULT uuid_generate_v7(), source text NOT NULL, status varchar NOT NULL DEFAULT 'defined', column_map jsonb NOT NULL, match_threshold numeric(4,3) NOT NULL DEFAULT 0.75, created_by uuid, accomplisher uuid, created_at timestamptz NOT NULL DEFAULT now(), finalized_at timestamptz, output_file text)`; `client_import_rows (id uuid PK, operation_id uuid NOT NULL REFERENCES client_import_operations(id) ON DELETE CASCADE, row_index int NOT NULL, last_name text, first_name text, middle_name text, dob date, barangay text, original_remarks text, extra_data jsonb NOT NULL DEFAULT '{}', status varchar NOT NULL DEFAULT 'pending', score numeric(5,4), remarks text, matched_person_id uuid, beneficiary_id uuid, decided_by uuid, decided_at timestamptz)`; `client_import_matches (id uuid PK, row_id uuid NOT NULL REFERENCES client_import_rows(id) ON DELETE CASCADE, target_type varchar NOT NULL, target_person_id uuid, target_import_row_id uuid, target_household_id uuid, score numeric(5,4) NOT NULL, signals jsonb NOT NULL DEFAULT '{}', status varchar NOT NULL DEFAULT 'pending', remark text, decided_by uuid, decided_at timestamptz)`; `beneficiary_remarks (id uuid PK, beneficiary_id uuid NOT NULL, operation_id uuid, kind varchar NOT NULL, remark text NOT NULL, source text, authored_by uuid, created_at timestamptz NOT NULL DEFAULT now())`. Add the same `CREATE TABLE IF NOT EXISTS` statements to `migrate.ts` (same DDL text), placed near the other tables. `down()` drops in reverse.

- [ ] **Step 2: Run the migration against a disposable DB to prove it applies**

Run: `npx jest` — no; instead verify migrate.ts's list still parses: `npm run typecheck`. Expected: clean.

- [ ] **Step 3: Write the entities**

`dedup.entity.ts` mirrors the DDL (`@Entity('client_import_operations')` etc., `BaseEntity` from `../common/base.entity`, `@Column({ name: '...' })` with the snake_case names, relation `rows: ClientImportRow[]` via `@OneToMany`, `@Column({ type: 'jsonb' }) columnMap` etc.).

- [ ] **Step 4: Typecheck + commit**

Run: `npx jest case-step-labels` (sanity) and `npm run typecheck`. Expected: green. Commit: `git add kapwa-server/src/dedup/dedup.entity.ts kapwa-server/src/database/migrations/ZAddClientDeduplication0000000000086.ts kapwa-server/src/database/migrate.ts && git commit -m "feat(dedup): onboarding tables for client deduplication"`

---

### Task 2: Column map + row parser (xlsx/csv)

**Files:**
- Create: `kapwa-server/src/dedup/dedup-parse.service.ts`
- Create: `kapwa-server/src/dedup/dedup-parse.service.spec.ts`
- Test: `test/fixtures/import-valid.xlsx` + `import-valid.csv` + `import-missing-col.csv` (built in-spec with exceljs/csv strings)

**Interfaces:**
- Consumes: `column_map` JSON shape from Task 1.
- Produces: `interface ParsedImport { rows: Array<{ rowIndex: number; lastName: string; firstName: string; middleName?: string; dob?: string; barangay?: string; originalRemarks?: string; extraData: Record<string, string | number | Date> }>; }` and `function parseImportFile(buffer: Buffer, filename: string, columnMap: ColumnMap): ParsedImport`.
- Produces: `ColumnMap = { baseline: { lastName: string; firstName: string; middleName: string; birthDate: string; barangay: string; remarks: string }; extras: Array<{ name: string; kind: 'text' | 'date' | 'number'; identifier?: 'phone' | 'email' | 'philsys'; sourceColumn: string }> }`.

- [ ] **Step 1: Write the failing tests**

```ts
import { parseImportFile } from './dedup-parse.service';
it('parses a CSV with the baseline columns and one extra', () => {
  const csv = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks,Phone Number\nReyes,Pedro,Poblete,1988-03-21,Bigte,AICS,09171000005\n';
  const map: ColumnMap = { baseline: { lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name', birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks' }, extras: [{ name: 'Phone Number', kind: 'text', sourceColumn: 'Phone Number' }] };
  const out = parseImportFile(Buffer.from(csv), 'list.csv', map);
  expect(out.rows).toHaveLength(1);
  expect(out.rows[0]).toMatchObject({ lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', originalRemarks: 'AICS', extraData: { 'Phone Number': '09171000005' } });
});
it('rejects a file missing a declared column', () => {
  const csv = 'Last Name,First Name\nReyes,Pedro\n';
  const map: ColumnMap = { baseline: { lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name', birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks' }, extras: [] };
  expect(() => parseImportFile(Buffer.from(csv), 'list.csv', map)).toThrow(/Middle Name/);
});
```

- [ ] **Step 2: Run to verify they fail** — `npx jest dedup-parse` — Expected: `Cannot find module './dedup-parse.service'`.
- [ ] **Step 3: Implement** — exceljs reads both xlsx and csv (`workbook.csv.read(stream)` for `.csv`; `workbook.xlsx.load(buffer)` for `.xlsx`); map header row → column index; throw `ColumnMapError` listing missing declared columns; parse dob via `new Date(value)`; extras coerced by kind; identity-identifier extras also stored in `extraData`.
- [ ] **Step 4: Run tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(dedup): parse xlsx/csv rows against a declarable column map`

---

### Task 3: Frequency-weighted matcher

**Files:**
- Modify: `kapwa-server/src/intake/match-scoring.ts` (add exports only: `personSignals`, `FREQUENCY` helpers — do not change `assessMatchCandidate` for intake callers)
- Create: `kapwa-server/src/dedup/dedup-matcher.service.ts`
- Create: `kapwa-server/src/dedup/dedup-matcher.service.spec.ts`

**Interfaces:**
- Consumes: `MatchSignals`, `assessMatchCandidate`, `soundex` from `../intake/match-scoring`.
- Produces:
```ts
type PersonSignals = MatchSignals & { middleNameMatch: boolean; birthdayMatch: boolean };
function personSignals(a: { lastName: string; firstName: string; middleName?: string; dob?: string; barangay?: string; phone?: string; email?: string; philsys?: string }, b: PersonRecord): PersonSignals;
interface FrequencyWeights { surname: number; firstName: number; middleName: number; dob: number; barangay: number; }
function frequencyWeights(rows: Array<{ surname: string }>): FrequencyWeights; // rarity: 1/(1+count)
function dedupScore(s: PersonSignals, w: FrequencyWeights, householdServed: boolean): number; // 0..1
const DEDUP_THRESHOLD_DEFAULT = 0.75;
```

- [ ] **Step 1: Write the failing tests**
- `personSignals` computes `simSurname`/`simFirstName` via `similarity` stub passed in as a `sim` fn (inject `(a,b)=>...` for unit isolation), `birthdayMatch` exact, `surnamePhoneticMatch` via `soundex`.
- `frequencyWeights` returns higher weight for rarer surnames: two rows → surname 'Reyes' (1 occurrence) weight > surname 'Ramos' (many).
- `dedupScore` with `householdServed: true` beats the same signals with `false`; score ∈ [0,1]; a full exact match on all fields ≥ 0.95; an empty-but-barangay-only signal < any name signal.
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement** — `personSignals` maps the import row fields onto `MatchSignals` (dob→`dobMatch`, barangay→`barangayMatch`, philsys/phone/email when declared), adds `middleNameMatch` and `birthdayMatch`; `frequencyWeights` counts surnames over the *import plus DB candidate set* via a single `SELECT surname, COUNT(*)` grouped query; `dedupScore` = `assessMatchCandidate-weighted`: 0.40 name (sim weighted by rarity) + 0.15 middle + 0.20 dob + 0.10 barangay + 0.15 PII-identifiers (present only when declared), plus `householdServed ? +0.10` capped at 1; `isMatch = score >= threshold`.
- [ ] **Step 4: Run — pass.**
- [ ] **Step 5: Commit** — `feat(dedup): frequency-weighted person matcher over baseline + declared identifiers`

---

### Task 4: Match sweeps (DB, household, intra-import)

**Files:**
- Create: `kapwa-server/src/dedup/dedup-match-sweep.service.ts`
- Create: `kapwa-server/src/dedup/dedup-match-sweep.service.spec.ts`

**Interfaces:**
- Consumes: Task 3 `personSignals`, `dedupScore`, `DEDUP_THRESHOLD_DEFAULT`; `createBeneficiary` NOT used here.
- Produces:
```ts
interface MatchCandidate { rowId: string; targetType: 'db_person' | 'import_row' | 'household'; targetPersonId?: string; targetImportRowId?: string; targetHouseholdId?: string; memberPersonIds?: string[]; score: number; signals: PersonSignals & { householdServed?: boolean }; }
async function sweep(job: { id: string; threshold: number }, allRows: ParsedRowPersist[], personsRepo, rowRepo, eventRepo): Promise<MatchCandidate[]>;
```
`ParsedRowPersist` = row fields + `id`.

- [ ] **Step 1: failing tests**
- a row matching a DB person by name+dob yields one `db_person` candidate with `score >= threshold`.
- a row whose strong match is a member of a household with an intervention → one `household` candidate with `householdServed: true` and `memberPersonIds` populated (mock `case_interventions` count query).
- two identical rows in the file → intra-import candidate on the second row pointing at the first (`targetType: 'import_row'`).
- a row with no barangay and no strong signal → `no candidates` (row status `no_match`).
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — one pg_trgm prefilter query over `persons` (`similarity(surname, $x) > 0.3 OR similarity(first_name, $x) > 0.3`) scoped to candidates; fetch memberships + interventions for the household path with two grouped queries; intra-import loop over `allRows` already processed (index < current). Dedup candidates by (rowId,target), keep top-3 by score; row `status` = `no_match` when none ≥ threshold.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): three-sweep candidate generation (db, household, intra-import)`

---

### Task 5: Operations lifecycle (create/upload/list/detail)

**Files:**
- Create: `kapwa-server/src/dedup/dedup.service.ts`
- Create: `kapwa-server/src/dedup/dedup.service.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (entities, `parseImportFile`, `sweep`).
- Produces: `dedupService.create(input: { source: string; columnMap: ColumnMap; matchThreshold?: number }, actorId: string): Promise<{ id: string }>`; `dedupService.upload(id: string, buffer: Buffer, filename: string, actorId: string)` — parse → error report on `ColumnMapError` (400 with the missing columns), else delete stale rows + insert parsed rows + run `sweep` + set status `reviewing`; `dedupService.list(page, limit, status?)`; `dedupService.detail(id)` with counts (`totalRows`, `pending`, `noMatch`, `decided`).

- [ ] **Step 1: tests** — create sets `status='defined'`; upload with a valid csv inserts 2 rows and flips status to `reviewing`; upload with a missing column throws `BadRequestException` listing the missing header; list paginates; detail counts rows by status.
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — follow `beneficiaries.service` patterns (repo injection; `BadRequestException` from `@nestjs/common`; save rows in a batch via `save(rows)`); after parse+insert call `sweep` and persist the returned candidates; never ingest anything when parse throws.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): operation lifecycle (define, upload-and-match, list, detail)`

---

### Task 6: Decisions (primary selection; mandatory remark; revert)

**Files:**
- Modify: `kapwa-server/src/dedup/dedup.service.ts`
- Modify: `kapwa-server/src/dedup/dedup.service.spec.ts`

**Interfaces:**
- Produces: `dedupService.decide(operationId, matchId, body: { keep: 'import_row' | 'existing_record' | 'other_import_row'; remark?: string }, actorId)` and `dedupService.revert(matchId)`.
- Row status derivation (shared helper `deriveRowStatus(row, matches)`): any `pending` match ⇒ `pending`; else any match with `keep !== 'import_row'` for that row ⇒ `deprioritized`; else `retained` or `primary` (intra-import winner) / `no_match` (no matches).

- [ ] **Step 1: tests**
- `decide` with `keep: 'existing_record'` and no remark → throws `BadRequestException(/remark/i)`.
- `decide` with remark → match `status='deprioritized'`, row `status='deprioritized'`, `decided_by/decided_at` stamped; remark written to the matched beneficiary's `beneficiary_remarks` when the target is an existing person (kind `decision`).
- intra-import pair: `keep: 'other_import_row'` marks the row deprioritized and its paired row `primary`.
- `revert` returns the match and its row to `pending`.
- decisions only on a `reviewing` operation (else `BadRequestException`).
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — transaction (`dataSource.transaction`); validate remark when `keep !== 'import_row'`; `deriveRowStatus` recomputes the row status from its matches each time.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): retain/dedupe decisions with mandatory remarks and revert`

---

### Task 7: Finalize (guard, transactional save, idempotency)

**Files:**
- Modify: `kapwa-server/src/dedup/dedup.service.ts`
- Modify: `kapwa-server/src/dedup/dedup.service.spec.ts`

**Interfaces:**
- Consumes: `beneficiaries.service.createBeneficiary` for metadata reference only; the dedup insert path builds person+beneficiary **without requiring gender** (own `personRepo.create` + `beneficiaryRepo.create` with nullable gender), so rows without a declared gender still save.
- Produces: `dedupService.finalize(operationId, actorId): Promise<{ created: number; updated: number; deprioritized: number; barangayUpdates: number }>`.

- [ ] **Step 1: tests**
- **guard**: any pending match → `BadRequestException(/pending/i)`; snapshot counts unchanged.
- `no_match` row → person+beneficiary inserted (gender absent OK), `import` remark recorded.
- `retained` row → existing beneficiary updated; **barangay differs** → address `current` updated and a `barangay_update` remark appended.
- `deprioritized` row → NOTHING inserted; remark already recorded (Task 6); row keeps `remarks`.
- second `finalize` call → `BadRequestException` (status already `finalized`); first call inside a mocked failing repo `save` → transaction rolls back (no partial inserts).
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — status guard (`reviewing` only); `dataSource.transaction(fn)`; upsert by `matched_person_id`; barangay compare against `person.addresses.find(addressType==='current')`; `createPersonForRow` (gender optional); set `accomplisher`/`finalized_at`/`status='finalized'`; call Task 8 writer; store `output_file`.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): guarded, transactional, idempotent finalize`

---

### Task 8: Output Excel writer (order + Status column)

**Files:**
- Create: `kapwa-server/src/dedup/dedup-output.service.ts`
- Create: `kapwa-server/src/dedup/dedup-output.service.spec.ts`

**Interfaces:**
- Produces: `dedupOutput.write(operation, rows, extras): Promise<string /* file path */>` writing to `path.resolve(process.cwd(), 'exports/client-dedup')` (mkdir recursive; mirror `filing` UPLOAD_DIR pattern) filename `client-dedup-<operationId>.xlsx`; returns relative path stored in `output_file`.

- [ ] **Step 1: tests**
- column order: `Last Name, First Name, Middle Name, Birthday, Barangay, <extras in declared order>, Remarks, Status`.
- ordering: primaries (no_match/retained/primary, in row_index order) first; deprioritized below.
- Status text per row: `No match` / `New record saved` / `Updated` / `Retained` / `Deprioritized — duplicate of <controlNo|row N>`; barangay-updated rows append `; barangay updated`.
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — `require('exceljs')`; one worksheet; header row = the mapped names; write rows; `workbook.xlsx.writeBuffer()`; `fs.writeFileSync`.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): priority-list Excel output with Status column`

---

### Task 9: Remarks service (history read/write + card API)

**Files:**
- Create: `kapwa-server/src/dedup/beneficiary-remarks.service.ts`
- Create: `kapwa-server/src/dedup/beneficiary-remarks.service.spec.ts`

**Interfaces:**
- Produces: `remarksService.list(beneficiaryId, page, limit)` (DESC by created_at); `remarksService.add(beneficiaryId, { remark: string }, actorId)` (kind `manual`, validates non-empty); helper `remarksService.append({ beneficiaryId, operationId, kind, remark, source, authoredBy })` used by Tasks 6–7.

- [ ] **Step 1: tests** — list paginates newest-first; add requires non-empty remark; append stamps kind/source/author.
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — plain repo service, same style as `case-step-locks.service.ts`.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): beneficiary remark history service`

---

### Task 10: Controller + module wiring + API tests

**Files:**
- Create: `kapwa-server/src/dedup/dedup.controller.ts`
- Create: `kapwa-server/src/dedup/dedup.module.ts`
- Modify: `kapwa-server/src/app.module.ts` (import `DedupModule`)
- Create: `kapwa-server/src/dedup/dedup.controller.spec.ts`

**Interfaces:**
- Produces: routes — `POST /client-dedup/operations`, `POST /client-dedup/operations/:id/upload` (FileInterceptor 'file'), `GET /client-dedup/operations`, `GET /client-dedup/operations/:id`, `GET /client-dedup/operations/:id/rows?page&limit&status&search`, `GET /client-dedup/operations/:id/rows/:rowId/matches?page`, `POST /client-dedup/operations/:id/matches/:matchId/decision`, `POST /client-dedup/operations/:id/matches/:matchId/revert`, `POST /client-dedup/operations/:id/finalize`, `GET /client-dedup/operations/:id/output` (StreamableFile with `Content-Disposition: attachment`), `GET /beneficiaries/:id/remarks`, `POST /beneficiaries/:id/remarks`. All `@Roles('admin','social_worker')`; controller follows the repo's guard/decorator pattern (see `users.controller.ts`). The `remarks` routes live in a `RemarksController` at `@Controller('beneficiaries')` inside `DedupModule`.

- [ ] **Step 1: module + controller with the route skeleton and role guards; one route test (decision with a fabricated match echo) to prove guard wiring** — `@Controller('client-dedup')` scoped; `remarks` routes land on the beneficiaries controller or a small `remarks` controller with the same roles.
- [ ] **Step 2: run — fail (module not found)**
- [ ] **Step 3: implement** — wire `TypeOrmModule.forFeature([...entities])`, `MulterModule` not needed (FileInterceptor with default limits is fine); export `DedupService`; app.module import.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(dedup): REST surface for operations, matches, output, remarks`

---

### Task 11: Client — operations list + define wizard + upload

**Files:**
- Create: `kapwa-client/src/pages/ClientDedupPage.tsx`
- Create: `kapwa-client/src/pages/ClientDedupPage.test.tsx`

**Interfaces:**
- Consumes: API routes from Task 10; `queryKeys` extension in `kapwa-client/src/lib/query-keys.ts` (`clientDedup: { list, detail, rows, matches }`).
- Produces: `<ClientDedupPage />` with three internal views switched by state (`list | define | review`) and a `useState`-driven row-definition draft: `{ lastName, firstName, middleName, birthDate, barangay, remarks, extras: Array<{name, kind, identifier?, sourceColumn}> }` defaulting to the six baseline column names.

- [ ] **Step 1: failing components tests** (vitest + mockApiGet/mockApiPost per `UsersPanel.test.tsx` pattern)
- renders the operations list from `GET /client-dedup/operations` (source, status badge, pending count).
- "New deduplication" shows the define view with the 6 baseline fields pre-filled; "Declare extra field" adds a row with name/kind select.
- uploading calls `POST /operations/:id/upload` with a `FormData` file and navigates to review.
- [ ] **Step 2: run — fail (page missing)**
- [ ] **Step 3: implement** — list table reusing `DataTable` + `formatDate`; define form with `Input`/`Select` (shadcn); `api.upload` (exists in `lib/api`) for the file; `useSWR` for list.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(client): client dedup — operations list, row definition wizard, upload`

---

### Task 12: Client — review grid (pagination, candidates, decisions)

**Files:**
- Modify: `kapwa-client/src/pages/ClientDedupPage.tsx`
- Modify: `kapwa-client/src/pages/ClientDedupPage.test.tsx`
- Create: `kapwa-client/src/components/dedup/RowDecisionCard.tsx` (props: `row`, `candidates`, `onDecide(keep, remark)`, `onRevert`)

**Interfaces:**
- Consumes: `GET /client-dedup/operations/:id/rows?page&limit` and `…/rows/:rowId/matches?page`; `POST …/matches/:matchId/decision { keep, remark? }`; revert via `POST …/matches/:matchId/revert`.
- Produces: the grid + `RowDecisionCard` (green/gray chips, candidate cards with case details + `householdServed` badge, Retain/Keep-existing buttons, intra-import A/B selector, mandatory remark textarea, revert link).

- [ ] **Step 1: failing tests**
- green row renders with `No match` chip and no expandable candidates.
- gray row expands candidates; each card shows control numbers and interventions; household card shows the badge when `signals.householdServed`.
- choosing Keep-existing without remark → Save disabled; with remark → `POST decision` with `{ keep: 'existing_record', remark }`.
- intra-import pair offers A/B primary; choosing B marks the row deprioritized and re-renders the pair under B.
- revert calls the revert route and the row returns to pending.
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — pagination state like `UsersPanel` (`pageIndex/pageSize` + `rowCount`); candidate fetch lazily on expand (per-row SWR key); optimistic revalidate after decisions.
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(client): dedup review grid with candidate decisions`

---

### Task 13: Client — finalize + output view

**Files:**
- Modify: `kapwa-client/src/pages/ClientDedupPage.tsx`
- Modify: `kapwa-client/src/pages/ClientDedupPage.test.tsx`

**Interfaces:**
- Consumes: `POST …/finalize`, `GET …/output` (blob download via `downloadFilingDoc`-style helper reading `Content-Disposition`), detail counts.

- [ ] **Step 1: failing tests**
- sticky finalize bar shows pending count; button disabled when `pendingCount > 0` (tooltip names the count).
- confirm dialog; success view renders created/updated/deprioritized/barangay-updates summary and a Download button that triggers the blob fetch.
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — bar reads `detail.pending`; after finalize, revalidate detail and switch to the output view; download via a `downloadClientDedupOutput(id)` helper in `lib/api.ts` (pattern: `downloadFilingDoc`).
- [ ] **Step 4: run — pass**
- [ ] **Step 5: commit** — `feat(client): finalize guard + priority list output view`

---

### Task 14: Client — beneficiary remarks-history card

**Files:**
- Modify: `kapwa-client/src/pages/BeneficiaryViewPage.tsx` (replace the `Log Intervention` card block — `handleLogIntervention` and its JSX ~lines 349–377 and ~719–770 — with a Remarks History card)
- Modify: `kapwa-client/src/pages/BeneficiaryViewPage.test.tsx`
- Create: `kapwa-client/src/components/beneficiaries/RemarksHistoryCard.tsx`
- Create: `kapwa-client/src/components/beneficiaries/RemarksHistoryCard.test.tsx`

**Interfaces:**
- Consumes: `GET /beneficiaries/:id/remarks`, `POST /beneficiaries/:id/remarks { remark }`.

- [ ] **Step 1: failing tests**
- card renders the remark timeline (kind badge text, source, author name, date) from the GET mock.
- "Add remark" posts `{ remark }` to the POST route and prepends the new entry; empty remark disables Save.
- BeneficiaryViewPage renders the card in place of the old Log Intervention heading (`old: /Log Intervention/` query returns null; `Remarks History` present).
- [ ] **Step 2: run — fail**
- [ ] **Step 3: implement** — remove the intervention card + its handler + now-unused state/imports (keep `user`/`caseId` usage clean; run `npx eslint` to catch dead imports); add `RemarksHistoryCard` using `useSWR` + `useSWRConfig` mutate, kind label map `{ import: 'Import', decision: 'Decision', barangay_update: 'Barangay update', manual: 'Remark' }`, `Badge` coloring per kind.
- [ ] **Step 4: run — pass; also `npm run typecheck`**
- [ ] **Step 5: commit** — `feat(client): remarks history card replaces quick intervention logging on beneficiary view`

---

### Task 15: Navigation, roles, full gates, E2E

**Files:**
- Modify: `kapwa-client/src/routes.tsx` (add `/client-dedup` under `Private roles={['admin','social_worker']}`)
- Modify: nav/sidebar entry (the nav component that lists Dashboard/Cases/… for those roles)
- Modify: `kapwa-client/src/lib/query-keys.ts` (already done in Task 11 — verify)
- Server: `kapwa-server/src/cases/cases.service.spec.ts` unchanged; run full suites.

- [ ] **Step 1: route + nav entry; add a route smoke test** (`routes.tsx` renders `/client-dedup` for admin and social_worker; claimant 403).
- [ ] **Step 2: full gates** — Server: `npx jest --silent` (expect existing 1386 + new dedup suites all green); `npm run typecheck`; `npm run lint`. Client: `npx vitest run`; `npm run typecheck`. Fix fallout (eslint unused imports from Task 14 especially).
- [ ] **Step 3: E2E on dev via playwright-cli** — build server + client dev is already serving source; restart API; admin login; create operation via UI with a CSV fixture containing one fresh person, one duplicate of an existing person (e.g., `pedro.claimant@test.com`'s person renamed-similar), and one intest household member row; verify green/gray rendering; deprioritize the duplicate with a remark (mandatory enforced); finalize blocked while pending → decide all → finalize; download the output and assert the Status column + deprioritized-at-bottom ordering; check `beneficiary_remarks` rows in the DB; confirm the beneficiary page card shows the decision remark.
- [ ] **Step 4: commit any E2E-genuine fixes** — conventional messages.
- [ ] **Step 5: final commit** — `chore(dedup): navigation, gates green, e2e verified`