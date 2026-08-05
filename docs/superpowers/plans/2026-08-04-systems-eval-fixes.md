# SYSTEMS_EVAL Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 22 findings in `SYSTEMS_EVAL.MD` across system stability, ease-of-doing-business, and UI/UX for the KAPWA MSWDO social welfare system.

**Architecture:** A monorepo with two apps. Server = NestJS 10/11 + TypeORM + Zod pipes (`kapwa-server`). Client = React 19 + Vite + SWR + shadcn/ui (`kapwa-client`). Server source modules live under `kapwa-server/src/<domain>/`; client pages under `kapwa-client/src/pages/`, shared libs under `kapwa-client/src/lib/`, shared components under `kapwa-client/src/components/`. The plan is split into three phases mirroring the priority matrix: **Phase 1 = P0** (this sprint), **Phase 2 = P1** (next sprint), **Phase 3 = P2/P3 backlog**. Phase 3 features are larger; implement them last or split into their own plans.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Zod, `pdfkit`/`exceljs`/`csv-stringify` (exports), `@nestjs/schedule` (already installed); React 19, Vite 8, SWR, React Router v6, react-hook-form, Tailwind 4, shadcn/ui (Radix), Vitest + Jest.

## Global Constraints

- **Test commands (verbatim):**
  - Server: `cd kapwa-server && npx jest <path> --coverage=false` — NEVER bare `npm test`.
  - Client: `cd kapwa-client && npx vitest run <path>`.
  - Client typecheck: `cd kapwa-client && npx tsc --noEmit` — must reach **0 errors** (currently 23).
- **Server 7 failing suites are a PRE-EXISTING baseline** (auth, cases, dashboard, chat, filing, notifications, sync/conflict-resolver). Only the FSM-related failures (cases.service.spec, conflict-resolver.spec) are in scope for S-01; the others stay out of scope.
- **Do NOT change the case FSM semantics** unless a specific task says so — extraction must be behavior-preserving except where the tests are explicitly reconciled (S-01).
- **Artifacts to files** (AGENTS.md rule): return file paths + 1-line descriptions; never paste large outputs.
- **RLS is dormant** — keep service-layer scoping; do not add RLS policies in this plan.
- **Admin is an override role** — matches ABAC (`abac.service.ts` returns true for admin/mayor/auditor) and the failing close-test expectation.
- **Commit convention:** `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `perf:`.
- Client build = `tsc --noEmit && vite build` after S-04 (Task 5).
- Never log raw PII. Error messages to end users must be generic ("Service temporarily unavailable…").

---

## File Structure Map

**New files:**
- `kapwa-server/src/cases/case-fsm.ts` — single source of truth for case FSM transitions + roles (S-01).
- `kapwa-client/src/lib/role-access.ts` — shared role lists + redirect map (S-07, U-02).
- `kapwa-client/src/hooks/useConnectivity.ts` — online/offline hook (U-04).
- `kapwa-client/src/hooks/useSyncStatus.ts` — pending-sync-count hook (B-04).
- `kapwa-client/src/hooks/useIntakeAutosave.ts` — localStorage draft autosave (U-05).
- `kapwa-client/src/pages/ClaimantAccessCardPage.tsx` — claimant's own access-card view (U-03).
- `kapwa-client/src/components/ErrorState.tsx` — shared SWR error recovery UI (U-08).
- `kapwa-client/src/components/QuickScanCard.tsx` — coordinator quick service-log panel (B-05).

**Modified files:**
- Server: `main.ts`, `app.controller.ts`, `cases/cases.service.ts`, `cases/cases.service.spec.ts`, `sync/sync.service.ts`, `sync/conflict-resolver.ts`, `notifications/notifications.controller.ts`, `notifications/notifications.service.ts`, `inter-agency-referrals/inter-agency-referrals.service.ts`, `inter-agency-referrals/inter-agency-referrals.service.spec.ts`, `export/export.controller.ts`, `export/export.service.ts`.
- Client: `package.json`, `lib/constants.ts`, `lib/api.ts`, `components/family/FamilyTreeGraph.tsx`, `hooks/useDebouncedSearch.ts`, `components/Topbar.tsx`, `components/BottomNav.tsx`, `components/BottomNav.test.tsx`, `components/ProtectedRoute.tsx`, `pages/LoginPage.tsx`, `pages/LoginPage.test.tsx`, `components/NotificationsDropdown.tsx`, `components/MessagesPopover.tsx`, `lib/sync.ts`, `routes.tsx`, `pages/IntakePage.tsx`, `pages/IntakePage.test.tsx`, `pages/InterAgencyReferralsPage.tsx`, `pages/CaseViewPage.tsx`, `pages/AdminWipePage.tsx`, `lib/theme-context.tsx`, `pages/CoordinatorDashboardPage.tsx`, `pages/MayorReportsPage.tsx`, `pages/DashboardPage.tsx`, `pages/BeneficiariesPage.tsx`, `pages/CasesPage.tsx`, `pages/CaseTrackerPage.tsx`, `pages/AgencyReferralsPage.tsx`, `__tests__/pii/masking.test.ts`, `components/Sidebar.test.tsx`, `lib/swr-config.test.tsx`.

---

## PHASE 1 — P0: Stability + Critical UX (SPRINT N)

### Task 1: S-01 — Extract shared case FSM + restore financial conflict rules

**Files:**
- Create: `kapwa-server/src/cases/case-fsm.ts`
- Modify: `kapwa-server/src/cases/cases.service.ts:250-292`
- Modify: `kapwa-server/src/sync/sync.service.ts:49-62`
- Modify: `kapwa-server/src/sync/conflict-resolver.ts:20`
- Modify: `kapwa-server/src/cases/cases.service.spec.ts:224-239`
- Test: `kapwa-server/src/cases/case-fsm.spec.ts` (new)

**Interfaces:**
- Produces: `isValidTransition(from: CaseStatus, to: CaseStatus): boolean`, `canTransition(from: CaseStatus, role: string): boolean`, `CASE_FSM`, `CASE_FSM_ROLES` — all imported by `cases.service.ts` and `sync.service.ts`.

- [ ] **Step 1: Write the failing test for the shared module**

Create `kapwa-server/src/cases/case-fsm.spec.ts`:

```typescript
import { CaseStatus } from './case.entity';
import { CASE_FSM, CASE_FSM_ROLES, isValidTransition, canTransition } from './case-fsm';

