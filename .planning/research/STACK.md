# Technology Stack

**Project:** Kapwa — MSWDO Norzagaray (UI/UX Overhaul)
**Researched:** 2026-06-27
**Confidence:** HIGH

## Executive Summary

The existing Kapwa frontend uses React 18 + Vite + Tailwind CSS v3 + shadcn (partial) + Capacitor 6 PWA. The UI/UX overhaul needs **five targeted additions**: an animation library (motion/react), a form library (react-hook-form + zod), a toast system (sonner), additional Radix primitives (auto-installed via shadcn CLI), and print/accessibility utilities (CSS + Radix built-in). No major framework migration is needed. The `@base-ui/react` package in the current deps is unused by shadcn and can be removed to reduce bundle size (~5.4MB unpacked). Bundle impact of all additions: ~50kb gzipped, bringing the total PWA bundle to ~190kb — within acceptable range for a field-deployed PWA with code splitting.

**CRITICAL DECISION:** Use `motion/react` (the renamed framer-motion, v12.42+) with `LazyMotion` + `domAnimation` to keep animation bundle at ~15kb gzipped. **Do NOT** use react-spring (heavier, no longer best choice), GSAP (overkill, commercial licensing complexity), or CSS-only (cannot handle exit animations, layout animations, or gesture-driven micro-interactions needed for this overhaul).

---

## Recommended Stack (Additions Only)

### Animation & Micro-Interactions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `motion/react` (from framer-motion) | 12.42+ | Declarative animations, gestures, layout animations, exit animations | Renamed successor of framer-motion; smallest React animation library with `useAnimate` at 2.3kb or `LazyMotion + m` at ~4.6kb initial + 15kb feature load; handles everything from micro-interactions to page transitions |
| `tailwindcss-animate` | ^1.0.7 | CSS animation utility extensions for Tailwind | Already in deps; keep for CSS-based transitions (hover, focus, active) where Motion would be overkill |

**Why not CSS-only:** The UI overhaul requires exit animations (AnimatePresence for routes/modals), gesture-driven interactions (tap/hover on mobile), layout animations (shifting content), and staggered children animations — all either impossible or excessively complex with pure CSS. Motion's `LazyMotion` pattern lets us keep animation payload off the critical path.

**Why not react-spring:** 8.5kb gzipped but lacks exit animations, gesture support, and layout animations. Motion offers all three in ~15kb with lazy loading. react-spring's physics-based model is overkill for UI micro-interactions.

**Why not GSAP:** 25kb gzipped, not React-native (requires manual cleanup), commercial license considerations for thesis deployment. GSAP excels at timeline-based narrative animation (marketing sites, explainers) — not what an MSWDO case management app needs.

**Motion integration with existing Tailwind config:**
```typescript
// Use motion components ALONGSIDE existing Tailwind classes, not instead of them
import { motion } from "motion/react"

<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
>
  Submit
</motion.button>
```

```typescript
// LazyMotion pattern for PWA performance (keep animation off critical path)
import { LazyMotion, m, domAnimation } from "motion/react"

function MyComponent() {
  return (
    <LazyMotion features={domAnimation}>
      <m.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
        Content
      </m.div>
    </LazyMotion>
  )
}
```

### Form Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | ^7.54.0 | Performant form state management | Zero dependencies, 9kb gzipped, built for React 18, embraces native HTML validation, integrates with any UI library |
| `zod` | ^4.4.0 | Schema validation | **Already on the backend** (NestJS API boundary validation). Reusing the same Zod schemas on frontend eliminates validation duplication — the single source of truth for all form validation. |
| `@hookform/resolvers` | ^5.0.0 | Bridges react-hook-form with Zod | Enables `zodResolver(schema)` pattern for seamless integration |
| `@radix-ui/react-label` | ^2.1.0 | Accessible label primitive | Required by shadcn form component; provides proper htmlFor/aria associations |

**Shadcn form integration:**
```bash
npx shadcn@latest add form
# This auto-installs react-hook-form, @hookform/resolvers, zod, @radix-ui/react-label
```

**Why not Formik:** Formik is ~13kb gzipped, causes more re-renders, and has a less intuitive API. RHF's register/errors pattern is cleaner for the 20+ form-heavy screens in Kapwa (GIS intake, IRF, intervention logging).

**Why not Final Form:** Less maintained, smaller community, fewer shadcn/examples integrations.

### Notifications & Toast

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `sonner` | ^2.0.7 | Toast notifications | 0 dependencies, ~5kb gzipped, built-in positioning, accessible (auto-announces to screen readers), shadcn-standard toast solution |

**Sonner integration in existing shadcn setup:**
```bash
npx shadcn@latest add sonner
# This creates src/components/ui/sonner.tsx wrapping the sonner <Toaster />
```

