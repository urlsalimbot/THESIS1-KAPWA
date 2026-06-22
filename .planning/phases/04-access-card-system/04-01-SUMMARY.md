---
phase: 04-access-card-system
plan: 01
subsystem: access-cards
tags: access-cards, generate-and-assign, card-assignment, findBeneficiaryCard, SERIALIZABLE-transaction, beneficiary-page
requires:
  - phase: 03-intervention-tracking-case-management
    provides: Case entity, CaseStatus enum, existing InterventionsService/Controller
  - phase: 04-00
    provides: scaffolded module with generateCode, logService, findByCard, entity, spec
provides:
  - generateAndAssign(beneficiaryId) transactional method with SERIALIZABLE isolation
  - POST /access-cards/assign/:beneficiaryId endpoint (admin-only)
  - findBeneficiaryCard(beneficiaryId) query
  - GET /access-cards/beneficiary/:id/card endpoint (admin, social_worker)
  - assignCard(), getBeneficiaryCard() client API functions
  - Rewritten AccessCardPage with assign workflow (no standalone generate)
  - BeneficiaryViewPage Access Card section with assign/print/reprint buttons
affects:
  - 04-02 (print view — depends on GET /beneficiary/:id/card endpoint)
tech-stack:
  added: []
  patterns:
    - SERIALIZABLE transaction with QueryRunner (analogous to CasesService.generateControlNo)
    - ParseUUIDPipe validation on beneficiaryId param
    - AbacGuard guard pipeline (matching CasesController pattern)
    - Client identity verification via window.confirm for reprint flow
key-files:
  created:
    - kapwa-server/src/access-cards/access-cards.service.ts
    - kapwa-server/src/access-cards/access-cards.controller.ts
    - kapwa-client/src/pages/AccessCardPage.tsx
  modified:
    - kapwa-server/src/access-cards/access-cards.service.spec.ts
    - kapwa-client/src/lib/api.ts
    - kapwa-client/src/pages/BeneficiaryViewPage.tsx
decisions:
  - "Switched controller from RolesGuard to AbacGuard pipeline to match CasesController pattern"
  - "generateAndAssign uses QueryRunner with SERIALIZABLE isolation to prevent race conditions"
  - "Removed standalone POST /generate endpoint per D-01"
  - "Reprint identity verification uses window.confirm per D-04 (physical office workflow)"
duration: ~15min
completed: 2026-06-22
status: complete
---

# Phase 4 Plan 1: Generate & Assign Access Card

**Refactored scaffolded module from standalone code generation to one-step generate-and-assign per D-01. Added beneficiary card lookup, client assign workflow, and reprint-with-identity buttons on beneficiary detail page.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-22T16:20:00Z
- **Completed:** 2026-06-22T16:35:00Z
- **Tasks:** 3
- **Files modified/created:** 6

## Accomplishments

### Task 1 (TDD RED): Failing tests for generateAndAssign and findBeneficiaryCard
- Added `describe('generateAndAssign')` with 2 tests (format + atomicity) — fail because methods don't exist
- Added `describe('findBeneficiaryCard')` with 2 tests (success + NotFound) — fail because methods don't exist
- Existing generateCode/logService/findByCard tests unchanged

### Task 2 (GREEN): Server — refactor service + controller for one-step assign
- **Service:** Replaced `generateCode()` with `generateAndAssign(beneficiaryId)` using SERIALIZABLE transaction via QueryRunner. Added `findBeneficiaryCard(beneficiaryId)` query that fetches beneficiary data + service log.
- **Controller:** Removed `POST /generate`, added `POST /assign/:beneficiaryId` (admin-only, ParseUUIDPipe), added `GET /beneficiary/:id/card` (admin + social_worker). Switched from RolesGuard to AbacGuard guard pipeline matching CasesController.
- **Spec:** Updated all 7 tests passing with proper QueryRunner mock.

