# Referral UI/UX Enhancement — Design Spec

## Overview

Bring the 4 referral pages to the visual standard of existing system pages (SettingsPage, CaseViewPage, CoordinatorDashboardPage, IntakeReviewPage). Apply shadcn components, consistent spacing/typography, and UX patterns already established in the codebase. No new features or data model changes.

## Design Sources

Style patterns derived from these existing pages (ranked by relevance):

| Page | Patterns Used |
|------|---------------|
| SettingsPage | Card-with-icon-header (`border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2`), `text-xs text-muted-foreground font-medium` labels, `h-9` compact inputs, input-with-icon, error/success banners, toast, segmented tab |
| CoordinatorDashboardPage | Card-wrapped DataTable, stat card grid, search-with-icon input pattern, loading state |
| CaseViewPage | Sidebar detail card pattern, info grid (`grid grid-cols-2 gap-x-4 gap-y-2 text-sm`), timeline/detail sections, `Badge` status mapping |
| IntakeReviewPage | Card layout, confidence/eligibility banners, action buttons with context-aware labels |

## Pages in Scope (4 files)

### 1. CoordinatorReferralFormPage (`src/pages/CoordinatorReferralFormPage.tsx`)

**Visual changes:**
- Replace raw `rounded-lg border bg-card p-6` sections with `<Card>` + SettingsPage-style card headers (icon + title in `bg-muted/30` border-bottom)
- Section 1: "Personal Information" (+User icon)
- Section 2: "Address" (+MapPin icon)
- Section 3: "Referral Details" (+FileText icon)
- Replace raw `<select>` with shadcn `<Select>`
- Replace raw `<textarea>` with shadcn `<Textarea>`
- Replace raw radio buttons with styled radio group using `<Label>`
- Add `<Phone>` icon prefix to phone input
- All labels use `text-xs text-muted-foreground font-medium`
- Inputs use `h-9` compact sizing (SettingsPage convention)
- Replace inline error banner with `bg-destructive/10 border-destructive/20` style
- `max-w-2xl` form width (matches SettingsPage)

**UX changes:**
- `toast.success()` on successful submission → navigate
- `toast.error()` on failure
- `useState` → inline validation keeps error banner pattern

### 2. CoordinatorReferralListPage (`src/pages/CoordinatorReferralListPage.tsx`)

**Visual changes:**
- Replace manual modal with shadcn `<Dialog>` (animated overlay, X close button)
- Replace inline `statusBadge()` with `<Badge>` component
- Detail dialog uses info grid (`grid grid-cols-2 gap-x-4 gap-y-2 text-sm`)
- DataTable wrapped in `<Card>` with "My Referrals" card header
- Skeleton loading: 3x `animate-pulse` rows matching table layout
- Empty state: icon + "No referrals yet." centered

**UX changes:**
- Loading state: skeleton instead of text
- Empty state: icon + message
- Dialog: `DialogContent`, `DialogHeader`, `DialogTitle`, close via X
- Error handling: silent `catch` kept (matches existing pattern, API is reliable)

### 3. ReferralsPage (`src/pages/ReferralsPage.tsx`)

**Visual changes:**
- Both views (CoordinatorReferralView + WorkerReferralView) get same treatment as above
- Coordinator view detail: `<Dialog>` with info grid
- Worker view decline: `<Dialog>` with reason textarea + Cancel/Confirm buttons
- `<Badge>` for status in both views
- Skeleton loading per view
- Empty state per view with icon

**UX changes:**
- Toast feedback on accept/decline
- Decline dialog uses `<Dialog>` with proper `DialogDescription`
- Loading state: skeleton

### 4. ReferralReviewPage (`src/pages/ReferralReviewPage.tsx`)

Same patterns as WorkerReferralView from ReferralsPage. No new changes beyond visual alignment.

## Concrete Style Tokens (from existing pages)

```typescript
// Card section header (SettingsPage pattern)
'rounded-lg border bg-card shadow-sm overflow-hidden'
'border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2'

// Labels (universal pattern)
'text-xs text-muted-foreground font-medium'

// Input sizing (SettingsPage convention)
'h-9'

// Error banner
'rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive'

// Success banner
'rounded-lg bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-700'

// Empty state
'text-center py-12 text-muted-foreground' + icon

// Info grid (CaseViewPage pattern)
'grid grid-cols-2 gap-x-4 gap-y-2 text-sm'

// Loading skeleton
'animate-pulse bg-muted rounded'
```

## Non-Goals

- No data model changes (no schema, entity, or API changes)
- No new features or functionality
- No file restructuring or component extraction
- No test changes (existing tests continue to pass)
- No behavior changes — existing accept/decline/create flows unchanged
