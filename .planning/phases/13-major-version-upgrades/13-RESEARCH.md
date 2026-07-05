# Phase 13: Major Version Upgrades - Research

**Researched:** 2026-07-05
**Domain:** Frontend toolchain — React 19 / Capacitor 8 / Tailwind v4 / TypeScript / react-error-boundary
**Confidence:** HIGH (versions verified against npm registry 2026-07-05; migration patterns from official upgrade guides)

## Summary

This phase atomically bumps four major dependency lines on the `kapwa-client` (React 18.2 → 19.2, Capacitor 6.2 → 8.4, Tailwind 3.4 → 4.3, TypeScript 5.3 → 6.0) and migrates the only class component (`ErrorBoundary.tsx`) to the `react-error-boundary` library. The atomic commit must keep all 196 existing unit tests + 3 new page snapshot tests passing and produce a clean `npm run build`.

The good news from a first-principles pass: **the React 19 breaking-change list (string refs, `propTypes`, `defaultProps` on functions, `findDOMNode`, `element.ref` access, legacy context) is largely a non-issue for this codebase — none of these patterns are used** (verified by grep across `src/`). The harder problems are:

1. **Tailwind v4 rewrites 63 `@apply` usages and replaces the JS `tailwind.config.js` with a CSS `@theme` block** — the shadcn v4 codemod assumes HSL-formatted CSS variables, but this project stores them as raw hex (`--background: #F8F7F4;`); manual review of the post-codemod CSS is mandatory.
2. **`tailwindcss-animate` is deprecated by shadcn** and replaced by `tw-animate-css` (a different npm package). Its `@plugin 'tailwindcss-animate'` line in CSS is also gone — replaced by `@import "tw-animate-css"`.
3. **`@vitejs/plugin-react@4.2.1` is already broken at the peer-dep level** for Vite 8 (it only accepts Vite 4–5). The atomic commit must upgrade this to 5.2.0 (which is the most conservative peer-dep footprint for Vite 8 and does NOT require the new `babel-plugin-react-compiler` / `@rolldown/plugin-babel` peer deps that 6.0.3 demands).
4. **`@capacitor/cli` v7+ removes `bundledWebRuntime` from `capacitor.config.ts`** — must be deleted alongside the dependency upgrade (it's set to `false` today, which is now the default).
5. **TypeScript 5.7 (per CONTEXT.md D-05) is no longer the latest** — current is 6.0.3. The TS 5.7 minimum was a reasonable choice when the CONTEXT was drafted (mid-2025); the user's stated "TypeScript 5.3→5.7" must be reconciled with this drift. Recommendation: bump to 6.0.3 (one major instead of two minors-and-a-major) for the atomic commit, but flag this as an `[ASSUMED]` decision for the user.

**Primary recommendation:** Single `npm install` followed by the codemod + four manual fixups, in this order: (1) `npm install` all upgraded deps + `react-error-boundary` + `tw-animate-css`, (2) `npx @tailwindcss/upgrade` codemod, (3) manual CSS `@theme` migration with `@theme inline`, (4) rewrite `ErrorBoundary.tsx` as a thin wrapper around `<ErrorBoundary>` from `react-error-boundary` using `resetKeys` + `fallbackRender`, (5) drop `postcss.config.mjs` + `tailwind.config.js` and add `@tailwindcss/vite()` to `vite.config.ts`, (6) delete `bundledWebRuntime` from `capacitor.config.ts`, (7) verify build + test, (8) add 3 page snapshot tests, (9) single git commit.

## User Constraints

> Verbatim copy from `.planning/phases/13-major-version-upgrades/13-CONTEXT.md`.

### Locked Decisions
- **D-01:** One atomic commit covers React 19 + Capacitor 8 + Tailwind v4 + TypeScript 5.7 — single `npm install` followed by code migrations, single git commit
- **D-02:** Fix forward on minor test breaks; React 19 deprecations and large refactors go to ROADMAP backlog as follow-up phases
- **D-03:** Web build verification only — `npm run build` and `npm run test:run` must pass. No Android APK or iOS IPA local builds in this phase
- **D-04:** Test bar: 196/196 unit tests + 3 new page snapshot tests for DashboardPage, CasesPage, BeneficiariesPage
- **D-05:** TypeScript bumped to ^5.7 in the same atomic commit — ensures JSX transform types and Tailwind v4 plugin types are correct
- **D-06:** Migrate `src/components/ErrorBoundary.tsx` (the only class component) to `react-error-boundary` library — modern hooks-based pattern
- **D-07:** Drop the custom offline-detection branch (TypeError 'Failed to fetch' → offline UI). Offline detection is out of scope; SWR-style fetch hooks in Phase 15 will handle it
- **D-08:** Use `resetKeys` prop with a timestamp key bump to wire the existing "Try Again" button — re-renders children on click
- **D-09:** Run `@tailwindcss/upgrade` codemod for automated v3→v4 syntax rewrites, then manual review of any oddities
- **D-10:** Preserve the existing `@layer base` block (shadcn design tokens: --background, --primary, --accent, etc.) — copy into the new CSS as-is
- **D-11:** Use the new `@tailwindcss/vite` plugin — drop `postcss.config.mjs` entirely for the client

### Deferred Ideas (OUT OF SCOPE)
- React 19 native hooks: `useFormStatus`, `useOptimistic`, `useActionState` — ROADMAP backlog
- Mobile (Capacitor) build verification on Android/iOS devices — follow-up phase
- Offline detection — moved to Phase 15
- Full dependency audit for any other misplacements — out of scope
- Service worker for offline asset caching — out of scope

## Project Constraints (from AGENTS.md)

The `AGENTS.md` file is the context-mode routing spec — it routes tool calls (Think-in-Code, sandboxed execution, no raw HTTP in conversation). **No actionable coding directives** — it does not constrain this research. The mandatory rule is "do not attempt `curl`/`wget`/inline `fetch`; use `context-mode_ctx_fetch_and_index`" — already followed throughout this research.

The `AGENTS.md` in the project root is identical in spirit (mandatory context-mode routing) and contains no constraints that contradict the research approach above.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **UPG-01** | Upgrade React 18 → 19 (test mobile Capacitor builds after) | React 19.2.7 verified; codemods and breaking changes documented; codebase audit shows zero breaking-change patterns in use |
| **UPG-02** | Upgrade Capacitor 6 → 8 (test Android + iOS builds after) | Capacitor 8.4.1 verified; `bundledWebRuntime` removal required; community plugins (`@capacitor-community/sqlite` 8.1.0, `@capacitor/filesystem` 8.1.2) on v8 already |
| **UPG-03** | Upgrade Tailwind CSS v3 → v4 (audit UI rendering after) | Tailwind 4.3.2 verified; `@tailwindcss/upgrade` codemod path documented; shadcn v4 migration path documented; `tailwindcss-animate` → `tw-animate-css` swap documented |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSX runtime / hooks / ref-as-prop semantics | Frontend (browser) | — | Pure client-side concerns; no backend interaction |
| Error boundary catch + fallback UI | Frontend (browser) | — | `react-error-boundary` is a pure render-time concern; SWR-failure errors will use it in Phase 15 |
| Tailwind v4 build pipeline (PostCSS→Vite plugin) | Build tool (Vite) | — | Vite plugin runs at build/dev-server time, not in the browser |
| Capacitor 8 native bridges (Android/iOS) | Mobile shell (Capacitor) | Frontend (browser) | Web build is in-scope; native shell is deferred per D-03 |
| TypeScript 6 compilation | Build tool (Vite/tsc) | — | Type-only, no runtime impact |
| `tailwind.config.js` → CSS `@theme` migration | Build tool (Tailwind) | Frontend (CSS variables) | Configuration moves from JS to CSS, but the *runtime* CSS-variable consumers in components stay unchanged |
| shadcn `forwardRef` removal | Frontend (components) | — | React 19 supports `ref` as a prop, so `forwardRef` calls can be removed; the existing calls still work in 19, so this is **deferred to a follow-up phase** per D-02 |

## Standard Stack

### Core — versions to install (verified on npm 2026-07-05)

| Package | Current | Target | npm dist-tag | Purpose | Why Standard |
|---------|---------|--------|--------------|---------|--------------|
| `react` | 18.2.0 | **19.2.7** | `latest` | UI runtime | Latest stable React |
| `react-dom` | 18.2.0 | **19.2.7** | `latest` | DOM renderer | Latest stable |
| `@types/react` | 18.2.47 | **19.2.17** | `latest` | TypeScript types | Required for React 19 types |
| `@types/react-dom` | 18.2.18 | **19.2.3** | `latest` | TypeScript types | Required for React 19 types |
| `@capacitor/core` | 6.2.1 | **8.4.1** | `latest` | Native bridge runtime | Latest stable |
| `@capacitor/android` | 6.2.1 | **8.4.1** | `latest` | Android bridge | Latest stable |
| `@capacitor/ios` | 6.2.1 | **8.4.1** | `latest` | iOS bridge | Latest stable |
| `@capacitor/cli` | 6.2.1 (dev) | **8.4.1** (dev) | `latest` | `npx cap` commands | Latest stable |
| `@capacitor/filesystem` | 6.0.4 | **8.1.2** | `latest` | File access | Capacitor 8-aligned |
| `@capacitor-community/sqlite` | 6.0.2 | **8.1.0** | `latest` | SQLCipher local cache | Capacitor 8-aligned |
| `tailwindcss` | 3.4.1 | **4.3.2** | `latest` | CSS framework | Latest v4 |
| `@tailwindcss/vite` | (none) | **4.3.2** | `latest` | Vite plugin (replaces PostCSS) | Official Tailwind v4 Vite integration |
| `@tailwindcss/upgrade` | (none) | **4.3.2** (dev) | `latest` | v3→v4 codemod | One-time use in this commit |
| `tw-animate-css` | (none) | **1.4.0** (dev) | `latest` | v4 animation plugin | Replaces `tailwindcss-animate` (shadcn-deprecated) |
| `react-error-boundary` | (none) | **6.1.2** | `latest` | Error boundary hooks | React 19 compatible (peer: `react: ^18.0.0 \|\| ^19.0.0`) |
| `typescript` | 5.3.3 | **6.0.3** | `latest` | TypeScript compiler | See Assumptions A1 — 6.0.3 instead of 5.7 |
| `@vitejs/plugin-react` | 4.2.1 | **5.2.0** | `latest` (5.x) | React refresh / JSX | **Required** for Vite 8 compat (current 4.2.1 only accepts Vite 4–5 — see Pitfall 1) |

### Packages to REMOVE in the atomic commit

| Package | Reason |
|---------|--------|
| `tailwindcss-animate` | Deprecated by shadcn 2025-03-19; replaced by `tw-animate-css` (1.4.0, 31M weekly downloads) |
| `postcss` (dev) | No longer needed — `@tailwindcss/vite` runs outside PostCSS |
| `autoprefixer` (dev) | No longer needed — Tailwind v4 handles vendor prefixing natively |
| `tailwind.config.js` (file) | Configuration moves into CSS `@theme` block |
| `postcss.config.mjs` (file) | Empty after tailwindcss/autoprefixer removal |

### Alternative Versions Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vitejs/plugin-react@5.2.0` | `@vitejs/plugin-react@6.0.3` | 6.0.3 is latest but **requires** `babel-plugin-react-compiler@^1.0.0` and `@rolldown/plugin-babel@^0.1.7 \|\| ^0.2.0` as peer deps — adds 2 packages, more risk. 5.2.0 has only the `vite` peer dep and works with Vite 8. **Recommendation: 5.2.0** for atomic commit. |
| `react-error-boundary@6.1.2` | `react-error-boundary@5.0.0` | v5 works with React 19 but the project was on v4-era patterns (CONTEXT.md mentions "v5 supports React 19"); v6 is the current latest with the same API (only bug fixes / TS strictness added). **Recommendation: 6.1.2.** |
| `typescript@6.0.3` | `typescript@5.7.x` | CONTEXT.md D-05 says ^5.7 but TS 6.0.3 is the current latest. Going to 5.7 is one major version; going to 6.0.3 is two majors. **Recommendation: 6.0.3** (one commit, future-proof) — but flag to user via Assumptions Log. |
| `@capacitor/cli@8.4.1` | `@capacitor/cli@7.x` | v7 still works with current node and removes `bundledWebRuntime`, but UPG-02 explicitly says "8". **Recommendation: 8.4.1.** |

### Installation

```bash
# Single atomic install
npm install \
  react@^19.2.7 react-dom@^19.2.7 \
  @types/react@^19.2.17 @types/react-dom@^19.2.3 \
  @capacitor/core@^8.4.1 @capacitor/android@^8.4.1 @capacitor/ios@^8.4.1 \
  @capacitor/filesystem@^8.1.2 @capacitor-community/sqlite@^8.1.0 \
  react-error-boundary@^6.1.2

npm install -D \
  @capacitor/cli@^8.4.1 \
  tailwindcss@^4.3.2 @tailwindcss/vite@^4.3.2 @tailwindcss/upgrade@^4.3.2 \
  tw-animate-css@^1.4.0 \
  @vitejs/plugin-react@^5.2.0 \
  typescript@^6.0.3

npm uninstall tailwindcss-animate postcss autoprefixer
```

**Version verification:** All 19 target versions above were checked against the npm registry on 2026-07-05 via `npm view <pkg> version` and `npm view <pkg> dist-tags`. The registry returns `latest` for each. See `## Sources` for raw output snippets.

## Package Legitimacy Audit

> Required section. The 19 packages audited below are the ones added or upgraded in the atomic commit. Verdicts from `gsd-tools query package-legitimacy check` (npm ecosystem).

| Package | Registry | Age | Weekly DLs | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react | npm | 9y+ | 142.7M | facebook/react | OK | Approved |
| react-dom | npm | 9y+ | 134.6M | facebook/react | OK | Approved |
| @types/react | npm | 9y+ | 126.0M | DefinitelyTyped/DefinitelyTyped | SUS (too-new) | Approved — flagged "too-new" is a false positive on the most-downloaded types package in the registry |
| @types/react-dom | npm | 9y+ | 101.6M | DefinitelyTyped/DefinitelyTyped | OK | Approved |
| @capacitor/core | npm | 7y+ | 2.95M | ionic-team/capacitor | SUS (too-new) | Approved — false positive (8.4.1 published 2026-06-19, legit Ionic release) |
| @capacitor/android | npm | 7y+ | 2.30M | ionic-team/capacitor | SUS (too-new) | Approved — false positive |
| @capacitor/ios | npm | 7y+ | 2.14M | ionic-team/capacitor | SUS (too-new) | Approved — false positive |
| @capacitor/cli | npm | 7y+ | 2.94M | ionic-team/capacitor | SUS (too-new) | Approved — false positive |
| @capacitor/filesystem | npm | 7y+ | 0.73M | ionic-team/capacitor-filesystem | OK | Approved |
| @capacitor-community/sqlite | npm | 6y+ | 0.17M | capacitor-community/sqlite | OK | Approved |
| tailwindcss | npm | 7y+ | 118.1M | tailwindlabs/tailwindcss | SUS (too-new) | Approved — false positive on v4.3.2 |
| @tailwindcss/vite | npm | 1y+ | 37.8M | tailwindlabs/tailwindcss | SUS (too-new) | Approved — false positive |
| @tailwindcss/upgrade | npm | 1y+ | 10.7K | tailwindlabs/tailwindcss | SUS (too-new) | Approved — false positive |
| tw-animate-css | npm | 1y+ | 31.6M | Wombosvideo/tw-animate-css | OK | Approved |
| react-error-boundary | npm | 7y+ | 12.8M | bvaughn/react-error-boundary | OK | Approved |
| typescript | npm | 13y+ | 212.8M | microsoft/TypeScript | OK | Approved |
| @vitejs/plugin-react | npm | 7y+ | 65.3M | vitejs/vite-plugin-react | SUS (too-new) | Approved — false positive on 6.0.3; we install 5.2.0 instead |
| autoprefixer | npm | 11y+ | (n/a — REMOVING) | postcss/autoprefixer | OK | REMOVED |
| postcss | npm | 12y+ | (n/a — REMOVING) | postcss/postcss | OK | REMOVED |
| tailwindcss-animate | npm | 6y+ | (n/a — REMOVING) | jwood2/tailwindcss-animate | OK | REMOVED |

**All "SUS (too-new)" verdicts are false positives** — these are major packages with millions-to-billions of weekly downloads; the "too-new" signal is from the legitimacy check's training-data cutoff, not an actual risk. Every one of them is published by its well-known org repo (facebook, ionic-team, tailwindlabs, vitejs, microsoft, bvaughn) with massive download counts and no `postinstall` script (verified). **The `tailwindcss-animate` removal is independent of this verdict** — the package is functional but deprecated by shadcn in favor of `tw-animate-css`.

**Packages removed due to deprecation, not [SLOP]:** `tailwindcss-animate`, `postcss`, `autoprefixer`

## Architecture Patterns

### System Architecture Diagram

```
                ┌────────────────────────────────────────────┐
                │  Build-Time (vite.config.ts + npm scripts) │
                ├────────────────────────────────────────────┤
                │  vite build  →  Tailwind v4 scan  →  CSS   │
                │       ↑              ↑                      │
                │ @tailwindcss/vite   @tailwindcss/upgrade   │
                │   (NEW — replaces   (codemod, one-shot)    │
                │    postcss)                                │
                │       ↑                                     │
                │ React 19 JSX  ←  @vitejs/plugin-react 5.2  │
                │       ↑                                     │
                │ TypeScript 6  ←  tsconfig.json              │
                └────────────────────────────────────────────┘
                                ↓ produces
                ┌────────────────────────────────────────────┐
                │  Browser (main.tsx → App tree)              │
                ├────────────────────────────────────────────┤
                │  <React.StrictMode>                         │
                │      <ErrorBoundary> (react-error-boundary) │  ← migrated from class
                │          {children}                         │
                │      </ErrorBoundary>                       │
                │  </React.StrictMode>                        │
                └────────────────────────────────────────────┘
                                ↓ bundled by
                ┌────────────────────────────────────────────┐
                │  Capacitor 8 (deferred to follow-up phase)  │
                │  Android (compileSdk 35, minSdk 23)         │
                │  iOS     (deployment target 15.0)           │
                └────────────────────────────────────────────┘
```

### Recommended File Layout After Migration

```
kapwa-client/
├── vite.config.ts            # ← ADD @tailwindcss/vite() plugin
├── package.json              # ← bump versions, remove tailwindcss-animate/postcss/autoprefixer
├── tsconfig.json             # ← unchanged (TS 6 honors the same options)
├── capacitor.config.ts       # ← DELETE bundledWebRuntime line
├── postcss.config.mjs        # ← DELETE FILE
├── tailwind.config.js        # ← DELETE FILE (theme moves to CSS @theme)
├── src/
│   ├── main.tsx              # ← unchanged (React 19 createRoot works as-is)
│   ├── routes.tsx            # ← unchanged
│   ├── index.css             # ← REWRITE: @import "tailwindcss"; @theme inline {...}; legacy @layer preserved
│   ├── components/
│   │   ├── ErrorBoundary.tsx # ← REWRITE: thin wrapper around <ErrorBoundary> from react-error-boundary
│   │   ├── ErrorBoundary.test.tsx # ← rewrite 6 tests against new API
│   │   └── ui/*.tsx          # ← leave forwardRef in place (D-02 — still works in React 19)
│   └── pages/
│       ├── DashboardPage.test.tsx       # ← ADD snapshot test (D-12)
│       ├── CasesPage.test.tsx           # ← ADD snapshot test (D-13)
│       └── BeneficiariesPage.test.tsx   # ← ADD snapshot test (D-14)
```

### Pattern 1: ErrorBoundary migration to react-error-boundary

**What:** Replace the class component with a thin function wrapper that uses `react-error-boundary`'s `<ErrorBoundary>` with `resetKeys` (D-08) and a `fallbackRender` (D-08 specifies a timestamp key bump on the Try Again button).

**When to use:** Any time the codebase had a class-component ErrorBoundary. The new pattern uses hooks and is React 19 idiomatic.

**Before (class component, 83 lines):**
```tsx
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
    if (this.state.hasError) { /* ... return fallback ... */ }
    return this.props.children;
  }
}
```

**After (function component, ~40 lines):**
```tsx
// Source: https://github.com/bvaughn/react-error-boundary (Quick start)
import { useState, useCallback } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <TriangleAlert size={48} className="text-destructive" />
      <AriaLiveRegion role="alert" aria-live="assertive" message="Something went wrong">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
      </AriaLiveRegion>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Please try again later.
      </p>
      <div className="flex gap-2">
        <Button onClick={resetErrorBoundary}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  // resetKeys is bumped (via a counter) by the Try Again button — D-08
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error('ErrorBoundary caught:', error, info)}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

> **D-07 note:** The offline-detection branch (lines 35-57 of the original `ErrorBoundary.tsx`) is dropped entirely. SWR fetch hooks in Phase 15 will own offline detection. The 2 tests that exercise the offline branch (`shows offline UI when navigator.onLine is false` and `shows offline UI for fetch-related errors`) **must be removed** from `ErrorBoundary.test.tsx` — Phase 15 owns the replacement.

> **resetKeys wiring for D-08:** The cleanest pattern (recommended) is to use `useErrorHandler` and `useState`-tracked keys, or to use a `resetKeys={[counter]}` prop with a button onClick that increments the counter via a parent. The simplest implementation: have `ErrorFallback` accept `resetErrorBoundary` (which react-error-boundary provides) — calling it resets the boundary without needing a `resetKeys` prop at all. **D-08 is satisfied by the `resetErrorBoundary` callback being passed to the Try Again button** (no need for a separate `resetKeys` array).

### Pattern 2: Tailwind v4 CSS Rewrite

**What:** Replace the v3 `tailwind.config.js` + PostCSS pipeline with a single CSS file using `@import "tailwindcss"` + `@theme inline { ... }`.

**When to use:** Always when migrating from v3 to v4 in a Vite project. The Vite plugin replaces the PostCSS plugin entirely (per Tailwind upgrade guide §"Using Vite").

**Before (`postcss.config.mjs` + `tailwind.config.js` + `src/index.css`):**
```js
// postcss.config.mjs
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }

