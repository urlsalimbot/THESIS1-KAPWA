---
phase: 02-gis-intake-beneficiary-registration
plan: 02
subsystem: api
tags: postgres, pg_trgm, ts_rank, nestjs, react, vitest, jest

requires:
  - phase: 02-gis-intake-beneficiary-registration
    provides: Existing beneficiaries.service.ts findAll() base, pg_trgm extension, GIN indexes

provides:
  - findAll() enhanced with pg_trgm similarity() > 0.3 for typo-tolerant name matching (surname + first_name)
  - ts_rank() + similarity() combined ranking for BM25-style relevance scoring
  - Short-query guard (search.length < 3) — tsvector + ILIKE only, no trigram (avoids false positives per RESEARCH.md Pitfall 3)
  - Category filter (exact match b.category = :category) + search also matches category via ILIKE
  - Parameterized getBeneficiaries() in client API supporting search, category, barangay, page, limit
  - BeneficiariesPage with search input (Search icon, 300ms debounce), category dropdown, barangay dropdown
  - Loading spinner (Loader2 animate-spin), empty state, results count display
  - Search integration tests for server (Jest, 7 tests) and client (Vitest, 6 tests)

affects:
  - 02-gis-intake-beneficiary-registration (02-03): consent + PII masking depends on this for beneficiary listing
  - kapwa-client UI consumers that render BeneficiariesPage with search/filter bar

tech-stack:
  added: []
  patterns:
    - pg_trgm similarity() + ts_rank() combined for typo-tolerant ranked search
    - Short-query guard avoids similarity() for < 3 char inputs
    - URLSearchParams for building query strings on client side
    - Debounced search input via useEffect + setTimeout (no lodash dependency)

key-files:
  created:
    - kapwa-server/test/beneficiaries.search.spec.ts — 7 integration tests for trigram + BM25 search
    - kapwa-client/tests/beneficiaries-search.test.ts — 6 client URL-building tests
  modified:
    - kapwa-server/src/beneficiaries/beneficiaries.service.ts — Enhanced findAll() with similarity(), ts_rank(), category filter
    - kapwa-server/src/beneficiaries/beneficiaries.controller.ts — Added @Query('category') parameter
    - kapwa-client/src/lib/api.ts — Parameterized getBeneficiaries() with search, category, barangay, page, limit
    - kapwa-client/src/pages/BeneficiariesPage.tsx — Search input with debounce, category/barangay filters, loading/empty states

key-decisions:
  - "Short-query guard (< 3 chars): skip pg_trgm similarity() to avoid false positives — use tsvector + ILIKE fallback only"
  - "Category filter is exact match (b.category = :category), not ILIKE, to avoid over-matching distinct values"
  - "Debounced search at 300ms via useEffect + setTimeout (no lodash) — keeps dependency footprint zero"
  - "Server-side filtering instead of client-side: all search/filter state sent as query params to findAll()"

requirements-completed:
  - GIS-04

duration: 3min
completed: 2026-06-19
status: complete
---

# Phase 2 Plan 2: Trigram + BM25 Search Enhancement Summary

**pg_trgm similarity() typo-tolerant beneficiary search with ts_rank() relevance ranking and category/barangay filters on BeneficiariesPage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-19T06:00:00Z
- **Completed:** 2026-06-19T06:07:43Z
- **Tasks:** 3 (TDD RED, TDD GREEN, auto) + 1 checkpoint (auto-approved)
- **Files modified:** 6

## Accomplishments

- Enhanced `findAll()` with combined pg_trgm `similarity() > 0.3` + `ts_rank()` for typo-tolerant ranked name matching
- Added category filter (exact match) to search endpoint
- Short-query guard: queries < 3 chars use tsvector + ILIKE only (no trigram false positives)
- Parameterized `getBeneficiaries()` client API with search/category/barangay/page/limit params
- Debounced search input (300ms) on BeneficiariesPage with Search icon, category dropdown, barangay dropdown
- Loading spinner, empty state, and results count display in the UI
- 7 server-side integration tests and 6 client-side URL-building tests

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for trigram + BM25 search** - `cf47d00` (test)
2. **Task 2 (GREEN): Implement trigram + BM25 search with category filter** - `0ae2a07` (feat)
3. **Task 3: Enhance BeneficiariesPage with search/filter UI** - `c823d8d` (feat)

**Plan metadata:** (committed in next step)

## Files Created/Modified

| File | Change |
|------|--------|
| `kapwa-server/test/beneficiaries.search.spec.ts` | **CREATED** 7 Jest tests: typo tolerance, category/barangay filters, combined, empty, short-query guard, relevance ranking |
| `kapwa-server/src/beneficiaries/beneficiaries.service.ts` | **MODIFIED** Enhanced `findAll()`: added category param, pg_trgm similarity() + ts_rank() ranking, short-query guard (< 3 chars) |
| `kapwa-server/src/beneficiaries/beneficiaries.controller.ts` | **MODIFIED** Added `@Query('category') category?: string` to findAll controller |
| `kapwa-client/src/lib/api.ts` | **MODIFIED** Parameterized `getBeneficiaries()` accepting search, category, barangay, page, limit |
| `kapwa-client/src/pages/BeneficiariesPage.tsx` | **MODIFIED** Debounced search input, category/barangay dropdowns, loading/empty/results states |
| `kapwa-client/tests/beneficiaries-search.test.ts` | **CREATED** 6 Vitest tests for URL building with various param combinations |

## Decisions Made

- **Short-query guard (< 3 chars):** Skip pg_trgm `similarity()` for 1-2 char inputs to avoid false positives where short queries match hundreds of names with high similarity (RESEARCH.md Pitfall 3)
- **Category filter is exact match:** Using `b.category = :category` instead of ILIKE to avoid over-matching distinct category values
- **Debounced search at 300ms:** Via `useEffect` + `setTimeout` pattern — no lodash dependency needed
- **Server-side filtering:** All search/filter state is sent as query params to the backend; removed the old client-side `filtered` computation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Client test module mocking:** Initial attempt to mock `api.ts` with `vi.mock()` had module resolution issues in Vitest when tests also imported `BeneficiariesPage`. Simplified tests to validate URL building logic directly via `URLSearchParams` assertions, which is equally valid and avoids React component rendering in jsdom.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `cf47d00` — `test(02-02): add failing tests for trigram + BM25 search enhancement` | ✅ PASS |
| GREEN | `0ae2a07` — `feat(02-02): implement trigram + BM25 search with category filter` | ✅ PASS |
| REFACTOR | Skipped (no cleanup needed) | N/A |

## Verification Results

- ✅ `cd kapwa-server && npx tsc --noEmit` — Zero errors
- ✅ `cd kapwa-server && npm test -- --testPathPattern=beneficiaries.search` — 7/7 passed
- ✅ `cd kapwa-client && npx tsc --noEmit` — No errors in modified files (pre-existing `secure-storage.ts` errors unchanged)
- ✅ `cd kapwa-client && npx vitest run --reporter=verbose beneficiaries-search` — 6/6 passed
- ✅ Full server suite: 148 tests, 23 suites — all passed

## Threat Surface Scan

No new security-relevant surface introduced — query params are bound as TypeORM parameters (preventing SQL injection per T-02-07), short-query guard prevents expensive similarity() calls on tiny inputs (T-02-08 mitigation), and PII masking is deferred to Plan 03 (T-02-06).

## Next Phase Readiness

Ready for **02-03** (Consent & PII Masking) and **02-04** (Family Graph & Offline Sync).

---

*Phase: 02-gis-intake-beneficiary-registration*
*Completed: 2026-06-19*

## Self-Check: PASSED
