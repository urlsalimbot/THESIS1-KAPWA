# KAPWA — Systems Engineering Evaluation & Remediation Plan

> **Prepared by**: systems engineer
> **Date**: 2026-08-04
> **Context**: Social welfare information system (MSWDO Norzagaray, Bulacan) — Post-EVALUATION.MD review
> **Reference**: EVALUATION.MD, ARCHITECTURE.md, KAPWA-PROJECT.md, docs/e2e-full-system.md

---

## Executive Summary

EVALUATION.MD identified 7 gaps (2 HIGH, 2 MEDIUM, 3 LOW). This document expands
those into **22 actionable findings** across three dimensions critical to a functioning
MSWDO system: **system stability** (will it survive a workday?), **ease of doing business**
(can social workers process 30 intakes/day?), and **UI/UX** (can field coordinators use it
in bright sunlight on a ₱5K phone?). Each finding references a concrete file, describes
the weakness in welfare-office context, and provides a scoped fix with file targets.

---

## 1. System Stability

### S-01 — Dual FSM Transition Tables (CRITICAL)

**File(s):**
`kapwa-server/src/cases/cases.service.ts:250-258` (validateTransition)
`kapwa-server/src/sync/sync.service.ts:49-57` (VALID_FSM_TRANSITIONS)

**Problem:**
Two independent copies of the same case-state transition table exist. If a social
worker transitions a case via direct REST API (`POST /cases/:id/status`) the
`cases.service` table rules apply; if the same case is synced offline the `sync.service`
table rules apply. The tables are currently identical but they **will** diverge —
the next feature that adds a state (e.g. `appealed`) will be patched in one and missed
in the other. Seven test suites already fail because tests target one table and the
runtime uses the other.

