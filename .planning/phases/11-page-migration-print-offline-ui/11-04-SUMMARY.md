---
phase: 11-page-migration-print-offline-ui
plan: 11-04
subsystem: kapwa-client
tags: [page-shell, css-cleanup, index.css, shadcn-ui]
depends_on: [11-01, 11-02, 11-03]
provides: []
affects:
  - src/pages/AuditorPage.tsx
  - src/pages/CoordinatorDashboardPage.tsx
  - src/pages/IntakePage.tsx
  - src/pages/IrfDetailPage.tsx
  - src/pages/MayorReportsPage.tsx
  - src/pages/MyAccessCardPage.tsx
  - src/pages/ProgramsPage.tsx
tech-stack:
  added: [PageShell]
  patterns: [PageShell wrapping, shadcn migration]
key-files:
  created: []
  modified:
    - src/pages/IntakePage.tsx
    - src/pages/AuditorPage.tsx
    - src/pages/CoordinatorDashboardPage.tsx
    - src/pages/MayorReportsPage.tsx
    - src/pages/MyAccessCardPage.tsx
    - src/pages/IrfDetailPage.tsx
    - src/pages/ProgramsPage.tsx
decisions:
  - ProgramsPage retains legacy CSS patterns (btn, form-input, form-group) -- deferred to future plan
metrics:
  duration_seconds: 0
  completed_date: 2026-06-30
status: complete
---

# Phase 11 Plan 04: Final Sweep -- PageShell & Legacy CSS Migration Summary

**Goal:** Final sweep to convert ALL remaining internal pages in src/pages/ to use PageShell, remove stray index.css imports, replace legacy page-header/page-title/page-desc classes with PageShell props, and eliminate text-text-primary/font-sans tailwind classes.

## Results

### Pages Migrated (7 total)

| # | Page | Changes | Lines |
|---|------|---------|-------|
| 1 | IntakePage.tsx | Removed index.css, added PageShell with title/description/actions (offline badge), replaced text-text-primary/font-sans classes | 341 |
| 2 | AuditorPage.tsx | Added PageShell, replaced page-header/page-title/page-desc | 175 |
| 3 | CoordinatorDashboardPage.tsx | Added PageShell, replaced page-header/page-title/page-desc | 156 |
| 4 | MayorReportsPage.tsx | Added PageShell (2 return paths: error + main), replaced page-header/page-title/page-desc | 84 |
| 5 | MyAccessCardPage.tsx | Added PageShell (2 return paths: error + main), replaced page-header/page-title/page-desc | 108 |
| 6 | IrfDetailPage.tsx | Added PageShell wrapper with dynamic title | 229 |
| 7 | ProgramsPage.tsx | Removed index.css, added PageShell, replaced page-header; legacy form classes retained | 1049 |

### Issue Resolution

- index.css imports eliminated: 2 remaining removals (IntakePage, ProgramsPage)
- page-header/page-title/page-desc eliminated: 7 instances across 5 pages
- text-text-primary/font-sans eliminated: 5 instances in IntakePage
- All 22 internal pages now use PageShell (6 public/landing/auth pages intentionally excluded)

### Verification

- TypeScript compilation: No new errors introduced
- Test suite: 39 files, 164 tests -- all passed
- Balance check: All PageShell open/close tags balanced across all pages

## Deviations from Plan

### Rule 2 -- Auto-add missing critical functionality

**Removed stray index.css imports from 2 pages that were missed in prior migrations:**
- IntakePage.tsx: Had import '../index.css' -- removed
- ProgramsPage.tsx: Had import '../index.css' -- removed

**Wrapped 5 pages missing PageShell that were not in the original 16-page target list:**
- AuditorPage, CoordinatorDashboardPage, MayorReportsPage, MyAccessCardPage, IrfDetailPage

## Known Stubs

### ProgramsPage.tsx -- Legacy form patterns retained
The ProgramsPage (1049 lines) uses extensive legacy CSS patterns that were not part of this migration scope:

| Pattern | Count | Description |
|---------|-------|-------------|
| btn btn-primary | 5 | Old button styling |
| btn btn-secondary | 2 | Old secondary button |
| form-input | 17 | Old form input styling |
| form-group | 12 | Old form group layout |
| form-label | 6 | Old form label styling |
| form-select | 1 | Old select styling |

These are deferred because the file is large and the form system needs a coordinated shadcn migration (architectural scope).

## Next Steps

1. Migrate ProgramsPage legacy form classes to shadcn/ui components (Button, Input, Label, etc.)
2. Consider migrating public pages (AboutPage, LandingPage, etc.) if unified PageShell is desired

## Self-Check: PASSED

- All 7 modified page files exist and are syntactically valid
- Commit feff4b2 verified in git log
- All 39 test files pass (164/164 tests)