describe('case-fsm', () => {
  it('enforces the documented transition table', () => {
    expect(isValidTransition(CaseStatus.ENROLLED, CaseStatus.ASSESSED)).toBe(true);
    expect(isValidTransition(CaseStatus.ACTIVE, CaseStatus.CLOSED)).toBe(true);
    expect(isValidTransition(CaseStatus.CLOSED, CaseStatus.ENROLLED)).toBe(false);
  });

  it('allows admin to transition any state (override role)', () => {
    expect(canTransition(CaseStatus.TRANSITIONING, 'admin')).toBe(true);
    expect(canTransition(CaseStatus.ACTIVE, 'admin')).toBe(true);
  });

  it('restricts disburse (active->transitioning) to admin', () => {
    expect(canTransition(CaseStatus.ACTIVE, 'social_worker')).toBe(false);
    expect(canTransition(CaseStatus.ACTIVE, 'admin')).toBe(true);
  });

  it('allows social worker and coordinator to close transitioning cases', () => {
    expect(canTransition(CaseStatus.TRANSITIONING, 'social_worker')).toBe(true);
    expect(canTransition(CaseStatus.TRANSITIONING, 'coordinator')).toBe(true);
  });

  it('exports complete role matrix keyed by every status', () => {
    for (const s of Object.values(CaseStatus)) {
      expect(CASE_FSM_ROLES[s]).toBeDefined();
      expect(Array.isArray(CASE_FSM[s])).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/cases/case-fsm.spec.ts --coverage=false`
Expected: FAIL — "Cannot find module './case-fsm'".

- [ ] **Step 3: Create `case-fsm.ts`**

```typescript
import { CaseStatus } from './case.entity';

/**
 * Single source of truth for case lifecycle transitions.
 * Mirrors the state machine in sync.service and cases.service — one table to rule them all.
 */
export const CASE_FSM: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.ENROLLED]: [CaseStatus.ASSESSED, CaseStatus.CLOSED],
  [CaseStatus.ASSESSED]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
  [CaseStatus.IN_REVIEW]: [CaseStatus.ACTIVE, CaseStatus.CLOSED],
  [CaseStatus.ACTIVE]: [CaseStatus.TRANSITIONING, CaseStatus.CLOSED],
  [CaseStatus.TRANSITIONING]: [CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [],
};

export const CASE_FSM_ROLES: Record<CaseStatus, string[]> = {
  [CaseStatus.ENROLLED]: ['social_worker', 'coordinator'],
  [CaseStatus.ASSESSED]: ['social_worker', 'coordinator'],
  [CaseStatus.IN_REVIEW]: ['admin', 'coordinator'],
  [CaseStatus.ACTIVE]: ['admin'], // disburse is head-of-office / admin only
  [CaseStatus.TRANSITIONING]: ['social_worker', 'coordinator'],
  [CaseStatus.CLOSED]: ['admin', 'social_worker', 'coordinator'],
};

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_FSM[from] ?? []).includes(to);
}

export function canTransition(from: CaseStatus, role: string): boolean {
  if (role === 'admin') return true; // admin is an override role (matches ABAC)
  return (CASE_FSM_ROLES[from] ?? []).includes(role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kapwa-server && npx jest src/cases/case-fsm.spec.ts --coverage=false`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire `cases.service.ts` to the shared module**

In `kapwa-server/src/cases/cases.service.ts`:
1. Add import at top:
```typescript
import { isValidTransition, canTransition } from './case-fsm';
```
2. Replace `validateTransition`'s inline table (lines 250-258) — delete the `transitions` record; keep the domain guard rules (assessment-complete, FRVA/SWDI, intervention-count, sustainability-plan, signature/outcome) exactly as they are. Change the first check to:
```typescript
if (!isValidTransition(c.status, newStatus)) {
  throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
}
```
3. Replace `getTransitionRoles` (lines 282-292) entirely:
```typescript
private getTransitionRoles(status: CaseStatus): string[] {
  return CASE_FSM_ROLES[status] || ['admin'];
}
```
4. Update `transition()` (line 300) so the admin override is honored by the role check too:
```typescript
const allowedRoles = this.getTransitionRoles(c.status);
if (opts?.userRole && opts.userRole !== 'admin' && !allowedRoles.includes(opts.userRole)) {
  throw new ForbiddenException(`Role ${opts.userRole} cannot transition from ${c.status} to ${newStatus}`);
}
```

- [ ] **Step 6: Wire `sync.service.ts` to the shared module**

In `kapwa-server/src/sync/sync.service.ts`:
1. Add import: `import { isValidTransition } from '../cases/case-fsm';`
2. Delete module-level `VALID_FSM_TRANSITIONS` (lines 50-57) and `isValidFsmTransition` (lines 59-62).
3. Update `handleFsmTransition` (line 289) to use `isValidTransition` with a string→enum cast:
```typescript
if (!isValidTransition(currentStatus as CaseStatus, requestedStatus as CaseStatus)) {
```
4. Add `CaseStatus` to the imports from `../cases/case.entity`.

- [ ] **Step 7: Reconcile the failing close/disburse tests in `cases.service.spec.ts`**

In `kapwa-server/src/cases/cases.service.spec.ts`, the two tests at lines 224-239 already match the reconciled semantics (admin + social_worker both close transitioning cases). Run them to confirm:

Run: `cd kapwa-server && npx jest src/cases/cases.service.spec.ts --coverage=false`
Expected: the "FSM — close" describe block now PASSES (admin override + `['social_worker','coordinator']` transitioning roles).
**Note:** Other failures in this file (request-review guards, disburse role expectations) are separate pre-existing baseline issues — leave them; do not modify unrelated tests.

- [ ] **Step 8: Restore financial-table conflict rules in `conflict-resolver.ts`**

In `kapwa-server/src/sync/conflict-resolver.ts:20`, the `FINANCIAL_TABLES` set is empty. Populate it so financial conflicts resolve server-wins (per KAPWA-PROJECT.md sync rules):

```typescript
private readonly FINANCIAL_TABLES = new Set([
  'interventions',
  'disbursements',
  'financial_assistance',
  'case_interventions',
  'access_card_services',
]);
```

Run: `cd kapwa-server && npx jest src/sync/conflict-resolver.spec.ts --coverage=false`
Expected: tests 1/12, 2/12, 9/12 (financial server_wins) now PASS.

- [ ] **Step 9: Run full regression on both suites**

Run: `cd kapwa-server && npx jest src/cases src/sync --coverage=false`
Expected: all previously-passing tests still pass; the FSM close/financial tests now pass. Any remaining failures are pre-existing baseline (do not chase them here).

- [ ] **Step 10: Commit**

```bash
git add kapwa-server/src/cases/case-fsm.ts kapwa-server/src/cases/case-fsm.spec.ts kapwa-server/src/cases/cases.service.ts kapwa-server/src/sync/sync.service.ts kapwa-server/src/sync/conflict-resolver.ts
git commit -m "fix: extract shared case FSM and restore financial conflict rules"
```

---

### Task 2: S-07 — Extract shared ROLE_REDIRECT_MAP

**Files:**
- Create: `kapwa-client/src/lib/role-access.ts`
- Modify: `kapwa-client/src/pages/LoginPage.tsx:22-30`
- Modify: `kapwa-client/src/components/ProtectedRoute.tsx:7-15`
- Modify: `kapwa-client/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Produces: `ROLE_REDIRECT_MAP: Record<string, string>` (consumed by LoginPage + ProtectedRoute), `NOTIFICATION_ROLES: string[]`, `CHAT_ROLES: string[]` (consumed by Task 3).

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/pages/LoginPage.test.tsx`:

```typescript
import { ROLE_REDIRECT_MAP, NOTIFICATION_ROLES, CHAT_ROLES } from '@/lib/role-access';

describe('role-access constants', () => {
  it('redirect map covers every known role', () => {
    const roles = ['social_worker', 'admin', 'coordinator', 'claimant', 'mayor', 'auditor', 'agency_staff'];
    for (const r of roles) {
      expect(ROLE_REDIRECT_MAP[r]).toBeDefined();
    }
  });

  it('notification roles are mutually consistent with server @Roles', () => {
    expect(NOTIFICATION_ROLES).toContain('admin');
    expect(NOTIFICATION_ROLES).toContain('auditor');
  });

  it('chat roles exclude mayor, auditor, agency_staff', () => {
    expect(CHAT_ROLES).not.toContain('mayor');
    expect(CHAT_ROLES).not.toContain('auditor');
    expect(CHAT_ROLES).not.toContain('agency_staff');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/pages/LoginPage.test.tsx`
Expected: FAIL — "Cannot find module '@/lib/role-access'".

- [ ] **Step 3: Create `role-access.ts`**

```typescript
export const ROLE_REDIRECT_MAP: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
  agency_staff: '/agency/dashboard',
};

// Must mirror the @Roles decorators on kapwa-server notifications.controller
export const NOTIFICATION_ROLES = [
  'admin', 'social_worker', 'coordinator', 'claimant', 'auditor',
];

// Must mirror the @Roles decorators on kapwa-server chat.controller
export const CHAT_ROLES = ['admin', 'social_worker', 'coordinator', 'claimant'];
```

- [ ] **Step 4: Update `LoginPage.tsx`**

Delete lines 22-30 (`const roleRedirectMap = {...}`). Import at top:
```typescript
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';
```
Update line 48: `navigate(ROLE_REDIRECT_MAP[user.role] || '/dashboard', { replace: true });`

- [ ] **Step 5: Update `ProtectedRoute.tsx`**

Delete lines 7-15 (`const roleRedirectMap = {...}`). Import:
```typescript
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';
```
Update the redirect reference: `navigate(ROLE_REDIRECT_MAP[user.role] || '/dashboard', { replace: true });`

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/pages/LoginPage.test.tsx src/components/ProtectedRoute.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/lib/role-access.ts kapwa-client/src/pages/LoginPage.tsx kapwa-client/src/pages/LoginPage.test.tsx kapwa-client/src/components/ProtectedRoute.tsx
git commit -m "refactor: extract shared role redirect map and role access constants"
```

---

### Task 3: U-02 — Gate NotificationsDropdown + MessagesPopover by role

**Files:**
- Modify: `kapwa-client/src/components/Topbar.tsx:176-177`
- Modify: `kapwa-client/src/components/Topbar.test.tsx`
- Consumes: `NOTIFICATION_ROLES`, `CHAT_ROLES` from Task 2.

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/components/Topbar.test.tsx`:

```typescript
describe('role-gated shell widgets', () => {
  it('does not render MessagesPopover for agency_staff', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'agency_staff' });
    expect(queryByLabelText(/messages/i)).toBeNull();
  });

  it('does not render NotificationsDropdown for mayor', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'mayor' });
    expect(queryByLabelText(/notifications/i)).toBeNull();
  });

  it('renders NotificationsDropdown for auditor', async () => {
    const { queryByLabelText } = renderWithTopbar({ role: 'auditor' });
    expect(queryByLabelText(/notifications/i)).not.toBeNull();
  });
});
```

**Note:** If `renderWithTopbar` already exists in the file, reuse it; otherwise create it (mock `useAuth` + `useSWR` per the existing test file conventions).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/components/Topbar.test.tsx`
Expected: FAIL — widgets render for all roles.

- [ ] **Step 3: Implement the gate in `Topbar.tsx`**

Import:
```typescript
import { NOTIFICATION_ROLES, CHAT_ROLES } from '@/lib/role-access';
```
Add computed flags after `isAgencyStaff` (near line 81):
```typescript
const canNotifications = NOTIFICATION_ROLES.includes(user?.role ?? '');
const canChat = CHAT_ROLES.includes(user?.role ?? '');
```
Replace lines 176-177:
```tsx
{canNotifications && <NotificationsDropdown />}
{canChat && <MessagesPopover />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/components/Topbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/Topbar.tsx kapwa-client/src/components/Topbar.test.tsx
git commit -m "fix: role-gate shell notifications and chat widgets to stop 403 spam"
```

---

### Task 4: U-01 — Role-filtered BottomNav (mobile)

**Files:**
- Modify: `kapwa-client/src/components/BottomNav.tsx`
- Modify: `kapwa-client/src/components/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test**

Rewrite `kapwa-client/src/components/BottomNav.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { BottomNav } from './BottomNav';

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => true,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { role: 'agency_staff' } }),
}));

