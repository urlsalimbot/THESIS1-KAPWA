# Client Deduplication — Import, Matching, Review, and Priority List

**Date:** 2026-10-09
**Scope:** New subsystem — `src/dedup/` (server) + `/client-dedup` (client) + a remarks-history card on the beneficiary view.
**Roles:** `admin` and `social_worker` at every step.

## 1. Purpose

An MSWDO operation where staff import a client list (Excel/CSV), match every row
against the entire database (plus the file itself, plus households), review each
match as a human decision, and produce a final **priority list** that is stored
server-side as an Excel file.

The operation catches two classes of duplication that otherwise silently create
double records:

- **Person duplicates** — the same client entered twice (different spelling,
  nickname, or a different barangay recorded).
- **Household duplicates** — two persons belonging to the same household, or a
  person whose household **has already received an intervention**.

## 2. Row definition (declarable, before upload)

Every operation defines its own row schema before the file is uploaded. The
baseline rows are always present:

| Baseline field | Notes |
|---|---|
| Last Name | required |
| First Name | required |
| Middle Name | optional |
| Birthday | parsed as date (yyyy-mm-dd, flexible input formats) |
| Barangay | optional |
| Remarks | optional, free text |

**Declarable extra fields** — the operator may declare any number of additional
columns: `{ name, kind: 'text' | 'date' | 'number', identifier?: 'phone' | 'email' | 'philsys', sourceColumn }`.
A field declared as an *identifier* feeds the matcher as a high-entropy
corroborating signal; plain declarable fields are carried, displayed, and
exported but never scored.

The definition is **free-form** (header text or column index) because it happens
before the file exists. Upload validates: a declared column missing from the
actual header fails the upload with a list of the missing columns; nothing is
half-loaded. Column map is stored on the operation (`column_map` JSON).

## 3. Data model

### `client_import_operations`
| Column | Notes |
|---|---|
| id (uuid) | |
| source | filename / origin of the import |
| status | `defined → reviewing → finalized` (finalize is atomic; `finalizing` exists only inside the transaction) |
| column_map | JSON — baseline six + extras as above |
| match_threshold | stored per operation (default from config) |
| created_by | user id |
| accomplisher | user id who finalized (null until finalized) |
| created_at / finalized_at | |
| output_file | path of the generated Excel (null until finalized) |

### `client_import_rows`
One row per file row. `status`:

| status | meaning | outcome at finalize |
|---|---|---|
| `pending` | ≥1 candidate match not yet decided (gray) | blocks finalize |
| `no_match` | no candidates ≥ threshold (green) | creates person + beneficiary |
| `retained` | primary is the import row | updates existing person/beneficiary |
| `primary` | kept as the canonical of an intra-import pair | creates person + beneficiary |
| `deprioritized` | duplicate of a primary (person, household, or import row) | creates nothing; pushed to the bottom of the output |

Columns: `operation_id`, `row_index`, baseline five + `original_remarks`,
`extra_data` (JSONB, keyed by declared name), `status`, `score`, `remarks`
(updated at decisions), `matched_person_id`, `beneficiary_id`, `decided_by`,
`decided_at`.

### `client_import_matches`
The candidates shown under a gray row.

| Column | Notes |
|---|---|
| row_id | import row |
| target_type | `db_person` \| `import_row` \| `household` |
| target_person_id / target_import_row_id / target_household_id | one set per type; household targets also record the member person ids matched |
| score | matcher score |
| signals | JSON — reason tokens and the signal breakdown (incl. `householdServed`) |
| status | `pending` → `primary` \| `deprioritized` (the decision) |
| remark | free text; **mandatory on `deprioritized` decisions** |
| decided_by / decided_at | |

### `beneficiary_remarks` (append-only remark history)
`beneficiary_id`, `operation_id`, `kind` (`import` \| `decision` \|
`barangay_update` \| `manual`), `remark`, `source`, `authored_by`, `created_at`.
Feeds the beneficiary-view card; accumulates across operations.

## 4. Matching engine (Felgi-Sunter, frequency-weighted)

