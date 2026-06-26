# Architecture Research — Kapwa UI/UX Overhaul

**Domain:** React 18 SPA — MSWDO social welfare case management
**Researched:** 2026-06-27
**Confidence:** HIGH

## System Overview

### Current Architecture (Before)

```
MainRoutes (routes.tsx)
├── AuthProvider (lib/auth-context.tsx)
│   └── ErrorBoundary (components/ErrorBoundary.tsx)
│       └── RouterProvider (createBrowserRouter)
│           ├── Route /login → LoginPage (no layout, no auth)
│           └── Route /* → Private (ProtectedRoute + Layout)
│               └── {24 pages, all eagerly loaded}
│                   ├── Layout (monolithic sidebar+topbar+content)
│                   ├── UserBadge, NotificationsDropdown, MessagesPopover
│                   └── <Outlet />
```

### Target Architecture (After)

```
MainRoutes (routes.tsx)
├── AuthProvider
│   └── ErrorBoundary (top-level — unhandled errors only)
│       └── RouterProvider
│           ├── PUBLIC ROUTES (no auth, no app layout)
│           │   ├── / → LandingPage (lazy)
│           │   ├── /about → AboutPage (lazy)
│           │   └── /login → LoginPage (lazy, already public)
│           │
│           ├── APP SHELL ROUTE (auth + layout, Layout.tsx refactored)
│           │   ├── Layout → ErrorBoundary (per-route)
│           │   │   ├── Topbar (extracted)
│           │   │   │   ├── SkipToContent
│           │   │   │   ├── SearchBar
│           │   │   │   ├── NotificationsDropdown
│           │   │   │   ├── MessagesPopover
│           │   │   │   └── UserMenu (new — DropdownMenu)
│           │   │   ├── Sidebar (extracted, shadcn Sidebar)
│           │   │   │   └── NavItem[]
│           │   │   └── ContentArea
│           │   │       ├── Breadcrumbs (new)
│           │   │       ├── Suspense (route-level loading)
│           │   │       │   └── <Outlet />
│           │   │       └── RouteErrorBoundary (per-route errorElement)
│           │   │
│           │   └── LAZY ROUTES (code-split per page)
│           │       ├── / → DashboardPage
│           │       ├── /intake → IntakePage
│           │       ├── /cases → CasesPage
│           │       ├── /beneficiaries → BeneficiariesPage (lazy)
│           │       └── ... (22 more pages, all lazy now)
```

## Integration Points

These are the exact files that change and the new files to create.

### Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `src/index.css` | Add `.dark` CSS variable block, sidebar tokens, spacing/typography tokens, print improvements | **Phase 1** |
| `tailwind.config.js` | Verify variable mapping (already correct), add sidebar colors if needed | **Phase 1** |
| `src/routes.tsx` | Restructure to use `lazy()` + `Suspense` per route, add public route group, add `errorElement` to layout route | **Phase 1** |
| `src/components/Layout.tsx` | Extract Sidebar, Topbar as separate components, add breadcrumbs, add skip-to-content, wrap content in Suspense | **Phase 1** |
| `src/components/ProtectedRoute.tsx` | Remove redirect logic — let router handle with loader-based auth check. Or keep for backward compat but add skeleton loading state | **Phase 1** |
| `src/components/ErrorBoundary.tsx` | Add recovery actions, logged error display, make it route-aware (reset on navigation) | **Phase 1** |
| `src/App.tsx` | Currently empty — will need to export anything that migrates from routes.tsx | **Phase 5** |
| `src/main.tsx` | Likely unchanged — but verify StrictMode wrapping | — |
| `components.json` | Already configured for shadcn CLI usage. Add `"hooks": "@/hooks"` if missing | **Phase 2** |
| Every page in `src/pages/` | Replace legacy CSS classes (`page-header`, `page-title`, `page-desc`, `.table`, `.form-input`, `.btn`, etc.) with shadcn equivalents | **Phase 4** |

### Files to Create