describe('BottomNav role filtering', () => {
  it('shows only agency portal tabs for agency_staff', () => {
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.queryByText(/cases/i)).toBeNull();
    expect(screen.queryByText(/beneficiaries/i)).toBeNull();
  });

  it('shows intake quick action for social_worker', () => {
    vi.mocked(require('@/lib/auth-context').useAuth).mockReturnValue({ user: { role: 'social_worker' } });
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByLabelText(/new intake/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/components/BottomNav.test.tsx`
Expected: FAIL — hardcoded tabs render regardless of role.

- [ ] **Step 3: Refactor `BottomNav.tsx`**

Replace the file body with a role-derived implementation:

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { Plus, type LucideIcon } from 'lucide-react';

interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
}

// Center "quick action" per role; null hides it.
const QUICK_ACTIONS: Record<string, string | null> = {
  admin: '/intake',
  social_worker: '/intake',
  coordinator: '/coordinator/referrals/new',
  claimant: null,
  mayor: null,
  auditor: null,
  agency_staff: '/agency/referrals',
};

export function BottomNav() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const location = useLocation();
  const { user } = useAuth();
  if (!isMobile) return null;

  const role = user?.role ?? '';
  const tabs: Tab[] = NAV_GROUPS
    .flatMap(g => g.items)
    .filter(item => item.roles.includes(role))
    .slice(0, 4) // keep the center quick-action slot free
    .map(item => ({ path: item.path, label: item.label, icon: item.icon.type as LucideIcon }));

  const quickPath = QUICK_ACTIONS[role] ?? null;

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border h-16 lg:hidden">
      <div className="flex items-center justify-around h-full px-2">
        {quickPath && (
          <Link
            to={quickPath}
            aria-label="New Intake (Quick Action)"
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg min-w-0 flex-shrink-0"
          >
            <Plus size={24} aria-hidden="true" />
          </Link>
        )}
        {tabs.map(tab => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors min-w-0 flex-shrink-0',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Note:** `item.icon` is a `ReactNode` (`<LayoutDashboard size={20}/>`); `.type` gives the component. If the typing is awkward in practice, store a parallel `label`/`icon` map inside `BottomNav` instead — the requirement is **role-derived tabs**, not icon extraction. Ensure at least one tab always renders; if `tabs` is empty, render the quick-action alone.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/components/BottomNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/BottomNav.tsx kapwa-client/src/components/BottomNav.test.tsx
git commit -m "fix: derive mobile bottom nav tabs from role-filtered nav config"
```

---

### Task 5: S-04 — Gate client build on tsc + fix all 23 type errors

**Files:**
- Modify: `kapwa-client/package.json`
- Modify: `kapwa-client/src/components/family/FamilyTreeGraph.tsx`
- Modify: `kapwa-client/src/lib/api.ts`
- Modify: `kapwa-client/src/hooks/useDebouncedSearch.ts`
- Modify: `kapwa-client/src/__tests__/pii/masking.test.ts:99`
- Modify: `kapwa-client/src/components/Sidebar.test.tsx:47`
- Modify: `kapwa-client/src/pages/IntakePage.test.tsx`
- Modify: `kapwa-client/src/lib/swr-config.test.tsx`

- [ ] **Step 1: Add tsc to build + typecheck script**

In `kapwa-client/package.json`:
```json
"build": "tsc --noEmit && vite build",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Establish the baseline**

Run: `cd kapwa-client && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 23 errors (baseline). Fix each until 0.

- [ ] **Step 3: Fix `FamilyTreeGraph.tsx` (10 errors)**

The root cause: `FamilyMemberNode` is passed as the generic node data type but the component declares `NodeProps<FamilyMemberNode>` while `computeLayout` returns `any[]`. Fix:

1. Import types:
```typescript
import { ReactFlow, Background, Controls, Handle, Position, NodeProps, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
```
2. Define a flow node type:
```typescript
type FamilyFlowNode = Node<FamilyMemberNode>;
type FamilyFlowEdge = Edge;
```
3. Change `computeLayout` return type and construction — nodes must carry `position` and `data`:
```typescript
function computeLayout(members: FamilyMemberNode[], primary: FamilyMemberNode | null): { nodes: FamilyFlowNode[]; edges: FamilyFlowEdge[] } {
  // ... existing layout math ...
  nodes.push({
    id: m.id,
    type: 'familyMember' as const,
    position: { x: startX + i * (NODE_WIDTH + NODE_GAP_X), y: depth * (NODE_HEIGHT + LAYER_GAP_Y) },
    data: m,
  });
  // edges.push({ ... }) — keep as-is, add type: 'smoothstep' satisfies Edge
}
```
4. Change the component signature:
```typescript
function FamilyMemberNode({ data }: NodeProps<FamilyFlowNode>) {
```
5. Change `onNodeClick` param from `any` to `(event: React.MouseEvent, node: FamilyFlowNode)`.
6. `useNodesState<FamilyFlowNode>(layout.nodes)` / `useEdgesState<FamilyFlowEdge>(layout.edges)`.
7. Remove the now-unused `FamilyMemberNode` `id`/`depth`-related typing conflicts — `FamilyMemberNode` remains the `data` shape.

- [ ] **Step 4: Fix `api.ts` (6 errors)**

The 6 errors are `ApiPath` (`string | readonly unknown[]`) not assignable to `string`. `executeWithRetry` and the api methods pass `path` straight through. Fix `executeWithRetry` to accept `ApiPath` and normalize internally:

```typescript
async function executeWithRetry<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: ApiPath,
  body: unknown,
  signal: AbortSignal | undefined,
  isRetry = false,
  attempt = 0,
): Promise<T> {
  const normalized = normalizePath(path);
  // ... rest of the existing body uses `normalized` instead of `path` ...
}
```
**Note:** `ApiPath` is declared at line 174 *after* `executeWithRetry` (line 140). Move the `export type ApiPath = string | readonly unknown[];` declaration above `executeWithRetry` (e.g. next to `normalizePath` at line 22). Then `rawRequest` already calls `normalizePath` at line 67 so the remaining call sites resolve.

- [ ] **Step 5: Fix `useDebouncedSearch.ts` (2 errors)**

The SWR key/fetcher typing is too loose. Change the `useSWR` call to a single typed key+fetcher:

```typescript
const swrKey: [string, string] | [string, { search: string; limit: number }] | null = trimmed
  ? fetcher
    ? ['debounced-search', trimmed]
    : ['beneficiaries', { search: trimmed, limit }]
  : null;

const { data, isLoading } = useSWR<
  SearchResult[] | { data: Record<string, unknown>[] } | Record<string, unknown>[]
>(swrKey, fetcher ? (key: readonly unknown[]) => fetcher(String((key as readonly unknown[])[1])) : undefined, {
  keepPreviousData: true,
});
```
Keep `queryKeys.beneficiaries.list({ search: trimmed, limit })` if its return type is already `[string, {...}]` — if not, use the literal `['beneficiaries', { search: trimmed, limit }]` above. The key requirement: the key is a `readonly unknown[]` (not `string | readonly unknown[] | null`), and the fetcher's parameter is non-optional.

- [ ] **Step 6: Fix test-file errors (4)**

- `src/__tests__/pii/masking.test.ts:99` — `body` is `BodyInit | null | undefined`; guard/assert it is a string before use:
```typescript
const body = await response.json();
```
or, if reading a raw body: `const text = typeof body === 'string' ? body : JSON.stringify(body);`
- `src/components/Sidebar.test.tsx:47` — `getAttribute` on type `never`; the mock element resolves to `never` due to `findByRole` typing. Assert the node exists first:
```typescript
const link = (await screen.findByRole('link', { name: /dashboard/i })) as HTMLElement;
expect(link.getAttribute('href')).toBe('/dashboard');
```
- `src/pages/IntakePage.test.tsx` (1 error) and `src/lib/swr-config.test.tsx` (1 error) — run `npx tsc --noEmit`, read the exact message, and apply the narrowest fix (usually an optional-chaining or explicit type assertion on a mocked fetch return).

- [ ] **Step 7: Verify tsc is clean and build works**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: 0 errors.

Run: `cd kapwa-client && npx vite build`
Expected: build succeeds (chunk-size warning OK).

Run: `cd kapwa-client && npx vitest run src/components/family src/lib/api.test.ts src/hooks/useDebouncedSearch.test.ts 2>&1 | tail -5`
Expected: PASS (or file-not-found is acceptable if those tests don't exist — verify existing family/api/hook tests still pass).

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/package.json kapwa-client/src/components/family/FamilyTreeGraph.tsx kapwa-client/src/lib/api.ts kapwa-client/src/hooks/useDebouncedSearch.ts kapwa-client/src/__tests__/pii/masking.test.ts kapwa-client/src/components/Sidebar.test.tsx kapwa-client/src/pages/IntakePage.test.tsx kapwa-client/src/lib/swr-config.test.tsx
git commit -m "build: gate client build on tsc and fix all latent type errors"
```

---

### Task 6: S-02 — Graceful shutdown

**Files:**
- Modify: `kapwa-server/src/main.ts`
- Modify: `kapwa-server/src/sync/sync.service.ts`

- [ ] **Step 1: Enable shutdown hooks in `main.ts`**

After `const app = await NestFactory.create(AppModule);` (line 33) add:
```typescript
app.enableShutdownHooks();
```

- [ ] **Step 2: Add shutdown handler to `SyncService`**

In `kapwa-server/src/sync/sync.service.ts`:
1. Import `OnApplicationShutdown` from `@nestjs/common`.
2. Change the class declaration:
```typescript
export class SyncService implements OnApplicationShutdown {
```
3. Add the method:
```typescript
async onApplicationShutdown(signal?: string): Promise<void> {
  this.logger.log(`Sync service shutting down (signal: ${signal})`);
  // Idempotency cache is in-memory only; nothing to flush to disk.
  // In-flight deltas are transactional — a restart leaves them retryable
  // because queue entries are only marked 'applied' after success.
}
```

- [ ] **Step 3: Verify build**

Run: `cd kapwa-server && npm run build`
Expected: clean build (41 dist entries).

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/main.ts kapwa-server/src/sync/sync.service.ts
git commit -m "feat: enable graceful shutdown hooks for clean SIGTERM handling"
```

---

## PHASE 2 — P1: Sprint N+1

### Task 7: U-03 — Claimant access-card route

**Files:**
- Create: `kapwa-client/src/pages/ClaimantAccessCardPage.tsx`
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/query-keys.ts` (if `myAccessCard` key missing)

- [ ] **Step 1: Verify the claimant self-service endpoint exists**

Run: `cd kapwa-server && rg -n "me/access-card" src/beneficiaries/beneficiaries.controller.ts`
Expected: `@Get('me/access-card')` with `@Roles('claimant')` exists (confirmed).

- [ ] **Step 2: Write the failing test**

Create `kapwa-client/src/pages/ClaimantAccessCardPage.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ClaimantAccessCardPage } from './ClaimantAccessCardPage';

vi.mock('swr', () => ({
  default: (key: string, fetcher: () => Promise<unknown>) => {
    if (key === 'beneficiaries.myAccessCard') {
      return { data: { code: 'NORZ-AC-2026-0042', services: [] }, isLoading: false, error: undefined };
    }
    return { data: undefined, isLoading: true, error: undefined };
  },
}));

describe('ClaimantAccessCardPage', () => {
  it('renders the access card code for the logged-in claimant', () => {
    render(<MemoryRouter><ClaimantAccessCardPage /></MemoryRouter>);
    expect(screen.getByText(/NORZ-AC-2026-0042/)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/pages/ClaimantAccessCardPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the page**

Create `kapwa-client/src/pages/ClaimantAccessCardPage.tsx`:

```typescript
import useSWR from 'swr';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyAccessCard {
  code: string;
  services?: { service_rendered?: string; service_date?: string; cost?: number | null }[];
}

export function ClaimantAccessCardPage() {
  const { data, isLoading, error } = useSWR<MyAccessCard>('beneficiaries.myAccessCard');

  return (
    <PageShell title="My Access Card" description="Your service history on record with MSWDO">
      {isLoading && <p className="text-sm text-muted-foreground">Loading your access card…</p>}
      {error && <p className="text-sm text-destructive">Could not load your access card.</p>}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">{data.code}</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.services?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No services recorded yet.</p>
            )}
            <ul className="space-y-2">
              {(data.services ?? []).map((s, i) => (
                <li key={i} className="flex justify-between text-sm border-b py-2">
                  <span>{s.service_rendered}</span>
                  <span>{s.service_date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 5: Wire the route + query key**

In `kapwa-client/src/routes.tsx`:
- Import: `import { ClaimantAccessCardPage } from './pages/ClaimantAccessCardPage';`
- Add before the catch-all (line 136):
```tsx
{ path: '/my-access-card', element: <Private roles={['claimant']}><ClaimantAccessCardPage /></Private> },
```

In `kapwa-client/src/lib/query-keys.ts`, under `beneficiaries`, add if missing:
```typescript
myAccessCard: () => memo('beneficiaries.myAccessCard', () => ['beneficiaries', 'me', 'access-card'] as const),
```
Then in the page use `queryKeys.beneficiaries.myAccessCard()` as the SWR key (and update the mock key in the test to the resolved string `'beneficiaries/me/access-card'`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/pages/ClaimantAccessCardPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/pages/ClaimantAccessCardPage.tsx kapwa-client/src/pages/ClaimantAccessCardPage.test.tsx kapwa-client/src/routes.tsx kapwa-client/src/lib/query-keys.ts
git commit -m "feat: add claimant access card page, fixing the dead /my-access-card nav link"
```

---

### Task 8: B-04 + U-04 — Sync-status + offline indicators

**Files:**
- Create: `kapwa-client/src/hooks/useConnectivity.ts`
- Create: `kapwa-client/src/hooks/useSyncStatus.ts`
- Modify: `kapwa-client/src/components/Topbar.tsx`
- Modify: `kapwa-client/src/lib/sync.ts` (export a `getPendingCount` helper if missing)
- Modify: `kapwa-client/src/components/Topbar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `kapwa-client/src/hooks/useConnectivity.test.tsx`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useConnectivity } from './useConnectivity';

describe('useConnectivity', () => {
  it('starts with navigator.onLine and flips on offline/online events', () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current).toBe(navigator.onLine);
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });
});
```

Create `kapwa-client/src/hooks/useSyncStatus.test.ts`:

```typescript
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useSyncStatus } from './useSyncStatus';

vi.mock('../lib/offline-queue', () => ({
  loadQueue: vi.fn(async () => [{ id: '1' }]),
}));

describe('useSyncStatus', () => {
  it('reports pending change count from the offline queue', async () => {
    const { result } = renderHook(() => useSyncStatus());
    // polling interval is 5s; flush microtasks + timers
    await new Promise(r => setTimeout(r, 20));
    expect(result.current.pending).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kapwa-client && npx vitest run src/hooks/useConnectivity.test.tsx src/hooks/useSyncStatus.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `useConnectivity.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useConnectivity(): boolean {
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}
```

- [ ] **Step 4: Create `useSyncStatus.ts`**

```typescript
import { useState, useEffect } from 'react';
import { loadQueue } from '../lib/offline-queue';

export function useSyncStatus() {
  const [pending, setPending] = useState(0);
  const [isOnline] = [useConnectivity()];

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const q = await loadQueue();
        if (alive) setPending(q.length);
      } catch {
        if (alive) setPending(0);
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  return { pending, isOnline };
}

import { useConnectivity } from './useConnectivity';
```
**Note:** move the `import { useConnectivity }` to the top of the file (imports hoist, but keep it clean — place it with the other imports).

- [ ] **Step 5: Wire into `Topbar.tsx`**

1. Import: `import { useConnectivity } from '@/hooks/useConnectivity';` and `import { useSyncStatus } from '@/hooks/useSyncStatus';` and `import { WifiOff } from 'lucide-react';`
2. In the component: `const online = useConnectivity();` and `const { pending } = useSyncStatus();`
3. Render an offline badge left of the user avatar (before the closing `</div>` of the actions group):
```tsx
{!online && (
  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50" aria-label="Offline indicator">
    <WifiOff size={12} className="mr-1" /> Offline
  </Badge>
)}
{pending > 0 && online && (
  <Badge variant="outline" className="border-blue-400 text-blue-600 bg-blue-50" aria-label="Pending sync count">
    {pending} pending
  </Badge>
)}
```
4. Persistent warning for the high-risk offline-with-pending case: add a fixed banner below the header when `!online && pending > 0` (mirror the existing `SyncStatusBanner` markup, amber background, non-dismissible):
```tsx
{!online && pending > 0 && (
  <div className="fixed top-[4.5rem] left-0 right-0 z-50 bg-amber-500 text-white px-4 py-1.5 text-center text-xs font-medium" role="alert">
    You are offline — {pending} change(s) pending sync. Do not clear app data.
  </div>
)}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/hooks/useConnectivity.test.tsx src/hooks/useSyncStatus.test.ts src/components/Topbar.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-client/src/hooks/useConnectivity.ts kapwa-client/src/hooks/useConnectivity.test.tsx kapwa-client/src/hooks/useSyncStatus.ts kapwa-client/src/hooks/useSyncStatus.test.ts kapwa-client/src/components/Topbar.tsx kapwa-client/src/components/Topbar.test.tsx
git commit -m "feat: add offline and pending-sync indicators to the app shell"
```

---

### Task 9: B-03 — Inter-agency referral notifications

**Files:**
- Modify: `kapwa-server/src/notifications/notifications.controller.ts:34-74`
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts`
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`
- Modify: `kapwa-server/src/notifications/notifications.service.ts` (add a small helper, optional)
- Modify: `kapwa-client/src/lib/role-access.ts` (add `agency_staff` to `NOTIFICATION_ROLES`)

- [ ] **Step 1: Write the failing test**

Append to `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`:

```typescript
describe('referral notifications', () => {
  it('notifies receiving agency staff when a referral is created', async () => {
    const notifyMock = jest.fn().mockResolvedValue(undefined);
    const staff = [{ id: 'staff-1', agencyId: 'agency-to', role: 'agency_staff' }];

    const service = new InterAgencyReferralsService(
      repoMock as any, agencyRepoMock as any, benRepoMock as any, caseRepoMock as any, casesServiceMock as any,
      userRepoMock as any,
    );
    (service as any).notifService = { create: notifyMock, notifyReferral: notifyMock };
    (service as any).userRepo = { find: jest.fn().mockResolvedValue(staff) };
    (agencyRepoMock.findOne as jest.Mock).mockResolvedValue({ id: 'agency-to', isActive: true, name: 'RHU' });

    await service.create({ toAgencyId: 'agency-to', reason: 'medical', legalBasisCode: 'LB-1' } as any, { id: 'sw-1', agencyId: 'agency-from' } as any);

    expect(notifyMock).toHaveBeenCalled();
  });
});
```
**Note:** you will need to add `userRepoMock` to the existing spec's mock setup and update the `new InterAgencyReferralsService(...)` constructor calls in the file to pass the new dependency. Match the existing mock pattern in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/inter-agency-referrals --coverage=false`
Expected: FAIL — constructor arity mismatch / notifService undefined.

- [ ] **Step 3: Add `agency_staff` to notifications controller roles**

In `kapwa-server/src/notifications/notifications.controller.ts`, on the `@Roles` decorators at lines 34, 40, 47, 53, 59, 65, 74 add `'agency_staff'`:
```typescript
@Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor', 'agency_staff')
```

- [ ] **Step 4: Wire notifications into `InterAgencyReferralsService`**

1. Add imports:
```typescript
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification.entity';
import { UserRole } from '../auth/user.entity';
```
2. Add constructor params (after `casesService`):
```typescript
@InjectRepository(User)
private userRepo: Repository<User>,
private notifService: NotificationsService,
```
3. Add a private helper:
```typescript
private async notifyAgency(agencyId: string, title: string, message: string) {
  const staff = await this.userRepo.find({ where: { agencyId, role: UserRole.AGENCY_STAFF } });
  for (const s of staff) {
    await this.notifService.create({
      recipientId: s.id,
      title,
      message,
      category: NotificationCategory.CASE_UPDATE,
      channel: 'in_app',
    });
  }
}
```
4. In `create()` after `this.repo.save(ref)`:
```typescript
await this.notifyAgency(toAgency.id, 'New Inter-Agency Referral', `New referral from ${fromAgency.name}: ${dto.reason}`);
```
(If `fromAgency.name` isn't loaded here, fetch it or use `caller.fullName`; keep the message PII-free — use `dto.reason`, not the person's name, to avoid leaking PII in a notification.)
5. In `receive/action/close/decline`, after save, notify the creator if present:
```typescript
if (ref.createdBy) {
  await this.notifService.create({
    recipientId: ref.createdBy,
    title: 'Inter-Agency Referral Update',
    message: `Referral #${ref.id.slice(0, 8)} was ${ref.status} by the receiving agency.`,
    category: NotificationCategory.CASE_UPDATE,
    channel: 'in_app',
  });
}
```
**Note:** The `notification.entity.ts` has `channel: NotificationType` — confirm the `in_app` literal is valid (check the entity's `NotificationType` enum); if the entity uses a different channel enum, use the matching literal.

- [ ] **Step 5: Update client `NOTIFICATION_ROLES`**

In `kapwa-client/src/lib/role-access.ts`:
```typescript
export const NOTIFICATION_ROLES = [
  'admin', 'social_worker', 'coordinator', 'claimant', 'auditor', 'agency_staff',
];
```
(Keep `CHAT_ROLES` unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/inter-agency-referrals --coverage=false`
Expected: PASS (including the new notification test).
Run: `cd kapwa-client && npx vitest run src/pages/LoginPage.test.tsx src/components/Topbar.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/notifications/notifications.controller.ts kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts kapwa-client/src/lib/role-access.ts
git commit -m "feat: notify agency staff of inter-agency referrals and status updates"
```

---

### Task 10: U-05 — Intake autosave (draft recovery)

**Files:**
- Create: `kapwa-client/src/hooks/useIntakeAutosave.ts`
- Modify: `kapwa-client/src/pages/IntakePage.tsx`
- Modify: `kapwa-client/src/pages/IntakePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/pages/IntakePage.test.tsx` (or a new `useIntakeAutosave.test.ts`):

```typescript
import { renderHook, act } from '@testing-library/react';
import { useIntakeAutosave, clearDraft, loadDraft } from './useIntakeAutosave';

describe('useIntakeAutosave', () => {
  const draft = { beneficiary: { surname: 'Dela Cruz' }, hasConsent: true };

  it('persists the form to localStorage after the debounce window', async () => {
    renderHook(() => useIntakeAutosave(draft));
    await act(() => new Promise(r => setTimeout(r, 2500)));
    expect(loadDraft()?.data).toMatchObject(draft);
  });

  it('clears the draft on explicit clear', () => {
    useIntakeAutosave(draft);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/hooks/useIntakeAutosave.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `useIntakeAutosave.ts`**

```typescript
import { useEffect } from 'react';

const STORAGE_KEY = 'kapwa:intake:draft';
const DEBOUNCE_MS = 2000;

export interface IntakeDraft {
  data: unknown;
  savedAt: string;
}

export function useIntakeAutosave<T>(formData: T) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: formData, savedAt: new Date().toISOString() } as IntakeDraft));
      } catch {
        // storage full or unavailable — ignore
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData]);
}

export function loadDraft(): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntakeDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Wire into `IntakePage.tsx`**

1. Import: `import { useIntakeAutosave, loadDraft, clearDraft } from '@/hooks/useIntakeAutosave';`
2. Build a serializable snapshot of the form (replaces the existing state on every render):
```typescript
const formSnapshot = useMemo(() => ({
  beneficiary,
  claimant,
  relationshipToBeneficiary,
  family,
  beneficiaryIsClaimant,
  hasConsent,
}), [beneficiary, claimant, relationshipToBeneficiary, family, beneficiaryIsClaimant, hasConsent]);

useIntakeAutosave(formSnapshot);
```
3. On mount, restore a draft (add to the existing `useEffect` for prefill):
```typescript
useEffect(() => {
  const draft = loadDraft();
  if (draft?.data && !location.state?.prefill) {
    const d = draft.data as {
      beneficiary: PersonForm;
      claimant: PersonForm;
      relationshipToBeneficiary: string;
      family: FamilyMember[];
      beneficiaryIsClaimant: boolean;
      hasConsent: boolean;
    };
    setBeneficiary(d.beneficiary);
    setClaimant(d.claimant);
    setRelationshipToBeneficiary(d.relationshipToBeneficiary);
    setFamily(d.family ?? []);
    setBeneficiaryIsClaimant(d.beneficiaryIsClaimant);
    setHasConsent(d.hasConsent);
  }
}, []);
```
4. On successful submit (in `handleSubmit`, after `navigate(...)` in both the match-check and direct-submit branches): `clearDraft();`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/hooks/useIntakeAutosave.test.ts src/pages/IntakePage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/hooks/useIntakeAutosave.ts kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/hooks/useIntakeAutosave.test.ts
git commit -m "feat: autosave intake form drafts to localStorage with recovery"
```

---

### Task 11: U-06 — Confirmation dialogs on destructive actions

**Files:**
- Modify: `kapwa-client/src/pages/InterAgencyReferralsPage.tsx` (close / decline)
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (case closure)
- Modify: `kapwa-client/src/pages/AdminWipePage.tsx` (wipe)
- Modify: `kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx` / existing page tests

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx`:

```typescript
it('requires confirmation before closing a referral', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><InterAgencyReferralsPage /></MemoryRouter>);
  await user.click(screen.getByRole('button', { name: /close referral/i }));
  expect(screen.getByText(/cannot be undone/i)).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/pages/InterAgencyReferralsPage.test.tsx`
Expected: FAIL — clicking close performs the action immediately (no dialog).

- [ ] **Step 3: Wrap close/decline in an AlertDialog**

`InterAgencyReferralsPage.tsx` — for both the **Close** and **Decline** actions, replace the immediate handler with an `AlertDialog` (the components are already used in `Topbar.tsx` — import from `@/components/ui/alert-dialog`):

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Close Referral</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Close Referral?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently close the referral for this beneficiary. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep Open</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleClose(ref)}>Close Referral</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
Do the same for Decline (`variant="outline"`), and for **case closure** in `CaseViewPage.tsx` and **admin wipe** in `AdminWipePage.tsx` (the wipe page must require typing a confirmation phrase if it already has one — if not, add an AlertDialog with a `destructive` action).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/pages/InterAgencyReferralsPage.test.tsx`
Expected: PASS.
Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx src/pages/AdminWipePage.test.tsx 2>&1 | tail -5` (if those test files exist)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/InterAgencyReferralsPage.tsx kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/pages/AdminWipePage.tsx kapwa-client/src/pages/InterAgencyReferralsPage.test.tsx
git commit -m "fix: require confirmation before destructive close, decline, and wipe actions"
```

---

### Task 12: S-03 + S-05 — Deep health check + structured logging

**Files:**
- Modify: `kapwa-server/src/app.controller.ts`
- Modify: `kapwa-server/src/main.ts`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-server/src/app.controller.spec.ts` (create if missing):

