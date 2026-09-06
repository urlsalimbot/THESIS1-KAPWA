# Database Performance Audit — Design (Perf Wave)

Date: 2026-09-06
Status: Approved
Scope: kapwa-server query/index performance hardening. Wave 3 schema normalization planned separately via gsd-plan-phase after this lands.

## Context

Static audit of `kapwa-server` surfaced genuine per-parent N+1 query patterns, missing indexes on hot lookup paths, and one pagination/filter correctness bug in the cases list. Live EXPLAIN profiling was deferred (only if a suspicious query survives static review).

Existing state that is **already correct** and must not be touched:
- `pg_trgm` extension boot order (created in `migrate.ts` before the trigram GIN indexes `idx_person_name_trgm`, `idx_beneficiary_category_trgm`, `idx_person_search`). Fresh boot works.
- `persons.search_vector` + GIN index + maintenance trigger exist; person `ILIKE '%x%'` search is index-backed via `gin_trgm_ops`.

## 1. Index migration — `DatabasePerfIndexes0000000000054`

New TypeORM migration (sequential 13-digit key `…0000000000054`) + mirrored idempotent `CREATE INDEX IF NOT EXISTS` statements in `src/database/migrate.ts` (canonical fresh-boot bootstrap). All `CREATE INDEX IF NOT EXISTS`.

| # | Index | Table | Rationale |
|---|-------|-------|-----------|
| 1 | `idx_inter_referral_from` | inter_agency_referrals(from_agency_id) | agency links list |
| 2 | `idx_inter_referral_to` | inter_agency_referrals(to_agency_id) | inbound agency queue |
| 3 | `idx_inter_referral_status` | inter_agency_referrals(status) | status-filtered lists |
| 4 | `idx_inter_referral_person` | inter_agency_referrals(person_id) | person referral history |
| 5 | `idx_inter_referral_case` | inter_agency_referrals(case_id) | case referral chain |
| 6 | `idx_case_history_case` | case_history(case_id) | per-case timeline lookup |
| 7 | `idx_cases_worker` | cases(assigned_worker_id) | worker dashboard, chat worker scoping |
| 8 | `idx_cases_beneficiary` | cases(beneficiary_id) | `getAssignedWorkerIds` (chat), case-by-beneficiary |
| 9 | `idx_cases_status_created` | cases(status, created_at) | SLA sweep, status lists ordering |
| 10 | `idx_sync_device_idemp` | sync_queue(device_id, idempotency_key) | per-change dedupe in processDelta |
| 11 | `idx_sync_device` | sync_queue(device_id) | device delta backlog |
| 12 | `idx_irf_created` | irf_cases(created_at) | IRF list ordering |
| 13 | `idx_acs_agency_date` | access_card_services(agency_id, service_date) | service history by agency+date |
| 14 | `idx_acs_intervention` | access_card_services(intervention_id) | intervention→services |
| 15 | `idx_acs_code` | access_card_services(access_card_code) | code lookup |

Validation: spin disposable PG (`pg_ctl -D /tmp/opencode/kapwa-pg/data`, port 5433), apply the index SQL in isolation, verify index present, stop.

## 2. Batch N+1 fixes

### 2.1 chat.service.ts — `getConversations` (per-conversation user lookup)
Current: per unique conversation `userRepo.findOne({ where: { id: otherId } })` → O(conversations) DB round trips.
Fix: collect `otherIds` from deduped conversations, single `userRepo.find({ where: { id: In(otherIds) } })`, resolve via Map (fallback `otherId.slice(0,8)` preserved).

### 2.2 sync.service.ts
- `processDelta` dedupe: replace per-change `queueRepo.findOne({ where: { idempotencyKey: change.id, deviceId } })` with one `queueRepo.find({ where: { idempotencyKey: In(changeIds), deviceId } })` → Map by idempotencyKey. Semantics unchanged (`applied` short-circuit preserved).
- `updateVersionVectors`: replace findOne+save/create loop with a single bulk upsert:
  `INSERT INTO version_vectors (device_id, table_name, local_version, server_version, last_synced_at, created_at, updated_at) VALUES … ON CONFLICT (device_id, table_name) DO UPDATE SET server_version = GREATEST(version_vectors.server_version, EXCLUDED.server_version), last_synced_at = NOW(), updated_at = NOW()`.
  `version_vectors` already has `UNIQUE (device_id, table_name)`. Then one re-select of device vectors to build the returned array.

### 2.3 sla.service.ts — `checkAndEscalate` / `createAlert`
Current: `createAlert` re-queries all admins (`SELECT id FROM users WHERE role='admin' AND is_active=TRUE`) **per case**, then inserts one notification per admin per case.
Fix: query admins once; accumulate all alert notification rows across the three status loops; one bulk `notifRepo.save([...])`. Same message/recipient/referenceId/category content.

### 2.4 notifications.service.ts — `bulkSetPreferences`
Replace per-pref `findOne`+save loop with single `find({ where: { userId } })`, Map upsert, one save.

### 2.5 inter-agency-referrals.service.ts — `notifyAgency`
Replace per-staff `notifService.create` with one bulk `notifRepo.save(staff.map(...))`.

## 3. Correctness alignment — `cases.service.ts findAll` filters

Bug: `sla`, `ageRange`, `category` filters were applied in-memory **after** `skip/take` pagination → wrong page semantics.

- `ageRange` → SQL on `person.dob` date bounds (0-17 / 18-59 / 60+).
- `category` → SQL `:cat = ANY(c.service_requested)` (TEXT[]).
- `sla` → computed over the sla-relevant candidate set (statuses `enrolled`, `in_review`, `active`) without pagination, then paginated in memory; `total` reflects the sla-filtered count. When no sla filter, pagination stays in SQL as today. `slaOverdue` remains attached to every result case.

## 4. Verification

- `npm run typecheck` (server) — clean
- `npm run lint` (server) — clean
- `npx jest --silent` — full suite (51 suites / ~411 tests) green; chat/sync/sla/notifications/inter-agency specs updated for new mock shapes
- New index SQL validated against disposable Postgres in isolation
- Live EXPLAIN only if a query path is still suspicious after static fixes

## 5. Out of scope → Wave 3 (planned via gsd-plan-phase)

- eager → explicit relations surgery (person/case/beneficiary/program/agency/referral eager loads cost extra per-find SELECTs)
- search switch from ILIKE to `search_vector` full-text (already indexed; ILIKE is trgm-backed, low priority)
- remaining getter-column decomposition (beneficiary 19 getters, referral 8, case 9)
- irf_cases listing rewrite

## Risks / Notes

- Index migration must stay green under **both** boot paths (`migrate.ts` and the 54-file TypeORM chain). `CREATE INDEX IF NOT EXISTS` order-independent after table creation; migration placed at end of chain.
- `version_vectors` upsert relies on existing UNIQUE constraint — do not add index-only semantics; verify with disposable PG.
- SLA bulk-save changes `createAlert` from per-case insert to deferred batch; notification ordering within a run is insertion-order preserved.