| File | Purpose | Phase |
|------|---------|-------|
| `src/components/layout/` | Layout component directory | **Phase 1** |
| `src/components/layout/Topbar.tsx` | Extracted header with user menu, search, notifications | **Phase 1** |
| `src/components/layout/Sidebar.tsx` | Extracted navigation with role-based items | **Phase 1** |
| `src/components/layout/Breadcrumbs.tsx` | Auto-generated breadcrumb trail from router path | **Phase 1** |
| `src/components/layout/ContentArea.tsx` | Wrapper with Suspense + RouteErrorBoundary | **Phase 1** |
| `src/components/layout/UserMenu.tsx` | DropdownMenu for avatar → profile, settings, logout | **Phase 1** |
| `src/components/layout/SkipToContent.tsx` | Accessibility skip link | **Phase 1** |
| `src/components/layout/MobileNav.tsx` | Bottom nav for mobile (alternative to sidebar) | **Phase 3** |
| `src/components/ui/` — new shadcn components | Dialog, Sheet, DropdownMenu, Skeleton, Tooltip, Select, Table, Tabs, ScrollArea, Command, Breadcrumb, etc. | **Phase 2** |
| `src/components/ui/skeleton.tsx` | Loading skeleton component | **Phase 2** |
| `src/components/ui/sheet.tsx` | Mobile sidebar drawer | **Phase 2** |
| `src/components/ui/dropdown-menu.tsx` | User menu dropdown | **Phase 2** |
| `src/components/ui/breadcrumb.tsx` | Navigation breadcrumbs | **Phase 2** |
| `src/components/ui/table.tsx` | shadcn Table (replaces legacy .table styles) | **Phase 2** |
| `src/components/ui/dialog.tsx` | Modal dialogs | **Phase 2** |
| `src/components/ui/tabs.tsx` | Tabbed interfaces | **Phase 2** |
| `src/components/ui/tooltip.tsx` | Tooltip hints | **Phase 2** |
| `src/components/ui/select.tsx` | Form select (replaces .form-select) | **Phase 2** |
| `src/components/ui/command.tsx` | Command palette / search | **Phase 3** |
| `src/components/ui/scroll-area.tsx` | Custom scroll containers | **Phase 2** |
| `src/hooks/use-theme.ts` | Theme toggle hook (light/dark) | **Phase 1** |
| `src/hooks/use-media-query.ts` | Responsive breakpoint hook | **Phase 3** |
| `src/components/ThemeProvider.tsx` | Dark mode class provider (not a theme wrapper — just adds .dark listener) | **Phase 1** |
| `src/styles/print.css` | Dedicated print stylesheet | **Phase 5** |
| `src/styles/print/reports.css` | Report-specific print styles | **Phase 5** |
| `src/styles/print/access-card.css` | Access Card print layout | **Phase 5** |
| `src/styles/utilities.css` | Additional utility classes | **Phase 1** |
| `src/pages/LandingPage.tsx` | Public landing page | **Phase 1** |
| `src/pages/AboutPage.tsx` | Public about page | **Phase 1** |
| `src/components/RouteErrorBoundary.tsx` | Per-route error boundary with retry | **Phase 1** |
| `src/components/PageLoader.tsx` | Route-level loading fallback (skeleton) | **Phase 1** |
| `src/components/EmptyState.tsx` | Reusable empty state component | **Phase 4** |
| `src/components/ErrorDisplay.tsx` | Reusable error display (404, 403, 500) | **Phase 4** |

## Component Tree

### New Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  ErrorBoundary (top-level, class component, minimal fallback)    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  AuthProvider                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  RouterProvider                                       │   │   │
│  │  │                                                       │   │   │
│  │  │  ── PUBLIC ROUTE ──                                   │   │   │
│  │  │  [LandingPage] [AboutPage] [LoginPage]                │   │   │
│  │  │                                                       │   │   │
│  │  │  ── APP SHELL ROUTE ──                                │   │   │
│  │  │  <ProtectedRoute roleCheck={...}>                     │   │   │
│  │  │  <RouteErrorBoundary>                                 │   │   │
│  │  │  <LayoutShell>                                        │   │   │
│  │  │  ├── <SkipToContent />                                │   │   │
│  │  │  ├── <Topbar>                                         │   │   │
│  │  │  │   ├── MobileMenuButton (Sheet trigger)             │   │   │
│  │  │  │   ├── Logo + Role Badge                           │   │   │
│  │  │  │   ├── <SearchBar /> (desktop)                     │   │   │
│  │  │  │   ├── <NotificationsDropdown />                    │   │   │
│  │  │  │   ├── <MessagesPopover />                          │   │   │
│  │  │  │   └── <UserMenu /> (DropdownMenu)                 │   │   │
│  │  │  ├── <Sidebar>                                        │   │   │
│  │  │  │   ├── Desktop: fixed left panel                   │   │   │
│  │  │  │   └── Mobile: Sheet overlay                       │   │   │
│  │  │  ├── <Breadcrumbs />                                  │   │   │
│  │  │  ├── <main>  {/* role="main" */}                      │   │   │
│  │  │  │   <Suspense fallback={<PageLoader />}>             │   │   │
│  │  │  │     <Outlet />   {/* lazy-loaded page */}         │   │   │
│  │  │  │   </Suspense>                                      │   │   │
│  │  │  └── </main>                                          │   │   │
│  │  │  </LayoutShell>                                       │   │   │
│  │  │  </RouteErrorBoundary>                                │   │   │
│  │  │  </ProtectedRoute>                                    │   │   │
│  │  │                                                       │   │   │
│  │  │  ── LAZY PAGES (code-split per route) ──              │   │   │
│  │  │  const Dashboard = lazy(() => import('./pages/...'))  │   │   │
│  │  │  const Cases = lazy(() => import('./pages/...'))      │   │   │
│  │  │  ... 22 more                                          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ErrorBoundary` (top) | Catch unhandled render errors, show fallback with retry | Nothing — wraps everything |
| `AuthProvider` | Provide auth context (user, token, login, logout, MFA) | All pages via `useAuth()` |
| `ProtectedRoute` | Gate access by auth + role, redirect unauthorized | Navigate to /login or / |
| `RouteErrorBoundary` | Catch per-route errors, show error+retry per page | Route's errorElement |
| `LayoutShell` | Orchestrate sidebar+topbar+content layout | ARIA landmark structure |
| `Topbar` | Sticky header with nav, search, user controls | Sidebar (mobile toggle), Auth context |
| `Sidebar` | Role-filtered navigation links | Topbar (mobile open/close) |
| `Breadcrumbs` | Auto-breadcrumb from matched route path | Router location |
| `PageLoader` | Skeleton loading fallback for lazy routes | Suspense boundary |
| `ThemeProvider` | Listen to system preference, toggle `.dark` class | CSS variables in index.css |
| `UserMenu` | Profile, settings, logout actions | AuthProvider |
| `EmptyState` | Display when data list is empty | Parent page |
| `ErrorDisplay` | Display 403/404/500 errors with recovery | RouteErrorBoundary |
| `SkipToContent` | First-focus link for keyboard users | main content area |


## Pattern Library

### Pattern 1: Route-Level Code Splitting with Suspense

**What:** Convert all 24 static page imports to lazy-loaded routes using React.lazy() + Suspense. This is the single biggest PWA performance win.

**Current state (bad):** All 24 pages bundled together. A user logging in to file an IRF downloads the AdminPage, ProgramsPage, MayorReportsPage — pages they'll never see.

**Target:**
```typescript
// routes.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LayoutShell } from './components/layout/LayoutShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { PageLoader } from './components/PageLoader';

