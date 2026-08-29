# Schema Normalization to 3NF — Wave 2: Drop + Rewire (API-Preserving)

Status: Design (approved 2026-08-29)
Predecessor: `docs/superpowers/specs/2026-08-28-schema-normalization-3nf-design.md` (Wave 1 design)
Wave 1 delivered the **additive** half (new child tables, backfills, legacy columns kept). This is the **destructive** half: drop the deprecated legacy columns, rewire the server to read/write the new child tables, and add database-level foreign-key constraints — while keeping the public API response shapes byte-identical so `kapwa-client` and the existing 500+ client tests are untouched.

## 1. Goal & non-goals

**Goal:** Finalize the schema to genuine 3NF by removing the duplicated scalar/JSONB legacy columns (M1–M12 drop halves) and routing all persistence through the normalized child tables, with real FK constraints.

**Non-goals (explicitly out of scope):**
- No change to the **public API response shape**. `@Expose()` getters reproduce the flattened shape clients already consume.
- No `kapwa-client` changes, no breaking API contract changes.
- No new features; this is pure normalization of storage + server rewrite.
- D3 IRF JSONB snapshots retained (legal records) — no migration. D5 integrity hashes retained. D2 `households.estimated_income` retained as cached/derived.

## 2. Approach

One cohesive implementation plan (like Wave 1) with ordered domain tasks. Each task, for its domain:

1. **Rewrite service write paths** to persist into the child tables (create/update points).
2. **Add `@Expose()` read getters** (or adjust existing ones) on the affected entities so the DTO surface stays identical — assembling the flattened shape from the join to child tables + parent row.
3. **Verify backfill completeness** of Wave-1 child data; **purge orphans** (child rows whose parent no longer exists).
4. **Drop migration**: `ALTER TABLE ... DROP COLUMN IF EXISTS ...` for the now-unused legacy columns (`20260829*` numbering).
5. **Constraint migration**: `ALTER TABLE ... ADD CONSTRAINT fk_... FOREIGN KEY ... REFERENCES ...` on each child-table parent FK (after orphan cleanup).

Dependency ordering matters: **persons is upstream** (beneficiaries/referrals/cases join to it; M1/M2 drop person columns). Domain order below.

## 3. Migration plan (Wave 2 drops)

Applies the drop halves of the Wave-1 migration table M1–M12, plus FK constraints. No code duplication — each domain migration is independent and ordered only by person-upstream.

| Task (domain) | Legacy drops (M-halves) | Child reads added | FK constraint added |
|---|---|---|---|
| **Persons** | `persons.address`, `current_address`, `phone`, `email`, `age` (M1, M2) | `person_contacts`, `person_addresses`; `age` computed from `dob` (getter) | `person_contacts.person_id`, `person_addresses.person_id` |
| **Users** | `users.verification_*`, `reset_*`, `new_email_*`, `assigned_barangay`, `permitted_barangays` (M3, M4) | `user_tokens`, `user_barangay_assignments` | `user_tokens.user_id`, `user_barangay_assignments.user_id` |
| **Beneficiary + Household** | `beneficiaries.category`, `consent_status`; `households.access_card_code` (M5, M6; `households.estimated_income` **kept** per D2) | `beneficiary_roles` (+ `@Expose()` from persons/household) | `beneficiary_roles.beneficiary_id` (+ existing membership FKs) |
| **Cases** | `cases.requirements_checklist`, `referrals` JSONB, financial cols, `follow_up_visits` JSONB→INTEGER (M7, M8) | `case_requirements`, `case_referrals`, `case_assistances` | `case_requirements.case_id`, `case_referrals.case_id`, `case_assistances.case_id` |
| **Referrals** | `referrals.surname`, `first_name`, `middle_name`, `extension`, `gender`, `dob`, `address`, `phone` (M9, D4) | resolve/join `persons` via `person_id` | `referrals.person_id` |
| **Agency + Program + Misc** | `agencies.contact_info`; `programs.fund_sources`, `required_documents`; `access_card_services.agency` (M10, M11, M12) | `agency_contacts`, `program_fund_sources`, `program_required_documents` | `agency_contacts.agency_id`, `program_fund_sources.program_id`, `program_required_documents.program_id` |

**Retained (no drop):** persons `search_vector` (FTS), `estimated_monthly_income` + `occupation` (D1), `households.estimated_income` (D2 cached, interpreted as read-only recomputed), `irf_cases.item_a/item_b` (D3), `beneficiaries.hash`/`prev_hash` + `cases.hash`/`prev_hash` (D5), document/config JSONB (`cases`/`programs.form_template`, `approval_workflow`, `irf.key_wraps`).

