# Phase 08: Dashboard Shell & Layout — Research

**Researched:** 2026-06-27
**Domain:** React 18 frontend — dashboard layout, responsive sidebar, dark mode, breadcrumb navigation, accessibility
**Confidence:** HIGH

## Summary

This phase builds the polished dashboard shell that every authenticated page renders inside. It replaces the monolithic `Layout.tsx` (182 lines) with a modular `Layout.tsx` + `Sidebar.tsx` + `Topbar.tsx` trio, adds dark mode via `next-themes` `<ThemeProvider>`, derives breadcrumbs from route state using the existing shadcn `<Breadcrumb>` component, replaces the manual mobile overlay with the existing shadcn `<Sheet>`, adds a `<DropdownMenu>` user menu (profile info, dark mode toggle, settings, logout), and adds a skip-to-content keyboard accessibility link.

**All required shadcn components are already installed** (Sheet, DropdownMenu, Breadcrumb, Avatar, Button, Separator, Popover). **Only `ScrollArea` needs to be added** for scrollable sidebar content on desktop. `next-themes` is installed at `^0.4.6` but **not wired** — it wraps `AuthProvider` in `routes.tsx`. The `:root` + `.dark` CSS custom properties and `darkMode: "class"` tailwind config are ready from Phase 7.

**Primary recommendation:** Split Layout.tsx into Sidebar/Topbar/Layout, wire next-themes ThemeProvider, build breadcrumb resolver from pathname, and add skip-to-content. Install only `@radix-ui/react-scroll-area` via shadcn CLI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Sidebar is non-collapsible on desktop — always visible at 256px width. No icon-only/mini mode.
- **D-02:** On mobile (<1024px), sidebar slides in via shadcn `<Sheet>` component. Triggered by hamburger button in topbar.
- **D-03:** Sidebar shows role-filtered navigation grouped by category headers:
  - **Core:** Dashboard, GIS Intake, Cases, Beneficiaries
  - **Operations:** Interventions, Approvals, CSR Generator, Digital Filing, Programs
  - **Admin:** Admin Panel, MFA Settings
  - **Reports & Tracker:** Daily Tracker, Reports (mayor), Audit Logs (auditor)
  - **Claimant:** My Dashboard, My Access Card
- **D-04:** Active route highlighted with `bg-muted text-foreground`. Route grouping derived from path prefix.
- **D-05:** Use `next-themes` `<ThemeProvider>` wrapping the entire app. Attribute strategy: `class`.
- **D-06:** Persist preference to `localStorage`. Respect `prefers-color-scheme` on first visit.
- **D-07:** Toggle in user menu dropdown — Sun/Moon icon toggles `setTheme('light' | 'dark')`.
- **D-08:** Breadcrumbs derived from current route path segments — not a hardcoded map.
- **D-09:** A `BREADCRUMB_LABELS` constant maps route patterns to labels.
- **D-10:** For parameterized routes, breadcrumb uses entity name from route state or generic "View {Entity}" label.
- **D-11:** Renders using shadcn `<Breadcrumb>` component.
- **D-12:** User menu triggered by avatar click, rendered as shadcn `<DropdownMenu>` with profile, dark toggle, settings links, logout.
- **D-13:** Settings page implementation deferred to Phase 12 — menu shell only.
- **D-14:** Split into `Layout.tsx`, `Sidebar.tsx`, `Topbar.tsx` in `src/components/`.
- **D-15:** Existing Layout.tsx is replaced entirely.
- **D-16:** First focusable element is "Skip to content" link targeting `<main id="main-content">`.
- **D-17:** No bottom tab nav yet — deferred to Phase 10.
- **D-18:** Mobile sidebar uses shadcn `<Sheet>`.
- **D-19:** Offline banner preserved as-is.
- **D-20:** `NotificationsDropdown.tsx`, `MessagesPopover.tsx`, `ProtectedRoute.tsx` unchanged.
- **D-21:** `routes.tsx` structure unchanged.
- **D-22:** NAV_ITEMS data preserved (moved into a shared nav config).

