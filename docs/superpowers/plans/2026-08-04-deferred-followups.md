# Deferred Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the deferred follow-ups recorded in the final-review ledger of `2026-08-04-systems-eval-fixes`, prioritized by risk (PII first), then correctness/UX, then hygiene.

**Base:** `a434ea1` (head of the SYSTEMS_EVAL fixes sprint on `main`).

**Architecture context:** Monorepo. `kapwa-server` = NestJS 11 + TypeORM + Postgres (migrations under `kapwa-server/src/database/migrations/`, class-name timestamp convention `YYYYMMDDHHMMSS-Name.ts`). `kapwa-client` = React 19 + Vite + SWR + shadcn/ui. Zod pipes server-side; `@/lib/api.ts` client HTTP; `@/lib/auth-context.tsx` provides `useAuth()` with `user.id` and `logout()`.

## Global Constraints

- **Test commands (verbatim):**
  - Server: `cd kapwa-server && npx jest <path> --coverage=false` — NEVER bare `npm test`.
  - Client: `cd kapwa-client && npx vitest run <path>`.
  - Client typecheck: `cd kapwa-client && npx tsc --noEmit` — must stay at **0 errors**.
- **Never log raw PII.** Error messages to end users must be generic ("Service temporarily unavailable…"), never raw DB/SQL error strings.
- **Server 7 failing suites + ~12 client failing test files are a PRE-EXISTING baseline** (auth, cases, dashboard, chat, filing, notifications, sync; ErrorBoundary, PageShell, SyncQueuePanel, AdminPage, SettingsPage, dashboard pages, etc.). Only flag NEW failures.
- **Migrations must follow the repo convention** (timestamped class-name, `up`/`down`, `queryRunner.query`); they run against the dev DB via the repo's migrate script.
- **Artifacts to files** (AGENTS.md rule): return file paths + 1-line descriptions; never paste large outputs.
- **Commit convention:** `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `perf:`.

---

## PHASE A — PII + Server Correctness (highest priority)

### Task 1: User-scope the intake draft + clear on logout

**Files:**
- Modify: `kapwa-client/src/hooks/useIntakeAutosave.ts`
- Modify: `kapwa-client/src/lib/auth-context.tsx` (logout)
- Modify: `kapwa-client/src/pages/IntakePage.tsx` (pass user id / scope)
- Modify: `kapwa-client/src/hooks/useIntakeAutosave.test.ts` (existing test file — check name; adapt to scoped key)

**Problem (PII on shared field tablets):** `useIntakeAutosave` uses a single global key `kapwa:intake:draft`. On a shared tablet, worker B can be handed worker A's full PII draft on refresh.

- [ ] **Step 1: Write the failing test**

In the existing autosave test file, adapt the tests to a user-scoped key:

```typescript
import { useIntakeAutosave, loadDraft, clearDraft, getDraftKey } from './useIntakeAutosave';

describe('useIntakeAutosave scoping', () => {
  it('uses a per-user storage key', () => {
    expect(getDraftKey('user-1')).toBe('kapwa:intake:draft:user-1');
    expect(getDraftKey('user-2')).not.toBe(getDraftKey('user-1'));
  });

  it('persists and loads under the scoped key only', async () => {
    renderHook(() => useIntakeAutosave(draft, 'user-1'));
    await act(() => new Promise(r => setTimeout(r, 2500)));
    expect(loadDraft('user-1')?.data).toMatchObject(draft);
    expect(loadDraft('user-2')).toBeNull();
  });

  it('clears only the scoped draft', () => {
    clearDraft('user-1');
    expect(loadDraft('user-1')).toBeNull();
    expect(localStorage.getItem('kapwa:intake:draft:user-2')).not.toBeNull();
  });
});
```

Expected: FAIL — `getDraftKey` missing / signature mismatch.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npx vitest run src/hooks/useIntakeAutosave.test.ts`
Expected: FAIL (type errors on `getDraftKey`/new signatures).

