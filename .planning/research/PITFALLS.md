# Pitfalls Research: Kapwa UI/UX Overhaul (v1.1)

**Domain:** Brownfield React SPA → shadcn/ui + Tailwind design tokens + PWA polish
**Researched:** 2026-06-27
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: CSS Specificity War Between Legacy Classes and shadcn/Tailwind

**What goes wrong:**
The existing `index.css` defines 40+ component classes (`.btn`, `.btn-primary`, `.form-input`, `.table`, `.badge-*`, `.login-card`, `.page-header`, `.spinner`, `.empty-state`, `.pagination`) in `@layer components`. When shadcn components are added alongside these legacy classes, a specificity tug-of-war breaks out. Sometimes the legacy CSS wins (buttons show wrong colors), sometimes shadcn wins (form inputs lose their padding). The result is a visually inconsistent app where some pages look "done" and others look broken, and every fix with `!important` compounds the problem.

**Why it happens:**
- shadcn components use Tailwind utilities, which go into `@tailwind utilities` layer.
- Legacy classes in `@layer components` have **lower** specificity than unlayered CSS but **higher** than Tailwind's `@layer base`.
- Tailwind's utility layer sits above component layer in cascade order.
- But any unlayered CSS (which includes styles from some third-party libs, and any rule outside a `@layer` block) beats *everything*.
- The `index.css` currently imports via `@import url(...)` for Google Fonts outside any `@layer`, which puts those rules in the unlayered context — highest specificity.
- Pages import `../index.css` directly (14 of 24 pages do this), meaning legacy classes are re-declared per-page load depending on Vite's chunking.
- `tailwind-merge` (via `cn()`) can't fix conflicts between Tailwind utilities and legacy CSS class names — it only resolves conflicts *within* Tailwind utility classes.

**How to avoid:**
1. **Do the CSS cleanup FIRST, before any component migration.** Strip `index.css` down to only design tokens and `@layer base` resets. Move every component class (`.btn`, `.table`, `.form-input`, `.badge-*`) to a single dedicated `@layer legacy { ... }` block — this creates an explicit low-priority layer so shadcn/Tailwind utilities naturally override them.
2. **Remove `../index.css` imports from individual pages.** The CSS should be imported once at the app entry point (`main.tsx` or `App.tsx`), not per-page. This prevents duplicate cascades and file-size bloat.
3. **Use `cn()` consistently** on every className merge — but understand its limits. It only reconciles Tailwind utility conflicts, not custom class conflicts.
4. **Never use `!important` as a "fix."** Tag `!important` rules and audit them weekly. Every `!important` is a flag that the layer architecture is wrong.
5. **Set up a CSS audit script** that counts legacy class usage vs shadcn component usage per page, so you can track migration progress numerically.

**Warning signs:**
- Buttons on one page look different from buttons on another page
- `!important` starts appearing in components to "fix" color issues
- Form inputs have different padding/heights on different pages
- Adding a new shadcn component unexpectedly changes unrelated UI
- Vite HMR reorders styles on hot reload, making the bug appear/disappear

**Phase to address:**
Must be addressed in the **very first phase** (Token System Setup) before any component migration. The layer architecture decision determines every subsequent component's visual correctness.

---

### Pitfall 2: Design Token Silo — Tokens Exist But Components Don't Use Them

**What goes wrong:**
The existing codebase already has CSS custom properties (`--background`, `--foreground`, `--primary`, `--accent`, etc.) defined in `:root` and wired into `tailwind.config.ts`. Yet most legacy components hardcode color values. The DashboardPage uses `text-gray-900`, `bg-gray-100`, `text-gray-500` directly. The AdminPage uses `border-gray-100`, `bg-white`, `text-gray-400`. The login page uses `text-text-secondary` (which doesn't even exist in the theme — it's a dead class). When the design tokens are updated for the overhaul, these hardcoded values remain, creating a two-tone app where some areas respect the token system and others don't.

**Why it happens:**
- The token system was added as an infrastructure layer (CSS vars + tailwind.config) but the existing component classes were never refactored to use them.
- 14 pages import `index.css` directly and use legacy class names like `.badge-category` (`bg-[#E8ECF1] text-[#0F172A]`), `.login-card`, `.stat-card` — all with hardcoded hex values.
- `text-text-secondary` is a class that doesn't map to any token — it compiled once (maybe from a deleted token name) and now silently does nothing (the element gets no color property).
- The `.badge` class system uses raw hex colors — changing a token won't update a single badge.

**How to avoid:**
1. **Inventory ALL hardcoded color values** across all 24 pages before starting migration. Use a script to grep for `#[0-9a-fA-F]{3,6}` and `rgb\(|rgba\(` in page components. Map each to its semantic token equivalent.
2. **Define a hardcoded-value-to-token migration table** as a living document. Example: `bg-green-100 text-green-800` → `badge-success` variant; `bg-blue-100 text-blue-800` → `badge-info` variant; `bg-red-50 text-red-800 border-red-300` → `alert-destructive` variant.
3. **Use `@theme` (or extended Tailwind config) for all palette colors** — never use raw hex in component files.
4. **Adopt the "no new hex values" rule** — after the token system phase, any PR that introduces a raw hex color in a component file is rejected.
5. **The token system phase should produce a dark mode simultaneously** — if you can do light/dark with just CSS var overrides, you know the token wiring is correct. If you can't, some tokens are still hardcoded.

**Warning signs:**
- Running `git grep "#[0-9a-fA-F]"` on `src/pages/` returns >50 results
- A component looks correct in light mode but has no dark mode behavior
- Changing `--primary` in `index.css` doesn't update a primary button somewhere
- `text-gray-*` or `bg-gray-*` appear in components rather than `text-muted-foreground` or `bg-card`

