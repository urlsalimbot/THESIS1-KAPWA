---
phase: 05-dynamic-programs-irf-module
plan: 03
subsystem: irf-module
status: complete
tags:
  - encryption
  - pgcrypto
  - disposition-fsm
  - name-masking
  - audit
  - nestjs
  - react
requires:
  - 05-CONTEXT.md (D-08 through D-18)
  - pgcrypto extension (already enabled)
provides:
  - encrypted narration via pgcrypto AES-256-CBC
  - per-record AES-256 key wrap with master wrapping key
  - application-layer name masking with legal-basis unlock
  - 4-state disposition FSM (UI + API)
  - centralized audit logging for decrypt/unmask operations
  - IRF detail page with disposition timeline
affects: []
tech-stack:
  added: ["pgcrypto encrypt/decrypt", "audit_log table"]
  patterns:
    - "Server-side encryption via pgcrypto (D-08)"
    - "Simplified two-tier key scheme: master env key + per-record keys (D-09)"
    - "Application-layer name masking via IrfService (D-11)"
    - "Two-step legal-basis unlock with audit-first pattern (D-12)"
    - "Dedicated FSM endpoints per transition (D-17)"
    - "Admin override with mandatory reason (D-18)"
key-files:
  created:
    - kapwa-server/src/irf/irf-key.service.ts
    - kapwa-server/src/irf/irf-audit.service.ts
    - kapwa-server/src/database/migrations/20260622000005-IRFDispositionEncryption.ts
    - kapwa-client/src/pages/IrfDetailPage.tsx
    - kapwa-client/src/components/irf/NameMaskToggle.tsx
    - kapwa-client/src/components/irf/VictimNarrationField.tsx
  modified:
    - kapwa-server/src/irf/irf-case.entity.ts
    - kapwa-server/src/irf/dto/irf.zod.ts
    - kapwa-server/src/irf/irf.service.ts
    - kapwa-server/src/irf/irf.controller.ts
    - kapwa-server/src/irf/irf.module.ts
    - kapwa-client/src/lib/api.ts
    - kapwa-client/src/pages/IrfPage.tsx
    - kapwa-client/src/routes.tsx
decisions:
  - "IrfDisposition enum (5 states) replaces old string-based caseDisposition"
  - "pgcrypto encrypt()/decrypt() replaces Node.js crypto for all narration operations"
  - "Dedicated FSM endpoints (refer-pnp, refer-wcpd, dismiss, close) replace generic updateStatus"
  - "Audit_log table created with reference_id, user_id, action, details for IRF operations"
  - "Name masking applied in findAll() and findById() at the service layer"
  - "UnmaskNames requires legalBasis query param and logs audit entry before returning data"
  - "Admin overrideDisposition requires mandatory reason and admin role"
metrics:
  duration: "~45 min"
  tasks: 3
  test_count: 9
  files_created: 7
  files_modified: 8
---

# Phase 5 Plan 3: IRF Encryption, Name Masking & Disposition FSM — Summary

**One-liner:** Upgraded the IRF module with per-record AES-256 encryption via pgcrypto, a 4-state disposition FSM, application-layer name masking with two-step legal-basis unlock, centralized audit logging, and a new detail page.

## Tasks Executed

### Task 1 (RED): Failing tests
Created `kapwa-server/src/irf/irf.service.spec.ts` with 9 test cases covering:
- pgcrypto encryption during IRF creation
- Name masking in findAll (surname/firstName redacted)
- Decrypted narration with legalBasis (audit-first pattern)
- ForbiddenException when legalBasis missing
- FSM transitions: referToPnp, dismiss, close
- Invalid transition rejection

Tests failed as expected (RED) because the new services, enum, and methods didn't exist.

### Task 2 (GREEN): Backend implementation
Updated the IRF module with:
- **IrfDisposition enum**: UNDER_INVESTIGATION, REFERRED_TO_PNP, REFERRED_TO_WCPD, DISMISSED, CLOSED
- **IrfKeyService**: Master wrapping key management, per-record AES-256 key generation via `pgcrypto gen_random_bytes(32)`, key wrap/unwrap via Node.js crypto
- **IrfAuditService**: Centralized audit logging to `audit_log` table (created in migration)
- **IrfService**: Replaced Node.js crypto with pgcrypto `encrypt()`/`decrypt('aes-256-cbc/pad:pkcs')`, dedicated FSM methods, `unmaskNames()`, `overrideDisposition()`, name masking in findAll/findById
- **IrfController**: New endpoints: `PATCH :id/refer-pnp`, `PATCH :id/refer-wcpd`, `PATCH :id/dismiss`, `PATCH :id/close`, `PATCH :id/override-disposition`, `POST :id/decrypt`, `GET :id/unmask-names`
- **Migration**: Creates `audit_log` table, `irf_disposition` enum, migrates existing data with `IF EXISTS` guards
- All 9 tests pass (GREEN)

### Task 3 (GREEN): Client implementation
- **api.ts**: Added `getIrfCase`, `createIrf`, `referToPnp`, `referToWcpd`, `dismissIrf`, `closeIrf`, `decryptNarration`, `unmaskIrfNames`
- **IrfPage.tsx**: Added "View Details" link per row; migrated submit to use `createIrf` from api.ts
- **IrfDetailPage.tsx**: New detail page with disposition FSM timeline, name masking toggle, narration decryption workflow, case metadata
- **NameMaskToggle.tsx**: Two-step legal-basis unlock component
- **VictimNarrationField.tsx**: Encryption-aware textarea component
- **routes.tsx**: Added `/irf/:id` route
- Client builds without errors

## Deviations from Plan

None — all tasks executed as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | irf.controller.ts | Added 7 new endpoints with role protection via @Roles() |
| threat_flag: new-table | migration | audit_log table created — stores IRF access events |
| threat_flag: new-audit-path | irf-audit.service.ts | audit_log insert on every decrypt/unmask/override with legalBasis and userId |

## Self-Check: PASSED

- [x] Test file exists: kapwa-server/src/irf/irf.service.spec.ts
- [x] All 9 tests pass
- [x] Backend entity updated with IrfDisposition enum
- [x] irf-key.service.ts created with key management logic
- [x] irf-audit.service.ts created with audit logging
- [x] irf.service.ts updated with pgcrypto and FSM
- [x] irf.controller.ts updated with new endpoints
- [x] irf.module.ts updated with new services
- [x] Migration file created with audit_log table + irf_disposition enum
- [x] Client api.ts updated with IRF functions
- [x] IrfPage.tsx updated with View Details link
- [x] IrfDetailPage.tsx created
- [x] NameMaskToggle.tsx component created
- [x] VictimNarrationField.tsx component created
- [x] routes.tsx updated with IRF detail route
- [x] Client builds without errors
- [x] Commit 1 (RED): 198ece1 — test commit
- [x] Commit 2 (GREEN backend): 674fde5 — impl commit
- [x] Commit 3 (GREEN frontend): 49e48c6 — impl commit

## TDD Gate Compliance

- RED gate: test(05-03) commit exists at 198ece1 ✓
- GREEN gate: feat(05-03) commit exists at 674fde5 ✓
- GREEN gate: feat(05-03) commit exists at 49e48c6 ✓