**Approach: extend the existing probabilistic matcher.**
`src/intake/match-scoring.ts` already implements weighted probabilistic
matching ("record linkage in miniature": name similarities via pg_trgm, PII
confirmers, family corroboration). This subsystem generalises it into a
person-level matcher in `src/dedup/` with **frequency-based attribute weights**:
how rare an agreeing attribute is in the database determines how strongly it
moves the score (rare exact DOB + barangay agreement outweighs a common surname
match). Weight tables derive from `persons` counts at operation time.

Signals, scored only from declared inputs:

- surname similarity (pg_trgm), first-name similarity, middle-name agreement
- birthday agreement (exact)
- barangay agreement
- surname soundex agreement (spelling variants)
- declared identifier agreement: phone (digits), email, PhilSys number
- household signals: best family-member name similarity (reused from intake),
  and `householdServed` — any member of the candidate household has ≥1
  `case_interventions` row (or a case on file) — a strong corroborator.

Candidate selection is a pg_trgm prefilter over `persons`, plus persons linked
through `household_memberships`, plus the intra-import set.

Three sweeps, one engine:

1. **DB sweep** — against all persons.
2. **Intra-import sweep** — each row against rows already scanned in the same
   file, so a duplicated client inside the Excel (including the same person
   twice with different barangays) is caught even when both are new.
3. **Household sweep** — each row against households; a row whose person looks
   like a member produces a `household` candidate listing the members, their
   control numbers/status, and their interventions, with the
   `householdServed` badge when true.

Row status derives from the best candidate: `no_match` (green) when no
candidate reaches the operation's threshold, else `pending` (gray).

## 5. Review and decisions

The review grid is server-paginated (`page/limit`) with status filters and
search. A gray row expands its candidates:

- **person candidate:** name, score, reason tokens, case details (control no,
  status, barangay).
- **household candidate:** members, each member's control numbers + received
  interventions, `householdServed` badge.

**The decision is a primary selection.** For each matched pair the reviewer
chooses which record stays on top; the other is deprioritized:

| pair | primary options |
|---|---|
| import row ↔ existing person | keep the import row (updates the existing person/beneficiary) \| keep the existing record (row deprioritized, creates nothing) |
| import row A ↔ import row B (intra-import) | A \| B; the loser is deprioritized under the winner |
| import row ↔ household | keep the household (row deprioritized, no beneficiary; the row is recorded as a duplicate of the household) \| keep the import row (creates a new person + beneficiary for the row — no household structure is fabricated) |

Every deprioritization requires a **mandatory remark** (who/when stamped).
Decided matches can be **reverted to pending** while the operation is open.

In the review grid the deprioritized row renders **directly beneath its primary**
with a "duplicate of <control no / row N>" tag.

## 6. Finalize (guarded, transactional)

- **Guard:** any `pending` match anywhere in the operation → 400
  ("cannot finalize with N matches still unprocessed"); the UI disables the
  button and names the count.