**Phase to address:**
Phase 1 (Token System + CSS cleanup). The token inventory and hardcoded-value ban must be established before Phase 2 (component migration starts).

---

### Pitfall 3: PWA Bundle Bloat from Animation Library (framer-motion trap)

**What goes wrong:**
The v1.1 overhaul calls for "micro-interactions" and animation polish. The most natural choice is `framer-motion`. But framer-motion's `motion` component is ~34KB min+gzip (cannot be tree-shaken smaller because of its declarative props API). On a Capacitor PWA targeting field workers on mid-range Android phones (Samsung A-series, Xiaomi Redmi — common in Norzagaray), this means:
- +34KB gzipped to the JS bundle
- ~180ms additional Total Blocking Time on mobile
- JavaScript-driven animation on every frame (main thread contention)
- Battery drain on devices where animation isn't needed
- The mobile Lighthouse Performance score drops from whatever it is now by ~10-17 points

For a social welfare app where workers need the UI to be responsive (not pretty), animation is visual noise. The cost-to-benefit ratio is terrible.

**Why it happens:**
- Framer Motion is the default "add animation" library — it's what comes to mind first.
- Bundlephobia doesn't show `34kb` clearly — it shows `50kb+` total package with most being tree-shakeable, but `motion` component specifically can't shrink.
- CSS transitions + `IntersectionObserver` achieve the same visual result (fade-in on scroll, hover effects, mobile nav slide) with ZERO JavaScript execution cost.
- The `tailwindcss-animate` plugin is already installed and provides `animate-*` utilities.
- Motion's `LazyMotion` + `m` (the slim alternative) can reduce to ~4.6kb but still adds JS execution per frame.

**How to avoid:**
1. **Do NOT install framer-motion.** The existing `tailwindcss-animate` plugin + CSS transitions + the Web Animations API (WAAPI) cover every micro-interaction this app needs: hover lifts, fade-ins, accordion slides, modal transitions, skeleton shimmer.
2. **CSS-first animation policy:** All UI animations (hover, focus, transitions, accordion, modal enter/exit) use CSS transitions or WAAPI. Only reach for a JS animation library if the interaction requires spring physics, gesture-driven transforms, or shared-element layout animations — none of which this app needs.
3. **For the "skeleton shimmer"** — use a CSS gradient animation (already possible with tailwindcss-animate).
4. **If animation is absolutely needed for a specific component** (e.g., card flip, page transitions), use WAAPI via a lightweight wrapper like `@motionone/dom` (~2.3kb tree-shaken).
5. **Budgets:** Set a JS bundle budget for animations at 0KB initially. Only increase if a specific feature proves impossible with CSS.
6. **Use `useReducedMotion`** to respect `prefers-reduced-motion` for accessibility — which also helps performance on low-end devices.

**Warning signs:**
- `framer-motion` appears in `package.json` dependencies
- `import { motion } from "framer-motion"` appears in any component
- Bundle analyzer shows >5KB of animation-related JS
- Lighthouse mobile Performance drops >5 points after "adding animations"
- Skeleton shimmer uses JS instead of CSS gradients

**Phase to address:**
Phase 1 (Tooling/Infrastructure) — explicitly exclude framer-motion from the allowed dependency list in the project's tech spec. Enforce in code review.

---

### Pitfall 4: Accessibility Regressions When Replacing Native HTML with Radix Primitives