```typescript
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController health', () => {
  it('reports degraded when the database is unreachable', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('down')) };
    const controller = new AppController(dataSource as any);
    await expect(controller.health()).rejects.toThrow();
  });

  it('reports ok when the database responds', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new AppController(dataSource as any);
    const res = await controller.health();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('connected');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/app.controller.spec.ts --coverage=false`
Expected: FAIL — health() has no db check / constructor arity mismatch.

- [ ] **Step 3: Add deep health check to `AppController`**

```typescript
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { phTime } from './common/utils';

@Controller()
export class AppController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  root() {
    return { name: 'KAPWA API', version: '1.0.0' };
  }

  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected', timestamp: phTime() };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'disconnected' });
    }
  }

  @Get('health/live')
  live() {
    return { status: 'ok', timestamp: phTime() };
  }

  @Get('health/ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', db: 'connected', timestamp: phTime() };
    } catch {
      throw new ServiceUnavailableException({ status: 'not-ready', db: 'disconnected' });
    }
  }
}
```
**Note:** if `AppController` is not currently registered in `AppModule` as a controller needing `TypeOrmModule.forFeature` — `@InjectDataSource` needs `TypeOrmModule.forRoot` (already global), so no module change is needed. If `AppController` has no constructor currently, this is the first DI dep — confirm `AppModule` provides it (it does, `controllers: [AppController]`).

