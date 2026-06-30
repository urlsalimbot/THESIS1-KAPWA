---
phase: 11-page-migration-print-offline-ui
plan: 02
type: execute
wave: 2
status: partial
commits:
  - 1824ec3 — feat(11-02): migrate DashboardPage to shadcn/PageShell with regression test
  - 4cd031a — feat(11-02): migrate BeneficiariesPage, BeneficiaryViewPage to shadcn/PageShell with tests
completion: Partial (IntakePage not migrated)
tasks_completed: 3
tasks_total: 4
---

# Plan 11-02: Dashboard + Beneficiary Pages

**Status:** Partial ✅ (IntakePage remaining)

## What was built

### DashboardPage (Task 1) ✅
- Migrated to `PageShell` with `title`, `description`, `actions` props
- Stat cards use shadcn `Card/CardContent`
- DataTable for recent cases with shadcn `Badge`
- Removed legacy `PageSection`, `page-header`, `page-title`, `page-desc` classes
- Uses `CardGridSkeleton`, `TableSkeleton`, `EmptyState`
- Regression test: heading, stat cards, case table

### BeneficiariesPage (Task 2) ✅
- Migrated to `PageShell` with `DataTable`, `TableSkeleton`, `EmptyState`
- Search input (shadcn `Input`) with Search icon
- Category filter dropdown
- Status badges using shadcn `Badge` variants
- Regression tests: heading, mock data, search input

### BeneficiaryViewPage (Task 3) ✅
- Migrated to `PageShell` with detail card layout
- Profile card, Access Card section, personal info grid
- Active cases + interventions panels
- Case Tracker Log, Family Composition, Family Graph, Consent Manager sections
- Fixed hooks ordering (useCallback moved before early returns)
- Regression tests: heading, beneficiary name, Access Card code

### IntakePage (Task 4) ❌ Not migrated
- Still uses legacy `index.css`, no `PageShell`, no shadcn form components
- 341 lines of legacy structure

## Test Results
- **3 test files, 7 tests — all passing**
- All migrated page tests pass
- Uncaught error in ConsentManager child component (pre-existing, non-blocking)

## Commit History
1. `1824ec3` — DashboardPage + test
2. `4cd031a` — BeneficiariesPage + BeneficiaryViewPage + tests