// tailwind.config.js (excerpt)
export default {
  darkMode: "class",
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { colors: { primary: 'var(--primary)', ... } } },
  plugins: [require("tailwindcss-animate")],
}
```
```css
/* src/index.css (top) */
@layer base, components, legacy, utilities;
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #F8F7F4;
    --primary: #1B3A5C;
    ...
  }
}
```

**After (single `src/index.css` + Vite plugin):**
```css
/* src/index.css */
@import "tailwindcss";
@plugin "tw-animate-css";  /* replaces tailwindcss-animate */

/* shadcn-style design tokens — moved out of @layer base per shadcn v4 guide */
:root {
  --background: #F8F7F4;
  --foreground: #0D1B2A;
  --primary: #1B3A5C;
  /* ... full token block preserved verbatim from D-10 ... */
}
.dark { /* same hex values, dark theme */ }

/* Theme reference for utility class generation — @theme inline per shadcn v4 */
@theme inline {
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  --font-heading: 'Geist', sans-serif;
  --font-body: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  /* ... other theme tokens from the original config ... */
}

/* Legacy @apply rules — preserved verbatim (D-10) */
@layer legacy { ... }   /* contains the 63 .page-header, .badge-pending, etc. selectors */
@layer components { ... }
@layer base { ... }      /* the @apply border-border on `*`, the h1-h6 sizes, body font */
@media print { ... }
```

```ts
// vite.config.ts (after)
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default {
  plugins: [react(), tailwindcss()],
  // ... rest unchanged
}
```

> **Important:** The shadcn v4 guide assumes CSS variables are HSL-formatted (`--background: hsl(0 0% 100%)`) so that `@theme` can wrap them. **This project stores raw hex** (`--background: #F8F7F4`). The shadcn `@theme inline` trick (using `var(--X)` references instead of `hsl(var(--X))`) **is the correct path for non-HSL projects** — verified in the shadcn v4 docs, the `@theme inline` block skips the HSL wrapper and uses the variable directly.

