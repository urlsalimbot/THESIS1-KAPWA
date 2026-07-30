# Referral UI/UX Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually align 4 referral pages with existing system-page patterns (SettingsPage card headers, Dialog, Badge, toast, skeleton, consistent typography).

**Architecture:** All changes are frontend-only — no backend, no data model, no new components. Each page gets standalone visual enhancement using existing shadcn components (Card, Dialog, Badge, Select, Textarea) and Tailwind patterns from SettingsPage/CaseViewPage/CoordinatorDashboardPage.

**Tech Stack:** React 18, Tailwind CSS, shadcn/ui, @tanstack/react-table, sonner (toast), lucide-react

## Global Constraints

- No backend changes (no schema, entity, DTO, or API edits)
- No new component files — use existing `@/components/ui/*` only
- No test modifications (no test files exist for referral pages)
- All labels use `text-xs text-muted-foreground font-medium` (SettingsPage pattern)
- All card headers use `border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2` pattern
- All inputs use `h-9` compact sizing where applicable
- Error banners use `rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive`
- Empty states use icon + `text-center py-12 text-muted-foreground`
- Skeleton loading uses `animate-pulse bg-muted rounded`
- Toast via `import { toast } from 'sonner'`
- All imports from `@/components/ui/*` must use existing proxy exports

---
### Task 1: CoordinatorReferralFormPage — Form enhancement

**Files:**
- Modify: `kapwa-client/src/pages/CoordinatorReferralFormPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: existing `api.post('/referrals', ...)`, `useNavigate()`
- Produces: enhanced form with Card sections, shadcn Select/Textarea, toast feedback

- [ ] **Step 1: Rewrite the page with Card+icon headers, shadcn components, and toast**

Replace the entire file content. Key changes:
- Wrap Personal Information in Card with `border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2` header (+User icon)
- Wrap Address in Card with same header pattern (+MapPin icon)
- Wrap Referral Details in Card with same header pattern (+FileText icon)
- Replace raw `<select>` with shadcn `<Select>`, `<SelectTrigger>`, `<SelectContent>`, `<SelectItem>`
- Replace raw `<textarea>` with shadcn `<Textarea>`
- Add `<Phone>` icon prefix to phone input
- Use `text-xs text-muted-foreground font-medium` for all label elements
- Use `h-9` class on Input components
- Error banner uses `bg-destructive/10 border-destructive/20` style
- Toast on success/failure
- Form width `max-w-2xl`

Import additions:
```typescript
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, MapPin, FileText } from 'lucide-react';
```

Remove unused import:
```typescript
// Remove: import { ArrowLeft, AlertTriangle } from 'lucide-react';
// Remove: import { Separator } from '@/components/ui/separator';
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30` from kapwa-client
Expected: No TypeScript errors related to CoordinatorReferralFormPage

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/CoordinatorReferralFormPage.tsx
git commit -m "feat: enhance referral form with system page card patterns, shadcn inputs, toast feedback"
```

---
### Task 2: CoordinatorReferralListPage — Dialog detail, Badge, skeleton

**Files:**
- Modify: `kapwa-client/src/pages/CoordinatorReferralListPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: existing `api.get('/referrals/mine')`, `useNavigate()`
- Produces: enhanced list with Card-wrapped DataTable, Dialog detail modal, Badge status, skeleton loading

- [ ] **Step 1: Rewrite the page with Card, Dialog, Badge, skeleton**

Key changes:
- Wrap DataTable in Card with header
- Replace manual modal with `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`
- Detail dialog body uses `grid grid-cols-2 gap-x-4 gap-y-2 text-sm` info grid
- Replace inline `statusBadge()` with `<Badge variant={...}>` — map: `pending`→`secondary`, `accepted`→`default`, `declined`→`destructive`
- Add `h-9` sized skeleton rows during loading (3 rows with `animate-pulse`)
- Empty state: `AlertCircle` icon + text

Import additions:
```typescript
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30` from kapwa-client
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/CoordinatorReferralListPage.tsx
git commit -m "feat: enhance referral list with Card, Dialog, Badge, skeleton loading"
```

---
### Task 3: ReferralReviewPage — Dialog decline, Badge, skeleton

**Files:**
- Modify: `kapwa-client/src/pages/ReferralReviewPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: existing `api.get('/referrals?status=pending')`, `api.patch('/referrals/:id/accept')`, `api.patch('/referrals/:id/decline')`
- Produces: enhanced review page with Card-wrapped DataTable, Dialog decline modal, Badge, skeleton

- [ ] **Step 1: Rewrite the page with Card, Dialog for decline, Badge, skeleton**

Key changes:
- Wrap DataTable in Card with header "Pending Referrals"
- Replace manual decline overlay with `<Dialog>`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
- Dialog footer with Cancel (outline) + Confirm Decline (destructive) buttons
- `<Badge>` for status (though all shown are `pending` → `secondary`)
- Skeleton loading (3 rows `animate-pulse`)
- Empty state with `Inbox` icon + "No pending referrals."
- Toast.success/toast.error on accept/decline

Import additions:
```typescript
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30` from kapwa-client
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/ReferralReviewPage.tsx
git commit -m "feat: enhance referral review with Card, Dialog decline, Badge, skeleton"
```

---
### Task 4: ReferralsPage — Both views enhanced, code dedup via shared components

**Files:**
- Modify: `kapwa-client/src/pages/ReferralsPage.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useAuth()`, same API endpoints as Task 2 + Task 3
- Produces: enhanced dual-role page

- [ ] **Step 1: Rewrite the page**

Apply the same patterns from Task 2 (CoordinatorReferralView) and Task 3 (WorkerReferralView). Each view gets:
- Card-wrapped DataTable
- `<Dialog>` for detail (coordinator) and decline (worker)
- `<Badge>` for status
- Skeleton loading
- Empty state with icon
- Toast feedback on accept/decline

Import additions (same as Task 2 + Task 3 combined):
```typescript
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { AlertCircle, Inbox } from 'lucide-react';
```

- [ ] **Step 2: Verify it builds**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30` from kapwa-client
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/ReferralsPage.tsx
git commit -m "feat: enhance referrals page with Card, Dialog, Badge, skeleton for both views"
```

---

## Verification

After all tasks complete, run:

```bash
cd kapwa-client && npx tsc --noEmit --pretty 2>&1 | head -30
cd kapwa-server && npx jest 2>&1 | tail -20
```