- [ ] **Step 3: Implement scoped keys in `useIntakeAutosave.ts`**

```typescript
const DRAFT_PREFIX = 'kapwa:intake:draft';

export function getDraftKey(userId: string): string {
  return `${DRAFT_PREFIX}:${userId}`;
}

export function useIntakeAutosave<T>(formData: T, userId: string) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(getDraftKey(userId), JSON.stringify({ data: formData, savedAt: new Date().toISOString() } as IntakeDraft));
      } catch { /* storage full or unavailable — ignore */ }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [formData, userId]);
}

export function loadDraft(userId: string): IntakeDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as IntakeDraft;
  } catch { return null; }
}

export function clearDraft(userId: string): void {
  try { localStorage.removeItem(getDraftKey(userId)); } catch { /* ignore */ }
}
```

**Backward-compat note:** the old un-scoped key `kapwa:intake:draft` may hold a stale draft from before this change; optionally remove it on first load (`localStorage.removeItem('kapwa:intake:draft')`) — one line, worth it to purge cross-user PII that already leaked.

- [ ] **Step 4: Wire into `IntakePage.tsx` and `auth-context.tsx`**

1. `IntakePage.tsx`: get `const { user } = useAuth();` (already available — verify), use `useIntakeAutosave(formSnapshot, user?.id ?? '')`, `loadDraft(user?.id ?? '')` on mount (guard: skip restore when no id), and `clearDraft(user?.id ?? '')` after submit. When `user` is null, do not autosave (pass '' or skip — decide: empty id means no autosave; simplest is still writing to `kapwa:intake:draft:` which is harmless, but prefer no-op when no id).
2. `auth-context.tsx` `logout()`: after clearing token/user, remove any draft keys. Since the logout has no user id handy in the function body — capture `user?.id` before clearing: `if (user?.id) clearDraft(user.id);` — import `clearDraft` from the hook. Do NOT import into auth-context if it creates a circular import; if circular, instead listen for the existing `kapwa:auth:logout` window event in `useIntakeAutosave`'s effect and clear there. Choose the approach that avoids circularity — check `api.ts`'s `kapwa:auth:logout` dispatch (already referenced in auth-context line 33-34) as the decoupled hookup.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-client && npx vitest run src/hooks/useIntakeAutosave.test.ts src/pages/IntakePage.test.tsx`
Expected: PASS.

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/hooks/useIntakeAutosave.ts kapwa-client/src/hooks/useIntakeAutosave.test.ts kapwa-client/src/pages/IntakePage.tsx kapwa-client/src/lib/auth-context.tsx
git commit -m "fix: scope intake draft to user and purge on logout"
```

---

### Task 2: Generic error messages in intake catch blocks

**Files:**
- Modify: `kapwa-server/src/intake/intake.service.ts` (catch blocks at ~197, ~268, ~497)
- Modify: `kapwa-server/test/intake.service.spec.ts` or `src/intake/intake.service.spec.ts` (whichever holds the batch tests — consolidate later in Task 8)

**Problem (plan constraint violation):** `submitBatchFamily`'s catch throws `new InternalServerErrorException(error.message)` — raw SQL/DB error strings can reach the client (e.g. the broken-column error would have surfaced verbatim). `submitIntake` has the same pattern.

- [ ] **Step 1: Write the failing test**

Append to the intake service spec that covers `submitBatchFamily`:

```typescript
it('surfaces a generic message on batch failure, not the raw error', async () => {
  // arrange repo mocks so the transaction throws (e.g. membership save rejects with 'ERROR: column person.currentaddress does not exist')
  await expect(service.submitBatchFamily(input)).rejects.toThrow('Service temporarily unavailable');
});
```