**What goes wrong:**
The existing app uses native HTML elements (`<button>`, `<input>`, `<select>`, `<table>`, `<label>`) with some aria attributes. During migration to shadcn/Radix components, developers replace these with Radix primitives (`<Select.Trigger>`, `<Checkbox.Root>`, `<Tabs.Root>`) and lose:
- Native form behavior (form submission, validation, `FormData` collection)
- Label-input association (Radix `Select.Trigger` doesn't pass `id` to hidden `<select>` — known Radix bug #3294)
- Focus management (native elements get focus outlines by default; custom elements need explicit `focus-visible` styling)
- Error message associations (`aria-describedby` on native vs Radix controls)
- Screen reader navigation (landmarks, headings, live regions)
- The `.error-msg` classes become inert when the underlying HTML changes

**Why it happens:**
- Radix Checkbox and Select don't render native `<input>`/`<select>` elements by default. They use `role="checkbox"` on a `<button>`. This breaks HTML form association.
- Radix `Checkbox` doesn't include a native `<input>` element at all — form submission won't include checkbox values. (Known issue #2530, partially addressed in PR #3161 but still not intuitive.)
- Radix `Select`'s hidden `<select>` element doesn't inherit the `id` from `<Select.Trigger>`, breaking `<label htmlFor="...">` association. (Known #3294, open since Dec 2024.)
- Developers assume "Radix handles accessibility" and skip manual testing with screen readers.
- The existing codebase already has accessibility gaps (no skip-nav, inconsistent ARIA labels on icons, `aria-label` on some elements but not all) — migration can accidentally widen these gaps rather than close them.

**How to avoid:**
1. **Do NOT use Radix Select/Checkbox/Radio for forms that need HTML form submission.** Instead, use the shadcn `Input`, `Button` (wraps native `<button>`) and build custom select using native `<select>` styled with Tailwind. Reserve Radix primitives for complex interactive patterns (Dialog, Popover, Tabs, DropdownMenu) where the accessibility model is genuinely better than native.
2. **For every form that uses Radix form controls**, test that `FormData` captures the values. If they don't, add hidden `<input>` elements synced to Radix state (workaround for #2530).
3. **Test with actual screen readers** (VoiceOver on macOS, TalkBack on Android) for the 3 most critical flows: login, intake form, case list. Don't rely on automated tools only.
4. **Add `focus-visible` styles explicitly** on all interactive Radix elements — Radix components are `<div>` or `<span>` elements under the hood and don't get native focus outlines.
5. **Maintain `aria-describedby` for error messages** — the existing `error-msg` pattern needs to be ported to shadcn `Alert` with proper error association.
6. **Use Radix `Label` primitive** instead of bare `<label>` elements, but verify `htmlFor` works with the target Radix control.
7. **Add a `role="alert"` on error containers** for screen reader announcements.

**Warning signs:**
- Form submission doesn't include checkbox/select values
- Clicking a `<label>` doesn't focus the associated control
- Keyboard navigation skips or traps in Radix-wrapped controls
- VoiceOver/TalkBack announces "group" instead of meaningful labels
- Focus outline disappears on interactive elements
- Automated a11y tools report "missing form label" on inputs generated by Radix

**Phase to address:**
Phase 1 (Foundation/Infrastructure) should establish the "native <select>/<input> for forms, Radix for interactions" rule. Phase 4 (Accessibility) should verify every Radix substitution with manual screen reader testing.

---

### Pitfall 5: Print Stylesheet Conflicts with shadcn/Tailwind `print:` Variant

**What goes wrong:**
The existing `index.css` has print styles (`@media print`) at the bottom that work for legacy classes. When shadcn components are added, print behavior becomes unpredictable:
- Radix-based modals, popovers, and dropdowns that were visually hidden on screen appear in print
- shadcn cards with shadows look wrong on paper (shadows don't print well)
- Tailwind's `print:hidden` variant may silently fail on Safari (known WebKit regression in Safari 18.5 — #18699)
- The existing `.no-print` class and the new `print:hidden` class can conflict when both are applied to the same element
- Breakpoint-aware layouts (grid, flex) that look great on screen collapse badly on A4 paper

**Why it happens:**
- Safari 18.5+ has a regression where Tailwind's `print:` variant doesn't work in dev mode (the `@media print` is nested inside the class selector, which Safari fails to parse). Production builds (Lightning CSS) fix this — but only in production.
- shadcn Dialog/Popover components use portals. In print, the portal content may render outside its intended position or not render at all.
- The existing print styles (`@page { size: A4; margin: 15mm; }`) assume a specific layout structure that breaks when page layouts change.
- Tailwind 3.3+ has `print:` variant built-in, but the existing codebase uses `.no-print` class — a coexistence period where both patterns exist creates maintenance overhead.

**How to avoid:**
1. **Safari workaround:** Always test print output in production builds, not dev mode. The dev-mode print variant bug only affects dev servers.
2. **Adopt `print:hidden` and `print:!hidden` consistently** — replace `.no-print` usage with Tailwind's `print:` variants during the migration. Or keep `.no-print` and add `@media print { .no-print { display: none !important; } }` to a layer that outranks everything.
3. **For shadcn components that should be hidden in print** (menus, sidebars, notifications), add `print:hidden` at the Layout component level so you don't need to remember on every page.
4. **Add `break-inside-avoid`** to card components, table rows, and intervention blocks to prevent orphaned content across page breaks.
5. **Add `print-color-adjust: exact`** to status badges and colored indicators so they don't lose their semantic color on paper.
6. **Audit all Radix portal-based components** (Dialog, Popover, DropdownMenu) for print rendering — wrap them in `className="print:hidden"` by default.
7. **Set up a print preview test script** that navigates to each page type and calls `window.print()` in headless Chromium, capturing the rendered PDF for visual review.

**Warning signs:**
- `window.print()` preview shows elements that should be hidden (nav, sidebar, buttons)
- Status colors (red for urgent, green for approved) appear as gray on print preview
- Cards or tables split across page breaks mid-content
- Print output looks completely different between Chrome and Safari
- PDF export shows ghost elements from Radix portals

**Phase to address:**
Phase 5 (Print Styles + Production Polish). Print should be addressed **last** because it depends on the final component structure. But the Safari dev-mode gotcha should be documented in Phase 1 so developers don't waste time debugging "broken" print in dev.

---

### Pitfall 6: Routing Fragmentation — Public Pages, Auth Pages, and 6 Role Dashboards

**What goes wrong:**
The overhaul adds public pages (landing, about, auth flow) alongside the existing 6-role authenticated app. The routing setup becomes a tangle of:
- `ProtectedRoute` component checks auth for all routes above
- Public routes (landing, about, login) rendered without layout wrapper
- Auth routes (login, MFA setup) rendered with a minimal layout
- 6 role-specific dashboards, each needing role verification
- Current `ProtectedRoute` redirects unauthorized users to `/` — but `/` has no default content for unauthenticated users
- App.tsx is currently empty (`export {}`) — routing is likely in a separate file or not yet configured properly

**Why it happens:**
- Mixing public and protected routes in a flat router config leads to layout duplication.
- `ProtectedRoute` currently runs auth check in a `useEffect` — creates a visible flash of unauthenticated content before redirect.
- 6 roles mean 6 dashboard pages + shared pages (cases, beneficiaries, interventions) — the route-to-role mapping becomes complex.
- React Router v6 (data router) supports layout routes via `createBrowserRouter` — but the current code uses the older `<BrowserRouter>` pattern with `ProtectedRoute` wrapper.
- The `ProtectedRoute` component has a "flash of wrong role" bug: it redirects to `/login` if not authenticated but to `/` if wrong role — `/` may not exist as a meaningful page.

**How to avoid:**
1. **Use React Router v6.4+ `createBrowserRouter`** with layout routes:
   ```
   PublicLayout (no auth check)
     ├── landing page
     ├── about page
     └── AuthLayout (redirect to /dashboard if already authenticated)
         ├── login
         └── MFA setup
   AppLayout (auth check via layout loader, then role check per route)
     ├── dashboard (role-redirect inside)
     ├── cases (social_worker, admin, coordinator, auditor)
     ├── beneficiaries (...)
     ├── admin (admin only)
     └── auditor (auditor only)
   ```
2. **Move auth check from `useEffect` to a layout component** that renders `<Outlet />` and handles the loading/redirect states without a visible flash. The auth state should be available synchronously from context (already partially done in `auth-context.tsx`).
3. **Fix the "wrong role" redirect** — redirect to a proper `/unauthorized` page instead of `/` (which may be blank/confusing).
4. **Define the route tree clearly** in a single `routes.tsx` file with layout nesting documented.
5. **Use React Router's `index` route** for the default dashboard redirect — `path: "dashboard"` with `index: true` to redirect to the correct dashboard per role.

**Warning signs:**
- Brief flash of unauthorized content before redirect
- Users with wrong role see a blank screen (redirected to `/` with nothing there)
- Public pages accidentally require auth
- Auth pages (login) are shown with the sidebar layout
- New page added but developer forgets to wrap in `ProtectedRoute`
- Route file exceeds 150 lines with nested conditionals

**Phase to address:**
Phase 2 (Public Pages + Auth Flow). Route restructuring must come before role-specific dashboard work in Phase 3.

---

### Pitfall 7: Skeleton Flash / Layout Shift Cascade

**What goes wrong:**
The overhaul adds loading states everywhere — but poor implementation creates a worse UX than the original "Loading..." text:
- 18 pages currently return simple `<div>Loading X...</div>` for loading state.
- When replaced with skeleton components that don't match the real content dimensions, content jumps on load (CLS spikes).
- SWR (used in the app) returns cached data immediately, then revalidates — if the loading state ignores cached data and shows skeletons anyway, the user sees: skeleton → cached data flash → skeleton (while revalidating) → fresh data. Triple flicker.
- Offline-first means cached data may be stale but valuable — showing a skeleton while SWR revalidates wastes the user's time.

**Why it happens:**
- Using `Suspense` boundaries incorrectly: one boundary for multiple data sources means the slowest query blocks the whole section. Fast queries resolve, trigger a re-render, slower queries suspend the boundary again → content appears and disappears.
- Skeleton components match the layout structure roughly but not exactly — different padding, different font sizes, different aspect ratios → content shifts when data arrives.
- SWR's `isLoading` is `true` only on the first fetch; subsequent revalidations have `isValidating = true` but `isLoading = false`. Developers who only check `isLoading` miss the revalidation state and show stale data without indication.
- `fallback={null}` without reserving space causes CLS when content finally renders.

**How to avoid:**
1. **Skeleton matching rule:** Every skeleton component must have the exact same dimensions (`width`, `height`, `padding`, `border-radius`) as the content it replaces. Use the same grid/flex layout. The skeleton should be visually indistinguishable from the content layout at a glance.
2. **Use SWR's `keepPreviousData`** (or the built-in stale-while-revalidate behavior) — show cached data immediately and render a subtle indicator (not a skeleton) during revalidation. Only show a skeleton on the initial load when there's no cache at all.
3. **Separate Suspense boundaries** per independent data source — dashboard stats in one boundary, recent cases in another. Fast stats render immediately, slow cases load independently.
4. **Prevent skeleton flash for fast responses:** Add a minimum 200ms delay before showing a skeleton. If data arrives within 200ms, the skeleton never appears. (Custom `DelayedSuspense` component.)
5. **Reserve space** with explicit `min-height` on content containers — even when data is empty or loading, the container maintains its dimensions.
6. **Use React's `useTransition`** for re-fetch/re-sync operations — keep showing the current UI during the transition instead of dropping to a loading state.

**Warning signs:**
- Lighthouse CLS > 0.1 on any page
- Page renders skeleton → content → skeleton → content in quick succession
- A loading state appears for data already shown from cache
- Scroll position jumps when content loads
- Skeleton margins/paddings differ from content margins/paddings

**Phase to address:**
Phase 6 (Loading States + Polish). Must come after Phase 3 (component structure is stable) but before Phase 7 (final QA). The component structure must be finalized before skeletons are built — rebuilding skeletons for every component change wastes time.

---

### Pitfall 8: Mobile Touch Targets on Form-Heavy Pages Below 48px Threshold

**What goes wrong:**
The existing app was built as a desktop-first SPA. Its forms use compact layouts appropriate for mouse users. On the Capacitor mobile PWA (target device for field workers), these same forms become frustrating:
- `.btn` and `.btn-secondary` elements have `py-2` (~8px padding) making them ~36px tall — below the 48dp WCAG 2.5.5 minimum
- Filter pills (`.filter-pill`) on BeneficiariesPage are `py-1.5 px-3` — ~32px tall
- Close/icon buttons (`.icon-btn`) are `w-10 h-10` — 40px (below 48dp minimum)
- Search input (`.search-input`) with `py-2` — ~36px tall
- Table rows need precise tapping on row-level actions (view, edit)
- Dropdown selects (`.form-select`) with `py-2` — ~36px tall
- The gap between touch targets is often 0-4px (no `gap` or `space-*` utilities between adjacent form elements)

**Why it happens:**
- The original design was desktop-first; mobile was an afterthought
- Kapwa uses Capacitor to wrap the web app. Android's WebView defaults to 48dp minimum touch target recommendations
- Developers sized elements for visual aesthetics, not motor accessibility
- 6 different role dashboards means the form density varies per page — inconsistencies compound the problem
- The current CSS has no `@media (pointer: coarse)` overrides to increase spacing on touch devices
- Google Play Store may reject apps with touch targets <48dp in critical flows (though this is a recommendation, not hard rule)

**How to avoid:**
1. **Set minimum touch target sizes in the design system:** All interactive elements (buttons, inputs, selects, links, icons) must have a computed touch target of at least 48x48 CSS pixels. Use `min-h-[48px]` and `min-w-[48px]` tokens.
2. **Add spacing between touch targets:** Use `gap-3` (12px) minimum between adjacent interactive elements — not `gap-1` or `gap-2`.
3. **Use `@media (any-pointer: coarse)` to add mobile padding:**
   ```css
   @media (any-pointer: coarse) {
     .btn, .form-input, .form-select { @apply min-h-[48px]; }
   }
   ```
4. **Audit every form page** with Chrome DevTools touch simulation. Check every interactive element's computed dimensions in the "Computed" pane.
5. **For Capacitor Android specifically**, use `@capacitor/device` to detect mobile and conditionally increase touch targets.
6. **Use icon buttons with aria labels** — a 24px icon should have 48px of padding around it (the "extended touch target" pattern from Material Design).

**Warning signs:**
- Touch simulation shows interactive elements <44px computed height
- Field workers report "I keep tapping the wrong button" in user testing
- Form completion takes noticeably longer on mobile vs desktop
- Accidental form submissions or navigation (tapping one button activates an adjacent one)
- Google Play Console warnings about touch target size

**Phase to address:**
Phase 1 (Infrastructure/Foundation) should establish the 48dp minimum. Phase 3 (Role Dashboards + Responsive) should verify each page with touch simulation.

---

### Pitfall 9: Offline-First Loading States That Ignore the Offline Cache

**What goes wrong:**
The app is offline-first with SQLCipher local cache and delta sync. During the loading-state overhaul, developers add loading spinners/skeletons that trigger on every data fetch — even when the data already exists in the local cache. The result:
- A field worker opens the app in a low-connectivity area.
- The app shows a skeleton/loading spinner while SWR tries to revalidate against the server.
- The cached data is ready in IndexedDB but the UI doesn't use it until the server responds (or times out).
- In offline mode, the request eventually fails, and the error state shows — even though perfect cached data was available.
- The user waits 5-10 seconds for data they already have.

**Why it happens:**
- SWR's default behavior is to show `isLoading = true` on initial mount and `isValidating = true` on revalidation. Developers new to SWR check `isLoading` to show loading state, which blocks the cached data display.
- No distinction between "no cache at all" (show skeleton) and "revalidating from server" (show cached data with subtle indicator).
- The offline-first architecture was built for sync (delta sync protocol, version vectors) but the UI layer wasn't adapted to leverage it — the fetcher always calls the API first, cache second.
- The current code uses `useState` + `useEffect` manually for data fetching in most pages — no SWR `useSWR` usage visible in audited pages.

**How to avoid:**
1. **Use SWR consistently** across all data-fetching components (most pages currently use `useState` + `useEffect` manually). SWR's built-in cache provides the stale-while-revalidate pattern.
2. **Distinguish three states:**
   - `isLoading && !data` → initial load with no cache → show skeleton
   - `!isLoading && isValidating` → cache hit, revalidating → show cached data with subtle indicator (small spinner badge, not a skeleton)
   - `!isLoading && error && !data` → no cache AND failed → show error state (not just skeleton)
3. **Use the existing `isOnline()` from `../lib/sync`** to adapt loading behavior: when offline, skip server revalidation and render from cache immediately.
4. **Cache the last successful response in SWR's `fallbackData`** so cold starts still have something to show.
5. **Add a "stale indicator" pattern** — a small colored dot or timestamp showing how old the displayed data is, so field workers know if they're looking at cached data.
6. **Never use `fallback={null}`** in Suspense boundaries without `min-height` on the container — in offline mode, this means the user sees nothing for the entire loading period.

**Warning signs:**
- Opening the app in airplane mode shows a loading spinner instead of data
- Data that was viewed 5 minutes ago re-fetches from scratch when navigating back
- A skeleton appears for data that was already visible 2 seconds ago
- Error state flashes briefly then data appears (server response wins race)
- The app is "offline-first" but the UI shows no data offline

**Phase to address:**
Phase 6 (Loading States). Must coordinate with the existing `offline-queue.ts` and `sync.ts` infrastructure. This requires deeper research into how the existing offline sync layer interacts with SWR caching.

---

### Pitfall 10: `@base-ui/react` vs Radix/shacdn — Unused Dependency That Creates Confusion

**What goes wrong:**
The `package.json` includes `@base-ui/react: ^1.6.0` alongside `@radix-ui/*` packages. Base UI is MUI's headless component library (successor to MUI Base), which has its own API patterns, accessibility model, and theming system. Having both creates:
- Two headless UI libraries being imported for similar purposes
- Confusion about which to use for new components
- Duplicate bundle weight (~25-35KB combined)
- Potential CSS conflicts (Base UI injects inline styles via Emotion)
- Developer confusion: "Should I use Radix Popover or Base UI Popover?"

**Why it happens:**
- Base UI may have been added during an earlier phase as an experiment.
- Both libraries serve similar purposes (headless, accessible primitives) but have fundamentally different theming models.
- Base UI uses CSS-in-JS (Emotion) which bypasses Tailwind layers entirely — its styles always win specificity battles.
- shadcn/ui is built on Radix, not Base UI. The project has already committed to Radix.
- There's no clear migration path from Base UI components to Radix — they'd need manual replacement.

**How to avoid:**
1. **Remove `@base-ui/react` from dependencies** in Phase 1. It's not used by any component in `components/ui/` (only Radix packages are used there).
2. **Verify no imports from Base UI exist** — search `import.*@base-ui` across the codebase. If found, replace with Radix equivalents.
3. **Document the decision** in the project: "All headless UI primitives use Radix UI via shadcn/ui wrappers. No other headless library should be added."
4. **If some Base UI component was relied upon** that Radix doesn't cover (unlikely for this app's needs), create a wrapper component that hides the Base UI import and prevents direct usage.

**Warning signs:**
- `@base-ui/react` remains in `package.json` after Phase 1
- A new component imports from `@base-ui/` instead of `@radix-ui/`
- Bundle shows both Radix and Base UI code in production
- Emotion style tags in the DOM (Base UI's CSS-in-JS) conflicting with Tailwind

**Phase to address:**
Phase 1 (Tooling cleanup). Remove unused dependency before any migration begins.

---

### Pitfall 11: Form Validation Duality — Native HTML Validation vs shadcn Form Patterns

**What goes wrong:**
The existing forms use native HTML5 validation (`required` attribute on inputs, pattern matching, `type="email"`). During the shadcn migration, developers start using shadcn's Form components (which use `react-hook-form` + `zod`). Now there are two validation systems running:
- Native validation shows browser tooltips ("Please fill out this field") in some places
- shadcn Form components show custom error messages in other places
- The existing Zod validation pipeline (already on the server) isn't mirrored on the client
- Error styling is inconsistent: some forms use `.error-msg` class, others use inline Tailwind, others use shadcn `FormMessage`
- Form submission behavior differs between native and controlled forms

**Why it happens:**
- shadcn's recommended form setup uses `react-hook-form` + `zod` resolver.
- The existing IntakePage has client-side validation logic inline (checking consent, checking required fields) but no Zod schema on the client.
- The server already uses Zod for API validation — but the same schemas aren't shared with the client.
- `react-hook-form` captures `onSubmit` with controlled inputs; native forms use `onSubmit` on the `<form>` element — mixing patterns in the same codebase is confusing.
- The LoginPage currently uses plain form with `useState` — native validation with custom error display.

**How to avoid:**
1. **Adopt `react-hook-form` + `@hookform/resolvers/zod`** as the standard form pattern for all new and migrated forms. This lets you share Zod schemas between client and server (DRY validation).
2. **Migrate existing forms in a defined order:** IntakePage → InterventionPage → LoginPage → then all other forms. Each migration replaces both the validation logic AND the form UI simultaneously.
3. **Disable native validation** on migrated forms with `novalidate` on the `<form>` element — this prevents the split between browser tooltips and custom errors.
4. **Use Zod for both client and server** — define the schemas in a shared package and import them on both sides. This prevents divergence where client and server have different validation rules.
5. **Do NOT run native validation and react-hook-form simultaneously on the same form.**

**Warning signs:**
- A form shows both browser validation tooltips AND custom error messages
- The same form field validates differently on client vs server
- `novalidate` is missing on forms using react-hook-form
- Forms submit successfully on client but fail server Zod validation
- Some forms use `required` attribute while others use Zod `z.string().min(1)`

**Phase to address:**
Phase 3 (Form Migration + Core Pages). Form validation is a cross-cutting concern. Set the standard early so all forms follow the same pattern.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Add `!important` to fix a style conflict** | Quick visible fix | Creates specificity arms race; every future override needs `!important` too | Never. Fix the CSS layer order instead. |
| **Keep `@base-ui/react` installed but unused** | Avoids the 30s of work to uninstall | 25-35KB bloat in production bundle; developer confusion about which library to use; potential security surface | Never — remove unused dependencies immediately. |
| **Use framer-motion for "just a few" animations** | Quick, declarative animation API | 34KB+ bundle cost; main-thread JS execution per frame; battery drain on mobile | Only if animation requires physics/gestures that CSS can't do. For this app, likely never. |
| **Show skeleton on every `isLoading` (including SWR revalidation)** | Simple loading state logic | Triple flicker for cached data; users wait for data they already have | Only when `isLoading && !data` (no cache available for initial load). |
| **Port CSS component classes as `@apply` blocks** | Quick migration | Creates hard-to-debug CSS layers; `@apply` behaves differently in different contexts | Only for third-party/CMS rendered markup that can't be annotated with classes. |
| **Skip form validation migration = keep native validation** | No work needed | Two validation systems running simultaneously; inconsistent UX | Not acceptable for this milestone — unified validation is a stated goal. |
| **Add `print:hidden` after everything is built** | Delays print work | Creates pattern conflicts (`.no-print` vs `print:hidden`); hard to trace when elements appear in print | Acceptable only if you ship print styles in a separate CSS layer that overrides everything. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **shadcn Button + existing `.btn-primary`** | Using both classes on the same element — specificity tug-of-war | Use shadcn Button exclusively for new components; map legacy `.btn-primary` to `<Button variant="default">` |
| **Radix Select + HTML `<form>`** | Radix Select.Trigger doesn't render native `<select>`, so forms don't capture its value | Use native `<select>` styled with Tailwind for form fields; reserve Radix Select for non-form pickers. Or add hidden `<input>` synced to Select value. |
| **Tailwind `print:` variant + Safari 18.5** | print:hidden doesn't work in dev mode on Safari | Always test print in production builds; use fallback `.no-print` class for Safari until WebKit fix ships |
| **SWR + offline cache (SQLCipher/SQLite)** | SWR fetcher always calls API URL first — fails offline | Override SWR fetcher to read from local indexDB/SQLite when `isOnline()` returns false |
| **Zod schemas + client vs server** | Duplicating schemas on both sides; they diverge over time | Share Zod schemas via a `shared` workspace package; import the same schema on client and server |
| **Capacitor WebView + 48dp touch targets** | Touch targets sized for desktop work fine on desktop but fail on Android WebView | Use `@media (any-pointer: coarse)` to increase padding; test on real Android devices |
| **Radix Dialog + print styles** | Modal/dialog content appears in print output | Add `print:hidden` to all Radix portal-based components at the layout level |
| **Tailwind CSS v3 `tailwind.config.js` + v4 `@theme` migration** | Partial migration where some tokens in JS config and some in CSS `@theme` | Pick one approach. The project currently uses v3 (`tailwind.config.ts`) — stick with v3 for this milestone unless you budget for a v4 migration. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Framer motion for micro-interactions** | +34KB bundle, +180ms TBT on mobile, battery drain | CSS transitions + IntersectionObserver; use WAAPI as fallback | Immediately on install — every visitor pays the 34KB tax |
| **Skeleton flash (showing skeleton when cached data exists)** | skeleton → cached data → skeleton → fresh data; CLS spikes | Check `!isLoading && data` before showing skeleton; use SWR's `keepPreviousData` | Every offline/disconnected session — which is the primary use case |
| **Single Suspense boundary for multiple data sources** | Content appears, disappears, appears again; INP spikes | Separate Suspense boundaries per independent data source | Any page with 2+ async data sources (dashboard, admin page, beneficiary view) |
| **Unused CSS from legacy classes** | CSS bundle includes styles for classes that no longer exist after migration | Regular `purgecss` audit; remove legacy CSS layer when all pages are migrated | After migration — legacy CSS may linger for months bloating the bundle |
| **Inline SVG icons + lucide-react** | Large inline SVG bloat if lucide icons are imported individually without tree-shaking | Use tree-shakeable imports (`import { User } from 'lucide-react'`) | Scales linearly with icon count — currently ~15 icon imports in Layout alone |
| **Multiple headless UI libraries (Radix + Base UI)** | 25-35KB duplicate framework code in bundle | Remove `@base-ui/react` | Immediately — every visitor pays for unused code |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Inconsistent button styles during migration** | Some pages use shadcn buttons, others use legacy `.btn-primary` — user confusion about which is clickable | Migrate page by page, not component by component. Commit to a full page in one pass. |
| **"Wrong role" redirect goes to blank `/`** | Role-authorized user is redirected to empty page with no explanation | Redirect to `/unauthorized` with explanation and "Go to my dashboard" link |
| **Login page shows sidebar layout flash** | Brief moment of dashboard layout before redirect to login | Render login page in a separate layout route that never mounts the sidebar |
| **Loading state shows for data already in cache** | Users wait for data they already have, especially offline | Use SWR cache-first + stale-while-revalidate; only show skeletons for cold loads |
| **Print button prints all dashboard chrome** | User wants to print a report but gets nav, sidebar, and notifications included | Add `print:hidden` to layout chrome at the Layout component level |
| **Touch targets too small on mobile** | Field workers accidentally tap wrong form field/button multiple times | Minimum 48dp touch targets; `gap-3` between interactive elements |
| **No empty states** | A table with 0 results shows only headers — confusing | Show meaningful empty state with suggested action ("No cases found. Start a new intake.") |
| **Error messages use legacy `.error-msg` class** | Inconsistent error styling — some errors use the legacy class, others use inline Tailwind | Standardize on shadcn `Alert` with `variant="destructive"` for all error messages |
| **No reduced-motion support** | Animations can't be disabled, causing discomfort for vestibular disorder users | Add `prefers-reduced-motion` media query; pause shimmer animations |

---

## "Looks Done But Isn't" Checklist

- [ ] **Button migration:** All buttons use `<Button>` from shadcn — no remaining `className="btn btn-primary"` in any page
- [ ] **Form inputs:** All inputs use shadcn `Input` with proper label association — no remaining `className="form-input"` or `className="form-select"`
- [ ] **Tables:** All data tables use proper responsive patterns — no remaining `className="table"`, `table-wrapper`, `pagination` classes
- [ ] **CSS cleanup:** `index.css` only contains design tokens and `@layer base` resets — no component-specific classes
- [ ] **Page imports:** No page imports `index.css` individually — CSS is imported once at the app entry
- [ ] **Bundle size:** No `framer-motion` or `@base-ui/react` in the production bundle
- [ ] **Touch targets:** Every interactive element has at least 48px height in mobile viewport
- [ ] **Loading states:** Every data-fetching component handles 4 states (loading, error, empty, success)
- [ ] **Offline loading:** Offline mode shows cached data immediately without blocking on network requests
- [ ] **Form validation:** All forms use a single validation system (react-hook-form + Zod) — no mixing with native validation
- [ ] **Print styles:** All layout chrome (nav, sidebar, notifications) is hidden in print; content pages output clean A4
- [ ] **Safari print:** Print output tested in production build (not dev mode) on Safari
- [ ] **Role routing:** All 6 roles reach the correct dashboard without redirect flash
- [ ] **Radix form compatibility:** All form controls pass values through `FormData` — hidden `<input>` added for Radix controls that don't render native elements
- [ ] **Accessibility:** Keyboard navigation tested on all new Radix components; screen reader tested on 3 critical flows
- [ ] **Reduced motion:** Animations respect `prefers-reduced-motion`
- [ ] **Raw hex values:** No `#RRGGBB` colors in component files — all colors use CSS custom properties

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **CSS specificity war (Pitfall 1)** | HIGH — requires auditing every page for leftover class conflicts and potential visual regression | 1. Create `@layer legacy` for all old CSS. 2. Run screenshot diffs before/after. 3. Remove legacy layer page by page as components are confirmed migrated. |
| **Framer motion already installed (Pitfall 3)** | MEDIUM — uninstall + replace with CSS transitions | 1. Uninstall with `npm uninstall framer-motion`. 2. Replace `motion.div` with `<div>` + CSS transitions. 3. Replace `AnimatePresence` with CSS `@starting-style` or `transition` on mount. 4. Verify visual parity. |
| **Skeleton flash already implemented (Pitfall 7)** | MEDIUM — refactor loading state logic per page | 1. Identify which pages use `isLoading` unconditionally. 2. Add `!isLoading && data` cache-awareness. 3. Replace monolithic Suspense boundaries with per-section boundaries. |
| **Routing complexity (Pitfall 6)** | HIGH (if already deeply nested) | 1. Map all current routes. 2. Restructure into PublicLayout + AuthLayout + AppLayout. 3. Test every role's navigation paths. 4. Roll out new router config with feature-flag toggle for fallback. |
| **Radix form incompatibility (Pitfall 9)** | MEDIUM — per-component workaround | 1. Audit which Radix components are used in forms. 2. Add hidden `<input>` elements synced to Radix state for each. 3. Or replace with native HTML equivalents wrapped in shadcn-style Tailwind. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CSS specificity war | Phase 1 (Token System) | Audit: `grep -c "btn\|table\|form-input\|form-select\|pagination" src/pages/*.tsx` shows 0 after migration |
| Design token silo | Phase 1 (Token System) | Test: change `--primary` in CSS, all primary buttons update |
| framer-motion bloat | Phase 1 (Tooling) | Check: `package.json` has no `framer-motion`; bundle analyzer shows 0KB animation JS |
| A11y regressions | Phase 4 (Accessibility) | Test: VoiceOver through 3 critical flows; axe-core audit passes |
| Print conflicts | Phase 6 (Print + Polish) | Visual: `window.print()` preview shows content-only on 5 page types |
| Routing fragmentation | Phase 2 (Public Pages) | Test: Each role lands on correct dashboard; unauthenticated users see public pages |
| Skeleton flash | Phase 6 (Loading States) | Measure: Lighthouse CLS < 0.1; no "skeleton → content → skeleton" sequence |
| Touch targets <48px | Phase 1 (Foundation) | Audit: Chrome DevTools touch simulation of every interactive element |
| Offline loading ignores cache | Phase 6 (Loading States) | Test: airplane mode shows cached data within 200ms |
| `@base-ui/react` confusion | Phase 1 (Cleanup) | Check: `grep -r "@base-ui" src/` returns 0 results |
| Form validation duality | Phase 3 (Core Pages) | Test: same Zod schema validates client and server for Intake form |

---

## Sources

- **shadcn/ui GitHub Discussions #9754** — Best practices for customizing shadcn-ui with Tailwind CSS; CSS layers, prefix, and conflict mitigation strategies. Confidence: HIGH.
- **shadcn/ui GitHub Issue #6577** — Documented bug where shadcn CSS takes precedence over custom styles in production builds. Confidence: HIGH.
- **TailwindCSS GitHub Discussion #18108** — Multiple theme tokens on the same page; `@theme inline` and `postcss` plugin workarounds. Confidence: MEDIUM.
- **CSS migration guide — llmbestpractices.com** — Token extraction patterns, component-by-component migration strategy, `@theme` naming conventions. Confidence: HIGH.
- **"The Tailwind v4 CSS Rule That Silently Overrides Your Utilities"** (Medium, Ayomide Kayode) — Detailed post-mortem of CSS cascade layer conflicts during brownfield Tailwind migration. Confidence: HIGH.
- **Troubleshooting shadcn/ui — eastondev.com** — Style conflicts between shadcn and existing MUI; config backup recommendations. Confidence: HIGH.
- **Framer Motion bundle reduction guide — motion.dev** — Official size breakdown of `motion` (34kb) vs `m`+`LazyMotion` (4.6kb). Confidence: HIGH.
- **"I Evicted Framer Motion" — dev.to/sumorai** — Real-world case study: 27% bundle reduction, 17-point Lighthouse improvement, replacing with CSS transitions + IntersectionObserver. Confidence: HIGH.
- **Capacitor App Animation Performance Guide — capgo.app** — WAAPI recommendation for WebView animations; battery drain concerns on mobile. Confidence: HIGH.
- **Radix UI Accessibility — radix-ui.com** — Official documentation on WAI-ARIA compliance. Confidence: HIGH.
- **Radix Checkbox form issue #2530** — Known bug: Checkbox doesn't render `<input>` form element; PR #3161 partially addresses. Confidence: HIGH.
- **Radix Select a11y issue #3294** — Known bug: `id` isn't forwarded to hidden `<select>`, breaks label association. Confidence: HIGH.
- **Radix Form integration issue #2659** — Radix Form can't compose with other Radix primitives (Checkbox, Select). No timeline. Confidence: HIGH.
- **Tailwind Print Variant — tailwindcss PR #5885** — Print variant implementation details. Confidence: HIGH.
- **Tailwind Safari print issue #18699** — Safari 18.5 regression where `print:` variant fails in dev mode; WebKit fix in progress. Confidence: HIGH.
- **"How to style for print in Tailwind" — andreasbergstrom.dev** — Print variant patterns, page breaks, `print-color-adjust`. Confidence: HIGH.
- **WCAG 2.5.5 Target Size (Enhanced) — w3.org** — 44x44 CSS pixel minimum touch target specification. Confidence: HIGH.
- **WCAG 2.5.8 Target Size (Minimum) — w3.org** — 24x24 with spacing alternative minimum. Confidence: HIGH.
- **Accessible Tap Targets — web.dev** — 48px recommendation, pointer coarse media query patterns. Confidence: HIGH.
- **Android Accessibility — Touch Target Size** — Google's 48dp recommendation with 8dp spacing. Confidence: HIGH.
- **React Suspense + SWR + Skeleton — Medium/Rafael Mariano** — Cached data re-use vs skeleton flash patterns. Confidence: MEDIUM.
- **"Building Effective React Skeleton Loading UIs" — asoasis.tech** — Skeleton design best practices, reduced motion support, CLS prevention. Confidence: HIGH.
- **Data-fetching components handle loading, success, error, and empty states — AuditBuffet** — Four-state handling pattern; CWE-703 reference for missing error states. Confidence: HIGH.
- **React Router v7 authorization guide — WorkOS** — Layout route + child action security gap; redirect patterns. Confidence: HIGH.
- **OpenCode Kapwa codebase analysis** — Inventory of legacy classes, CSS imports, current loading patterns across 24 pages. Confidence: HIGH.

---

*Pitfalls research for: Kapwa v1.1 UI/UX Overhaul — brownfield shadcn/Tailwind migration*
*Researched: 2026-06-27*
