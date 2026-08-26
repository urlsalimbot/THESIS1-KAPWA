# Remove False-Functionality Elements from Claimant Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two "Add first record" buttons and the dead "Manage Consent" button from the claimant dashboard empty states.

**Architecture:** Single-file change in `ClaimantDashboardPage.tsx`: replace the two `<EmptyState variant="no-data" />` usages with plain informational empty blocks (no button) reusing existing i18n keys, and delete the orphaned "Manage Consent" button. Add regression tests asserting neither false button renders.

**Tech Stack:** React 18 + TypeScript + react-i18next (client), Vitest + Testing Library.

## Global Constraints

- Only `kapwa-client/src/pages/ClaimantDashboardPage.tsx` and `kapwa-client/src/pages/ClaimantDashboardPage.test.tsx` may be modified (approved scope: claimant dashboard only — the shared `EmptyState` component and every other page are out of bounds).
- Reuse existing i18n keys only (`claims.noServices`, `dashboard.noConsentRecords`) — NO new i18n keys, no locale file edits, fil parity untouched.
- Do not change the `EmptyState` component.
- Test command: `npm run test:run` and typecheck `npm run typecheck`, both from `kapwa-client/`.
- The working tree contains unrelated uncommitted changes (a card-overlap bug fix + the user's docs edits) — the commit must NOT include them.

---

### Task 1: Remove false-functionality buttons from claimant dashboard empty states

**Files:**
- Modify: `kapwa-client/src/pages/ClaimantDashboardPage.tsx` (empty states at lines 152-155 and 180-183; "Manage Consent" button at line 178; remove `EmptyState` import at line 9)
- Test: `kapwa-client/src/pages/ClaimantDashboardPage.test.tsx`

**Interfaces:**
- Consumes: nothing new — existing `useTranslation`, `Card`, `CardContent` unchanged.
- Produces: a `ClaimantDashboardPage` whose empty Service History and Consent Management cards render informational text only (no buttons) and whose Consent Management card header has no button.

- [ ] **Step 1: Add failing regression tests**

Append these two tests to `kapwa-client/src/pages/ClaimantDashboardPage.test.tsx` after the last existing test (the `has no a11y violations` block):

```tsx
  it('does not show an "Add first record" button on empty states', async () => {
    renderWithSWR(<ClaimantDashboardPage />);
    await screen.findByRole('heading', { name: 'My Dashboard' });
    expect(screen.queryByRole('button', { name: 'Add first record' })).toBeNull();
  });

  it('does not show a dead "Manage Consent" button', async () => {
    renderWithSWR(<ClaimantDashboardPage />);
    await screen.findByRole('heading', { name: 'My Dashboard' });
    expect(screen.queryByRole('button', { name: 'Manage Consent' })).toBeNull();
  });
```

The mock in `beforeEach` already returns `{ services: [], caseStatus: 'No active case' }` and `[]` for consent, so the empty states render.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm run test:run -- src/pages/ClaimantDashboardPage.test.tsx` (from `kapwa-client/`)
Expected: both new tests FAIL (the "Add first record" and "Manage Consent" buttons are currently rendered).

- [ ] **Step 3: Implement the cleanup in `ClaimantDashboardPage.tsx`**

1. Remove the `EmptyState` import (line 9): `import { EmptyState } from '@/components/EmptyState';`.

2. Replace the Service History empty state (currently):

```tsx
        {services.length === 0 ? (
          <CardContent>
            <EmptyState variant="no-data" />
          </CardContent>
        ) : (
```

with (no button — plain informational text):

```tsx
        {services.length === 0 ? (
          <CardContent>
            <p className="text-center py-8 text-sm text-muted-foreground">{t('claims.noServices', 'No services recorded yet.')}</p>
          </CardContent>
        ) : (
```

3. Replace the Consent Management card header + empty state. Currently:

```tsx
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-primary">{t('claims.consentManagement', 'Consent Management')}</h3>
          <Button variant="default" size="sm">{t('claims.manageConsent', 'Manage Consent')}</Button>
        </div>
        {consents.length === 0 ? (
          <CardContent>
            <EmptyState variant="no-data" />
          </CardContent>
        ) : (
```

Replace with (no button in the header; plain empty text):

```tsx
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm text-primary">{t('claims.consentManagement', 'Consent Management')}</h3>
        </div>
        {consents.length === 0 ? (
          <CardContent>
            <p className="text-center py-8 text-sm text-muted-foreground">{t('dashboard.noConsentRecords', 'No consent records found')}</p>
          </CardContent>
        ) : (
```

4. `Button` is still used elsewhere in the file (Access Card "View Card" link at line 129, notification preferences save at lines 206-213) — do NOT remove the `Button` import.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/pages/ClaimantDashboardPage.test.tsx` (from `kapwa-client/`)
Expected: ALL tests pass (the 2 new regression tests + the existing 4: heading, Access Card section, View Card link, a11y).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck` (from `kapwa-client/`)
Expected: exits 0.

- [ ] **Step 6: Commit**

Stage ONLY the two files (verify with `git status` that the unrelated working-tree changes stay unstaged):

```bash
git add kapwa-client/src/pages/ClaimantDashboardPage.tsx kapwa-client/src/pages/ClaimantDashboardPage.test.tsx
git commit -m "fix: remove false-functionality buttons from claimant dashboard empty states"
```

---

## Self-Review

**1. Spec coverage:** Service History empty state → plain text (Step 3.2); Consent Management empty state → plain text (Step 3.3); "Manage Consent" button removed (Step 3.3); `EmptyState` import removed (Step 3.1); regression tests (Step 1). "Explicitly NOT changing" respected — no `EmptyState` component edit, no other page touched, no i18n keys added (both strings reuse `claims.noServices` and `dashboard.noConsentRecords`). ✓

**2. Placeholder scan:** All steps carry complete code and exact commands; no TBD/TODO. ✓

**3. Type consistency:** Both reused keys exist and are already referenced in the codebase (`claims.noServices` in `ClaimantAccessCardPage.tsx`, `dashboard.noConsentRecords` in `AuditorPage.tsx`). `Button` import retained (still used at lines 129/206-213). Test queries match the exact button names rendered today. ✓