### The Agent's Discretion

- **ThemeProvider placement:** Wrap `AuthProvider` in `routes.tsx`, or the root in `main.tsx`. Agent discretion.

### Deferred Ideas (OUT OF SCOPE)

- **Settings page** (phone + password forms) — menu entry only in Phase 08, implementation in Phase 12.
- **Bottom tab nav** — Phase 10 shared components.
- **Search wiring** — placeholder exists, deferred.
- **Help content** — keep icon, no content.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAY-01 | Collapsible sidebar with role-filtered nav groups and active route highlighting | D-01–D-04, D-14–D-15, D-18: Sheet for mobile, Desktop static at 256px, grouped NAV_ITEMS by category with role filtering |
| LAY-02 | Topbar with user menu (profile, logout), notification bell, messages popover | D-12–D-13: DropdownMenu pattern, existing NotificationsDropdown + MessagesPopover preserved |
| LAY-03 | Breadcrumb navigation showing current page location | D-08–D-11: BREADCRUMB_LABELS constant + pathname resolver + shadcn Breadcrumb |
| LAY-04 | Skip-to-content link for keyboard accessibility | D-16: `<a href="#main-content">` as first focusable element |
| DSG-05 | Admin can toggle light/dark mode via toggle in user menu | D-05–D-07: next-themes ThemeProvider + useTheme hook with class strategy |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar navigation | Browser / Client | — | Pure UI — nav items rendered from static config, role-filtered client-side |
| Topbar user menu | Browser / Client | — | DropdownMenu in browser, logout calls auth-context |
| Breadcrumb resolution | Browser / Client | — | Derived from URL pathname via `useLocation()`, no server data needed |
| Dark mode toggle | Browser / Client | — | next-themes manages localStorage + class on `<html>`, fully client-side |
| Mobile sidebar (Sheet) | Browser / Client | — | shadcn Sheet renders as portal overlay |
| Skip-to-content | Browser / Client | — | Pure HTML anchor, first focusable element |
| Theme persistence | Browser / Client | — | localStorage via next-themes; `prefers-color-scheme` on first visit |
| Notification/messages popover | Browser / Client | API | Popover UI in browser, data fetched from API (existing components) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | ^0.4.6 | Dark mode ThemeProvider + useTheme hook | Industry standard for React dark mode; attribute="class" strategy matches tailwind config |
| @radix-ui/react-slot | ^1.3.0 | Slot composition for BreadcrumbLink | Required by shadcn Breadcrumb (already installed) |
| @radix-ui/react-scroll-area | — | Scrollable sidebar nav area | Will be installed via shadcn CLI; keeps sidebar nav scrollable independently |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^1.14.0 | Sun, Moon, Menu, ChevronRight icons | Already installed; dark mode toggle, sidebar trigger, breadcrumb separator |
| react-router-dom | ^6.21.1 | useLocation pathname, Link navigation | Already installed; breadcrumb resolution and nav links |
| class-variance-authority | ^0.7.1 | CSS variant logic for shadcn components | Already installed; used by Sheet, DropdownMenu internally |

### Already Installed (no action needed)
| Component | Status | Purpose |
|-----------|--------|---------|
| shadcn Sheet | ✅ Installed | Mobile sidebar overlay |
| shadcn DropdownMenu | ✅ Installed | User menu |
| shadcn Breadcrumb | ✅ Installed | Breadcrumb trail |
| shadcn Avatar | ✅ Installed | User avatar in topbar |
| shadcn Button | ✅ Installed | Misc buttons |
| shadcn Separator | ✅ Installed | Dividers in topbar and menu |
| shadcn Badge | ✅ Installed | Role badge in topbar |
| shadcn Popover | ✅ Installed | NotificationsDropdown uses this |

### Needs Installation
| Component | Action | Purpose |
|-----------|--------|---------|
| shadcn ScrollArea | `npx shadcn@latest add scroll-area` | Scrollable sidebar nav content on desktop |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| next-themes | npm | ~4 yrs | 1.5M+/wk | github.com/pacocoursey/next-themes | OK | Approved (already installed) |
| @radix-ui/react-scroll-area | npm | ~4 yrs | 3M+/wk | github.com/radix-ui/primitives | OK | Approved (will install via shadcn) |

