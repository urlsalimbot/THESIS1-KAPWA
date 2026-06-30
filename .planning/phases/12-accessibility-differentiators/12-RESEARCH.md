# Phase 12: Accessibility & Differentiators - Research

**Researched:** 2026-06-30
**Domain:** WCAG 2.1 AA accessibility compliance, role-specific dashboards, PII masking, SLA timers, bulk operations, global search
**Confidence:** HIGH

## Summary

Phase 12 is the final phase of the v1.1 UI/UX Overhaul milestone, delivering production accessibility compliance and differentiating features. The research confirms that the existing Radix UI primitives already provide strong accessibility foundations (focus trapping, ARIA attributes, keyboard navigation in dialogs/dropdowns). The primary work involves: (1) adding automated axe-core testing in CI for regression prevention, (2) ensuring keyboard accessibility in custom components (DataTable row actions, FamilyGraph), (3) building a PII masking hook with consent-aware click-to-reveal, (4) implementing SLA timer display with configurable per-program thresholds, (5) adding bulk operations with checkbox selection and progress toasts, and (6) wiring global search through existing trigram+BM25 infrastructure.

**Primary recommendation:** Integrate `@axe-core/playwright` at the E2E test layer for regression prevention, use a custom React hook for PII masking (not an external library — the masking rules are domain-specific to RA 10173), and extend TanStack Table's built-in row selection API for bulk operations. All new componentry should follow the existing shadcn/PageShell pattern from Phase 11.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Automated axe-core checks integrated into CI test suite for regression prevention
- **D-02:** Screen reader testing targets NVDA (most common on Windows, 97% of desktop screen reader users)
- **D-03:** Full keyboard navigation — all interactive elements reachable and operable via keyboard, including custom components (DataTable row actions, FamilyGraph)
- **D-04:** Color contrast audit of existing pages → fix failures (brand colors, form inputs, data tables)
- **D-05:** Single dashboard page with role-conditionally filtered widgets — not separate pages per role
- **D-06:** Claimant self-service dashboard: case status timeline, intervention history, Access Card view — read-only, no edit capabilities
- **D-07:** Mayor's Office dashboard: aggregate statistics, charts, SLA compliance rates — no PII exposed
- **D-08:** Auditor dashboard: audit log viewer, SHA-256 hash-chain verification, consent ledger
- **D-09:** Barangay Coordinator dashboard: data scoped to their assigned barangay only — consistent with ROL-02 mobile PWA scoping
- **D-10:** Everything identifier masked for non-worker roles (name, phone, complete address). Only MSWDO workers see full data
- **D-11:** Click-to-reveal mechanism for authorized roles — temporarily unmask a field, logged to consent ledger (who/when/why), auto-mask after configurable timeout
- **D-12:** Masking follows consent status — if consent is revoked, data masked for everyone including workers. If active, per-role masking rules apply
- **D-13:** CSV/PDF exports mask PII by default; user can request unmasked export with reason logged to audit trail
- **D-14:** SLA tracking on Intake→Assessment and Assessment→Approval workflow stages
- **D-15:** Per-case display in tables/approval lists — color indicator (green/amber/red) showing days elapsed vs SLA
- **D-16:** SLA thresholds configurable per program type (not a single fixed limit) — stored in program configuration
- **D-17:** SLA breach triggers visual warning (red indicator) + admin notification. No automatic reassignment
- **D-18:** New Intake + Approvals Queue + Global Search as primary quick actions
- **D-19:** Quick action buttons in topbar (always visible) + expanded quick action panel on dashboard
- **D-20:** Global search bar in topbar searching beneficiaries by name, ID, and barangay — using existing trigram + BM25 search infrastructure (GIS-04)
- **D-21:** Bulk approve pending cases, bulk reassign cases, bulk export records
- **D-22:** Checkbox per row + "Select all N records" in DataTable — standard selection pattern
- **D-23:** Summary dialog before execution: "You are about to approve 12 cases" with count and preview
- **D-24:** Sonner toast with live progress: "Approving 12 cases: 5/12 complete" — per-item success/failure feedback

