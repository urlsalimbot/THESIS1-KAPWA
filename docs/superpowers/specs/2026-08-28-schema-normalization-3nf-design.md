# Database Schema Normalization to 3NF — Design

**Status:** Approved for implementation planning
**Date:** 2026-08-28
**Scope:** Schema audit + target 3NF redesign spec ONLY (no live code/migration files in this pass)
**Deliverable owner:** CAPSTONE — Kapwa MSWDO system

## 1. Purpose

Audit the current Kapwa database schema against 3rd Normal Form (3NF) and produce a
target normalized schema that can serve as the basis for the TypeORM entity layer and
TypeORM migrations. Per project decision, the normalization strategy is **targeted
strict 3NF** with an atomicity ceiling of **one child row per multi-valued attribute**
(standard pragmatic 3NF — we do NOT split inherently single-valued attributes like a
person's name or individual address fields into further sub-tables).

This document is the standalone design deliverable. It does **not** include running
migrations or changing controllers/services — that is downstream work (writing-plans →
execute), which will produce the actual `.ts` migration and entity files.

## 2. Ground truth

- `docs/diagrams/07-data-dictionary.md` — authoritative column-level source (32 tables).
- `docs/diagrams/06-erd.md` — authoritative entity-relationship source (31 entities/clusters).
- `kapwa-server/src/**/*.entity.ts` (29 TypeORM entity files) — implementation source.
- Prior spec `docs/superpowers/specs/2026-07-21-person-schema-redesign.md` — establishes the
  **unified person model** and confirms `beneficiary_roles` is the intended owner of
  `consentStatus` / `accessCardCode` / `category`.

## 3. Current-state 3NF audit

### 3.1 Already 3NF — no change

The following tables are already properly decomposed and satisfy 3NF as designed:

| Table | Reason |
|---|---|
| `household_memberships` | Correct link table (person ↔ household with role). |
| `beneficiary_claimants` | Correct link table (beneficiary ↔ claimant, with relationship). |
| `inter_agency_referrals` | Already FK-normalized to `case_id`/`person_id`/`from_agency_id`/`to_agency_id`/`consent_ledger_id`. |
| `physical_files` | FK to `intervention_id`. |
| `case_history` | Append-only audit log (atomic scalar columns). |
| `case_interventions` | Already a proper child table for case services (see §4.5 — target reuses it). |
| `form_version_history` | Child of `programs` (versioned snapshot + FK). |
| `notification_preferences` | Per-user opt-in rows. |
| `consent_ledger` | Append-only audit rows. |
| `otp_codes` | Atomic scalar verification rows. |
| `sync_queue`, `version_vectors` | Technical/CRDT tables (out of relational scope). |
| `csr_reports`, `chat_messages`, `notifications` | Assemblies of atomic scalar columns. |

### 3.2 Violations found

#### `persons` — violates 1NF (non-atomic / duplicated attributes) and 3NF (derived)

| Column | Violation |
|---|---|
| `address` (TEXT) + `current_address` (JSONB) | **Duplicate representation** of the same address attribute; composite non-atomic string → violates 1NF. |
| `phone`, `email` | Multi-valued attributes stored as a single column → violates 1NF. |
| `age` | **Derived** from `dob` → transitive dependency → violates 3NF. |
| `search_vector` | Derived/cached (FTS). **Intentional** — keep but flag (see §6). |

#### `users` — violates 1NF (repeating token group) and 1NF (multi-valued array)

| Column | Violation |
|---|---|
| `verification_token`, `verification_token_expires_at`, `reset_token`, `reset_token_expires_at`, `new_email`, `new_email_token`, `new_email_token_expires_at` | **Repeating group** of (purpose, token, expires). |
| `permitted_barangays` (TEXT[]) | Multi-valued attribute → violates 1NF atomicity. |
| `full_name`, `email`, `phone` | Duplicate person attributes (resolvable via `person_id`). |
| `assigned_barangay` | Single primary assignment; folded into assignment child below. |

#### `beneficiaries` ↔ `beneficiary_roles` — duplicated columns across tables

`consent_status`, `access_card_code`, `category`, `household_id` appear in **both**
`beneficiaries` and `beneficiary_roles`. The person-schema-redesign spec designates
`beneficiary_roles` as the owner → `beneficiaries` duplicates violate 3NF.

#### `households`

| Column | Violation |
|---|---|
| `estimated_income` | Derivable from member incomes → transitive. **Flag** (may keep for perf, §6). |
| `access_card_code` | Duplicate (owned by `beneficiary_roles`). |
| `verified_by` (TEXT) | Typed TEXT but stores a boolean ("false") — data-type misuse. |

#### `cases` — violates 1NF (multi-valued JSONB / array columns)

| Column | Violation |
|---|---|
| `service_requested` (TEXT[]) | Multi-valued → belongs in child. |
| `requirements_checklist` (JSONB) | Multi-valued → belongs in child. |
| `financial_subsidies` (JSONB) | Multi-valued → belongs in child. |
| `other_assistance` (JSONB) | Multi-valued → belongs in child. |
| `referrals` (JSONB) | Multi-valued → belongs in child. |
| `nature_of_service` (TEXT[]) | Multi-valued → belongs in child. |
| `amount_assistance`, `mode_financial_assistance`, `source_of_fund`, `legislator_specify` | Financial-aid attributes that belong with the assistance child. |
| `assigned_worker_name` | Derivable via `assigned_worker_id` FK join → transitive. |
| `follow_up_visits` (JSONB) | Singular count stored as JSONB → normalize to scalar `follow_up_visits` INTEGER. |

#### `referrals` — embeds a denormalized person copy

`surname`, `first_name`, `middle_name`, `extension`, `gender`, `dob`, `address` (JSONB),
`phone` duplicate a `persons` record. Should reference `persons.person_id`.

#### `agencies` — JSONB contact block

`contact_info` (JSONB holding phone/email) → `agency_contacts` child.

#### `programs` — multi-valued / document-schema columns

`fund_sources` (TEXT[]), `required_documents` (JSONB) → child tables.
`approval_workflow`, `form_template` are **document/configuration schema** — flagged, kept
(see §6).

#### `irf_cases` — embedded person JSONB

`item_a_reporting_person`, `item_b_person_reported` (JSONB) — embedded person snapshots.
Candidate: reference `persons` with nullable FKs, or keep as legal-record snapshot (see §6).

#### `access_card_services`

`agency` (TEXT) duplicates the `agency_id` FK → drop `agency`.

### 3.3 Summary counts

- Tables already 3NF / structurally sound: ~16
- Tables with genuine violations needing decomposition: `persons`, `users`, `beneficiaries`,
  `beneficiary_roles` (dedup), `households`, `cases`, `referrals`, `agencies`, `programs`,
  `irf_cases` (candidate), `access_card_services`

## 4. Target normalized schema

New / modified tables (deltas from current). Existing 3NF tables are unchanged.

### 4.1 `persons`

Keep: `id`, `surname`, `first_name`, `middle_name`, `extension`, `gender`, `dob`,
`place_of_birth`, `civil_status`, `occupation`, `search_vector` (kept, flagged).

Remove (moved to child tables): `address`, `current_address`, `provincial_address`,
`phone`, `email`, `age` (derived — compute on read).

#### NEW `person_contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid FK → persons | indexed |
| `contact_type` | varchar | `phone`, `email`, `messenger`, ... |
| `value` | text | |
| `is_primary` | boolean | nullable |

#### NEW `person_addresses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid FK → persons | indexed |
| `address_type` | varchar | `current`, `permanent`, `work` |
| `barangay` | varchar | |
| `city` | varchar | |
| `province` | varchar | |
| `postal` | varchar | nullable |
| `is_primary` | boolean | nullable |
| `raw` | text | optional legacy free-form capture |

*(Replaces `address` TEXT and `current_address` / `provincial_address` JSONB.)*

### 4.2 `users`

Keep: `id`, `email`, `password`, `role`, `person_id`, `pending_person_id`,
`person_link_code`, `person_link_code_expires_at`, `is_active`, `device_id`,
`mfa_secret`, `mfa_enabled`, `token_version`, `email_verified`, `agency_id`.

Remove: `full_name`, `phone`, `assigned_barangay`, `permitted_barangays`, and the seven
token columns (moved to child tables).

#### NEW `user_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | indexed |
| `purpose` | varchar | `email_verification`, `password_reset`, `change_email` |
| `token` | text | |
| `expires_at` | timestamp | nullable |
| `created_at` | timestamp | |

*(Replaces `verification_token`/`_expires_at`, `reset_token`/`_expires_at`,
`new_email`/`new_email_token`/`new_email_token_expires_at`.)*

#### NEW `user_barangay_assignments`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | indexed |
| `barangay` | varchar | |
| `is_primary` | boolean | nullable |

*(Replaces `assigned_barangay` + `permitted_barangays`.)*

### 4.3 `beneficiaries` + `beneficiary_roles` dedup

`beneficiaries` keeps: `id`, `person_id`, `user_id`, `household_id`, `hash`, `prev_hash`.
Removes duplicate: `access_card_code`, `consent_status`, `category` (owned by
`beneficiary_roles`).

`beneficiary_roles` becomes the single owner of: `person_id`, `household_id`, `user_id`,
`consent_status`, `access_card_code`, `category`. (No structural change — it already holds
them; only the duplicate copies in `beneficiaries` are removed.)

### 4.4 `households`

Keep: `id`, `primary_beneficiary_id`, `barangay`, `verified_by`, `verified_at`.
Remove: `estimated_income` (derived — flag for keep-or-drop in §6), `access_card_code` (dup).

### 4.5 `cases` → decompose multi-valued attributes

Keep scalar workflow columns only: `id`, `control_no`, `beneficiary_id`, `status`,
`assigned_worker_id`, `problems_presented`, `social_worker_assessment`, `client_category`,
`interviewed_by`, `client_signature`, `self_reliance_plan`, `follow_up_date`, `exit_notes`,
`sustainability_plan`, `transition_date`, `closure_outcome`, `closure_date`,
`follow_up_visits` (as INTEGER scalar), `frva_score`, `swdi_score`, `family_dialogue_notes`,
`self_reliance_level`, `certificate_url`, `petty_cash_voucher_url`,
`approved_by_signature`, `approved_by_role`, `hash`, `prev_hash`.

Remove: `service_requested`, `nature_of_service`, `requirements_checklist`,
`financial_subsidies`, `other_assistance`, `referrals`, `amount_assistance`,
`mode_financial_assistance`, `source_of_fund`, `legislator_specify`, `assigned_worker_name`.

**Decomposition destinations:**

- **REUSE `case_interventions`** (already 3NF) for services/financial aid:
  `service_requested`/`nature_of_service` → `case_interventions.service_name`; financial
  columns → `case_interventions.amount` / `mode_of_delivery` / `fund_source`. `other_assistance`
  → its own row with `category='other'`/notes.
- **NEW `case_requirements`**: from `requirements_checklist` JSONB keys.
- **NEW `case_referrals`**: from `referrals` JSONB (status/notes) — distinct from git
  `referrals` (barangay coordinator intake) and `inter_agency_referrals`.
- `assigned_worker_name` → dropped (derivable via `assigned_worker_id` → `users`/`persons`).

#### NEW `case_requirements`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `case_id` | uuid FK → cases | indexed |
| `requirement_key` | varchar | from `requirements_checklist` keys |
| `met` | boolean | value |

#### NEW `case_referrals`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `case_id` | uuid FK → cases | indexed |
| `agency` | varchar | nullable |
| `status` | varchar | |
| `notes` | text | nullable |
| `created_at` | timestamp | |

### 4.6 `referrals`

Keep workflow columns: `id`, `coordinator_id`, `barangay`, `reason`, `status`,
`decline_reason`, `case_id`.
Add `person_id` (uuid FK → persons, nullable) for the referred person.
Remove embedded person copy: `surname`, `first_name`, `middle_name`, `extension`, `gender`,
`dob`, `address`, `phone`.

### 4.7 `agencies`

Keep: `id`, `code`, `name`, `type`, `is_active`.
Remove: `contact_info` (JSONB).

#### NEW `agency_contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `agency_id` | uuid FK → agencies | indexed |
| `contact_type` | varchar | `phone`, `email`, `fax`, ... |
| `value` | text | |
| `is_primary` | boolean | nullable |

### 4.8 `programs`

Keep: `id`, `name`, `category`, `waiting_period_days`, `legal_basis`, `form_version`,
`is_active`, `form_template`, `approval_workflow` (both flagged intentional).
Remove multi-valued: `fund_sources` (TEXT[]), `required_documents` (JSONB).

#### NEW `program_fund_sources`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `program_id` | uuid FK → programs | indexed |
| `name` | varchar | |

#### NEW `program_required_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `program_id` | uuid FK → programs | indexed |
| `document_key` | varchar | |
| `mandatory` | boolean | value |

### 4.9 `irf_cases` (candidate)

`item_a_reporting_person` / `item_b_person_reported` (JSONB) are legal-record snapshots.
Superseded by optional `person_id`-style FKs is **flagged for confirmation** — see §6
decision record. If normalized, introduce nullable `reporting_person_id` /
`person_reported_id` FKs → `persons`; otherwise keep the JSONB snapshot (legal snapshots are
commonly exempted as intentional denormalization).

### 4.10 `access_card_services`

Drop `agency` (TEXT) — duplicate of `agency_id` FK.

### 4.11 Entity impact list (TypeORM)

- **Modified entities:** `person`, `user`, `beneficiary`, `household`, `case`, `referral`,
  `agency`, `program`, `irf-case`, `access-card-service`.
- **New entities:** `PersonContact`, `PersonAddress`, `UserToken`, `UserBarangayAssignment`,
  `CaseRequirement`, `CaseReferral`, `AgencyContact`, `ProgramFundSource`,
  `ProgramRequiredDocument`.
- **Unchanged entities (3NF):** `household-membership`, `beneficiary-claimant`,
  `beneficiary-role`, `case-history`, `case-intervention`, `form-version-history`,
  `notification`, `notification-preference`, `consent-ledger`, `otp`, `sync-queue`,
  `version-vector`, `csr`, `chat`, `physical-file`, `inter-agency-referral`, `base`.

## 5. Migration plan (TypeORM)

Spec-only: describes the source→target mapping and SQL approach per migration. Actual
`.ts` migration files are produced at implementation time (writing-plans → execute), added
under `kapwa-server/src/database/migrations/`, run by the existing TypeORM `DataSource`
bootstrap in `kapwa-server/src/database/migrate.ts`.

All migrations are **data-preserving and additive-first**: create child table → backfill
from parent columns (INSERT … SELECT) → then (after review) drop deprecated columns.

| # | Migration | Source ↓ → Target | Backfill technique |
|---|---|---|---|
| M1 | Address/contact split | `persons.address`/`current_address`/`provincial_address` → `person_addresses`; `persons.phone`/`email` → `person_contacts` | Parse composite/JSONB blocks; `INSERT … SELECT` one row per entry; drop originals after backfill. |
| M2 | Derived cleanup | `persons.age` → compute | No data migration — drop column; derive `dob` at read time. |
| M3 | User tokens | `users.verification_*`/`reset_*`/`new_email_*` → `user_tokens` | `INSERT … SELECT` per token (non-null); drop columns. |
| M4 | User barangays | `users.assigned_barangay` + `permitted_barangays` → `user_barangay_assignments` | Unnest array → one row per barangay; drop columns. |
| M5 | Beneficiary dedup | remove dup `access_card_code`/`consent_status`/`category` from `beneficiaries` (owner = `beneficiary_roles`) | `UPDATE` sync then `ALTER … DROP COLUMN`. |
| M6 | Household cleanup | drop `estimated_income` (pending §6), `access_card_code`; fix `verified_by` | Drop / alter type. |
| M7 | Case decomposition | `cases.service_requested`/`nature_of_service`/financial cols → `case_interventions` (reuse); `requirements_checklist` → `case_requirements`; `referrals` JSONB → `case_referrals` | `jsonb_array_elements`/`unnest` to row-per-value; INSERT into children. |
| M8 | Scalar fix | `cases.follow_up_visits` JSONB → INTEGER | Cast; drop JSONB. |
| M9 | Referral person link | `referrals.surname…phone` → link to `persons` | Match/create `persons` row; add `person_id`; drop embedded columns. |
| M10 | Agency contacts | `agencies.contact_info` → `agency_contacts` | `jsonb_each/INSERT`; drop block. |
| M11 | Program children | `programs.fund_sources`/`required_documents` → child tables | Unnest/`jsonb_each`; drop columns. |
| M12 | Misc scalar | `access_card_services.agency` drop | Drop column. |
| M13 | (Candidate) IRF person FKs | `item_a/b` JSONB → FKs or keep | Decision-dependent; see §6. |

Dependency order: M1 → M2 before anything referencing person; M3/M4 independent;
M5→M6; M7→M8; M9..M13 mostly independent. Each child table gets a FK + index on the
parent FK column.

## 6. Intentional denormalizations / flagged decisions

Kept as-is (documented, acknowledged deviation from strict 3NF):

1. `persons.search_vector` — derived FTS column (perf). **Keep.**
2. `cases`/`programs.form_template`, `approval_workflow`, `irf.key_wraps` — document /
   configuration schema, not relational data. **Keep JSONB.**
3. `programs.required_documents` → normalized per §4.8 (addressed), but the *document
   definitions* themselves remain JSONB templates.

Open decisions for user confirmation during planning:

- **D1:** `persons.estimated_monthly_income` with occupation — keep on `persons` (single
  temporal value) vs. move to a `person_incomes` history child. Default: keep on `persons`.
- **D2:** `households.estimated_income` — derived; **drop** (compute from members) vs.
  **keep** cached for means-testing perf. Recommend: keep (read-heavy, recompute on member
  change) — flagged as acknowledged derived column.
- **D3:** `irf_cases.item_a_reporting_person` / `item_b_person_reported` — convert to
  `persons` FKs vs. keep as legal-record JSONB snapshots. Recommend: **keep as snapshot**
  (legal record immutability), out of relational scope.
- **D4:** `referrals` embedded person → link to `persons` (add `person_id` FK) vs. keep the
  copy. Recommend: link to `persons` (M9). Confirms row-atom with existing
  `inter_agency_referrals.person_id` pattern.
- **D5:** `beneficiaries.hash`/`prev_hash` and `cases.hash`/`prev_hash` — integrity hashes;
  keep (not derived from schema, and intentional).
- **D6:** `age` — confirmed drop (computed from `dob`) per §4.1.

## 7. Impact / risk notes (for future implementation waves)

- Client (kapwa-client) front-ends read flattened DTOs via `@Expose()` getters on the
  entities (see `beneficiaries` note in data dictionary). Reworking entity columns therefore
  touches the **service/DTO layer**, not necessarily the client UI — DTOs must preserve the
  existing response shape to avoid breaking 500+ client tests.
- Every altered entity requires a corresponding entity-file edit + a new migration in the
  existing `kapwa-server/src/database/migrations/` numbering scheme.
- This document is the **schema design only**; controller/API/client changes are NOT
  specified here and are out of scope for this deliverable per decision.

## 8. Cross-references

- `docs/diagrams/06-erd.md` (entity clusters C1–C9)
- `docs/diagrams/07-data-dictionary.md` (32 tables, column specs)
- `docs/superpowers/specs/2026-07-21-person-schema-redesign.md` (unified person model;
  `beneficiary_roles` ownership)
- `kapwa-server/src/database/migrations/` (TypeORM migrations)
- `kapwa-server/src/database/migrate.ts` (TypeORM `DataSource` bootstrap)
- `kapwa-server/src/**/*.entity.ts` (29 entities)