Then in `App.tsx`:
```tsx
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      {/* routes */}
    </>
  )
}

// Usage:
// toast.success("Case approved")
// toast.error("Validation failed")
// toast.promise(saveAction(), { loading: "Saving...", success: "Done", error: "Failed" })
```

**Why not radix-ui/react-toast:** Sonner provides a higher-level API (auto-positioning, swipe-to-dismiss, promise toasts) with the same accessibility guarantees. Radix Toast is a primitive — you'd need to build everything Sonner already provides.

**Why not react-hot-toast:** Heavier bundle (~7kb), less accessible (no built-in screen reader announcements), no richColors variant.

### Additional Radix Primitives (auto-installed via shadcn CLI)

These are **not manual additions** — they install automatically when you run `npx shadcn@latest add [component]`:

| Radix Package | shadcn Component That Needs It | Purpose for Kapwa |
|---------------|-------------------------------|-------------------|
| `@radix-ui/react-dialog` ^1.1.0 | dialog, sheet | Confirm dialogs, modal forms, slide-in panels for mobile |
| `@radix-ui/react-dropdown-menu` ^2.1.0 | dropdown-menu | User menu, action menus on case/beneficiary cards |
| `@radix-ui/react-select` ^2.3.0 | select | Dropdowns for barangays, fund sources, program categories |
| `@radix-ui/react-tabs` ^1.1.0 | tabs | Tabbed forms (GIS intake sections), case detail views |
| `@radix-ui/react-tooltip` ^1.2.0 | tooltip | Field hints, truncated text reveals, icon explanations |
| `@radix-ui/react-alert-dialog` ^1.1.0 | alert-dialog | Destructive confirmations (delete, revoke consent) |
| `@radix-ui/react-checkbox` ^1.2.0 | checkbox | Requirement checklists, consent checkboxes |
| `@radix-ui/react-radio-group` ^1.3.0 | radio-group | Single-select options in forms |
| `@radix-ui/react-switch` ^1.2.0 | switch | Toggle settings, feature flags in admin panel |
| `@radix-ui/react-progress` ^1.1.0 | progress | Loading progress indicators, sync status |
| `@radix-ui/react-scroll-area` ^1.2.0 | scroll-area | Custom scrollable containers in sidebars, modals |
| `@radix-ui/react-collapsible` ^1.2.0 | collapsible | Expandable sections, accordion-style forms |
| `@radix-ui/react-slider` ^1.3.0 | slider | Range inputs (fund allocation percentages) |
| `@radix-ui/react-toast` ^1.2.0 | toast | If not using Sonner; kept for shadcn toast component compatibility |

**Install command:**
```bash
# Add ALL commonly needed shadcn components at once:
npx shadcn@latest add dialog dropdown-menu select tabs tooltip alert-dialog checkbox radio-group switch progress scroll-area collapsible skeleton sheet table textarea form sonner navigation-menu sheet
```

This installs ~15 component files into `src/components/ui/` and adds any missing Radix dependencies to `package.json`.

### Accessibility & Focus Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| (Radix primitives) | per-package | ARIA, keyboard nav, focus trapping | Already handle 90% of a11y requirements natively — no extra abstraction needed |
| `useReducedMotion()` from motion/react | included | Respect user motion preferences | Built into motion; disables animations when user prefers reduced motion |
| Native React `useRef` + `useEffect` | N/A | Page-level focus management | After route changes or modal closes, focus the page heading. Simple ref-based pattern, no library needed. |

**Focus management pattern (no library needed):**
```tsx
import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

function PageContainer({ title, children }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    headingRef.current?.focus()
    // Announce page change to screen readers
  }, [pathname])

  return (
    <main>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {title}
      </h1>
      {children}
    </main>
  )
}
```

**Why no aria-live regions library:** Sonner auto-announces toasts. Radix components handle live regions for dialogs, alerts, and tabs. Custom loading states can use a simple `aria-live="polite"` div. No `react-aria-live` or `react-announce` needed.

### Print Styles

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `@media print` | N/A | Report/access card print formatting | Zero bundle cost, fully supported, best practice for any web app generating paper documents |

**Print style implementation pattern:**
```css
/* src/index.css */
@media print {
  /* Hide non-printable elements */
  nav, .sidebar, .toolbar, button, footer, .no-print { display: none !important; }

  /* Ensure backgrounds print (access cards, reports) */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Set page margins for report binding */
  @page { margin: 1.5cm; size: A4 portrait; }

  /* Typography for print */
  body { font-size: 11pt; color: black; background: white; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; }

  /* Avoid page breaks in the middle of cards/tables */
  .card, table, tr { break-inside: avoid; }
}
```

