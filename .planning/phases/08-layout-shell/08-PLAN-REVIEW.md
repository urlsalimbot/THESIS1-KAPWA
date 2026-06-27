# Phase 08 Layout Shell — Plan Review

**Reviewer:** gsd-plan-checker
**Date:** 2026-06-27
**Plan:** `.planning/phases/08-layout-shell/08-PLAN.md`

---

## 1. Verdict: **FLAG**

The plan is sound and will achieve the phase goal, but has issues that should be corrected before execution.

---

## 2. Goal Coverage

| Req ID | Description | Task(s) | Verdict |
|--------|-------------|---------|---------|
| LAY-01 | Sidebar with role-filtered nav groups | Task 2 (nav-config), Task 4 (Sidebar.tsx), Task 6 (Layout integration) | ✅ |
| LAY-02 | Topbar with user menu, notifications, messages | Task 5 (Topbar.tsx), Task 6 (Layout integration) | ✅ |
| LAY-03 | Breadcrumb navigation | Task 3 (breadcrumbs.ts), Task 6 (BreadcrumbNav in Layout) | ✅ |
| LAY-04 | Skip-to-content for keyboard accessibility | Task 6 (Layout.tsx — `<a href="#main-content">`) | ✅ |
| DSG-05 | Dark mode toggle | Task 5 (Topbar toggle UI), Task 7 (ThemeProvider) | ✅ |

All five requirements have corresponding tasks. Coverage is complete.

---

## 3. Decision Compliance

| Decision | Plan Compliance | Notes |
|----------|----------------|-------|
| **D-01**: Non-collapsible sidebar, 256px | ✅ PASS | Sidebar is `w-64`, `sticky top-16`, no collapsibility mentioned |
| **D-02**: Mobile via Sheet <1024px | ✅ PASS | `Sheet side="left" w-64`, hamburger `lg:hidden` |
| **D-03**: Nav groups by category | ⚠️ FLAG | Groups defined correctly (Core, Operations, Admin, Reports & Tracker, Claimant). **But nav items are incomplete per D-03:** Programs (`/programs`), Reports (`/reports`), Audit Logs (`/audit-logs`), and My Access Card (`/my-access-card`) all have existing routes but no NAV_ITEMS entry. The plan preserves only the 13 existing items. However, D-03 explicitly lists these as sidebar members. (See Issue 2) |
| **D-05**: next-themes, `class` attribute | ✅ PASS | Task 7: `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange` |
| **D-07**: Dark toggle in DropdownMenu | ✅ PASS | Task 5: Sun/Moon toggle inside user DropdownMenu with mount guard |
| **D-08**: Breadcrumbs from pathname | ✅ PASS | `createBreadcrumbs(pathname)` splits path segments |
| **D-10**: Parameterized breadcrumb labels | ⚠️ FLAG | D-10 says "entity name from route state or generic 'View {Entity}' label." Plan uses kebab-to-TitleCase fallback (e.g., "Abc 123") instead of "View Beneficiary" pattern. Low severity — entity resolution is deferred per RESEARCH.md recommendation. |
| **D-11**: Uses shadcn Breadcrumb | ✅ PASS | Imports and uses full shadcn Breadcrumb family |
| **D-12**: User menu: profile, dark mode, settings, logout | ✅ PASS | All four items present in Topbar DropdownMenu |
| **D-14**: Split into Layout/Sidebar/Topbar | ✅ PASS | Three files created, Layout rewritten |
| **D-16**: Skip-to-content is first focusable | ✅ PASS | Rendered before Topbar in DOM, `sr-only focus:not-sr-only` |
| **D-20**: NotificationsDropdown/MessagesPopover preserved | ✅ PASS | Declared `files_preserved`, imported without changes |
| **D-22**: NAV_ITEMS data preserved | ✅ PASS | All 13 existing items migrated to nav-config.ts |

**5 of 5 checks pass** ✅ with 2 minor flags noted above. No BLOCK-level decision violations.

---

## 4. Dependency Soundness

**Graph:**
```
Wave 1 (parallel): Task 1 (ScrollArea) ─ Task 2 (nav-config) ─ Task 3 (breadcrumbs) ─ Task 7 (ThemeProvider)
Wave 2 (parallel): Task 4 (Sidebar) ← Task 1 + Task 2
                   Task 5 (Topbar) ← (effectively independent)
Wave 3: Task 6 (Layout) ← Task 1 + Task 2 + Task 3 + Task 4 + Task 5
```

**Issues found:**

1. **Unused import in Topbar.tsx (Issue 1):** The Topbar import list includes `import { createBreadcrumbs } from '@/lib/breadcrumbs'` (line 416 of PLAN), but the final Topbar component does NOT render or use breadcrumbs — breadcrumbs are rendered in Layout.tsx. This unused import will cause a TypeScript/lint build error if `noUnusedLocals` is enabled in tsconfig.
2. **No circular dependencies.** Tree is a clean DAG.
3. **Wave ordering is correct** — all prerequisites complete before consumers run.

