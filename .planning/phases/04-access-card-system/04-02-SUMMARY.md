---
phase: 04-access-card-system
plan: 02
subsystem: access-cards
tags: access-card-print-view, printable-card, @media-print, A4-layout, service-log-table, reprint-verification
requires:
  - phase: 04-01
    provides: GET /beneficiary/:id/card endpoint, getBeneficiaryCard() API, beneficiary page card section
provides:
  - AccessCard reusable component with beneficiary info, service log table, empty state
  - AccessCardPrintView page with loading/error/loaded states, Print Card button (window.print)
  - Route /beneficiaries/:id/card/print gated by admin/social_worker roles
  - @media print CSS: A4 portrait, 15mm margins, table borders, 18pt card code
  - Standalone Access Card section on BeneficiaryViewPage (below profile, above grid)
  - Reprint identity confirmation matching UI-SPEC copy
  - Direct-to-print navigation in AccessCardPage
  - UI-SPEC styling: font-mono card code, 12px/700/uppercase table headers, zebra #F5F5F5, hover #E8F0F7
affects:
  - BeneficiaryViewPage — Access Card section moved from Personal Info card to standalone section
  - AccessCardPage — added Quick Print input for direct print navigation
tech-stack:
  added:
    - "@testing-library/react — component rendering tests (dev dependency)"
    - "@testing-library/dom — peer dependency for testing-library/react"
  patterns:
    - Component with props pattern (AccessCardProps interface, following ConsentManager.tsx analog)
    - Browser print dialog via window.print() + @media print CSS (no PDF generation)
    - Zod-free client component — all data flows through API, no new schemas needed
    - Empty state: "No services logged yet" rendered inline in component
key-files:
  created:
    - kapwa-client/src/components/cards/AccessCard.tsx
    - kapwa-client/src/pages/AccessCardPrintView.tsx
    - kapwa-client/src/components/cards/AccessCard.test.tsx
  modified:
    - kapwa-client/src/routes.tsx (added print route import + entry)
    - kapwa-client/src/index.css (added @media print CSS block)
    - kapwa-client/src/pages/BeneficiaryViewPage.tsx (standalone card section, UI-SPEC reprint msg)
    - kapwa-client/src/pages/AccessCardPage.tsx (added Quick Print section)
    - kapwa-client/vitest.config.ts (added .tsx and src/ test discovery)
decisions:
  - "Moved Access Card section out of Personal Info card into standalone section below profile — improves visual hierarchy"
  - "Reprint confirmation uses window.confirm with UI-SPEC copy: 'Reprint Access Card — Reprint card for {name}? Current code: {code} will remain valid. Verify claimant identity before proceeding.'"
  - "Table row hover changed from bg-gray-50 to bg-[#E8F0F7] per UI-SPEC"
  - "Updated vitest config include pattern to support .tsx and src/co-located test files"
duration: ~12min
completed: 2026-06-22
status: complete
---

# Phase 4 Plan 2: Printable Card View & Service Log

**Created AccessCard reusable component, AccessCardPrintView, print route with @media print CSS, reprint identity verification, and UI-SPEC polish. All 5 vitest tests passing; client build succeeds.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-22T16:40:00Z
- **Completed:** 2026-06-22T16:52:00Z
- **Tasks:** 3
- **Files modified/created:** 9

## Accomplishments

### Task 1 (TDD RED): Failing tests for AccessCard component
- Created `AccessCard.test.tsx` with 5 test cases:
  - Renders card code in font-mono
  - Renders beneficiary name and barangay
  - Renders service log table with Date/Service/Cost/Agency columns
  - Shows "No services logged yet" when empty
  - Renders row numbers sequentially (1, 2, 3)
- Updated vitest config to support `.tsx` files and `src/` test discovery
- Installed `@testing-library/react` and `@testing-library/dom` for component rendering
- Tests fail RED because AccessCard component doesn't exist

### Task 2 (GREEN): AccessCard component + AccessCardPrintView + route + print CSS
- **AccessCard.tsx**: Reusable component with `beneficiary`, `services`, and `printable` props. Header with "MSWDO Norzagaray — Access Card" title, font-mono card code, beneficiary name/barangay, service log table with zebra striping. Empty state shows "No services logged yet".
- **AccessCardPrintView.tsx**: Dedicated print page. Gets `id` from useParams, calls `getBeneficiaryCard(id)` on mount. Three states: loading ("Loading card data..."), error ("No Access Card"), loaded (renders AccessCard with printable=true + Print Card button calling window.print()).
- **routes.tsx**: Added `{ path: '/beneficiaries/:id/card/print', element: <Private roles={['admin','social_worker']}><AccessCardPrintView /></Private> }`
- **index.css**: Added `@media print` rules: A4 portrait, 15mm margins, no-print hide, card-code 18pt monospace, table borders, print-color-adjust.
- All 5 tests pass GREEN.