## 4. API-shape preservation mechanism

The `Beneficiary` entity already exemplifies the pattern: `@Expose() get surname()` reads `this.person?.surname`. Wave 2 generalizes this across all affected entities:

- **Read getters** assemble the old flattened shape from child tables + parent. E.g.:
  - `Person.get address()` → first `person_addresses.address` row; `get phone()` → first `person_contacts.phone`.
  - `User.get assignedBarangay()` / `get permittedBarangays()` → from `user_barangay_assignments`.
  - `Referral.get surname()/firstName()/dob()/...` → from joined `person`.
  - `Program.get fundSources()/requiredDocuments()` → from `program_fund_sources`/`program_required_documents` (reassembled to the former array shapes).
  - `Agency.get contactInfo()` → from `agency_contacts`.
  - `Case.get requirementsChecklist()/referrals()/followUpVisits()` → from child tables / cast.
- **Service write paths** persist into child tables while accepting the same DTO inputs, so controllers are unchanged: create/update now create/update child rows alongside (or instead of) the removed columns.

This is a **read/getter + write/service** pairing per entity; both must change together or the drop breaks compilation and tests. TypeORM relations (`OneToMany` on the parent → child) are added to support the getters.

## 5. Task breakdown & dependency order

Single plan, tasks ordered by upstream-first:

1. **Persons** (M1+M2) — upstream, unblock everything joining to persons.
2. **Users** (M3+M4).
3. **Beneficiary + Household** (M5+M6).
4. **Cases** (M7+M8) + fix `case_assistance.amount` decimal typing.
5. **Referrals** (M9+D4).
6. **Agency + Program + Misc** (M10+M11+M12).
7. **Verification** — typecheck + full server suite + live-DB migration/FK smoke + final whole-branch review.

Each coding task delivers: entities updated (+ `@Expose()` getters / `OneToMany`), service write-path rewrite, drop migration, FK constraint migration, and a test proving (a) writes persist to child tables and (b) the read path returns the identical flattened shape.

## 6. Data integrity / backfill verification

Before dropping a legacy column and adding its FK:
- Confirm the Wave-1 backfilled child table is complete for existing rows (count comparison against source, where feasible).
- Purge orphans: `DELETE FROM child WHERE parent_id NOT IN (SELECT id FROM parent)` — required before adding the `FOREIGN KEY` constraint.
- Add the FK constraint in a `NOT VALID`-tolerant sequence if a full table scan is a concern (small dataset here — apply directly).

## 7. Testing & verification strategy

- **Per-task TDD**: service unit/integration tests asserting (1) create/update writes the child table rows and nulls/removes legacy columns, (2) read paths return the unchanged flattened shape (regression guard), (3) FK constraint accepts valid parent links and (in a negative test) rejects orphan insertion.
- **Full-wave**: `npm run typecheck` (PASS), full jest suite (all existing tests green — proves no client-visible DTO break), live-DB migration smoke running the drop + constraint migrations against a scratch database.
- **Final gate**: whole-branch review across the plan base→HEAD (same subagent-driven reviewer as Wave 1).

## 8. Impact / risks

- **Compilation coupling**: a dropped column or a removed entity property will fail `tsc` across any reading service. Tasks must convert readers in the same task that drops the column. This is why "rewire service → verify → drop → FK" is a single task.
- **DTO shape drift**: any `@Expose()` getter that does not reproduce the prior shape exactly will break client tests silently; the per-task regression test is the guard.
- **Referrals → persons matching** (M9): embedding-vs-link changes meaning; Wave 1 already added `person_id`. Rewire to prefer `person_id` when present.
- **`case_assistance.amount`** (decimal → string at runtime, Wave-1 reviewer Minor): fix typing in the Cases task while the service is already being edited.

## 9. Cross-references

- `docs/superpowers/specs/2026-08-28-schema-normalization-3nf-design.md` (Wave 1 design; child-table schemas, D1–D6)
- `docs/superpowers/plans/2026-08-28-schema-normalization-3nf.md` (Wave 1 plan, committed)
- `kapwa-server/src/**/*.entity.ts`, `.service.ts`, `dto/*.zod.ts`
- `kapwa-server/src/database/migrations/` (Wave-1 `20260828*` migrations; Wave-2 `20260829*`)
