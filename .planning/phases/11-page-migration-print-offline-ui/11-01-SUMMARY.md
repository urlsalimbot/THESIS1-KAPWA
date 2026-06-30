---
phase: 11-page-migration-print-offline-ui
plan: 01
type: execute
wave: 1
status: complete
commits:
  - 477c9f4 — test(11-01): add failing tests for PageShell cachedAt, SyncQueuePanel, ConflictResolutionDialog
  - 7c49eea — feat(11-01): add global A4 print stylesheet with 20mm margins, running footers, .no-print enforcement
  - 8727aeb — feat(11-01): implement PageShell cachedAt prop, useCacheStaleness hook, SyncStatusBanner
  - b9bd861 — feat(11-01): implement SyncQueuePanel, ConflictResolutionDialog, Layout integration
completion: Complete
tasks_completed: 4
tasks_total: 4
---

# Plan 11-01: Foundation — Global Infrastructure

**Status:** Complete ✅

## What was built

### Task 0: Wave 0 test scaffolds (TDD)
- PageShell.test.tsx updated with `cachedAt` prop test cases (OFF-03)
- SyncQueuePanel.test.tsx: empty state, pending/failed/conflict item tests (OFF-02)
- ConflictResolutionDialog.test.tsx: diff display, resolve button tests (OFF-02/DIF-02)

### Task 1: Global print stylesheet
- `@media print` block with A4 portrait, 20mm margins, 12pt serif base
- `.no-print` enforcement for layout chrome
- Chromium running headers/footers with `counter(page/pages)`
- `.signature-block` with `break-inside-avoid`, `.page-break` utility
- Beforeprint listener in main.tsx sets `--print-date` CSS variable

### Task 2: PageShell + cache staleness + SyncStatusBanner
- `PageShell` `cachedAt` prop — shows "Cached data — last sync X min ago" with Clock icon
- `useCacheStaleness` hook — 5 min threshold (D-17), 30s polling, formatted age
- `SyncStatusBanner` — amber offline banner, blue online+pending banner, clickable to open queue

### Task 3: SyncQueuePanel + ConflictResolutionDialog + Layout
- `SyncQueuePanel` — shadcn Sheet, 2s polling, items grouped by status, retry/resolve/remove
- `ConflictResolutionDialog` — shadcn Dialog, diff preview, Keep Local/Server/Both (D-12)
- `Layout.tsx` — inline offline banner replaced with SyncStatusBanner, SyncQueuePanel added, `.no-print` on chrome

## Test Results
- **24 test files, 118 tests — all passing**
- All PageShell, SyncQueuePanel, and ConflictResolutionDialog tests pass
- No regressions in existing tests

## Commit History
1. `477c9f4` — test scaffolds (TDD red)
2. `7c49eea` — print stylesheet (green)
3. `8727aeb` — PageShell + hook + SyncStatusBanner (green)
4. `b9bd861` — SyncQueuePanel + ConflictResolutionDialog + Layout (green)