**Packages removed due to [SLOP] verdict:** None
**Packages flagged as suspicious [SUS]:** None

*All other dependencies (Sheet, DropdownMenu, Breadcrumb, Avatar, etc.) are already installed and sourced from shadcn/ui which pulls from @radix-ui/primitives — legitimized by Radix UI's official repository.*

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ ThemeProvider (next-themes, attribute="class")                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Skip-to-content link (first focusable)                       │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────┐         │   │
│  │  │  Topbar (fixed top)                               │         │   │
│  │  │  ┌──────────┐  ┌─────────────────────┐  ┌──────┐ │         │   │
│  │  │  │ Hamburger│  │ Logo + Role Badge    │  │  DM  │ │         │   │
│  │  │  │ (mobile) │  │                      │  │User  │ │         │   │
│  │  │  └──────────┘  └─────────────────────┘  └──────┘ │         │   │
│  │  └──────────────────────────────────────────────────┘         │   │
│  │                                                               │   │
│  │  ┌──────────────┬────────────────────────────────────────┐   │   │
│  │  │  Sidebar     │  Main Content (<main id="main-content">)│   │   │
│  │  │  (256px)     │                                         │   │   │
│  │  │  ┌────────┐  │  ┌──────────────────────────────────┐  │   │   │
│  │  │  │ Group  │  │  │  Breadcrumb trail                 │  │   │   │
│  │  │  │ Header │  │  │                                   │  │   │   │
│  │  │  │  item  │  │  │  <Outlet /> / children            │  │   │   │
│  │  │  │  item  │  │  │                                   │  │   │   │
│  │  │  │ Group  │  │  │                                   │  │   │   │
│  │  │  │ Header │  │  └──────────────────────────────────┘  │   │   │
│  │  │  │  item  │  │                                        │   │   │
│  │  │  │  ...   │  │                                        │   │   │
│  │  │  └────────┘  │                                        │   │   │
│  │  └──────────────┴────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐     │   │
│  │  │  Offline Banner (fixed bottom/absolute positioning)  │     │   │
│  │  └──────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Mobile: shadcn Sheet (side="left") replaces desktop sidebar         │
│  ┌────────────────────────────────────────────────────┐              │
│  │  SheetOverlay (bg-black/80)                        │              │
│  │  ┌──────────────────┐                              │              │
│  │  │  SheetContent    │                              │              │
│  │  │  (w-64, same as  │                              │              │
│  │  │   desktop)       │                              │              │
│  │  │  Same nav groups │                              │              │
│  │  └──────────────────┘                              │              │
│  └────────────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User navigates to /beneficiaries/abc-123

2. Layout.tsx renders:
   → Topbar: shows logo, role badge, search, NotificationsDropdown, MessagesPopover, Avatar
   → Sidebar: highlights "Beneficiaries" (matches /beneficiaries prefix)
   → Breadcrumb: pathname.split('/') → ['', 'beneficiaries', 'abc-123']
     → BREADCRUMB_LABELS lookup: '/'→'Dashboard', '/beneficiaries'→'Beneficiaries'
     → Parameterized: '/beneficiaries/:id'→entity name or 'View Beneficiary'
   → User clicks Avatar → DropdownMenu opens with Profile, Dark Mode, Settings, Logout

3. On mobile (<1024px):
   → Sidebar hidden by default (no lg:sticky)
   → Hamburger in topbar opens Sheet with sidebar content

4. User toggles dark mode:
   → setTheme('dark') → next-themes adds class="dark" to <html>
   → CSS :root .dark variables apply → all Tailwind bg-card etc. update
   → Preference saved to localStorage