Expected: FAIL — current message leaks `error.message`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest src/intake test/intake.service.spec.ts --coverage=false`
Expected: FAIL (message mismatch).

- [ ] **Step 3: Replace raw error propagation**

In all three catch blocks, replace `error instanceof Error ? error.message : ...` with a generic message:
```typescript
} catch {
  await queryRunner.rollbackTransaction();
  throw new InternalServerErrorException('Service temporarily unavailable. Please try again.');
}
```
Keep `logger.error` with the real error for server-side debugging (never the client-visible message): `this.logger.error('submitBatchFamily failed', error instanceof Error ? error.stack : undefined)`. **No PII in logs** — the error stack may contain values, not names; keep the existing discipline.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest src/intake test/intake.service.spec.ts --coverage=false`
Expected: PASS (existing success-path tests unaffected; new generic-message test passes).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/intake/intake.service.ts
git commit -m "fix: surface generic errors from intake transaction failures"
```

---

### Task 3: Unique index on `household_memberships(person_id, household_id)`

**Files:**
- Create: `kapwa-server/src/database/migrations/<timestamp>-AddUniqueHouseholdMembership.ts`
- Modify: `kapwa-server/src/beneficiaries/household-membership.entity.ts` (optional `@Index` decorator for metadata parity)

**Problem:** No DB-level unique constraint on `(person_id, household_id)`; SERIALIZABLE + code guard mitigate the batch-intake double-insert race but don't make idempotency structural.

- [ ] **Step 1: Check existing duplicate rows (pre-migration data)**

Run (or instruct): `cd kapwa-server && npx ts-node -e "..."` — simpler: write the migration with a dedup step first (delete duplicate memberships keeping the lowest id), then create the unique index. Follow the repo's existing migration style (read `20260730000004-DuplicateDetectionEnhancements.ts` for the pattern).

- [ ] **Step 2: Write the migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueHouseholdMembership<timestamp> implements MigrationInterface {
  name = 'AddUniqueHouseholdMembership<timestamp>';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dedup: keep lowest id per (person_id, household_id) where household_id is not null
    await queryRunner.query(`
      DELETE FROM household_memberships a
      USING household_memberships b
      WHERE a.id > b.id
        AND a.person_id = b.person_id
        AND a.household_id = b.household_id
        AND a.household_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_household_memberships_person_household"
      ON household_memberships (person_id, household_id)
      WHERE household_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_household_memberships_person_household"`);
  }
}
```

**Note:** verify the `id` column semantics (BaseEntity — likely uuid) so `a.id > b.id` is valid for uuid (it is not — uuid has no ordering!). For uuid ids, use `a.ctid > b.ctid` or dedup by keeping `min(created_at)`. Check the BaseEntity/primary key type first and adapt the dedup predicate accordingly (e.g. `a.created_at > b.created_at` — but ties possible; prefer `a.ctid > b.ctid` which is always valid in Postgres).

- [ ] **Step 3: Verify migration runs + tests pass**

Run: `cd kapwa-server && npm run build` (clean), then run the migration against dev DB per repo convention, then `cd kapwa-server && npx jest src/intake --coverage=false`.

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/database/migrations/<file> kapwa-server/src/beneficiaries/household-membership.entity.ts
git commit -m "chore: add unique index on household memberships to make idempotency structural"
```

---

### Task 4: CORS `Access-Control-Expose-Headers: Content-Disposition`

**Files:**
- Modify: `kapwa-server/src/main.ts` (`enableCors` block, line 57-62)

**Problem:** Cross-origin production (VITE_API_URL unset → `http://localhost:3000`) strips `Content-Disposition` from export responses, so certificate downloads fall back to generic filenames. Client already parses the header with a graceful fallback.

- [ ] **Step 1: Add expose headers**

```typescript
app.enableCors({
  origin: [...],
  credentials: true,
  methods: [...],
  allowedHeaders: [...],
  exposedHeaders: ['Content-Disposition'],
});
```

- [ ] **Step 2: Verify build**

Run: `cd kapwa-server && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/main.ts
git commit -m "fix: expose Content-Disposition to clients in CORS"
```

---

## PHASE B — Client UX / Robustness

