# Phase 4 — Access Card System — Context

## Prerequisites
- Phase 3 (Intervention Tracking) complete — ABAC guard pipeline, FSM lifecycle, offline sync protocol, MinIO

## Current State (Pre-Phase)
- Module scaffolded: module, controller, service, entity, DTO, spec
- `generateCode()` → `NORZ-AC-YYYY-####` via `access_card_seq`
- `logService()` creates entry in `access_card_services`
- `findByCard()` queries by card code
- Client page with generate, log, search UI
- DB: `access_card_services` table, `access_card_code` on beneficiaries, `access_card_seq` sequence
- Entity has unused `interventionId` column

## Decisions (6/22/2026)

### D-01: Card Assignment Flow
**One-step generate-and-assign.** Admin picks beneficiary → system generates code and attaches it to that beneficiary. No standalone generation.

### D-02: 18-row Physical Card Refill
**Digital-first, print-on-demand.** No physical card version tracking. Digital service log is the source of truth. All 18+ rows live in DB; card is printed when needed with whatever rows exist.

### D-03: No Card = No Voucher Enforcement
**Soft warning with override.** When `createIntervention` detects beneficiary has no card, API returns a warning but does not block. Worker can proceed.

### D-04: Loss/Replacement
**Reprintable with identity verification.** Code stays permanently tied to beneficiary. No replacement workflow — reprint existing card after verifying claimant identity.

### D-05: Auto-append (INT-07)
**DEFERRED — needs stakeholder discussion.** `interventionId` column exists in entity but no logic wired.

### D-06: Print Format
**Browser print dialog.** No PDF generation. Card view renders as printable page.

## Dependencies & Cross-References
- `interventions.service.ts` — needs No Card warning guard
- `access_card_code` on `beneficiaries` table — assignment target
- `beneficiaries.service.ts` — lookup by ID for assignment
- Sync protocol (Phase 3) — card assignment and log must be offline-capable

## Integration Points
- Interventions module: soft-warning check at `createIntervention`
- Sync module: card operations should follow same offline pattern as Phase 3
- Beneficiaries module: assignment links to beneficiary record
