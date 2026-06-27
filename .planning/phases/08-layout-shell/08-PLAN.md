---
phase: 08-layout-shell
plan: 01
type: execute
wave: 1
depends_on:
  - 07-foundation-design-system
files_created:
  - kapwa-client/src/lib/nav-config.ts
  - kapwa-client/src/lib/breadcrumbs.ts
  - kapwa-client/src/components/Sidebar.tsx
  - kapwa-client/src/components/Topbar.tsx
  - kapwa-client/src/components/ui/scroll-area.tsx
files_modified:
  - kapwa-client/src/components/Layout.tsx
  - kapwa-client/src/routes.tsx
files_preserved:
  - kapwa-client/src/components/NotificationsDropdown.tsx
  - kapwa-client/src/components/MessagesPopover.tsx
  - kapwa-client/src/components/ProtectedRoute.tsx
  - kapwa-client/src/components/ui/* (23 components, plus new scroll-area)
autonomous: false
requirements:
  - LAY-01
  - LAY-02
  - LAY-03
  - LAY-04
  - DSG-05
user_setup: []
---

<objective>
**Replace the monolithic Layout.tsx with a modular Sidebar + Topbar + Layout trio. Wire dark mode via next-themes (DSG-05). Add breadcrumbs derived from route segments (LAY-03). Add skip-to-content for keyboard accessibility (LAY-04).**

**Purpose:** Every authenticated page renders inside this shell. By splitting Layout.tsx, the sidebar navigation, topbar user menu, and layout shell become independently testable, maintainable, and reusable. Dark mode becomes functional (CSS + next-themes already installed, unconnected). Breadcrumbs provide navigation context. Skip-to-content meets WCAG 2.1 AA requirement 2.4.1.

**Output:** Modular app shell with role-filtered nav groups, user dropdown menu, working dark mode toggle, breadcrumb trail, and skip-to-content link.
</objective>

---

## Context Dependencies

This plan depends on the following context documents. Read them first before executing any task.

| Document | Location | Purpose |
|----------|----------|---------|
| 08-CONTEXT.md | `.planning/phases/08-layout-shell/08-CONTEXT.md` | Locked decisions D-01 through D-22 |
| 08-UI-SPEC.md | `.planning/phases/08-layout-shell/08-UI-SPEC.md` | Visual contract: spacing, color, typography, interaction states |
| 08-RESEARCH.md | `.planning/phases/08-layout-shell/08-RESEARCH.md` | Architecture patterns, pitfalls, code templates |
| 08-PATTERNS.md | `.planning/phases/08-layout-shell/08-PATTERNS.md` | Codebase conventions, import paths, component patterns |

---

## Tasks

### Task 1: Install ScrollArea shadcn Component

**Type:** `checkpoint:human-verify` (gate: blocking — build must pass after)

**Rationale:** The existing `@radix-ui/react-scroll-area` package is already in package.json. The shadcn wrapper component file `scroll-area.tsx` needs to be created. The shadcn CLI may have peer dep conflicts with Vite 8 — use the @beta channel or `--legacy-peer-deps` if needed.

**Action:**

1. From `kapwa-client/`, run:
   ```
   npx shadcn@latest add scroll-area
   ```
2. If peer dependency errors occur with Vite 8, try:
   ```
   npx shadcn@latest@beta add scroll-area
   ```
3. If both CLI approaches fail, manually create `kapwa-client/src/components/ui/scroll-area.tsx` using the standard shadcn ScrollArea pattern:
   - Import from `@radix-ui/react-scroll-area`
   - Follow the exact same pattern as existing ui components: `React.forwardRef`, `cn()`, `displayName`, named exports
   - Export: `ScrollArea`, `ScrollBar`

**Acceptance Criteria:**
- `kapwa-client/src/components/ui/scroll-area.tsx` exists
- File exports `ScrollArea` and `ScrollBar` as named exports
- `npm run build` passes in `kapwa-client/`

**Verify:**
```bash
ls kapwa-client/src/components/ui/scroll-area.tsx
cd kapwa-client && npm run build
```

**Done:** `ScrollArea` component installed — build passes.

---

### Task 2: Create Nav Config (`src/lib/nav-config.ts`)

**Type:** `auto`

**Rationale:** The existing `NAV_ITEMS` array (Layout.tsx:21-35) is extracted into a shared config file. Reorganized from flat array into `NavGroup[]` with categorized groups per D-03. This new structure is consumed by both the desktop sidebar and the mobile Sheet.

**Read first:**
- `kapwa-client/src/components/Layout.tsx:21-35` — existing NAV_ITEMS array
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-03 group definitions
- `.planning/phases/08-layout-shell/08-RESEARCH.md` — Pattern 1 code template

**Action:**

1. Create `kapwa-client/src/lib/nav-config.ts`

2. Define interfaces:
   ```typescript
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
   ```

3. Create `NAV_GROUPS` constant with these groups and items (preserving exact existing paths, labels, icons, and roles from Layout.tsx):

   **Core:**
   - `/intake` → `GIS Intake` — `FilePlus` — `['admin', 'social_worker', 'coordinator']`
   - `/` → `Dashboard` — `LayoutDashboard` — `['admin', 'social_worker', 'coordinator', 'mayor', 'auditor']`
   - `/cases` → `Case Tracker` — `ClipboardList` — `['admin', 'social_worker', 'coordinator']`
   - `/beneficiaries` → `Beneficiaries` — `Users` — `['admin', 'social_worker']`

   **Operations:**
   - `/coordinator` → `Coordinator` — `LayoutDashboard` — `['coordinator']`
   - `/tracker` → `Daily Tracker` — `ClipboardList` — `['admin', 'social_worker', 'coordinator', 'mayor', 'auditor']`
   - `/interventions` → `Interventions` — `CheckCircle` — `['admin', 'social_worker']`
   - `/csr` → `CSR Generator` — `FileText` — `['admin', 'social_worker']`
   - `/filing` → `Digital Filing` — `FolderOpen` — `['admin', 'social_worker']`
   - `/approvals` → `Approvals` — `Stamp` — `['admin', 'social_worker']`

   **Admin:**
   - `/admin` → `Admin Panel` — `Shield` — `['admin']`
   - `/settings/mfa` → `MFA Settings` — `Shield` — `['admin', 'mayor', 'auditor']`

   **Reports & Tracker:**
   - `/tracker` → `Daily Tracker` — `ClipboardList` — `['admin', 'social_worker', 'coordinator', 'mayor', 'auditor']`
   *(Note: `/tracker` appears in both Operations and Reports & Tracker. This is intentional per D-03 groups. The Sidebar will render it in both groups — the duplicate is expected and aligns with the UI-SPEC group structure.)*

   **Claimant:**
   - `/my-dashboard` → `My Dashboard` — `UserCircle` — `['claimant']`

   *(Note: `/my-dashboard` appears in NAV_ITEMS with icon `UserCircle`. The `/my-access-card` route exists in routes.tsx but has no NAV_ITEMS entry — it's excluded from the sidebar for now. `/messages`, `/irf`, `/access-cards` also have no sidebar entries and are navigated from elsewhere.)*

   *(D-03 mandates using the existing NAV_ITEMS structure. Routes like `/programs`, `/reports`, `/audit-logs`, `/irf`, `/access-cards`, `/messages`, and `/my-access-card` exist in `routes.tsx` but were never in the original NAV_ITEMS — adding them is excluded scope. They may be added in a future phase.)*

4. Import icons from `lucide-react`:
   ```typescript
   import {
     FilePlus, LayoutDashboard, Users, CheckCircle, FolderOpen, FileText,
     ClipboardList, HelpCircle, Search, Shield, UserCircle, Stamp
   } from 'lucide-react';
   ```

5. Export `NAV_GROUPS` as named export.

**Acceptance Criteria:**
- `kapwa-client/src/lib/nav-config.ts` exists
- Exports `NavItem`, `NavGroup` interfaces and `NAV_GROUPS` constant
- All 13 existing NAV_ITEMS entries are present across the groups
- All labels, paths, icons, and roles match the original NAV_ITEMS exactly
- File compiles: `npm run build` passes

**Verify:**
```bash
cd kapwa-client && npm run build
```

**Done:** `nav-config.ts` created with grouped NAV_GROUPS — build passes.

---

### Task 3: Create Breadcrumb Utility (`src/lib/breadcrumbs.ts`)

**Type:** `auto`

**Rationale:** Breadcrumbs are derived from `pathname` via a resolver function. This utility is used by the BreadcrumbNav component in Topbar.

**Read first:**
- `.planning/phases/08-layout-shell/08-RESEARCH.md` — Pattern 2 code template (lines 297-349)
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-08, D-09, D-10, D-11
- `.planning/phases/08-layout-shell/08-UI-SPEC.md` — Copywriting contract (breadcrumb labels)

**Action:**

1. Create `kapwa-client/src/lib/breadcrumbs.ts`

2. Define interface:
   ```typescript
   export interface BreadcrumbItem {
     label: string;
     href: string;
   }
   ```

3. Create `BREADCRUMB_LABELS` Record mapping route prefixes to labels:
   ```typescript
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
     '/coordinator': 'Coordinator',
     '/settings': 'Settings',
   };
   ```

4. Implement `createBreadcrumbs(pathname: string): BreadcrumbItem[]`:
   - Always start with `{ label: 'Dashboard', href: '/' }`
   - Split pathname by `/`, filter empty segments
   - For each segment, accumulate the path prefix, look up in `BREADCRUMB_LABELS`
   - Fallback for unknown segments: convert kebab-case to Title Case
   - Return array of BreadcrumbItem

   ```typescript
   export function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
     const segments = pathname.split('/').filter(Boolean);
     const crumbs: BreadcrumbItem[] = [];
     
     crumbs.push({ label: 'Dashboard', href: '/' });
     
     let accumulated = '';
     for (const segment of segments) {
       accumulated += '/' + segment;
       const label = BREADCRUMB_LABELS[accumulated]
         || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
       crumbs.push({ label, href: accumulated });
     }
     
     return crumbs;
   }
   ```

5. Export `BREADCRUMB_LABELS` and `createBreadcrumbs`.

**Acceptance Criteria:**
- File exists with `BreadcrumbItem` interface, `BREADCRUMB_LABELS` map, and `createBreadcrumbs()` function
- `createBreadcrumbs('/beneficiaries')` returns `[{label:'Dashboard', href:'/'}, {label:'Beneficiaries', href:'/beneficiaries'}]`
- `createBreadcrumbs('/settings/mfa')` returns `[{label:'Dashboard', href:'/'}, {label:'MFA Settings', href:'/settings/mfa'}]`
- `createBreadcrumbs('/irf/abc-123')` returns generic fallback for unknown segment `View ...`
- File compiles: `npm run build` passes

**Verify:**
Manually inspect file and run build. Add test later per RESEARCH.md wave 0 gaps.

```bash
cd kapwa-client && npm run build
```

**Done:** `breadcrumbs.ts` created with resolver — build passes.

---

### Task 4: Create Sidebar Component (`src/components/Sidebar.tsx`)

**Type:** `auto`

**Rationale:** The sidebar navigation is extracted from the monolithic Layout.tsx into its own component. It renders role-filtered nav groups with active route highlighting. Desktop: sticky 256px with ScrollArea. Mobile: renders nav content for Sheet (Sheet wrapping happens in Layout.tsx).

**Read first:**
- `kapwa-client/src/components/Layout.tsx:144-173` — existing sidebar rendering
- `.planning/phases/08-layout-shell/08-RESEARCH.md` — Pattern 1 code template (lines 237-295), Pattern 4 with Sheet integration (lines 607-659)
- `.planning/phases/08-layout-shell/08-UI-SPEC.md` — Visual hierarchy, interaction states
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-01, D-02, D-03, D-04, D-18

**Action:**

1. Create `kapwa-client/src/components/Sidebar.tsx`

2. Import dependencies:
   ```typescript
   import { Link, useLocation } from 'react-router-dom';
   import { useAuth } from '@/lib/auth-context';
   import { NAV_GROUPS, NavGroup, NavItem } from '@/lib/nav-config';
   import { ScrollArea } from '@/components/ui/scroll-area';
   import { cn } from '@/lib/utils';
   ```

3. Create `SidebarNavContent` — a shared component that renders the navigation groups. Used by both the desktop `<aside>` and mobile `<Sheet>`:
   ```typescript
   interface SidebarNavContentProps {
     onNavClick?: () => void;
   }
   
   export function SidebarNavContent({ onNavClick }: SidebarNavContentProps) {
     const { user } = useAuth();
     const location = useLocation();
     
     return (
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
                   const isActive = item.path === '/'
                     ? location.pathname === '/'
                     : location.pathname.startsWith(item.path);
                   return (
                     <Link
                       key={item.path}
                       to={item.path}
                       onClick={onNavClick}
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
     );
   }
   ```

4. Create `Sidebar` — desktop sidebar component:
   ```typescript
   interface SidebarProps {
     className?: string;
   }
   
   export function Sidebar({ className }: SidebarProps) {
     return (
       <aside className={cn(
         'w-64 bg-card border-r border-border shrink-0',
         'sticky top-16 h-[calc(100vh-4rem)]',
         'hidden lg:block',
         className
       )}>
         <ScrollArea className="h-full">
           <SidebarNavContent />
         </ScrollArea>
       </aside>
     );
   }
   ```

5. Export both `Sidebar` and `SidebarNavContent` as named exports.

**Acceptance Criteria:**
- `kapwa-client/src/components/Sidebar.tsx` exists
- Exports `Sidebar`, `SidebarNavContent`, and `SidebarNavContentProps`
- Desktop sidebar: `w-64`, `sticky top-16`, `h-[calc(100vh-4rem)]`, `hidden lg:block`
- Nav groups hide entirely when user role has 0 visible items
- Active route uses prefix matching: `location.pathname.startsWith(item.path)` (except for `/`)
- Icons render at `size={20}` (from existing NAV_ITEMS)
- File compiles: `npm run build` passes

**Verify:**
```bash
cd kapwa-client && npm run build
```

**Done:** `Sidebar.tsx` created with `SidebarNavContent` — build passes.

---

### Task 5: Create Topbar Component (`src/components/Topbar.tsx`)

**Type:** `auto`

**Rationale:** The topbar is extracted from the monolithic Layout.tsx. It now includes breadcrumbs (LAY-03), a user dropdown menu with dark mode toggle (DSG-05), and a hamburger button for mobile Sheet.

**Read first:**
- `kapwa-client/src/components/Layout.tsx:86-137` — existing topbar rendering
- `kapwa-client/src/components/NotificationsDropdown.tsx` — preserve as-is
- `kapwa-client/src/components/MessagesPopover.tsx` — preserve as-is
- `.planning/phases/08-layout-shell/08-RESEARCH.md` — Pattern 3 (dark mode toggle), Pattern 4 (user menu DropdownMenu)
- `.planning/phases/08-layout-shell/08-UI-SPEC.md` — Topbar interaction states, User DropdownMenu spec
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-10, D-12, D-13, D-20

**Action:**

1. Create `kapwa-client/src/components/Topbar.tsx`

2. Import dependencies:
   ```typescript
   import { useState, useEffect } from 'react';
   import { Link, useNavigate, useLocation } from 'react-router-dom';
   import { useTheme } from 'next-themes';
   import { useAuth } from '@/lib/auth-context';
   import {
     Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
     BreadcrumbPage, BreadcrumbSeparator
   } from '@/components/ui/breadcrumb';
   import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
     DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
   import { Avatar, AvatarFallback } from '@/components/ui/avatar';
   import { Button } from '@/components/ui/button';
   import { Badge } from '@/components/ui/badge';
   import { Separator } from '@/components/ui/separator';
   import { Input } from '@/components/ui/input';
   import { Sun, Moon, Menu, HelpCircle, Search, LogOut, Settings, User } from 'lucide-react';
   import NotificationsDropdown from './NotificationsDropdown';
   import MessagesPopover from './MessagesPopover';
   import { cn } from '@/lib/utils';
   ```

3. Define interface:
   ```typescript
   interface TopbarProps {
     onMenuToggle?: () => void;
   }
   ```

4. Implement `Topbar` component:

   a. **BreadcrumbNav** (internal component — can be defined inside Topbar or as separate function):
   ```typescript
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

   b. **Theme toggle with mount guard** (to prevent hydration mismatch):
   ```typescript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   ```

   c. **User initials** from `useAuth()`:
   ```typescript
   const { user, logout } = useAuth();
   const navigate = useNavigate();
   const initials = user
     ? user.fullName.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
     : 'U';
   ```

   d. **Logout handler**:
   ```typescript
   function handleLogout() {
     logout();
     navigate('/login');
   }
   ```

   e. **Render structure** (copy the existing topbar HTML structure from Layout.tsx:86-137, then enhance):
   - Left section: hamburger button (lg:hidden), logo link, role badge
   - Middle/right: search (hidden md:block), NotificationsDropdown, MessagesPopover, help button, separator, user DropdownMenu
   - Breadcrumbs inside main content area (not in topbar) — breadcrumbs render in Layout.tsx above the main content

   Wait — looking at the UI-SPEC layout diagram, breadcrumbs are in the main content area, not in the topbar. Let me reconsider.

   The UI-SPEC says:
   ```
   │  ┌──────────────┬────────────────────────────────────────┐   │
   │  │  Sidebar     │  Main Content (<main id="main-content">)│   │
   │  │               │  ┌─ Breadcrumb trail ─────────────────┐ │   │
   │  │               │  │  Dashboard > Beneficiaries > View  │ │   │
   │  │               │  └────────────────────────────────────┘ │   │
   ```

   So breadcrumbs render inside the main content area, between the topbar and the page content. This means breadcrumbs should be in Layout.tsx (which renders the main content structure), not in Topbar. Let me adjust: Topbar handles the header bar only. Breadcrumbs go in Layout.tsx above `<main>`.

   Actually, since the original Layout had everything in one file, and we're splitting it, let me think about where breadcrumbs belong:

   Option 1: Breadcrumbs in Layout.tsx (renders above main content)
   Option 2: Breadcrumbs in Topbar.tsx (renders inside topbar)
   Option 3: Breadcrumbs in its own BreadcrumbNav component, rendered in Layout

   The UI-SPEC diagram shows breadcrumbs between topbar and main content, separate from the topbar bar. So breadcrumbs should be rendered in Layout.tsx, between `<Topbar>` and `<main>`. This keeps Topbar focused on the header bar itself.

   Let me update the plan accordingly. I'll put breadcrumbs in Layout.tsx, not Topbar.

   Actually, that means I should create a separate breadcrumb component OR just inline it in Layout. Let me keep breadcrumb rendering in Layout.tsx to keep it simple.

   Alternatively, I could put breadcrumbs inside the Topbar component since they appear right below it visually. But the UI layout shows them as part of the main content area. I think putting them in Layout.tsx is the right call.

   Let me update:

   f. User DropdownMenu:
   ```tsx
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Avatar className="cursor-pointer">
         <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
           {initials}
         </AvatarFallback>
       </Avatar>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end" sideOffset={8} className="w-56">
       <DropdownMenuLabel className="font-normal">
         <div className="flex flex-col gap-1">
           <p className="text-sm font-semibold leading-none">{user?.fullName}</p>
           <p className="text-xs text-muted-foreground">
             {user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
           </p>
         </div>
       </DropdownMenuLabel>
       <DropdownMenuSeparator />
       {mounted && (
         <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
           {resolvedTheme === 'dark' ? <Sun size={16} className="mr-2" /> : <Moon size={16} className="mr-2" />}
           {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
         </DropdownMenuItem>
       )}
       <DropdownMenuItem asChild>
         <Link to="/settings" className="flex items-center gap-2">
           <Settings size={16} />
           Settings
         </Link>
       </DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
         <LogOut size={16} className="mr-2" />
         Logout
       </DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
   ```

   Wait, since Topbar doesn't have breadcrumbs, I need to handle:
   - The hamburger button for mobile Sheet
   - Logo + role badge
   - Search (visual-only, deferred)
   - NotificationsDropdown
   - MessagesPopover
   - Help button
   - User DropdownMenu (with dark mode toggle, settings, logout)

   Let me finalize the Topbar component structure. I'll have:
   - `TopbarProps` with `onMenuToggle` callback
   - Topbar renders the header bar
   - Breadcrumbs stay in Layout.tsx

5. Export `Topbar` as named export.

**Acceptance Criteria:**
- `kapwa-client/src/components/Topbar.tsx` exists
- Exports `Topbar` as named export
- Accepts `onMenuToggle` prop for hamburger button
- Desktop sidebar trigger hidden on lg+ via `lg:hidden`
- User DropdownMenu shows: profile card, dark mode toggle, settings link, logout
- Dark mode toggle uses mount guard (prevents hydration mismatch)
- Logout calls `useAuth().logout()` then `navigate('/login')`
- NotificationsDropdown and MessagesPopover imported and rendered unchanged
- Settings link uses `<Link to="/settings">` (Phase 12)
- File compiles: `npm run build` passes

**Verify:**
```bash
cd kapwa-client && npm run build
```

**Done:** `Topbar.tsx` created — build passes.

---

### Task 6: Refactor Layout.tsx as Composition Shell

**Type:** `auto`

**Rationale:** The monolithic Layout.tsx is replaced with a clean composition that imports Sidebar, Topbar, and renders breadcrumbs, skip-to-content, offline banner, and the main content area.

**Read first:**
- `kapwa-client/src/components/Layout.tsx` — read current file (182 lines)
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-14, D-15, D-16, D-19, D-21
- `.planning/phases/08-layout-shell/08-UI-SPEC.md` — Layout structure diagram, skip-to-content spec
- `.planning/phases/08-layout-shell/08-PATTERNS.md` — Migration notes section 6, Risk areas 1-3

**Action:**

1. Rewrite `kapwa-client/src/components/Layout.tsx` entirely.

2. Imports:
   ```typescript
   import { useState, useEffect } from 'react';
   import { Outlet, useLocation, Link } from 'react-router-dom';
   import { useAuth } from '@/lib/auth-context';
   import { loadQueue } from '@/lib/offline-queue';
   import { createBreadcrumbs } from '@/lib/breadcrumbs';
   import { Sidebar } from './Sidebar';
   import { Topbar } from './Topbar';
   import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
   import { SidebarNavContent } from './Sidebar';
   import {
     Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
     BreadcrumbPage, BreadcrumbSeparator
   } from '@/components/ui/breadcrumb';
   import { cn } from '@/lib/utils';
   ```

3. Define `computePendingCount()` helper (preserved from existing Layout.tsx).

4. Implement `Layout` component:

   a. **State:**
   ```typescript
   const { user } = useAuth();
   const [offline, setOffline] = useState(!navigator.onLine);
   const [pendingCount, setPendingCount] = useState(0);
   const [sheetOpen, setSheetOpen] = useState(false);
   const location = useLocation();
   ```

   b. **Effects** (preserve offline banner logic from existing Layout):
   ```typescript
   useEffect(() => {
     setPendingCount(computePendingCount());
     const goOnline = () => setOffline(false);
     const goOffline = () => setOffline(true);
     const handleStorageChange = (e: StorageEvent) => {
       if (e.key === 'kapwa_sync_queue') setPendingCount(computePendingCount());
     };
     window.addEventListener('online', goOnline);
     window.addEventListener('offline', goOffline);
     window.addEventListener('storage', handleStorageChange);
     return () => {
       window.removeEventListener('online', goOnline);
       window.removeEventListener('offline', goOffline);
       window.removeEventListener('storage', handleStorageChange);
     };
   }, []);
   ```

   c. **Close Sheet on route change:**
   ```typescript
   useEffect(() => {
     setSheetOpen(false);
   }, [location.pathname]);
   ```

   d. **BreadcrumbNav** (extracted helper — defined OUTSIDE the Layout component to prevent remount on every render):
   ```typescript
   function BreadcrumbNav({ pathname }: { pathname: string }) {
     const crumbs = createBreadcrumbs(pathname);
     return (
       <Breadcrumb className="mb-4">
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

   e. **Render structure** (per UI-SPEC layout diagram):
   ```tsx
   return (
     <>
       {/* Skip-to-content link — first focusable element */}
       <a
         href="#main-content"
         className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md"
       >
         Skip to content
       </a>

       {/* Offline banner */}
       {offline && (
         <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
           You are offline{pendingCount > 0 ? ` — ${pendingCount} change(s) pending sync` : ''}
         </div>
       )}

       {/* Topbar */}
       <Topbar onMenuToggle={() => setSheetOpen(!sheetOpen)} />

       <div className="flex min-h-[calc(100vh-4rem)]">
         {/* Desktop sidebar */}
         <Sidebar />

         {/* Mobile Sheet (lg:hidden) */}
         <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
           <SheetContent side="left" className="w-64 p-0">
             <SidebarNavContent onNavClick={() => setSheetOpen(false)} />
           </SheetContent>
         </Sheet>

         {/* Main content */}
         <main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto">
           <BreadcrumbNav pathname={location.pathname} />
           {children || <Outlet />}
         </main>
       </div>
     </>
   );
   ```

   f. Note: Do NOT import or render `ThemeProvider` here — it wraps at the routes.tsx level (Task 7).

   g. Keep the same export signature: `export function Layout({ children }: { children?: React.ReactNode })`.

5. Delete the old NAV_ITEMS and inline nav rendering from Layout.tsx (they're now in nav-config.ts and Sidebar.tsx).

**Acceptance Criteria:**
- Layout renders: SkipToContent → Topbar → (Sidebar | Sheet) → BreadcrumbNav → main content
- Skip-to-content is first focusable element, targets `#main-content`
- Offline banner logic preserved identically
- Desktop sidebar rendered via `<Sidebar />`
- Mobile Sheet rendered via `<Sheet><SheetContent><SidebarNavContent /></SheetContent></Sheet>`
- Sheet closes on route change (`useEffect` on `location.pathname`)
- Breadcrumbs render inside `<main>` above `{children || <Outlet />}`
- Layout exports `Layout` named export, accepts `{ children?: React.ReactNode }`
- No `getCurrentUser()` call — uses `useAuth()` from context
- File compiles: `npm run build` passes

