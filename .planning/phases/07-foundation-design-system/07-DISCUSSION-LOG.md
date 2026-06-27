# Phase 07: Foundation & Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 07-Foundation & Design System
**Areas discussed:** Token scope, Legacy CSS strategy, Dark mode timing, shadcn component installs

---

## Token Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive | Colors + spacing (4/8/12/16/24/32/48/64) + typography + shadows + radius + border-width | ✓ |
| Minimal | Colors + border-radius only | |
| Expanded | Colors + spacing + shadows | |

**User's choice:** Comprehensive
**Notes:** Full design token spec in one phase. Naming uses `--color-*`, `--spacing-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--shadow-*`, `--radius-*`, `--border-*` prefixes. Existing short names remain as aliases.

---

## Legacy CSS Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Move to @layer legacy | Move ALL ~40 legacy classes to @layer legacy immediately | ✓ |
| Leave in @layer components | Keep as-is, risk of specificity conflicts | |

**User's choice:** Move to @layer legacy
**Notes:** Clean isolation prevents specificity wars with new shadcn/Tailwind utilities. Pages continue using legacy classes until Phase 11 replaces them. Place @layer legacy after @layer utilities.

---

## Dark Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Define .dark block now | All core token overrides in .dark block, ready for Phase 8 toggle | ✓ |
| Defer to later phase | Ship light only, dark becomes Phase 12 a11y item | |

**User's choice:** Define .dark block now
**Notes:** Uses class-based dark mode (`darkMode: "class"` in tailwind.config.js). Toggle goes in Phase 8 user menu.

---

## shadcn Component Installs

| Option | Description | Selected |
|--------|-------------|----------|
| Install all now | skeleton, dialog, alert-dialog, sheet, table, dropdown-menu, tooltip, select, checkbox, tabs, breadcrumb, navigation-menu, sonner, command | ✓ |
| Install per-phase | Only skeleton now, rest added when needed | |

**User's choice:** Install all now
**Notes:** Prevents install conflicts later. Makes all components available to downstream phases immediately.

---

## Agent's Discretion

- MD syntax highlighting in index.css — incidental cleanup.
- Exact `--color-*` naming — architect chooses; old names kept as aliases.
- CSS import ordering within index.css.
- `@base-ui/react` removal verification (grep sweep).

## Deferred Ideas

None — discussion stayed within phase scope.