---

## 5. Risk Coverage

| Risk | Addressed? | Notes |
|------|-----------|-------|
| Auth double-fetch (PATTERNS Risk 1) | ✅ Addressed | Layout switches from `getCurrentUser()` to `useAuth()`. ProtectedRoute still uses `getCurrentUser()` but noted as acceptable pre-existing pattern. |
| FOUC / hydration (RESEARCH Pitfall 1-2) | ✅ Addressed | SPA has no SSR mismatch. Dark mode toggle is mount-guarded. `disableTransitionOnChange` on ThemeProvider. |
| Sheet duplication (RESEARCH Pitfall 3) | ✅ Addressed | `SidebarNavContent` shared component renders in both desktop `aside` and mobile `Sheet`. |
| Breadcrumb key conflicts (RESEARCH Pitfall 4) | ✅ Addressed | Keys use `crumb.href` — unique per pathname. |
| DropdownMenu navigation (RESEARCH Pitfall 5) | ✅ Addressed | Uses `asChild` + `<Link>` for settings navigation. |
| Group visibility (PATTERNS Risk 4) | ✅ Addressed | `if (visibleItems.length === 0) return null` hides empty groups. |
| ScrollArea peer deps (Task 1) | ✅ Addressed | Plan has fallback for shadcn CLI: manual creation or `--legacy-peer-deps` |
| `/programs`, `/reports`, `/audit-logs`, `/my-access-card` routes exist but have no sidebar entry | ❌ Not addressed | See Issue 2 |

---

## 6. Issues

### Issue 1 (LOW) — Unused `createBreadcrumbs` import in Topbar

**What:** `import { createBreadcrumbs } from '@/lib/breadcrumbs'` appears in Topbar.tsx imports (plan line 416) but is never used in the Topbar component — breadcrumbs are rendered in Layout.tsx (plan line 681).

**Why it matters:** Will cause a TypeScript/lint build error if `noUnusedLocals` is enabled, or at minimum a compiler warning.

**Suggested fix:** Remove `import { createBreadcrumbs } from '@/lib/breadcrumbs'` from Topbar.tsx import block.

---

### Issue 2 (MEDIUM) — Missing nav items per D-03 group definitions

**What:** D-03 defines sidebar groups that include Programs (Operations), Reports (Reports & Tracker), Audit Logs (Reports & Tracker), and My Access Card (Claimant). All four routes exist in `routes.tsx`. However, the plan's `NAV_GROUPS` does not create sidebar entries for any of them:

| Route | D-03 Group | In Current NAV_ITEMS? | In PLAN? |
|-------|-----------|----------------------|----------|
| `/programs` | Operations | ❌ | ❌ |
| `/reports` | Reports & Tracker | ❌ | ❌ |
| `/audit-logs` | Reports & Tracker | ❌ | ❌ |
| `/my-access-card` | Claimant | ❌ | ❌ (noted as excluded) |

The plan correctly preserves only the 13 existing NAV_ITEMS, but since these routes exist, D-03 (a locked decision) expects them in the sidebar.

**Why it matters:** The sidebar will be incomplete per D-03. Reports & Tracker group will show only Daily Tracker, missing Reports and Audit Logs. Operations will miss Programs. Claimant will miss My Access Card.

**Suggested fix:** Either (a) add NAV_ITEMS entries for these four routes (they already have pages), or (b) explicitly document in the plan that these are deferred additions with a rationale. The plan currently only notes `/my-access-card`'s absence but not Programs, Reports, or Audit Logs.

---

### Issue 3 (LOW) — No automated test coverage

**What:** RESEARCH.md's Validation Architecture identifies 4 missing test files (Wave 0 gaps): `Sidebar.test.tsx`, `Topbar.test.tsx`, `Layout.test.tsx`, and `breadcrumbs.test.ts`. The plan has no task to create any of these.

**Why it matters:** Skip-to-content (LAY-04) and mobile Sheet behavior cannot be verified by `npm run build` alone — they require manual keyboard/screen-size testing.

**Suggested fix:** Add Task 8 (or a note in the UAT checklist) to create at minimum `src/lib/breadcrumbs.test.ts` — this is a pure function test with low setup cost and high confidence gain. Sidebar/Topbar/Layout component tests can remain deferred if Vitest + testing-library setup proves complex.

---

### Issue 4 (LOW) — `BreadcrumbNav` defined inside `Layout` component

**What:** The `BreadcrumbNav` helper function (plan line 681) is defined inside the `Layout` component's render function. This creates a new function identity on every render.

**Why it matters:** React anti-pattern — defining a component inside another component causes React to unmount/remount the inner component on every render because it sees a new component type each time.

**Suggested fix:** Move `BreadcrumbNav` outside the `Layout` function, or define it as a module-level arrow function. It can still call `useLocation()` independently as a sibling to `Layout`.
