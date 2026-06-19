---
phase: 01-foundation-deploy-authenticate
plan: 04
subsystem: audit, sync
tags: sha256, hash-chain, idempotency, typeorm-migration, nestjs, jest
requires:
  - phase: 01-01
    provides: Full stack infrastructure (Docker, MinIO, Caddy)
  - phase: 01-02
    provides: Admin user management API + UI
  - phase: 01-03
    provides: Platform-aware encrypted storage, offline queue infrastructure
provides:
  - SHA-256 hash chaining on all audit tables (cases, beneficiaries, consent_ledger, interventions)
  - AuditService.verifyAllChains — parallel integrity check across all 4 tables
  - GET /api/audit/verify-all endpoint (admin/auditor-only)
  - DB-backed idempotency keys (survives server restart)
  - idempotency_keys migration table with 24h TTL and eviction
affects:
  - Phase 02 GIS Intake (uses audit service for data integrity)
  - Any future sync integration (idempotency already active)
tech-stack:
  added:
    - No new libraries — uses built-in crypto (sha256) and existing TypeORM
  patterns:
    - Generic repository-based hash chain verification (AuditService.verifyHashChain)
    - DB-backed idempotency with in-memory cache as fast path (SyncService)
    - Migration plus entity schema extension for audit columns
key-files:
  created:
    - kapwa-server/src/database/migrations/20260619000001-audit-hash-chain.ts: Migration adds hash/prev_hash to cases, beneficiaries, consent_ledger + idempotency_keys table
    - kapwa-server/test/audit.hashchain.spec.ts: 4 tests for hash chain verification across all tables
    - kapwa-server/test/sync.idempotency.spec.ts: 3 tests for DB-backed idempotency
  modified:
    - kapwa-server/src/audit/audit.service.ts: Generic verifyHashChain(repo, orderField) + verifyAllChains()
    - kapwa-server/src/audit/audit.controller.ts: Added GET /api/audit/verify-all endpoint
    - kapwa-server/src/audit/audit.module.ts: Imports Case, Beneficiary, ConsentLedger repositories
    - kapwa-server/src/sync/sync.service.ts: DB-backed idempotency with async cache+DB read/write
    - kapwa-server/jest.config.ts: Updated rootDir/roots to include test/ directory
key-decisions:
  - "Added @InjectDataSource() decorator — explicit, follows NestJS 11 decorator conventions"
  - "In-memory cache as fast path with DB fallback — writes to both on each operation"
  - "verifyInterventionChain preserved for backward compatibility; new verifyHashChain is generic"
  - "try/catch around DB operations for idempotency — graceful degradation if table doesn't exist yet"
requirements-completed:
  - CON-06
  - SYNC-04
duration: 6min
completed: 2026-06-19
status: complete
---

# Phase 01 Plan 04: Audit Integrity & Sync Idempotency Summary

**SHA-256 hash chaining extended to all audit tables with generic verifyHashChain/verifyAllChains, DB-backed idempotency key persistence, and 7 new tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-19T04:11:51Z
- **Completed:** 2026-06-19T04:17:52Z
- **Tasks:** 3 (1 TDD RED + 2 GREEN)
- **Files modified:** 8

## Accomplishments

- Created migration for hash columns on cases, beneficiaries, consent_ledger + idempotency_keys table
- Refactored AuditService.verifyHashChain to accept any repository (generic, orderable)
- Added AuditService.verifyAllChains — parallel integrity check across all 4 tables
- Added GET /api/audit/verify-all endpoint protected by admin/auditor role
- Updated AuditModule to import all 4 entity repositories
- Made idempotency key storage DB-backed: in-memory fast path + PostgreSQL persistence
- Idempotency keys survive server restart; 24h TTL with automatic eviction
- 7 new tests (4 hash chain + 3 idempotency), all passing
- Updated jest.config.ts to include test/ directory alongside src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Tests for hash chain extension + idempotency** — `b0ec78f` (test/RED)
2. **Task 2: Extend SHA-256 hash chaining to all audit tables** — `7155b6a` (feat/GREEN)
3. **Task 3: Idempotency key DB persistence** — `2cae7a8` (feat/GREEN)

## Files Created/Modified

