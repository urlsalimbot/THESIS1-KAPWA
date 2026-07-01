---
phase: 11-page-migration-print-offline-ui
type: validation
created: 2026-06-29
---

# Phase 11: Page Migration, Print & Offline UI — Validation Architecture

> Validation plan covering all 12 requirements (PGM-01 through PGM-06, PRN-01, PRN-02, OFF-01, OFF-02, OFF-03, DIF-02) across 16 migrated pages, print stylesheets, and offline-aware UI components.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^1.2.0 + @testing-library/react ^16.3.2 |
| Config file | `kapwa-client/vitest.config.ts` (from Phase 10) |
| Quick run command | `npm test -- --run` in `kapwa-client/` |
| Full suite command | `npm test -- --run` in `kapwa-client/` |
| Component rendering | `render()` from `@testing-library/react` |
| Routing context | `MemoryRouter` from `react-router-dom` for all page tests |
| Mock strategy | `vi.mock()` on API modules (`../../lib/api`, `../../lib/offline-queue`) |
| Assertions | `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeVisible`) |

**Verification tools:**
| Tool | Purpose | When |
|------|---------|------|
| `npm test -- --run` | Automated regression suite | Every commit, every task completion |
| `npx vite build` / `npm run build` | Build compilation check | Per-plan completion |
| Print preview (browser) | Manual visual check for A4 layouts | Post-migration for CSR/AccessCard/IRF |
| Browser rendering | Visual + functional check | Each page post-migration |

---

## Evaluation Dimensions

### D1: DOM Correctness (Automated — all pages)
| Pass | Fail |
|------|------|
| PageShell wrapper present on all 16 pages | Any page missing PageShell import |
| shadcn Badge replaces `<span className="badge">` | `.badge` class found in any page file |
| shadcn Button replaces `<button className="btn">` | `.btn` class found in any page file |
| shadcn Input/Label/Select replaces form classes | `.form-input`, `.form-select`, `.form-label` found |
| DataTable replaces `<table className="table">` | `.table` class found in any page file |
| `<EmptyState>` replaces `<div className="empty-state">` | `.empty-state` class found |
| No `import '../index.css'` in any page file | Any page imports index.css |

### D2: State Coverage (Automated — tests per page)
| Pass | Fail |
|------|------|
| Loading skeleton renders during cold load | No `<Skeleton>` / `TableSkeleton` / `CardGridSkeleton` / `FormSkeleton` in page |
| Empty state renders for zero results | No `<EmptyState>` in page |
| Error boundary fallback on crash | Unhandled error crashes the page without fallback |

### D3: Print Layout (Manual — print preview)
| Pass | Fail |
|------|------|
| A4 portrait with 20mm margins in print preview | Layout appears as Letter or different margins |
| `.no-print` elements hidden (sidebar, nav, buttons) | Navigation elements visible in print |
| `.print-header` shows MSWDO branding | No header or wrong branding |
| `.print-footer` shows page numbers + RA 11032 ref | Missing footer elements |
| `.signature-block` with `break-inside: avoid` | Signature block split across pages |

### D4: Offline UI (Manual + Automated)
| Pass | Fail |
|------|------|
| SyncStatusBanner shows offline state with pending count | Banner missing or shows incorrect count |
| SyncQueuePanel opens/closes via Sheet | Panel fails to open or close |
| ConflictResolutionDialog opens on "View Diff" | Dialog does not open or resolve button does nothing |
| Cache staleness badge shows in PageShell when `cachedAt > 5 min` | Badge missing or shows incorrect time |
| Cache staleness badge absent when `cachedAt < 5 min` | Badge shown for fresh data |

### D5: Regression Test Coverage (Automated — per D-04)
| Pass | Fail |
|------|------|
| Each migrated page has a test file | Any page missing a `*.test.tsx` file |
| All tests pass `npm test -- --run` | Any test fails or errors |
| Tests verify heading and key elements render | Test only imports without assertions |

---

## Wave 0 Test Gaps

