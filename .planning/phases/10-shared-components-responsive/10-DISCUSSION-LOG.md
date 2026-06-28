# Phase 10: Shared Components & Responsive - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 10-shared-components-responsive
**Areas discussed:** PageShell, Skeleton Designs, Empty State Variants, Error Boundary, Sonner Toasts, Bottom Tab Nav, 44px Touch Targets, Table Interactions

---

## PageShell Wrapper Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Title + Description + Actions | Sticky header with page title, description text, action buttons in one row | ✓ |
| Breadcrumbs + Title + Actions | Breadcrumb trail, then title below, actions right-aligned | |
| Title only, minimal | Just the page title, description and actions in content area | |

**User's choice:** Title + Description + Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed spacing, always visible | Consistent gap-6 or gap-8 between header and content | |
| Responsive spacing | Tighter on mobile (gap-4), wider on desktop (gap-8) | ✓ |
| Let each page decide | PageShell provides slots, pages control own spacing | |

**User's choice:** Responsive spacing

| Option | Description | Selected |
|--------|-------------|----------|
| Keep breadcrumbs in Layout | Breadcrumbs stay in Layout.tsx, PageShell handles per-page only | ✓ |
| Move breadcrumbs into PageShell | PageShell receives route and renders breadcrumbs inside | |

**User's choice:** Keep breadcrumbs in Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Subtitle text below title | Single line of muted description text under title | ✓ |
| Description + metadata row | Subtitle text plus optional metadata chips | |
| Slot for custom header content | Render-prop pattern, pages pass whatever content | |

**User's choice:** Subtitle text below title

---

## Skeleton Designs

| Option | Description | Selected |
|--------|-------------|----------|
| Row-based skeleton | 3-5 rows matching table column layout with variable widths | ✓ |
| Block skeleton | Single rectangular block per row | |
| Card skeletons per row | Each row as a card skeleton | |

**User's choice:** Row-based skeleton

| Option | Description | Selected |
|--------|-------------|----------|
| Match the grid count | Skeleton cards in same grid layout (2 cols desktop, 1 mobile) | ✓ |
| Fixed subset of cards | Show 3-4 skeleton cards regardless of grid | |

**User's choice:** Match the grid count

| Option | Description | Selected |
|--------|-------------|----------|
| Pulse animation (default shadcn) | Built-in pulse animation | ✓ |
| Shimmer animation | Sweeping gradient across skeleton | |
| Static (no animation) | Plain gray blocks | |

**User's choice:** Pulse animation (default shadcn)

| Option | Description | Selected |
|--------|-------------|----------|
| Full form layout | Skeleton matching all form fields (labels + input + button) | ✓ |
| Single block placeholder | One large skeleton block where form will be | |

**User's choice:** Full form layout

---

## Empty State Variants

| Option | Description | Selected |
|--------|-------------|----------|
| Single EmptyState component | Props for variant, icon, message, optional CTA | ✓ |
| Separate components per variant | NoDataView, NoResultsView, OfflineView, NoAccessView | |

**User's choice:** Single EmptyState component

| Option | Description | Selected |
|--------|-------------|----------|
| Lucide icons | Use existing lucide-react icons | ✓ |
| shadcn-style illustrations | Simple SVG illustrations using app colors | |

**User's choice:** Lucide icons

| Option | Description | Selected |
|--------|-------------|----------|
| Named action per variant | "Add first item", "Clear filters", "Retry", "Go to dashboard" | ✓ |
| Generic fallback CTA per page | Page passes its own CTA component as slot | |

**User's choice:** Named action per variant

| Option | Description | Selected |
|--------|-------------|----------|
| Professional/informative | "No cases found", "No results match your search" | ✓ |
| Friendly/helpful | "No cases yet — ready to add one?" | |

**User's choice:** Professional/informative

---

## Error Boundary Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Global wrapper in Layout | Single <ErrorBoundary> wrapping <main> in Layout.tsx | ✓ |
| Per-route boundaries | Each page optionally wraps in <ErrorBoundary> | |

**User's choice:** Global wrapper in Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + message + retry + home link | Error icon, "Something went wrong", Retry, Go Home | ✓ |
| Fuller error info | Same plus collapsed error details for devs/admins | |

**User's choice:** Icon + message + retry + home link

| Option | Description | Selected |
|--------|-------------|----------|
| Reset error boundary state | Resets error state, re-renders children | ✓ |
| Reload the page | Full window.location.reload() | |

**User's choice:** Reset error boundary state