- **Transactional save:**
  - `no_match` rows → insert person + beneficiary (address from barangay).
  - `retained` rows → upsert the matched person/beneficiary from the row data;
    when the imported barangay differs from the current address, the address is
    updated and a `barangay_update` remark is written to the beneficiary's
    remark history.
  - `primary` rows (intra-import) → insert person + beneficiary from the row.
  - `deprioritized` rows → create nothing; the decision remark is written to
    the retained record's remark history; these rows sit at the bottom of the
    output below the primaries.
  - remark history entries: `import` (the row's original remarks), `decision`
    (per deprioritization), `barangay_update`, all stamped with operator/date.
- **Idempotent**: finalizing an already-finalized operation is refused by
  status; the save runs inside one transaction, so a failure mid-save cannot
  leave a half-finalized state.
- `accomplisher` and `finalized_at` stamped; the output Excel is regenerated
  and stored; status → `finalized`.

## 7. Output (priority list)

The stored Excel (generated with `exceljs`, served via an authenticated
download) and the on-screen final list share one shape:

```
Last Name | First Name | Middle Name | Birthday | Barangay | <declared extras…> | Remarks | Status
```

- Row order: **primaries first** (in import order), **deprioritized below**.
- **Status column** (after Remarks): `No match` / `New record saved` /
  `Updated` / `Retained` / `Deprioritized — duplicate of <control no / row N>`,
  with a barangay-updated note when applicable.
- The operation record carries `source` and `accomplisher`; both are readable
  from the operations list and present in the exported metadata.

## 8. API

| Method/Path | Purpose |
|---|---|
| `POST /client-dedup/operations` | create with `{ source, columnMap, matchThreshold? }` |
| `POST /client-dedup/operations/:id/upload` | multipart xlsx/csv → parse + match → reviewing |
| `GET /client-dedup/operations` | list (paginated, status filter) |
| `GET /client-dedup/operations/:id` | detail (+ column map, counts, output info) |
| `GET /client-dedup/operations/:id/rows?page&limit&status&search` | review pagination |
| `GET /client-dedup/operations/:id/rows/:rowId/matches?page` | candidates per row |
| `POST /client-dedup/operations/:id/matches/:matchId/decision` | `{ keep: 'import_row' \| 'existing_record' \| 'other_import_row', remark? }` — `remark` is required whenever the decision deprioritizes the import row; for intra-import pairs `other_import_row` names the paired row (both sides share the match) |
| `POST /client-dedup/operations/:id/finalize` | guard + transactional save + output |
| `GET /client-dedup/operations/:id/output` | download the Excel |
| `GET /beneficiaries/:id/remarks` | remark history for the card |
| `POST /beneficiaries/:id/remarks` | manual remark |

All routes `@Roles('admin', 'social_worker')`.

## 9. UI

- **`/client-dedup` page** (nav entry for admin + social worker):
  1. **Operations list** — source, status badge, created-by, accomplisher,
     row counts, pending count, resume, "New deduplication".
  2. **Define-rows wizard** — baseline six with source-column declarations,
     "Declare extra field" (name, kind, optional identifier role); nothing is
     uploaded yet.
  3. **Upload** — file picker; header validation reports missing declared
     columns; parse + match runs; enters the review grid.
  4. **Review grid** — paginated; green/gray chips; expanded candidates with
     case/household details and primary-selection controls; mandatory remark
     on deprioritize; revert to pending; filters + search.
  5. **Finalize** — sticky bar with pending count, disabled while pending;
     confirm dialog; completion summary (created/updated/deprioritized/
     barangay updates); output download + on-screen priority list.
- **Beneficiary view rework** — the **Log Intervention** card becomes a
  **Remarks History** card: timeline of remarks (kind badges, source, author,
  date) and an "Add remark" inline form (manual). Quick intervention logging
  is removed from this page; the case view keeps it.

## 10. Non-goals

- No case creation from imports (beneficiaries only).
- No automatic decisions — matching never self-resolves; a human decides
  everything.
- No OCR/imagic matching; only the declared columns are used.
- No changes to the intake flow itself (the shared matcher gains weights
  without altering intake thresholds/behaviour).

## 11. Testing

- **Matcher (server):** signal extraction (including identifier and barangay
  edge cases), frequency-weight derivation, threshold behaviour,
  `householdServed` strong-corroborator rule, intra-import pairing,
  household-member candidate assembly.
- **Parser (server):** xlsx + csv fixtures, header-mapping validation,
  row-level parse errors, declarable extra fields (text/date/number).
- **Service (server):** primary-selection semantics incl. intra-import pairs,
  mandatory-remark enforcement, revert-to-pending, finalize guard, the
  transactional save (create/update/barangay-update/skip) and its idempotency,
  output ordering and the Status column, remark-history writes.
- **API (server):** route roles, pagination, download auth.
- **Client:** wizard states + column validation, review actions (mandatory
  remark, revert), finalize disable state, output view, remarks-history card
  (replace + render + add), role gating.
- **E2E (playwright):** define → upload fixture xlsx → review a matched pair →
  deprioritize with remark → finalize → download output; household-served
  badge on a fixture household.