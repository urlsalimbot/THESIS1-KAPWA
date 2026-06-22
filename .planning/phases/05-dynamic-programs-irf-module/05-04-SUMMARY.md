---
phase: 05-dynamic-programs-irf-module
plan: 04
subsystem: irf-module
status: complete
tags:
  - export
  - pdf
  - json
  - pdfkit
  - legal-basis
  - audit
  - tdd
requires:
  - 05-CONTEXT.md (D-14 through D-16)
  - 05-03 (IRF encryption, masking, FSM, IrfAuditService)
  - pdfkit 0.19 (already in dependencies)
provides:
  - AES password-protected PDF export via pdfkit
  - Structured WCPD-EXPORT-v1 JSON export bundle
  - Legal basis code validation at export time
  - Audit trail for every export operation (EXPORT_PDF / EXPORT_JSON)
  - Export endpoints at GET /irf/:id/export-pdf and GET /irf/:id/export-json
  - Export buttons in IrfPage and IrfDetailPage
affects: []
tech-stack:
  added: ["IrfExportService", "pdfkit userPassword AES-128"]
  patterns:
    - "PDF generation via pdfkit with userPassword/ownerPassword (D-14)"
    - "Audit-first pattern — logAccess() called before returning export data (D-15)"
    - "Legal basis code validated and logged at export time (D-16)"
key-files:
  created:
    - kapwa-server/src/irf/irf-export.service.ts
    - kapwa-server/src/irf/irf-export.service.spec.ts
  modified:
    - kapwa-server/src/irf/irf.controller.ts
    - kapwa-server/src/irf/irf.module.ts
    - kapwa-client/src/lib/api.ts
    - kapwa-client/src/pages/IrfPage.tsx
    - kapwa-client/src/pages/IrfDetailPage.tsx
decisions:
  - "Export uses IrfService.exportWcpd() as data source for both PDF and JSON formats"
  - "PDF password is optional (defaults to 'default') — client sends empty string fallback"
  - "require('pdfkit') used instead of ES import for compatibility with NestJS CommonJS resolution"
  - "Export buttons in IrfPage modal replace single WCPD Export button with PDF + JSON + Cancel"
metrics:
  duration: "~1 min"
  tasks: 3
  test_count: 9
  files_created: 2
  files_modified: 5
---

# Phase 5 Plan 4: IRF Secure Export (PDF + JSON) & Audit — Summary

**One-liner:** Built the IRF export subsystem with AES password-protected PDF generation via pdfkit and structured JSON export bundles, both requiring legal_basis_code validation and logged to the audit trail before returning data. Added export buttons to IrfPage and IrfDetailPage.

## Tasks Executed

### Task 1 (RED): Failing tests
Created `kapwa-server/src/irf/irf-export.service.spec.ts` with 9 test cases covering:
- exportPdf returns Buffer with valid legalBasis
- exportPdf calls exportWcpd and auditMock.logAccess
- exportPdf throws ForbiddenException without legalBasis
- exportPdf throws NotFoundException when IRF not found
- exportJson returns structured JSON with format: 'WCPD-EXPORT-v1'
- exportJson logs audit entry with EXPORT_JSON action
- exportJson throws ForbiddenException without legalBasis
- exportJson throws NotFoundException when IRF not found

Tests failed as expected (RED) because IrfExportService didn't exist.

### Task 2 (GREEN): Backend implementation
- **IrfExportService**: Implementation with exportPdf() and exportJson() methods
  - exportPdf: validates legalBasis, loads data via IrfService.exportWcpd(), audits via IrfAuditService, then generates AES password-protected PDF with case info, parties, narration, signatures, and legal basis footer
  - exportJson: validates legalBasis, loads data, audits, then returns structured WCPD-EXPORT-v1 JSON bundle
  - Both methods follow audit-first pattern (log BEFORE returning data)
- **IrfAuditService**: Already had EXPORT_PDF and EXPORT_JSON action types (from 05-03)
- **IrfController**: Added GET :id/export-pdf and GET :id/export-json endpoints with @Roles('admin', 'social_worker')
- **IrfModule**: Registered IrfExportService in providers and exports
- All 9 tests pass (GREEN)

### Task 3 (GREEN): Frontend implementation
- **api.ts**: Added exportIrfPdf() and exportIrfJson() API functions
- **IrfPage.tsx**: Updated export modal — added PDF password input field, replaced single Export button with Export PDF and Export JSON buttons, added Cancel button
- **IrfDetailPage.tsx**: Added Export section with legal basis code input, PDF password input, and PDF/JSON export buttons
- Client builds without errors

## Deviations from Plan

None — all tasks executed as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | 9f012a7 — `test(05-04): add failing tests for IRF PDF and JSON export` | ✓ |
| GREEN (backend) | acdebce — `feat(05-04): implement IrfExportService with PDF/JSON export and controller routes` | ✓ |
| GREEN (frontend) | e9ed1b2 — `feat(05-04): add export buttons for PDF and JSON to IRF pages` | ✓ |

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | irf.controller.ts | export-pdf and export-json endpoints with @Roles protection |
| threat_flag: new-service | irf-export.service.ts | PDF generation with AES password protection, legal basis validation, audit-first pattern |

## Self-Check: PASSED

- [x] Test file exists: kapwa-server/src/irf/irf-export.service.spec.ts
- [x] All 9 tests pass
- [x] irf-export.service.ts created with exportPdf and exportJson
- [x] irf.controller.ts updated with export endpoints
- [x] irf.module.ts registers IrfExportService
- [x] Client api.ts updated with export functions
- [x] IrfPage.tsx updated with PDF/JSON export modal
- [x] IrfDetailPage.tsx updated with export section
- [x] Client builds without errors
- [x] Commit 1 (RED): 9f012a7 — test commit
- [x] Commit 2 (GREEN backend): acdebce — impl commit
- [x] Commit 3 (GREEN frontend): e9ed1b2 — impl commit
