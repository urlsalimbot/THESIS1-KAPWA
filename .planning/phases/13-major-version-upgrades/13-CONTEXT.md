# Phase 13: Major Version Upgrades - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

## Phase Boundary

Bump three dependency majors in a single atomic commit and verify the existing 196-test suite + 3 page snapshot tests pass. React 18.2 → 19, Capacitor 6.2 → 8, Tailwind 3.4 → 4, TypeScript 5.3 → 5.7. Migrate the only class component (ErrorBoundary) to `react-error-boundary`. Adopt the new `@tailwindcss/vite` plugin in place of postcss. Web build verification only — mobile builds are out of scope.

## Implementation Decisions

### Upgrade Scope
- **D-01:** One atomic commit covers React 19 + Capacitor 8 + Tailwind v4 + TypeScript 5.7 — single `npm install` followed by code migrations, single git commit
- **D-02:** Fix forward on minor test breaks; React 19 deprecations and large refactors go to ROADMAP backlog as follow-up phases
- **D-03:** Web build verification only — `npm run build` and `npm run test:run` must pass. No Android APK or iOS IPA local builds in this phase
- **D-04:** Test bar: 196/196 unit tests + 3 new page snapshot tests for DashboardPage, CasesPage, BeneficiariesPage
- **D-05:** TypeScript bumped to ^5.7 in the same atomic commit — ensures JSX transform types and Tailwind v4 plugin types are correct

### ErrorBoundary Migration
- **D-06:** Migrate `src/components/ErrorBoundary.tsx` (the only class component) to `react-error-boundary` library — modern hooks-based pattern
- **D-07:** Drop the custom offline-detection branch (TypeError 'Failed to fetch' → offline UI). Offline detection is out of scope; SWR-style fetch hooks in Phase 15 will handle it
- **D-08:** Use `resetKeys` prop with a timestamp key bump to wire the existing "Try Again" button — re-renders children on click

### Tailwind v4 Migration
- **D-09:** Run `@tailwindcss/upgrade` codemod for automated v3→v4 syntax rewrites, then manual review of any oddities
- **D-10:** Preserve the existing `@layer base` block (shadcn design tokens: --background, --primary, --accent, etc.) — copy into the new CSS as-is
- **D-11:** Use the new `@tailwindcss/vite` plugin — drop `postcss.config.mjs` entirely for the client

### Snapshot Test Selections
- **D-12:** DashboardPage snapshot — covers stat cards, recent cases table, role-based widgets (the most-visited page per the IRF spec)
- **D-13:** CasesPage snapshot — covers table layout, status badges, filter controls (the worker-flow hub)
- **D-14:** BeneficiariesPage snapshot — covers searchable list, action buttons, masked PII display

## Canonical References

### Project Context
- `.planning/PROJECT.md` — Project overview, Kapwa stack constraints, current milestone v1.2
- `.planning/REQUIREMENTS.md` — v1.2 requirements UPG-01 (React 19), UPG-02 (Capacitor 8), UPG-03 (Tailwind v4)
- `.planning/ROADMAP.md` — Phase 13 boundary, success criteria #1-6
- `.planning/phases/12-toolchain-cleanup-vitest-upgrade/12-CONTEXT.md` — Phase 12 decisions (D-04 RTL supports React 18||19 confirmed; vitest v4.1.9 now installed; co-located test layout in use)

### Codebase Maps
- `.planning/codebase/TESTING.md` — Current test framework (Vitest v4.1.9, jsdom)
- `.planning/codebase/CONVENTIONS.md` — Naming, import organization, no path aliases (relative imports)
- `.planning/codebase/STRUCTURE.md` — Directory layout, `vite.config.ts` at `kapwa-client/`

### Package Configuration
- `kapwa-client/package.json` — Current versions to bump (React 18.2.0, Capacitor 6.2.1, Tailwind 3.4.1, TypeScript 5.3.3)
- `kapwa-client/vite.config.ts` — Vite 8.0.10 already; this becomes the integration point for `@tailwindcss/vite` plugin
- `kapwa-client/postcss.config.mjs` — Will be deleted per D-11
- `kapwa-client/src/index.css` — Holds the shadcn `@layer base` block to preserve per D-10

### Component Code (for migration reference)
- `kapwa-client/src/components/ErrorBoundary.tsx` — Only class component in the client (componentDidCatch, offline detection). Migrate per D-06..D-08

## Existing Code Insights

### Reusable Assets
- **Phase 12 vitest v4.1.9 install** — test runner already upgraded, no need to re-upgrade
- **Phase 12 co-located test layout** — new snapshot tests in D-12..D-14 follow this pattern (e.g., `src/pages/DashboardPage.test.tsx`)
- **shadcn design tokens in `@layer base`** — re-usable as-is in v4 CSS (D-10)

### Established Patterns
- Test runner: Vitest v4.1.9 + jsdom (Phase 12 outcome)
- Test environment: `tests/setup.ts` at `kapwa-client/tests/` (referenced by vite.config.ts)
- Import organization: external frameworks → project-specific → CSS (per CONVENTIONS.md)
- Component pattern: function components with hooks (28 pages, ~50 components) — only ErrorBoundary is a class

### Integration Points
- `vite.config.ts` — register `@tailwindcss/vite` plugin in the `plugins: [...]` array
- `src/index.css` — top-of-file change from `@tailwind base/components/utilities` to `@import "tailwindcss"` (codemod handles this)
- `package.json` — install `react-error-boundary`, `react@^19.0.0`, `react-dom@^19.0.0`, `@capacitor/core@^8.0.0`, `@capacitor/android@^8.0.0`, `@capacitor/ios@^8.0.0`, `tailwindcss@^4.0.0`, `@tailwindcss/vite`, `typescript@^5.7.0`

## Specific Ideas

- The shadcn design system uses CSS variables in `@layer base` (e.g., `--background: 0 0% 100%;` for white) — these are valid in v4 and need no translation
- `tailwindcss-animate` is currently a v3 plugin — needs verification against v4 (may be re-exported by `@tailwindcss/vite` or need a separate install)
- React 19's `useFormStatus` and `useOptimistic` hooks could improve some pages but those are scope creep — capture in ROADMAP backlog
- The `react-error-boundary` v5 supports React 19 and uses `useErrorBoundary` hook for granular error boundaries — appropriate replacement for our class component

## Deferred Ideas

- React 19 native hooks: `useFormStatus`, `useOptimistic`, `useActionState` — ROADMAP backlog as Phase 18+ candidates
- Mobile (Capacitor) build verification on Android/iOS devices — out of scope per D-03, follow-up phase
- Offline detection — moved out of ErrorBoundary per D-07; belongs in Phase 15 (SWR + fetch hooks) or later
- Full dependency audit for any other misplacements — out of scope for this phase
- Service worker for offline asset caching — out of scope (deferred since v1.0)

---

*Phase: 13-Major Version Upgrades*
*Context gathered: 2026-07-05*