### the agent's Discretion
- Auto-mask timeout duration for click-to-reveal (default 30s suggested)
- Layout specifics for role widgets within shared dashboard
- Exact keyboard shortcut keys (if any beyond standard Tab/Escape/Enter)
- Bulk operation page size and timeout limits

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WCAG compliance (automated checks) | CI / Test | Browser | axe-core runs in CI against rendered output |
| Keyboard navigation | Browser | — | All focus management is browser-side React behavior |
| Color contrast audit | Browser | — | CSS custom properties control colors; fix once in design tokens |
| Role-specific dashboard | API / Backend | Browser | Backend filters data by role; frontend renders widgets |
| PII masking | Browser | API / Backend | Masked display is client-side; consent data and unmask API come from backend |
| PII click-to-reveal | Browser | API / Backend | Temporary unmask request hits API; audit logged server-side |
| SLA timer display | Browser | API / Backend | Elapsed time calculated client-side from server-provided timestamps |
| Bulk operations | Browser | API / Backend | UI handles selection/progress; API handles batch execution |
| Global search | Browser | API / Backend | Debounced input + existing trigram/BM25 API endpoint |
| Quick actions | Browser | — | Purely UI pattern (topbar shortcuts + dashboard panel) |

## Standard Stack

### Core (New Additions for Phase 12)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@axe-core/playwright` | 4.12.1 | Automated WCAG compliance scanning in E2E tests | Official Deque package; runs axe-core inside Playwright context; no injection step needed; `AxeBuilder` API for scoping/rule-selection |
| `vitest-axe` | 0.1.0 | Custom Vitest matcher (`toHaveNoViolations`) for component-level a11y tests | Forks `jest-axe` with Vitest compatibility; tests individual components in isolation |