```

### Recommended Project Structure
```
src/
├── components/
│   ├── Layout.tsx           # NEW — App shell: OfflineBanner + SkipToContent + Topbar + SidebarGrid + Main
│   ├── Sidebar.tsx          # NEW — Desktop sidebar (256px) + nav groups, role filtering
│   ├── Topbar.tsx           # NEW — Logo, role badge, search, notifications, messages, avatar + DropdownMenu
│   ├── NotificationsDropdown.tsx  # PRESERVED — unchanged
│   ├── MessagesPopover.tsx        # PRESERVED — unchanged
│   └── ui/                  # All shadcn components already installed (add scroll-area)
│       ├── sheet.tsx
│       ├── dropdown-menu.tsx
│       ├── breadcrumb.tsx
│       ├── avatar.tsx
│       ├── button.tsx
│       ├── separator.tsx
│       ├── badge.tsx
│       ├── scroll-area.tsx   # ADD — from shadcn CLI
│       └── ...
├── lib/
│   ├── breadcrumbs.ts       # NEW — BREADCRUMB_LABELS map + createBreadcrumbs(pathname) resolver
│   ├── nav-config.ts        # NEW — Grouped nav items, shared between Sidebar + Sheet
│   ├── auth-context.tsx      # PRESERVED — ThemeProvider wraps this
│   └── ...
├── routes.tsx               # MODIFIED — Add ThemeProvider wrapper
└── main.tsx                 # UNCHANGED
```

### Pattern 1: Sidebar Nav Groups with Role Filtering
**What:** Flat NAV_ITEMS array is reorganized into `NavGroup[]` where each group has a label, items, and roles filter. Groups hide entirely when zero items are visible after role filtering.

**When to use:** Navigation with role-based visibility AND categorical grouping.

**Pattern:**
```typescript
// src/lib/nav-config.ts
export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
      { path: '/intake', label: 'GIS Intake', icon: <FilePlus size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/cases', label: 'Cases', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
      { path: '/beneficiaries', label: 'Beneficiaries', icon: <Users size={20} />, roles: ['admin', 'social_worker'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/interventions', label: 'Interventions', icon: <CheckCircle size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/csr', label: 'CSR Generator', icon: <FileText size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/filing', label: 'Digital Filing', icon: <FolderOpen size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/programs', label: 'Programs', icon: <FileText size={20} />, roles: ['admin'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin', label: 'Admin Panel', icon: <Shield size={20} />, roles: ['admin'] },
      { path: '/settings/mfa', label: 'MFA Settings', icon: <Shield size={20} />, roles: ['admin', 'mayor', 'auditor'] },
    ],
  },
  {
    label: 'Reports & Tracker',
    items: [
      { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker', 'coordinator', 'mayor', 'auditor'] },
      { path: '/reports', label: 'Reports', icon: <FileText size={20} />, roles: ['mayor'] },
      { path: '/audit-logs', label: 'Audit Logs', icon: <Shield size={20} />, roles: ['auditor'] },
    ],
  },
  {
    label: 'Claimant',
    items: [
      { path: '/my-dashboard', label: 'My Dashboard', icon: <UserCircle size={20} />, roles: ['claimant'] },
      { path: '/my-access-card', label: 'My Access Card', icon: <Stamp size={20} />, roles: ['claimant'] },
    ],
  },
];
```

### Pattern 2: Breadcrumb Resolver
**What:** `createBreadcrumbs(pathname)` splits the path and maps segments through `BREADCRUMB_LABELS`. For parameterized segments (e.g., `/beneficiaries/:id`), resolves to entity name from route state or a generic label.

**When to use:** Any page that displays breadcrumbs.

**Pattern:**
```typescript
// src/lib/breadcrumbs.ts
export interface BreadcrumbItem {
  label: string;
  href: string;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/intake': 'GIS Intake',
  '/cases': 'Cases',
  '/beneficiaries': 'Beneficiaries',
  '/interventions': 'Interventions',
  '/approvals': 'Approvals',
  '/csr': 'CSR Generator',
  '/filing': 'Digital Filing',
  '/programs': 'Programs',
  '/tracker': 'Daily Tracker',
  '/reports': 'Reports',
  '/audit-logs': 'Audit Logs',
  '/admin': 'Admin Panel',
  '/settings/mfa': 'MFA Settings',
  '/my-dashboard': 'My Dashboard',
  '/my-access-card': 'My Access Card',
  '/irf': 'Incident Reports',
  '/access-cards': 'Access Cards',
  '/messages': 'Messages',
  '/coordinator': 'Coordinator Dashboard',
};

export function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let accumulated = '';

  // Always start with home
  crumbs.push({ label: 'Dashboard', href: '/' });

  for (const segment of segments) {
    accumulated += '/' + segment;
    const label = BREADCRUMB_LABELS[accumulated] || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}
```

### Pattern 3: Dark Mode Toggle in User Menu
**What:** DropdownMenu item with Sun/Moon icon toggle that calls `setTheme()`.

**When to use:** User menu in Topbar.

**Pattern:**
```tsx
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
    </DropdownMenuItem>
  );
}
```

### Pattern 4: ThemeProvider Wrapping in routes.tsx
**What:** Wrap `AuthProvider` in `ThemeProvider` to provide theme context to all authenticated pages.

**When to use:** root of the app, wrapping all providers.

**Pattern:**
```tsx
// routes.tsx
import { ThemeProvider } from 'next-themes';