### Utilities (Already in Stack, Keep)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `lucide-react` | ^1.14.0 | Icon library | Already present, tree-shakeable, shadcn-standard. **Keep.** |
| `clsx` | ^2.1.1 | Conditional class merging | Already present, required by cn() helper. **Keep.** |
| `tailwind-merge` | ^3.6.0 | Deep class deduplication | Already present, required by cn() helper. **Keep.** |
| `class-variance-authority` | ^0.7.1 | Component variant APIs | Already present, required by shadcn variants pattern. **Keep.** |
| `tailwindcss-animate` | ^1.0.7 | CSS animation utilities | Already present. **Keep.** Used for CSS-only animations (hover transitions, focus rings) alongside Motion for complex interactions. |

---

## Complete Installation Command

```bash
# Core animation + form + toast
npm install motion react-hook-form zod @hookform/resolvers sonner

# Then add all needed shadcn components (auto-installs Radix deps)
npx shadcn@latest add dialog dropdown-menu select tabs tooltip alert-dialog checkbox radio-group switch progress scroll-area collapsible skeleton sheet table textarea form sonner navigation-menu

# Optional cleanup — remove @base-ui/react if confirmed unused (see below)
# npm uninstall @base-ui/react
```

---

## What NOT to Add

| Library | Why You Might Consider It | Why NOT for Kapwa |
|---------|-------------------------|-------------------|
| `@base-ui/react` | Newer headless library from Radix/MUI team | Already in deps but **unused by shadcn**. The existing components.json and UI components use individual `@radix-ui/react-*` packages — @base-ui/react is not the foundation for shadcn components. ~5.4MB unpacked. Remove after verifying nothing imports from it. |
| `vaul` (drawer) | Mobile drawer component | **Repo is unmaintained** (last release Dec 2024, marked unmaintained by author). Risk of React 19 compatibility issues. Use shadcn "Sheet" component instead (built on Radix Dialog with CSS slide-in). |
| `cmdk` (command palette) | ⌘K command menu for power users | 80kb unpacked, 4 dependencies, uncertain ROI for MSWDO field workers. Defer to future admin UX phase. |
| `react-day-picker` | Date picker | Already installable via `npx shadcn@latest add calendar` (wraps react-day-picker). Add only when date picking is actually needed — not proactively. |
| `framer-motion` | Old package name | **Do NOT install.** The library was renamed to `motion` in v12. `framer-motion` is still maintained as a re-export wrapper but `motion` is the canonical package. |
| `react-query` / `@tanstack/react-query` | Data fetching | SWR is already in deps and working. Overhauling data fetching is out of scope. SWR is sufficient for the UI polish phase. |
| `zustand` / `jotai` / `valtio` | State management | The app already uses React context (auth) + SWR (server state) + local component state. Adding a state manager is unnecessary complexity for this phase. |
| `@react-aria/focus` | Focus management | Radix already handles focus within interactive widgets. Page-level focus is trivially handled with `useRef` + `useEffect`. No library needed. |
| `react-focus-lock` / `focus-trap-react` | Focus trapping | Radix Dialog, AlertDialog, and DropdownMenu already trap focus internally. Do NOT add another focus library that could conflict. |
| `recharts` / `nivo` / `chart.js` | Charts/dashboards | Not in scope for UI overhaul. When charts are needed later, evaluate then. |

---

## Bundle Size Impact Assessment (PWA-Critical)

All values are **minified + gzipped**. This matters because Kapwa is a PWA — initial load budget is constrained.

| Library | Size (gzip) | Load Strategy | Impact on FCP/LCP |
|---------|-------------|---------------|-------------------|
| `motion/react` (LazyMotion + domAnimation) | ~15kb | **Lazy** (off critical path) | Zero on initial page load; ~15kb when animation-featured component mounts |
| `react-hook-form` | ~9kb | **Eager** (used on most pages) | ~9kb added to bundle; forms are core to every page |
| `zod` | ~12kb | **Eager** (shared from backend) | Already anticipated; zod schemas can be code shared between frontend and backend |
| `@hookform/resolvers` | ~3kb | Eager | Negligible |
| `sonner` | ~5kb | Eager | Negligible |
| New Radix deps (combined) | ~8kb | Eager | Auto-code-split by module bundler; only used when component is rendered |
| New shadcn component files | ~8kb | Per-route | Only loaded when route uses the component |
| **Total added** | **~50kb** | Mixed | Acceptable for PWA; target <200kb initial parse |