### Task 5: Theme FOUC — apply dark class in lazy initializer

**Files:**
- Modify: `kapwa-client/src/lib/theme-context.tsx`
- Modify: `kapwa-client/src/lib/theme-context.test.tsx`

**Problem:** `document.documentElement.classList` is toggled only in `useEffect` (post-paint) — dark-OS users get a light flash on first load.

- [ ] **Step 1: Write the failing test**

```typescript
it('applies the resolved theme before first paint (no FOUC)', () => {
  const { unmount } = render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(document.documentElement.classList.contains('dark')).toBe(...);
});
```

Better: assert the initializer runs synchronously — render the provider and immediately (before any effect flush) check `document.documentElement.classList`. With testing-library, effects flush on render; to catch the pre-effect state, use `ReactDOM.render` in a `createRoot` without act, or assert via a spy on `classList.toggle` called during initializer. Pragmatic approach: assert the class is present on first render (covers the regression the useEffect-only version would still pass...) — the real distinguishing test: mock `matchMedia` dark, render, and assert `document.documentElement` has `dark` **before** `act` completes effects (use `createRoot` + `flushSync` and check between). If this is too fiddly, test the observable contract: class matches resolved theme immediately after render.

- [ ] **Step 2: Implement**

Move the class application into the lazy initializer:

```typescript
const [resolvedTheme, setResolved] = useState<'light' | 'dark'>(() => {
  const r = resolve(theme);
  document.documentElement.classList.toggle('dark', r === 'dark');
  return r;
});
```

