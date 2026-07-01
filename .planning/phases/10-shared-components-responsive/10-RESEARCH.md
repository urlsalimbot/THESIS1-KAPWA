# Phase 10 — Shared Components & Responsive — Research

**Researched:** 2026-06-28
**Domain:** Page-state components, responsive patterns, touch-friendly UI
**Confidence:** HIGH

## Summary

Phase 10 delivers reusable page-state components and responsive patterns that every authenticated page in the Kapwa app will consume. The research confirms that the codebase is well-prepared — all required shadcn primitives (Skeleton, Table, Sonner, Sheet, Tabs, ScrollArea) were installed in Phase 7, the Layout shell from Phase 8 provides the `<main>` insertion point, and Lucide icons are already in dependencies.

**Primary recommendation:** Create 5 new shared components (`PageShell`, `DataTable` with TanStack Table, `EmptyState`, `ErrorBoundary` rewrite, `BottomNav`) and wire Sonner `Toaster` into routes. Install `@tanstack/react-table` and shadcn Pagination. The page migration tasks in Phase 11 will consume these components — they need clean, documented interfaces.

**Key integration points:**
1. `<main id="main-content">` in Layout.tsx — PageShell wraps content injected here
2. `routes.tsx` — ErrorBoundary currently wraps RouterProvider; move per D-13 to wrap `<main>` in Layout
3. `src/components/ui/sonner.tsx` — Toaster exists but is NOT wired; add to routes.tsx or Layout.tsx
4. Layout.tsx — BottomNav appends after `</main>` on mobile, hidden on desktop via `<768px` media query
5. Existing CSS `@layer legacy` classes (`.page-header`, `.page-title`, `.page-desc`) — PageShell replaces these

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### PageShell Wrapper
- D-01: PageShell includes title + description + actions in a sticky header section
- D-02: Responsive spacing — gap-4 on mobile, gap-8 on desktop between header and content
- D-03: Breadcrumbs remain in Layout.tsx (Phase 08) — PageShell handles per-page title/actions only
- D-04: Description is a single line of muted subtitle text below the title

#### Skeleton Components
- D-05: Table skeletons are row-based, matching table column layout with variable widths (3–5 rows)
- D-06: Card grid skeletons match actual grid count (2 cols desktop, 1 mobile)
- D-07: Default shadcn pulse animation — no shimmer or static variants
- D-08: Form skeletons render full form layout matching all fields

#### Empty State Views
- D-09: Single reusable EmptyState component with variant prop: no-data, no-results, offline, no-access
- D-10: Lucide icons for all 4 variants
- D-11: Named CTA per variant
- D-12: Professional/informative message tone

#### Error Boundary
- D-13: Single global `<ErrorBoundary>` wrapping `<main>` in Layout.tsx
- D-14: Displays error icon + "Something went wrong" message + Retry button + "Go Home" link
- D-15: Retry resets error boundary state (does NOT reload page)
- D-16: Differentiates network errors vs render errors

#### Sonner Toast Notifications
- D-17: Toasts positioned top-center
- D-18: Manual dismiss only — no auto-dismiss
- D-19: Error toasts are also manual dismiss only
- D-20: Simple/default Sonner styling with app color tokens

#### Bottom Tab Navigation
- D-21: 5 tabs: Dashboard, Cases, Beneficiaries, Profile + center Quick Action button
- D-22: Visible on mobile (<768px) always, optionally on tablet (<1024px); desktop uses sidebar
- D-23: Active tab uses pill/highlight background behind icon
- D-24: Center Quick Action button opens GIS intake form directly

#### 44px Touch Targets
- D-25: Audit existing interactive elements AND enforce on all new components
- D-26: Primary targets: inline action buttons, icon-only buttons, clickable badges/pills
- D-27: Global CSS override approach — min-h-[44px] and min-w-[44px] on all interactive elements

#### Table Interaction Patterns
- D-28: Server-side sorting (sort params sent to API)
- D-29: Single search bar above table filtering across columns
- D-30: Page numbers + prev/next (shadcn Pagination component)
- D-31: Native horizontal scroll wrapper (overflow-x-auto) for mobile tables