// Public pages — eagerly loaded for instant auth redirect
import { LoginPage } from './pages/LoginPage';

// App pages — code-split by route
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const IntakePage = lazy(() => import('./pages/IntakePage'));
const CasesPage = lazy(() => import('./pages/CasesPage'));
const BeneficiariesPage = lazy(() => import('./pages/BeneficiariesPage'));
// ... 20 more

const router = createBrowserRouter([
  // Public routes (no layout, no auth)
  { path: '/landing', element: <LandingPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/about', element: <AboutPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },

  // App shell — wraps all authenticated pages
  {
    path: '/',
    element: <ProtectedRoute><LayoutShell /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
      { path: 'intake', element: <Suspense fallback={<PageLoader />}><IntakePage /></Suspense> },
      { path: 'cases', element: <Suspense fallback={<PageLoader />}><CasesPage /></Suspense> },
      // ... rest of routes
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
```

**Why this approach:**
- Every page is its own chunk. Vite handles chunk naming automatically via rollup.
- Suspense boundary in LayoutShell means the shell (sidebar, topbar) stays rendered during page transitions — no layout re-mount.
- Eager-import LoginPage (tiny, always needed for auth redirect) avoids flash-of-loading on login.
- `errorElement` on each route prevents one broken page from crashing the entire app.

**Trade-offs:**
- Each lazy import adds ~50ms overhead on first visit to that page (network + parse). For an offline-first PWA with SW caching, this is a one-time cost per page.
- Suspense fallback flickers on fast networks. Mitigation: add a 300ms delay before showing skeleton (see `useDelayedFallback` pattern).

### Pattern 2: Design Token System — Dark Mode with CSS Variables

**What:** Add `.dark` CSS variable overrides to the existing `:root` tokens. The runtime only toggles a class on `<html>` — no JS theme wrapper needed.

**Current state:** Single `:root` block with hardcoded hex colors. No dark mode. Components use tokens like `bg-background` but dark just means "same colors."

**Target — index.css additions:**
```css
@layer base {
  :root {
    /* Light mode — existing values, consider migrating hex → OKLCH */
    --background: #F8FAFC;
    --foreground: #020617;
    --card: #FFFFFF;
    --card-foreground: #020617;
    --primary: #0F172A;
    --primary-foreground: #FFFFFF;
    --secondary: #334155;
    --secondary-foreground: #FFFFFF;
    --muted: #E8ECF1;
    --muted-foreground: #64748B;
    --accent: #0369A1;
    --accent-foreground: #FFFFFF;
    --destructive: #DC2626;
    --destructive-foreground: #FFFFFF;
    --border: #E2E8F0;
    --input: #E2E8F0;
    --ring: #0F172A;
    --radius: 0.5rem;

    /* New tokens */
    --sidebar-background: #FFFFFF;
    --sidebar-foreground: #020617;
    --sidebar-primary: #0F172A;
    --sidebar-primary-foreground: #FFFFFF;
    --sidebar-accent: #E8ECF1;
    --sidebar-accent-foreground: #020617;
    --sidebar-border: #E2E8F0;
    --sidebar-ring: #0F172A;
  }

  .dark {
    --background: #0B1121;
    --foreground: #F1F5F9;
    --card: #0F172A;
    --card-foreground: #F1F5F9;
    --primary: #F1F5F9;
    --primary-foreground: #0F172A;
    --secondary: #1E293B;
    --secondary-foreground: #F1F5F9;
    --muted: #1E293B;
    --muted-foreground: #94A3B8;
    --accent: #38BDF8;
    --accent-foreground: #0F172A;
    --destructive: #7F1D1D;
    --destructive-foreground: #FEE2E2;
    --border: #1E293B;
    --input: #1E293B;
    --ring: #38BDF8;

    /* Sidebar tokens — dark variant */
    --sidebar-background: #0F172A;
    --sidebar-foreground: #F1F5F9;
    --sidebar-primary: #38BDF8;
    --sidebar-primary-foreground: #0F172A;
    --sidebar-accent: #1E293B;
    --sidebar-accent-foreground: #F1F5F9;
    --sidebar-border: #1E293B;
    --sidebar-ring: #38BDF8;
  }
}
```

**Tailwind config — add sidebar colors:**
```javascript
// tailwind.config.js — add to theme.extend.colors
sidebar: {
  DEFAULT: 'var(--sidebar-background)',
  foreground: 'var(--sidebar-foreground)',
  primary: {
    DEFAULT: 'var(--sidebar-primary)',
    foreground: 'var(--sidebar-primary-foreground)',
  },
  accent: {
    DEFAULT: 'var(--sidebar-accent)',
    foreground: 'var(--sidebar-accent-foreground)',
  },
  border: 'var(--sidebar-border)',
  ring: 'var(--sidebar-ring)',
},
```

**Runtime — ThemeProvider:**
```typescript
// hooks/use-theme.ts
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('kapwa-theme') as Theme) || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function apply() {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      root.classList.toggle('dark', isDark);
    }

    apply();
    localStorage.setItem('kapwa-theme', theme);

    const listener = () => { if (theme === 'system') apply(); };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  return { theme, setTheme, isDark: theme === 'dark' };
}
```

**Why class-based toggle (not CSS `@media prefers-color-scheme`):**
- User override: social workers in brightly-lit offices may want dark mode even if OS is light.
- Persistence: user choice survives page reload (localStorage).
- shadcn compatibility: all shadcn components use `.dark` selector for dark values.
- No flash-of-wrong-theme: class is applied before hydration via inline script in `index.html`.

**Theme toggle component — no next-themes:**
The codebase is a Vite SPA (not Next.js), so `next-themes` is not a dependency. The `useTheme` hook above is the correct lightweight solution. Mount a toggle button in Topbar's UserMenu:
```typescript
<DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
  <SunMoon size={16} />
  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
</DropdownMenuItem>
```

### Pattern 3: Extracted Layout Components

**What:** Break the monolithic 182-line `Layout.tsx` into separate components that each own one responsibility.

**Current Layout.tsx problems:**
- Sidebar nav items defined inline inside component module
- Mobile toggle state managed alongside offline banner, user loading
- Search input markup mixed with notification dropdowns
- No ARIA landmarks beyond implicit HTML semantics
- Filtering NAV_ITEMS by role happens every render

**Target structure:**
```
src/components/layout/
├── LayoutShell.tsx        # Orchestrator — composes Topbar + Sidebar + ContentArea
├── Topbar.tsx             # Sticky header with slots
├── Sidebar.tsx            # Navigation panel with role filtering
├── SidebarNav.tsx         # Nav items mapping (extracted from Layout.tsx NAV_ITEMS)
├── ContentArea.tsx        # Suspense + Outlet + RouteErrorBoundary wrapper
├── Breadcrumbs.tsx        # Auto-generated breadcrumb
├── UserMenu.tsx           # DropdownMenu with avatar, settings, logout
├── SkipToContent.tsx      # A11y skip link
├── MobileNav.tsx          # Bottom tab bar for mobile (optional)
└── OfflineBanner.tsx      # Extracted from Layout.tsx inline
```

**LayoutShell orchestration:**
```typescript
// LayoutShell.tsx
export function LayoutShell() {
  return (
    <>
      <SkipToContent />
      <OfflineBanner />
      <div className="flex min-h-screen">
        {/* Sidebar — hidden on mobile, shown via Sheet */}
        <Sidebar className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0" />

        {/* Mobile sidebar trigger */}
        <MobileSidebar />

        <div className="flex flex-col flex-1 lg:pl-64">
          <Topbar />
          <Breadcrumbs />
          <ContentArea>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ContentArea>
        </div>
      </div>
    </>
  );
}
```

**Why extract:**
- Testability: each component can be tested in isolation
- Bundle splitting: Topbar changes won't cause Sidebar re-renders
- Maintainability: a new developer finding "layout" in the file tree sees 7 focused files, not a 182-line monolith
- Accessibility: SkipToContent is rendered as the very first focusable element

### Pattern 4: Route-Level Error Boundaries

**What:** Add `errorElement` to each route group so a crash in one page doesn't take down the entire app. The top-level ErrorBoundary still exists as a last resort.

**Current:** Single `ErrorBoundary` wrapping `RouterProvider` — any page crash kills the entire app, user sees generic "Something went wrong."

**Target — two-layer error handling:**

```typescript
// routes.tsx
const router = createBrowserRouter([
  // Public routes have their own errorElement
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },

  // App shell has its own errorElement (catches layout crashes)
  {
    path: '/',
    element: <ProtectedRoute><LayoutShell /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Each lazy page wrapped in Suspense — if page fails to load, error bubbles to layout's errorElement
      { index: true, element: <Suspense...><DashboardPage /></Suspense> },
      // ... rest
    ],
  },
]);
```

```typescript
// RouteErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <ErrorDisplay type="not-found" onBack={() => navigate('/')} />;
    }
    if (error.status === 403) {
      return <ErrorDisplay type="forbidden" onBack={() => navigate('/')} />;
    }
    return <ErrorDisplay type="error" status={error.status} message={error.statusText} onRetry={() => navigate(0)} onBack={() => navigate('/')} />;
  }

  const err = error as Error;
  return (
    <ErrorDisplay
      type="crash"
      message={err.message}
      onRetry={() => navigate(0)}
      onBack={() => navigate('/')}
    />
  );
}
```

**Why two layers:**
- Route errors are recoverable (retry, go back) without losing app state
- The Layout shell stays rendered during error display — sidebar and topbar remain functional
- Only the content area shows the error, not a full white screen

### Pattern 5: Page Shell Composition (Per-Page Pattern)

**What:** Every page should follow a consistent wrapper pattern that provides loading, empty, error, and success states through a shared composition.

```typescript
// Shared pattern applied to every page
export function DashboardPage() {
  const { data, error, isLoading } = useDashboardData();

  if (isLoading) return <PageLoader rows={4} />;
  if (error) return <ErrorDisplay message={error.message} onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState icon={<LayoutDashboard />} title="No data yet" description="..." action={<Button>Create First Case</Button>} />;

  return (
    <PageShell title="Dashboard" description="Overview of operations">
      {/* Actual page content — stats, tables, charts */}
    </PageShell>
  );
}
```

**Key components:**

| Component | When to Show | Behavior |
|-----------|-------------|----------|
| `PageLoader` | Initial fetch, route transition | Skeleton matching page layout (cards, table rows) |
| `EmptyState` | Fetch succeeded, zero results | Illustration + message + optional CTA |
| `ErrorDisplay` | Fetch failed or route error | Error message + retry button + back navigation |
| `PageShell` | Always wraps page content | Consistent title/description header, spacing |

**PageShell:**
```typescript
// components/PageShell.tsx — not a layout component, just a page-wrapper
interface PageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;  // For "Add New" buttons, export, etc.
  children: React.ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
