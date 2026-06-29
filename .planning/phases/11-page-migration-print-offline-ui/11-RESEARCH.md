# Phase 11: Page Migration, Print & Offline UI - Research

**Researched:** 2026-06-29
**Domain:** React shadcn page migration, CSS print for government documents, offline-aware UI patterns
**Confidence:** HIGH

## Summary

Phase 11 delivers three coordinated workstreams: (1) migrate 16 authenticated pages from legacy CSS to shadcn components + PageShell + proper loading/empty/error states, (2) produce print-ready A4 layouts for four government documents (CSR, Access Card, Intervention Log, IRF), and (3) build the offline-aware UI layer (sync queue panel, cache staleness indicators, enhanced offline banner). All three consume shared components from Phase 10 (PageShell, skeletons, EmptyState, ErrorBoundary, DataTable, BottomNav) and the layout shell from Phase 08.

**Primary recommendation:** Execute migration in the declared D-02 order (Dashboard first as pattern-setter), establish a global print stylesheet approach per UI-SPEC, and build the sync queue panel using the existing `offline-queue.ts` localStorage API wrapped in a lightweight EventEmitter pattern for real-time updates. No new npm packages are needed — all required shadcn components are already installed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page migration (shadcn refactor) | Browser / Client | — | All 16 pages are client-rendered React components; no backend changes |
| Print CSS layouts | Browser / Client | — | `@media print` + `@page` CSS is client-side only; browser handles pagination |
| Sync queue panel (Sheet) | Browser / Client | API / Backend | UI is client-side; data sourced from `localStorage` via `offline-queue.ts`; sync engine events from `sync.ts` |
| Cache staleness indicators | Browser / Client | — | Computed from `lastSyncedAt` timestamps in `VersionVector` data from `offline-queue.ts` |
| Offline banner enhancement | Browser / Client | — | Existing Layout.tsx pattern enhanced with pending count; no backend changes |
| Conflict resolution dialog | Browser / Client | — | `resolveConflict()` function exists in `offline-queue.ts`; UI wraps it with shadcn Dialog |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PGM-01 | Beneficiaries pages migrated to shadcn + states | PageShell + TableSkeleton + DataTable + EmptyState available from Phase 10; use PageShell wrapper pattern |
| PGM-02 | Cases & interventions pages migrated to shadcn + states | DataTable system with server-side sort/search/paginate ready; StatusBadge pattern needs shadcn Badge conversion |
| PGM-03 | Access Card pages migrated to shadcn + print styles | AccessCardPrintView already exists; needs PageShell wrapper + `@media print` integration |
| PGM-04 | IRF module pages migrated to shadcn + states | FormSkeleton + EmptyState + PageShell for IrfPage and IrfDetailPage |
| PGM-05 | Dashboard pages migrated to shadcn + states | DashboardPage sets the pattern for all others — CardGridSkeleton + stat cards + PageShell |
| PGM-06 | Admin/settings pages migrated to shadcn + states | AdminPage has tabbed UI — migrate to shadcn Tabs component; all utility pages follow |
| PRN-01 | Print stylesheet for government reports | Global `@media print` block in `index.css` — update margins to 20mm, add `.no-print` enforcement, serif font, running headers/footers for page numbers |
| PRN-02 | Print-ready case documents | CSR: A4 portrait with MSWDO header + signature block; Access Card: card layout + QR; Intervention Log: column-adjusted table; IRF: form layout + encrypted refs |
| OFF-01 | Enhanced sync status banner | Extend existing Layout.tsx offline banner with pending count + sync progress (already partially done — pending count shown) |
| OFF-02 | Sync queue detail panel | shadcn Sheet component (already installed) + SyncQueuePanel component reading `offline-queue.ts` data; real-time updates via custom EventEmitter or polling |
| OFF-03 | Cache staleness indicators on data | New `cachedAt` prop on PageShell; compare against threshold (5 min, D-17); show "Cached data — last sync X min ago" badge |
| DIF-02 | Offline queue transparency panel | Same as OFF-02 — sync queue panel with pending/syncing/failed/conflict items and resolve actions |

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Migration Strategy
- **D-01:** Incremental page-by-page migration — each page group gets its own plan task, deploy independently
- **D-02:** Migrate order: Dashboard first (most-viewed, pattern-setter), then Beneficiaries, Cases, Access Card/CSR, IRF, Admin/Settings, Claimant Dashboard
- **D-03:** Refactor in place — keep existing business logic, swap DOM/CSS for shadcn components + PageShell wrappers. No rewrites from scratch for complex pages (Intake, Cases, Approvals)
- **D-04:** Each migrated page gets a regression test verifying key elements render (headings, tables, buttons) with mock data. Run all page tests in CI.

