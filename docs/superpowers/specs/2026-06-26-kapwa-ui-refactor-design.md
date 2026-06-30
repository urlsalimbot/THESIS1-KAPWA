# KAPWA Client — UI/UX Refactor Design

## Status: Approved

## Problem

The kapwa-client UI has multiple issues:
1. Tailwind CSS 3.4 is installed but **not wired up** (no PostCSS config, no `@tailwind` directives) — all arbitrary-value classes like `text-[#707070]`, `bg-[#F9FAFD]`, `shadow-card`, `font-heading` are dead code
2. 653-line `index.css` mixes structural, typographic, and component styles — hard to maintain
3. Inconsistent styling patterns — some pages use CSS classes, some use dead Tailwind arbitrary values
4. No loading/empty/error states on most pages
5. No responsive handling — sidebar is fixed-width, no collapsible behavior

## Approach

**Approach A — Complete Tailwind Setup + Design Tokens** (chosen)

Wire up PostCSS properly, define brand tokens in Tailwind config, strip dead CSS, refactor pages to use Tailwind utilities consistently.

## Design Tokens

### Colors
```
primary:       #2E5C8A   (buttons, active nav, header seal)
primary-dark:  #1E3D5C   (button hover)
primary-light: #E8F0F7   (nav active bg, badge bg)
surface:       #F9F9FD   (page background)
surface-white: #FFFFFF   (cards, sidebar, header)
border:        #E0E1E3   (table borders, card borders)
text-primary:  #1A1A1A   (body text)
text-secondary:#707070   (labels, descriptions)
text-muted:    #6B7280   (placeholders)
success-bg:    #D4EDDA   (approved badge bg)
success-text:  #155724   (approved badge text)
warning-bg:    #FFF3CD   (pending badge bg)
warning-text:  #856404   (pending badge text)
info-bg:       #D1ECF1   (review badge bg)
info-text:     #0C5460   (review badge text)
```

### Typography
- Body: `Inter` (400, 500, 600 weights)
- Headings: `Plus Jakarta Sans` (700 weight)

## Implementation Plan

### Phase 1: Foundation
- Add `postcss.config.js` with tailwindcss + autoprefixer
- Add `@tailwind base; @tailwind components; @tailwind utilities;` to `index.css`
- Define design tokens in `tailwind.config.js`
- Verify server reloads and Tailwind classes resolve

### Phase 2: CSS Cleanup
- Strip dead utility classes from `index.css` now covered by Tailwind
- Rewrite structural classes (`.header`, `.sidebar`, `.layout`) and UI classes (`.badge`, `.btn`, `.form-input`, `.table`) using `@apply` with token values
- Remove all inline arbitrary-value classes across all files

### Phase 3: Page Refactoring (priority order)
1. `LoginPage.tsx` — most visible broken page (shadow-card, font-heading dead classes)
2. `DashboardPage.tsx` — home screen, hooks bug already fixed
3. `CasesPage.tsx` — UAT-critical page
4. `Layout.tsx` — sidebar/header polish, offline banner
5. `IntakePage.tsx`, `BeneficiariesPage.tsx`, `InterventionsPage.tsx`
6. Remaining 13 pages

### Phase 4: UX Polish
- Loading states (spinners, skeleton placeholders)
- Empty states ("No records yet")
- Error boundaries per-page
- Responsive sidebar (collapsible on mobile)

## Non-Goals
- No component library (shadcn/ui, Radix) — Tailwind utilities only
- No design system beyond what's needed for current pages
- No Figma integration — design tokens extracted from existing codebase
