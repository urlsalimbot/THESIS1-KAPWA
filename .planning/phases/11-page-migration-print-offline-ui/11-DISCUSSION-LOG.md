# Phase 11: Page Migration, Print & Offline UI - Discussion Log

**Date:** 2026-06-29

## Areas Discussed

### 1. Migration Strategy
1. **Approach**: Incremental — user chose page-by-page migration, deployable after each
2. **Order**: Dashboard first (pattern-setter) → Beneficiaries → Cases → Access Card/CSR → IRF → Admin → Claimant Dashboard
3. **Rewrite style**: Refactor in place — keep business logic, swap presentation
4. **Testing**: Regression test per page with mock data, all run in CI

### 2. Print Layout
1. **Documents**: CSR, Access Card, Intervention Log, and IRF all get full print-ready layouts
2. **Branding**: MSWDO header + footer (logo, office name, address, DSWD seal, RA 11032 reference)
3. **Page config**: A4 portrait, 20mm margins, 12pt serif base
4. **Signatures**: Signature block on last page only, Page X of Y on every page

### 3. Sync Queue Panel
1. **Location**: Sidebar sliding panel (shadcn Sheet) triggered by sync status button
2. **Items**: All pending sync operations visible with type/entity/status
3. **Actions**: Retry (failures), View diff + Resolve (conflicts), swipe to remove
4. **Updates**: Live sync engine events with real-time progress indicators

### 4. Cache Staleness Indicators
1. **Detection**: Time-based (seconds since last successful sync)
2. **Format**: Subtitle badge on PageShell — "Cached data — last sync X min ago"
3. **Scope**: All data-fetching pages
4. **Threshold**: 5 minutes (matches SWR interval)

## Deferred Ideas

None.

---

*Log generated: 2026-06-29*