#### Print Layout
- **D-05:** Print-ready layouts for CSR, Access Card, Intervention Log, and IRF
- **D-06:** MSWDO Norzagaray header (logo + office name + address) at top. Footer: page numbers, print date, control number. DSWD seal and RA 11032 reference in footer
- **D-07:** A4 portrait, 20mm margins, 12pt serif base font. Tables in intervention log remain portrait with column adjustments
- **D-08:** Signature block (Worker name + signature + date, Client signature + date) on last page only. `break-inside-avoid` on signature block. Page X of Y on every page
- **D-09:** `@media print` CSS hides navigation, sidebar, buttons. Shows clean A4 layout with branding

#### Sync Queue Panel
- **D-10:** Sidebar sliding panel (shadcn Sheet) triggered by sync status button in sidebar/topbar. Calendar-accessible from any page without navigation
- **D-11:** All pending sync operations visible: operation type, entity name, timestamp, status (pending/syncing/failed/conflict)
- **D-12:** Failed items: Retry button. Conflict items: View diff + Resolve (keep local / keep server / keep both). All items: swipe to remove
- **D-13:** Live updates via sync engine events — items show real-time progress (spinner during sync, checkmark on done, X on failure)

#### Cache Staleness Indicators
- **D-14:** Time-based staleness: show "Cached X min ago" badge based on elapsed time since last successful sync
- **D-15:** Subtitle badge on PageShell — "Cached data — last sync X min ago" with clock icon. Not per-card
- **D-16:** All data-fetching pages show staleness indicator when viewing cached data
- **D-17:** Staleness threshold: 5 minutes (matches SWR stale-while-revalidate interval)