The following test files must exist BEFORE Wave 1 execution (Plan 11-01). They validate the infrastructure components that all subsequent plans depend on.

| Test File | Validates | Requirement | Priority |
|-----------|-----------|-------------|----------|
| `kapwa-client/src/components/__tests__/PageShell.test.tsx` (update) | `cachedAt` prop staleness badge | OFF-03 | Wave 0 — must pass before Wave 1 |
| `kapwa-client/src/components/__tests__/SyncQueuePanel.test.tsx` | Queue panel render, empty state, item groups, retry/resolve | OFF-02, DIF-02 | Wave 0 — must pass before Wave 1 |
| `kapwa-client/src/components/__tests__/ConflictResolutionDialog.test.tsx` | Dialog render, diff columns, three resolve buttons | OFF-02, DIF-02 | Wave 0 — must pass before Wave 1 |

### Why These Are Wave 0
- **PageShell.test.tsx**: Plan 11-01 adds the `cachedAt` prop. Tests must validate this new prop before Wave 1 consumers (Plans 11-02 through 11-04) depend on it.
- **SyncQueuePanel.test.tsx**: Plan 11-01 creates SyncQueuePanel. Test must validate empty state, item rendering, and retry/resolve interactions before the component is integrated into Layout.
- **ConflictResolutionDialog.test.tsx**: Plan 11-01 creates ConflictResolutionDialog. Test must validate diff display and all three resolve strategies before integration.

### Page-Level Test Wave (Wave 1+)

These tests are created alongside their respective page migration tasks:

| Test File | Created In | Requirement |
|-----------|------------|-------------|
| `DashboardPage.test.tsx` | Plan 11-02 Task 1 | PGM-05 |
| `BeneficiariesPage.test.tsx` | Plan 11-02 Task 2 | PGM-01 |
| `BeneficiaryViewPage.test.tsx` | Plan 11-02 Task 2 | PGM-01 |
| `IntakePage.test.tsx` | Plan 11-02 Task 3 | PGM-01 |
| `CasesPage.test.tsx` | Plan 11-03 Task 1 | PGM-02 |
| `InterventionsPage.test.tsx` | Plan 11-03 Task 1 | PGM-02 |
| `CaseTrackerPage.test.tsx` | Plan 11-03 Task 1 | PGM-02 |
| `ApprovalPipelinePage.test.tsx` | Plan 11-03 Task 1 | PGM-02 |
| `AccessCardPage.test.tsx` | Plan 11-03 Task 2 | PGM-03 |
| `CsrPage.test.tsx` | Plan 11-03 Task 2 | PGM-03 |
| `IrfPage.test.tsx` | Plan 11-03 Task 3 | PGM-04 |
| `AdminPage.test.tsx` | Plan 11-04 Task 1 | PGM-06 |
| `MfaSetupPage.test.tsx` | Plan 11-04 Task 1 | PGM-06 |
| `FilingPage.test.tsx` | Plan 11-04 Task 1 | PGM-06 |
| `MessagesPage.test.tsx` | Plan 11-04 Task 1 | PGM-06 |
| `ClaimantDashboardPage.test.tsx` | Plan 11-04 Task 2 | PGM-05 |

---

## Sampling Strategy

| Level | Frequency | Scope | Gate |
|-------|-----------|-------|------|
| **Per task commit** | Every task | All tests in suite | `npm test -- --run` passes |
| **Per plan merge** | After all tasks in a plan | All tests + legacy class grep | Full suite green + build compiles |
| **Per phase gate** | Before `/gsd-verify-work` | Full suite + manual checks (print preview, browser) | All automated + manual checks pass |

### Legacy Class Sampling

After every page migration plan, run a grep sweep across `kapwa-client/src/pages/`:

```bash
# Count legacy class matches (should be 0 per migrated page)
for cls in spinner page-header page-title page-desc empty-state table badge btn btn-primary btn-secondary form-input form-select form-label form-group text-text-secondary toolbar pagination filter-pill stat-card stat-label stat-value search-bar search-input icon-btn clear-btn error-msg success-msg; do
  count=$(grep -r "className=\"[^\"]*$cls" kapwa-client/src/pages/ 2>/dev/null | wc -l)
  [ "$count" -gt 0 ] && echo "WARN: $cls found $count times"
done
```

