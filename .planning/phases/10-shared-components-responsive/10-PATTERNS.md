# Phase 10: Shared Components & Responsive — Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 17 new/modified (13 new, 4 modified)
**Analogs found:** 15 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/PageShell.tsx` | component | request-response | `src/components/Layout.tsx` | role-match |
| `src/components/EmptyState.tsx` | component | request-response | `src/components/NotificationsDropdown.tsx` (empty state lines 95-99) | partial |
| `src/components/ErrorBoundary.tsx` | component | request-response | `src/components/ErrorBoundary.tsx` (existing — rewrite target) | exact |
| `src/components/BottomNav.tsx` | component | request-response | `src/components/Sidebar.tsx` | role-match |
| `src/components/data-table/DataTable.tsx` | component | CRUD | `src/components/ui/table.tsx` | partial |
| `src/components/data-table/DataTablePagination.tsx` | component | CRUD | `src/components/ui/breadcrumb.tsx` (shadcn pattern) | partial |
| `src/components/data-table/DataTableToolbar.tsx` | component | request-response | `src/components/Topbar.tsx` (search bar lines 75-78) | partial |
| `src/components/data-table/DataTableColumnHeader.tsx` | component | CRUD | No existing analog — new pattern | none |
| `src/components/data-table/index.ts` | utility | — | No existing barrel export pattern | none |
| `src/components/skeletons/TableSkeleton.tsx` | component | request-response | `src/components/ui/skeleton.tsx` | exact |
| `src/components/skeletons/CardGridSkeleton.tsx` | component | request-response | `src/components/ui/skeleton.tsx` | exact |
| `src/components/skeletons/FormSkeleton.tsx` | component | request-response | `src/components/ui/skeleton.tsx` | exact |
| `src/hooks/use-media-query.ts` | utility | request-response | No existing hooks in codebase | none |
| `src/components/Layout.tsx` (MODIFY) | component | request-response | The file itself | exact |
| `src/routes.tsx` (MODIFY) | route | request-response | The file itself | exact |
| `src/index.css` (MODIFY) | config | — | The file itself | exact |
| `src/components/ui/pagination.tsx` (ADD, shadcn CLI) | component | CRUD | `src/components/ui/breadcrumb.tsx` (shadcn pattern) | exact |

## Pattern Assignments

---

### `src/components/PageShell.tsx` (component, request-response)

**Analog:** `src/components/Layout.tsx` (lines 44-104)

**Imports pattern** (lines 1-15 of Layout.tsx):
```typescript
import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
```

**Core pattern — sticky header wrapper** (lines 72-104):
```typescript
export function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {/* Skip to content link hidden by default */}
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md"
      >
        Skip to content
      </a>

      {/* Header section (Topbar) — sticky top-0 z-40 */}
      {/* ... */}

      <main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto">
        {/* Breadcrumbs — already in Layout.tsx per D-03 */}
        <BreadcrumbNav pathname={location.pathname} />
        {children || <Outlet />}
      </main>
    </>
  );
}
```

**Alternative analog — PublicLayout.tsx** (lines 7-25):
```typescript
export function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <PublicHeader user={user} loading={loading} />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
```

**CSS class pattern for responsive spacing** — D-02 (`gap-4` mobile / `gap-8` desktop):
- Layout.tsx line 98: `className="flex-1 p-6 bg-background ..."`
- PageShell should use: `flex flex-col gap-4 lg:gap-8`

**Props pattern** (from RESEARCH.md):
```typescript
interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;   // Right-aligned action buttons
  children: React.ReactNode;
}
```

---

### `src/components/EmptyState.tsx` (component, request-response)

**Analog:** `src/components/NotificationsDropdown.tsx` (empty state section, lines 95-99)

**Imports pattern** (NotificationsDropdown lines 1-7):
```typescript
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
```

**Empty state UI pattern** (NotificationsDropdown lines 95-99):
```typescript
<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
  <Bell size={32} className="mb-2 opacity-40" />
  <span className="text-sm">No notifications</span>
</div>
```

**Core pattern** — use Icon scale `h-12 w-12`, larger spacing `py-16`, `gap-4` for consistency. Button as CTA.

**Error/empty state pattern** from ChainViewer.tsx (lines 41-43):
```typescript
if (loading) return <div className="p-4 text-center text-sm">Loading chain...</div>;
if (error) return <div className="p-4 text-red-600 text-sm">{error}</div>;
if (chain.length === 0) return <div className="p-4 text-gray-500 text-sm">No interventions recorded</div>;
```

---

### `src/components/ErrorBoundary.tsx` (component, request-response) — REWRITE

**Analog:** Existing `src/components/ErrorBoundary.tsx` (lines 1-44)

**Current pattern to rewrite** (lines 1-44):
```typescript
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-8 text-center">
          <h1 className="text-red-600 text-2xl">Something went wrong</h1>
          <p className="text-gray-600 my-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button className="px-6 py-2 bg-primary text-white rounded-md cursor-pointer border-0"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Key changes for rewrite:**