```

### Pattern 6: Accessibility Layer

**Skip to content (rendered first in DOM):**
```typescript
// SkipToContent.tsx
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-md"
    >
      Skip to main content
    </a>
  );
}
```

**ARIA landmarks on LayoutShell:**
```typescript
// LayoutShell
<header role="banner">        {/* Topbar */}
<nav role="navigation" aria-label="Main navigation">   {/* Sidebar */}
<main id="main-content" role="main" tabIndex={-1}>    {/* Content */}
```

**Focus ring management:**
Already present in shadcn components via `focus-visible:ring-2 focus-visible:ring-ring`. Ensure:
1. No `outline: none` without providing a focus-ring alternative
2. Custom `focus-visible:` styles on all interactive elements (buttons, links, form controls)
3. Modal dialogs trap focus (Radix Dialog/Sheet handle this automatically)

**Heading hierarchy:**
- Each page: single `<h1>` (the page title from PageShell)
- Sections: `<h2>` or `<h3>`
- Cards/subsections: consistent heading level, never skip levels (h1 → h3 is bad, h1 → h2 → h3 is good)

### Pattern 7: Print Stylesheet Architecture

**Current:** 6 lines of print CSS in index.css — `@media print { @page A4; body white; .no-print hidden; }`

**Target approach:** Dedicated `print.css` imported in main.tsx, plus per-page print variants.

```css
/* src/styles/print.css */
@media print {
  /* Base print reset */
  @page { size: A4 portrait; margin: 15mm 20mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Hide everything non-content */
  nav, header, footer, .sidebar, .topbar, .breadcrumbs,
  button, .no-print, .print\:hidden {
    display: none !important;
  }

  /* Show print-only elements */
  .print\:block { display: block !important; }
  .print\:inline { display: inline !important; }

  /* Content takes full width */
  main, .content-area, [role="main"] {
    margin: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* Typography */
  body { font-size: 10.5pt; line-height: 1.4; color: #000; }
  h1 { font-size: 14pt; }
  h2 { font-size: 12pt; }

  /* Tables — border collapse for print */
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 4pt 6pt; }
}
```

Per-report stylesheets (e.g., Access Card is a credit-card-sized print):
```css
/* src/styles/print/access-card.css */
@media print {
  @page { size: 54mm 86mm; margin: 0; }
  /* Access card specific print layout — card dimensions, barcode, etc. */
}
```

Use `rel="stylesheet" media="print"` for deferred loading (browser only loads it when user prints):
```html
<link rel="stylesheet" href="/styles/print.css" media="print" />
<link rel="stylesheet" href="/styles/print/access-card.css" media="print" />
```

## Data Flow Changes

### Current Data Flow (per page)

```
Page mount → useState → useEffect → apiFetch (api.ts) → SetState → Rerender
  Loading: manual state (useState + useEffect)
  Error: try/catch → setError → render error message inline
  Empty: manual check → render empty message inline
```

Every page reinvents this pattern. 24 pages × ~15 lines of boilerplate = ~360 lines of duplicated fetch logic.

### Target Data Flow — SWR

The codebase already has `swr` in package.json dependencies. It is not used despite being installed.

```typescript
// hooks/use-data.ts (or just import swr directly in pages)
import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

// In any page:
function useDashboard() {
  return useSWR('/dashboard', apiFetch);
}

function useCases(status?: string) {
  return useSWR(['/cases', status], ([url, s]) => apiFetch(`${url}?status=${s}`));
}

// DashboardPage.tsx
export function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR('/dashboard', apiFetch);

  if (isLoading) return <PageLoader rows={3} />;
  if (error) return <ErrorDisplay message={error.message} onRetry={() => mutate()} />;
  if (!data) return <EmptyState ... />;

  return (
    <PageShell title="Dashboard" description="Overview of operations">
      <StatsGrid stats={data.stats} />
      <RecentCasesTable cases={data.recentCases} />
    </PageShell>
  );
}
```

**Why SWR (already installed, not used):**
- Deduplication: two components requesting `/dashboard` share one network call
- Caching: offline user sees stale data while SWR revalidates
- Refetch on focus: when a social worker returns to the tab after entering case notes, SWR auto-refreshes
- Pagination via `useSWRInfinite` for beneficiary/case lists
- Mutation helpers: `mutate()` for optimistic updates

**Migration strategy:**
- Leave existing `api.ts` functions in place (they work)
- Wrap API calls in SWR hooks per-page
- Gradual migration — new pages use SWR, old pages converted one at a time
- SWR fetcher = `apiFetch` (which already handles auth headers)

## Route Architecture

### Current Route Table

28 routes defined in `createBrowserRouter([...])`:
- 1 public (LoginPage at /login)
- 27 private (all under <ProtectedRoute><Layout> wrappers)
- All routes eagerly loaded (24 page imports at the top of routes.tsx)

### Target Route Table

```typescript
// Route groups
const PUBLIC_ROUTES = [
  { path: '/', element: <LandingPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/login', element: <LoginPage /> },
];

const APP_ROUTES = [
  { index: true, element: <DashboardPage /> },
  { path: 'intake', element: <IntakePage /> },
  { path: 'cases', element: <CasesPage /> },
  { path: 'beneficiaries', element: <BeneficiariesPage /> },
  { path: 'beneficiaries/:id', element: <BeneficiaryViewPage /> },
  { path: 'interventions', element: <InterventionsPage /> },
  { path: 'tracker', element: <CaseTrackerPage /> },
  { path: 'csr', element: <CsrPage /> },
  { path: 'admin', element: <AdminPage /> },
  { path: 'filing', element: <FilingPage /> },
  { path: 'approvals', element: <ApprovalPipelinePage /> },
  { path: 'settings/mfa', element: <MfaSetupPage /> },
  { path: 'irf', element: <IrfPage /> },
  { path: 'irf/:id', element: <IrfDetailPage /> },
  { path: 'access-cards', element: <AccessCardPage /> },
  { path: 'beneficiaries/:id/card/print', element: <AccessCardPrintView /> },
  { path: 'programs', element: <ProgramsPage /> },
  { path: 'coordinator', element: <CoordinatorDashboardPage /> },
  { path: 'messages', element: <MessagesPage /> },
  { path: 'my-access-card', element: <MyAccessCardPage /> },
  { path: 'reports', element: <MayorReportsPage /> },
  { path: 'audit-logs', element: <AuditorPage /> },
  { path: 'my-dashboard', element: <ClaimantDashboardPage /> },
];
```

**Public landing page at /** vs **redirect**: This is a decision point. Currently `/` redirects to DashboardPage (protected). Adding a public landing page means:
- Landing at `/` shows marketing/public info about Kapwa
- `/login` stays as-is
- `/dashboard` (or `/app`) becomes the authenticated home
- Authenticated users visiting `/` could be auto-redirected to `/dashboard`

**Recommended approach:** Keep `/` as landing page for unauthenticated visitors. Add a one-line check in LandingPage:
```typescript
export function LandingPage() {
  const token = localStorage.getItem('kapwa_token');
  if (token) return <Navigate to="/dashboard" replace />;
  return <LandingContent />;
}
```

### Role-Based Route Visibility

Current approach: role checking in ProtectedRoute (redirect if role mismatch) + role filtering in Layout sidebar NAV_ITEMS.

Target: Keep this pattern but extract NAV_ITEMS into a `sidebar-nav-items.ts` config file. This makes it testable and reviewable.

```typescript
// components/layout/sidebar-nav-items.ts
export const NAV_ITEMS: NavItem[] = [
  { path: '/intake', label: 'GIS Intake', icon: FilePlus, roles: ['admin', 'social_worker', 'coordinator'] },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
  { path: '/beneficiaries', label: 'Beneficiaries', icon: Users, roles: ['admin', 'social_worker'] },
  // ... rest
];
```

## PWA Performance Implications

### Code Splitting Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial bundle size | ~2MB (all 24 pages) | ~250KB (shell + LoginPage) | **~87% reduction** |
| Time to interactive (3G) | ~8-12s | ~2-4s | **~70% faster** |
| Cached pages (SW) | Entire app cached as one blob | Per-page chunks cached independently | Partial page updates possible |

### Caching Strategy

```typescript
// sw.js (workbox or custom)
// Cache app shell immediately
// Lazy-load route chunks on first visit — SW caches them for offline
// SWR responses served stale-while-revalidate

// Key: the app shell (Layout + Topbar + Sidebar) is always cached.
// Only page content chunks need network.
```

### Bundle Analysis

Estimated chunk sizes (based on page complexity):
- Common UI components (shared across pages): ~80KB gzipped
- Layout shell (Topbar + Sidebar + shell): ~30KB gzipped  
- Per page: 5-40KB gzipped depending on form complexity
- Dashboard: ~15KB
- IntakePage (heaviest form): ~40KB
- AdminPage: ~25KB
- LandingPage: ~20KB

### Loading State UX

Avoid flash-of-loading on fast connections:
```typescript
// hooks/use-delayed-fallback.ts
import { useState, useEffect } from 'react';

export function useDelayedFallback(delayMs = 300) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return show;
}
```

In PageLoader:
```typescript
export function PageLoader({ rows = 3 }: { rows?: number }) {
  const show = useDelayedFallback();
  if (!show) return null; // Render nothing for 300ms — fast connections skip skeleton flash

  return (
    <div className="space-y-4 p-6" aria-label="Loading" role="status">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

## Build Order (Dependency Chain)

```
Phase 1: FOUNDATION (no new visual changes, enables everything else)
├── Design token system (CSS variables)
│   ├── Add .dark block to index.css
│   ├── Add sidebar tokens to index.css + tailwind.config.js
│   └── Create hooks/use-theme.ts + ThemeProvider
├── Public page route group
│   ├── Create LandingPage.tsx
│   ├── Create AboutPage.tsx
│   └── routes.tsx: add public routes before auth check
├── Layout extraction
│   ├── Create components/layout/ directory
│   ├── Extract Topbar.tsx (preserve existing visual)
│   ├── Extract Sidebar.tsx (preserve existing visual)
│   ├── Extract OfflineBanner.tsx
│   ├── Add skip-to-content
│   ├── Add ARIA landmarks
│   └── Route-shell with Suspense
├── Per-route error boundaries
│   ├── Create RouteErrorBoundary.tsx
│   ├── routes.tsx: add errorElement to all route objects
│   └── Keep top-level ErrorBoundary as last resort

Phase 2: COMPONENT LIBRARY (build the toolkit before using it)
├── Install missing shadcn components via CLI
│   ├── npx shadcn@latest add dialog sheet dropdown-menu skeleton
│   ├── npx shadcn@latest add tooltip select table tabs breadcrumb
│   ├── npx shadcn@latest add scroll-area command separator
│   └── npx shadcn@latest add popover (verify existing aligns)
├── Create shared page-state components
│   ├── PageShell.tsx (title + description + actions wrapper)
│   ├── PageLoader.tsx (skeleton loading)
│   ├── EmptyState.tsx
│   └── ErrorDisplay.tsx
├── Layout polish (use new components)
│   ├── Topbar: add UserMenu (DropdownMenu)
│   ├── Sidebar: style with shadcn components
│   └── Breadcrumbs: add breadcrumb component
├── Theme toggle in UserMenu
│   └── Light/Dark toggle button with SunMoon icon

Phase 3: MOBILE & RESPONSIVE
├── Mobile sidebar via Sheet component
├── Bottom tab nav for mobile (MobileNav.tsx)
├── Responsive data tables (horizontal scroll, card view on mobile)
├── Touch-friendly form controls (larger targets)
└── Offline indicator as bottom sheet (not fixed top banner)

Phase 4: PAGE POLISH (convert each page)
├── Replace legacy CSS classes with shadcn components
│   ├── .table → <Table> component
│   ├── .form-input → <Input> component  
│   ├── .btn → <Button> variant
│   ├── .badge-* → <Badge> variant
│   ├── .card → <Card> component
│   ├── .spinner → <Spinner> component
│   └── .page-header/.page-title → <PageShell>
├── Add loading/empty/error states to every page
├── Add SWR data fetching (migrate from manual useState+useEffect)
│   └── One page at a time, starting with DashboardPage
└── Responsive pass per page

Phase 5: PRINT & ACCESSIBILITY AUDIT
├── Print stylesheets
│   ├── src/styles/print.css (global print reset)
│   ├── Print preview button on report pages
│   └── Per-report print layouts (Access Card, CSR, IRF)
├── Accessibility audit
│   ├── Keyboard navigation test (all interactive elements reachable)
│   ├── Screen reader test (headings, landmarks, form labels)
│   ├── Color contrast check (WCAG AA for all text)
│   └── Focus management in modals, dropdowns, sheets
└── Reduced motion preferences (respect prefers-reduced-motion)

Phase 6: POLISH & EDGE CASES
├── Page transitions (optional, low priority)
│   └── Consider `framer-motion` for route transitions if time permits
├── Command palette (Ctrl+K) for power users
├── Keyboard shortcuts (optional)
└── Final accessibility pass

## Design Token System Detail

### Current Token Mapping

The existing project already has a correct shadcn-compatible theme setup:
- `components.json`: `"cssVariables": true`, `"style": "default"`
- `tailwind.config.js`: All colors map to `var(--*)` properly
- `index.css`: `:root` block with all standard shadcn tokens

This means new shadcn components installed via CLI will automatically pick up the existing theme.

### Tokens to Add

| Token | Purpose | Current Status | Phase |
|-------|---------|---------------|-------|
| `--sidebar-*` | Sidebar-specific colors | Missing | Phase 1 |
| `--chart-1` through `--chart-5` | Chart colors (for dashboard) | Missing | Phase 4 |
| `.dark { ... }` | Dark mode overrides | Missing | Phase 1 |
| Spacing scale tokens | Custom spacing (if needed beyond Tailwind's) | Not needed | — |
| Typography tokens | Font size/weight scale | Partially in tailwind via fontFamily | — |

### Color Format Decision

Current tokens use hex (`#F8FAFC`). shadcn v4 uses OKLCH (`oklch(0.97 0.01 260)`).

**Decision:** Keep hex for now. OKLCH provides better perceptual uniformity but is not necessary for this project. The hex-based tokens work correctly with all shadcn components — shadcn doesn't require OKLCH, it just provides a default theme in that format. Migrating to OKLCH would provide no visible user benefit for Kapwa and is a purely cosmetic code change.

**Exception:** If the Kapwa brand requires specific hue/chroma/saturation control for accessibility compliance, migrate to OKLCH. Otherwise, hex is fine.

## Anti-Patterns

### Anti-Pattern 1: Layout Re-Mount on Route Change

**What people do:** Wrapping each route with `<Layout>` individually so every page navigation unmounts and remounts the sidebar and topbar.

**Why it's wrong:**
- Sidebar state (scroll position, open/closed mobile) resets
- Network requests in Topbar (notifications) re-fire
- User sees a flash while layout re-renders

**Do this instead:** Use a single parent layout route in `createBrowserRouter`. The layout renders once. Only the `<Outlet />` content changes:
```typescript
{
  element: <LayoutShell />,  // renders once, never unmounts
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'intake', element: <IntakePage /> },
    // ...
  ],
}
```

### Anti-Pattern 2: Per-Page Loading Boilerplate

**What people do:** Each page has `useState`, `useEffect`, `try/catch`, loading/error/empty JSX — 60+ lines of scaffolding before any real content.

**Why it's wrong:**
- Massive code duplication across 24 pages
- Inconsistent UX (some pages show spinner, some show "Loading...", some don't show anything)
- Bugs from missing error or empty state handling

**Do this instead:** Centralize patterns via `PageLoader`, `EmptyState`, `ErrorDisplay`, `PageShell` components. Use SWR for data fetching (built-in `data`, `error`, `isLoading` states). Each page becomes ~30 lines instead of ~100.

### Anti-Pattern 3: Using CSS Variables for Dynamic Styling

**What people do:** Changing CSS variable values at runtime via JavaScript when a prop-based approach would be simpler (e.g., setting `--accent: #FF0000` per-user instead of passing a `color` prop).

**Why it's wrong:**
- CSS variables are global — changing one affects all components that reference it
- Race conditions if two components try to set the same variable
- Hard to reason about which code changed which variable

**Do this instead:** Pass props for component-specific overrides. CSS variables are for theme-level tokens (light/dark mode), not instance-level styling. Use `className` or variant props for per-instance customization.

### Anti-Pattern 4: Neglecting Print During Development

**What people do:** Building the entire UI for screen viewing, then realizing at deployment that social workers need to print reports for physical filing at MSWDO.

**Why it's wrong:**
- Tables get cut off at page breaks
- Navigation and buttons show up in printed documents
- Font sizes are too large for A4
- Dark mode inverts colors on print

**Do this instead:** Add `media="print"` stylesheets early (Phase 5 in build order). Use `print:` Tailwind utilities and `.no-print` class from the start. Every table and report page should have a print preview mode.

### Anti-Pattern 5: Wrapping Everything in ErrorBoundary

**Current state:** Single ErrorBoundary wrapping the entire RouterProvider. One page crashes → full white screen → user loses sidebar navigation.

**Do this instead:** Route-level error boundaries via `errorElement`. The layout stays alive. The user can navigate to another page without refreshing. Only the broken content area shows the error.

## Sources

- **shadcn/ui v4.11 Theming:** https://ui.shadcn.com/docs/theming — CSS variable tokens, token convention (background/foreground pairs), dark mode via .dark selector
- **shadcn Dark Mode (Vite):** https://ui.shadcn.com/docs/dark-mode/vite — ThemeProvider pattern for non-Next.js SPAs
- **shadcn Tailwind v4 Migration:** https://ui.shadcn.com/docs/tailwind-v4 — OKLCH color format, tw-animate-css deprecation, sidebar tokens
- **shadcn Component List:** https://ui.shadcn.com/docs/components — Full list of 60+ CLI-installable components
- **Customization Skill:** https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/customization.md — Official customization patterns
- **Existing codebase analysis:** kapwa-client/src/ — Direct code review of all components, pages, routes, and config files

---
*Architecture research for: Kapwa UI/UX Overhaul (v1.1 milestone)*
*Researched: 2026-06-27*