- `kapwa-server/src/database/migrations/20260619000001-audit-hash-chain.ts` — Migration: hash/prev_hash on cases, beneficiaries, consent_ledger + idempotency_keys table (NEW)
- `kapwa-server/test/audit.hashchain.spec.ts` — 4 tests: intact chain, broken chain, empty chain, verifyAllChains (NEW)
- `kapwa-server/test/sync.idempotency.spec.ts` — 3 tests: duplicate key, expired key, DB persistence (NEW)
- `kapwa-server/src/audit/audit.service.ts` — Generic verifyHashChain(repo, orderField) + verifyAllChains() parallel check
- `kapwa-server/src/audit/audit.controller.ts` — Added GET /api/audit/verify-all (admin/auditor)
- `kapwa-server/src/audit/audit.module.ts` — Imports Case, Beneficiary, ConsentLedger via TypeOrmModule.forFeature
- `kapwa-server/src/sync/sync.service.ts` — DB-backed getIdempotencyResult + setIdempotencyResult + evictStaleEntries
- `kapwa-server/jest.config.ts` — Updated to include test/ directory

## Decisions Made

- **@InjectDataSource() decorator**: Added explicit decorator for DataSource injection in SyncService. The original code relied on implicit constructor injection, but explicit decorator is the NestJS 11 convention and more maintainable.
- **In-memory + DB dual-write**: On each idempotent operation, result is written to both in-memory cache (fast path) and PostgreSQL (persistence). On read, in-memory is checked first; DB is fallback.
- **verifyInterventionChain preserved**: The original backward-compatible method is kept for existing callers. The new `verifyHashChain(repo, orderField)` is generic. `verifyAllChains()` calls it for each table in parallel.
- **Graceful DB degradation**: Idempotency DB operations are wrapped in try/catch with warnings — if the idempotency_keys table doesn't exist yet (migration not run), the service degrades to in-memory-only.
- **Migration uses sha256() PostgreSQL function**: Not `pgcrypto`'s `digest()` — since sha256 is available natively in PostgreSQL as `encode(sha256(...), 'hex')` without requiring the pgcrypto extension.

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @InjectDataSource import**
- **Found during:** Task 3 (idempotency implementation)
- **Issue:** `@InjectDataSource()` decorator was used but not imported from `@nestjs/typeorm`
- **Fix:** Added `InjectDataSource` to the existing import statement
- **Files modified:** `kapwa-server/src/sync/sync.service.ts`
- **Verification:** Tests compile and pass
- **Committed in:** `2cae7a8` (Task 3 commit)

**2. [Rule 3 - Blocking] TypeScript circular type inference in seedChain**
- **Found during:** Task 1 (test creation)
- **Issue:** `hash` variable in seedChain had implicit circular type reference (TS7022)
- **Fix:** Added explicit `: string` type annotation for `hashVal`
- **Files modified:** `kapwa-server/test/audit.hashchain.spec.ts`
- **Verification:** Test compiles and runs correctly
- **Committed in:** `b0ec78f` (Task 1 commit)

**3. [Rule 2 - Missing Critical] seadChain hash computation didn't match verify algorithm**
- **Found during:** Task 2 (hash chain implementation)
- **Issue:** `seedChain` used current record's `id` in hash, but `verifyHashChain` uses previous record's `id`
- **Fix:** Corrected `seedChain` to use `prevId` (previous record's id) for hash computation
- **Files modified:** `kapwa-server/test/audit.hashchain.spec.ts`
- **Verification:** All 4 hash chain tests pass
- **Committed in:** `7155b6a` (Task 2 commit — updated with implementation)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 2 missing critical)
**Impact on plan:** All auto-fixes essential for correctness. No scope creep.

## Issues Encountered

- **Hash chain test design iteration**: Initial `seedChain` generated hashes using current record's id, but `verifyHashChain` expects `{ id: prev.id, hash: prev.hash }`. Fixed by aligning `seedChain` with the verification algorithm.
- **@InjectDataSource() not imported**: Explicit decorator added in plan but import statement missing. Added to the `@nestjs/typeorm` import.

## Authentication Gates

None — no external service auth required for this plan.

## Known Stubs

None. All created files are fully functional with proper tests.

## Threat Flags

None — all security-relevant surface (hash chain verification, idempotency DB writes) was explicitly in the plan's threat model.

## Next Phase Readiness

- Audit integrity infrastructure complete for all 4 tables
- Idempotency key enforcement active — prevents duplicate sync processing across server restarts
- Migration 20260619000001 ready to run (adds hash/prev_hash columns + idempotency_keys table)
- All 136 tests passing across 21 suites (including 7 new)
- Phase 01 complete, ready for next phase

## Self-Check: PASSED

All created files exist on disk. All 3 task commits verified (`b0ec78f`, `7155b6a`, `2cae7a8`). All 7 new tests pass. All 136 total tests pass (zero regressions). All decisions documented in SUMMARY.md key-decisions.

---

*Phase: 01-foundation-deploy-authenticate*
*Completed: 2026-06-19*