- Replace `window.location.href = '/'` with `react-router-dom` `<Link>` (D-15: no page reload)
- Add network error detection via `navigator.onLine` (D-16)
- Use `lucide-react` icons (`TriangleAlert`, `WifiOff`) instead of plain text
- Use shadcn `Button` component with `asChild` for links
- Add "Retry" button (resets state) alongside "Go to Dashboard"/"Go Home" link

---

### `src/components/BottomNav.tsx` (component, request-response)

**Analog:** `src/components/Sidebar.tsx` (lines 1-72)

**Imports pattern** (Sidebar lines 1-6 + pattern):
```typescript
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, Users, ClipboardList, User, Plus } from 'lucide-react';
```

**Active tab styling pattern** (Sidebar lines 27-43):
```typescript
const isActive = item.path === '/'
  ? location.pathname === '/'
  : location.pathname.startsWith(item.path);
<Link
  to={item.path}
  className={cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
  )}
>
  {item.icon}
  <span>{item.label}</span>
</Link>
```

**Visibility pattern** (Sidebar line 64, hidden on mobile):
```typescript
<aside className={cn(
  'w-64 bg-card border-r border-border shrink-0',
  'sticky top-16 h-[calc(100vh-4rem)]',
  'hidden lg:block',    // hidden on mobile, visible on desktop
  className
)}>
```

For BottomNav: invert — `fixed bottom-0 left-0 right-0 z-50 ... lg:hidden`

**Quick Action button pattern** (center button, from RESEARCH.md):
```typescript
<Link
  to="/intake"
  className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg"
>
  <Plus size={24} />
</Link>
```

---

### `src/components/data-table/DataTable.tsx` (component, CRUD)

**Analog:** `src/components/ui/table.tsx` (lines 1-117) — shadcn Table primitives

**Imports pattern:**
```typescript
import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
```

**shadcn Table wrapper pattern** (table.tsx lines 8-16) — already has `overflow-auto` for D-31:
```typescript
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
```

**TableHeader pattern** (table.tsx lines 19-24):
```typescript
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
```

**TableBody + TableRow pattern** (table.tsx lines 27-67):
```typescript
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn(
    "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
    className
  )} {...props} />
))
```

**Server-side pagination pattern** (RESEARCH.md example, lines 425-497):
```typescript
// Key: manualPagination: true, manualSorting: true
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

// Render pattern
<div className="overflow-x-auto rounded-md border">
  <Table>
    <TableHeader>{/* header groups */}</TableHeader>
    <TableBody>
      {loading ? (
        <TableRow><TableCell colSpan={columns.length}>Loading...</TableCell></TableRow>
      ) : rows.length === 0 ? (
        <TableRow><TableCell colSpan={columns.length}>No results</TableCell></TableRow>
      ) : (
        rows.map(row => (...))
      )}
    </TableBody>
  </Table>
</div>
```

---

### `src/components/data-table/DataTablePagination.tsx` (component, CRUD)

**Analog:** `src/components/ui/breadcrumb.tsx` (shadcn sub-component pattern, lines 1-115)

**shadcn sub-component pattern** — named forwardRef exports with displayName:
```typescript
// breadcrumb.tsx pattern
const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & { separator?: React.ReactNode }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

// Each sub-component exported individually at bottom
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator }
```

**shadcn Pagination** will be installed via CLI — follow its generated output pattern (standard shadcn: `React.forwardRef` + `cn()` + named exports).

---

### `src/components/data-table/DataTableToolbar.tsx` (component, request-response)

**Analog:** `src/components/Topbar.tsx` (search bar lines 75-78)

**Search bar pattern** (Topbar lines 75-78):
```typescript
<div className="relative">
  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
  <Input
    type="text"
    placeholder="Search records..."
    className="h-9 w-56 pl-9 text-sm rounded-full bg-muted/50 border-none"
  />
</div>
```

---

### `src/components/data-table/DataTableColumnHeader.tsx` (component, CRUD)

**Analog:** No close analog exists. Use RESEARCH.md pattern + shadcn patterns:
- Use `Button` with sort icon (`ArrowUpDown`, `ArrowUp`, `ArrowDown` from lucide-react)
- Use `cn()` conditional classes for active sort state
- Pattern will integrate with `column.getToggleSortingHandler()` from TanStack Table

---

### `src/components/data-table/index.ts` (barrel export)

**Analog:** No existing barrel exports in codebase. Pattern:
```typescript
export { DataTable } from './DataTable';
export { DataTablePagination } from './DataTablePagination';
export { DataTableToolbar } from './DataTableToolbar';
export { DataTableColumnHeader } from './DataTableColumnHeader';
```

---

### `src/components/skeletons/TableSkeleton.tsx` (component, request-response)

**Analog:** `src/components/ui/skeleton.tsx` (lines 1-15)

**shadcn Skeleton import/use pattern** (skeleton.tsx):
```typescript
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}
```

**Usage pattern in skeletons** — row-based layout matching table columns:
- TableSkeleton: `<Skeleton className="h-4 w-[250px]" />` repeated for 3-5 rows × variable column widths
- CardGridSkeleton: grid with `grid-cols-1 md:grid-cols-2` matching card layout
- FormSkeleton: stacked `<Skeleton>` blocks matching form field layout