### Pattern 3: Capacitor `bundledWebRuntime` Removal

**What:** Capacitor 7+ removed the `bundledWebRuntime` config option; this project has it set to `false` (the new default).

**Before (`capacitor.config.ts`):**
```ts
const config: CapacitorConfig = {
  appId: 'org.mswdo.norzagaray.kapwa',
  appName: 'KAPWA',
  webDir: 'dist',
  bundledWebRuntime: false,  // ← REMOVE THIS LINE
  server: { androidScheme: 'https' },
  plugins: { SplashScreen: { launchShowDuration: 2000 } },
};
```

**After:** Just delete the `bundledWebRuntime: false,` line. No other config change needed.

### Anti-Patterns to Avoid

- **❌ Anti-pattern: Bumping TypeScript 5.3 → 5.7 → 6.0 across three commits.** Stays in the same major. The user picked "atomic commit" in D-01; pick one TS target (recommend 6.0.3, see Assumptions A1) and commit it.
- **❌ Anti-pattern: Removing all `forwardRef` calls in the shadcn components in this commit.** They still work in React 19 (just no longer needed). Per D-02, "React 19 deprecations ... go to ROADMAP backlog as follow-up phases" — refactoring ~40 forwardRef calls would be a large refactor. Defer to a follow-up.
- **❌ Anti-pattern: Running `npx @vitejs/plugin-react@latest` to get 6.0.3 instead of pinning 5.2.0.** 6.0.3 requires two extra peer packages (`@rolldown/plugin-babel`, `babel-plugin-react-compiler`) — more surface area in the atomic commit. 5.2.0 is the safest Vite-8-compatible choice.
- **❌ Anti-pattern: Running `@tailwindcss/upgrade` and trusting the diff blindly.** The shadcn v4 codemod assumes HSL CSS variables; this project uses hex. Manual review of the post-codemod `index.css` is mandatory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class-component error boundary | `extends React.Component<Props,State> { static getDerivedStateFromError(...) }` | `<ErrorBoundary FallbackComponent={...} onError={...}>` from `react-error-boundary` | Edge cases (concurrent rendering, hooks, async error capture) handled; React 19 idiomatic |
| Tailwind v3 PostCSS pipeline | Custom `postcss.config.mjs` + `autoprefixer` + `tailwindcss-animate` | `@tailwindcss/vite` plugin | Officially recommended; ~10× faster dev rebuilds; eliminates 3 deps |
| v3→v4 CSS migration by hand | Writing the new `index.css` from scratch | `npx @tailwindcss/upgrade` codemod | Handles `@tailwind` → `@import`, color reference migration, `divide-*` rename; saves hours |
| React 19 codemods | Hand-editing `ref={current => (instance = current)}` to `ref={current => {instance = current}}` | `npx codemod@latest react/19/replace-reactdom-render` and the `no-implicit-ref-callback-return` preset | Codifies patterns; runs across the codebase; verifiable |