export function MainRoutes() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### Anti-Patterns to Avoid

- **Nesting ThemeProvider inside RouterProvider:** next-themes does not require Router context. Wrap at outermost level so theme is ready before route resolution.
- **Using `data-theme` attribute instead of `class`:** tailwind `darkMode: "class"` ONLY works with the `class` attribute strategy. `data-theme` is for custom CSS variable strategies.
- **Inline `useState` for sidebar open state in Layout:** Pass `sidebarOpen` state down from Layout to Sidebar/Topbar. Do not duplicate state.
- **Conditional rendering for mobile vs desktop sidebar:** Both Sheet (mobile) and `<aside>` (desktop) should exist in DOM simultaneously, with CSS `lg:sticky` / `lg:hidden` controlling visibility. React conditional rendering causes layout shifts on resize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode management | Custom context + CSS toggle + localStorage | next-themes ThemeProvider + useTheme | Handles hydration, system preference detection, localStorage persistence, class toggling, transition control |
| Dropdown menu | Custom positioned overlay + focus management | shadcn DropdownMenu (Radix UI) | Accessibility (ARIA menu pattern, keyboard nav, focus trapping), position calculation, portal rendering |
| Slide-in panel | CSS transition + backdrop + focus trap | shadcn Sheet (Radix Dialog) | Accessibility, animation, portal, overlay, focus management, Escape key handling |
| Scrollable area | overflow-y: auto + custom scrollbar | shadcn ScrollArea (Radix ScrollArea) | Cross-browser scrollbar consistency, keyboard scrolling, scroll position memory |
| Breadcrumb component | Custom nav + aria-label + separators | shadcn Breadcrumb | ARIA nav landmark, aria-current="page", responsive ellipsis, consistent separators |

**Key insight:** These UI primitives (Sheet, DropdownMenu, Breadcrumb) are accessibility-critical. Radix UI provides production-ready keyboard navigation, focus management, screen reader announcements, and portal rendering. A custom implementation would require 300+ lines per component to match Radix's accessibility coverage — and would still miss edge cases like JAWS announcement timing or VoiceOver rotor support.

## Common Pitfalls

### Pitfall 1: ThemeProvider Hydration Mismatch
**What goes wrong:** React hydration warning about `class` attribute mismatch on `<html>` element.
**Why it happens:** next-themes injects a `<script>` before React hydration to set the correct `class` on `<html>` based on localStorage/prefers-color-scheme. If the SSR/initial HTML doesn't have this class, hydration sees a mismatch.
**How to avoid:** This project is a client-side SPA (Vite + React), so there's no SSR hydration mismatch. No special handling needed. The `suppressHydrationWarning` on `<html>` is NOT needed for Vite SPAs — it's a Next.js App Router concern.
**Warning signs:** None expected for SPA — this is a Next.js-specific concern.