And keep the `useEffect` for listener + persistence (remove the duplicate toggle or keep both — idempotent either way; keep the effect's toggle for when the theme state changes).

- [ ] **Step 3: Run tests**

Run: `cd kapwa-client && npx vitest run src/lib/theme-context.test.tsx`
Run: `cd kapwa-client && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/lib/theme-context.tsx kapwa-client/src/lib/theme-context.test.tsx
git commit -m "fix: apply resolved theme before first paint to avoid flash"
```

---

### Task 6: QuickScanCard in-flight guard

**Files:**
- Modify: `kapwa-client/src/components/QuickScanCard.tsx`
- Modify: `kapwa-client/src/components/QuickScanCard.test.tsx` (create if missing; else add to CoordinatorDashboardPage.test.tsx)

**Problem:** `verify()` has no in-flight guard — rapid double Enter/Verify fires concurrent GETs; last-resolver-wins regardless of recency.

- [ ] **Step 1: Write the failing test**

```typescript
it('disables verify while a request is in flight', async () => {
  // make api.get hang (never-resolving promise)
  // click verify; assert button disabled; resolve; assert re-enabled
});
```

- [ ] **Step 2: Implement**

```typescript
const [verifying, setVerifying] = useState(false);
async function verify() {
  if (verifying) return;
  setError('');
  setResult(null);
  if (!code.trim()) return;
  setVerifying(true);
  try {
    const data = await api.get<AccessCardSummary>(`/access-cards/${code.trim()}/summary`);
    setResult(data);
  } catch {
    setError('Card not found. Check the code and try again.');
  } finally {
    setVerifying(false);
  }
}
```
Button: `disabled={!code.trim() || verifying}`.

- [ ] **Step 3: Run tests**

Run: `cd kapwa-client && npx vitest run src/components/QuickScanCard.test.tsx src/pages/CoordinatorDashboardPage.test.tsx`
Run: `cd kapwa-client && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/components/QuickScanCard.tsx kapwa-client/src/components/QuickScanCard.test.tsx
git commit -m "fix: guard quick scan verify against duplicate in-flight requests"
```

---

### Task 7: CaseTrackerPage stale-data guard consistency

**Files:**
- Modify: `kapwa-client/src/pages/CaseTrackerPage.tsx` (line ~107)

**Problem:** `error && entries.length === 0` — with `keepPreviousData`, a failed refetch after a legitimately-empty result (`data = []`) swaps a correct "No data" state for an error screen; also contradicts the `error && !data` pattern used on the other 4 pages.

- [ ] **Step 1: Change the guard**

```typescript
if (error && !data) {
```
(keep `data` destructured from the SWR call — check the actual destructure at the top of the component; the page may already have `data`).

- [ ] **Step 2: Verify tests**

Run: `cd kapwa-client && npx vitest run src/pages/CaseTrackerPage.test.tsx`
Expected: PASS (or note if the test file's mocks need `data` shape updates — the page test was flagged pre-existing-broken at base; if it fails at base identically, that's baseline, not new).

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/CaseTrackerPage.tsx
git commit -m "fix: use data-absence guard for case tracker error state"
```

---

## PHASE C — Hygiene / DRY / Test Rigor

### Task 8: Consolidate redundant intake service specs

**Files:**
- Delete: `kapwa-server/src/intake/intake.service.spec.ts` (153-line duplicate) OR `kapwa-server/test/intake.service.spec.ts` — keep the one with broader coverage; move any unique tests over.
- Modify: the surviving spec (add `personRepo.create not called` assertion to the idempotency test + null `beneficiaryId` defensive gap test if cheap)

**Problem:** Two suites cover `submitBatchFamily` (`src/intake/intake.service.spec.ts` and `test/intake.service.spec.ts`) — two sources of truth, drift risk.

- [ ] **Step 1: Diff the two suites** — compare coverage; pick the survivor (prefer the one under `src/` per repo convention — check where other service specs live).
- [ ] **Step 2: Merge unique tests into the survivor** (esp. any SQL-asserting or guard tests), delete the loser.
- [ ] **Step 3: Strengthen the idempotency test** — assert `personRepo.create` was NOT called on re-submit (locks in "no member re-creation").
- [ ] **Step 4: Run the survivor suite**

Run: `cd kapwa-server && npx jest src/intake test/intake --coverage=false`
Expected: PASS (no duplicate suite).

- [ ] **Step 5: Commit**

```bash
git add -A kapwa-server/src/intake kapwa-server/test
git commit -m "test: consolidate duplicate intake service specs and strengthen idempotency assertions"
```

---

### Task 9: Extract shared fund-download helper (client)

**Files:**
- Modify: `kapwa-client/src/lib/api.ts` (add `downloadMonthlyFunds(month)` helper)
- Modify: `kapwa-client/src/pages/DashboardPage.tsx` (~lines 97-126)
- Modify: `kapwa-client/src/pages/MayorReportsPage.tsx` (~lines 13-42)

**Problem:** ~30 lines of fetch→blob→anchor download logic duplicated in both pages.

- [ ] **Step 1: Add the helper to `api.ts`**

```typescript
export async function downloadMonthlyFunds(month: string): Promise<void> {
  const res = await api.get<Blob>(`/export/monthly-funds?month=${month}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res);
  const a = document.createElement('a');
  a.href = url;
  // parse Content-Disposition filename if present, else fund-utilization-<month>.xlsx
  a.download = `fund-utilization-${month}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Verify the actual api.get signature** (does it support responseType/blob? check how `downloadCertificate` was added in the sprint — reuse that pattern exactly; `api.get` returns payload directly per earlier review, so blob handling may differ). Follow `downloadCertificate`'s established pattern.

- [ ] **Step 2: Replace both pages' inline blocks with the helper.**

- [ ] **Step 3: Run tests**

Run: `cd kapwa-client && npx vitest run src/pages/DashboardPage.test.tsx src/pages/MayorReportsPage.test.tsx`
Run: `cd kapwa-client && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/lib/api.ts kapwa-client/src/pages/DashboardPage.tsx kapwa-client/src/pages/MayorReportsPage.tsx
git commit -m "refactor: share monthly fund download helper between pages"
```

---

### Task 10: Breadcrumb crumb-count assertions + `useTheme` fallback test

**Files:**
- Modify: `kapwa-client/src/components/Topbar.test.tsx`
- Modify: `kapwa-client/src/lib/theme-context.test.tsx`

**Problems:** (a) Breadcrumb tests assert only nav presence, never that `/cases/<uuid>` produces 2 crumbs with a "Case <id>" label; (b) `useTheme()` no-provider fallback (returns undefined context default?) is untested.

- [ ] **Step 1: Strengthen the breadcrumb test**

```typescript
it('renders two crumbs with the case label for a UUID case path', () => {
  const { container } = renderWithTopbar({ pathname: `/cases/${uuid}` });
  const items = container.querySelectorAll('nav[aria-label="breadcrumb"] li, nav[aria-label="breadcrumb"] [role="listitem"], nav[aria-label="breadcrumb"] a, nav[aria-label="breadcrumb"] span');
  expect(items.length).toBeGreaterThanOrEqual(2);
  // assert a "Case <id>" label appears
});
```

Adapt the selector to the actual Breadcrumb component markup (check `components/ui/breadcrumb.tsx` for how items render — likely `ol` + `li`). Assert the truncated case id label (`Case <id.slice(0,8)>` per the sprint's mapping).

- [ ] **Step 2: Add the `useTheme` no-provider test**

```typescript
it('returns undefined context outside provider (no crash)', () => {
  // renderHook(() => useTheme()) — expect it to throw or return default per implementation
});
```

Check the implementation: `useTheme` likely throws "must be used within ThemeProvider" or returns undefined — assert the actual contract.

- [ ] **Step 3: Run tests**

Run: `cd kapwa-client && npx vitest run src/components/Topbar.test.tsx src/lib/theme-context.test.tsx`
Run: `cd kapwa-client && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/components/Topbar.test.tsx kapwa-client/src/lib/theme-context.test.tsx
git commit -m "test: pin breadcrumb crumb count and useTheme fallback contract"
```

---

## Self-Review

**Deferred items covered by this plan:**
- Draft key user-scoping + logout purge → Task 1 ✓ (the highest-priority PII item)
- Raw error message in intake catch → Task 2 ✓
- household_memberships unique index → Task 3 ✓
- CORS Access-Control-Expose-Headers → Task 4 ✓
- Theme FOUC → Task 5 ✓
- QuickScanCard in-flight guard → Task 6 ✓
- CaseTrackerPage stale-data guard → Task 7 ✓
- Redundant intake.service.spec suites + idempotency assertion → Task 8 ✓
- Duplicated client download helper → Task 9 ✓
- Breadcrumb crumb-count + useTheme fallback tests → Task 10 ✓

**Explicitly NOT in scope (with reasons):**
- Non-sargable `c.id::text` cast — perf-only for a monthly export, correctness fine; re-evaluate if the export ever lands on a hot path.
- dob regex semantic edge (impossible dates → 500) — pre-existing parity with the single-intake path; would require a schema-wide semantic refine (scope creep).
- Topbar binary-toggle history note — already resolved in the sprint (third "System" option added, commit 78a191e).
- `send` endpoint lacking `agency_staff` — correct policy (no-consent send stays admin/social_worker).
- Duplicate `UserRole` import — verified single import remains; resolved.
- `null beneficiaryId` defensive gap in `submitBatchFamily` — both case-creation paths always set it; fold into Task 8 only if the consolidation makes it cheap (one guard + one test).
- Monthly dashboard snapshot date-drift — flagged for the future; replacing snapshots with stable-node assertions is a test-infra change beyond this batch.
- CORS origin list — unchanged; production origins are deployment config.

**Task dependencies:** Tasks 1-10 are independent and can run in any order. Task 2 and Task 8 both touch intake specs — run Task 8 after Task 2 (or instruct the Task 8 implementer to preserve Task 2's new test when consolidating). Task 1's auth-context change must avoid circular imports (decoupled `kapwa:auth:logout` event approach preferred).