### The Agent's Discretion
- Exact column layout for each table (varies by page)
- Search debounce timing and minimum character threshold
- Empty state icon selection per variant
- Toast component integration details (Sonner wrapper setup)
- Error boundary component implementation details
- Bottom nav bar height and animation specifics
- Touch target CSS selector strategy for global override

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STT-01 | PageShell wrapper with consistent padding, title, breadcrumbs | D-01 to D-04 locked; PageShell does NOT include breadcrumbs (D-03 clearly separates concerns). Breadcrumbs stay in Layout.tsx (Phase 08). PageShell provides title + description + actions section. |
| STT-02 | Loading skeleton states on every data-fetching page | D-05 to D-08 locked. shadcn `<Skeleton>` installed (Phase 7) with `animate-pulse`. 3 skeleton variants needed: TableSkeleton, CardGridSkeleton, FormSkeleton. |
| STT-03 | Empty state placeholders with icon, message, optional CTA | D-09 to D-12 locked. Single `<EmptyState>` with `variant` prop. Lucide icons already in deps. CTAs per variant. |
| STT-04 | Error boundaries with fallback UI | D-13 to D-16 locked. Existing ErrorBoundary.tsx is minimal placeholder — complete rewrite needed. Network vs render error differentiation via navigator.onLine check. |
| STT-05 | Toast notifications via Sonner for CRUD operations | D-17 to D-20 locked. Sonner wrapper exists (`ui/sonner.tsx`) but NOT wired. Must add `<Toaster>` to routes.tsx. toast.promise API handles loading/success/error states. |
| RES-01 | Mobile bottom tab navigation | D-21 to D-24 locked. 5 tabs. Visible <768px. Coexists with sidebar (sidebar hidden on mobile via `hidden lg:block`). Added to Layout.tsx after `<main>`. |
| RES-02 | Responsive data tables with sort/filter/paginate | D-28 to D-31 locked. Need `@tanstack/react-table` (NOT installed) + shadcn Pagination (NOT installed). Server-side sorting via query params sent to API. |
| RES-03 | Touch-friendly form controls (min 44px touch targets) | D-25 to D-27 locked. Global CSS approach. shadcn Button default `h-10 px-4 py-2` needs overrides. Icon buttons `h-10 w-10` already meet 44px. Inline/link buttons need audit. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PageShell wrapper | Client (React) | — | Wraps page content with standard layout. No server/API interaction. |
| Skeleton components | Client (React) | — | Pure presentational components. No data dependency. |
| EmptyState component | Client (React) | — | Pure presentational. Receives variant as prop. |
| Error Boundary | Client (React) | — | React class component. Catches render errors client-side. |
| Toast notifications | Client (Sonner) | — | Sonner manages its own state; toast() is imperative from anywhere. |
| Bottom tab navigation | Client (React) | — | Pure presentation + routing via react-router Links. |
| Data table (sort/filter/paginate) | Client (TanStack Table) | API (NestJS) | Sort/filter params sent to backend. Table renders client-side. |
| Touch target enforcement | Client (CSS) | — | Global CSS rules on interactive elements. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | ^8.20 | Headless table with sorting, filtering, pagination | Official shadcn Data Table recommendation; headless = full styling control |
| `sonner` | ^2.0.7 | Toast notifications | Already installed (Phase 7); `toast.promise` API perfect for CRUD. [VERIFIED: npm registry] |
| `lucide-react` | ^1.14 | Icons for empty states, error boundary, bottom nav | Already installed; used throughout app. [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `<Skeleton>` | — | Loading placeholder component | Installed Phase 7; used as base for skeleton variants |
| shadcn `<Pagination>` | — | Page numbers + prev/next | Install via `npx shadcn add pagination` — NOT currently installed |
| shadcn `<Table>` | — | Semantic table HTML | Installed Phase 7; used as base rendering layer for DataTable |
| shadcn `<Sheet>` | — | Mobile sidebar drawer | Installed Phase 7; already used in Layout.tsx |
| shadcn `<Tabs>` | — | Tab-based navigation | Installed Phase 7; alternative pattern if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-table` | AG Grid, MUI DataGrid | AG Grid adds 200KB+ bundle. TanStack is headless + shadcn native |
| Sonner | react-hot-toast, notistack | Sonner already installed. Promise API is best-in-class for loading→success→error states |
| Custom ErrorBoundary | react-error-boundary | react-error-boundary is a thin wrapper; the class component pattern is straightforward enough to own |

**Installation:**
```bash
npm install @tanstack/react-table
npx shadcn@latest add pagination
```

**Version verification:**
```bash
npm view @tanstack/react-table version   # Expected: 8.20.x
npm view sonner version                   # Expected: ^2.0.7 (already installed)
```

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@tanstack/react-table` | npm | ~4 yrs | ~4M/wk | github.com/TanStack/table | [OK] | Approved — install |
| `@tanstack/react-table` is already installed in Phase 7's shadcn ecosystem - it's required by the Data Table pattern. The `sonner` and `lucide-react` are already installed from Phase 7. No new packages beyond `@tanstack/react-table` and shadcn `pagination` need installation.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Layout.tsx (Phase 8)                    │   │
│  │  ┌──────────┐  ┌────────────────────────────────┐   │   │
│  │  │  Topbar  │  │   <main id="main-content">      │   │   │
│  │  └──────────┘  │                                │   │   │
│  │  ┌──────────┐  │  ┌──────────────────────────┐  │   │   │
│  │  │ Sidebar  │  │  │  <ErrorBoundary>          │  │   │   │
│  │  │(desktop) │  │  │  ┌────────────────────┐  │  │   │   │
│  │  └──────────┘  │  │  │  <PageShell>        │  │  │   │   │
│  │                │  │  │  ┌──────────────┐   │  │  │   │   │
│  │  ┌──────────┐  │  │  │  │  Page Content │   │  │  │   │   │
│  │  │ BottomNav│  │  │  │  │ (children)    │   │  │  │   │   │
│  │  │ (mobile) │  │  │  │  └──────────────┘   │  │  │   │   │
│  │  └──────────┘  │  │  └────────────────────┘  │  │   │   │
│  │                │  └──────────────────────────┘  │   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  <Toaster /> │  │  <EmptyState>│  │  <DataTable>     │  │
│  │  (Sonner)    │  │  4 variants  │  │  TanStack Table  │  │
│  └──────────────┘  └──────────────┘  │  + Pagination    │  │
│                                      └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                              ▲
         │  GET /api/cases?sort=...     │  JSON response
         │  &page=1&limit=10            │  with total count
         ▼                              │
┌─────────────────────────────────────────────────────────────┐
│                    NestJS API Server                         │
│              (Phase 7 - existing endpoints)                  │
│  /api/cases?sort=updatedAt.desc&page=1&limit=10             │
│  /api/beneficiaries?search=...&category=...&page=...         │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
kapwa-client/src/
├── components/
│   ├── PageShell.tsx           # NEW: Consistent page wrapper
│   ├── EmptyState.tsx          # NEW: 4 empty-state variants
│   ├── ErrorBoundary.tsx       # REWRITE: Network-aware error boundary
│   ├── BottomNav.tsx           # NEW: Mobile bottom tab navigation
│   ├── data-table/
│   │   ├── DataTable.tsx       # NEW: TanStack Table wrapper
│   │   ├── DataTablePagination.tsx  # NEW: Pagination controls
│   │   ├── DataTableToolbar.tsx     # NEW: Search + filter bar
│   │   ├── DataTableColumnHeader.tsx # NEW: Sortable column header
│   │   └── index.ts           # Barrel export
│   ├── skeletons/
│   │   ├── TableSkeleton.tsx   # NEW: Row-based table skeleton
│   │   ├── CardGridSkeleton.tsx # NEW: Card grid skeleton
│   │   └── FormSkeleton.tsx    # NEW: Full form skeleton
│   ├── Layout.tsx              # MODIFY: Add ErrorBoundary around <main>, append BottomNav
│   └── ui/                     # Existing shadcn components
│       ├── skeleton.tsx
│       ├── sonner.tsx
│       ├── table.tsx
│       ├── pagination.tsx      # ADD: after npx shadcn add pagination
│       └── ...
├── routes.tsx                  # MODIFY: Add <Toaster> near ThemeProvider
└── index.css                   # MODIFY: Add touch target global styles
```

### Pattern 1: PageShell Wrapper
**What:** A component that wraps each page's content with a sticky header (title + description + actions) and proper responsive spacing. Does NOT include breadcrumbs (D-03: breadcrumbs are in Layout.tsx).
**When to use:** Every authenticated page component.
**Example interface:**
```tsx
// Proposed interface
interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;  // Right-aligned action buttons
  children: React.ReactNode;
}
```
[D-01 to D-04 locked in CONTEXT.md]

### Pattern 2: DataTable with TanStack Table
**What:** A reusable `DataTable` component built on shadcn's `<Table>` + `@tanstack/react-table`. Supports server-side sorting, column filtering via a single search bar, pagination, and horizontal scroll on mobile.
**When to use:** Any page that displays a list of records (Cases, Beneficiaries, Interventions, etc.).
**Key details:**
- Install `@tanstack/react-table` (NOT currently in dependencies)
- Install shadcn Pagination component (`npx shadcn@latest add pagination`)
- Sort params sent to API (column + direction), not client-side
- Single search bar filters across columns (not per-column filters per D-29)
- `overflow-x-auto` on the table wrapper (D-31) — shadcn `<Table>` already has this built-in
- URL-encoded pagination/sort params for bookmarkable state (Specifics section)

[D-28 to D-31 locked in CONTEXT.md]

### Pattern 3: Empty State Component
**What:** A single `<EmptyState>` component accepting a `variant` prop. Renders Lucide icon + message + optional CTA button specific to each variant.
**When to use:** Any page/section that needs to display "no data" or "no results" states.
**Variants:**
| variant | Icon | Message | CTA |
|---------|------|---------|-----|
| `no-data` | InboxIcon or similar | "No cases found" | "Add first item" → navigates to create |
| `no-results` | SearchX | "No results match your search" | "Clear filters" → resets filters |
| `offline` | WifiOff | "Check your connection" | "Retry" → re-triggers fetch |
| `no-access` | ShieldOff | "You don't have access" | "Go to dashboard" → navigates to / |

[D-09 to D-12 locked in CONTEXT.md]

### Pattern 4: Error Boundary (Network-Aware)
**What:** A React class component wrapping `<main>` in Layout.tsx (D-13). Catches render errors and shows a fallback UI. Checks `navigator.onLine` to differentiate network vs render errors.
**When to use:** Global route-level error catching. Only ONE instance needed (D-13 specifies global, not per-widget).
**Key details:**
- Retry button calls `this.setState({ hasError: false, error: null })` (D-15)
- "Go Home" link navigates to `/` (does NOT use `window.location.href` = no page reload)
- Network error path: "Check your connection" + retry button
- Render error path: "Something went wrong" + home link

[D-13 to D-16 locked in CONTEXT.md]

### Pattern 5: Bottom Tab Navigation
**What:** Fixed bottom navigation bar for mobile (<768px). 5 tabs including center Quick Action button. Absolutely positioned, z-50. Hidden on desktop (where sidebar is visible).
**When to use:** Only visible when viewport < 768px. Appended to Layout.tsx after `</main>`.
**Tabs according to D-21:** Dashboard, Cases, Beneficiaries, Profile + center Quick Action (GIS Intake shortcut).
**Active state per D-23:** Pill/highlight background behind icon.
**Integration:** Added to Layout.tsx. Coexists with sidebar — sidebar is already `hidden lg:block` so on mobile it's hidden and bottom nav shows. On desktop sidebar shows and bottom nav is `hidden`.

### Anti-Patterns to Avoid
- **Putting breadcrumbs in PageShell:** D-03 explicitly separates concerns — breadcrumbs stay in Layout.tsx, PageShell handles per-page title/actions only
- **Per-column filters:** D-29 requires a single search bar, NOT per-column filter inputs
- **Auto-dismiss toasts:** D-18/19 require manual dismiss only — set `duration: Infinity` on all toast calls
- **Custom shimmer skeleton:** D-07 requires default shadcn pulse animation only
- **Client-side sorting for large datasets:** D-28 requires server-side sorting; don't sort loaded data client-side

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table with sort/filter/paginate | Custom table state management | `@tanstack/react-table` | 50K+ GitHub stars, headless, shadcn native. Handles sorting, filtering, pagination, row selection, column visibility out of the box |
| Toast notifications | Custom toast component | Sonner `toast.promise()` | Promise API handles loading→success→error states automatically. Already installed. |
| Page state management | Ad-hoc loading/empty/error states per page | PageShell + EmptyState + ErrorBoundary | Consistent UX across all 18+ pages. One pattern, not 18 variations. |
| CSS touch targets | Remembering 44px per element | Global CSS override | D-27 specifies global approach — less error-prone than per-component enforcement |

## Common Pitfalls

### Pitfall 1: ErrorBoundary Location
**What goes wrong:** ErrorBoundary wrapping the RouterProvider catches errors too broadly and blocks route-level recovery.
**Why it happens:** Current ErrorBoundary wraps RouterProvider in routes.tsx. D-13 requires it wrapping `<main>` in Layout.tsx instead.
**How to avoid:** Move ErrorBoundary from routes.tsx into Layout.tsx, wrapping only the `<main>` content area. The current placement allows any route error to break the entire app, including the public layout.
**Warning signs:** Route crash hides sidebar/topbar navigation, user can't click away.

### Pitfall 2: BottomNav Overlapping Content on Mobile
**What goes wrong:** Page content scrolls behind the fixed bottom navigation bar.
**Why it happens:** Fixed position bottom nav has `position: fixed; bottom: 0` but no bottom padding is added to `<main>`.
**How to avoid:** Add `pb-16` (or appropriate height) to `<main>` when bottom nav is visible. Use CSS conditional: `main:has(~ .bottom-nav) { padding-bottom: 64px; }` or apply through state/useMediaQuery.
**Warning signs:** Last table row or form button hidden behind nav bar.

### Pitfall 3: Sonner Toaster Not Wired
**What goes wrong:** Sonner `toast()` calls silently fail because `<Toaster>` is not rendered in the component tree.
**Why it happens:** The `sonner.tsx` wrapper was installed in Phase 7 but never mounted. The `toast()` function will not show anything.
**How to avoid:** Add `<Toaster />` to `routes.tsx` — near `<ThemeProvider>` or in the `MainRoutes` return. Position `top-center` per D-17.
**Warning signs:** Toast calls in code but nothing appears on screen.

### Pitfall 4: Table Pagination Without Server Integration
**What goes wrong:** shadcn Pagination renders but doesn't actually load new data because the API isn't called on page change.
**Why it happens:** TanStack Table's built-in pagination is client-side by default. Must configure `manualPagination: true` and wire `onPaginationChange` to API calls.
**How to avoid:** Always set `manualPagination: true`, fetch data in useEffect when pagination/sorting changes, pass `pageCount` (derived from API's total count) and `rowCount` to TanStack Table.
**Warning signs:** Clicking "Next" only changes page numbers but data stays the same.

### Pitfall 5: Touch Target Global Override Breaking shadcn Components
**What goes wrong:** Adding `min-h-[44px]` to all interactive elements makes shadcn Buttons too large or misaligned.
**Why it happens:** The global CSS might apply to elements that are already correct (shadcn Button default: `h-10` = 40px). Adding 44px min-height to everything including form labels, small badges, and inline text.
**How to avoid:** Use a targeted selector strategy at the agent's discretion (per Discretion list). Suggested approach: `button, a[href], input, select, textarea, [role="button"] { min-height: 44px; min-width: 44px; }` — but exclude `.btn-sm`, `.text-xs` inline buttons, or small badge elements. The shadcn `Button` component already has `h-10` which is close — override to `h-11` and `min-h-11`.
**Warning signs:** Form elements suddenly oversized, badges look stretched.

## Code Examples

### Example 1: Sonner Promise Toast (CRUD Pattern)
```tsx
import { toast } from 'sonner';