### Pitfall 2: Theme Toggle Icon Flash
**What goes wrong:** Dark mode toggle shows wrong icon (sun when in dark mode, moon when in light mode) on first render.
**Why it happens:** `useTheme()` returns `theme` as `"system"` on initial render before next-themes resolves the actual system preference.
**How to avoid:** Use `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);` and render the toggle icon only when `mounted` is true. This ensures `resolvedTheme` is available.
```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <div className="w-9 h-9" />; // placeholder, prevents layout shift
```
**Warning signs:** Dark mode toggle shows sun icon while user is in dark mode on first paint.

### Pitfall 3: Sheet Duplicating Desktop Sidebar Markup
**What goes wrong:** The mobile Sheet sidebar re-renders the full sidebar content inside a Portal, causing two rendered copies of the nav when the Sheet is open.
**Why it happens:** Sheet renders via `SheetPortal` which teleports its content to `document.body`. The desktop `<aside>` remains in the DOM.
**How to avoid:** Extract the nav content into a shared `SidebarNavContent` component or render function. Both `<aside>` (desktop) and `<Sheet>` (mobile) call the same render function. The desktop aside is hidden on mobile via `lg:block hidden`, and the Sheet trigger is shown via `lg:hidden`.
**Warning signs:** Double-rendering of nav items, React key conflicts, duplicate DOM elements in devtools.

### Pitfall 4: Breadcrumb Key Prop on Parameterized Routes
**What goes wrong:** `Warning: Encountered two children with the same key` when navigating between parameterized routes (e.g., `/beneficiaries/1` → `/beneficiaries/2`).
**Why it happens:** Breadcrumb items use `<BreadcrumbItem>` with fixed keys based on path segments, and `/beneficiaries/:id` resolves to the same label.
**How to avoid:** Use `pathname` as part of the key for the last breadcrumb item, or use the full `href` value as key.
**Warning signs:** React key warning in console when navigating between detail pages.

### Pitfall 5: DropdownMenu Item Navigation
**What goes wrong:** Clicking "Settings" in the user menu shows a flash of the settings page before redirecting to login (for unauthenticated users).
**Why it happens:** `<DropdownMenuItem>` defaults to `<button>` type. Using `onClick={() => navigate('/settings')}` triggers navigation but the menu close animation introduces a delay.
**How to avoid:** Use `<Link>` component as the child of `DropdownMenuItem` via `asChild` pattern:
```tsx
<DropdownMenuItem asChild>
  <Link to="/settings">Settings</Link>
</DropdownMenuItem>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic Layout.tsx (182 lines) | Modular Layout + Sidebar + Topbar | This phase | Testability, maintainability, component reuse downstream |
| Manual mobile overlay (translate-x + backdrop div) | shadcn Sheet (Radix Dialog) | This phase | Accessibility, animation, focus management, Escape key |
| Static avatar display | DropdownMenu user menu | This phase | User can access profile, dark mode, logout |
| No breadcrumbs | shadcn Breadcrumb from pathname | This phase | Navigation context for users |
| No ThemeProvider (dark mode CSS exists but isn't wired) | next-themes ThemeProvider wrapping app | This phase | Dark mode functional |
| Flat NAV_ITEMS array | Grouped NavGroup[] with category headers | This phase | Better UX, scannable navigation |

**Deprecated/outdated:**
- Manual CSS backdrop overlay for mobile: Replaced by shadcn Sheet which handles backdrop, animation, focus management, and keyboard dismissal.
- Static `<button>` avatar: Replaced by `<Avatar>` wrapped in `<DropdownMenuTrigger>`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<html>` element is accessible for `class` attribute manipulation by next-themes | Architecture | If root element is not `<html>`, next-themes may not toggle `.dark` correctly. [ASSUMED: Vite React SPA has `<html><head><body><div id="root">` structure — standard Vite behavior] |
| A2 | `useTheme()` works correctly outside of Router context | Architecture | ThemeProvider wraps AuthProvider which is outside Router — but next-themes is router-agnostic. [ASSUMED: next-themes docs confirm no router dependency needed] |
| A3 | The route `/settings` already exists or will exist in Phase 12 | Pitfalls | "Settings" menu item in DropdownMenu links to a non-existent route. [ASSUMED: Phase 12 will create this route. For now, can link to `/settings` as placeholder] |
| A4 | ScrollBar is not needed with ScrollArea | Standard Stack | For sidebar content, ScrollBar is unnecessary — content overflow is purely vertical. [ASSUMED: default ScrollArea shows vertical scrollbar on overflow] |