**Verify:**
```bash
cd kapwa-client && npm run build
```

**Done:** `Layout.tsx` refactored as composition shell — build passes.

---

### Task 7: Add ThemeProvider to routes.tsx

**Type:** `auto`

**Rationale:** next-themes is installed but unused. The `<ThemeProvider>` needs to wrap the app to make `useTheme()` available. Per CONTEXT.md D-05 and RESEARCH.md recommendation, wrap it around `AuthProvider` in `routes.tsx`.

**Read first:**
- `kapwa-client/src/routes.tsx:64-71` — current MainRoutes rendering
- `.planning/phases/08-layout-shell/08-RESEARCH.md` — Pattern 4 code template (lines 373-394)
- `.planning/phases/08-layout-shell/08-CONTEXT.md` — D-05, D-06, D-07

**Action:**

1. Read `kapwa-client/src/routes.tsx`

2. Add import at top:
   ```typescript
   import { ThemeProvider } from 'next-themes';
   ```

3. Wrap `MainRoutes` return statement:
   ```tsx
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

4. Verify `next-themes` is already in `package.json` at `^0.4.6` — no install needed.

5. If ThemeProvider import fails (e.g., peer dep issue with React 19), install with:
   ```
   npm install --legacy-peer-deps next-themes
   ```

**Acceptance Criteria:**
- `routes.tsx` imports `ThemeProvider` from `next-themes`
- `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` wraps `<AuthProvider>`
- File compiles: `npm run build` passes
- Dark mode toggle in Topbar works at runtime (inject `.dark` class on `<html>`)

**Verify:**
```bash
cd kapwa-client && npm run build
```

**Done:** `ThemeProvider` wrapped in `routes.tsx` — build passes.

---

## Dependencies

```
Task 1 (Install ScrollArea)
  │
  ▼