---

### `src/hooks/use-media-query.ts` (utility, request-response)

**Analog:** No existing hooks in codebase. Pattern from RESEARCH.md:
```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

Import style follows existing patterns (named export, `import { useState, useEffect } from 'react'`).

---

### `src/components/Layout.tsx` (MODIFY)

**Pattern:** Import and integrate:
- Wrap `<main>` content with `<ErrorBoundary>` (lines 98-101 become wrapped)
- Append `<BottomNav />` after `</main>` (after line 101)
- Add `pb-16` to `<main>` or use CSS for bottom nav clearance (Pitfall 2 from RESEARCH.md)

**Before** (lines 98-101):
```typescript
<main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto">
  <BreadcrumbNav pathname={location.pathname} />
  {children || <Outlet />}
</main>
```

**After pattern:**
```typescript
<main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto pb-16 lg:pb-6">
  <ErrorBoundary>
    <BreadcrumbNav pathname={location.pathname} />
    {children || <Outlet />}
  </ErrorBoundary>
</main>
<BottomNav />
```

---

### `src/routes.tsx` (MODIFY)

**Import to add** (follow existing import style, lines 1-36):
```typescript
import { Toaster } from '@/components/ui/sonner';
```

**Placement** — add `<Toaster />` near `<ThemeProvider>` (inside it, lines 90-96):
```typescript
export function MainRoutes() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <Toaster position="top-center" duration={Infinity} />
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**Key:** `<Toaster position="top-center" duration={Infinity} />` — D-17 top-center, D-18/19 manual dismiss (via `duration: Infinity`).

---

### `src/index.css` (MODIFY)

**Touch target global styles** — add after the `@layer base` block (before `@media print`). Pattern from RESEARCH.md:
```css
/* 44px touch targets for mobile (Phase 10) */
@layer components {
  button, a[href], input, select, textarea, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
  /* Allow small decorative/inline elements to opt out */
  .touch-sm {
    min-height: unset;
    min-width: unset;
  }
}
```

Alternatively, add targeted selectors per D-27. Layer placement should be `@layer components` or base — not `legacy`.

---

### `src/components/ui/pagination.tsx` (ADD — shadcn CLI generated)

**Analog:** `src/components/ui/breadcrumb.tsx` (lines 1-115) — same shadcn component generation pattern

Standard shadcn component structure:
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

// Each sub-component: React.forwardRef + cn() + displayName
// Named exports at bottom
```

This is generated by `npx shadcn@latest add pagination` — do NOT hand-write.

---

## Shared Patterns

### Component Structure
**Source:** All existing components (`Topbar.tsx`, `Sidebar.tsx`, `Layout.tsx`, etc.)

**Convention:**
```typescript
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ComponentIcon } from 'lucide-react';

interface ComponentNameProps {
  // props
}

export function ComponentName({ /* destructured props */ }: ComponentNameProps) {
  // hooks, state, effects
  // return JSX
}
```

### Import Path Convention
**Source:** All `src/components/*.tsx` files — use `@/` path alias:
```typescript
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { Link, useLocation } from 'react-router-dom';
```

### Named Exports
**Source:** CONVENTIONS.md and all component files
- Use `export function ComponentName()` — not `export default`
- Exception: `NotificationsDropdown.tsx` uses `export default` — follow named exports for new components
- Props interfaces defined above component function (no `Props` suffix convention — just inline)

### CSS Custom Properties + Tailwind
**Source:** `src/index.css` and all components
- Color tokens: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`
- Dark mode handled automatically via `class` strategy + `.dark` vars
- Fonts: `font-heading` (Lexend), `font-body` (Source Sans 3)

### Lucide Icons
**Source:** All components
- Installed in `package.json` (`^1.14.0`)
- Imported as `{ IconName } from 'lucide-react'`
- Sizes: `size={16}`, `size={19}`, `size={20}`, `size={24}`
- Standard: `className="h-4 w-4"` or `size={}` prop

### shadcn UI Component Pattern
**Source:** All `src/components/ui/*.tsx` files
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <native-element ref={ref} className={cn("tailwind-classes", className)} {...props} />
  )
)
Component.displayName = "Component"
```

### Testing Pattern
**Source:** `src/components/cards/AccessCard.test.tsx` (lines 1-79)
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders expected content', () => {
    render(<ComponentName prop1="value" />);
    expect(screen.getByText('Expected text')).toBeTruthy();
  });
});
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/data-table/DataTableColumnHeader.tsx` | component | CRUD | TanStack Table sortable column header — new pattern not yet in codebase |
| `src/components/data-table/index.ts` | utility | — | No barrel export pattern exists yet |
| `src/hooks/use-media-query.ts` | utility | request-response | No custom hooks directory exists yet — first hook in codebase |

## Metadata

**Analog search scope:** `kapwa-client/src/components/`, `kapwa-client/src/lib/`, `kapwa-client/src/`
**Files scanned:** 47
**Pattern extraction date:** 2026-06-29