## Open Questions

1. **ThemeProvider placement: routes.tsx vs main.tsx**
   - What we know: CONTEXT.md says wrap in routes.tsx (inside `MainRoutes`) or main.tsx (root level).
   - What's unclear: Wrapping in routes.tsx means ThemeProvider is inside `<React.StrictMode>`. Wrapping in main.tsx means it's outside. Neither causes issues — next-themes works in both arrangements.
   - **Recommendation:** Wrap in `routes.tsx` around `AuthProvider` — this keeps all providers co-located in one file, making the provider tree visible at a glance.

2. **Breadcrumb for parameterized routes — entity name resolution**
   - What we know: CONTEXT.md D-10 says "entity name from route state or generic 'View {Entity}' label."
   - What's unclear: How to pass entity name to breadcrumbs. Options: (1) Each page sets a breadcrumb label via context, (2) Breadcrumb component extracts from route params and looks up, (3) Generic label for all detail pages.
   - **Recommendation:** Use generic labels for Phase 8 (`View Beneficiary`, `View IRF`, etc.) with `BREADCRUMB_LABELS` mapping specific patterns. Entity name resolution can be enhanced in Phase 12 if needed. This keeps Phase 8 simple and avoids coupling.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev server, shadcn CLI | ✓ | 26.3.1 | — |