Task 2 (nav-config.ts) ◄──── depends on nothing, pure data
  │
  ├──────► Task 4 (Sidebar.tsx) ◄──── depends on Task 2 (NAV_GROUPS)
  │                                    depends on Task 1 (ScrollArea)
  │
  ├──────► Task 5 (Topbar.tsx) ◄──── depends on Task 2 (NAV_GROUPS — only for references)
  │                                    preserves NotificationsDropdown, MessagesPopover
  │
Task 3 (breadcrumbs.ts) ◄──── depends on nothing, pure utility
  │
  ├──────► Task 6 (Layout.tsx) ◄──── depends on Task 1 (ScrollArea — transitive)
  │                                    depends on Task 2 (NAV_GROUPS — transitive via Sidebar)
  │                                    depends on Task 3 (breadcrumbs.ts)
  │                                    depends on Task 4 (Sidebar.tsx)
  │                                    depends on Task 5 (Topbar.tsx)
  │
Task 7 (routes.tsx) ◄──── independent of Tasks 1-6
                           modifies routes.tsx only
```

**Execution order:** Tasks 1, 2, 3, 7 can run in parallel. Task 4 depends on Tasks 1, 2. Task 5 depends on Task 2. Task 6 depends on Tasks 1, 2, 3, 4, 5.

**Recommended parallel waves:**

| Wave | Tasks | Rationale |
|------|-------|-----------|
| 1 | Task 1, Task 2, Task 3, Task 7 | Independent — ScrollArea install, data files, ThemeProvider |
| 2 | Task 4, Task 5 | Sidebar depends on nav-config, Topbar is independent |
| 3 | Task 6 | Layout composes everything |

---

## File Manifest

### Files to Create

| File | Purpose | Created By |
|------|---------|------------|
| `kapwa-client/src/lib/nav-config.ts` | Grouped nav items with role filtering, extracted from Layout.tsx::21-35 | Task 2 |
| `kapwa-client/src/lib/breadcrumbs.ts` | `BREADCRUMB_LABELS` map + `createBreadcrumbs(pathname)` resolver | Task 3 |
| `kapwa-client/src/components/Sidebar.tsx` | Desktop sidebar (256px, ScrollArea) + `SidebarNavContent` shared component for Sheet | Task 4 |
| `kapwa-client/src/components/Topbar.tsx` | Topbar: logo, role badge, search, notifications, messages, user DropdownMenu, hamburger | Task 5 |
| `kapwa-client/src/components/ui/scroll-area.tsx` | shadcn ScrollArea component wrapper | Task 1 |

### Files to Modify

| File | Change | Modified By |
|------|--------|-------------|
| `kapwa-client/src/components/Layout.tsx` | Complete rewrite: OfflineBanner + SkipToContent + Topbar + Sidebar/Sheet + BreadcrumbNav + main content | Task 6 |
| `kapwa-client/src/routes.tsx` | Wrap `<AuthProvider>` with `<ThemeProvider attribute="class">` | Task 7 |

### Files to Preserve (Unchanged)

| File | Reason |
|------|--------|
| `kapwa-client/src/components/NotificationsDropdown.tsx` | D-20: preserved as-is |
| `kapwa-client/src/components/MessagesPopover.tsx` | D-20: preserved as-is |
| `kapwa-client/src/components/ProtectedRoute.tsx` | D-20: preserved as-is |
| All 23 `kapwa-client/src/components/ui/*.tsx` | Already installed from Phase 07 |
| `kapwa-client/src/pages/*` | Page components unchanged |
| `kapwa-client/src/lib/auth-context.tsx` | Provider unchanged (used by Layout and Topbar) |
| `kapwa-client/src/lib/utils.ts` | `cn()` utility unchanged |
| `kapwa-client/src/lib/offline-queue.ts` | `loadQueue()` unchanged (used by Layout) |
| `kapwa-client/src/main.tsx` | Entry point unchanged |
| `kapwa-client/src/index.css` | Dark mode classes already exist. No changes needed |
| `kapwa-client/vite.config.ts` | Build config unchanged |

### File Content Map (New/Modified)

#### `src/lib/nav-config.ts` (NEW)
- Interface `NavItem`: `{ path: string, label: string, icon: React.ReactNode, roles: string[] }`
- Interface `NavGroup`: `{ label: string, items: NavItem[] }`
- Constant `NAV_GROUPS: NavGroup[]` — 5 groups: Core, Operations, Admin, Reports & Tracker, Claimant
- 13 nav items total, preserving existing paths, labels, icons, and role arrays
- Icons: `FilePlus`, `LayoutDashboard`, `Users`, `ClipboardList`, `CheckCircle`, `FileText`, `FolderOpen`, `Stamp`, `Shield`, `UserCircle` from `lucide-react`

#### `src/lib/breadcrumbs.ts` (NEW)
- Interface `BreadcrumbItem`: `{ label: string, href: string }`
- Map `BREADCRUMB_LABELS: Record<string, string>` — 21 route-to-label mappings
- Function `createBreadcrumbs(pathname: string): BreadcrumbItem[]` — splits path by `/`, maps segments, fallback to Title Case
- Always starts with `Dashboard` → `/`

#### `src/components/Sidebar.tsx` (NEW)
- Exports `Sidebar`, `SidebarNavContent`, `SidebarNavContentProps`
- `Sidebar`: `w-64 bg-card border-r border-border sticky top-16 h-[calc(100vh-4rem)] hidden lg:block`
- `SidebarNavContent`: shared nav rendering consumed by both `Sidebar` and `Sheet` in Layout
- Active route logic: `/` exact match, others via `location.pathname.startsWith(item.path)`
- Group visibility: hides when 0 items pass role filter
- Uses `ScrollArea` for independent scrolling

#### `src/components/Topbar.tsx` (NEW)
- Exports `Topbar`
- Props: `onMenuToggle?: () => void`
- Mount-guarded dark mode toggle: `useState(false) + useEffect`
- User DropdownMenu: profile card, Dark Mode toggle (Sun/Moon), Settings link (`/settings`), Logout
- Logout: `useAuth().logout()` + `navigate('/login')`
- Preserves: NotificationsDropdown, MessagesPopover
- Hamburger: `lg:hidden` button calling `onMenuToggle`

#### `src/components/Layout.tsx` (REWRITE)
- Exports `Layout`
- Preserves: offline banner, `computePendingCount()`, `{ children?: React.ReactNode }` signature
- New: Skip-to-content anchor, BreadcrumbNav, Sheet integration
- Uses `useAuth()` from context (no more `getCurrentUser()`)
- Desktop: `Sidebar` (sticky 256px)
- Mobile: `Sheet` with `SidebarNavContent`
- Responsive: `Sheet` trigger visible on `<lg`, `Sidebar` visible on `lg+`
- Sheet closes on route change

#### `src/routes.tsx` (MODIFIED)
- Add: `import { ThemeProvider } from 'next-themes'`
- Wrap: `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` around `<AuthProvider>`

---

## Verification

### Per-Task Verification

| Task | Verify Command |
|------|---------------|
| Task 1 | `ls kapwa-client/src/components/ui/scroll-area.tsx && cd kapwa-client && npm run build` |
| Task 2 | `cd kapwa-client && npm run build` |
| Task 3 | `cd kapwa-client && npm run build` |
| Task 4 | `cd kapwa-client && npm run build` |
| Task 5 | `cd kapwa-client && npm run build` |
| Task 6 | `cd kapwa-client && npm run build` |
| Task 7 | `cd kapwa-client && npm run build` |

### Phase-Gate Verification

```bash
cd kapwa-client && npm run build
```

### Manual UAT Checklist

1. **Sidebar (LAY-01)**: Navigate to each route — verify active highlighting, group visibility per role
2. **Topbar (LAY-02)**: Click avatar — verify DropdownMenu shows profile, dark mode toggle, settings, logout
3. **Breadcrumbs (LAY-03)**: Navigate to `/beneficiaries`, `/settings/mfa` — verify correct trail
4. **Skip-to-content (LAY-04)**: Press Tab at page load — verify "Skip to content" is first focusable, clicking it focuses main
5. **Dark mode (DSG-05)**: Toggle dark mode in user menu — verify `.dark` class on `<html>`, CSS variables switch
6. **Mobile**: Resize to <1024px — verify sidebar replaced by hamburger + Sheet
7. **Offline**: Disconnect network — verify amber offline banner appears
8. **Logout**: Click Logout — verify redirect to `/login`, auth state cleared

---

## Success Criteria

- Layout.tsx reduced from 182 lines to ~80-100 lines (composition)
- Sidebar.tsx, Topbar.tsx, nav-config.ts, breadcrumbs.ts created
- All 5 requirements (LAY-01 through LAY-04, DSG-05) implemented
- `npm run build` passes
- Dark mode functional: `.dark` class on `<html>`, toggle works, persists to localStorage
- Skip-to-content first in tab order, visible on keyboard focus
- Mobile Sheet opens from left, closes on nav/overlay/Escape
- Existing NotificationsDropdown.tsx, MessagesPopover.tsx unchanged
- No double auth fetch (Layout uses `useAuth()` context)
- No new dependencies beyond shadcn ScrollArea

---

## Threat Model

| Threat | Category | Mitigation |
|--------|----------|------------|
| Role info visible in client nav config | Information Disclosure | NAV_GROUPS role filtering is convenience-only. ProtectedRoute.tsx is the actual security gate |
| XSS via breadcrumb labels | Tampering | All BREADCRUMB_LABELS values are hardcoded constants. Fallback labels use regex replace with no user input |
| Dark mode preference tracking | Information Disclosure | localStorage key is `theme`, next-themes is open source with no telemetry |
| Sheet focus trap blocking accessibility | Denial of Service | Radix Dialog handles focus management with Escape key fallback per WCAG |

---

## Output

Create `.planning/phases/08-layout-shell/08-SUMMARY.md` when all tasks complete.