- [ ] **Step 4: Add JSON structured logging in `main.ts`**

After `const app = await NestFactory.create(AppModule);` (and after `enableShutdownHooks`), add:

```typescript
app.useLogger({
  log: (message: unknown, ...optionalParams: unknown[]) =>
    console.log(JSON.stringify({ level: 'info', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
  error: (message: unknown, ...optionalParams: unknown[]) =>
    console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
  warn: (message: unknown, ...optionalParams: unknown[]) =>
    console.warn(JSON.stringify({ level: 'warn', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
  debug: (message: unknown, ...optionalParams: unknown[]) =>
    console.debug(JSON.stringify({ level: 'debug', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
  verbose: (message: unknown, ...optionalParams: unknown[]) =>
    console.log(JSON.stringify({ level: 'verbose', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
  fatal: (message: unknown, ...optionalParams: unknown[]) =>
    console.error(JSON.stringify({ level: 'fatal', ts: new Date().toISOString(), msg: message, meta: optionalParams })),
});
```
**Note:** check the NestJS version's `LoggerService` interface — if `fatal` is not in the type, omit it (add `fatal?` only if the interface requires it).

- [ ] **Step 5: Run tests + build to verify**

Run: `cd kapwa-server && npx jest src/app.controller.spec.ts --coverage=false`
Expected: PASS.
Run: `cd kapwa-server && npm run build`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/app.controller.ts kapwa-server/src/app.controller.spec.ts kapwa-server/src/main.ts
git commit -m "feat: deep health probes and JSON structured logging"
```

---

### Task 13: U-09 — Breadcrumbs on deep pages

**Files:**
- Modify: `kapwa-client/src/components/Topbar.tsx:38-61`
- Modify: `kapwa-client/src/lib/breadcrumbs.ts`
- Modify: `kapwa-client/src/components/Topbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/components/Topbar.test.tsx`:

```typescript
it('shows breadcrumbs on a deep page like /cases/123', () => {
  const { container } = renderWithTopbar({ pathname: '/cases/123' });
  const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
  expect(nav).not.toBeNull();
});
```
**Note:** extend `renderWithTopbar` to accept a `pathname` and render inside a `<MemoryRouter initialEntries={[pathname]}>`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/components/Topbar.test.tsx`
Expected: FAIL — breadcrumb nav is hidden when `crumbs.length <= 1` (actually `/cases/123` should produce 2 crumbs — verify `breadcrumbs.ts`; if it produces 1, the test still fails and the bug is in `breadcrumbs.ts`).