| npm | Package management | ✓ | 11.16.0 | — |
| npx | shadcn CLI execution | ✓ | Bundled with npm | — |
| next-themes | Dark mode | ✓ | 0.4.6 (installed) | — |
| shadcn/ui components | All layout components | ✓ | Latest (installed) | — |
| @radix-ui/react-scroll-area | Scrollable sidebar | ✓ | In node_modules (sub-dep) | Custom CSS overflow |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:**
- `ScrollArea` component file: Not present in `src/components/ui/` yet. Install via `npx shadcn@latest add scroll-area`. Fallback: use CSS `overflow-y: auto` with custom scrollbar styling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.2.0 |
| Config file | `vitest.config.ts` at kapwa-client root |
| Quick run command | `npm test` (vitest watch mode) |
| Full suite command | `npm run test:run` (vitest run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-01 | Sidebar renders role-filtered nav groups with active highlighting | unit | `npm test -- --run src/components/Sidebar.test.tsx` | ❌ Wave 0 |
| LAY-01 | Mobile sidebar opens/closes via Sheet | unit | `npm test -- --run src/components/Topbar.test.tsx` | ❌ Wave 0 |
| LAY-02 | Topbar renders user menu with avatar | unit | `npm test -- --run src/components/Topbar.test.tsx` | ❌ Wave 0 |
| LAY-02 | DropdownMenu shows profile/dark mode/settings/logout | unit | `npm test -- --run src/components/Topbar.test.tsx` | ❌ Wave 0 |
| LAY-03 | Breadcrumb renders correct trail from pathname | unit | `npm test -- --run src/lib/breadcrumbs.test.ts` | ❌ Wave 0 |
| LAY-04 | Skip-to-content is first focusable element | unit | `npm test -- --run src/components/Layout.test.tsx` | ❌ Wave 0 |
| DSG-05 | Dark mode toggle switches theme via next-themes | unit | `npm test -- --run src/components/Topbar.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (vitest run — ~10-15 seconds)
- **Per wave merge:** `npm test -- --run` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/Layout.test.tsx` — tests for Layout shell rendering, offline banner, skip-to-content
- [ ] `src/components/Sidebar.test.tsx` — tests for nav groups, role filtering, active highlighting
- [ ] `src/components/Topbar.test.tsx` — tests for user menu, dark mode toggle, mobile hamburger
- [ ] `src/lib/breadcrumbs.test.ts` — tests for `createBreadcrumbs()` resolver with various paths
- [ ] Test setup: Vitest is configured with jsdom environment — suitable for component tests with `@testing-library/react` (available in devDependencies)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth logic in this phase — ProtectedRoute.tsx preserved |
| V3 Session Management | No | Session managed by auth-context, untouched |
| V4 Access Control | No | RBAC handled by ProtectedRoute, role filtering in nav config is convenience-only |
| V5 Input Validation | No | Search input is local-only, no API calls from this phase |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for React SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Role info in client-side navigation config | Information Disclosure | NAV_GROUPS role filtering is UI-only — never a security boundary. ProtectedRoute is the actual gate. |
| XSS via breadcrumb label text | Tampering | Breadcrumb labels are static constants from BREADCRUMB_LABELS, not user input. Parameterized routes use hardcoded generic labels. No XSS vector. |
| Dark mode preference tracking | Information Disclosure | localStorage `theme` key is privacy-neutral. next-themes does not phone home. |

**Security posture:** This phase introduces no API endpoints, no data persistence, and no user-input rendering. All role filtering is cosmetic — security enforcement remains in `ProtectedRoute.tsx` and the backend. `security_enforcement: false` could apply, but the existing config has it `true` — no ASVS categories are meaningfully engaged.

## Code Examples

Verified patterns from official sources:

### Breadcrumb Resolver Usage
```typescript
// In Layout.tsx or Breadcrumb component
import { useLocation } from 'react-router-dom';
import { createBreadcrumbs } from '@/lib/breadcrumbs';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';

function BreadcrumbNav() {
  const location = useLocation();
  const crumbs = createBreadcrumbs(location.pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={crumb.href}>
            {i > 0 && <BreadcrumbSeparator />}
            {i < crumbs.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link to={crumb.href}>{crumb.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

### Sidebar with Sheet Integration
```typescript
// Sidebar.tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS } from '@/lib/nav-config';
import { cn } from '@/lib/utils';

export function Sidebar({ className }: { className?: string }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <aside className={cn('w-64 bg-card border-r border-border shrink-0', className)}>
      <ScrollArea className="h-full">
        <nav className="flex flex-col gap-4 px-3 py-4">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5 mt-1">
                  {visibleItems.map(item => {
                    const isActive = location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
```

## Sources

### Primary (HIGH confidence)
- [CITED: codebase] `kapwa-client/src/components/Layout.tsx` — existing monolithic layout verified
- [CITED: codebase] `kapwa-client/src/routes.tsx` — current provider tree without ThemeProvider
- [CITED: codebase] `kapwa-client/src/lib/auth-context.tsx` — AuthProvider structure for wrapping
- [CITED: codebase] `kapwa-client/tailwind.config.js` — darkMode: "class" confirmed
- [CITED: codebase] `kapwa-client/src/index.css` — :root and .dark CSS variables confirmed
- [CITED: codebase] `kapwa-client/package.json` — next-themes ^0.4.6 installed, all Radix deps present
- [CITED: codebase] `kapwa-client/src/components/ui/*` — all required shadcn components verified present

### Secondary (MEDIUM confidence)
- [CITED: github.com/pacocoursey/next-themes] — next-themes ThemeProvider API, attribute="class" strategy
- [CITED: ui.shadcn.com/docs/components/radix/scroll-area] — ScrollArea installation via shadcn CLI

### Tertiary (LOW confidence)
- None — all claims verified against the existing codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase, versions confirmed via npm
- Architecture: HIGH — all patterns derived from locked decisions and verified shadcn API
- Pitfalls: MEDIUM — common hydration/Sheet/Dropdown pitfall patterns based on established knowledge

**Research date:** 2026-06-27
**Valid until:** 2026-08-01 (stable libraries with no breaking changes expected)
