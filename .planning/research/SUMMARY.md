# Project Research Summary

**Project:** Kapwa — MSWDO Norzagaray (v1.1 UI/UX Overhaul)
**Domain:** Government Social Welfare Management System (Brownfield React SPA → shadcn)
**Researched:** 2026-06-27
**Confidence:** HIGH

## Executive Summary

Kapwa is a brownfield React 18 SPA for MSWDO Norzagaray — an offline-first PWA with Capacitor 6, serving 6 user roles (social workers, admins, coordinators, claimants, mayor, auditor) across ~28 pages of case management workflows. The v1.1 UI/UX Overhaul aims to bring the frontend to production-ready quality through a unified shadcn/ui design system, responsive/mobile layouts, loading/empty/error states on every page, accessibility improvements, public-facing pages, and print styles for government reports.

**The recommended approach is a 6-phase incremental migration:** (1) Foundation — design token system, CSS layer cleanup, layout extraction, route restructuring; (2) Component Library — install missing shadcn components, build shared page-state components (PageShell, PageLoader, EmptyState, ErrorDisplay); (3) Mobile & Responsive — mobile sidebar, responsive tables, touch-friendly controls; (4) Page Polish — migrate pages individually to shadcn, add loading/empty/error states, adopt SWR; (5) Print & Accessibility — print stylesheets, keyboard/screen-reader/contrast audit; (6) Polish & Edge Cases — page transitions, command palette, final a11y pass. Do NOT attempt to migrate everything at once — CSS specificity wars and inconsistent states will compound.

**Key risks:** CSS specificity war between legacy `.btn/.form-input/.table` classes and new shadcn/Tailwind utilities (mitigated by explicit `@layer legacy` and removing per-page CSS imports); PWA bundle bloat from animation libraries (avoid framer-motion entirely, use `motion/react` with `LazyMotion` for ~15kb gzipped or CSS transitions for micro-interactions); accessibility regressions when replacing native HTML form elements with Radix primitives (reserve Radix Select/Checkbox for non-form use, use native `<select>`/`<input>` styled with Tailwind for data forms); offline loading states that ignore the existing SQLCipher cache (use SWR with cache-first + stale-while-revalidate instead of showing skeletons on revalidation).

## Key Findings

### Recommended Stack (Additions Only)

The existing stack (React 18 + Vite + Tailwind CSS v3 + shadcn partial + Capacitor 6 PWA + SWR) is sound. The overhaul needs **five targeted additions** — no framework migration:

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `motion/react` (NOT framer-motion) | ^12.42 | Declarative animations, gestures, layout/exit animations | Renamed framer-motion; `LazyMotion` + `domAnimation` = ~15kb gzipped, off critical path |
| `react-hook-form` + `zod` + `@hookform/resolvers` | ^7.54 / ^4.4 / ^5.0 | Form state management + validation | Zod already on backend — share schemas for DRY validation; RHF is 9kb, shadcn-standard |
| `sonner` | ^2.0.7 | Toast notifications | ~5kb, accessible, shadcn-standard; higher-level than Radix Toast primitive |
| shadcn CLI components | via CLI | Dialog, Sheet, DropdownMenu, Skeleton, Table, Tabs, etc. | Auto-installs Radix deps; no manual npm install for radix packages |
| CSS `@media print` | N/A | Report/access card print formatting | Zero bundle cost; dedicated `print.css` loaded via `media="print"` |

**Critical decisions:**
- **Do NOT install** `framer-motion`, `@base-ui/react` (remove existing, ~5.4MB unpacked unused), `vaul` (unmaintained), `cmdk` (defer), `react-spring`, GSAP, zustand/jotai, or any focus-trap libraries
- **Use `LazyMotion` + `m`** from `motion/react` for animation — keeps animation off critical path; CSS transitions for micro-interactions (hover, focus, skeleton shimmer)
- **Remove `@base-ui/react`** from dependencies — unused, conflicts with Radix/Tailwind, 5.4MB unpacked
- Bundle impact of all additions: ~50kb gzipped total, bringing PWA to ~190kb — acceptable with route-level code splitting

### Expected Features