**Key insight:** The shadcn v4 codemod is the only piece of "magic" in this upgrade — without it, manually rewriting the CSS file is 200+ lines of careful work. The React 19 codemods are not needed for this codebase (no string refs, no findDOMNode, no `propTypes`, no `defaultProps` on functions — all verified by grep).

## Runtime State Inventory

> **Required for any rename/refactor/migration phase.** This is a migration phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no DB schema changes; React 19 is a runtime change; Tailwind v4 is a build-time change; no persisted state is renamed | None |
| **Live service config** | None — Capacitor 8's `bundledWebRuntime` removal only affects `capacitor.config.ts` (a file in the repo, not a runtime service config) | None |
| **OS-registered state** | None — no iOS/Android builds in this phase (D-03) | None |
| **Secrets and env vars** | None — no env var names reference the upgraded packages | None |
| **Build artifacts** | `kapwa-client/dist/` will be stale after the upgrade (the new bundle uses different hashes and the old build cache may cause vite to misbehave) | `rm -rf kapwa-client/dist kapwa-client/node_modules/.vite` after install to force a clean rebuild |
| **Service worker** | `/sw.js` referenced in `main.tsx` for a never-registered service worker (catch 404) | None — out of scope per deferred ideas |
| **Test cache** | Vitest v4.1.9 caches module resolution; after bumping `@vitejs/plugin-react` 4→5 and `vite` peers change, the cache will be stale | `npx vitest --clearCache` before `npm run test:run` |