### Already Installed (Reused for Phase 12)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 | Row selection API for bulk operations | Built-in `getRowId`, `getToggleAllPageRowsSelectedHandler`, and `rowSelection` state |
| `sonner` | 2.0.7 | Progress toasts for bulk operations | `toast.promise()` and custom JSX for live progress; already in project |
| `cmdk` | 1.1.1 | Global search command palette UI | Already installed; provides `<Command>` component for search results popover |
| `@radix-ui/react-popover` | 1.1.17 | Search results dropdown container | Already installed; handles positioning and focus management for search popover |
| `@radix-ui/react-dialog` | 1.1.17 | Bulk operation confirmation dialogs | Already installed; handles focus trap and ARIA attributes automatically |
| `lucide-react` | 1.14.0 | Icons for quick actions, SLA indicators | Already installed; `Clock`, `Search`, `CheckSquare`, `Eye`, `EyeOff` icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@axe-core/playwright` | `jest-axe` with jsdom | jsdom does not render real CSS; contrast checks and ARIA reflection require real browser engine — axe-core in Playwright is more accurate |
| `vitest-axe` | Manual axe-core injection in jsdom | Manual approach misses rendering-dependent violations; `vitest-axe` is simpler for component-level checks |
| Custom PII mask hook | `react-pii-mask` (external library) | Domain-specific masking rules (RA 10173, DSWD requirements) are too specific for generic PII library |
| TanStack Table row selection | Custom checkbox state management | TanStack handles cross-page selection, indeterminate states, and API integration out of box |
| cmdk for search popover | Custom popover + search | cmdk provides keyboard navigation (arrows, enter, escape), filtering, and command palette patterns built-in |

**Installation:**
```bash
npm install --save-dev @axe-core/playwright@4.12.1 vitest-axe@0.1.0
```

**Version verification:**
```
@axe-core/playwright: 4.12.1 — Deque official package, v4.12+ aligns with axe-core v4.12.x
vitest-axe: 0.1.0 — Community maintained, stable since 2022, mirrors jest-axe API
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@axe-core/playwright` | npm | 4+ yr (since 2021) | ~500K+/wk | github.com/dequelabs/axe-core-npm | OK | Approved |
| `vitest-axe` | npm | 4 yr (since 2022) | ~10K+/wk | github.com/chaance/vitest-axe | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        TOPBAR                                │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐ ┌──────────┐ │
│  │ New      │ │ Approvals│ │  🔍 Search...   │ │ Avatar   │ │
│  │ Intake   │ │ Queue    │ │  (cmdk popover) │ │ /Logout  │ │
│  └──────────┘ └──────────┘ └────────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     DASHBOARD PAGE (D-05)                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SLA Widget   │  │ Quick Action │  │ Stats Card   │      │
│  │ (green/amber │  │ Panel        │  │ (role-       │      │
│  │  /red)       │  │ (D-19)       │  │  filtered)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ DataTable (bulk ops via checkbox + toolbar)         │    │
│  │ [☐] Name  [☐] Status  [☐] SLA  [☐] Actions        │    │
│  │ [☑] Juan  [...]      [🔴 5d]  [Approve]            │    │
│  │ [☐] Maria [...]      [🟢 1d]  [Approve]            │    │
│  │ ── "Select all 50 records across pages" ──         │    │
│  │ [Bulk Approve] [Bulk Reassign] [Bulk Export]       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     SEARCH POPOVER (cmdk)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Results: [name, ID, barangay] ← trigram+BM25       │    │
│  │ Keyboard: Arrow↓/↑, Enter to select, Esc to close  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     PII MASKING LAYER                        │
│  usePiiMasking(consentStatus, role) {                       │
│    if (consentStatus === 'revoked') → mask ALL identifiers  │
│    if (role in ['mayor','auditor','claimant']) → mask PII   │
│    if (role in ['social_worker','admin','coordinator'])     │
│      → show full data (unless consent revoked)              │
│  }                                                          │
│  Click-to-reveal: temporarily unmask → log to ledger        │
│  → auto-mask after 30s timeout                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SLA TIMER DISPLAY                         │
│  Client-side: elapsed = now - stage_started_at              │
│  Thresholds per program type:                               │
│    green:  elapsed < 70% of SLA_limit                      │
│    amber:  70% <= elapsed < 90%                            │
│    red:    elapsed >= 90%                                  │
│  Polling: setInterval 60s for real-time updates            │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/
│   ├── a11y/                          # NEW: Accessibility components
│   │   ├── SkipToContent.tsx
│   │   ├── FocusTrap.tsx              # For FamilyGraph if needed
│   │   └── AriaLiveRegion.tsx
│   ├── pii/                           # NEW: PII masking
│   │   ├── MaskedField.tsx            # Click-to-reveal field component
│   │   ├── MaskedDataTable.tsx        # Wrapper applying masks to table cells
│   │   └── UnmaskButton.tsx
│   ├── sla/                           # NEW: SLA display
│   │   ├── SlaTimer.tsx              # Color-coded elapsed time
│   │   └── SlaTooltip.tsx            # Details on hover
│   ├── search/                        # NEW: Global search
│   │   └── GlobalSearch.tsx          # cmdk-based command palette
│   ├── bulk-actions/                  # NEW: Bulk operations
│   │   ├── BulkActionBar.tsx         # Toolbar for selected rows
│   │   ├── BulkApproveDialog.tsx
│   │   └── BulkProgressToast.tsx
│   ├── dashboard/                     # NEW: Role-specific widgets
│   │   ├── DashboardPage.tsx         # Single page, role-filtered widgets
│   │   ├── widgets/
│   │   │   ├── ClaimantWidgets.tsx
│   │   │   ├── MayorWidgets.tsx
│   │   │   ├── AuditorWidgets.tsx
│   │   │   └── CoordinatorWidgets.tsx
│   │   └── StatsCard.tsx
│   └── ui/                           # Existing shadcn components
├── hooks/
│   ├── usePiiMasking.ts              # NEW: Core masking logic + reveal state
│   ├── useSlaTimer.ts                # NEW: Elapsed time calc + polling
│   ├── useDebouncedSearch.ts         # NEW: Debounce + API call
│   └── useBulkSelection.ts           # NEW: Row selection state management
├── lib/
│   ├── pii-utils.ts                  # NEW: Mask functions (name, phone, address)
│   ├── sla-utils.ts                  # NEW: Color threshold logic
│   └── api.ts                        # Existing API layer (add bulk endpoints)
└── tests/
    ├── a11y/                         # NEW: axe-core accessibility tests
    │   ├── axe-setup.ts              # Shared AxeBuilder fixture
    │   ├── pages.test.ts             # Per-page accessibility audit
    │   └── components.test.ts        # Per-component accessibility audit
    ├── pii/                          # NEW: PII masking tests
    ├── sla/                          # NEW: SLA timer tests
    ├── search/                       # NEW: Search tests
    └── bulk-actions/                 # NEW: Bulk operations tests
```