### Print Layout Sampling

After each plan with print-ready pages (11-03), manually verify in browser:
1. Open Chrome DevTools → Rendering → Emulate CSS media type `print`
2. Check A4 layout, 20mm margins, `.no-print` elements hidden
3. Verify MSWDO header, page numbers, signature blocks

---

## Verification Approach Per Requirement

| Req ID | Description | Test Type | Location | Automated Command | Pass/Fail Criterion |
|--------|-------------|-----------|----------|-------------------|---------------------|
| PGM-01 | Beneficiaries pages migrated | Unit | `BeneficiariesPage.test.tsx`, `BeneficiaryViewPage.test.tsx`, `IntakePage.test.tsx` | `npm test -- --run` | All 3 tests pass, zero legacy classes in source |
| PGM-02 | Cases & interventions migrated | Unit | `CasesPage.test.tsx`, `InterventionsPage.test.tsx`, `CaseTrackerPage.test.tsx`, `ApprovalPipelinePage.test.tsx` | `npm test -- --run` | All 4 tests pass, zero legacy classes |
| PGM-03 | Access Card pages migrated + print | Unit + Manual | `AccessCardPage.test.tsx`, `CsrPage.test.tsx` | `npm test -- --run` + print preview | Tests pass; print preview shows A4 layout |
| PGM-04 | IRF module migrated + print | Unit + Manual | `IrfPage.test.tsx` | `npm test -- --run` | Test passes, form logic preserved |
| PGM-05 | Dashboard pages migrated | Unit | `DashboardPage.test.tsx`, `ClaimantDashboardPage.test.tsx` | `npm test -- --run` | Both tests pass, zero legacy classes |
| PGM-06 | Admin/settings pages migrated | Unit | `AdminPage.test.tsx`, `MfaSetupPage.test.tsx`, `FilingPage.test.tsx`, `MessagesPage.test.tsx` | `npm test -- --run` | All 4 tests pass |
| PRN-01 | Print stylesheet | Manual | `index.css` `@media print` block | Print preview in browser | A4, 20mm margins, `.no-print` hidden, serif font |
| PRN-02 | Print-ready case documents | Manual | CSR, Access Card, IRF pages | Print preview per document | Header/footer/signatures present and formatted |
| OFF-01 | Enhanced sync status banner | Unit + Manual | `SyncStatusBanner` in Layout, `SyncStatusBanner.test.tsx` | `npm test -- --run` | Banner shows offline/online + count |
| OFF-02 | Sync queue detail panel | Unit + Manual | `SyncQueuePanel.test.tsx` | `npm test -- --run` | Panel opens, shows items, retry/resolve works |
| OFF-03 | Cache staleness indicators | Unit | `PageShell.test.tsx` (cachedAt update) | `npm test -- --run` | Badge appears when `cachedAt > 5 min` |
| DIF-02 | Offline queue transparency panel | Unit | `SyncQueuePanel.test.tsx`, `ConflictResolutionDialog.test.tsx` | `npm test -- --run` | All queue items visible; resolve actions work |

---

## Phase Gate Checklist

All items must be verified before `/gsd-verify-work`:

- [ ] All 16 migrated pages use PageShell, proper states, shadcn components
- [ ] Zero legacy CSS classes remain in any `src/pages/` file
- [ ] No `import '../index.css'` in any page file
- [ ] 21 test files exist and pass (3 Wave 0 + 16 page-level + 2 integration)
- [ ] Build compiles successfully (`npx vite build`)
- [ ] Print preview shows correct A4 layout for CSR, Access Card, IRF
- [ ] Sync queue panel opens/closes from sync status banner
- [ ] Cache staleness badge appears when data exceeds 5 min threshold
- [ ] All 12 requirements have test coverage
- [ ] No new npm packages added