async function createCase(data: CaseData) {
  toast.promise(
    apiFetch('/cases', { method: 'POST', body: JSON.stringify(data) }),
    {
      loading: 'Creating case...',
      success: (result) => `Case #${result.controlNo} created successfully`,
      error: (err) => `Failed to create case: ${err.message}`,
    }
  );
}
```
**Source:** Sonner documentation (sonner.emilkowal.ski) — `toast.promise` API [CITED: sonner.emilkowal.ski/toast]

### Example 2: ErrorBoundary (Network-Aware)
```tsx
// Key pattern for D-16: Network error detection
render() {
  if (this.state.hasError) {
    const isNetworkError = !navigator.onLine
      || this.state.error?.message?.includes('fetch')
      || this.state.error?.name === 'TypeError'; // fetch() throws TypeError on network fail

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        {isNetworkError ? (
          <>
            <WifiOff className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Check your connection</h2>
            <p className="text-sm text-muted-foreground">
              You appear to be offline. Please check your internet connection and try again.
            </p>
            <Button onClick={() => this.setState({ hasError: false, error: null })}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <TriangleAlert className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => this.setState({ hasError: false, error: null })}>
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Go to Dashboard</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }
  return this.props.children;
}
```
**Source:** React Error Boundary API (react.dev) + navigator.onLine detection pattern [CITED: react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary]

### Example 3: DataTable with Server-Side Sorting and Pagination
```tsx
import { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  fetchData: (params: { page: number; limit: number; sort?: string; search?: string }) => Promise<{ data: TData[]; total: number }>;
  searchValue?: string;
}

export function DataTable<TData>({ columns, fetchData, searchValue }: DataTableProps<TData>) {
  const [data, setData] = useState<TData[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    setLoading(true);
    const sortParam = sorting.length > 0
      ? `${sorting[0].id}.${sorting[0].desc ? 'desc' : 'asc'}`
      : undefined;

    fetchData({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sort: sortParam,
      search: searchValue,
    }).then(result => {
      setData(result.data);
      setRowCount(result.total);
      setLoading(false);
    });
  }, [pagination, sorting, searchValue, fetchData]);

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(rowCount / pagination.pageSize),
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* Table wrapper with overflow-x-auto */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} className="text-center">Loading...</TableCell></TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="text-center">No results</TableCell></TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>{row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}</TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      <DataTablePagination table={table} />
    </>
  );
}
```
**Source:** shadcn Data Table docs (ui.shadcn.com/docs/components/data-table) + TanStack Table docs [CITED: ui.shadcn.com/docs/components/data-table; CITED: tanstack.com/table/latest]

### Example 4: BottomTab Navigation
```tsx
import { useMediaQuery } from '@/hooks/use-media-query'; // need to create
import { Home, Users, ClipboardList, User, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/cases', label: 'Cases', icon: ClipboardList },
  { path: null, label: 'Quick Action', icon: Plus, isQuick: true, action: '/intake' },
  { path: '/beneficiaries', label: 'Beneficiaries', icon: Users },
  { path: '/my-dashboard', label: 'Profile', icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border h-16 safe-area-bottom">
      <div className="flex items-center justify-around h-full">
        {TABS.map(tab =>
          tab.isQuickAction ? (
            <Link
              key="quick"
              to={tab.action}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg"
            >
              <Plus size={24} />
            </Link>
          ) : (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors ${
                location.pathname.startsWith(tab.path) ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
```
**Source:** Pattern derived from D-21 to D-24 decisions + shadcn Sheet/Sidebar patterns from Phase 8 [D-21 to D-24 locked in CONTEXT.md]

### Example 5: EmptyState Component
```tsx
import { Inbox, SearchX, WifiOff, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

type EmptyVariant = 'no-data' | 'no-results' | 'offline' | 'no-access';

const CONFIG: Record<EmptyVariant, { icon: React.ElementType; message: string; cta: string; ctaAction: string }> = {
  'no-data':     { icon: Inbox,    message: 'No cases found',              cta: 'Add first item',   ctaAction: '/intake' },
  'no-results':  { icon: SearchX,  message: 'No results match your search', cta: 'Clear filters',    ctaAction: 'clear' },
  'offline':     { icon: WifiOff,  message: 'Check your connection',        cta: 'Retry',            ctaAction: 'retry' },
  'no-access':   { icon: ShieldOff, message: "You don't have access",       cta: 'Go to dashboard',  ctaAction: '/' },
};

interface EmptyStateProps {
  variant: EmptyVariant;
  onAction?: () => void;
}

export function EmptyState({ variant, onAction }: EmptyStateProps) {
  const navigate = useNavigate();
  const config = CONFIG[variant];
  const Icon = config.icon;

  const handleAction = () => {
    if (variant === 'no-results' && onAction) onAction();
    else if (variant === 'offline' && onAction) onAction();
    else navigate(config.ctaAction);
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <p className="text-base font-medium text-foreground">{config.message}</p>
      <Button variant="outline" onClick={handleAction}>
        {config.cta}
      </Button>
    </div>
  );
}
```
**Source:** Based on D-09 to D-12 decisions. Icons from lucide-react [D-09 to D-12 locked in CONTEXT.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc loading spinners per page (`.spinner` CSS class in `@layer legacy`) | shadcn `<Skeleton>` with `animate-pulse` matching content dimensions | Phase 10 | Consistent loading UX across all 18+ pages |
| Inline "No data" text in table bodies (`<td colSpan={13}>...`) | Dedicated `<EmptyState>` component with 4 variants | Phase 10 | Reusable, consistent empty states with proper CTAs |
| Basic ErrorBoundary with gray text + "Go Home" button | Network-aware ErrorBoundary with Lucide icons + retry + navigation | Phase 10 | Better UX for offline scenarios, error differentiation |
| No toast system — ad-hoc `alert()` calls | Sonner `toast.promise()` for all CRUD operations | Phase 10 | Professional UX, no more `alert()` dialogs |
| Desktop-only layout | Mobile bottom tab nav at <768px | Phase 10 | PWA-ready mobile experience for field workers |
| Hard-coded `<table>` HTML with CSS classes | `@tanstack/react-table` + shadcn `<Table>` + shadcn Pagination | Phase 10 | Server-side sort/filter/paginate, consistent across pages |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing API endpoints accept sort/filter/paginate query params (e.g., `?sort=updatedAt.desc&page=1&limit=10`) | DataTable pattern | Backend needs modification to accept and process these params. Verify existing backend endpoints support pagination. |
| A2 | `@tanstack/react-table` v8.20 is the correct target version | Standard Stack | Minor version difference is fine; major API is stable since v8 |
| A3 | `useMediaQuery` hook is needed — not currently in codebase | BottomNav pattern | Can inline a simple `window.matchMedia` listener, or extract into `src/hooks/use-media-query.ts` |
| A4 | `<Toaster>` placement in `routes.tsx` near ThemeProvider works | Sonner integration | Must be a child of ThemeProvider but can be sibling to AuthProvider. Need to verify Sonner picks up theme correctly. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
**Note:** A1 needs backend verification during planning or implementation. The current `getBeneficiaries()` function in `api.ts` already accepts `page` and `limit` params, suggesting the backend supports pagination. `getCases()` does not currently pass sort/paginate params.

## Environment Availability

> Skip this section if the phase has no external dependencies (code/config-only changes).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20 | Build + dev | ✓ | Check needed | — |
| npm | Package install | ✓ | Check needed | — |

External dependencies: `@tanstack/react-table` needs npm install. shadcn Pagination component needs `npx shadcn@latest add pagination`. Both are standard npm operations — no blockers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.2 |
| Config file | kapwa-client/vitest.config.ts |
| Quick run command | `npm test` (vitest watch) |
| Full suite command | `npm run test:run` (vitest run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STT-01 | PageShell renders title, description, actions, children | unit | `npm test -- PageShell.test.tsx` | ❌ Wave 0 |
| STT-02 | Skeleton components render with correct layout | unit | `npm test -- TableSkeleton.test.tsx` | ❌ Wave 0 |
| STT-03 | EmptyState renders correct icon/message/CTA per variant | unit | `npm test -- EmptyState.test.tsx` | ❌ Wave 0 |
| STT-04 | ErrorBoundary catches errors, shows fallback, retry works | unit | `npm test -- ErrorBoundary.test.tsx` | ❌ Wave 0 |
| STT-05 | Sonner toast() can be called (integration check) | integration | Manual or `npm test -- toast.test.tsx` | ❌ Wave 0 |
| RES-01 | BottomNav renders on mobile viewport size | unit | `npm test -- BottomNav.test.tsx` | ❌ Wave 0 |
| RES-02 | DataTable renders with sort/paginate controls | unit | `npm test -- DataTable.test.tsx` | ❌ Wave 0 |
| RES-03 | Touch targets enforce min 44px | visual/accessibility audit | Manual check | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (quick unit tests)
- **Per wave merge:** `npm run test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `PageShell.test.tsx` — covers STT-01
- [ ] `TableSkeleton.test.tsx`, `CardGridSkeleton.test.tsx`, `FormSkeleton.test.tsx` — covers STT-02
- [ ] `EmptyState.test.tsx` — covers STT-03 (4 variants)
- [ ] `ErrorBoundary.test.tsx` — covers STT-04 (render error + network error paths)
- [ ] `BottomNav.test.tsx` — covers RES-01
- [ ] `DataTable.test.tsx` — covers RES-02 (sorting, pagination, empty state)
- [ ] Framework install: `npm install @tanstack/react-table` + `npx shadcn@latest add pagination`

## Security Domain

> Required when `security_enforcement` is enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | TanStack Table columns define allowed sort fields; prevent injection into sort params |
| V7 Error Handling | yes | ErrorBoundary must NOT leak sensitive error details (stack traces, API paths) to UI |

**Known Threat Patterns for React + shadcn:**
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sort param injection | Tampering | Validate sort column against allowlist in API. Table columns define which fields are sortable. |
| Error info leakage | Information Disclosure | ErrorBoundary shows generic message; `componentDidCatch` logs full error to console (already in existing code) |

## Sources

### Primary (HIGH confidence)
- CONTEXT.md Phase 10 decisions (31 locked decisions) [VERIFIED: codebase]
- Codebase analysis: STACK.md, STRUCTURE.md, CONVENTIONS.md [VERIFIED: codebase]
- Codebase audit: Actual Layout.tsx, routes.tsx, ErrorBoundary.tsx, pages, package.json [VERIFIED: codebase]
- Phase 7 foundation context (shadcn component list) [VERIFIED: codebase]
- Phase 8 layout context (D-17: bottom nav deferred to Phase 10) [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Sonner docs (sonner.emilkowal.ski) — toast.promise API, positioning, manual dismiss [CITED: sonner.emilkowal.ski]
- shadcn Data Table docs (ui.shadcn.com/docs/components/data-table) — TanStack Table pattern [CITED: ui.shadcn.com]
- TanStack Table v8 docs (tanstack.com/table/latest) — manualPagination, manualSorting [CITED: tanstack.com]

### Tertiary (LOW confidence)
- None — all findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json or by shadcn ecosystem
- Architecture: HIGH — all patterns derived from locked decisions and existing codebase structure
- Pitfalls: HIGH — based on codebase audit (missing Toaster, misplaced ErrorBoundary, missing @tanstack/react-table)

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (30 days for stable stack)