### Task 3: Wire reprint identity verification, polish states, apply UI-SPEC styling
- **BeneficiaryViewPage.tsx**: Moved Access Card from inside Personal Info card to standalone section (below profile, above main grid). Updated reprint confirmation to match UI-SPEC copy exactly.
- **AccessCardPage.tsx**: Added "Quick Print — Card View" section with beneficiary UUID input + Print Card button for direct navigation to print view.
- **AccessCard.tsx**: Applied UI-SPEC styling — table header 12px/700/uppercase, even-row zebra `#F5F5F5`, row hover `#E8F0F7`.
- No 18-row limit on service log.
- All 5 vitest tests pass; client build succeeds (1793 modules).

## Verification Results

| Check | Result |
|-------|--------|
| `cd kapwa-client && npx vitest run --reporter=verbose AccessCard` | ✅ All 5 tests pass |
| `cd kapwa-client && npx vite build` | ✅ Build succeeds (1793 modules) |
| No 18-row limit in any code | ✅ No .slice/.limit/rowLimit patterns in AccessCard files |
| Reprint confirmation matches UI-SPEC | ✅ Confirmed |

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | TDD RED: failing tests for AccessCard component | `214c767` | test(04-02) |
| 2 | GREEN: AccessCard, AccessCardPrintView, route, print CSS | `e99e081` | feat(04-02) |
| 3 | Wire reprint verification, polish states, UI-SPEC styling | `bd3784e` | feat(04-02) |

## Files Created/Modified

- `kapwa-client/src/components/cards/AccessCard.tsx` — NEW: reusable card component with beneficiary info, service log table, empty state, printable prop
- `kapwa-client/src/pages/AccessCardPrintView.tsx` — NEW: printable card view page with loading/error/loaded states
- `kapwa-client/src/components/cards/AccessCard.test.tsx` — NEW: 5 vitest tests for AccessCard component
- `kapwa-client/src/routes.tsx` — ADDED: import + route entry for `/beneficiaries/:id/card/print`
- `kapwa-client/src/index.css` — ADDED: @media print CSS block with A4 layout
- `kapwa-client/src/pages/BeneficiaryViewPage.tsx` — MODIFIED: standalone Access Card section, UI-SPEC reprint copy
- `kapwa-client/src/pages/AccessCardPage.tsx` — MODIFIED: added Quick Print section for direct print navigation
- `kapwa-client/vitest.config.ts` — MODIFIED: include .tsx extensions and src/ test files

## Threat Model Compliance

| Threat ID | Category | Disposition | Status |
|-----------|----------|-------------|--------|
| T-04-04 | Information Disclosure | mitigate | ✅ Route uses ProtectedRoute with roles=['admin','social_worker']; data fetched via authenticated API call |
| T-04-05 | Spoofing | accept | ✅ Reprint uses window.confirm per D-04; worker verifies identity in-person |
| T-04-06 | Tampering | mitigate | ✅ All card data sourced from API on mount (getBeneficiaryCard), not from URL params or localStorage |
| T-04-SC | Tampering | mitigate | ✅ Only installed @testing-library/react and @testing-library/dom as devDependencies for testing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @testing-library/react dependency**
- **Found during:** Task 1 RED
- **Issue:** `@testing-library/react` not installed; vitest config only included `.ts` files in `tests/` directory
- **Fix:** Installed `@testing-library/react` and `@testing-library/dom` as devDependencies; updated vitest config include to `['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}']`
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.ts`
- **Committed in:** `214c767` (Task 1 commit)

**2. [Rule 1 - Bug] Multiple elements matched "Norzagaray" text**
- **Found during:** Task 2 GREEN — ran tests, 4/5 passed
- **Issue:** The header title "MSWDO Norzagaray — Access Card" also contains "Norzagaray", causing `getByText(/Norzagaray/i)` to find 2 elements
- **Fix:** Changed to use `getAllByText` and verify length > 1, plus add separate `getByText(/Barangay:/i)` assertion
- **Files modified:** `AccessCard.test.tsx`
- **Committed in:** `e99e081` (Task 2 commit)

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both minor — no scope creep. Standard dependency install + test assertion fix.

## Known Stubs

None — all features fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_client_route | routes.tsx | /beneficiaries/:id/card/print — new route exposing card data to authenticated admin/social_worker users |
| threat_flag: print_data_exposure | AccessCardPrintView.tsx | Card data (beneficiary name, barangay, card code, full service log) rendered in browser for potential print, screen capture, or side-channel |

Both flags are covered by the existing threat model (T-04-04: Information Disclosure mitigated by route role gating + authenticated API fetch).

## Privacy & Security Notes

- Print view route is gated by `@Roles('admin', 'social_worker')` via ProtectedRoute
- All card data fetched from API on mount — no URL parameter injection possible
- Reprint uses `window.confirm()` — physical office workflow per D-04
- No new personal data collected or stored
- `@testing-library/react` installed as devDependency only (not in production bundle)

---

*Plan: 04-02*
*Completed: 2026-06-22*

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| AccessCard.tsx exists | ✅ |
| AccessCardPrintView.tsx exists | ✅ |
| AccessCard.test.tsx exists | ✅ |
| 04-02-SUMMARY.md exists | ✅ |
| Commit 214c767 (RED) found | ✅ |
| Commit e99e081 (GREEN) found | ✅ |
| Commit bd3784e (Task 3) found | ✅ |
| All 5 vitest tests pass | ✅ |
