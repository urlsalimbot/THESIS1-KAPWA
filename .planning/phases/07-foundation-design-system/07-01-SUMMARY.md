---
phase: 07-foundation-design-system
plan: 01
subsystem: design-system
tags:
  - css
  - tailwind
  - design-tokens
  - dark-mode
  - dependencies
key-files:
  - kapwa-client/src/index.css
  - kapwa-client/tailwind.config.js
  - kapwa-client/package.json
  - kapwa-client/package-lock.json
metrics:
  tokens_added: 43
  files_modified: 4
  build: passing
---

# Plan 07-01: Design Token System & Theme Mapping

## Summary

Established the foundational design token system for Kapwa's v1.1 UI/UX overhaul. Expanded CSS custom properties from colors-only to full spacing/typography/shadows/border-width tokens, defined `.dark` mode overrides, updated Tailwind config with 7 theme extensions, and removed unused `@base-ui/react` dependency.

## Commits

| # | Hash | Description |
|---|------|-------------|
| 1 | 9e71d7f | feat(07-01): establish design token system - CSS custom properties, dark mode, tailwind extensions, remove @base-ui/react |

## Tasks Executed

| Task | Status | Details |
|------|--------|---------|
| Task 1: Expand :root CSS and define .dark mode block | ✅ | Added 43 new CSS custom properties (spacing, typography, shadows, border-width, font-heading/body) to :root; defined .dark block with 16 color token overrides |
| Task 2: Update tailwind.config.js with darkMode and token theme extensions | ✅ | Added darkMode: "class"; added 7 theme extensions (fontSize, fontWeight, spacing, boxShadow, borderWidth, fontFamily); updated fontFamily to CSS var references |
| Task 3: Remove @base-ui/react dependency | ✅ | Zero imports in src/ confirmed; npm uninstall removed 3 packages; package.json and package-lock.json updated |

## Deviations

None — all tasks executed exactly per plan.

## Self-Check: PASSED

- All spacing (8), font-size (7), font-weight (4), line-height (4), shadow (3), border-width (2), font-heading/body tokens present in :root
- .dark block overrides all 16 color tokens
- Existing short names (--primary, --background, etc.) preserved
- tailwind.config.js: darkMode: "class", all 7 theme extensions mapped to CSS vars
- @base-ui/react removed from package.json — zero imports in src/
- Consumer files preserved: colors, borderRadius, keyframes, animation, plugins intact
- Build passes (`npm run build` succeeds)
- Git diff: only 4 expected files modified (index.css, tailwind.config.js, package.json, package-lock.json)

## Artifacts

- `kapwa-client/src/index.css` — Expanded :root (43 new tokens) + .dark block (16 color overrides)
- `kapwa-client/tailwind.config.js` — darkMode: "class" + 7 theme extensions mapping to CSS vars
- `kapwa-client/package.json` — @base-ui/react removed
- `kapwa-client/package-lock.json` — Updated lockfile
