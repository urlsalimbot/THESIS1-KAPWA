# Phase 08 — Layout Shell: Codebase Patterns

> **Analyzed:** 2026-06-27
> **Sources:** `src/components/Layout.tsx`, `src/routes.tsx`, `src/main.tsx`, `src/lib/auth-context.tsx`, `src/components/ui/*.tsx` (22 shadcn components), `src/index.css`, `package.json`, `tsconfig.json`

---

## 1. Existing Patterns Found

### 1.1 shadcn / Radix Component Registration

| Property | Pattern |
|----------|---------|
| **Install method** | Manual — components are hand-written under `src/components/ui/` following the shadcn structure (Radix primitives + `cn()` + `React.forwardRef`) |
| **Location** | `src/components/ui/avatar.tsx`, `sheet.tsx`, `breadcrumb.tsx`, `separator.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `popover.tsx`, `button.tsx`, `badge.tsx`, etc. (22 files) |
| **Structure** | Each file wraps a `@radix-ui/*` primitive with `React.forwardRef`, calls `cn()` for class merging, sets `displayName`, and exports named exports |
| **Pattern example** (`avatar.tsx`): | `React.forwardRef<ElementRef<typeof Primitive.Root>, ComponentPropsWithoutRef<typeof Primitive.Root>>` + `cn()` + `displayName` + named exports |
| **Headless "use client"** | `separator.tsx`, `dropdown-menu.tsx` have `"use client"` directive; others don't. Likely copy-paste variance from shadcn generation — not a meaningful pattern |
| **Relevance to Phase 08** | **Use as-is.** Phase 08 will consume these components via imports like `import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'`. Follow the same forwardRef + cn + displayName pattern if adding new components (though none planned). |

### 1.2 Auth Context Usage

| Property | Pattern |
|----------|---------|
| **Location** | `src/lib/auth-context.tsx:1-108` |
| **Provider** | `AuthProvider` — wraps children with `AuthContext.Provider`. Placed in `routes.tsx` around `RouterProvider` |
| **Hook** | `useAuth()` — returns `{ user, token, login, logout, loading, mfaChallenge, resolveMfa, cancelMfa }` |
| **Legacy function** | `getCurrentUser(signal?)` — standalone async function that reads `localStorage` directly. Used by `Layout.tsx` and `ProtectedRoute.tsx` (which predate `useAuth()` properly flowing through context) |
| **Current Layout usage** | `Layout.tsx` does **not** use `useAuth()` context — it calls `getCurrentUser()` manually in a `useEffect`, then stores user in local state. This is a legacy pattern. |
| **Token storage** | `localStorage.getItem('kapwa_token')` / `setItem('kapwa_token')` |
| **Relevance to Phase 08** | **Adapt.** Phase 08 Layout should switch to `useAuth()` from context instead of the manual `getCurrentUser()` pattern. This eliminates the duplicate fetch in `Layout.tsx:50-51`. |

### 1.3 Provider Wrappers

| Property | Pattern |
|----------|---------|
| **Current** | `routes.tsx:64-71`: `AuthProvider` → `ErrorBoundary` → `RouterProvider` |
| **main.tsx** | `React.StrictMode` → `MainRoutes` (no ThemeProvider) |
| **next-themes** | `next-themes` v0.4.6 is installed in `package.json:37` but **never used** — no `ThemeProvider` in the tree. `.dark` CSS class block exists in `index.css:163-183`. |
| **Relevance to Phase 08** | **Adapt.** Add `ThemeProvider` (from next-themes, `attribute="class"`) as an outer wrapper. Per UI-SPEC, wrap `AuthProvider` with it in `routes.tsx`. This is the standard next-themes integration pattern. |

### 1.4 Private Route Wrapper Pattern

| Property | Pattern |
|----------|---------|
| **Location** | `src/routes.tsx:32-34` |
| **Pattern** | Inline `Private()` function: `ProtectedRoute` → `Layout` → `children` |
| **Definition** | `function Private({ children, roles }) { return <ProtectedRoute roles={roles}><Layout>{children}</Layout></ProtectedRoute> }` |
| **Usage** | Every authenticated route wraps its page: `<Private roles={[...]}><PageName /></Private>` |
| **Relevance to Phase 08** | **Preserve as-is.** The `Private()` wrapper stays — Phase 08 replaces `Layout.tsx` internals but the wrapper structure remains identical. |

### 1.5 Component Export Conventions

| Property | Pattern |
|----------|---------|
| **Named exports** | All custom app components (`Layout`, `ProtectedRoute`, page components) use **named exports**: `export function Layout()` |
| **Default exports** | Only `NotificationsDropdown` and `MessagesPopover` use `export default function` |
| **shadcn ui** | All named exports: `export { Avatar, AvatarImage, AvatarFallback }` |
| **Relevance to Phase 08** | **Use named exports** for `Sidebar`, `Topbar`, `Layout`, consistent with the app's convention. |

### 1.6 Props Interface Patterns

| Property | Pattern |
|----------|---------|
| **Inline interfaces** | `ProtectedRoute` uses inline `interface ProtectedRouteProps` above function |
| **No `interface` exporting** | None of the custom components export their props interface |
| **`React.forwardRef`** | shadcn components consistently use `React.forwardRef<ElementRef<...>, ComponentPropsWithoutRef<...>>` — but no custom app components use `forwardRef` |
| **`children` typing** | `{ children: React.ReactNode }` consistently (see `ProtectedRoute`, `Layout`, `ErrorBoundary`) |
| **Relevance to Phase 08** | **Use inline interfaces** for Sidebar/Topbar props. No forwardRef needed (they render DOM children, not controlled inputs). |

### 1.7 CSS / Styling Patterns

| Property | Pattern |
|----------|---------|
| **CSS framework** | Tailwind CSS v3.4, configured via `tailwindcss-animate` plugin |
| **Class merging** | `cn()` utility from `@/lib/utils` — wraps `clsx` + `tailwind-merge` |
| **Legacy classes** | `index.css` has a `@layer legacy` block (lines 9-107) with pre-Tailwind classnames like `.page-header`, `.badge`, `.table`, `.spinner` — these are kept for backward compat and will be migrated in Phase 11 |
| **CSS variables** | Full set defined in `index.css:110-183` under `:root` and `.dark`, used by shadcn components via Tailwind's `theme()` |
| **Dark mode** | Uses `class` strategy — `.dark` class on `<html>`, enabled via `darkMode: "class"` in tailwind config (inferred, not confirmed via file read) |
| **Tailwind arbitrary values** | Used sparingly, e.g., `w-9` (36px), `h-16` (64px), `gap-0.5` (2px) |
| **Relevance to Phase 08** | **Use `cn()` always** for class composition. Use existing CSS variables (not hardcoded colors). No new legacy classes. Phase 08 styling is entirely Tailwind utility classes. |

### 1.8 Import Conventions

| Property | Pattern |
|----------|---------|
| **Path alias** | `@/*` maps to `./src/*` (configured in `tsconfig.json:19` and resolved via `vite-tsconfig-paths`) |
| **Alias usage** | Components always use `@/components/ui/button`; `Layout.tsx` uses `@/lib/auth-context`, `@/lib/utils` |
| **Relative imports** | Used occasionally: `ProtectedRoute` imports `'../lib/auth-context'` |
| **Vite env** | `import.meta.env.VITE_API_URL` pattern |
| **Import order** | React/libraries → local components → local utils (rough convention) |
| **Relevance to Phase 08** | **Use `@/` alias** for all imports (consistent with most files). New files: `@/components/Sidebar`, `@/components/Topbar`, `@/lib/nav-config`, `@/lib/breadcrumbs`. |

### 1.9 File Organization

| Property | Pattern |
|----------|---------|
| **Components** | `src/components/` — all React components (7 files) |
| **UI primitives** | `src/components/ui/` — shadcn wrappers (22 files) |
| **Pages** | `src/pages/` — page-level components (25+ files) |
| **Lib** | `src/lib/` — utilities, auth, API, storage (11 files) |
| **Routing** | `src/routes.tsx` — all route definitions in ONE file |
| **Entry** | `src/main.tsx` — minimal bootstrap |
| **Relevance to Phase 08** | Follow same layout. New files: `Sidebar.tsx`, `Topbar.tsx` go in `src/components/`, `nav-config.ts`, `breadcrumbs.ts` go in `src/lib/`. |

### 1.10 NAV_ITEMS Data Pattern

| Property | Pattern |
|----------|---------|
| **Location** | `Layout.tsx:21-35` |
| **Structure** | Flat `NavItem[]` array: `{ path: string, label: string, icon: React.ReactNode, roles: string[] }` |
| **Icon rendering** | JSX elements inline in the array definition: `icon: <FilePlus size={20} />` |
| **Role filtering** | `NAV_ITEMS.filter(item => item.roles.includes(user?.role))` |
| **Size convention** | All icons use `size={20}` |
| **Relevance to Phase 08** | **Extract to `@/lib/nav-config.ts`** as spec'd. Refactor into `NavGroup[]` structure (Core, Operations, Admin, Reports & Tracker, Claimant). Icon rendering stays as JSX literals. |

### 1.11 Hook Conventions

| Property | Pattern |
|----------|---------|
| **State** | `useState<T>` with explicit typing |
| **Effects** | `useEffect` with cleanup functions for event listeners, intervals |
| **Custom hooks** | None in app code (only `useAuth()` from context). Data fetching is inline with `useEffect` + `async` |
| **Data fetching** | Direct `fetch()` calls, no SWR/React Query (SWR is in `package.json` but unused in Layout) |
| **Relevance to Phase 08** | Layout shell effects (offline listener, storage listener, theme mount guard) follow existing patterns: `useEffect` + cleanup. |

### 1.12 Offline Banner Pattern

| Property | Pattern |
|----------|---------|
| **Location** | `Layout.tsx:79-83` |
| **Implementation** | Fixed banner at top of page (`fixed top-0 left-0 right-0 z-50`), `bg-amber-500` |
| **State tracking** | `navigator.onLine` with `online`/`offline` window event listeners |
| **Queue integration** | Reads from `loadQueue()` for pending sync count, listens for `storage` events |
| **Relevance to Phase 08** | **Preserve as-is** (D-19). Keep the offline banner logic in the new `Layout.tsx`. |

---

## 2. Closest Analogs for Phase 08 Components

| New File | Closest Analog | Location | Why |
|----------|----------------|----------|-----|
| **Sidebar.tsx** | Current sidebar section in `Layout.tsx:146-173` | `Layout.tsx:146-173` | Same nav rendering, active state, role filtering. Extract `NAV_ITEMS` iteration + `visibleNav` filter + active state logic. Desktop uses `aside` with positioning; mobile uses Sheet. |
| **Topbar.tsx** | Current header section in `Layout.tsx:86-137` | `Layout.tsx:86-137` | Same logo, role badge, search, NotificationsDropdown, MessagesPopover, avatar. Extract to standalone component. Add DropdownMenu on avatar (new in Phase 08). |
| **ThemeProvider** | AuthProvider pattern | `routes.tsx:66` | Same wrapping pattern: `<ThemeProvider>` wraps `<AuthProvider>`. next-themes API: `import { ThemeProvider } from 'next-themes'`, usage: `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` |
| **Breadcrumb implementation** | shadcn `breadcrumb.tsx` | `src/components/ui/breadcrumb.tsx:1-115` | Full ShellWithBreadcrumbs component set already installed. Import: `import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis } from '@/components/ui/breadcrumb'` |
| **User DropdownMenu** | Existing shadcn `dropdown-menu.tsx` | `src/components/ui/dropdown-menu.tsx:1-200` | Full Radix DropdownMenu installed. Also see NotificationsDropdown's Popover pattern for button-triggered overlay reference. |
| **Sheet (mobile nav)** | shadcn `sheet.tsx` | `src/components/ui/sheet.tsx:1-138` | Already installed. Use `<Sheet>`, `<SheetTrigger>`, `<SheetContent side="left">`. Share nav content via a render-props or component fragment pattern. |
| **nav-config.ts** | `NAV_ITEMS` const in `Layout.tsx:21-35` | `Layout.tsx:21-35` | Same data shape, restructured into groups: `NavGroup { label: string, items: NavItem[] }`. |
| **breadcrumbs.ts** | Route path patterns in `routes.tsx` + `location.pathname` in `Layout.tsx:154` | `routes.tsx:36-62`, `Layout.tsx:154` | Derive labels from path segments. Map of path-prefix → label. |

---

## 3. Architecture Surface

### 3.1 Import Paths

```typescript
// ✅ Prevalent — use these patterns
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth-context'
import { Outlet, useLocation, Link } from 'react-router-dom'

// ⚠️ Rare usage — avoid
import { getCurrentUser } from '../lib/auth-context'  // relative — use @/ instead
```

### 3.2 Component Patterns Index

| shadcn Component | Installed? | Import Path | Primitive | Used By |
|-----------------|------------|-------------|-----------|---------|
| Sheet | ✅ | `@/components/ui/sheet` | `@radix-ui/react-dialog` | Phase 08 (mobile sidebar) |
| DropdownMenu | ✅ | `@/components/ui/dropdown-menu` | `@radix-ui/react-dropdown-menu` | Phase 08 (user menu) |
| Breadcrumb | ✅ | `@/components/ui/breadcrumb` | Native `nav`/`ol`/`li` + `@radix-ui/react-slot` | Phase 08 (breadcrumb trail) |
| Avatar | ✅ | `@/components/ui/avatar` | `@radix-ui/react-avatar` | Phase 08 (topbar avatar) |
| Button | ✅ | `@/components/ui/button` | `@radix-ui/react-slot` | Phase 08 (topbar buttons) |
| Separator | ✅ | `@/components/ui/separator` | `@radix-ui/react-separator` | Phase 08 (dividers) |
| Badge | ✅ | `@/components/ui/badge` | Native `div` | Phase 08 (role badge) |
| Popover | ✅ | `@/components/ui/popover` | `@radix-ui/react-popover` | NotificationsDropdown, MessagesPopover |
| Tooltip | ✅ | `@/components/ui/tooltip` | `@radix-ui/react-tooltip` | Optional enhancement |
| ScrollArea | ❌ | Install via `npx shadcn@latest add scroll-area` | `@radix-ui/react-scroll-area` | Phase 08 (sidebar scrollable area) |

### 3.3 Key Dependencies (for Phase 08)

```json
{
  "next-themes": "^0.4.6",        // ThemeProvider — installed, unused
  "lucide-react": "^1.14.0",      // Icons — active usage
  "react-router-dom": "^6.21.1",  // Routing — active usage
  "class-variance-authority": "^0.7.1",  // CVA — used by shadcn
  "tailwind-merge": "^3.6.0",     // twMerge — used by cn()
  "clsx": "^2.1.1",               // Used by cn()
  "tailwindcss-animate": "^1.0.7" // Animation utilities
}
```

### 3.4 Existing Radix Packages (for Phase 08 Components)

All required Radix packages are already in `package.json`:
- `@radix-ui/react-avatar` — `Avatar`
- `@radix-ui/react-dialog` — `Sheet` uses this under the hood
- `@radix-ui/react-dropdown-menu` — `DropdownMenu`
- `@radix-ui/react-separator` — `Separator`
- `@radix-ui/react-popover` — `Popover` (used by NotificationsDropdown)
- `@radix-ui/react-scroll-area` — Need to add via `npx shadcn@latest add scroll-area` OR install package manually then add component
- `@radix-ui/react-slot` — AsChild pattern (used by BreadcrumbLink, Button)
- `@radix-ui/react-tooltip` — Available for optional topbar tooltips

### 3.5 Breadcrumb Component Anatomy

```
<Breadcrumb>                           → <nav aria-label="breadcrumb">
  <BreadcrumbList>                     → <ol> (flex, gap-1.5)
    <BreadcrumbItem>                   → <li>
      <BreadcrumbLink asChild>         → <a> or <Link> via Slot
        <Link to="/">Dashboard</Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />            → <li role="presentation"><ChevronRight /></li>
    <BreadcrumbItem>
      <BreadcrumbPage>Current</BreadcrumbPage>  → <span aria-current="page">
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

## 4. Naming Conventions

| Category | Convention | Example | Count |
|----------|-----------|---------|-------|
| **Component files** | PascalCase.tsx | `Layout.tsx`, `ProtectedRoute.tsx`, `NotificationsDropdown.tsx` | 7/7 components |
| **Page files** | PascalCasePage.tsx | `DashboardPage.tsx`, `IntakePage.tsx`, `CsrPage.tsx` | 20+ pages |
| **UI primitive files** | kebab-case.tsx | `dropdown-menu.tsx`, `navigation-menu.tsx`, `alert-dialog.tsx` | 22/22 shadcn files |
| **Lib files** | kebab-case.ts(x) | `auth-context.tsx`, `offline-queue.ts`, `utils.ts` | 10/11 lib files |
| **Interfaces** | PascalCase | `NavItem`, `ProtectedRouteProps`, `AuthContextType` | Consistent |
| **Component exports** | Named (preferred) | `export function Layout()` | 6/7 components |
| **Component exports** | Default (rare) | `export default function NotificationsDropdown()` | 2/7 components |
| **shadcn exports** | Named always | `export { Avatar, AvatarImage, AvatarFallback }` | 22/22 |
| **CSS variables** | --kebab-case | `--font-heading`, `--spacing-12`, `--color-accent` | Consistent |
| **Tailwind arbitrary** | Brackets | `w-9`, `h-16`, `gap-0.5`, `size={20}` on icons | Consistent |

### 4.1 Phase 08 File Naming

| File | Convention | Name |
|------|-----------|------|
| Layout component | PascalCase | `src/components/Layout.tsx` |
| Sidebar component | PascalCase | `src/components/Sidebar.tsx` |
| Topbar component | PascalCase | `src/components/Topbar.tsx` |
| Nav config utility | kebab-case | `src/lib/nav-config.ts` |
| Breadcrumb utility | kebab-case | `src/lib/breadcrumbs.ts` |

---

## 5. Key Code Snippets (Pattern Templates)

### 5.1 Standard Component Shell

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
  children?: React.ReactNode;
}

export function Sidebar({ className, children }: SidebarProps) {
  return (
    <aside className={cn('w-64 ...', className)}>
      {children}
    </aside>
  );
}
```

### 5.2 DropdownMenu on Avatar (New Pattern for Phase 08)

The current Layout.tsx has a static `<Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar>` (line 131). Phase 08 replaces this with a DropdownMenu trigger. Pattern to follow (built on `@radix-ui/react-dropdown-menu`):

```tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Avatar className="cursor-pointer">
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" sideOffset={8}>
    <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 5.3 ThemeProvider Wrapper (New Pattern for Phase 08)

```tsx
import { ThemeProvider } from 'next-themes';

// In routes.tsx, wrap existing AuthProvider:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <AuthProvider>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </AuthProvider>
</ThemeProvider>
```

---

## 6. Migration Notes

| Old Pattern (Layout.tsx) | New Pattern (Phase 08) | Impact |
|--------------------------|----------------------|--------|
| `getCurrentUser()` in useEffect + local state | `useAuth()` from context | Eliminates duplicate fetch. ProtectedRoute + both would fetch; now single source. |
| Flat `NAV_ITEMS` array | Grouped `NavGroup[]` with category headers | Visual change only — links stay the same. Ensure role filtering per group. |
| Mobile sidebar via translate-x + backdrop | `<Sheet side="left">` | React replaces CSS animation management. Shared nav content via component. |
| Static avatar | DropdownMenu trigger | New interactive element. DropdownMenu already installed. |
| No theme toggle | next-themes ThemeProvider + Sun/Moon toggle | New dependency (already installed). Wrapper goes in routes.tsx. |
| No breadcrumbs | shadcn Breadcrumb + route resolver | New component in main content area. Breadcrumb component already installed. |

---

## 7. Risk Areas

1. **useAuth() gap**: Current `ProtectedRoute.tsx` and `Layout.tsx` both call `getCurrentUser()` independently — they do NOT use `useAuth()` context. After Phase 08, `Layout.tsx` should use `useAuth()`, but `ProtectedRoute.tsx` still calls `getCurrentUser()`. This means two auth fetches on every page load. Consider updating `ProtectedRoute` to use `useAuth()` as well, or accept the double-fetch as a pre-existing pattern to fix in a later phase.

2. **ThemeProvider mounting**: `next-themes` can cause a flash of unstyled content (FOUC) during SSR/hydration because `ThemeProvider` needs to read `localStorage` + `prefers-color-scheme`. The `attribute="class"` + `defaultTheme="system"` setup mitigates this. The dark mode toggle must be mount-guarded (`useState(false)` + `useEffect(() => setMounted(true), [])`) to avoid hydration mismatch.

3. **Sheet component for mobile**: The current `translate-x` approach works. Switching to shadcn `Sheet` means the hamburger button triggers Radix Dialog state, not local React state. The Sheet's overlay is always `bg-black/80` — matches current `bg-black/30` in Layout.tsx. Verify this difference is acceptable (UI-SPEC says `bg-black/80` is fine).

4. **Navigation group visibility**: When a user role has 0 items in a group, that group must be hidden entirely (including the group header). The filter logic must check `group.items.filter(item => item.roles.includes(user.role)).length > 0` before rendering the group.
