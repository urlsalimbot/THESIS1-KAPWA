# Phase 07: Foundation & Design System - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Install and wire the frontend design token system that every subsequent phase builds on. This phase establishes CSS custom properties for colors, spacing, typography, shadows, border-radius, and border-width; maps them to the Tailwind theme config; moves legacy CSS classes to `@layer legacy` to prevent specificity conflicts; defines the `.dark` block for dark mode; installs all remaining shadcn/ui components via CLI; and removes the unused `@base-ui/react` dependency.

Upstream phases (8-12) depend on these tokens — the sidebar, landing page, page-state components, per-page migration, and accessibility pass all use this system.
</domain>

<decisions>
## Implementation Decisions

### Token Scope
- **D-01:** Comprehensive design token system — colors, spacing scale (4/8/12/16/24/32/48/64), typography (font-size, font-weight, line-height), box-shadows, border-radius, border-width — all defined as CSS custom properties on `:root`.
- **D-02:** Token naming uses simple semantic names with prefixes: `--color-*` (e.g., `--color-primary`, `--color-accent`), `--spacing-*` (e.g., `--spacing-4` for 4px), `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--shadow-*`, `--radius-*`, `--border-*`.
- **D-03:** Existing short names (`--primary`, `--background`, etc.) remain as aliases for backward-compatibility with the current tailwind.config.js mapping.

### Legacy CSS Strategy
- **D-04:** All legacy component classes (`.page-header`, `.form-input`, `.table`, `.badge-**, `.stat-**, `.login-**, `.card`, etc.) are moved from `@layer components` to a new `@layer legacy` block. Pages continue using them until Phase 11 replaces each page group with shadcn equivalents.
- **D-05:** The `@layer legacy` blocks are placed after `@layer utilities` so shadcn/Tailwind utility classes always win specificity.
- **D-06:** No legacy classes are rewritten to shadcn in this phase — only re-layered.

### Dark Mode
- **D-07:** Define a `.dark` CSS block with overrides for all core color tokens. Uses `class`-based dark mode (Tailwind `darkMode: "class"`) so the Phase 8 toggle can add/remove the `.dark` class on `<html>`.
- **D-08:** Dark mode colors: dark background (`#0F172A`), light foreground (`#F8FAFC`), muted surfaces, adjusted accent for contrast on dark.

### shadcn Component Installations
- **D-09:** Install ALL planned shadcn components in this phase via `npx shadcn@latest add`: skeleton, dialog, alert-dialog, sheet, table, dropdown-menu, tooltip, select, checkbox, tabs, breadcrumb, navigation-menu, sonner, command.
- **D-10:** This ensures no install conflicts later and makes all components available to downstream phases immediately.

### @base-ui/react Removal
- **D-11:** The `@base-ui/react` dependency was already removed in a prior session. Verify zero remaining imports with a grep sweep; remove if still in package.json.

### Tailwind Config Updates
- **D-12:** Update tailwind.config.js `darkMode` to `"class"`.
- **D-13:** Add `fontSize`, `fontWeight`, `lineHeight`, `spacing`, `boxShadow`, `borderWidth` theme extensions mapped to CSS custom properties.
- **D-14:** Add `fontFamily` heading/body as CSS var references (`var(--font-heading)`, `var(--font-body)`).

### the agent's Discretion
- MD syntax highlighting in `index.css` — can be cleaned up incidentally.
- Renaming existing token names — architect to decide exact `--color-*` names; keep old names as aliases.
- CSS import ordering and organization within `index.css`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System & Styling
- `kapwa-client/src/index.css` — Current CSS with :root tokens, legacy @layer components, print styles. Starting point for all token work.
- `kapwa-client/tailwind.config.js` — Current Tailwind config mapping tokens. Must update darkMode, extensions.
- `kapwa-client/components.json` — shadcn components config. Verify cssVariables: true.

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Coding conventions (PascalCase components, camelCase functions, no path aliases on client).
- `.planning/codebase/STRUCTURE.md` — Directory layout (pages in src/pages/, components in src/components/, lib in src/lib/).
- `.planning/codebase/STACK.md` — Technology stack (React 18, Tailwind 3.4, Vite 8.0, shadcn partial).

### Research
- `.planning/research/SUMMARY.md` — Synthesis of all UI/UX research. Key guidance: CSS layer architecture, no framer-motion, motion/react only with LazyMotion.
- `.planning/research/STACK.md` — Stack recommendations (motion/react, react-hook-form+zod, sonner).
- `.planning/research/PITFALLS.md` — 11 pitfalls including CSS specificity war (Pitfall 1), design token silos (Pitfall 2), @base-ui/react unused (Pitfall 10).

### Requirements
- `.planning/REQUIREMENTS.md` — DSG-01 through DSG-05 define the scope for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `kapwa-client/src/index.css` — Partially complete design tokens (`:root` block with colors + radius). Needs expansion with spacing, typography, shadows, border tokens.
- `kapwa-client/tailwind.config.js` — Already maps theme colors to CSS vars. Pattern can be extended for new token categories.
- `kapwa-client/src/components/ui/` (7 components) — avatar, badge, button, card, input, popover, separator. All use CSS vars and work correctly.
- `@tailwindcss-animate` plugin — Already installed in tailwind.config.js plugins array.

### Established Patterns
- **CSS layers:** Existing `@tailwind base/components/utilities` + `@layer base {}` + `@layer components {}`. This pattern is correct and should be extended with `@layer legacy`.
- **CSS var naming:** Existing short flat names (`--primary`, `--background`). New tokens use `--color-*`, `--spacing-*` prefix convention.
- **shadcn integration:** Components already use `cn()` utility, CSS var references, and shadcn-standard class structure.

### Integration Points
- `components.json` — shadcn config. Token changes must keep `cssVariables: true`.
- `tailwind.config.js` — Each new CSS var category needs a tailwind theme extension entry.
- All 18 page components in `src/pages/` — Current consumers of legacy CSS classes (will be migrated Phase 11).
- `src/components/Layout.tsx` — Uses legacy classes for sidebar/topbar (will be migrated Phase 8).

</code_context>

<specifics>
## Specific Ideas

- Token expansion should follow a logical scale: spacing uses a 4px base step (4/8/12/16/24/32/48/64), matching Tailwind's native spacing scale but exposed as CSS vars.
- Dark mode colors draw from the same naming palette — `--color-primary` stays `#0F172A` in light mode, shifts to a lighter variant in dark mode.
- `@layer legacy` classes remain UNCHANGED in their CSS rules — only the layer directive changes. This is a pure re-layering, not a refactor.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-Foundation & Design System*
*Context gathered: 2026-06-27*