### Pattern 1: axe-core Integration for WCAG Testing

**What:** Automated accessibility testing at two layers (component-level via vitest-axe, page-level via @axe-core/playwright). Components tested in isolation for structural violations; full pages and user flows tested in Playwright for rendered-state violations.

**When to use:** Every PR that modifies UI components. The unit test layer catches structural issues (missing labels, invalid ARIA) quickly. The E2E layer catches rendering-dependent issues (contrast, focus management) and full-flow regressions.

**Example (Component-level):**
```typescript
// tests/a11y/components.test.ts
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { PageShell } from '@/components/PageShell';

test('PageShell has no accessibility violations', async () => {
  const { container } = render(<PageShell title="Test"><p>Content</p></PageShell>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Example (Page-level with Playwright):**
```typescript
// tests/a11y/pages.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Page accessibility audits', () => {
  test('Dashboard page has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .include('#main-content')
      .exclude('.third-party-widget')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
```

### Pattern 2: PII Masking Hook

**What:** Custom React hook that determines whether to mask a value based on the user's role and the beneficiary's consent status. Provides click-to-reveal with auto-timeout.

**When to use:** Every component that displays potentially identifiable personal data (names, phone numbers, addresses, dates of birth, PhilSys numbers).

**Source:** [CITED: RA 10173 Data Privacy Act — consent-based data protection]

```typescript
// hooks/usePiiMasking.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';

type MaskableField = 'name' | 'phone' | 'address' | 'dob' | 'philsys';

const MASK_DISPLAY: Record<MaskableField, string> = {
  name: '***',
  phone: '***-***-****',
  address: '***',
  dob: '**/**/****',
  philsys: '****-****-****',
};

const WORKER_ROLES = ['social_worker', 'admin', 'coordinator'];

export function usePiiMasking(consentStatus: 'active' | 'revoked') {
  const { user } = useAuth();
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const shouldMask = useCallback((): boolean => {
    if (consentStatus === 'revoked') return true; // D-12: revoked consent = mask all
    if (!user) return true;
    // D-10: Only workers see full data when consent is active
    return !WORKER_ROLES.includes(user.role);
  }, [consentStatus, user]);

  const getDisplayValue = useCallback((field: MaskableField, realValue: string): string => {
    if (!shouldMask()) return realValue;
    // D-11: Click-to-reveal temporarily shows real value
    if (revealedFields.has(field)) return realValue;
    return MASK_DISPLAY[field];
  }, [shouldMask, revealedFields]);

  const revealField = useCallback(async (field: MaskableField, beneficiaryId: string, reason: string) => {
    // Clear existing timeout if re-revealing
    const existing = timeoutsRef.current.get(field);
    if (existing) clearTimeout(existing);

    setRevealedFields(prev => new Set(prev).add(field));

    // Log to consent ledger (D-11: who/when/why)
    await fetch(`/api/beneficiaries/${beneficiaryId}/audit/unmask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, reason }),
    });

    // Auto-mask after 30s (the agent's discretion — 30s default)
    const timeout = setTimeout(() => {
      setRevealedFields(prev => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }, 30_000);
    timeoutsRef.current.set(field, timeout);
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  return { shouldMask: shouldMask(), getDisplayValue, revealField };
}
```

### Pattern 3: SLA Timer with Color Thresholds

**What:** Client-side elapsed time calculation with color-coded display indicating SLA compliance status.

**When to use:** Table cells and detail pages showing Intake→Assessment or Assessment→Approval duration.

```typescript
// hooks/useSlaTimer.ts
import { useState, useEffect } from 'react';

interface SlaConfig {
  slaHours: number;        // Per program type (D-16)
  elapsedHours: number;    // Calculated client-side
}

type SlaStatus = 'compliant' | 'warning' | 'breached';

const THRESHOLDS = {
  warning: 0.7,   // 70% of SLA → amber
  breach: 0.9,    // 90% of SLA → red
};

export function useSlaTimer(
  stageStartedAt: string,         // ISO 8601 from server
  slaHours: number,               // Per-program SLA limit
  pollIntervalMs: number = 60_000 // Refresh every 60s
): { elapsedDisplay: string; status: SlaStatus; fractionUsed: number } {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs]);

  const elapsedMs = now - new Date(stageStartedAt).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const fractionUsed = elapsedHours / slaHours;

  let status: SlaStatus;
  if (fractionUsed >= THRESHOLDS.breach) status = 'breached';
  else if (fractionUsed >= THRESHOLDS.warning) status = 'warning';
  else status = 'compliant';

  const elapsedDisplay = elapsedHours < 24
    ? `${Math.round(elapsedHours)}h`
    : `${Math.round(elapsedHours / 24)}d ${Math.round(elapsedHours % 24)}h`;

  return { elapsedDisplay, status, fractionUsed };
}
```

### Pattern 4: Bulk Operations with Row Selection

**What:** TanStack Table checkbox column with "select all across pages" support, confirmation dialog, and Sonner progress toast.

**When to use:** Any DataTable that needs multi-row selection for approval, reassignment, or export.

**Source:** [CITED: TanStack Table v8 Row Selection Guide — getRowId, enableRowSelection, getToggleAllPageRowsSelectedHandler]

```typescript
// column definition snippet for checkbox column
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all rows on this page"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      disabled={!row.getCanSelect()}
      aria-label={`Select row ${row.id}`}
    />
  ),
  enableSorting: false,
  enableHiding: false,
}

// Table config needs getRowId for cross-page selection
const table = useReactTable({
  data,
  columns,
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  getRowId: row => row.uuid,  // Use UUID, not index (for cross-page)
  enableRowSelection: true,
  getCoreRowModel: getCoreRowModel(),
});

// Bulk action handler with progress toast
async function handleBulkApprove(selectedIds: string[]) {
  const toastId = toast.loading(`Approving ${selectedIds.length} cases...`);
  let completed = 0;

  for (const id of selectedIds) {
    try {
      await approveCase(id, 'approved', signature);
      completed++;
      toast.loading(`Approving: ${completed}/${selectedIds.length} complete`, { id: toastId });
    } catch {
      toast.error(`Failed to approve case ${id}`, { id: toastId + '-' + id });
    }
  }

  if (completed === selectedIds.length) {
    toast.success(`Successfully approved ${completed} cases`, { id: toastId });
  } else {
    toast.warning(`Approved ${completed}/${selectedIds.length} cases`, { id: toastId });
  }
}
```

### Anti-Patterns to Avoid

- **Masking at the API layer only:** Server-side masking is important for data-in-transit, but client-side masking via the hook gives instant UX feedback and eliminates the race between masked API response and unmasked render
- **Generic PII masking libraries:** They don't understand RA 10173 consent revocation semantics or per-role rules. Build a custom hook keyed to domain concepts
- **Single SLA threshold for all programs:** D-16 requires per-program configurability. Store `slaHours` in the program configuration table, not as a constant

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility scanning engine | Custom DOM checkers | `@axe-core/playwright` | 57+ WCAG rules, used by US DHS, actively maintained by Deque |
| Checkbox selection state | Manual `useState<Set<string>>` | TanStack Table `rowSelection` + `getRowId` | Handles cross-page selection, indeterminate states, "select all" |
| Search popover command palette | Custom keyboard handling + filtering | `cmdk` (<Command>) | Built-in arrow nav, search, filtering, and focus management |
| Confirmation dialogs | Custom modal with focus trap | shadcn Dialog (Radix) | Radix handles focus trap, Escape, `aria-modal`, portal, scroll lock |
| Toast progress notifications | Custom toast system | Sonner `toast.loading()` + `toast.custom()` | 0 external deps (already installed), promise and custom JSX support |

**Key insight:** The project already has robust primitives (Radix, TanStack Table, Sonner, cmdk). The Phase 12 work is wiring them together with domain-specific hooks, not building new UI primitives.

## Common Pitfalls

### Pitfall 1: axe-core False Positives on Third-Party Widgets
**What goes wrong:** axe-core flags violations in third-party embeds (maps, chat widgets) outside your control.
**Why it happens:** A full-page scan includes every DOM element.
**How to avoid:** Use `AxeBuilder.include('#main-content').exclude('.third-party-widget')` to scope scans to components you own.
**Warning signs:** CI fails on violations from `#intercom-widget` or `.mapbox-container`.

### Pitfall 2: PII Masking Race Condition on Data Fetch
**What goes wrong:** Brief flash of unmasked data before masking hook applies.
**Why it happens:** Masking is a client-side transform; data arrives via API before hook processes it.
**How to avoid:** Apply masking in the API response transformer (server-side) AND in the hook (client-side). Initialize the hook with `shouldMask = true` until the auth state resolves.
**Warning signs:** Users report seeing "Juan Dela Cruz" for a split second before it becomes "***".

### Pitfall 3: getRowId Default Uses Row Index
**What goes wrong:** Selecting row 1 on page 1 deselects row 1 on page 2 when navigating pages.
**Why it happens:** TanStack Table uses row index as ID by default — same index = same ID across pages.
**How to avoid:** Always pass `getRowId: row => row.uuid` when using manual pagination + row selection.
**Warning signs:** Row selection "jumps" between pages during pagination.

### Pitfall 4: SLA Timer Drift with Client Clock
**What goes wrong:** SLA timer shows incorrect elapsed time if client clock is wrong.
**Why it happens:** `Date.now()` is client-local.
**How to avoid:** Receive `stageStartedAt` from server as absolute timestamp. Calculate elapsed as `serverNow - stageStartedAt` with periodic server sync, OR accept client clock as close-enough for per-case display (the spec is visual indicator, not financial accounting).
**Warning signs:** Timer shows negative elapsed time or minutes when hours are expected.

## Code Examples

### SkipToContent Component
```typescript
// components/a11y/SkipToContent.tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-md focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
```

### Global Search with Debounce + cmdk
```typescript
// components/search/GlobalSearch.tsx
import { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search } from 'lucide-react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, loading } = useDebouncedSearch(query, 300);

  // Keyboard shortcut: Ctrl+K to toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-md hover:bg-accent" aria-label="Search beneficiaries (Ctrl+K)">
          <Search size={16} />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden lg:inline-flex ml-4 text-xs">⌘K</kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <Command.Input
            placeholder="Search by name, ID, or barangay..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <Command.List>
            {loading && <Command.Loading>Searching...</Command.Loading>}
            {results.map(r => (
              <Command.Item
                key={r.id}
                value={`${r.fullName} ${r.controlNo} ${r.barangay}`}
                onSelect={() => { window.location.href = `/beneficiaries/${r.id}`; setOpen(false); }}
              >
                <div className="flex flex-col">
                  <span>{r.fullName}</span>
                  <span className="text-xs text-muted-foreground">{r.controlNo} — {r.barangay}</span>
                </div>
              </Command.Item>
            ))}
            {!loading && query && results.length === 0 && (
              <Command.Empty>No results found</Command.Empty>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### DatePicker Pattern (for comparison only — not needed in Phase 12 but demonstrates radix pattern)
```typescript
// Source: Radix UI Popover documentation pattern
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual WCAG testing | Automated axe-core in CI | 2024-2026 | Catches ~30% of WCAG issues automatically; prevents regressions on every PR |
| Server-only PII masking | Client-side masking hook with consent awareness | Phase 12 | Instant UX feedback; eliminates race window; click-to-reveal logged to ledger |
| Static SLA limits | Per-program configurable thresholds | Phase 12 | D-16 compliance; different programs have different timelines under RA 11032 |
| Built-from-scratch table selection | TanStack Table row selection API | 2023 (v8) | Handles cross-page selection, indeterminate states, keyboard nav |

**Deprecated/outdated:**
- `jest-axe`: Prefer `vitest-axe` for Vitest projects to avoid environment conflicts
- Manual confirmation dialogs: shadcn Dialog (Radix) handles ARIA, focus, and keyboard management automatically

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] NVDA is 97% of desktop screen reader usage — targeted as primary screen reader for manual testing | Summary | Low — even if lower, NVDA is the dominant free screen reader on Windows; test coverage also covers general ARIA compliance |
| A2 | [ASSUMED] 30-second default timeout for auto-masking is adequate (the agent's discretion) | Code Examples | Low — configurable; if users need more or less time, the value is a constant |
| A3 | [ASSUMED] 60-second polling interval for SLA timers is adequate | Code Examples | Low — timers are visual indicators, not financial instruments; can be tuned |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

1. **Search endpoint structure**
   - What we know: Existing GIS-04 uses trigram + BM25 on beneficiaries by name/category/barangay
   - What's unclear: Whether the existing search endpoint returns results in a format consumable by cmdk (id, fullName, controlNo, barangay), or if a lightweight wrapper endpoint is needed
   - Recommendation: Reuse existing `/api/beneficiaries?search=:query` with `limit=10` — likely sufficient

2. **SLA configuration storage**
   - What we know: SLA thresholds must be configurable per program type (D-16)
   - What's unclear: Whether the existing program configuration schema already includes an `slaHours` field, or if a migration is needed
   - Recommendation: Add `slaHours` (integer, in hours) to program config; backend migration in Phase 12 or handled as prerequisite

3. **Bulk operation API design**
   - What we know: D-21 requires bulk approve/reassign/export
   - What's unclear: Single POST with array of IDs vs sequential individual requests
   - Recommendation: Single POST endpoint `POST /api/cases/bulk-approve` with `{ ids: string[], signature?: string }` — avoids N+1 request overhead, allows server-side transactional execution

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All frontend tooling | ✓ | 22+ | — |
| npm | Package installs | ✓ | 10+ | — |
| Vitest | Unit tests + a11y component tests | ✓ | 1.2.0 | — |
| Playwright | E2E a11y tests | ✓ | 1.59.1 | — |
| @axe-core/playwright | axe-core E2E scanning | ✗ (needs install) | 4.12.1 | vitest-axe for component-level only |
| vitest-axe | Component a11y assertions | ✗ (needs install) | 0.1.0 | — |
| PostgreSQL 16 | SLA config storage, consent ledger | ✓ (assuming) | 16 | — |

**Missing dependencies with no fallback:** none (both packages installable via npm)

## Validation Architecture

> `workflow.nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.2.0 + Playwright 1.59.1 |
| Config file | `vite.config.ts` (test section) + optional `playwright.config.ts` |
| Quick run command | `npm test` (vitest --run) |
| Full suite command | `npm test:run` (vitest run) + `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | axe-core checks in E2E tests | integration | `npx playwright test tests/a11y/` | ❌ Wave 0 |
| D-03 | Keyboard nav for custom components | unit + manual | `npm test` for focus trap tests | ❌ Wave 0 |
| D-04 | Color contrast compliance | manual (axe-core catches auto) | axe-core E2E scan | ❌ Wave 0 |
| D-10 | PII masking by role + consent | unit | `npm test tests/pii/` | ❌ Wave 0 |
| D-11 | Click-to-reveal logs to consent ledger | unit | `npm test tests/pii/` | ❌ Wave 0 |
| D-15 | SLA timer color indicators | unit | `npm test tests/sla/` | ❌ Wave 0 |
| D-20 | Global search returns results | integration | `npm test tests/search/` | ❌ Wave 0 |
| D-22 | Bulk select across pages | unit | `npm test tests/bulk-actions/` | ❌ Wave 0 |
| D-24 | Sonner progress toast updates | unit | `npm test tests/bulk-actions/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --changed` (vitest related-only)
- **Per wave merge:** `npm test:run` 
- **Phase gate:** Full suite green + `npx playwright test tests/a11y/` zero violations

### Wave 0 Gaps
- [ ] `tests/a11y/axe-setup.ts` — Shared AxeBuilder fixture for Playwright tests
- [ ] `tests/a11y/pages.test.ts` — axe-core page-level audits
- [ ] `tests/a11y/components.test.ts` — vitest-axe component-level audits
- [ ] `tests/pii/masking.test.ts` — PII masking hook tests
- [ ] `tests/sla/timer.test.ts` — SLA elapsed calculation tests
- [ ] `tests/search/global.test.ts` — Search debounce + API call tests
- [ ] `tests/bulk-actions/selection.test.ts` — Row selection state tests

## Security Domain

> `security_enforcement` is enabled in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 12 has no auth changes |
| V3 Session Management | no | Phase 12 has no session changes |
| V4 Access Control | yes | `usePiiMasking` enforces role-based PII reveal; consent revocation masking (D-12) |
| V5 Input Validation | yes | Search input via cmdk (existing zod pipeline) |
| V6 Cryptography | no | No new crypto in Phase 12 |

### Known Threat Patterns for React + NestJS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII exposure via bulk export | Information Disclosure | D-13: masked by default; require explicit reason + audit log |
| Unauthorized unmask via API | Tampering | API-level role+consent check; audit log for every unmask event |
| SLA data manipulation | Tampering | SLA timestamps come from server (`stageStartedAt`); client only calculates elapsed |
| Bulk operation abuse | Denial of Service | Page size limits (agent's discretion); timeout on bulk operations |

## Sources

### Primary (HIGH confidence)
- **@axe-core/playwright documentation** — Deque official package; `AxeBuilder`, `withTags`, `include`/`exclude` API [VERIFIED: npm registry]
- **TanStack Table v8 Row Selection Guide** — `getRowId`, `enableRowSelection`, `rowSelection` state APIs [VERIFIED: tanstack.com/table/v8/docs/guide/row-selection]
- **Radix UI Dialog documentation** — Focus trap, `aria-modal`, `onEscapeKeyDown`, `onOpenAutoFocus` [VERIFIED: radix-ui.com/primitives/docs/components/dialog]
- **Sonner API Reference** — `toast.loading()`, `toast.promise()`, custom JSX, managed toasts [VERIFIED: sonner.emilkowal.ski/toast]
- **cmdk usage patterns** — `<Command>`, `<Command.Input>`, `<Command.List>`, `<Command.Item>` [VERIFIED: cmdk package documentation]

### Secondary (MEDIUM confidence)
- **RA 10173 (Data Privacy Act) — PII masking requirements** — Consent-based masking, audit trail requirements [CITED: official.gov.ph/ra-10173]
- **RA 11032 (Ease of Doing Business) — SLA processing timelines** — Government service processing deadlines [CITED: official.gov.ph/ra-11032]
- **WCAG 2.1 AA compliance criteria** — Color contrast (1.4.3), keyboard navigation (2.1.1), focus management (2.4.3) [CITED: w3.org/TR/WCAG21/]

### Tertiary (LOW confidence)
- **NVDA market share statistics** — WebAIM Screen Reader Survey 2024 results [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry and official docs
- Architecture: HIGH — existing patterns (Radix, TanStack, Sonner) proven in previous phases
- Pitfalls: HIGH — drawn from TanStack Table v8 common issues, axe-core usage patterns, and PII masking edge cases

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable; 7 days for fast-moving parts like axe-core rulesets, but no major version bumps expected)