**Must have (table stakes for v1.1):**
- **Design Token System** — Foundation: CSS custom properties for government palette (Phil. blue #0038A8, gold #FCD116), dark mode `.dark` overrides, sidebar tokens
- **Hero/Landing Page** — Public-facing: mission, programs, how-to-apply, login CTA; offline-cached
- **Auth Page Migration** — shadcn-ified login with role-aware redirect
- **Dashboard Shell** — Extracted shadcn Sidebar + Topbar + ContentArea with ARIA landmarks, collapsible, role-filtered nav
- **Loading Skeleton States** — shadcn Skeleton with matching dimensions; 4-per-page (table, card, form, metric)
- **Empty State Placeholders** — 4 variants: no data, no results, offline, no access
- **Error Boundaries** — Two-layer: top-level + per-route `errorElement`; RouteErrorBoundary with retry
- **Toast Notifications** — Sonner for all CRUD feedback; `toast.promise()` pattern for async
- **Modal Dialogs** — AlertDialog for confirmations, Dialog for inline creation, Sheet for mobile panels
- **Responsive Data Tables** — TanStack Table v8 + shadcn DataTable; sort/filter/paginate on beneficiaries, cases, interventions
- **Print Styles** — CSS `@media print` for CSR, Access Card, case reports; dedicated `print.css` per report type
- **Mobile Navigation** — Bottom tab bar for field workers on phones; Sheet for secondary nav

**Should have (deferred to v1.2+):**
- Role-Specific Dashboards (requires user feedback on KPIs)
- Consent-Aware UI Masking (requires ABAC stability in production)
- Bulk Action Toolbar (requires data tables to be proven)
- Offline Queue Dashboard (enhanced sync visibility)
- Compliance Badges & SLA Timers
- Field Worker Quick Actions (bottom sheet shortcuts)

**Defer (v2+):**
- Dark Mode (feature-driven, not proactive)
- Full WCAG 2.1 AA Audit (after UI is stable)
- Server-Side PDF Export (only if digital signatures required)
- Advanced Chart Dashboards

### Architecture Approach

**Target: Route-level code splitting + extracted layout components + two-layer error handling + shared page-state components + SWR data fetching.** The current monolithic 182-line `Layout.tsx` and 24 eagerly-loaded pages are replaced with a clean layout route pattern. The shell component (Sidebar + Topbar) renders once and never unmounts — only the `<Outlet />` content changes. Each of the 24 pages becomes a `lazy(() => import(...))` chunk, code-split by route. A `createBrowserRouter` layout route wraps authenticated pages with `ProtectedRoute` → `RouteErrorBoundary` → `LayoutShell`. Public pages (landing, about, login) sit in a separate route group with no layout shell.

**Major architectural changes:**

1. **Route restructuring** — Split into PUBLIC routes (landing, about, login — no layout, no auth) and APP SHELL route (auth + layout + lazy children). Landing page at `/` checks auth token, redirects authenticated users to `/dashboard`.
2. **Layout extraction** — Monolithic `Layout.tsx` → `components/layout/` directory with 10 focused files: `LayoutShell`, `Topbar`, `Sidebar`, `SidebarNav`, `ContentArea`, `Breadcrumbs`, `UserMenu`, `SkipToContent`, `MobileNav`, `OfflineBanner`.
3. **Two-layer error handling** — Top-level `ErrorBoundary` (catches unhandled crashes, minimal fallback) + Route-level `errorElement` (catches per-route errors, preserves layout shell, shows retry button). RouteErrorBoundary handles 404/403/500/crash with distinct `ErrorDisplay` variants.
4. **Shared page-state components** — Every page follows `PageShell` → `PageLoader` (loading) / `EmptyState` (empty) / `ErrorDisplay` (error) / content (success) — consistent pattern eliminates 360+ lines of duplicated fetch logic across 24 pages.
5. **SWR adoption** — Already in dependencies, unused in most pages. Replace manual `useState`+`useEffect`+`try/catch` with `useSWR` for deduplication, caching, refetch-on-focus, and pagination via `useSWRInfinite`.

### Critical Pitfalls

1. **CSS specificity war (Phase 1 critical)** — Legacy `.btn/.form-input/.table` classes in `@layer components` conflict with shadcn/Tailwind utilities. **Prevention:** Move all legacy CSS to `@layer legacy` block FIRST; remove per-page `../index.css` imports; enforce `cn()` usage; ban `!important`. Track migration progress numerically.

2. **PWA bundle bloat from animation library (Phase 1 tooling gate)** — framer-motion adds ~34kb gzipped + 180ms TBT on mobile. **Prevention:** Ban framer-motion from `package.json` explicitly. Use CSS transitions for micro-interactions. If JS animation needed, use `motion/react` with `LazyMotion` + `domAnimation` at ~15kb. Set 0kb animation JS budget and increase only if CSS proves insufficient.

3. **Accessibility regressions with Radix form controls (cross-phase)** — Radix Select/Checkbox don't render native `<input>`/`<select>` elements, breaking `FormData`, label association (Radix bug #3294), and form submission (bug #2530). **Prevention:** Use native `<select>`/`<input>` styled with Tailwind for data forms; reserve Radix primitives for Dialogs, Tabs, DropdownMenus where ARIA model is better; add hidden `<input>` elements synced to Radix state when unavoidable; test 3 critical flows with VoiceOver/TalkBack.

4. **Offline loading ignores local cache (Phase 6)** — Showing skeletons while SWR revalidates wastes field worker time — cached data is ready in IndexedDB. **Prevention:** Check `isLoading && !data` for skeleton (cold load only); use SWR's built-in stale-while-revalidate for cache-hit scenarios; add subtle sync indicator instead of full skeleton during revalidation; integrate with existing `isOnline()` from sync layer.

5. **Routing fragmentation with 6 roles + public pages (Phase 2)** — Mixing public, auth, and role-gated routes in flat router config causes flash-of-wrong-content and blank redirects. **Prevention:** Use `createBrowserRouter` with nested layout routes (PublicLayout → AuthLayout → AppLayout); move auth check from `useEffect` to layout component for synchronous redirect; redirect wrong-role to `/unauthorized` (not `/`); define route tree in single `routes.tsx`.

## Implications for Roadmap

### Suggested Phase Structure

Based on combined research (dependencies from FEATURES.md, build order from ARCHITECTURE.md, prevention phases from PITFALLS.md):

#### Phase 1: Foundation & Design Token System
**Rationale:** Every UI feature depends on design tokens and CSS layer architecture. Must come first to prevent specificity wars and token silo issues. The Layer architecture decision determines every subsequent component's visual correctness.
**Delivers:**
- Design token system (`:root` + `.dark` CSS variables, sidebar tokens, hex → token mapping)
- CSS cleanup: move legacy classes to `@layer legacy`, remove per-page CSS imports
- Route restructuring: Public routes + App Shell with lazy loading + `errorElement`
- Layout extraction: `LayoutShell`, `Topbar`, `Sidebar`, `SkipToContent`, `OfflineBanner`
- Route-level error boundaries (`RouteErrorBoundary`)
- Tooling: install all shadcn CLI components, `motion/react`, `react-hook-form`, `zod`, `sonner`
- Remove `@base-ui/react` and any other unused deps
- Accessibility foundation: ARIA landmarks, SkipToContent, 48dp touch target minimum established
**Addresses FEATURES:** Design Token System (P1), Dashboard Shell parts (P1), Error Boundaries (P1)
**Avoids PITFALLS:** #1 (CSS specificity war), #2 (token silo), #3 (framer-motion bloat), #8 (touch targets), #10 (@base-ui/react)
**Research flag:** LOW — well-documented patterns (shadcn theming, Tailwind layers, React Router layout routes)
**Dependencies:** shadcn CLI configured (`components.json` verified), existing app builds without error

#### Phase 2: Component Library & Shared Page-State Components
**Rationale:** Build the toolkit before using it. shadcn components installed via CLI (auto-installs Radix deps), then build shared page-state components that every page will use. Verify existing UI components are untouched.
**Delivers:**
- All missing shadcn components installed (skeleton, sheet, dialog, alert-dialog, dropdown-menu, tooltip, select, table, tabs, breadcrumb, scroll-area, command, navigation-menu, progress)
- `PageShell.tsx` — consistent page title/description/actions wrapper
- `PageLoader.tsx` — skeleton loading with `useDelayedFallback` (300ms delay before showing)
- `EmptyState.tsx` — 4 variants (no data, no results, offline, no access)
- `ErrorDisplay.tsx` — 4 variants (404, 403, 500, crash) with retry/back actions
- Layout polish: `UserMenu` (DropdownMenu), `Breadcrumbs`, Sidebar styled with shadcn
- Theme toggle (light/dark) in UserMenu
- Print stylesheet foundation (base `print.css` loaded via `media="print"`)
**Addresses FEATURES:** Loading Skeletons (P1), Empty States (P1), Modal Dialogs (P1), Toast Notifications (Sonner setup)
**Avoids PITFALLS:** #11 (form validation duality — establish react-hook-form+zod pattern)
**Research flag:** LOW — shadcn CLI is mature, well-documented
**Dependencies:** Phase 1 complete (tokens exist, imports cleaned)

#### Phase 3: Landing Page & Auth Flow
**Rationale:** Public-facing entry point and auth flow are needed before app pages. They exist outside the authenticated layout shell and have no dependency on internal page structure. Can be built in parallel with Phase 2 but functionally separate.
**Delivers:**
- Landing page (`/`) with hero, programs overview, how-to-apply, login CTA — checks auth token, redirects authenticated users to `/dashboard`
- About page (`/about`)
- Auth page migration: shadcn-ified LoginPage with role-aware post-login redirect
- Auth layout route with proper redirect (wrong-role → `/unauthorized`, not `/`)
- Auth page no longer mounts dashboard layout (eliminates flash-of-layout)
**Addresses FEATURES:** Landing/Hero Page (P1), Auth Page Migration (P1)
**Avoids PITFALLS:** #6 (routing fragmentation), #11 (form validation on login form)
**Research flag:** LOW — standard patterns, landing page is static content + role redirect
**Dependencies:** Phase 1 token system, existing auth infrastructure (JWT, roles)

#### Phase 4: Mobile & Responsive Architecture
**Rationale:** Mobile nav (bottom tabs, Sheet sidebar) depends on Phase 2 component library. Responsive data tables depend on Phase 2 shadcn Table + TanStack Table setup. Mobile-first patterns need the component structure to be stable.
**Delivers:**
- Mobile sidebar via Sheet component (hamburger → slide-in panel)
- Bottom tab nav for mobile (`MobileNav.tsx` — Dashboard, Cases, Beneficiaries, Profile)
- Responsive data tables: horizontal scroll + sticky first column on desktop, stacked card view on mobile, pagination
- Touch-friendly form controls (`min-h-[48px]`, `gap-3` between targets, `@media (pointer: coarse)` overrides)
- Offline indicator as bottom sheet (not fixed top banner)
- `use-media-query.ts` hook for breakpoint detection
**Addresses FEATURES:** Mobile Navigation (P1), Responsive Data Tables (P1), Offline-Aware UI (enhanced)
**Avoids PITFALLS:** #8 (touch targets below 48px)
**Research flag:** MEDIUM — TanStack Table + shadcn DataTable integration needs careful setup; mobile Sheet + bottom tab coexistence pattern
**Dependencies:** Phase 2 component library (shadcn Sheet, Table), Phase 1 token system

#### Phase 5: Page Polish — Migrate Legacy Pages to shadcn
**Rationale:** Each page migration replaces legacy CSS classes with shadcn components AND adds loading/empty/error states AND adopts SWR data fetching. Must come after component library exists but before print/a11y audit (which checks correctness of final structure).
**Delivers for EACH of 24 pages:**
- Replace `.table` → `<Table>`, `.form-input` → `<Input>`, `.btn` → `<Button variant>`, `.badge-*` → `<Badge variant>`, `.card` → `<Card>`, `.page-header/.page-title` → `<PageShell>`
- Add `PageShell` + `PageLoader` + `EmptyState` + `ErrorDisplay` wrappers
- Adopt SWR data fetching (migrate from `useState`+`useEffect`)
- Dark mode verification (page looks correct in both light and dark)
- Responsive pass per page (test on 360px viewport)
- Remove legacy class usage per page (track progress via grep audit)
**Primary targets (in order):** DashboardPage → LoginPage → IntakePage → CasesPage → BeneficiariesPage → then remaining 19 pages
**Addresses FEATURES:** All pages get shadcn UI + proper states (pervades entire milestone)
**Avoids PITFALLS:** #11 (form validation — migrate IntakePage first as pattern), #2 (token silo — enforce no-new-hex rule)
**Research flag:** MEDIUM — IntakePage is heaviest form (~40kb chunk); SWR migration needs per-page assessment of existing fetch logic; Zod schema sharing requires identifying shared package pattern
**Dependencies:** Phase 2 component library, Phase 1 tokens, Phase 3 auth flow

#### Phase 6: Print Styles & Accessibility Audit
**Rationale:** Print depends on final component structure (can't print what hasn't been migrated yet). Accessibility audit should happen after all UI is stable to avoid re-auditing after changes.
**Delivers:**
- `src/styles/print.css` — global print reset (hide nav/sidebar/buttons, A4 portrait, proper margins)
- Per-report print layouts: Access Card (54mm x 86mm), CSR, IRF, Access Card service record
- Print preview button on report/card pages
- Accessibility audit checklist:
  - Keyboard navigation — all interactive elements reachable, no focus traps
  - Screen reader test — VoiceOver on 3 critical flows (login, intake, case list)
  - Color contrast — WCAG AA (4.5:1 text, 3:1 large text)
  - Focus management in modals, dropdowns, sheets
  - Reduced motion — `prefers-reduced-motion` respected
- Safari print testing (dev-mode print variant bug — test in production build only)
**Addresses FEATURES:** Print-Styled Reports (P1), Accessibility Improvements (P1)
**Avoids PITFALLS:** #4 (a11y regressions), #5 (print conflicts with shadcn/Tailwind)
**Research flag:** MEDIUM — Radix accessibility nuances (bugs #2530, #3294); Safari print regression (WebKit #18699); each needs targeted testing
**Dependencies:** Phase 5 complete (all pages finalized), Phase 2 component library stable

#### Phase 7: Polish & Edge Cases
**Rationale:** Lowest priority — page transitions, command palette, keyboard shortcuts. Only after all functional UI is correct.
**Delivers:**
- Optional page transitions via `motion/react` `AnimatePresence` (if time permits)
- Command palette (Ctrl+K) for power users
- Keyboard shortcuts for common actions
- Final "Looks Done But Isn't" checklist verification from PITFALLS.md (17-item checklist)
**Addresses FEATURES:** None on P1 list — pure polish
**Avoids PITFALLS:** All 11 pitfalls have prevention checkpoints in this phase's checklist
**Research flag:** HIGH — cmdk library assessment (currently deferred due to 80kb unpacked); page transition impact on Capacitor performance unknown
**Dependencies:** All 6 prior phases complete

### Phase Ordering Rationale

- **Foundation-first:** Every feature depends on design tokens + CSS layer architecture. Building Phase 1 first prevents the CSS specificity war (Pitfall #1) from compounding across every subsequent phase.
- **Component library before pages:** Installing all shadcn components and building shared page-state components in Phase 2 means every page migration (Phase 5) reaches for ready-made components instead of building ad-hoc — prevents the inconsistent-state problem where some pages look done and others look broken.
- **Mobile after components, before polish:** Mobile nav and responsive tables need the shadcn component library (Sheet, Table) but don't need every page migrated yet. Phase 4 can be done in parallel with Phase 5 start.
- **Print and a11y last:** Print styles depend on the final component structure. Accessibility audit should happen against stable UI to avoid re-auditing after changes.
- **Polish last:** Page transitions and command palette are optional enhancements — they don't block any core feature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Mobile/Responsive):** TanStack Table v8 + shadcn DataTable responsive pattern — the stacked-card-on-mobile approach needs prototype validation; bottom tab nav + Sheet coexistence on mobile needs UX confirmation
- **Phase 5 (Page Polish):** SWR migration strategy per-page — some pages have complex fetch logic that may need more than a simple `useSWR` wrapper; Zod schema sharing pattern between client and server needs architectural decision on shared package location
- **Phase 6 (Print/A11y):** Radix a11y bugs (#2530 Checkbox form value, #3294 Select label association) need targeted testing per component; Safari 18.5 print variant regression (WebKit #18699) needs production-build-only testing workflow
- **Phase 7 (Polish):** cmdk package weight assessment (80kb unpacked at last check); page transition animation impact on Capacitor WebView performance

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** shadcn theming, Tailwind layers, React Router layout routes — all well-documented, established patterns
- **Phase 2 (Component Library):** shadcn CLI is mature with clear docs; PageShell/PageLoader/EmptyState/ErrorDisplay are standard React component patterns
- **Phase 3 (Landing/Auth):** Static landing page with auth redirect is a common pattern — straightforward

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm registry, official docs (motion.dev, radix-ui.com), and existing package.json audit. All recommended libraries are mature, actively maintained. |
| Features | HIGH | Based on Gov.UK design standards, shadcn best practices, dashboard design patterns research, and direct codebase inventory of existing components. Feature dependencies mapped and verified. |
| Architecture | HIGH | Based on official shadcn theming docs, React Router v6 data router patterns, SWR documentation, and direct codebase analysis of routes/layout/pages. Build order validated against feature dependencies. |
| Pitfalls | HIGH | Each pitfall sourced from official library issues (Radix #2530, #3294, Tailwind #18699), migration case studies, WCAG specifications, and direct codebase audit. Prevention strategies are concrete and phase-mapped. |

**Overall confidence:** HIGH

### Gaps to Address

- **Zod schema sharing pattern** — The research recommends sharing Zod schemas between client and server for DRY validation, but the shared package location and import mechanism aren't specified. Needs architectural decision: separate `shared` workspace package, or extract schemas from NestJS modules into a frontend-consumable format.
- **TanStack Table v8 + shadcn DataTable responsive mobile pattern** — The stacked-card-on-mobile approach is recommended but not validated against TanStack Table v8's specific API. Needs `@tanstack/react-table` version check and prototype of the responsive table component.
- **SWR migration ordering** — 24 pages use varying patterns of `useState`+`useEffect` for data fetching. A specific migration order based on complexity (simpler pages first, IntakePage last) needs to be determined during Phase 5 planning.
- **Safari + Capacitor WebView differences** — Print regression (Safari 18.5) and animation performance (Capacitor WebView) may behave differently from Chrome-based testing. Need a test matrix that covers Chrome + Safari desktop + Android WebView.
- **Existing SWR version and compatibility** — SWR is in `package.json` but unused. Need to verify the installed version's API compatibility with proposed patterns (especially `useSWRInfinite` for pagination and `keepPreviousData` for skeleton prevention).

## Sources

### Primary (HIGH confidence)
- [npm registry — motion v12.42](https://www.npmjs.com/package/motion) — Bundle size, API, LazyMotion pattern
- [motion.dev — React quickstart](https://motion.dev/docs/react-quick-start) — Official docs, bundle size guide
- [npm registry — sonner v2.0.7](https://www.npmjs.com/package/sonner) — Toast library, dependency-free
- [npm registry — react-hook-form v7.54](https://www.npmjs.com/package/react-hook-form) — Form library with 0 deps
- [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming) — CSS variable tokens, dark mode via `.dark`
- [shadcn Dark Mode (Vite)](https://ui.shadcn.com/docs/dark-mode/vite) — Non-Next.js theme provider pattern
- [Radix UI accessibility](https://radix-ui.com) — Official ARIA compliance docs
- [Radix Checkbox form issue #2530](https://github.com/radix-ui/primitives/issues/2530) — Known missing `<input>` in Checkbox
- [Radix Select a11y issue #3294](https://github.com/radix-ui/primitives/issues/3294) — Known `id` forwarding bug
- [Tailwind Safari print issue #18699](https://github.com/tailwindlabs/tailwindcss/issues/18699) — Safari 18.5 print variant regression
- [WCAG 2.5.5 Target Size](https://www.w3.org/TR/WCAG22/#target-size-enhanced) — 44x44 CSS pixel minimum touch target
- [GOV.UK Service Toolkit](https://www.gov.uk/service-toolkit) — Government design standards
- [Existing Kapwa codebase audit](https://github.com/opencode/kapwa) — Direct review of all components, pages, routes, config files
- [react-error-boundary npm](https://www.npmjs.com/package/react-error-boundary) — Error boundary library

### Secondary (MEDIUM confidence)
- [PkgPulse — React Animation Libraries Comparison 2026](https://www.pkgpulse.com/guides/framer-motion-vs-motion-one-vs-autoanimate-2026) — Animation library comparison
- [Syncfusion — Choosing React Animation Libraries 2026](https://www.syncfusion.com/blogs/post/react-animation-libraries-comparison) — Animation library evaluation
- [Dashboard Design Patterns](https://dashboarddesignpatterns.github.io/) — Academic dashboard design research
- [shadcn/ui best practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) — Production shadcn patterns
- [CSS migration guide — llmbestpractices.com](https://llmbestpractices.com) — Token extraction, component-by-component migration
- ["I Evicted Framer Motion" — dev.to/sumorai](https://dev.to/sumorai) — Real-world case study: 27% bundle reduction
- [Capacitor App Animation Performance — capgo.app](https://capgo.app) — WAAPI recommendation for WebView
- ["Building Effective React Skeleton Loading UIs" — asoasis.tech](https://asoasis.tech) — Skeleton design, CLS prevention, reduced motion

### Tertiary (LOW confidence)
- [React Suspense + SWR + Skeleton patterns — Medium/Rafael Mariano](https://medium.com) — Medium confidence due to single-author source; validated against SWR official docs
- [vaul GitHub — Unmaintained notice](https://github.com/emilkowalski/vaul) — Confirmed unmaintained; alternative (shadcn Sheet) assessed via codebase analysis

---
*Research completed: 2026-06-27*
*Ready for roadmap: yes*