- [ ] **Step 3: Fix `BreadcrumbNav` guard**

In `Topbar.tsx`, change line 40 from:
```typescript
if (crumbs.length <= 1) return null;
```
to:
```typescript
if (crumbs.length < 1) return null;
```
And verify `kapwa-client/src/lib/breadcrumbs.ts` maps `/cases/:id` to `[Cases, Case <id>]`; if it returns only one crumb for deep routes, add the mapping:
```typescript
// breadcrumbs.ts — add a dynamic label for /cases/:id
if (path.startsWith('/cases/')) {
  const id = path.split('/')[2];
  crumbs = [{ label: 'Cases', href: '/cases' }, { label: `Case ${id.slice(0, 8)}`, href: path }];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/components/Topbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/Topbar.tsx kapwa-client/src/lib/breadcrumbs.ts kapwa-client/src/components/Topbar.test.tsx
git commit -m "fix: show breadcrumbs on deep pages and add case detail mapping"
```

---

## PHASE 3 — P2/P3: Backlog Features

### Task 14: S-06 — Harden sync against unknown meta fields

**Files:**
- Modify: `kapwa-server/src/sync/sync.service.ts:38-47`
- Modify: `kapwa-server/src/sync/sync.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-server/src/sync/sync.service.spec.ts`:

```typescript
it('rejects payloads with unknown underscore-prefixed meta fields', async () => {
  const payload = { _fsmTransition: true, _status: 'disbursed', first_name: 'X' };
  const input = {
    deviceId: 'd1', changes: [{ id: 'c1', tableName: 'cases', recordId: 'r1', operation: 'UPDATE', payload, clientUpdatedAt: new Date().toISOString() }],
    versionVectors: [], idempotencyKey: 'k1', signature: 'sig',
  };
  await expect(service.processDelta(input)).rejects.toThrow('Unknown meta fields');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/sync/sync.service.spec.ts --coverage=false`
Expected: FAIL — currently `_status` is stripped silently.

- [ ] **Step 3: Add the meta-field validation**

In `sanitizePayload` (or the loop that processes changes), before sanitizing, validate:

```typescript
const FSM_FIELDS = new Set(['_fsmTransition', '_clientUpdatedAt']);
for (const [k] of Object.entries(payload)) {
  if (k.startsWith('_') && !FSM_FIELDS.has(k)) {
    throw new BadRequestException(`Unknown meta fields: ${k}`);
  }
}
```
Place this at the top of `sanitizePayload` so it throws before any stripping.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/sync/sync.service.spec.ts --coverage=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/sync/sync.service.ts kapwa-server/src/sync/sync.service.spec.ts
git commit -m "security: reject unknown underscore meta fields in sync payloads"
```

---

### Task 15: U-08 — Accessible error recovery (ErrorState + retry on top pages)

**Files:**
- Create: `kapwa-client/src/components/ErrorState.tsx`
- Modify: `kapwa-client/src/components/EmptyState.tsx` (add error variant if not present)
- Modify: `kapwa-client/src/pages/BeneficiariesPage.tsx`
- Modify: `kapwa-client/src/pages/CasesPage.tsx`
- Modify: `kapwa-client/src/pages/CaseTrackerPage.tsx`
- Modify: `kapwa-client/src/pages/InterAgencyReferralsPage.tsx`
- Modify: `kapwa-client/src/pages/AgencyReferralsPage.tsx`

- [ ] **Step 1: Write the failing test**

Create `kapwa-client/src/components/ErrorState.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders title, message, and a working retry button', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState title="Could not load cases" message="Check your connection." onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/components/ErrorState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `ErrorState.tsx`**

```typescript
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="alert">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message && <p className="text-xs text-muted-foreground max-w-sm">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Integrate into the 5 pages**

In each page, when SWR `error` is set, render `<ErrorState title="Could not load ..." message="Check your internet connection and try again." onRetry={() => mutate()} />` instead of the current generic text. `mutate` comes from the page's existing `useSWR` call (destructure `{ error, mutate }`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/components/ErrorState.test.tsx src/pages/BeneficiariesPage.test.tsx src/pages/CasesPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/components/ErrorState.tsx kapwa-client/src/components/ErrorState.test.tsx kapwa-client/src/pages/BeneficiariesPage.tsx kapwa-client/src/pages/CasesPage.tsx kapwa-client/src/pages/CaseTrackerPage.tsx kapwa-client/src/pages/InterAgencyReferralsPage.tsx kapwa-client/src/pages/AgencyReferralsPage.tsx
git commit -m "feat: accessible error recovery with retry across top data pages"
```

---

### Task 16: B-05 — Coordinator quick-scan service log

**Files:**
- Create: `kapwa-client/src/components/QuickScanCard.tsx`
- Modify: `kapwa-client/src/pages/CoordinatorDashboardPage.tsx`
- Modify: `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx`:

```typescript
it('renders the quick-scan card for coordinators', () => {
  render(<MemoryRouter><CoordinatorDashboardPage /></MemoryRouter>);
  expect(screen.getByLabelText(/access card code/i)).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/pages/CoordinatorDashboardPage.test.tsx`
Expected: FAIL — no quick-scan input.

- [ ] **Step 3: Create `QuickScanCard.tsx`**

```typescript
import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QuickScanCardProps {
  onLogged?: () => void;
}

export function QuickScanCard({ onLogged }: QuickScanCardProps) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ beneficiaryName?: string } | null>(null);
  const [error, setError] = useState('');

  async function verify() {
    setError('');
    setResult(null);
    if (!code.trim()) return;
    try {
      const data = await api.get<{ beneficiaryName?: string; code?: string }>(`/access-cards/${code.trim()}/summary`);
      setResult(data);
    } catch {
      setError('Card not found. Check the code and try again.');
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Quick Scan</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input
          aria-label="Access card code"
          placeholder="NORZ-AC-2026-XXXX"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }}
        />
        <Button onClick={verify} disabled={!code.trim()}>Verify Card</Button>
        {result && <p className="text-sm text-green-700">{result.beneficiaryName ?? 'Card valid'}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <Button variant="outline" size="sm" onClick={() => { setCode(''); setResult(null); onLogged?.(); }}>
            Next Card
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```
**Note:** verify the actual response shape of `GET /access-cards/:code/summary` (`access-cards.controller.ts` line 56 returns `getAgencySummary`) before finalizing — adapt the type to the real fields.

- [ ] **Step 4: Mount on `CoordinatorDashboardPage`**

