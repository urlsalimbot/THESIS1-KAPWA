# 06-04-SUMMARY: Mayor Aggregate Reports + Auditor Consent Ledger + Claimant Access Card

## What Was Built

1. **Mayor aggregate endpoint** — `GET /dashboard/reports/mayor` returns zero-PII aggregate data (fundUtilization, uniqueHouseholds, caseStatusDistribution, totalCases, slaCompliance, servedToday). Mayor removed from `@Roles()` on existing `GET /dashboard` and `GET /dashboard/metrics` to prevent PII exposure.

2. **Auditor consent ledger** — `GET /audit/consent-ledger` returns consent records with optional `beneficiaryId` filter. New `AuditService.getConsentLedger()` method.

3. **Claimant Access Card endpoint** — `GET /beneficiaries/me/access-card` returns card code, beneficiary info, and service log. New `BeneficiariesService.getAccessCard(userId)` method.

4. **Three new frontend pages** — MyAccessCardPage (read-only card view with print), MayorReportsPage (6 aggregate stat cards), AuditorPage (hash chain verification + consent ledger with tabs).

5. **Routes, nav, API** — `/my-access-card` (claimant), `/reports` (mayor), `/audit-logs` (auditor). Nav items per role. Access Card link on ClaimantDashboardPage.

## Files Changed

| File | Change |
|------|--------|
| `kapwa-server/src/dashboard/dashboard.controller.ts` | Add `GET /dashboard/reports/mayor`; remove mayor from existing @Roles() |
| `kapwa-server/src/audit/audit.controller.ts` | Add `GET /audit/consent-ledger` |
| `kapwa-server/src/audit/audit.service.ts` | Add `getConsentLedger()` |
| `kapwa-server/src/beneficiaries/beneficiaries.controller.ts` | Add `GET /beneficiaries/me/access-card` |
| `kapwa-server/src/beneficiaries/beneficiaries.service.ts` | Add `findByUserId()`, `getAccessCard()` |
| `kapwa-client/src/pages/MyAccessCardPage.tsx` | NEW: read-only Access Card display |
| `kapwa-client/src/pages/MayorReportsPage.tsx` | NEW: aggregate-only reports |
| `kapwa-client/src/pages/AuditorPage.tsx` | NEW: hash chain + consent ledger |
| `kapwa-client/src/pages/ClaimantDashboardPage.tsx` | Add Access Card link |
| `kapwa-client/src/routes.tsx` | Add 3 new routes |
| `kapwa-client/src/components/Layout.tsx` | Add 3 nav items |
| `kapwa-client/src/lib/api.ts` | Add 4 API functions |

## Tests

229 server tests pass. Client builds clean.
