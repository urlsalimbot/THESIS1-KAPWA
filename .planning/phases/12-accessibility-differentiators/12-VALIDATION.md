# Phase 12: Accessibility & Differentiators — Validation Architecture

**Generated:** 2026-06-30
**Status:** Ready for execution

## Plan-to-Test Mapping

| Plan | Test Focus | Type | Coverage |
|------|-----------|------|----------|
| 12-01 — A11y + PII | SkipToContent, AriaLiveRegion, FocusTrap components, usePiiMasking hook, MaskedField, Layout error boundary | Unit + Integration | Component rendering, keyboard behavior, masking toggle, consent integration |
| 12-02 — SLA + Search | useSlaTimer hook, SlaTimer/SlaTooltip display, useDebouncedSearch, GlobalSearch dropdown, Topbar quick actions | Unit + Integration | Timer calculation, color thresholds, search debounce, result rendering, quick action routing |
| 12-03 — Bulk Ops | DataTable row selection, BulkActionBar, BulkApproveDialog, BulkExportDialog, BulkProgressToast | Unit + Integration | Selection behavior, dialog confirm, export masking toggle, progress toast rendering |
| 12-04 — Dashboards | ClaimantWidgets, MayorWidgets, AuditorWidgets, CoordinatorWidgets, QuickActionPanel, role-filtered DashboardPage | Unit + Integration | Role-based widget visibility, aggregate data display, barangay scoping |
| 12-05 — Audit + Polish | Color contrast CSS audit, keyboard nav audit, axe-core E2E tests, unit tests for all new components | E2E + Manual | WCAG 2.1 AA compliance verification, regression prevention |

## Validation Dimensions

| Dimension | Approach | Tooling |
|-----------|----------|---------|
| Automated a11y | axe-core + Playwright E2E | @axe-core/playwright |
| Unit tests | Vitest component tests | vitest + @testing-library/react |
| Keyboard nav | Manual audit + automated focus checks | axe-core rule set |
| Color contrast | Manual CSS audit + DevTools | Chrome DevTools contrast checker |
| PII masking | Unit tests for hook + component | vitest |
| SLA timers | Unit tests for calculation logic | vitest |
| Bulk ops | Component + API integration | vitest + @testing-library/react |

## Regression Prevention

- axe-core CI step runs on every PR (uses existing Vitest/Playwright pipeline)
- All new components have coverage targets (≥80%)
- Focus-trap components include edge case tests (nested traps, portal-based dialogs)