| Option | Description | Selected |
|--------|-------------|----------|
| Same treatment for all | Same error UI regardless of cause | |
| Differentiate network vs render | Network: "Check your connection" + retry; Render: "Something went wrong" + home | ✓ |

**User's choice:** Differentiate network vs render

---

## Sonner Toast Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right (default) | Sonner default position | |
| Top-center | Centered below topbar | ✓ |
| Bottom-right | Near bottom, less disruptive | |

**User's choice:** Top-center

| Option | Description | Selected |
|--------|-------------|----------|
| Quick: 3 seconds | Standard toasts dismiss after 3s | |
| Normal: 4-5 seconds | Standard toasts dismiss after 4-5s | |
| Manual dismiss only | No auto-dismiss, user must manually close | ✓ |

**User's choice:** Manual dismiss only

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss with longer duration | Errors after 6-8s, success after 3-4s | |
| Manual dismiss for errors | Errors never auto-dismiss | ✓ |

**User's choice:** Manual dismiss for errors

| Option | Description | Selected |
|--------|-------------|----------|
| Simple/default styling | Sonner default with app colors | ✓ |
| Rich custom toasts | Custom component with icon, title, description, action | |

**User's choice:** Simple/default styling

---

## Bottom Tab Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard, Cases, Beneficiaries, Profile + Quick Action | 5 tabs with center quick action button | ✓ |
| Dashboard, Intake, Cases, Beneficiaries, Profile | 5 tabs including GIS Intake directly | |
| Dashboard, Cases, Beneficiaries, Programs, Profile | 5 tabs adding Programs | |

**User's choice:** Dashboard, Cases, Beneficiaries, Profile + Quick Action

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile only (<768px) | Bottom tabs replace sidebar on mobile | |
| Always on mobile, optionally on tablet | Bottom tabs up to 1024px, sidebar beyond | ✓ |

**User's choice:** Always on mobile, optionally on tablet

| Option | Description | Selected |
|--------|-------------|----------|
| Filled icon + colored accent | Active tab gets primary/accent color | |
| Pill/highlight behind icon | Active tab gets rounded pill background | ✓ |

**User's choice:** Pill/highlight behind icon

| Option | Description | Selected |
|--------|-------------|----------|
| New intake — GIS intake form | Opens GIS intake form directly | ✓ |
| FAB-style menu | Floating action button expands to show multiple actions | |

**User's choice:** New intake — GIS intake form

---

## 44px Touch Target Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Audit existing + enforce for new | Check current app for elements below 44px, fix them | ✓ |
| New components only | Only ensure new components meet 44px | |

**User's choice:** Audit existing + enforce for new

| Option | Description | Selected |
|--------|-------------|----------|
| Inline actions, icon buttons, badges | Common offenders | ✓ |
| Table cell clicks, list items | Larger patterns that might be tight | |

**User's choice:** Inline actions, icon buttons, badges

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind utility classes | min-h-[44px] min-w-[44px] per component | |
| Global CSS override | min-height/min-width on all interactive elements via CSS | ✓ |

**User's choice:** Global CSS override

---

## Table Interaction Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side sorting | Sort rows in-memory via column header clicks | |
| Server-side sorting | Send sort params to API and re-fetch | ✓ |

**User's choice:** Server-side sorting

| Option | Description | Selected |
|--------|-------------|----------|
| Inline column filters | Search/filter inputs in table header | |
| Filter panel / dialog | Dedicated filter modal or slide-over panel | |
| Search bar above table | Single search bar filtering across columns | ✓ |

**User's choice:** Search bar above table

| Option | Description | Selected |
|--------|-------------|----------|
| Page numbers + prev/next | shadcn Pagination component | ✓ |
| Load more button | "Show more" button at bottom | |
| Infinite scroll | Auto-load on scroll to bottom | |

**User's choice:** Page numbers + prev/next

| Option | Description | Selected |
|--------|-------------|----------|
| Native horizontal scroll wrapper | overflow-x-auto container | ✓ |
| Column chooser + card view | Card layout on mobile instead of table | |

**User's choice:** Native horizontal scroll wrapper

---

## the agent's Discretion

- Exact column layout for each table (varies by page)
- Search debounce timing and minimum character threshold
- Empty state icon selection per variant
- Toast component integration details
- Error boundary component implementation details
- Bottom nav bar height and animation specifics
- Touch target CSS selector strategy

## Deferred Ideas

None — discussion stayed within phase scope.