### Task 3: Client — assign workflow, beneficiary page buttons, reprint verification
- **api.ts:** Added `assignCard()` and `getBeneficiaryCard()` API functions.
- **AccessCardPage.tsx:** Removed standalone "Generate New Code" section. Added beneficiary UUID input for one-step assign. Added card lookup section with Print button. Kept service log table and log form.
- **BeneficiaryViewPage.tsx:** Added `accessCardCode` to BeneficiaryDetail interface. Shows "Generate & Assign Access Card" button when no card. Shows card code (font-mono, #2E5C8A) + Print/Reprint buttons when card exists. Reprint uses `window.confirm()` with beneficiary name and card code for identity verification. Green success banner on assign.

## Verification Results

| Check | Result |
|-------|--------|
| `cd kapwa-server && npx jest --no-coverage --force-exit access-cards` | ✅ All 7 tests pass |
| `cd kapwa-client && npx vite build` | ✅ Build succeeds (1791 modules) |
| Server tests (all access-cards) | ✅ PASS (7/7) |
| Client build | ✅ Build succeeds |

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | TDD RED: failing tests for generateAndAssign and findBeneficiaryCard | `8faf054` | test(04-01) |
| 2 | Server: implement generateAndAssign, findBeneficiaryCard, refactor controller (GREEN) | `cf5ab27` | feat(04-01) |
| 3 | Client: assignCard API, AccessCardPage rewrite, BeneficiaryViewPage card section | `6443e3d` | feat(04-01) |

## Files Created/Modified

- `kapwa-server/src/access-cards/access-cards.service.ts` — generateAndAssign() with SERIALIZABLE transaction, findBeneficiaryCard() query
- `kapwa-server/src/access-cards/access-cards.controller.ts` — POST /assign/:id, GET /beneficiary/:id/card, removed POST /generate, AbacGuard pipeline
- `kapwa-server/src/access-cards/access-cards.service.spec.ts` — 7 tests (generateAndAssign format+atomicity, findBeneficiaryCard success+notfound, logService, findByCard, defined)
- `kapwa-client/src/lib/api.ts` — assignCard(), getBeneficiaryCard() functions
- `kapwa-client/src/pages/AccessCardPage.tsx` — Rewritten: assign workflow (no standalone generate), card lookup, print button, service log table
- `kapwa-client/src/pages/BeneficiaryViewPage.tsx` — accessCardCode interface field, assign/print/reprint buttons, identity verification via window.confirm

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NotFoundException test assertion mismatch**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** The test used `.rejects.toThrow('NotFoundException')` but the actual error message from NestJS `NotFoundException` is `'Beneficiary has no Access Card'`. The `toThrow()` matcher checks the message property, not the class name.
- **Fix:** Changed assertion to match on the actual error message: `.rejects.toThrow('Beneficiary has no Access Card')`
- **Files modified:** `access-cards.service.spec.ts`
- **Verification:** Test now passes (6→7 passing)
- **Committed in:** `cf5ab27` (Task 2 commit)

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep — standard test assertion fix.

## Known Stubs

None — all features fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_api_route | access-cards.controller.ts | POST /access-cards/assign/:beneficiaryId — new admin-only endpoint that creates card sequence + updates beneficiary in SERIALIZABLE transaction |
| threat_flag: new_api_route | access-cards.controller.ts | GET /access-cards/beneficiary/:id/card — new endpoint exposing beneficiary card data (name, code, service log) to authenticated workers |

Both flagged routes are covered by the existing threat model (T-04-01: Tampering mitigated by @Roles('admin') + SERIALIZABLE transaction; T-04-02: Information Disclosure mitigated by @Roles('admin', 'social_worker') + existing AbacGuard).

## Privacy & Security Notes

- `POST /assign/:beneficiaryId` is admin-only (`@Roles('admin')`) per D-01
- `GET /beneficiary/:id/card` is admin + social_worker only
- Both endpoints are behind JwtAuthGuard + AbacGuard pipeline
- Identity verification for reprint uses `window.confirm()` — physical office workflow per D-04
- No new personal data collected — card codes are sequential identifiers, not secrets

---

*Plan: 04-01*
*Completed: 2026-06-22*