Add `<QuickScanCard />` (or `onLogged` wired to a `mutate` of the dashboard's access-card data) to the coordinator dashboard layout.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/pages/CoordinatorDashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/components/QuickScanCard.tsx kapwa-client/src/pages/CoordinatorDashboardPage.tsx kapwa-client/src/pages/CoordinatorDashboardPage.test.tsx
git commit -m "feat: coordinator quick-scan access card service log panel"
```

---

### Task 17: U-07 — Dark mode default to system

**Files:**
- Modify: `kapwa-client/src/lib/theme-context.tsx`
- Modify: `kapwa-client/src/components/BottomNav.tsx` (toggle slot)

- [ ] **Step 1: Change default to `system`**

In `kapwa-client/src/lib/theme-context.tsx`, change the initial theme state (and any persisted default) from `'light'` to `'system'`, and ensure the resolved theme applies the `dark` class on `<html>` when `system` resolves dark. Add a test in the existing theme-context test (if present) verifying the default resolves from OS preference.

- [ ] **Step 2: Verify Tailwind dark mode config**

Confirm Tailwind v4 dark-mode strategy (CSS `@custom-variant dark` or class-based). Ensure the `dark` class is toggled on `document.documentElement` when resolved theme is dark. Run: `cd kapwa-client && npx vitest run src/lib 2>&1 | tail -5` to confirm no regressions.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/lib/theme-context.tsx kapwa-client/src/components/BottomNav.tsx
git commit -m "feat: default theme to system preference for field workers"
```

---

### Task 18: B-02 — Automated compliance reports

**Files:**
- Modify: `kapwa-server/src/export/export.controller.ts`
- Modify: `kapwa-server/src/export/export.service.ts`
- Modify: `kapwa-server/src/export/export.service.spec.ts`
- Modify: `kapwa-client/src/pages/MayorReportsPage.tsx`
- Modify: `kapwa-client/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Write the failing server tests**

Append to `kapwa-server/src/export/export.service.spec.ts`:

```typescript
describe('monthly fund utilization report', () => {
  it('builds a workbook with a program x fund_source sheet', async () => {
    const result = await service.monthlyFundUtilization('2026-08');
    expect(result).toHaveProperty('buffer');
    expect(result).toHaveProperty('filename');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/export --coverage=false`
Expected: FAIL — method not found.

- [ ] **Step 3: Implement `monthlyFundUtilization` in `export.service.ts`**

```typescript
async monthlyFundUtilization(month: string): Promise<{ buffer: Buffer; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fund Utilization');
  sheet.columns = [
    { header: 'Program', key: 'program', width: 30 },
    { header: 'Fund Source', key: 'fundSource', width: 20 },
    { header: 'Amount', key: 'amount', width: 16 },
  ];
  // Aggregate from case_interventions joined to programs + case status = 'disbursed'
  const rows = await this.dataSource.query(
    `SELECT p.name AS program, ci.fund_source AS "fundSource", COALESCE(SUM(ci.amount), 0) AS amount
     FROM case_interventions ci
     LEFT JOIN programs p ON p.id = ci.program_id
     WHERE ci.service_date >= $1 AND ci.service_date < $2
     GROUP BY p.name, ci.fund_source ORDER BY p.name`,
    [`${month}-01`, nextMonth(month)],
  );
  rows.forEach(r => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: `fund-utilization-${month}.xlsx` };
}
```
**Note:** adapt the SQL to the actual `case_interventions`/`programs` column names in this codebase (`fund_source`, `amount`, `program_id`, `service_date`); verify against `DB-SCHEMA.md` §10 before finalizing. `ExcelJS` is already a dependency.

- [ ] **Step 4: Add the endpoint + client buttons**

In `export.controller.ts` add `GET /export/monthly-funds?month=YYYY-MM` returning the workbook with `Content-Disposition`. Add "Export Fund Utilization" buttons on `MayorReportsPage.tsx` and `DashboardPage.tsx` that trigger a download (`window.open` or an anchor with the token header, matching existing export-button conventions in `ReportsExportButton.tsx`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/export --coverage=false`
Expected: PASS.
Run: `cd kapwa-client && npx vitest run src/pages/MayorReportsPage.test.tsx src/pages/DashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/export/export.controller.ts kapwa-server/src/export/export.service.ts kapwa-server/src/export/export.service.spec.ts kapwa-client/src/pages/MayorReportsPage.tsx kapwa-client/src/pages/DashboardPage.tsx
git commit -m "feat: monthly fund utilization export for COA reporting"
```

---

### Task 19: B-06 — Certificate generation (pdfkit)

**Files:**
- Modify: `kapwa-server/src/export/export.service.ts` + controller (add `POST /export/certificate`)
- Modify: `kapwa-client/src/pages/BeneficiaryViewPage.tsx`
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx`
- Modify: `kapwa-server/src/export/export.service.spec.ts`

- [ ] **Step 1: Write the failing server test**

Append to `kapwa-server/src/export/export.service.spec.ts`:

```typescript
describe('certificate generation', () => {
  it('produces a PDF for a certificate of indigency', async () => {
    const result = await service.generateCertificate('indigency', { fullName: 'Juan Dela Cruz', address: 'Poblacion, Norzagaray', date: '2026-08-04' });
    expect(result.buffer).toBeDefined();
    expect(result.buffer.toString('ascii', 0, 4)).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/export --coverage=false`
Expected: FAIL — method not found.

- [ ] **Step 3: Implement `generateCertificate`**

```typescript
import PDFDocument from 'pdfkit';

async generateCertificate(
  type: 'indigency' | 'eligibility' | 'referral',
  data: { fullName: string; address?: string; date: string; details?: string },
): Promise<{ buffer: Buffer; filename: string }> {
  const doc = new PDFDocument({ size: 'A4', margin: 60 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', resolve));

  doc.fontSize(18).text(`CERTIFICATE OF ${type.toUpperCase()}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`This certifies that ${data.fullName}${data.address ? ` of ${data.address}` : ''} ...`);
  doc.moveDown();
  doc.text(`Issued ${data.date}`);
  if (data.details) doc.text(data.details);
  doc.end();
  await done;
  return { buffer: Buffer.concat(chunks), filename: `certificate-${type}-${Date.now()}.pdf` };
}
```
Add `POST /export/certificate` in the controller (Zod-validated body) and "Generate Certificate" buttons on `BeneficiaryViewPage` and `CaseViewPage` (POST then download the returned PDF blob).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/export --coverage=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/export/export.service.ts kapwa-server/src/export/export.controller.ts kapwa-server/src/export/export.service.spec.ts kapwa-client/src/pages/BeneficiaryViewPage.tsx kapwa-client/src/pages/CaseViewPage.tsx
git commit -m "feat: certificate of indigency/eligibility PDF generation"
```

---

### Task 20: B-01 — Batch family intake

**Files:**
- Modify: `kapwa-server/src/intake/intake.controller.ts` (add `POST /intake/batch-family`)
- Modify: `kapwa-server/src/intake/intake.service.ts` (add `submitBatchFamily`)
- Modify: `kapwa-server/src/intake/dto/intake.zod.ts` (add batch schema)
- Modify: `kapwa-client/src/pages/IntakePage.tsx` (batch submit + add-to-household)
- Modify: `kapwa-server/src/intake/dto/intake.zod.spec.ts`

- [ ] **Step 1: Write the failing server test**

Append to `kapwa-server/src/intake/dto/intake.zod.spec.ts`:

```typescript
describe('batch-family schema', () => {
  it('validates a primary plus member array', () => {
    const result = batchFamilySchema.safeParse({
      primary: { surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', dob: '1990-01-01' },
      members: [{ surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-02-02', relationship: 'Spouse' }],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/intake/dto/intake.zod.spec.ts --coverage=false`
Expected: FAIL — `batchFamilySchema` not defined.

- [ ] **Step 3: Add the batch schema + service method + endpoint**

In `intake.zod.ts` add a `batchFamilySchema` reusing the existing person/claimant schemas. In `intake.service.ts` add `submitBatchFamily(input)` that: creates the primary case via the existing intake flow, creates a household, links members via `household_memberships`, and returns the primary `caseId`. In the controller add `POST /intake/batch-family` (`@Roles('admin','social_worker')`) using the schema pipe.

- [ ] **Step 4: Update the client**

In `IntakePage.tsx`, after a successful single submit, show "Add another family member as a batch?" and when confirmed submit the queued `familyMembers` through `POST /intake/batch-family` with the primary's address pre-filled. Keep the flow optional so the 597-line form stays unchanged for single intake.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/intake --coverage=false`
Expected: PASS.
Run: `cd kapwa-client && npx vitest run src/pages/IntakePage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/intake/intake.controller.ts kapwa-server/src/intake/intake.service.ts kapwa-server/src/intake/dto/intake.zod.ts kapwa-server/src/intake/dto/intake.zod.spec.ts kapwa-client/src/pages/IntakePage.tsx
git commit -m "feat: batch family intake to reduce repeated data entry for households"
```

---

## Self-Review

**Spec coverage vs SYSTEMS_EVAL.MD findings:**
- S-01 → Task 1 ✓ (shared FSM + financial conflict rules)
- S-02 → Task 6 ✓ (graceful shutdown)
- S-03 → Task 12 ✓ (deep health + liveness/readiness)
- S-04 → Task 5 ✓ (tsc gate + 23 fixes)
- S-05 → Task 12 ✓ (JSON structured logging)
- S-06 → Task 14 ✓ (meta-field rejection)
- S-07 → Task 2 ✓ (shared ROLE_REDIRECT_MAP)
- B-01 → Task 20 ✓ (batch family intake)
- B-02 → Task 18 ✓ (monthly fund report; COA pack deferred to follow-up plan)
- B-03 → Task 9 ✓ (referral notifications)
- B-04 → Task 8 ✓ (sync-status indicator)
- B-05 → Task 16 ✓ (quick-scan card)
- B-06 → Task 19 ✓ (certificate PDFs)
- U-01 → Task 4 ✓ (role-filtered BottomNav)
- U-02 → Task 3 ✓ (shell 403 gate)
- U-03 → Task 7 ✓ (claimant access-card route)
- U-04 → Task 8 ✓ (offline indicator)
- U-05 → Task 10 ✓ (intake autosave)
- U-06 → Task 11 ✓ (confirmation dialogs)
- U-07 → Task 17 ✓ (system default dark mode)
- U-08 → Task 15 ✓ (ErrorState + retry)
- U-09 → Task 13 ✓ (breadcrumbs)

**Gaps / deferred:** (1) B-02 COA compliance *pack* (multi-sheet workbook or ZIP) is deferred — the monthly fund report ships first; (2) U-07 dark-mode *visual audit* of custom components is a manual QA step, not a code task — flagged as a verification step during the P3 sprint.

**Placeholder scan:** all tasks contain concrete code, exact commands, and expected outcomes. `renderWithTopbar`/`renderWithProviders` helpers are referenced as "reuse if exists / create per file conventions" — these are test-infra shims, not feature placeholders. Export/quick-scan SQL and response shapes are marked "verify against DB-SCHEMA.md / access-cards controller before finalizing" because they depend on live column names — the step includes the verification command.

**Type consistency:** `isValidTransition`/`canTransition` signatures match between Task 1 and both consumers; `ROLE_REDIRECT_MAP`, `NOTIFICATION_ROLES`, `CHAT_ROLES` from `role-access.ts` are consumed identically in Tasks 2/3/9; `useConnectivity`/`useSyncStatus`/`loadQueue` names match across Task 8; `ErrorState` props (`title`/`message`/`onRetry`) match Task 15's pages.
