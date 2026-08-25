# Coordinator Dashboard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove MSWDO-only stats and the Quick Case Search card from the coordinator dashboard so it reflects coordinator responsibilities.

**Architecture:** Single-file change in `CoordinatorDashboardPage.tsx`: drop two stat cards (Served Today, Pending Cases) from both normal and offline-fallback stats arrays, collapse the stats grid to 2 columns, delete the Quick Case Search card and its dead state/handlers, and trim unused imports. Add a regression test asserting the removed elements are absent and the kept ones remain.

**Tech Stack:** React 18, TypeScript, react-i18next, lucide-react, Vitest + Testing Library.

## Global Constraints

- Only modify `kapwa-client/src/pages/CoordinatorDashboardPage.tsx` and `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx`. No other files (per spec: i18n keys stay, `CoordinatorWidgets.tsx` untouched).
- Do NOT remove i18n keys — `servedToday`, `quickCaseSearch`, `enterCaseId`, `caseNotFound`, `viewDetails` are also used by `CoordinatorWidgets.tsx` and other pages.
- Keep: header buttons (View Referrals / Access Cards / New Referral), QuickScanCard, Today's Tracker Entries table + per-row View + View Full Tracker.
- Keep the en-locale text exactly: "Served Today", "Pending Cases", "Quick Case Search", "My Referrals", "Messages".
- Test command: `npm run test:run` (vitest). Typecheck: `npm run typecheck`. Both run from `kapwa-client/`.

---

### Task 1: Remove MSWDO-only stats and Quick Case Search from coordinator dashboard

**Files:**
- Modify: `kapwa-client/src/pages/CoordinatorDashboardPage.tsx`
- Test: `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx`

**Interfaces:**
- Consumes: nothing new — existing `api.get`, `useTranslation`, `useNavigate` unchanged.
- Produces: a cleaned `CoordinatorDashboardPage` that renders exactly 2 stats (My Referrals, Messages) and no "Quick Case Search" card. No exported API change.

- [ ] **Step 1: Add failing regression tests**

Append these two tests to `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx` after the last existing test (the `shows an error when the card code is not found` block):

```tsx
  it('hides MSWDO-only stats and case search for coordinators', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });
    expect(screen.queryByText('Served Today')).toBeNull();
    expect(screen.queryByText('Pending Cases')).toBeNull();
    expect(screen.queryByText('Quick Case Search')).toBeNull();
  });

  it('keeps coordinator-relevant stats and quick scan', async () => {
    render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Coordinator Dashboard' });
    expect(screen.getByText('My Referrals')).toBeTruthy();
    expect(screen.getAllByText('Messages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/access card code/i)).toBeDefined();
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm run test:run -- src/pages/CoordinatorDashboardPage.test.tsx`
Expected: `hides MSWDO-only stats and case search for coordinators` FAILS (Served Today / Pending Cases / Quick Case Search still rendered). The `keeps coordinator-relevant stats` test may pass already.

- [ ] **Step 3: Implement the cleanup in `CoordinatorDashboardPage.tsx`**

Edit the lucide-react import (line 4) to drop `TrendingUp`, `Clock`, `ArrowRight`, `Search`, `Loader2`, `ClipboardList`:

```tsx
import { MessageSquare, Eye, Send, ExternalLink, BadgeCheck } from 'lucide-react';
```

Remove the `Input` import (line 8):

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
```

Remove state and handler for the case search (lines 17-20 and 54-67) — delete these entirely:

```tsx
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
```

```tsx
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchId.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const result = await api.get<any>(`/cases/${searchId.trim()}`);
      setSearchResult(result);
    } catch {
      setSearchError(t('dashboard.caseNotFound', 'Case not found'));
    }
    setSearching(false);
  }
```

Trim the loaded stats array (lines 36-41) to only My Referrals and Messages:

```tsx
      setStats([
        { label: t('dashboard.myReferrals', 'My Referrals'), value: String(refCounts?.total ?? '--'), change: referralsText, icon: Send },
        { label: t('dashboard.messages', 'Messages'), value: String(data.unreadMessages || 0), change: t('dashboard.unreadMessages', 'Unread messages'), icon: MessageSquare },
      ]);
```

Trim the offline-fallback stats array (lines 44-49) the same way:

```tsx
      setStats([
        { label: t('dashboard.myReferrals', 'My Referrals'), value: '--', change: t('dashboard.offline', 'Offline'), icon: Send },
        { label: t('dashboard.messages', 'Messages'), value: '--', change: 'N/A', icon: MessageSquare },
      ]);
```

Collapse the stats grid (line 105) from 4 columns to 2:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

Remove the entire Quick Case Search `Card` block (lines 129-162):

```tsx
      <Card className="mt-4">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t('dashboard.quickCaseSearch', 'Quick Case Search')}</h2>
        </div>
        <CardContent className="p-4">
          ...
        </CardContent>
      </Card>
```

The `Card` component is still used by the stats cards and the tracker section, so its import stays. `useState` remains in use (`stats`, `recentEntries`, `loading` still use it), so the react import stays as `import { useState, useEffect } from 'react';`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/pages/CoordinatorDashboardPage.test.tsx`
Expected: ALL tests PASS (both new tests + the existing 5 QuickScanCard/heading/a11y tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: `tsc` exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/pages/CoordinatorDashboardPage.tsx kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx
git commit -m "fix: remove MSWDO-only stats and case search from coordinator dashboard"
```

---

## Self-Review

**1. Spec coverage:** Every spec item has a task step — remove Served Today + Pending Cases stats (Step 3, both arrays), collapse grid to 2 cols (Step 3), remove Quick Case Search card (Step 3), delete dead state/handler (Step 3), trim imports (Step 3). "Explicitly NOT changing" items are respected — no task touches i18n keys, header buttons, QuickScanCard, tracker section, or `CoordinatorWidgets.tsx`. Test file addition covers the regression. ✓

**2. Placeholder scan:** All steps contain concrete code or exact commands; no TBD/TODO/descriptive-only steps. ✓

**3. Type consistency:** Tests reference rendered text exactly matching en-locale values ("Served Today", "Pending Cases", "Quick Case Search", "My Referrals", "Messages" — verified present in `src/i18n/locales/en/index.ts`). No function/type signatures introduced across tasks, so no cross-task drift. ✓