### The agent's Discretion
- Exact migration approach for each page (sequential vs batched per task)
- Whether to create a custom sync event emitter or use polling for live updates
- Conflict resolution dialog implementation details
- Swipe-to-remove implementation (third-party lib or native touch events)
- Cache staleness polling interval and implementation detail
- Print stylesheet organization (global file vs inline `@media print`)
- Which shadcn components need conversion per page (e.g., Badge, Card, Table, Input, Select)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui (Radix) | existing (Phase 07) | Component library — Sheet, Dialog, AlertDialog, Badge, Button, Card, Table, Pagination, Tabs | Already installed (26+ components); UI-SPEC confirms no new installs needed [CITED: UI-SPEC §Registry Safety] |
| Lucide React | existing | Icons — Clock, CheckCircle, WifiOff, XCircle, RefreshCw, List, Eye, Trash2, RotateCcw | Already in project; Clock for cache badge, check/x for sync status [CITED: UI-SPEC §Copywriting Contract] |
| Tailwind CSS | 3.4 | Utility-first CSS framework | Already configured; used for all `@media print` styles [VERIFIED: tailwind.config.js] |
| `@tanstack/react-table` | ^8.21.3 | Server-side data tables | Already installed from Phase 10; used in list pages [VERIFIED: package.json Phase 10 STATE.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sonner (toast) | existing | Toast notifications for sync operations | Sync queue retry success/fail, conflict resolution notifications |
| `react-router-dom` | existing | Navigation + URL state for DataTable sort/paginate | Already standard; DataTable params should be URL-encoded |
| `next-themes` | existing | Theme provider | Already integrated; print styles override theme |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Global `@media print` CSS | Per-page print stylesheets | Global is easier to maintain; single source of truth for print rules [CITED: CONTEXT.md §Specific Ideas] |
| Custom EventEmitter for sync | Polling `setInterval` | EventEmitter is more responsive for D-13 "live updates" requirement; polling adds unnecessary CPU cycles [ASSUMED] |
| localStorage polling for queue | IndexedDB + Observer | localStorage `storage` event already listened to in Layout.tsx; polling via `setInterval` is simpler and sufficient for queue panel [ASSUMED] |

**Installation:**
```bash
# No new npm packages required for this phase
# All components already installed from Phase 07-10
```

**Version verification:**
- All dependencies are existing installs from prior phases. No new npm packages are introduced in Phase 11.

## Package Legitimacy Audit

> No new packages are installed in Phase 11. All required shadcn components (Sheet, Dialog, AlertDialog, Badge, Button, Card, Table, Pagination, Tabs, etc.) were installed in Phase 07. The `@tanstack/react-table` dependency was installed in Phase 10. No registry verification needed.

**Packages removed due to [SLOP] verdict:** N/A
**Packages flagged as suspicious [SUS]:** N/A

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Layout.tsx (Phase 08)                        │
│  ┌──────────┐  ┌────────────────────────────────────────────────┐   │
│  │  Sidebar  │  │  Topbar                                        │   │
│  │  (desktop)│  │  ┌──────┐ ┌────────────┐ ┌───────────────┐   │   │
│  │           │  │  │Sync  │ │User Menu   │ │Notification   │   │   │
│  │           │  │  │Status│ │            │ │Bell           │   │   │
│  │           │  │  │Btn   │ │            │ │               │   │   │
│  │           │  │  └──┬───┘ └────────────┘ └───────────────┘   │   │
│  │           │  └─────┼─────────────────────────────────────────┘   │
│  │           │        │                                             │
│  │           │  ┌─────▼─────────────────────────────────────────┐   │
│  │           │  │  <main id="main-content"> (ErrorBoundary)      │   │
│  │           │  │  ┌─────────────────────────────────────────┐  │   │
│  │           │  │  │  PageShell (title + description +        │  │   │
│  │           │  │  │  cache staleness badge in description)   │  │   │
│  │           │  │  │  ┌───────────────────────────────────┐  │  │   │
│  │           │  │  │  │  Page Content                      │  │  │   │
│  │           │  │  │  │  ├── Loading → Skeleton           │  │  │   │
│  │           │  │  │  │  ├── Empty → EmptyState           │  │  │   │
│  │           │  │  │  │  ├── Error → ErrorBoundary        │  │  │   │
│  │           │  │  │  │  └── Data → shadcn UI             │  │  │   │
│  │           │  │  │  └───────────────────────────────────┘  │  │   │
│  │           │  │  └─────────────────────────────────────────┘  │   │
│  │           │  └────────────────────────────────────────────────┘   │
│  │           │                                                       │
│  │           │  ┌────────────────────────────────────────────────┐   │
│  │           │  │  BottomNav (mobile, <768px)                     │   │
│  │           │  └────────────────────────────────────────────────┘   │
│  └──────────┘                                                       │
│                                                                     │
│  Offline Banner (fixed top, z-50, amber-500)                       │
│  Sync Queue Sheet (right side, SlideOver animation)                │
│    ├── Pending items (amber badge, spinner on syncing)             │
│    ├── Failed items (red badge, Retry Sync button)                 │
│    ├── Conflict items (orange badge, View Diff → Dialog)           │
│    └── Empty state: CheckCircle + "All caught up"                  │
└─────────────────────────────────────────────────────────────────────┘

Data Flow:
  offline-queue.ts (localStorage) ──poll/event──► SyncQueuePanel
       │
       ▼
  sync.ts ──► Server API /api/sync/v1
       │
       ▼
  markSynced/markConflict/markFailed ──► localStorage ──► UI refresh

  VersionVector.lastSyncedAt ──► CacheStalenessBadge ──► PageShell description
```

### Recommended Project Structure

```
kapwa-client/src/
├── components/
│   ├── SyncQueuePanel.tsx       # NEW — shadcn Sheet with sync queue items
│   ├── CacheStalenessBadge.tsx  # NEW — staleness indicator (or inline in PageShell)
│   ├── SyncStatusBanner.tsx     # NEW — enhanced offline banner (extract from Layout.tsx)
│   ├── PrintDocument.tsx        # NEW — print wrapper component
│   ├── ConflictResolutionDialog.tsx  # NEW — conflict resolution UI
│   └── PageShell.tsx            # MODIFIED — add cachedAt prop for staleness badge
├── lib/
│   ├── sync-events.ts           # NEW — lightweight EventEmitter for sync events
│   └── offline-queue.ts         # UNCHANGED — existing queue management
├── pages/                       # MODIFIED — all 16 pages refactored in place
└── index.css                    # MODIFIED — expanded @media print block
```

### Pattern 1: PageShell Migration Pattern (All Pages)
**What:** Wrap existing page content with PageShell, replace loading spinners with skeleton components, replace empty/error states with EmptyState/ErrorBoundary, replace legacy CSS with shadcn components.

**When to use:** Every page migration follows this exact pattern:
1. Import PageShell, wrap content
2. Replace `<div className="spinner" />` with skeleton (TableSkeleton, CardGridSkeleton, or FormSkeleton)
3. Replace empty state divs with `<EmptyState variant="no-data" />` or `variant="no-results"`
4. Replace `<button className="btn btn-primary">` with `<Button>` from shadcn
5. Replace `<table className="table">` with `<DataTable>` from Phase 10
6. Replace `<span className="badge-*">` with `<Badge variant="*">`
7. Add `cachedAt` prop to PageShell for cache staleness
8. Add regression test per D-04

**Example:**
```tsx
// Source: derived from Phase 10 PageShell pattern + CONTEXT.md D-03
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';

export function CasesPage() {
  const [data, setData] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // ... existing business logic unchanged per D-03 ...

  if (loading) {
    return (
      <PageShell title="Cases" description="Manage case records">
        <TableSkeleton rows={5} />
      </PageShell>
    );
  }

  if (data.length === 0) {
    return (
      <PageShell title="Cases" description="Manage case records">
        <EmptyState variant="no-data" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Cases"
      description="Manage case records"
      cachedAt={lastSync ?? undefined}
      actions={<Button>New Case</Button>}
    >
      <DataTable
        columns={columns}
        data={data}
        // ... sort/search/paginate props
      />
    </PageShell>
  );
}
```

### Pattern 2: Global Print Stylesheet
**What:** A single `@media print` block in `index.css` that hides `.no-print` elements and formats content as A4 government documents.

**When to use:** Applied globally — every page that triggers `window.print()` uses these styles.

**Example (CSS for `index.css` update):**
```css
/* Source: W3C CSS Paged Media Module, adapted for MSWDO Norzagaray govt docs */
@media print {
  @page {
    size: A4 portrait;
    margin: 20mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 9pt;
      font-family: Georgia, 'Times New Roman', serif;
      color: #333;
    }
    @bottom-left {
      content: "MSWDO Norzagaray — " counter(page);
      font-size: 8pt;
    }
    @bottom-right {
      content: "Printed: " var(--print-date);
      font-size: 8pt;
    }
  }

  @page :first {
    @top-center {
      content: element(msdwoHeader);
    }
  }

  body {
    font-family: Georgia, 'Times New Roman', serif !important;
    font-size: 12pt !important;
    line-height: 1.4 !important;
    color: #000 !important;
    background: white !important;
  }

  .no-print { display: none !important; }

  /* Hide layout chrome */
  nav, .sidebar, .topbar, .bottom-nav,
  button:not(.print-trigger),
  .breadcrumb-nav { display: none !important; }

  /* Print-specific elements */
  .print-header {
    position: running(msdwoHeader);
    text-align: center;
    font-family: 'Lexend', sans-serif;
    border-bottom: 2px solid #000;
    margin-bottom: 12pt;
  }

  .print-footer {
    text-align: center;
    font-size: 8pt;
    border-top: 1px solid #ccc;
    padding-top: 4pt;
    margin-top: 12pt;
  }

  .signature-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 24pt;
  }

  table { break-inside: auto; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }

  a { color: #000 !important; text-decoration: underline; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 9pt; }

  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

### Pattern 3: Sync Queue Panel with Polling (No EventEmitter Needed)
**What:** The existing `offline-queue.ts` uses localStorage. We can poll for changes via `setInterval` and rely on the `storage` event for cross-tab updates. This avoids adding a new EventEmitter system.

**When to use:** For initial implementation of OFF-02/DIF-02. EventEmitter can be added later if polling latency is unacceptable for the "real-time progress" requirement (D-13).

**Example:**
```tsx
// Source: derived from offline-queue.ts API + shadcn Sheet docs
import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadQueue, markFailed, markConflict, loadVersions } from '@/lib/offline-queue';
import { Clock, CheckCircle, RefreshCw, XCircle, AlertTriangle, Eye, Trash2 } from 'lucide-react';

const POLL_INTERVAL = 2000; // 2 second polling for live updates

export function SyncQueuePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [items, setItems] = useState(loadQueue());

  // Poll for changes
  useEffect(() => {
    const interval = setInterval(() => {
      setItems(loadQueue());
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Also listen for cross-tab storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'kapwa_sync_queue') setItems(loadQueue());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const pending = items.filter(i => i.status === 'pending');
  const syncing = items.filter(i => i.status === 'syncing');
  const failed = items.filter(i => i.status === 'failed');
  const conflicts = items.filter(i => i.status === 'conflict');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Sync Queue</SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? 'All changes are synced with the server'
              : `${items.length} pending change(s)`}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <CheckCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-medium">All caught up</p>
              <p className="text-sm text-muted-foreground">Your data is synced with the server.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <SyncQueueItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
```

### Anti-Patterns to Avoid
- **Complex EventEmitter for sync events before polling proves insufficient:** Start with 2-second polling + `storage` event listener. Only add EventEmitter if cross-component update latency becomes a problem.
- **Per-page print overrides:** Avoid scattering `@media print` across individual page files. Use one global block in `index.css` with `.no-print` classes on layout elements.
- **Rewrite data fetching during migration:** Per D-03, keep existing business logic (API calls, data mappers, event handlers) intact. Only swap DOM/CSS. Complex pages (Intake, Cases, Approvals) stay as-is inside the PageShell wrapper.
- **Custom swipe-to-remove library:** The UI-SPEC mentions swipe to remove sync items. Use native touch events + `onTouchStart`/`onTouchEnd` for a minimal implementation. Don't import a gesture library.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page numbering in print | Custom JS counter | CSS `counter(page)` / `counter(pages)` | Part of CSS Paged Media spec; works in Chromium; no JS needed |
| Running headers in print | Absolute positioned elements | `position: running()` CSS | Standard CSS Paged Media spec; `@page` margin boxes work in Chrome |
| Page sheet/overlay panel | Custom slide-over | shadcn Sheet (Radix Dialog) | Already installed; handles focus trap, escape key, overlay, animation |
| Modal/dialog for conflict resolution | Custom modal | shadcn Dialog or AlertDialog | Already installed; accessible, keyboard-friendly |
| Status badges | Custom styled spans | shadcn Badge component | Already installed; variant prop covers default/secondary/destructive/outline |
| Responsive table | Custom horizontal scroll wrapper | Existing DataTable from Phase 10 | Already built with `overflow-x-auto` + shadcn Table |
| Empty/error states | Custom divs | EmptyState + ErrorBoundary from Phase 10 | Already built with 4 variants + network detection |

**Key insight:** Phase 10 already built all the state handling infrastructure. This phase is about wiring existing components into 16 pages, not creating new primitives. The only genuinely new code is the SyncQueuePanel UI, the print stylesheet expansion, and the cache staleness integration.

## Common Pitfalls

### Pitfall 1: Broken Print Layouts in Firefox/Safari
**What goes wrong:** Running headers/footers (`@top-center`, `@bottom-left`), `counter(page)`, and `position: running()` are Chromium-only — they don't work in Firefox or Safari's PDF renderer. Government users may use different browsers.
**Why it happens:** CSS Paged Media Level 3 margin boxes are only implemented in Chromium (Chrome, Edge, Opera).
**How to avoid:** Design print layouts to degrade gracefully — use `@page { margin }` (supported everywhere) for basic layout, and treat running headers/footers as Chromium-only enhancement. Add JS-based page numbering as fallback via `window.print()` event listener.
**Warning signs:** Print preview shows no page numbers or missing headers in non-Chromium browsers.

### Pitfall 2: Incomplete `.no-print` Coverage
**What goes wrong:** Some interactive elements (toasts, dropdowns, overlays) appear in the printed output.
**Why it happens:** Developers forget to add `.no-print` to every non-print element, or a new component added later doesn't get the class.
**How to avoid:** Add a global `@media print { body * { visibility: hidden; } .print-content, .print-content * { visibility: visible; } }` approach after debug phase, wrapping print content in a `.print-content` container. This is more robust than per-element `.no-print`.
**Warning signs:** Screen-only UI elements appearing in print preview.

### Pitfall 3: Cache Staleness Reading Wrong Timestamp
**What goes wrong:** The staleness badge shows "0 min ago" or outdated data because `lastSyncedAt` reflects a stale `VersionVector` from localStorage.
**Why it happens:** `VersionVector.lastSyncedAt` is only updated when `markSynced()` is called; stale data read from cache doesn't update the timestamp.
**How to avoid:** For cache staleness, track `fetchedAt` (when data was loaded into the page) separately from `lastSyncedAt` (when data was synced to server). The staleness badge should compare `fetchedAt` against current time, not `lastSyncedAt`.
**Warning signs:** Staleness badge shows inconsistent values after navigating between pages.

### Pitfall 4: Sync Queue Panel Performance with Many Items
**What goes wrong:** 2-second polling + full queue re-render becomes slow when queue has 100+ items.
**Why it happens:** `loadQueue()` parses the full JSON array on every poll; React re-renders all items even if only one status changed.
**How to avoid:** Memoize the parsed queue with a `useMemo` keyed on a quick hash, or only parse the queue when the Sheet is open. Virtualize the scroll area if needed (but unlikely — queue items are deleted after syncing).
**Warning signs:** Visible lag when opening the Sync Queue Sheet after prolonged offline use.

## Code Examples

### Adding `cachedAt` prop to PageShell

```tsx
// Source: Phase 10 PageShell component, modified per D-14 through D-17
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  cachedAt?: number; // timestamp of last data fetch
  children: React.ReactNode;
}

const STALENESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (matching SWR stale-while-revalidate)

function useCacheStaleness(cachedAt?: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!cachedAt) return;
    const elapsed = now - cachedAt;
    if (elapsed < STALENESS_THRESHOLD_MS) return; // still fresh

    const interval = setInterval(() => setNow(Date.now()), 30_000); // update every 30s
    return () => clearInterval(interval);
  }, [cachedAt]);

  if (!cachedAt) return null;
  const elapsed = Date.now() - cachedAt;
  if (elapsed < STALENESS_THRESHOLD_MS) return null;

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes === 0) return 'Cached data — last sync less than a minute ago';
  return `Cached data — last sync ${minutes} min ago`;
}

export function PageShell({ title, description, actions, cachedAt, children }: PageShellProps) {
  const stalenessText = useCacheStaleness(cachedAt);
  const fullDescription = [description, stalenessText].filter(Boolean).join(' — ');

  return (
    <div className="flex flex-col gap-4 lg:gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">{title}</h1>
          {fullDescription && (
            <p className="text-sm text-muted-foreground mt-1">
              {stalenessText && <Clock className="inline-block h-3 w-3 mr-1 align-middle" aria-hidden="true" />}
              {fullDescription}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
```

### Conflict Resolution Dialog

```tsx
// Source: offline-queue.ts resolveConflict + mergeRecords functions
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QueuedChange, resolveConflict } from '@/lib/offline-queue';

interface ConflictResolutionDialogProps {
  change: QueuedChange;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResolve: (id: string, strategy: 'client-wins' | 'server-wins') => void;
}

export function ConflictResolutionDialog({ change, open, onOpenChange, onResolve }: ConflictResolutionDialogProps) {
  const serverPayload = change.payload; // server data
  const clientPayload = JSON.parse(localStorage.getItem(`kapwa_pending_${change.recordId}`) || '{}');

  const handleResolve = (strategy: 'client-wins' | 'server-wins') => {
    onResolve(change.id, strategy);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Resolve Conflict</DialogTitle>
          <DialogDescription>
            This item was modified by another user while you were offline. Choose how to resolve.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Your Changes (Local)</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(clientPayload, null, 2)}
            </pre>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Server Changes</h4>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(serverPayload, null, 2)}
            </pre>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => handleResolve('server-wins')}>
            Keep Server
          </Button>
          <Button variant="default" onClick={() => handleResolve('client-wins')}>
            Keep Local
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy CSS classes (`btn btn-primary`, `badge-*`, `table`, `form-input`) | shadcn components (`<Button>`, `<Badge>`, `<DataTable>`, `<Input>`) | Phase 11 | All 16 pages need class replacement; business logic stays identical |
| Custom spinner divs | shadcn Skeleton + skeleton variants (TableSkeleton, CardGridSkeleton, FormSkeleton) | Phase 10 | Replace `<div className="spinner" />` with specific skeleton components |
| Custom empty state divs | EmptyState component with 4 variants | Phase 10 | Replace ad-hoc empty divs with `<EmptyState variant="*">` |
| 15mm A4 print margins in existing `@media print` | 20mm A4 print margins + running footers + serif fonts | Phase 11 (D-07) | Update `index.css` `@page` rule; existing 15mm margin must change |
| Basic "You are offline" banner | Enhanced banner with pending count + sync progress | Phase 11 (OFF-01) | Existing Layout.tsx already has partial implementation — extend it |
| No sync queue visibility | SyncQueuePanel in shadcn Sheet | Phase 11 (OFF-02 / DIF-02) | New component — no prior version |
| No cache staleness indicators | CacheStalenessBadge via PageShell `cachedAt` prop | Phase 11 (OFF-03) | New feature — no prior version |

**Deprecated/outdated:**
- Legacy CSS classes: `.btn`, `.badge-*`, `.table`, `.form-input`, `.spinner`, `.empty-state`, `.page-header`, `.page-title`, `.page-desc`, `.toolbar`, `.toolbar-left`, `.toolbar-right` — all should be replaced with shadcn alternatives during migration
- Hard-coded `@page { margin: 15mm }` — must be updated to 20mm per D-07

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Polling `setInterval` at 2s is sufficient for "real-time" sync progress display | Architecture Patterns (Pattern 3) | If sync operations complete in <500ms, polling delay may be noticeable; switch to EventEmitter |
| A2 | No new shadcn components need installation | Standard Stack | If SyncQueuePanel needs a component not in the 26+ installed set (e.g., `Resizable`), must install via CLI |
| A3 | `counter(page)` and `counter(pages)` work only in Chromium | Common Pitfalls (Pitfall 1) | In Firefox/Safari, page numbers must be generated via JS or hidden |
| A4 | Existing business logic in pages (API calls, data mapping) stays unchanged during migration | User Constraints (D-03) | If business logic is tightly coupled to DOM structure, extraction may be needed |
| A5 | The `storage` event + `setInterval` polling is sufficient for cross-component sync state | Architecture Patterns (Pattern 3) | If Dashboard and SyncQueuePanel need simultaneous reactivity, may need shared context |

## Open Questions

1. **How to handle `@@page` margin boxes in non-Chromium browsers?**
   - What we know: `@top-left`, `@bottom-center`, `counter(page)` etc. are Chromium-only.
   - What's unclear: What browsers MSWDO field workers use. If they use Chrome (common on Android), this is fine.
   - Recommendation: Implement as Chromium enhancement with graceful degradation. Add a `beforeprint`/`afterprint` JS listener as fallback for non-Chromium browsers.

2. **Should the SyncQueuePanel use a React Context for shared state or poll independently?**
   - What we know: The Layout.tsx already polls `pendingCount` via `loadQueue()`.
   - What's unclear: Whether Dashboard's stat cards also need to reflect pending sync state.
   - Recommendation: Start with independent polling per component. Extract a shared context if cross-component reactivity becomes a requirement.

3. **How to handle the `cachedAt` timestamp for pages that fetch data in different ways?**
   - What we know: Some pages use `useEffect` with `fetch()`, some use `getDashboard()` from `api.ts`.
   - What's unclear: Where to inject the `cachedAt` tracking — at the API layer or per-page.
   - Recommendation: Track `fetchedAt` at the page level with a `useState(Date.now())` after successful data load. A per-page ref is simpler and avoids cross-page coupling.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/Dev | ✓ | — | — |
| npm | Package mgmt | ✓ | — | — |
| shadcn components (26+) | All pages | ✓ (Phase 07) | — | Not needed |
| @tanstack/react-table | DataTable pages | ✓ (Phase 10) | ^8.21.3 | — |
| Vitest | Regression tests | ✓ (Phase 10) | ^1.2.0 | — |
| @testing-library/react | Component tests | ✓ (Phase 10) | ^16.3.2 | — |

**Missing dependencies with no fallback:** None — all dependencies installed from prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.2.0 + @testing-library/react ^16.3.2 |
| Config file | `kapwa-client/vitest.config.ts` (from Phase 10) |
| Quick run command | `npm test -- --run` in `kapwa-client/` |
| Full suite command | `npm test -- --run` in `kapwa-client/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PGM-01–PGM-06 | Each migrated page renders key elements (headings, tables, buttons) with mock data | unit | `npm test -- --run` | ❌ Wave 0 |
| OFF-01 | Offline banner shows pending count | unit | `npm test -- --run` | ❌ Wave 0 |
| OFF-02 | Sync queue panel renders queue items | unit | `npm test -- --run` | ❌ Wave 0 |
| OFF-03 | Cache staleness badge shows when `cachedAt > 5 min` | unit | `npm test -- --run` | ❌ Wave 0 |
| PRN-01 | Print styles hide `.no-print` elements (CSS-only — visual verification) | manual | — | Manual only (print preview) |
| PRN-02 | Print layouts show correct document structure | manual | — | Manual only (print preview) |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (quick unit test check)
- **Per wave merge:** `npm test -- --run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `kapwa-client/src/components/SyncQueuePanel.test.tsx` — covers OFF-02
- [ ] `kapwa-client/src/components/PageShell.test.tsx` — update existing test for `cachedAt` prop (OFF-03)
- [ ] `kapwa-client/src/pages/DashboardPage.test.tsx` — covers PGM-05 pattern
- [ ] `kapwa-client/src/pages/CasesPage.test.tsx` — covers PGM-02 pattern
- [ ] `kapwa-client/src/pages/BeneficiariesPage.test.tsx` — covers PGM-01 pattern

## Security Domain

> `security_enforcement` is `true` in config. Security domain included for completeness.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | No | Page migration does not change input handling; forms use existing Zod/shared form validation |
| V6 Cryptography | No | Print and offline UI layers do not handle encryption |

### Known Threat Patterns for React + shadcn Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| localStorage XSS via `queueChange` payload | Tampering | `offline-queue.ts` payload is parsed JSON; existing business logic sanitizes on write; no change in Phase 11 |
| Print document leaking sensitive PII | Information Disclosure | Print documents (CSR, Access Card) contain PII — access gated by ProtectedRoute roles; print function is same as screen access |

**No new attack surface introduced in Phase 11.** The sync queue panel reads from localStorage (same data the sync engine already writes). Print styles only control visual presentation — no data transformation.

## Sources

### Primary (HIGH confidence)
- Phase 11 CONTEXT.md — All locked decisions D-01 through D-17, code context, integration points
- Phase 11 UI-SPEC.md — Visual design contract, copywriting, spacing, typography, color, component inventory, interaction design
- Phase 10 STATE.md — Shared component API surface, test infrastructure, dependency versions
- Architecture.md + Structure.md — Project structure, module responsibilities, data flow patterns
- Codebase files (PageShell, Layout.tsx, offline-queue.ts, sync.ts, index.css, routes.tsx) — Verified existing implementation

### Secondary (MEDIUM confidence)
- shadcn/ui official docs (ui.shadcn.com/docs/components/sheet, badge, dialog) — Component API verification
- MDN `@page` CSS at-rule documentation — Print margin box spec
- W3C CSS Paged Media Module Level 3 — Running headers/footers spec
- WebSearch results on GOVTNZ/print-ready — Government print standards reference

### Tertiary (LOW confidence)
- WebSearch results on react-offline-first offline UI patterns — Pattern inspiration only; implementation uses existing local storage infrastructure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All components are verified installed; no new packages needed
- Architecture: HIGH — Patterns are directly derived from existing code (PageShell, offline-queue.ts, sync.ts, Layout.tsx)
- Pitfalls: MEDIUM — Print layout behavior in non-Chromium browsers is well-documented but not yet tested on target machines

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable stack; no fast-moving dependencies)