**Comparison to current bundle:** The existing bundle is roughly 130-140kb gzipped (React + ReactDOM + router + SWR + socket.io + Capacitor + lucide + existing Radix). Adding ~50kb brings it to ~180-190kb — well within the 200kb PWA performance budget, especially with route-level code splitting already in place (Vite's default).

**Caveat:** If zod v4.4's bundle is significantly larger than zod v3.x, consider pinning to zod v3.23 for frontend (backend keeps v4). v3 is ~7kb gzipped vs v4 potentially ~12kb. Verify with Bundlephobia before committing.

---

## Integration Points with Existing Config

### tailwind.config.js (current — keep as-is)
The existing config already has CSS variable-driven colors, shadcom borderRadius tokens, and the `tailwindcss-animate` plugin. **No changes needed for the new libraries.** Motion uses inline styles for runtime animations (not Tailwind classes), so it coexists seamlessly.

### components.json (current — update)
The existing `components.json` is correctly configured with:
- `style: "default"` — Keep. This matches the existing button/card/input style.
- `rsc: false` — Correct (no Next.js).
- `tailwind.cssVariables: true` — Already set, CSS variables in index.css.
- `aliases: { "@/*": ["./src/*"] }` — Already correct.
- `iconLibrary: "lucide"` — Correct.

**No changes needed** unless switching to `new-york` style (not recommended mid-project — would break existing component files).

### index.css (current — add print styles and reduced-motion)
The existing `index.css` has shadcn CSS variables and legacy component classes. Add:

```css
/* Reduced motion — respect OS preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Print styles — keep at bottom of file */
@media print {
  /* ... as documented above ... */
}
```

---

## Library Ownership & Maintenance Risk

| Library | Maintainer | Status | Risk Level | Fallback |
|---------|-----------|--------|------------|----------|
| `motion` | Motion Team (Matt Perry et al.) | Active, 30M+ weekly downloads | **Low** | Framed as industry standard; exit to CSS-only possible for basic cases |
| `react-hook-form` | Bluebill/Beier | Active, 9K+ dependents | **Low** | Manual form handling with useState (painful but possible) |
| `zod` | Colin McDonnell | Active, v4 released | **Low** | Reuse TypeScript interfaces manually |
| `sonner` | Emil Kowalski | **Last published a year ago** | **Medium** | Radix Toast primitive (more work but same accessibility) |
| `lucide-react` | Lucide Team | Active | **Low** | SVG icons, could inline |
| Radix UI packages | Radix/MUI Team | Active | **Low** | Mature, stable API |

**Sonner risk mitigation:** Despite the year since last publish, sonner is stable and complete — there's little churn in toast libraries. If issues arise, the shadcn sonner wrapper can be trivially rewritten to use `@radix-ui/react-toast` directly without changing calling code.

---

## Migration Path

### Phase A: Foundation (No regressions)
1. Run `npx shadcn@latest init` to ensure components.json is fully up-to-date
2. Run `npx shadcn@latest add` with the component list above — this auto-installs Radix deps
3. Verify existing UI components (button, card, input, etc.) are untouched
4. Install `motion`, `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`
5. Add print styles and reduced-motion to `index.css`
6. **Run full build** — confirm no breaking changes, PWA still works

### Phase B: Consume (Incremental adoption)
7. Add shadcn `form` component — wraps react-hook-form + zod integration
8. Add shadcn `sonner` component — wraps sonner Toaster
9. Add `LazyMotion` + `domAnimation` to the root layout component
10. Start using `motion.div` for page enter/exit animations

---

## Sources

- [npm registry — motion v12.42](https://www.npmjs.com/package/motion) — HIGH confidence
- [motion.dev — React quickstart & bundle size guide](https://motion.dev/docs/react-quick-start) — HIGH confidence, official docs
- [npm registry — framer-motion v12.42](https://www.npmjs.com/package/framer-motion) — HIGH confidence
- [npm registry — sonner v2.0.7](https://www.npmjs.com/package/sonner) — HIGH confidence
- [npm registry — react-hook-form v7.80](https://www.npmjs.com/package/react-hook-form) — HIGH confidence
- [npm registry — zod v4.4](https://www.npmjs.com/package/zod) — HIGH confidence
- [npm registry — @hookform/resolvers v5.4](https://www.npmjs.com/package/@hookform/resolvers) — HIGH confidence
- [npm registry — Radix UI packages](https://www.npmjs.com/org/radix-ui) — HIGH confidence
- [npm registry — @base-ui/react v1.6](https://www.npmjs.com/package/@base-ui/react) — HIGH confidence
- [npm registry — cmdk v1.1](https://www.npmjs.com/package/cmdk) — HIGH confidence
- [PkgPulse — React Animation Libraries Comparison 2026](https://www.pkgpulse.com/guides/framer-motion-vs-motion-one-vs-autoanimate-2026) — MEDIUM confidence
- [Syncfusion — Choosing React Animation Libraries 2026](https://www.syncfusion.com/blogs/post/react-animation-libraries-comparison) — MEDIUM confidence
- [vaul GitHub — Unmaintained notice](https://github.com/emilkowalski/vaul) — HIGH confidence
- Existing Kapwa codebase audit (package.json, components.json, index.css, tailwind.config.js, src directory) — HIGH confidence
