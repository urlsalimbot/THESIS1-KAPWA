# Auto-Assign Intake Worker + Case Header Cleanup — Design

**Date:** 2026-08-27
**Status:** Approved by user (2026-08-27; rule: the logged-in user is ALWAYS the assigned worker)
**Scope:** kapwa-server intake module (auto-assign) + kapwa-client CaseViewPage header (remove two rows).

## Problem

After a successful intake, the case view header shows empty placeholder rows. Root causes:

1. **No auto-assignment of the case worker.** `IntakeService.submitIntake` (`intake.service.ts:178`) and `confirmMatch` (`intake.service.ts:472`) set `assignedWorkerId` only from `data.case.assignedWorkerId`; the client submits `case: {}`, so every new case has no assigned worker. The controller never passes the authenticated user into these service calls.
2. **Header rows that never belong there.** `CaseViewPage`'s case-info grid renders Certificate URL and Petty Cash Voucher rows that are always `—` in the header (those values live in the documents/closure area).

## Changes

### Server — kapwa-server/src/intake/

- `intake.controller.ts`:
  - `submitIntake`: add `@Request() req: AuthenticatedRequest` and call `this.intakeService.submitIntake(body, req.user.id)`.
  - `confirmMatch`: pass `req.user.id` as a 4th argument to `this.intakeService.confirmMatch(householdId, body, permittedBarangays, req.user.id)`.
- `intake.service.ts`:
  - `submitIntake(data: IntakeInput, callerId: string)` — set `assignedWorkerId: callerId` (ALWAYS the logged-in user; any payload value is ignored per user decision).
  - `confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[], callerId: string)` — same: `assignedWorkerId: callerId` in the create-case branch.
- `intake.service.spec.ts`:
  - Extend `submitIntake` tests: assert the created case carries `assignedWorkerId = callerId`.
  - Extend `confirmMatch` create-case test: assert `assignedWorkerId = callerId`.

### Client — kapwa-client/src/pages/CaseViewPage.tsx

- In the case-info grid (around lines 257-287), remove the **Certificate URL** row (`caseData.certificateUrl`) and the **Petty Cash Voucher** row (`caseData.pettyCashVoucherUrl`).
- Keep: Service Requested (populates as the case develops), Assigned Worker (now auto-filled), Approved By, Remarks.
- No i18n key changes (`cases.certificateUrl`, `cases.pettyCashVoucher` are used elsewhere — e.g., the closure step).

## Explicitly NOT changing

- The intake form (no new service-requested capture — Service Requested fills as the case develops).
- `submitBatchFamily` (does not create a case).
- i18n keys / locales.

## Verification

- Server: `npx jest src/intake/intake.service.spec.ts --silent` + `npm run typecheck` (from `kapwa-server/`).
- Client: `npm run test:run` + `npm run typecheck` (from `kapwa-client/`).