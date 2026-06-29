---
phase: 11-page-migration-print-offline-ui
status: complete
plans:
  - 11-01: Foundation — Global Print/Offline Infrastructure (Complete)
  - 11-02: Dashboard + Beneficiary Pages (Complete)
  - 11-03: Cases + Access Card + IRF Pages (Complete)
  - 11-04: Admin + Final Sweep (Complete)
commits: 19
tests: 164 passing across 39 files
---

# Phase 11: Page Migration, Print & Offline UI

**Status:** Complete ✅

## Summary

Migrated all 22 internal pages from legacy CSS (`index.css`, `page-header`, `page-title`, `page-desc`, `spinner`, `badge` classes) to shadcn/`PageShell` architecture. Implemented global A4 print stylesheet and offline UI infrastructure.

### What was built

#### Foundation (Plan 11-01)
- Global A4 print stylesheet with 20mm margins, running footers, `@media print`
- `PageShell` `cachedAt` prop + `useCacheStaleness` hook (5 min threshold, 30s polling)
- `SyncStatusBanner` — amber offline banner, blue online+pending states
- `SyncQueuePanel` — shadcn Sheet, items grouped by status, retry/resolve/remove
- `ConflictResolutionDialog` — diff preview, Keep Local/Server/Both

#### Pages Migrated (Plans 11-02, 11-03, 11-04)
| Plan | Pages |
|------|-------|
| 11-02 | DashboardPage, BeneficiariesPage, BeneficiaryViewPage, IntakePage |
| 11-03 | CasesPage, InterventionsPage, CaseTrackerPage, ApprovalPipelinePage, AccessCardPage, CsrPage, IrfPage |
| 11-04 | AdminPage, MfaSetupPage, FilingPage, MessagesPage, ClaimantDashboardPage |
| Sweep | AuditorPage, CoordinatorDashboardPage, MayorReportsPage, MyAccessCardPage, IrfDetailPage, ProgramsPage |

### Key outcomes
- **Zero** `import '../index.css'` in any page file
- **Zero** `page-header`, `page-title`, `page-desc`, `spinner`, `badge` legacy classes in pages
- All pages use `PageShell` with proper loading/empty states
- All data-fetching pages have skeleton loading states
- Print stylesheet handles A4 output with running headers/footers
- Offline banner + sync queue accessible from every page

Technical limitations: `ProgramsPage.tsx` retains ~41 legacy form class instances (e.g. `btn btn-primary`, `form-input`) — deferred to a future coordinated migration of the form system.

## Tests
- **164 tests passing, 39 test files**
- Each migrated page has regression tests
- Zero regressions from existing tests
- 1 pre-existing uncaught error in ConsentManager (non-blocking)

## Commits (19 total)
```
477c9f4 test(11-01): test scaffolds
7c49eea feat(11-01): print stylesheet
8727aeb feat(11-01): PageShell cachedAt + hook + SyncStatusBanner
b9bd861 feat(11-01): SyncQueuePanel + ConflictResolutionDialog + Layout
e79d93a docs(11-01): mark plan 01 complete
1824ec3 feat(11-02): DashboardPage
4cd031a feat(11-02): BeneficiariesPage + BeneficiaryViewPage
89c2b19 docs(11-02): mark plan 02 partial
c872f28 feat(11-03): CasesPage
772f1f8 feat(11-03): InterventionsPage
b09a7fc feat(11-03): CaseTrackerPage
d76ac30 feat(11-03): ApprovalPipelinePage
2ed0110 feat(11-03): AccessCardPage
8b847dd feat(11-03): CsrPage
b2e639e feat(11-03): IrfPage
3a270b0 docs(11-03): mark plan 03 complete
6b07c28-074f791 feat(11-04): 5 pages + final sweep + docs
```