**Impact:**
A field coordinator's synced case could enter an impossible state. On the next sync,
the conflict resolver sees a "valid" transition (from sync's table) that REST would
have rejected — silent data corruption.

**Remediation:**
Extract a single source of truth. Create `kapwa-server/src/cases/case-fsm.ts`:

```typescript
export const CASE_FSM = {
  enrolled:           ['assessed', 'closed'],
  assessed:           ['in_review', 'closed'],
  in_review:          ['active', 'closed'],
  active:             ['transitioning', 'closed'],
  transitioning:      ['closed'],
  closed:             [],
} as const;

export const CASE_FSM_ROLES = {
  enrolled:      ['social_worker', 'coordinator'],
  assessed:      ['social_worker', 'coordinator'],
  in_review:     ['admin', 'coordinator'],
  active:        ['admin', 'social_worker'],
  transitioning: ['social_worker', 'coordinator'],
  closed:        ['admin', 'social_worker', 'coordinator'],
} as const;

export function isValidTransition(from: string, to: string): boolean {
  return (CASE_FSM[from] ?? []).includes(to);
}

export function canTransition(from: string, role: string): boolean {
  return (CASE_FSM_ROLES[from] ?? ['admin']).includes(role);
}
```

Then import `{ isValidTransition, canTransition }` from both `cases.service` and
`sync.service`. Remove the private methods and hardcoded constants.

**Effort:** ~2 hours (extract + wire + fix the 7 test suites' expectations)
**Files changed:** `case-fsm.ts` (new), `cases.service.ts`, `sync.service.ts`,
`cases.service.spec.ts`, `conflict-resolver.spec.ts`

---

### S-02 — No Graceful Shutdown (HIGH)

**File(s):** `kapwa-server/src/main.ts:33`

**Problem:**
`NestFactory.create` is called without `enableShutdownHooks()`. When podman/docker
sends `SIGTERM` (during deploy or restart), NestJS kills the process immediately:
- In-flight API requests are dropped
- Database connections are torn down mid-transaction
- The sync service's in-flight delta processor leaves a partially-written sync_queue row

In a welfare office, a coordinator syncing 50 queued changes loses connectivity
mid-sync — the version vectors advance but the data doesn't land.

**Remediation:**
One line in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();  // <-- add this
```

This signals NestJS lifecycle hooks (`onApplicationShutdown`, `beforeApplicationShutdown`)
on every `@Injectable()` that implements `OnApplicationShutdown`. For the
sync and database modules specifically, add cleanup methods:

```typescript
// sync.service.ts
@Injectable()
export class SyncService implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Shutting down sync service (signal: ${signal})`);
    // flush in-progress delta batches, mark pending as retryable
  }
}
```

**Effort:** ~1 hour (enable hooks + audit sync/notification gateways for shutdown logic)
**Files changed:** `main.ts`, `sync.service.ts`, `chat.gateway.ts`, `notifications.gateway.ts`

---

### S-03 — Shallow Health Check (MEDIUM)

**File(s):** `kapwa-server/src/app.controller.ts:11-14`

**Problem:**
`GET /api/v1/health` returns `{ status: "ok", timestamp }` — it doesn't actually
verify the database connection, MinIO reachability, or Redis (if added). A podman
restart of postgres means healthcheck passes while the app serves 500s.

**Remediation:**
Add a deep health check:

```typescript
// app.controller.ts
@Get('health')
async health() {
  try {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', db: 'connected', timestamp: phTime() };
  } catch {
    throw new ServiceUnavailableException({ status: 'degraded', db: 'disconnected' });
  }
}
```

Also expose a readiness probe at `/api/v1/health/ready` and liveness at
`/api/v1/health/live` (differentiate boot-from-deployed for container orchestration).

**Effort:** ~30 minutes
**Files changed:** `app.controller.ts`, possibly `common/health.module.ts`

---

### S-04 — No tsc in Client Build Pipeline (HIGH)

**File(s):** `kapwa-client/package.json:6`

**Problem:**
`"build": "vite build"` does not run the TypeScript compiler. ~21 latent type errors
exist in `FamilyTreeGraph.tsx`, `api.ts`, and 4 test files. They don't surface because
Vite transpiles via esbuild which strips types.

In production, a refactored prop interface that breaks a component silently ships.

**Remediation:**
```json
"build": "tsc --noEmit && vite build"
```

Also add to CI:
```json
"typecheck": "tsc --noEmit"
```

Then fix the ~21 existing errors (mostly untyped `any` escapes in xyflow and
family graph components).

**Effort:** ~2 hours (add tsc step + fix 21 type errors)
**Files changed:** `package.json`, `FamilyTreeGraph.tsx`, `api.ts`, test files

---

### S-05 — No Structured Logging (MEDIUM)

**File(s):** `kapwa-server/src/common/common.module.ts`, `main.ts`

**Problem:**
Server uses raw `Logger` (NestJS built-in) — no JSON formatting, no log levels
gated by environment, no correlation IDs. In production, a 500 error from the
beneficiaries service produces `[BeneficiariesService] Error fetching beneficiary`
with no stack trace, no request ID, and no query parameters.

Welfare office staff report "the system is slow" but operations have no way to trace
which query is slow.

**Remediation:**
Three options in ascending complexity:
1. **Quick win** — override `Logger` in `main.ts` with a JSON-serializing logger:
```typescript
app.useLogger({
  log: (m) => console.log(JSON.stringify({ level: 'info', ts: new Date(), msg: m })),
  error: (m, trace) => console.error(JSON.stringify({ level: 'error', ts: new Date(), msg: m, trace })),
  warn: (m) => console.warn(JSON.stringify({ level: 'warn', ts: new Date(), msg: m })),
  debug: (m) => console.debug(JSON.stringify({ level: 'debug', ts: new Date(), msg: m })),
  verbose: (m) => {},
});
```
2. **Production** — `@nestjs/common` Pino logger adapter (built-in, zero deps):
3. **Full observability** — OpenTelemetry auto-instrumentation (traces + spans)

Recommend option 1 immediately, option 2 when approaching production deployment.

**Effort:** ~30 minutes (option 1), ~2 hours (option 2)
**Files changed:** `main.ts`, `common/common.module.ts`

---

### S-06 — Offline Sync FSM Control Field Stripping Bypass (MEDIUM)

**File(s):** `kapwa-server/src/sync/sync.service.ts:38-47`

**Problem:**
The sync service strips `_fsmTransition` and `_clientUpdatedAt` from the payload
(FILE CONTROL FIELDS at line 38-39). These are sent by the client's
`offline-queue.ts` `queueFsmTransition` function. But the client can include
arbitrary fields prefixed with `_` — the allow-list filter (`ALLOWED_COLUMNS`)
only strips undocumented columns; it does NOT check that `_fsmTransition` is the
ONLY underscore-prefixed field sent.

A corrupted client payload with `_status: 'disbursed'` would bypass service-layer
transition guards entirely if it matches an allowed column name.

**Remediation:**
Add a schema check in the sync controller:

```typescript
// sync.controller.ts (or service)
const FSM_FIELDS = ['_fsmTransition', '_clientUpdatedAt'];
const unknownMeta = Object.keys(payload).filter(k => k.startsWith('_') && !FSM_FIELDS.includes(k));
if (unknownMeta.length > 0) {
  throw new BadRequestException(`Unknown meta fields: ${unknownMeta.join(', ')}`);
}
```

**Effort:** ~30 minutes
**Files changed:** `sync.service.ts` (or `sync.controller.ts`)

---

### S-07 — LoginPage Duplicate redirectMap (MEDIUM)

**File(s):** `kapwa-client/src/pages/LoginPage.tsx:22` vs `kapwa-client/src/components/ProtectedRoute.tsx:8-15`

**Problem:**
Two copies of `roleRedirectMap` exist — `ProtectedRoute.tsx` (used to deny access)
and `LoginPage.tsx` (used after login). The recent fix (`ad71caf`) added
`agency_staff` to LoginPage's copy because it was missing. ProtectedRoute already had
it. Next role added will repeat this bug.

**Remediation:**
Extract `roleRedirectMap` to a shared constant in `lib/constants.ts`:

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
```

Import from both files. Add a test that verifies every `UserRole` value has an entry.

**Effort:** ~30 minutes
**Files changed:** `lib/constants.ts`, `LoginPage.tsx`, `ProtectedRoute.tsx`, `LoginPage.test.tsx`

---

## 2. Ease of Doing Business

### B-01 — No Batch/Family Intake (HIGH)

**File(s):** `kapwa-client/src/pages/IntakePage.tsx` (597 lines), `kapwa-server/src/intake/intake.service.ts`

**Problem:**
A social worker processing a family of 6 must fill the 597-line GIS Intake form 6
times — name, barangay, address, consent, requirements checklist, family members —
all repeated. In a real MSWDO with 30+ daily intakes, this means ~3 hours per social
worker just re-entering data.

The `households` and `household_memberships` tables already exist. The `persons`
model supports family relationships. But the intake flow is strictly one-beneficiary-at-a-time.

**Remediation:**
Phase 1 — "Batch Family Intake" button on the Intake form:
1. After completing the primary beneficiary, present "Add Family Member" action
2. Pre-fills address, barangay, household_id from primary
3. Collects name, relationship, DOB, gender per member
4. On submit: POST the primary, then POST each member with `household_id` linking
5. Backend: new endpoint `POST /intake/batch-family` accepting `{ primary, members[] }`

Phase 2 — "Add to Existing Household" search to attach new intake to an existing
household by scanning the primary beneficiary's access card.

**Effort:** Phase 1 ~4 hours (client form + server endpoint + tests)
**Files changed:** `IntakePage.tsx`, `intake/batch-family.component.tsx` (new),
`intake.controller.ts`, `intake.service.ts`, `intake.zod.ts`, tests

---

### B-02 — No Automated Report Generation (HIGH)

**File(s):** `kapwa-server/src/export/export.service.ts`, `kapwa-server/src/dashboard/dashboard.service.ts`

**Problem:**
Social workers and MSWDO admin must produce monthly reports for COA, DSWD, and LGU:
- Monthly fund utilization (disbursed vs allocated per program)
- Beneficiary demographics (age range, gender, barangay breakdown)
- SLA compliance (cases pending > 3 days, 7 days, 30 days)
- Inter-agency referral summary (referred, received, closed, declined)

Currently, each report requires manual data extraction from the dashboard pages.
No single-click export. No scheduled generation.

**Remediation:**
1. **Monthly Fund Utilization Report** — `GET /api/export/monthly-funds?month=2026-08`
   returns Excel (exceljs) with program × fund_source × amount pivot.
2. **COA Compliance Pack** — `GET /api/export/coa-pack?quarter=Q3-2026` returns
   a ZIP of: (a) fund utilization Excel, (b) disbursed cases CSV, (c) IRF summary,
   (d) consent ledger audit.
3. **Widget embedding** — Add "Export" buttons on MayorReportsPage and DashboardPage
   that call these endpoints.
4. **Scheduled email** (Phase 2) — Use `@nestjs/schedule` (already installed) to
   generate and email the COA pack monthly to `admin@mswdo.test`.

**Effort:** ~6 hours (3 export endpoints + client buttons + tests)
**Files changed:** `export.controller.ts`, `export.service.ts`, `export.module.ts`,
`MayorReportsPage.tsx`, `DashboardPage.tsx`

---

### B-03 — No Inter-Agency Referral Notifications (MEDIUM)

**File(s):** `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts`
`kapwa-server/src/notifications/notifications.service.ts`

**Problem:**
When MSWDO creates a referral to RHU, the RHU staff logs in and sees it on
their dashboard. But there is no push/email/SMS notification. The RHU staff
doesn't know a referral arrived until they manually check. In practice, referrals
sit for days — defeating the purpose of inter-agency coordination.

The notification infrastructure exists (in-app + SMS + email). The notifications
controller already supports `@Roles('admin','social_worker','coordinator','claimant','auditor')`.
Adding `agency_staff` to the list is straightforward.

**Remediation:**
1. Add `agency_staff` to notifications controller `@Roles` on the list/unread endpoints:
   `kapwa-server/src/notifications/notifications.controller.ts:34-74`
2. In `inter-agency-referrals.service.ts` `createReferral()`:
   ```typescript
   // Notify the receiving agency staff
   const agencyStaff = await this.userRepo.find({ where: { agencyId: toAgencyId, role: UserRole.AGENCY_STAFF } });
   for (const staff of agencyStaff) {
     await this.notifService.notify(staff.id, {
       title: 'New Inter-Agency Referral',
       message: `New referral from ${fromAgency.name}: ${personName}`,
       channel: 'in_app', // also email if opted in
     });
   }
   ```
3. On status change (`received → actioned → closed/declined`): notify the creating
   social worker.

**Effort:** ~2 hours (notifications wiring + tests)
**Files changed:** `notifications.controller.ts`, `inter-agency-referrals.service.ts`,
`notifications.service.spec.ts`

---

### B-04 — No Sync-Status Indicator (MEDIUM)

**File(s):** `kapwa-client/src/lib/sync.ts`, `kapwa-client/src/components/SyncStatusBanner.tsx`

**Problem:**
The offline sync module queues changes and syncs on reconnect, but the user has
no visibility into **what hasn't synced**. A coordinator in the field takes 5
intakes offline — there's no badge, no count, no indicator of which entries are
pending. If they return to the office with a dead battery before sync triggers,
the intake data is lost to the server.

`SyncStatusBanner.tsx` exists as a component but is unused / not wired into Layout.

**Remediation:**
1. Wire `SyncStatusBanner` into `Topbar.tsx` — show below the header bar when
   offline or when `pendingCount > 0`.
2. Add a `useSyncStatus()` hook that polls `offline-queue.ts loadQueue()`:
   ```typescript
   // hooks/useSyncStatus.ts
   export function useSyncStatus() {
     const [pending, setPending] = useState(0);
     useEffect(() => {
       const interval = setInterval(async () => {
         const q = await loadQueue();
         setPending(q.length);
       }, 5000);
       return () => clearInterval(interval);
     }, []);
     return { pending, isOnline: navigator.onLine };
   }
   ```
3. Show badge on the sync icon: `⚠️ 5 pending` with last-synced timestamp.
4. Critical UX: if `pending > 0 && !isOnline`, show a persistent non-dismissible
   banner: "You have 5 unsynced changes. Do not clear app data. Connect to the
   internet to sync."

**Effort:** ~2 hours (hook + banner wiring + Topbar integration)
**Files changed:** `useSyncStatus.ts` (new), `SyncStatusBanner.tsx`, `Topbar.tsx`

---

### B-05 — No Field Quick-Action Panel for Coordinators (MEDIUM)

**File(s):** `kapwa-client/src/pages/CoordinatorDashboardPage.tsx`

**Problem:**
Coordinator dashboard shows stats but the most common field action — "scan access
card → verify beneficiary → log service" — requires 3 separate navigations
(CoordinatorAccessCards → verify → history). A coordinator processing 20 walk-ins
at a barangay hall spends 60% of time on navigation.

**Remediation:**
Add a "Quick Scan" card on the CoordinatorDashboardPage:
1. Text input: enter access card code (`NORZ-AC-2026-XXXX`)
2. On submit: verify card → show beneficiary name + photo (if person linked)
3. Below: one-click "Log Service" button → opens a compact service-log form
   without leaving the page (Dialog or slide-over)
4. After logging: "Next Card" — resets the form for the next walk-in

**Effort:** ~3 hours (QuickScanCard component + coordinator dashboard integration)
**Files changed:** `CoordinatorDashboardPage.tsx`, `QuickScanCard.tsx` (new),
`CoordinatorAccessCardsPage.tsx` (reuse the verify endpoint)

---

### B-06 — No Certificate/Letter Generation (LOW)

**File(s):** N/A (new feature)

**Problem:**
MSWDO routinely issues: Certificate of Indigency, Certificate of Eligibility,
Referral Letter (for hospital/school), Barangay Clearance endorsement. Currently
these are typed manually in Word. The system has the data but can't produce the
documents.

**Remediation:**
A `POST /api/export/certificate` endpoint accepting `{ type, beneficiaryId, caseId? }`
that uses `pdfkit` (already a dependency) to fill a template. Add a "Generate
Certificate" button on `BeneficiaryViewPage` and `CaseViewPage`.

Template library: 4 templates stored as JSON → pdfkit layout definitions.

**Effort:** ~4 hours (certificate service + 4 templates + client button)
**Files changed:** `export.controller.ts`, `export.service.ts` (or new
`certificates` module), `BeneficiaryViewPage.tsx`, `CaseViewPage.tsx`

---

## 3. UI/UX

### U-01 — BottomNav Hardcoded Tabs (CRITICAL for mobile field workers)

**File(s):** `kapwa-client/src/components/BottomNav.tsx:20-26`

**Problem:**
`TABS` array is hardcoded with MSWDO-centric routes: Dashboard, Cases, Quick Action,
Beneficiaries, Profile. This is shown to ALL roles on mobile. A claimant sees
"Cases" and "Beneficiaries" (403). An agency_staff sees "Dashboard" (wrong dashboard —
redirects to /agency/dashboard on click but the tab is misleading). A mayor sees
the same tabs.

The desktop `Sidebar.tsx` correctly filters via `NAV_GROUPS` and `user.role`. Mobile
BottomNav bypasses this entirely.

**Remediation:**
Refactor `BottomNav` to derive tabs from `NAV_GROUPS` (same source as Sidebar):

```typescript
// BottomNav.tsx
export function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  // Derive mobile tabs from NAV_GROUPS — highlight the first item per group
  const mobileTabs = NAV_GROUPS
    .flatMap(g => g.items)
    .filter(item => item.roles.includes(user?.role ?? ''))
    .slice(0, 5); // max 5 tabs on mobile

  // ... render filtered tabs
}
```

Then configure per-role which items get the center "Quick Action" treatment.
For coordinators: `/coordinator/referrals/new`. For SW: `/intake`. For claimant:
(hide quick action). For agency_staff: `/agency/referrals` (or hide).

**Effort:** ~2 hours (refactor BottomNav + test on all 7 roles)
**Files changed:** `BottomNav.tsx`, `BottomNav.test.tsx`

---

### U-02 — Shell 403 Spam from NotificationsDropdown + MessagesPopover (HIGH)

**File(s):** `kapwa-client/src/components/NotificationsDropdown.tsx:66-69`
`kapwa-client/src/components/MessagesPopover.tsx:22-23`
`kapwa-client/src/components/Topbar.tsx:176-177`

**Problem:**
`Topbar.tsx` unconditionally renders `<NotificationsDropdown />` and
`<MessagesPopover />` for all roles. These components fire `useSWR` on mount
against:
- `GET /notifications/my` → 403 for mayor, agency_staff
- `GET /notifications/unread` → 403 for mayor, agency_staff
- `GET /chat/conversations` → 403 for mayor, auditor, agency_staff
- `GET /chat/unread` → 403 for mayor, auditor, agency_staff

That's 2-4 failed network requests per page load per restricted role, plus
SWR retries, plus red error text in the browser console. It doesn't crash the
page but it's a visible quality failure and wastes bandwidth.

The server already has correct `@Roles` guards. The client just needs to gate.

**Remediation:**
Add role checks in `Topbar.tsx` around the dropdown components:

```typescript
const ALLOWED_NOTIFICATIONS = ['admin', 'social_worker', 'coordinator',
  'claimant', 'auditor'];
const ALLOWED_CHAT = ['admin', 'social_worker', 'coordinator', 'claimant'];

const canNotifications = ALLOWED_NOTIFICATIONS.includes(user?.role ?? '');
const canChat = ALLOWED_CHAT.includes(user?.role ?? '');

// In JSX:
{canNotifications && <NotificationsDropdown />}
{canChat && <MessagesPopover />}
```

These role lists should match the `@Roles` decorators on the controllers
exactly. Extract to a shared constant in `lib/constants.ts` to prevent drift.

**Effort:** ~30 minutes
**Files changed:** `Topbar.tsx`, `lib/constants.ts`

---

### U-03 — Claimant Dead Nav Link (HIGH)

**File(s):** `kapwa-client/src/lib/nav-config.tsx:64`
`kapwa-client/src/routes.tsx:136`

**Problem:**
The sidebar shows "My Access Card" (`/my-access-card`) for claimants. Clicking it
navigates to `/my-access-card` which has **no route** in `routes.tsx`. The
catch-all `path: '*'` at line 136 redirects to `/`, silently swallowing the error.
Claimants click the link and nothing happens — no error message, no explanation.

This is the digital equivalent of a locked office door with no sign.

**Remediation:**
Two options:
1. **Route to existing page** — `AccessCardViewPage` already handles access card
   view at `/beneficiary/:id/access-card`. If the claimant has a `personId`, add:
   ```tsx
   { path: '/my-access-card', element: <Private roles={['claimant']}>
     <ClaimantAccessCardPage /></Private> }
   ```
   Where `ClaimantAccessCardPage` looks up the claimant's `personId` from auth
   context and renders `AccessCardViewPage` with the correct beneficiary ID.
2. **Remove from nav** — if access card viewing from claimant side is out of scope,
   remove line 64 from `nav-config.tsx`.

Option 1 is recommended — the right sidebar panel in ClaimantDashboardPage already
has access-card info; this is just adding the dedicated route.

**Effort:** ~1 hour (option 1: new wrapper page + route; option 2: remove 1 line)
**Files changed:** `routes.tsx`, `ClaimantAccessCardPage.tsx` (new, or removal of nav-config line)

---

### U-04 — No Offline Indicator in PWA Shell (MEDIUM)

**File(s):** `kapwa-client/src/components/Topbar.tsx` (no offline indicator)
`kapwa-client/src/lib/sync.ts:169` (isOnline function)

**Problem:**
KAPWA is an offline-first system but the user has zero visual feedback about
connectivity state. A coordinator in a barangay with spotty cell signal doesn't
know whether their intakes are being saved locally or synced to the server.

The `isOnline()` function exists in `sync.ts`. There's no corresponding UI.

**Remediation:**
Add a connectivity indicator to `Topbar.tsx`, left of the user avatar:

```typescript
// hooks/useConnectivity.ts
export function useConnectivity() {
  const [online, setOnline] = useState(navigator.onLine);
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

Render in Topbar:
```tsx
{!online && (
  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
    <WifiOff size={12} className="mr-1" />
    Offline
  </Badge>
)}
```

**Effort:** ~30 minutes
**Files changed:** `useConnectivity.ts` (new), `Topbar.tsx`

---

### U-05 — No Autosave on Intake Form (MEDIUM)

**File(s):** `kapwa-client/src/pages/IntakePage.tsx` (597 lines)

**Problem:**
The intake form is the longest single form in the system — 597 lines, multiple
sections (beneficiary details, family composition, requirements, problems presented,
assessment). A social worker spends 10-15 minutes filling it. A browser crash, tab
close, or network timeout loses all entered data. No recovery. No draft.

**Remediation:**
Add `localStorage`-based autosave with a debounced write (2 second after last
keystroke):

```typescript
// hooks/useIntakeAutosave.ts
const STORAGE_KEY = 'kapwa:intake:draft';

export function useIntakeAutosave(formData: IntakeFormData) {
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: formData,
        savedAt: new Date().toISOString(),
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData]);
}
```

On IntakePage mount: check for existing draft, show "You have an unsaved draft from
[timestamp]. Continue?" dialog. On successful submit: clear draft.

**Effort:** ~2 hours (hook + IntakePage integration + dialog)
**Files changed:** `useIntakeAutosave.ts` (new), `IntakePage.tsx`

---

### U-06 — No Confirmation Dialogs on Destructive Actions (MEDIUM)

**File(s):** Inter-agency referrals, consent revocation, case closure

**Problem:**
Key destructive actions have no confirmation step:
- Close inter-agency referral (status `closed`)
- Decline inter-agency referral
- Close case
- Revoke beneficiary consent (triggers immediate PII masking)
- Delete/wipedown (admin-wipe)

A misclick on "Close" instantly sets the referral to `closed` with no undo.
In a high-pressure MSWDO office, this happens.

**Remediation:**
Wrap each destructive action in an `AlertDialog` (already imported in several
components — the pattern exists for logout). Standardize:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Close Referral</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Close Referral?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently close the referral for {beneficiaryName}.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep Open</AlertDialogCancel>
      <AlertDialogAction onClick={handleClose}>Close Referral</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Apply to: `InterAgencyReferralsPage` (close/decline buttons), consent revocation
in `ConsentManager`, case closure in `CaseViewPage`, admin wipe in `AdminWipePage`.

**Effort:** ~1.5 hours (wrap 4-5 action sites)
**Files changed:** `InterAgencyReferralsPage.tsx`, `ConsentManager.tsx`,
`CaseViewPage.tsx`, `AdminWipePage.tsx`

---

### U-07 — No Dark Mode Support for Field Work (LOW)

**File(s):** `kapwa-client/src/lib/theme-context.tsx` (ThemeProvider exists)

**Problem:**
`Topbar.tsx` line 207 shows: `onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}`.
The toggle exists but defaults to light mode. Field coordinators work outdoors in
bright sunlight — light mode washes out. They also work at night (barangay
meetings, emergency intakes) — dark mode reduces eye strain.

The Tailwind 4 theme system supports `dark:` variants. The application may
already have dark-mode styles but no one toggles it.

**Remediation:**
1. Set default to `system` (respects OS preference):
   ```typescript
   const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
   ```
2. Ensure Tailwind `darkMode: 'class'` is configured in `vite.config.ts` or
   Tailwind config.
3. Audit 5-10 high-traffic pages for dark-mode visual consistency (card backgrounds,
   text contrast, input borders). shadcn/ui components already support dark mode
   via CSS variables — the audit is for custom components.
4. For mobile: add a prominent sun/moon toggle in `BottomNav` (one extra icon slot).

**Effort:** ~3 hours (config + audit + BottomNav toggle)
**Files changed:** `theme-context.tsx`, `BottomNav.tsx`, vite/tailwind config,
~5 page CSS audits

---

### U-08 — No Accessible Error Recovery (LOW)

**File(s):** `kapwa-client/src/components/ErrorBoundary.tsx`, error states across ~10 pages

**Problem:**
When a SWR fetch fails (e.g., network error loading beneficiary list), most pages
show generic "Error loading data" text. No retry button. No explanation of what
went wrong. No guidance on what to do next.

The `ErrorBoundary` component exists but only catches React render errors — not
SWR data-fetch errors. SWR errors are handled per-component, inconsistently.

**Remediation:**
1. Standardize error state rendering via a shared `<ErrorState>` component:
   ```tsx
   <ErrorState
     title="Could not load beneficiaries"
     message="Check your internet connection and try again."
     onRetry={() => mutate()}
   />
   ```
2. Add to `EmptyState` component (already exists) an error variant.
3. Wire into the SWR `onError` config globally (already a handler at routes.tsx
   line 139 that just `console.error`s).
4. Add retry buttons to the top 5 data-fetching pages: BeneficiariesPage,
   CasesPage, CaseTrackerPage, InterAgencyReferralsPage, AgencyReferralsPage.

**Effort:** ~3 hours (ErrorState component + 5 page integrations)
**Files changed:** `ErrorState.tsx` (new), `EmptyState.tsx`, `routes.tsx`,
BeneficiariesPage, CasesPage, CaseTrackerPage, InterAgencyReferralsPage,
AgencyReferralsPage

---

### U-09 — No Breadcrumbs on Deep Pages (LOW)

**File(s):** `kapwa-client/src/components/Topbar.tsx:38-61` (BreadcrumbNav exists)
`kapwa-client/src/lib/breadcrumbs.ts`

**Problem:**
`BreadcrumbNav` renders breadcrumbs but hides when `crumbs.length <= 1` (line 40).
Deep pages like `/cases/:id` show no breadcrumb. A social worker on a case detail
page can't navigate back to Cases without using the sidebar (hidden on mobile).

**Remediation:**
Remove the `crumbs.length <= 1` guard so ALL pages > depth 1 show breadcrumbs.
Verify `breadcrumbs.ts` correctly maps `/cases/:id` → `Cases > Case XYZ`.
Add a back-button fallback on mobile when sidebar is hidden.

**Effort:** ~1 hour (remove guard + test on 5 deep pages + mobile back button)
**Files changed:** `Topbar.tsx`, `breadcrumbs.ts`

---

## Priority Matrix

| # | Finding | Impact | Effort | Priority |
|---|---------|--------|--------|----------|
| S-01 | Dual FSM tables | Data corruption | 2h | **P0 — now** |
| U-02 | Shell 403 spam | Visible quality failure | 0.5h | **P0 — now** |
| U-01 | BottomNav hardcoded tabs | Mobile users broken | 2h | **P0 — now** |
| S-07 | Duplicate redirectMap | Next-role regression | 0.5h | **P0 — now** |
| U-03 | Claimant dead nav link | Broken feature | 1h | **P1 — this sprint** |
| B-04 | No sync-status indicator | Field data loss risk | 2h | **P1 — this sprint** |
| S-02 | No graceful shutdown | Production stability | 1h | **P1 — this sprint** |
| S-04 | No tsc in build | Silent type errors in prod | 2h | **P1 — this sprint** |
| B-03 | No referral notifications | Feature incomplete | 2h | **P1 — this sprint** |
| U-04 | No offline indicator | PWA UX | 0.5h | **P1 — this sprint** |
| B-01 | Batch/family intake | Staff productivity | 4h | **P2 — next sprint** |
| B-02 | Automated reports | Compliance | 6h | **P2 — next sprint** |
| U-05 | Intake autosave | Data loss risk | 2h | **P2 — next sprint** |
| U-06 | Destructive action confirmations | Misclick safety | 1.5h | **P2 — next sprint** |
| S-03 | Shallow health check | Operations | 0.5h | **P2 — next sprint** |
| S-05 | Structured logging | Operations | 0.5h | **P2 — next sprint** |
| B-05 | Coordinator quick-scan panel | Field efficiency | 3h | **P3 — backlog** |
| U-07 | Dark mode | Field UX | 3h | **P3 — backlog** |
| U-08 | Error recovery UX | Resilient UX | 3h | **P3 — backlog** |
| U-09 | Deep breadcrumbs | Navigation | 1h | **P3 — backlog** |
| B-06 | Certificate generation | Office workflow | 4h | **P3 — backlog** |
| S-06 | Sync FSM bypass hardening | Defense-in-depth | 0.5h | **P3 — backlog** |

---

## Implementation Phasing

```
SPRINT N (this sprint — ~8h):
  S-01  Dual FSM extract             2h
  U-02  Shell 403 gate               0.5h
  U-01  BottomNav role-filter        2h
  S-07  Extract redirectMap          0.5h
  S-04  Client tsc + type fixes      2h
  S-02  Graceful shutdown            1h
  ──────────────────────────────────────
  Total: 8h

SPRINT N+1 (~12h):
  U-03  Claimant dead nav fix        1h
  B-04  Sync-status indicator        2h
  B-03  Referral notifications       2h
  U-04  Offline indicator            0.5h
  U-05  Intake autosave              2h
  U-06  Destructive action dialogs   1.5h
  S-03  Deep health check            0.5h
  S-05  Structured logging           0.5h
  Tests for all sprint N stability fixes  2h
  ──────────────────────────────────────
  Total: 12h

BACKLOG:
  B-01  Batch family intake          4h
  B-02  Automated reports            6h
  B-05  Quick-scan panel             3h
  U-07  Dark mode audit              3h
  U-08  Error recovery UX            3h
  U-09  Breadcrumbs                  1h
  B-06  Certificate generation       4h
  S-06  FSM bypass hardening         0.5h
```

---

## Risks Avoided

1. **Data corruption** — Dual FSM tables would cause the next feature's transition
   to apply in one service but not the other, producing unreconcilable case states.
2. **Field data loss** — Without sync-status and autosave, coordinators lose intake
   data on device failure.
3. **Mobile abandonment** — Hardcoded BottomNav for non-MSWDO roles renders mobile
   unusable for coordinators, claimants, and agency staff.
4. **Compliance audit failure** — Without automated COA reports, manual extraction
   errors could produce incorrect fund-utilization figures submitted to auditors.
5. **Role-regression** — Every new role added will repeat the LoginPage redirectMap
   bug until the shared constant is extracted.