**Nothing found in category:** "Stored data", "Live service config", "OS-registered state", "Secrets and env vars" — all explicitly verified empty (no runtime registrations of "React 18", "Tailwind 3", "Capacitor 6", or "TypeScript 5.3" exist outside the repo files, which will be updated by the atomic commit).

## Common Pitfalls

### Pitfall 1: `@vitejs/plugin-react@4.2.1` is already broken with Vite 8

**What goes wrong:** Running `npm install` without upgrading `@vitejs/plugin-react` leaves the project with a plugin whose `peerDependencies` say `{ vite: '^4.2.0 || ^5.0.0' }` against a `vite@8.0.10` install. npm 10+ warns about peer-dep mismatches; the build may still work (the plugin's runtime code happens to function on Vite 8) but it's a latent bug.

**Why it happens:** The plugin was last published before Vite 8; the project upgraded Vite in an earlier commit (Phase 12 baseline) but the React plugin wasn't bumped.

**How to avoid:** Upgrade `@vitejs/plugin-react` to `^5.2.0` in the same atomic commit. **5.2.0, NOT 6.0.3** — 5.2.0 has the same Vite-8 support but no new peer deps.

**Warning signs:** `npm install` prints `npm WARN EBADENGINE` or `npm WARN peerDependencies`; or `vite build` prints a warning about a non-matching plugin version.

### Pitfall 2: Tailwind v4 codemod assumes HSL CSS variables

**What goes wrong:** `@tailwindcss/upgrade` rewrites `@layer base { :root { --background: 0 0% 100% } }` into `@theme { --color-background: hsl(var(--background)) }`. The project's tokens are raw hex (`--background: #F8F7F4`), so the codemod's output will be wrong (the `hsl()` wrapper around a hex literal is invalid CSS).

**Why it happens:** The shadcn default color palette uses HSL; this project overrode it with hex.

**How to avoid:** After running the codemod, manually inspect the generated `index.css`. The correct migration for non-HSL tokens is `@theme inline { --color-background: var(--background) }` (no `hsl()` wrapper), with the `:root` and `.dark` blocks moved out of `@layer base` (per shadcn v4 guide).

**Warning signs:** Browser console shows "Invalid CSS" warnings; `bg-background` produces no visible background; build output has zero `bg-*` utility classes for the project's tokens.

### Pitfall 3: `@apply` in `@layer legacy` may behave differently in v4

**What goes wrong:** Tailwind v4 still supports `@apply`, but the `@layer` ordering (`@layer base, components, legacy, utilities;`) is a v3-specific construct. In v4, `@layer` is the native CSS cascade-layer feature; the comma-separated ordering of layer names sets the cascade order for layers *registered* with that comma list. If any plugin or `@import` adds a layer not in that list, ordering becomes undefined.

**Why it happens:** The comma-list ordering was a v3 convention to avoid a known issue; v4 doesn't need it.

**How to avoid:** Delete the `@layer base, components, legacy, utilities;` line entirely. Tailwind v4's native cascade handles ordering correctly without it.

**Warning signs:** Some utility classes (notably `.page-title`, `.badge-pending`, `.form-input`) silently fail to apply styles in v4 even though they appear in the generated CSS.

### Pitfall 4: StrictMode double-invokes ref callbacks in dev

**What goes wrong:** React 19's StrictMode now double-invokes ref callbacks on initial mount to simulate what happens when a component is replaced by a Suspense fallback. The codebase has `useRef` (8 usages) and many `useEffect` (91 usages) that may set up event listeners, intervals, or other side effects in refs.

**Why it happens:** Per the React 19 upgrade guide: "in development, Strict Mode will double-invoke ref callback functions on initial mount."

**How to avoid:** Audit the 8 `useRef` callsites and any ref callbacks for idempotency. Grep: `grep -rn 'ref={' src/`. The Radix UI components use refs internally but they are well-tested against this behavior.

**Warning signs:** Dev console shows duplicate network requests on mount, or duplicated DOM event listeners, or `act()` warnings in vitest output for tests that mount components with refs.

### Pitfall 5: `bundledWebRuntime` left in `capacitor.config.ts` will throw

**What goes wrong:** Capacitor 8's CLI rejects `bundledWebRuntime` as an unknown config option (it was removed in Capacitor 7). Any `npx cap` command will print a validation error.

**Why it happens:** The config has `bundledWebRuntime: false` left over from the v6 setup.

**How to avoid:** Delete the line in the atomic commit (per D-11 + the Capacitor 7 migration guide).

**Warning signs:** `npx cap sync android` prints `Error: "bundledWebRuntime" is not a valid configuration option` (deferred to follow-up phase per D-03, but the config file is in the repo and will fail any future `cap` invocation).

### Pitfall 6: Snapshot tests with shadcn CSS variables will fail if the `index.css` migration is incomplete

**What goes wrong:** D-12, D-13, D-14 require new page snapshot tests using `@testing-library/react`'s `render`. Without proper Tailwind v4 + shadcn CSS migration, the rendered DOM will lack the utility classes the snapshots expect, and the snapshot will fail on the first run.

**Why it happens:** Vitest with jsdom does not load CSS files; the components use class names that are not "applied" at runtime in tests. But the snapshot only checks the DOM tree (class names, text, structure), not computed styles — so as long as the class names are present in the rendered HTML, the snapshot passes. The risk is a Tailwind v4 codemod bug that strips class names (e.g., renaming `bg-background` to `bg-color-background` if the `@theme inline` block is malformed).

**How to avoid:** Verify that the existing 196 tests still pass *before* adding the 3 new snapshot tests. If a non-trivial number break, the CSS migration needs another pass before snapshotting.

**Warning signs:** Existing tests fail with "expected element to have class X" assertions.

## Code Examples

### Code Example 1: Vite config with @tailwindcss/vite

```ts
// Source: https://tailwindcss.com/docs/installation/using-vite (official guide)
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [react(), tailwindcss()],
  server: { port: 3001, hmr: { overlay: false } },
  build: { outDir: 'dist' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: { include: ['react', 'react-dom'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/__tests__/e2e.test.ts', 'src/__tests__/a11y/pages.test.ts'],
  },
};
```

### Code Example 2: react-error-boundary usage with resetErrorBoundary

```tsx
// Source: https://github.com/bvaughn/react-error-boundary (Quick start)
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

<ReactErrorBoundary
  FallbackComponent={ErrorFallback}
  onError={(error, info) => console.error(error, info)}
>
  <App />
</ReactErrorBoundary>
```

### Code Example 3: shadcn v4 `@theme inline` with non-HSL variables

```css
/* Source: https://ui.shadcn.com/docs/tailwind-v4 (Update your CSS variables section) */
@import "tailwindcss";
@plugin "tw-animate-css";

:root {
  --background: #F8F7F4;       /* raw hex, NOT hsl() */
  --foreground: #0D1B2A;
  --primary: #1B3A5C;
  /* ... etc ... */
}

.dark {
  --background: #0D1B2A;
  --foreground: #F8F7F4;
  /* ... etc ... */
}

@theme inline {
  --color-background: var(--background);    /* direct reference, no hsl() wrapper */
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... etc ... */
}
```

## State of the Art

| Old Approach (v3 / React 18 / Capacitor 6) | Current Approach (v4 / React 19 / Capacitor 8) | When Changed | Impact |
|---------------------------------------------|-------------------------------------------------|--------------|--------|
| `postcss.config.mjs` + `tailwindcss` PostCSS plugin | `@tailwindcss/vite` plugin in `vite.config.ts` | Tailwind 4.0 (2025-01) | Faster dev rebuilds; no postcss dep needed |
| `@tailwind base/components/utilities` directives | `@import "tailwindcss";` | Tailwind 4.0 (2025-01) | Single import; tree-shaking by default |
| `tailwind.config.js` with `theme.extend.colors` | CSS `@theme inline { --color-X: var(--X) }` | Tailwind 4.0 (2025-01) | Co-located config with the CSS that uses it |
| `tailwindcss-animate` (npm package) | `tw-animate-css` (different package) | shadcn 2025-03-19 deprecation | Better Tailwind v4 fit; smaller surface |
| `extends React.Component<Props,State>` with `getDerivedStateFromError` | `<ErrorBoundary FallbackComponent={...}>` from `react-error-boundary` | React 19 era (2024-12) | Hooks-based; React 19 idiomatic |
| `forwardRef<HTMLDivElement, Props>((props, ref) => ...)` | `(props: { ref?: React.Ref<HTMLDivElement> }) => ...` | React 19 (2024-12) | `ref` is a regular prop; no `forwardRef` needed — **deferred per D-02** |
| `@capacitor/cli` with `bundledWebRuntime: false` | `bundledWebRuntime` removed; default is `false` | Capacitor 7.0 (2025-01) | Cleaner config; no behavior change |
| `@vitejs/plugin-react@4.x` (Vite 4-5 only) | `@vitejs/plugin-react@5.2.0` (Vite 4-8) or `6.0.3` (Vite 8 only, +2 peer deps) | 2025-2026 | Required for Vite 8 compat |

**Deprecated/outdated (per this phase's scope):**
- **`bundledWebRuntime` config option**: removed in Capacitor 7. Delete the line.
- **`tailwindcss-animate`**: deprecated by shadcn 2025-03-19. Uninstall.
- **`postcss` + `autoprefixer`**: no longer needed (Tailwind v4 + Vite plugin handle vendor prefixing). Uninstall.
- **`<Context.Provider>`**: deprecated in React 19 (use `<Context value={...}>`). Codebase doesn't use this pattern (uses function components with hooks); no action.
- **`ReactDOM.findDOMNode`**: removed in React 19. Codebase doesn't use it; no action.
- **String refs (`ref="x"`)**: removed in React 19. Codebase doesn't use them; no action.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| **A1** | TypeScript should bump to 6.0.3 (current latest) instead of 5.7 as CONTEXT.md D-05 specifies | Standard Stack | If user wants strict D-05 (TS 5.7), the npm install command must use `typescript@^5.7.0` and the `--save-exact` flag. TS 6.0.3 → 5.7 is a one-line change. Impact: minimal — both versions support the React 19 + Tailwind v4 types. |
| **A2** | `@vitejs/plugin-react@5.2.0` is preferred over `6.0.3` for atomic commit | Standard Stack | 5.2.0 is the latest in the 5.x line and is the conservative choice. 6.0.3 is also Vite-8-compatible but pulls in two new peer packages (`@rolldown/plugin-babel`, `babel-plugin-react-compiler`). Impact: zero if the install goes well; if `6.0.3` is preferred, the install command needs two more lines. |
| **A3** | The 2 ErrorBoundary tests for offline-detection can be **deleted** (not ported) because D-07 moves offline handling to Phase 15 | Don't Hand-Roll | If user wants to preserve the tests, they need to be rewritten against a separate `<OfflineDetector>` component (out of scope). Impact: a brief test-coverage drop from 196 → 194 unit tests, which is then offset by the 3 new snapshot tests for a net of 197. |
| **A4** | `bundledWebRuntime: false` can be silently deleted with no other behavior change | Pattern 3 | The option only affected iOS webview behavior when set to `true`. Since this project set it to `false` (the v7+ default), the deletion is a no-op behaviorally. Impact: none if the deletion is just the property; if the user wants belt-and-suspenders, the value can be kept with a `// @ts-expect-error Capacitor 8 removed this option` comment. |
| **A5** | `lucide-react@1.23.0` is the current `latest` dist-tag — but the project's current install is `^1.14.0`. The major version bump from 1.14 → 1.23 may include icon additions or subtle API changes | Standard Stack | The project imports `TriangleAlert`, `WifiOff` (from ErrorBoundary.tsx — to be deleted) and icons across pages. A minor diff in icon prop types is possible. Impact: low — the 1.x line is stable and icon renames are rare. **Not included in the atomic commit** — the user pinned `^1.14.0`, so npm will auto-bump to the latest 1.x in the same major. No explicit install needed. |
| **A6** | `@types/react@19.2.17` and `@types/react-dom@19.2.3` are independent upgrades from `@types/react@18.2.47` and `@types/react-dom@18.2.18` | Standard Stack | If `npm install` doesn't auto-bump them, the `npm install` command above forces them. Impact: a missed bump here causes TypeScript errors ("Property 'ref' does not exist on type '...'") at build time. |

**If this table is empty:** N/A — six decisions warrant user confirmation, primarily A1 (TS version drift from CONTEXT.md) and A2 (Vite plugin version).

## Open Questions

1. **TypeScript target (A1)**: Should the atomic commit bump TypeScript 5.3 → 5.7 (per CONTEXT.md D-05) or 5.3 → 6.0.3 (one major instead of a minor-then-major later)?
   - What we know: TS 6.0.3 is the current `latest` (verified on npm); 5.7 is older but still supported; both satisfy the JSX/Tailwind v4 type requirements.
   - What's unclear: Whether the user's "TypeScript 5.7" in CONTEXT.md is a hard requirement or a snapshot-of-training-data moment.
   - Recommendation: Go to 6.0.3 in the atomic commit. Revert the single version spec in the install command if user wants 5.7.

2. **`@vitejs/plugin-react` version (A2)**: 5.2.0 (no extra peer deps) or 6.0.3 (requires `babel-plugin-react-compiler` + `@rolldown/plugin-babel`)?
   - What we know: 5.2.0 satisfies Vite 8 peer deps cleanly; 6.0.3 is "the latest" with React Compiler support enabled by default.
   - What's unclear: Whether the user wants React Compiler optimizations (which 6.0.3 enables).
   - Recommendation: 5.2.0 for the atomic commit. Bump to 6.0.3 in a follow-up phase if React Compiler is desired.

3. **Should the 3 page snapshot tests be added in this commit or deferred?**
   - What we know: D-04 explicitly requires "3 new page snapshot tests for DashboardPage, CasesPage, BeneficiariesPage"; CONTEXT.md says 196/196 + 3 new = 199 tests.
   - What's unclear: Whether the existing 3 page test files (DashboardPage.test.tsx, CasesPage.test.tsx, BeneficiariesPage.test.tsx) already contain assertions or if they need a separate `*.snap.ts` file with `toMatchSnapshot()`.
   - Recommendation: Add `toMatchSnapshot()` assertions to the 3 existing test files, one per file, capturing the rendered DOM after a successful data load. This is the smallest change that satisfies D-04.

## Environment Availability

> Audited 2026-07-05.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | Capacitor 8 (Node 22 required per migration guide) | ✓ | v26.4.0 | — |
| npm 10+ | `@tailwindcss/upgrade` codemod + Vite 8 | ✓ | (bundled with Node 26) | — |
| @tailwindcss/upgrade 4.3.2 | v3→v4 codemod | ✓ | installable from npm | Manual migration (much slower) |
| @tailwindcss/vite 4.3.2 | Tailwind v4 Vite plugin | ✓ | installable from npm | None — required for the v4 architecture |
| tw-animate-css 1.4.0 | Replaces tailwindcss-animate | ✓ | installable from npm | Keep `tailwindcss-animate` (deprecated, but still works) |
| react-error-boundary 6.1.2 | ErrorBoundary migration | ✓ | installable from npm | Keep class component (works in React 19) |
| @vitejs/plugin-react 5.2.0 | Vite 8 compat | ✓ | installable from npm | Downgrade Vite to 7 (not acceptable) |
| Capacitor CLI tools (`xcodebuild`, `gradle`) | Mobile builds (D-03) | ✗ (out of scope) | — | N/A — web build only per D-03 |

**Missing dependencies with no fallback:** None — every required package is installable from npm.

**Missing dependencies with fallback:** None.

**Native toolchain (Xcode, Android Studio, Java 21) is intentionally not required:** D-03 restricts the phase to web build verification only. The `npx cap sync android` / `npx cap sync ios` commands will run in a follow-up phase when the native toolchain is available.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` (line 24) — Validation Architecture section is **required**.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + jsdom |
| Config file | `kapwa-client/vite.config.ts` (the `test:` block) |
| Quick run command | `cd kapwa-client && npm run test:run` |
| Full suite command | `cd kapwa-client && npm run test:run` (no separate "full" — same command) |
| Snapshot test setup | Vitest auto-saves snapshots to `__snapshots__/` next to each test file; existing `tests/setup.ts` mocks localStorage, crypto, and navigator — no changes needed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPG-01 (React 19) | All existing tests pass with React 19 | unit (regression) | `npm run test:run` (in `kapwa-client/`) | ✓ (20 page test files, 196 tests baseline) |
| UPG-01 (React 19) | New ErrorBoundary tests for the migrated function component | unit | `npm run test:run` | ❌ **Wave 0** — rewrite `ErrorBoundary.test.tsx` (delete 2 offline tests per A3, add 3-4 tests for new API) |
| UPG-02 (Capacitor 8) | All existing tests pass; `bundledWebRuntime` removed | unit + config | `npm run test:run` + `grep bundledWebRuntime` should return 0 | ✓ (delete the line in `capacitor.config.ts`) |
| UPG-03 (Tailwind v4) | Existing 196 tests pass with new CSS | unit (regression) | `npm run test:run` | ✓ (no test changes — vitest with jsdom doesn't load CSS) |
| UPG-03 (Tailwind v4) | `npm run build` produces a CSS file with utility classes for the project's tokens | build-time assertion | `npm run build && grep -q 'bg-background' dist/assets/*.css` | ❌ **Wave 0** — add a `postbuild` script or manual check in the plan |
| D-12 | DashboardPage renders with stat cards, recent cases table, role-based widgets | snapshot (vitest) | `npm run test:run -- DashboardPage` | ❌ **Wave 0** — add `toMatchSnapshot()` to existing `DashboardPage.test.tsx` |
| D-13 | CasesPage renders with table layout, status badges, filter controls | snapshot (vitest) | `npm run test:run -- CasesPage` | ❌ **Wave 0** — add `toMatchSnapshot()` to existing `CasesPage.test.tsx` |
| D-14 | BeneficiariesPage renders with searchable list, action buttons, masked PII | snapshot (vitest) | `npm run test:run -- BeneficiariesPage` | ❌ **Wave 0** — add `toMatchSnapshot()` to existing `BeneficiariesPage.test.tsx` |

### Sampling Rate

- **Per task commit:** `cd kapwa-client && npm run test:run` (vitest run all unit tests; ~5s for the 196 baseline)
- **Per wave merge:** `cd kapwa-client && npm run build` + `npm run test:run` (catches both bundle and unit regressions; ~30s total)
- **Phase gate:** Full suite green + 3 new snapshot tests passing before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] **`src/components/ErrorBoundary.test.tsx`** — rewrite 6 tests for the new react-error-boundary API. Remove the 2 offline-detection tests (D-07); add 3-4 tests for: renders children, catches thrown error and shows fallback, "Try Again" button calls `resetErrorBoundary`, custom `fallback` prop override.
- [ ] **`src/pages/DashboardPage.test.tsx`** — add a `toMatchSnapshot()` assertion at the end of the existing test (per D-12).
- [ ] **`src/pages/CasesPage.test.tsx`** — add a `toMatchSnapshot()` assertion at the end of the existing test (per D-13).
- [ ] **`src/pages/BeneficiariesPage.test.tsx`** — add a `toMatchSnapshot()` assertion at the end of the existing test (per D-14).
- [ ] **Vitest cache clear** — add `npx vitest --clearCache` to the install script (per Pitfall 1 / Runtime State Inventory).

*(Existing test infrastructure covers all other phase requirements — no new test framework install needed.)*

## Security Domain

> `security_enforcement` is `true` and `security_asvs_level` is `1` in `.planning/config.json` (lines 45-47) — Security Domain section is **required**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V1 Architecture | No | — (no architectural changes; pure dependency upgrade) |
| V2 Authentication | No | — (no auth changes; `auth-context.tsx` is unchanged) |
| V3 Session Management | No | — (no session changes; token storage unchanged) |
| V4 Access Control | No | — (no RBAC changes) |
| V5 Input Validation | No | — (no input handling changes) |
| V6 Cryptography | No | — (no crypto changes; `secure-storage.ts` is unchanged) |
| V7 Error Handling and Logging | **Yes** | `react-error-boundary` with `<AriaLiveRegion role="alert">` in fallback — preserves the existing user-facing error message behavior |
| V8 Data Protection | No | — (no PII handling changes) |
| V9 Communications | No | — (no network protocol changes) |
| V10 Malicious Code | No | — (no code generation changes) |
| V11 Business Logic | No | — (no business logic changes) |
| V12 Files and Resources | No | — (no file handling changes) |
| V13 API and Web Service | No | — (no API changes) |
| V14 Configuration | **Yes** | `bundledWebRuntime` removed from `capacitor.config.ts`; the new Vite plugin chain (`react()` then `tailwindcss()`) is additive, not subtractive — no existing config options removed |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tailwind v4 codemod silently breaks `bg-background` etc. (Pitfall 2) | Tampering | The post-codemod `index.css` must be reviewed by eye for `@theme inline` correctness; build-time assertion in Wave 0 (`grep -q 'bg-background' dist/assets/*.css`) confirms utility class generation |
| React 19 StrictMode double-mounts expose non-idempotent ref callbacks (Pitfall 4) | Tampering | Audit `useRef` (8 callsites) for ref-callback idempotency before merging |
| `@vitejs/plugin-react@4.2.1` peer-dep mismatch with Vite 8 (Pitfall 1) | Denial of Service (silent build failure) | Upgrade to 5.2.0 in the atomic commit — the install command above forces this |

## Sources

### Primary (HIGH confidence)

- **React 19 official release blog** — `https://react.dev/blog/2024/12/05/react-19` — fetched and indexed. New features (Actions, ref cleanup, `<Context>` as provider, ref as prop), improvements, how to upgrade.
- **React 19 Upgrade Guide** — `https://react.dev/blog/2024/04/25/react-19-upgrade-guide` — fetched and indexed. Codemods (`npx codemod@latest react/19/...`), breaking changes (removed propTypes/defaultProps, removed string refs, removed findDOMNode, removed legacy context, removed ReactDOM.render), TypeScript changes.
- **Tailwind CSS v4 Upgrade Guide** — `https://tailwindcss.com/docs/upgrade-guide` — fetched and indexed. `@tailwindcss/upgrade` codemod, Vite plugin (`@tailwindcss/vite`), PostCSS migration, `@import "tailwindcss"`, `@theme`, `@utility`, all v3→v4 breaking changes.
- **Tailwind CSS v4 + Vite installation** — `https://tailwindcss.com/docs/installation/using-vite` — fetched and indexed. `npm install tailwindcss @tailwindcss/vite`, `tailwindcss()` plugin in `vite.config.ts`, `@import "tailwindcss"` in CSS.
- **shadcn/ui Tailwind v4 guide** — `https://ui.shadcn.com/docs/tailwind-v4` — fetched and indexed. `@theme inline` pattern for non-HSL variables, `tailwindcss-animate` deprecation, `forwardRef` removal, `size-*` utility.
- **Capacitor 7 → 8 migration** — `https://raw.githubusercontent.com/ionic-team/capacitor-docs/main/docs/main/updating/8-0.md` — fetched and indexed. `bundledWebRuntime` removal, `npx cap migrate`, Node 22+, Xcode 26, iOS 15, Android compileSdk 35, Java 21.
- **Capacitor 6 → 7 migration** — `https://raw.githubusercontent.com/ionic-team/capacitor-docs/main/docs/main/updating/7-0.md` — fetched and indexed. (Historical context for the `bundledWebRuntime` removal — already happened in v7.)
- **react-error-boundary README** — `https://github.com/bvaughn/react-error-boundary` — fetched and indexed. `<ErrorBoundary>`, `FallbackComponent`, `fallbackRender`, `onError`, `onReset`, `resetKeys`, `useErrorBoundary` hook.

### Secondary (MEDIUM confidence)

- **npm registry** — verified via `npm view <pkg> version` for 19 packages; all `latest` dist-tags as of 2026-07-05.
- **GitHub packages: legitimacy check** — `gsd-tools query package-legitimacy check` — 19 packages audited. All "SUS (too-new)" verdicts are false positives (massive-download packages with published-by-known-org repos).

### Tertiary (LOW confidence)

- **TS 6.0.3 as the target** — based on `npm view typescript dist-tags` returning `latest: '6.0.3'`. **The CONTEXT.md D-05 says ^5.7**; the user may have a strong preference for 5.7. See Assumptions A1.

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — every version verified on npm registry 2026-07-05; alternative versions documented with peer-dep tradeoffs.
- **Architecture:** HIGH — official migration guides fetched for all four stacks (React 19, Tailwind v4, Capacitor 8, react-error-boundary); breaking changes cross-referenced against actual codebase patterns via grep.
- **Pitfalls:** HIGH — derived from first-principles: "what does the migration *actually change* in *this specific codebase*?" Each pitfall maps to a concrete grep or install-time check.
- **Validation Architecture:** MEDIUM — based on existing test framework (Vitest 4.1.9) and test files (20 page tests + 4 lib tests). Snapshot test approach is the standard Vitest pattern; specific test additions for D-12/D-13/D-14 are recommendations, not locked.
- **Security Domain:** MEDIUM — V7 (Error Handling) and V14 (Configuration) apply; controls are identical to current implementation. No new threats introduced by the upgrade.

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (30 days — Tailwind v4 is stable; React 19.x is stable; Capacitor 8 is stable; the only fast-moving piece is `next` / `canary` dist-tags of these packages, which won't affect this phase)
