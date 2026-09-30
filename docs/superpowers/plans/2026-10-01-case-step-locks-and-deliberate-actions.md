# Case Step Locks and Deliberate Case Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker deliberately seal each case step, require every step sealed before a case can be flagged for admin review, and give both roles explicit named buttons for the status moves — plus fix the social-worker 403 on issuing a case referral.

**Architecture:** A new `case_step_locks` table records seals, returned inside the existing `GET /cases/:id` payload. Lock legality reuses the existing `stepperStepDone` predicate, mirrored server-side behind a shared fixture. The all-locked rule is enforced in `validateTransition` on the `assessed → in_review` edge so no endpoint can bypass it. `StepLockBar` is one client component mounted five times; `CaseActionBar` renders one named admin button per legal hop.

**Tech Stack:** NestJS 11 + TypeORM + Postgres 16, Jest (server); React 19 + Vite + SWR + Radix/shadcn, Vitest (client).

**Spec:** `docs/superpowers/specs/2026-09-30-case-step-locks-and-deliberate-actions-design.md` — read it before starting; this plan argues from it and the two travel together.

## Global Constraints

- Migration key is `0000000000074`; class name `CreateCaseStepLocks0000000000074`. The chain ends at `…0000000000073`. Do not trust `AGENTS.md`, which claims `…0000000000055` across 55 files — it is stale, the chain is 76 files.
- Every new table ships **both** a TypeORM migration **and** an idempotent `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` in `src/database/migrate.ts`. Committing one without the other breaks fresh boots.
- Lint: server `npm run lint` is `eslint --fix` and must stay at 0 errors. Client has no ESLint config; its gate is `npm run typecheck` (clean) plus `npx vitest run`.
- Server test command is `npx jest --silent` from `kapwa-server/`. **Never** `npm test` there — it adds `--coverage` and is slow.
- Client test command is `npx vitest run` from `kapwa-client/`.
- i18n: every user-facing string goes through `t('key', 'English fallback')` and must be added to **both** `src/i18n/locales/en/index.ts` and `src/i18n/locales/fil/index.ts`.
- Server authorization is checked **before** state validation, so an unauthorized caller cannot probe what is missing. Preserve that ordering in any new check.
- Stage explicit paths in `git add`. Never `git add -A`. Branch is `main`. Conventional commits.

## Review Focus

The input classes the spec implies but no single task's happy path would catch. Most likely first.

1. **A coordinator or claimant loading the case view.** Every lock endpoint is `@Roles('admin','social_worker')`; a coordinator viewing their own referral flow must not see lock buttons, and must get 403 (not 404) if the UI ever leaks the call.
2. **A worker who locks a step, then edits its data.** Option (a) is soft and reversible, but a lock that silently permits edits underneath is not a seal at all — the edit must be refused or the lock must be dropped. Pick one and test it.
3. **Two social workers on the same case.** Lock is unique on `(case_id, step_index)`; a second POST must be idempotent, not a unique-violation 500.
4. **An admin advancing a case whose step locks a worker just removed.** The all-locked rule is on the worker's `assessed → in_review` edge only. `canTransition` short-circuits `admin` to `true`, so an admin must **not** be silently blocked by it — and equally must not be able to use "advance" to skip a phase-out step. Test both directions.
5. **A case with zero programs attached, so the required-documents list is empty.** `CaseRequirements` returns `null` when there is nothing to show. The intervention step must not then look permanently unlockable or permanently locked.

---

### Task 1: Fix the social-worker 403 on the endorsement letter

The bug: `create()` treats `admin` **and** `social_worker` as MSWDO staff with no `agencyId` and substitutes the MSWDO agency, but `endorsementLetterPdf`'s scope check exempts only `admin`. A social worker creates the referral, then the PDF render runs with `agencyId = null` and throws. These two checks must not be able to drift again.

**Files:**
- Modify: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts:61-71` (add helper), `:489-495` (use it)
- Test: `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `private isMswdoStaff(caller: User): boolean` on `InterAgencyReferralsService`. Later tasks do not call it; it exists so this rule has one home.

- [ ] **Step 1: Find the existing spec and the MSWDO test account it uses**

```bash
cd kapwa-server && grep -n "social_worker\|UserRole.SW\|agencyId" src/inter-agency-referrals/inter-agency-referrals.service.spec.ts | head -20
```

Note how the spec builds a `User` and how it stubs `agencyRepo.findOne({ where: { code: 'MSWDO', isActive: true } })`. You need that stub in the new test.

- [ ] **Step 2: Write the failing test**

Append to the existing `describe` block in `inter-agency-referrals.service.spec.ts`:

```ts
it('renders the endorsement letter for a social worker with no agencyId', async () => {
  // A social worker is MSWDO staff: create() substitutes the MSWDO agency as
  // fromAgencyId, so the PDF scope check must not then reject them for having
  // a null agencyId. This is the 403 from the case view.
  const sw = { id: 'u-sw', role: UserRole.SW, agencyId: null } as unknown as User;
  const mswdoAgency = { id: 'ag-mswdo', code: 'MSWDO', name: 'MSWDO Norzagaray' };
  const ref = {
    id: 'ref-1',
    fromAgencyId: 'ag-mswdo',
    toAgencyId: 'ag-rhu',
    case: { controlNo: 'KAPWA-0001' },
    person: { firstName: 'Ana', surname: 'Reyes' },
  };

  jest.spyOn(service['agencyRepo'], 'findOne').mockResolvedValue(mswdoAgency as any);
  jest.spyOn(service['repo'], 'findOne').mockResolvedValue(ref as any);
  const spy = jest.spyOn(service as any, 'buildEndorsementPdf').mockReturnValue(Buffer.from('pdf'));

  await expect(service.endorsementLetterPdf('ref-1', sw)).resolves.toBeInstanceOf(Buffer);
  expect(spy).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run it and confirm it fails with the 403**

Run: `cd kapwa-server && npx jest inter-agency-referrals.service --silent=false`
Expected: FAIL — `ForbiddenException: Referral is not associated with your agency`.

- [ ] **Step 4: Add the helper and use it**

Immediately above `create()` in `inter-agency-referrals.service.ts`:

```ts
  // MSWDO staff are not linked to an agency on production accounts; create()
  // substitutes the MSWDO agency as fromAgencyId for both roles. The scope
  // checks must recognise the same set or the referral can be created and then
  // become unreadable by the person who just made it.
  private isMswdoStaff(caller: User): boolean {
    return caller.role === UserRole.ADMIN || caller.role === UserRole.SW;
  }
```

Replace the condition at `489-495` with:

```ts
    if (
      !this.isMswdoStaff(caller) &&
      caller.agencyId !== ref.fromAgencyId &&
      caller.agencyId !== ref.toAgencyId
    ) {
      throw new ForbiddenException('Referral is not associated with your agency');
    }
```

Leave `findOne()`'s near-identical check alone — it serves the retired lifecycle and has its own passing tests. Note that in the commit body.

- [ ] **Step 5: Run the spec and the full server suite**

Run: `cd kapwa-server && npx jest inter-agency-referrals --silent && npx jest --silent`
Expected: the new test passes; the full suite stays green.

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.ts \
        kapwa-server/src/inter-agency-referrals/inter-agency-referrals.service.spec.ts
git commit -m "fix(iar): let social workers render the endorsement letter they issued

create() treats admin and social_worker alike as MSWDO staff and substitutes
the MSWDO agency as fromAgencyId, but endorsementLetterPdf's agency scope
check exempted only admin. A social worker created the referral successfully
and was then refused the PDF with 403, because their agencyId is null against
a real fromAgencyId. Both checks now read one isMswdoStaff() helper so they
cannot drift again."
```

---

### Task 2: Remove the dead inter-agency referral link

`CaseViewPage.tsx:787` navigates to `/agency/referrals/:id`, a route `9fa73f5` deleted. Every inter-agency referral row in the case view currently 404s on click. There is no detail page to go to, so the row must stop pretending.

**Files:**
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx:775-810`
- Test: `kapwa-client/src/pages/CaseViewPage.test.tsx` (create if absent)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Check whether a CaseViewPage spec exists and how it mocks the case**

```bash
cd kapwa-client && ls src/pages/CaseViewPage.test.tsx 2>/dev/null && grep -n "useSWR\|api.get\|interAgencyReferrals\|queryKeys" src/pages/CaseViewPage.test.tsx | head -20
```

- [ ] **Step 2: Write the failing test**

The assertion is that no anchor on the page points at a path the router does not serve. Add to the existing spec:

```tsx
it('links nowhere for a case referral row — the detail route is retired', async () => {
  render(<MemoryRouter><CaseViewPage /></MemoryRouter>);
  await screen.findByRole('heading', { name: /case/i });
  const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(hrefs.filter((h) => h?.includes('/agency/referrals'))).toEqual([]);
});
```

If the spec mocks SWR, ensure the inter-agency referral key returns one row so the test exercises a populated list rather than the empty state. A test that passes on the empty state proves nothing.

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd kapwa-client && npx vitest run src/pages/CaseViewPage.test.tsx`
Expected: FAIL — the array contains `/agency/referrals/<id>`.

- [ ] **Step 4: Make the row a static record, not a link**

In `CaseViewPage.tsx`, inside the `{(iarReferrals || []).map(r => (` block, replace the wrapping `<button onClick={() => navigate(...)}>` with a plain `<div>`, and delete the now-unused `useNavigate` call for it. Keep the status `<Badge>` and the letter affordance. If `navigate` becomes unused, remove it from the destructure — `npx tsc --noEmit` will tell you.

- [ ] **Step 5: Verify and commit**

Run: `cd kapwa-client && npm run typecheck && npx vitest run src/pages/CaseViewPage.test.tsx`
Expected: clean; test passes.

```bash
git add kapwa-client/src/pages/CaseViewPage.tsx kapwa-client/src/pages/CaseViewPage.test.tsx
git commit -m "fix(case): stop linking inter-agency referrals to a retired route

9fa73f5 removed /agency/referrals/:id along with the referral lifecycle, but
CaseViewPage still wrapped each row in a button that navigated there. Every
row 404'd on click. The row is now a static record: status and the letter
affordance, no dead link."
```

---

### Task 3: The `case_step_locks` table

**Files:**
- Create: `kapwa-server/src/cases/case-step-lock.entity.ts`
- Create: `kapwa-server/src/database/migrations/CreateCaseStepLocks0000000000074.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (inside the query block, next to the other `case_*` tables)
- Modify: the module that owns `cases` entities so TypeORM registers the new one
- Test: `kapwa-server/src/cases/case-step-lock.entity.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CaseStepLock` entity with `caseId: string`, `stepIndex: number`, `lockedBy?: string`, `lockedByName?: string`, `lockedAt: Date`. Tasks 4–6 read and write it.

- [ ] **Step 1: See how the cases module registers entities**

```bash
cd kapwa-server && grep -n "TypeOrmModule.forFeature\|entities" src/cases/cases.module.ts
```

- [ ] **Step 2: Create the entity**

`kapwa-server/src/cases/case-step-lock.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

// One row per (case, step). A seal is deliberately reversible: the row is
// deleted on unlock, and the audit log is what records that it happened.
@Entity('case_step_locks')
@Unique('uq_case_step_locks_case_step', ['caseId', 'stepIndex'])
@Index('idx_case_step_locks_case', ['caseId'])
export class CaseStepLock extends BaseEntity {

  @Column({ name: 'case_id' })
  caseId!: string;

  /** 0..4, matching the five stepper steps in CaseStepper.tsx. */
  @Column({ name: 'step_index', type: 'smallint' })
  stepIndex!: number;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy?: string;

  // Snapshot, not a join: the strip must render the name even if the user row
  // is later removed, and a welfare case file should not lose who sealed it.
  @Column({ name: 'locked_by_name', nullable: true })
  lockedByName?: string;

  @CreateDateColumn({ name: 'locked_at' })
  lockedAt!: Date;
}
```

- [ ] **Step 3: Add the migration**

`kapwa-server/src/database/migrations/CreateCaseStepLocks0000000000074.ts`. Copy the shape of `ZAddCaseInterventionNotNeeded0000000000062.ts` — `up()`/`down()` on `MigrationInterface`, and an `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()` column:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCaseStepLocks0000000000074 implements MigrationInterface {
  name = 'CreateCaseStepLocks0000000000074';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS case_step_locks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
      case_id TEXT NOT NULL,
      step_index SMALLINT NOT NULL,
      locked_by UUID,
      locked_by_name TEXT,
      locked_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_case_step_locks_case_step UNIQUE (case_id, step_index)
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_case_step_locks_case ON case_step_locks(case_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_case_step_locks_case`);
    await q.query(`DROP TABLE IF EXISTS case_step_locks`);
  }
}
```

`case_id` is `TEXT` because `migrate.ts` declares `case_interventions.case_id` as `TEXT` and TypeORM will refuse to write a `uuid` column against a `text` one.

- [ ] **Step 4: Add the same DDL to migrate.ts**

In `src/database/migrate.ts`, next to the existing `case_interventions` block, add the identical `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. A fresh boot runs `migrate.ts`, not the chain, so without this the table never exists in a new deployment.

- [ ] **Step 5: Register the entity**

Add `CaseStepLock` to the `forFeature([...])` list found in Step 1.

- [ ] **Step 6: Verify the chain replays and migrate.ts is idempotent**

```bash
cd kapwa-server && npm run typecheck && npx jest --silent
```

Then, against a disposable database, confirm both paths work:

```bash
npx ts-node -e "1" 2>/dev/null; npm run migration:run
```

Expected: all migrations apply; re-running `migration:run` is a no-op. If you cannot get a disposable DB up, say so in the commit body rather than claiming you verified it.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/cases/case-step-lock.entity.ts \
        kapwa-server/src/database/migrations/CreateCaseStepLocks0000000000074.ts \
        kapwa-server/src/database/migrate.ts \
        kapwa-server/src/cases/cases.module.ts
git commit -m "feat(cases): case_step_locks table

One row per (case, step) recording that a worker deliberately sealed a done
step. Reversible: unlock deletes the row, the audit log keeps the history.
locked_by_name is a snapshot so the strip still renders if the user row goes.

Ships as both a TypeORM migration and an idempotent block in migrate.ts, since
a fresh boot runs migrate.ts rather than the chain."
```

---

### Task 4: The shared `done` predicate fixture

The `done` predicate decides step completion, and from Task 6 the server must answer it independently. Two hand-kept copies of a five-branch predicate will drift. This task lands the single source of truth **before** either side consumes it.

**Files:**
- Create: `docs/superpowers/specs/case-step-done-fixture.json`
- Test: `kapwa-server/src/cases/case-step-done.spec.ts`, `kapwa-client/src/components/case-view/CaseStepper.done.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/superpowers/specs/case-step-done-fixture.json` — an array of cases, each `{ name, caseData, interventionCount, opts, expected }`, where `caseData` uses the same key names the client already uses (`problemsPresented`, `clientCategory`, `selfRelianceLevel`, `sustainabilityPlan`, `clientSignature`, `closureOutcome`, `referrals`, `requirementsChecklist`). Both Tasks 5 and 6 import this file. Nothing else reads it.

- [ ] **Step 1: Read the exact current client predicate**

```bash
cd kapwa-client && sed -n '38,58p' src/components/case-view/CaseStepper.tsx
```

The five branches and the `STEP_STATUS_INDEPENDENT` / `STEP_MIN_STATUS` guards are the contract. Copy them exactly; do not improve them.

- [ ] **Step 2: Write the fixture**

`docs/superpowers/specs/case-step-done-fixture.json` — one case per branch **plus** the boundary cases that are easy to get wrong:

```json
[
  { "name": "step0 done: problems + category present", "step": 0,
    "caseData": { "status": "enrolled", "problemsPresented": "a", "clientCategory": "b" },
    "interventionCount": 0, "opts": {}, "expected": true },
  { "name": "step0 not done: category missing", "step": 0,
    "caseData": { "status": "enrolled", "problemsPresented": "a" },
    "interventionCount": 0, "opts": {}, "expected": false },
  { "name": "step1 done: intervention with all requirements met", "step": 1,
    "caseData": { "status": "enrolled" }, "interventionCount": 1,
    "opts": { "requirementsMet": true }, "expected": true },
  { "name": "step1 not done: intervention but requirements outstanding", "step": 1,
    "caseData": { "status": "enrolled" }, "interventionCount": 1,
    "opts": { "requirementsMet": false }, "expected": false },
  { "name": "step1 done: recorded no-intervention decision", "step": 1,
    "caseData": { "status": "enrolled" }, "interventionCount": 0,
    "opts": { "interventionNotNeeded": true }, "expected": true },
  { "name": "step1 not done: zero interventions and no decision", "step": 1,
    "caseData": { "status": "enrolled" }, "interventionCount": 0,
    "opts": {}, "expected": false },
  { "name": "step2 done: a referral exists", "step": 2,
    "caseData": { "status": "active", "referrals": [{ "id": "r1" }] },
    "interventionCount": 0, "opts": {}, "expected": true },
  { "name": "step2 not done: no referral and no decision", "step": 2,
    "caseData": { "status": "active", "referrals": [] },
    "interventionCount": 0, "opts": {}, "expected": false },
  { "name": "step3 needs active status: self-reliance on an enrolled case", "step": 3,
    "caseData": { "status": "enrolled", "selfRelianceLevel": 2, "sustainabilityPlan": "p" },
    "interventionCount": 0, "opts": {}, "expected": false },
  { "name": "step3 done: on an active case", "step": 3,
    "caseData": { "status": "active", "selfRelianceLevel": 2, "sustainabilityPlan": "p" },
    "interventionCount": 0, "opts": {}, "expected": true },
  { "name": "step4 not done: signature and outcome on an active case", "step": 4,
    "caseData": { "status": "active", "clientSignature": "sig", "closureOutcome": "done" },
    "interventionCount": 0, "opts": {}, "expected": false },
  { "name": "step4 done: on a transitioning case", "step": 4,
    "caseData": { "status": "transitioning", "clientSignature": "sig", "closureOutcome": "done" },
    "interventionCount": 0, "opts": {}, "expected": true }
]
```

- [ ] **Step 3: Write the client test against the fixture**

`kapwa-client/src/components/case-view/CaseStepper.done.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fixture from '../../../../docs/superpowers/specs/case-step-done-fixture.json';
import { stepperStepDone } from './CaseStepper';

describe('stepperStepDone against the shared fixture', () => {
  for (const c of fixture) {
    it(c.name, () => {
      expect(stepperStepDone(c.step, c.caseData, c.interventionCount, c.opts)).toBe(c.expected);
    });
  }
});
```

If the JSON import needs `assert { type: 'json' }` or a `resolveJsonModule` flag, add the flag to the vitest/tsconfig rather than inlining the data — the whole point is that both sides read one file.

- [ ] **Step 4: Run it**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseStepper.done.test.ts`
Expected: all pass. If any fail, the fixture is wrong, not the predicate — reconcile against the code you read in Step 1 and fix the fixture.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/case-step-done-fixture.json \
        kapwa-client/src/components/case-view/CaseStepper.done.test.ts
git commit -m "test(cases): shared fixture for the step-done predicate

Task 6 makes the server answer 'is this step done' independently, so the
predicate stops being a client-only detail. One JSON file, consumed by both
sides, so a change to one is a failing test in the other. Cases cover each
branch plus the status-floor boundaries that are easy to get wrong."
```

---

### Task 5: Lock and unlock endpoints

**Files:**
- Create: `kapwa-server/src/cases/case-step-locks.service.ts`
- Modify: `kapwa-server/src/cases/cases.controller.ts` (two routes)
- Modify: `kapwa-server/src/cases/cases.service.ts` (`findById` returns `stepLocks`)
- Test: `kapwa-server/src/cases/case-step-locks.service.spec.ts`

**Interfaces:**
- Consumes: `CaseStepLock` (Task 3), `case-step-done-fixture.json` (Task 4).
- Produces:
  - `CaseStepLocksService.lock(caseId: string, stepIndex: number, caller: User): Promise<CaseStepLock>`
  - `CaseStepLocksService.unlock(caseId: string, stepIndex: number, caller: User): Promise<void>`
  - `CaseStepLocksService.listForCase(caseId: string): Promise<Array<{ stepIndex: number; lockedByName?: string; lockedAt: Date }>>` — **Task 6's gate and its test both call this**, so it belongs to this task's contract, not to a later addition
  - `export const CASE_STEP_LABELS: Record<number, string>` exported from this file — the one home for step names, so `cases.service.ts` (Task 6) and the client cannot spell one step two different ways inside a single error message
  - `CasesService.findById(id)` gains `stepLocks: Array<{ stepIndex: number; lockedByName?: string; lockedAt: Date }>`
  - Routes: `POST /cases/:id/steps/:stepIndex/lock` and `DELETE /cases/:id/steps/:stepIndex/lock`, both `@Roles('admin','social_worker')`

- [ ] **Step 1: Write the failing tests**

`kapwa-server/src/cases/case-step-locks.service.spec.ts`. Cover all four Review Focus items that belong here:

```ts
describe('CaseStepLocksService', () => {
  const swUser = { id: 'u1', role: 'social_worker', agencyId: null,
    firstName: 'Juan', middleName: 'Dela', lastName: 'Cruz', nameExtension: null } as unknown as User;
  const otherSwUser = { id: 'u2', role: 'social_worker', agencyId: null,
    firstName: 'Lorna', middleName: 'B.', lastName: 'Santos', nameExtension: null } as unknown as User;

  // Step 0 is done only when problemsPresented and clientCategory are both set,
  // so an empty case is the cheapest way to make a step not-done.
  const notDoneCase = { id: 'c1', status: 'enrolled' };
  const doneCase = { id: 'c1', status: 'enrolled', problemsPresented: 'a', clientCategory: 'b' };

  it('rejects locking a step that is not done, naming the predicate', async () => {
    jest.spyOn(casesService, 'findById' as any).mockResolvedValue(notDoneCase);
    await expect(service.lock('c1', 0, swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 0, swUser)).rejects.toThrow(/not complete/i);
  });

  it('locks a done step and snapshots the locker name', async () => {
    jest.spyOn(casesService, 'findById' as any).mockResolvedValue(doneCase);
    const saved = await service.lock('c1', 0, swUser);
    expect(saved.stepIndex).toBe(0);
    expect(saved.lockedBy).toBe('u1');
    expect(saved.lockedByName).toBe('Juan Dela Cruz');
  });

  it('is idempotent when the same step is locked twice', async () => {
    jest.spyOn(casesService, 'findById' as any).mockResolvedValue(doneCase);
    await service.lock('c1', 0, swUser);
    const again = await service.lock('c1', 0, otherSwUser);
    expect(again.lockedByName).toBe('Lorna B. Santos');
    expect(lockRepo.create).not.toHaveBeenCalled(); // updated in place, not re-inserted
  });

  it('unlocks only the named step', async () => {
    await service.lock('c1', 0, swUser);
    await service.unlock('c1', 0, swUser);
    expect(lockRepo.delete).toHaveBeenCalledWith({ caseId: 'c1', stepIndex: 0 });
  });

  it('rejects a step index outside 0..4', async () => {
    await expect(service.lock('c1', 7, swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', -1, swUser)).rejects.toThrow(BadRequestException);
  });
});
```

For the role gate, assert at the controller/e2e level rather than the service — `RolesGuard` handles it, so a service unit test proves nothing about 403. See Task 8 for the e2e coverage.

- [ ] **Step 2: Run and confirm they fail**

Run: `cd kapwa-server && npx jest case-step-locks --silent=false`
Expected: FAIL — service does not exist.

- [ ] **Step 3: Implement the service**

Validate the index first, then re-derive `done` server-side from the same key names the fixture uses, then write. Pseudocode the shape; the query for `done` reuses `getInterventionCount` and the `requirementsChecklist` column:

```ts
async lock(caseId: string, stepIndex: number, caller: User) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 4) {
    throw new BadRequestException(`Unknown step ${stepIndex}`);
  }
  const done = await this.isStepDone(caseId, stepIndex);
  if (!done) {
    throw new BadRequestException(
      `Step ${stepIndex} is not complete yet — finish it before locking.`,
    );
  }
  const existing = await this.repo.findOne({ where: { caseId, stepIndex } });
  if (existing) {
    existing.lockedBy = caller.id;
    existing.lockedByName = this.displayName(caller);
    return this.repo.save(existing);
  }
  const row = this.repo.create({
    caseId,
    stepIndex,
    lockedBy: caller.id,
    lockedByName: this.displayName(caller),
  });
  return this.repo.save(row);
}

async unlock(caseId: string, stepIndex: number, caller: User) {
  await this.repo.delete({ caseId, stepIndex });
  await this.auditLog?.log('case.step_unlock', caseId, caller.id, { stepIndex });
}
```

`displayName` joins the same four name columns `transition()` already reads at `cases.service.ts:425-434`. Reuse that query shape rather than inventing a second one.

- [ ] **Step 4: Add the routes**

In `cases.controller.ts`, beside the other `@Roles('admin','social_worker')` routes:

```ts
@Post(':id/steps/:stepIndex/lock')
@Roles('admin', 'social_worker')
@HttpCode(201)
async lockStep(@Param('id') id: string, @Param('stepIndex') stepIndex: string, @Request() req: AuthenticatedRequest) {
  return this.stepLocks.lock(id, parseInt(stepIndex, 10), req.user);
}

@Delete(':id/steps/:stepIndex/lock')
@Roles('admin', 'social_worker')
async unlockStep(@Param('id') id: string, @Param('stepIndex') stepIndex: string, @Request() req: AuthenticatedRequest) {
  await this.stepLocks.unlock(id, parseInt(stepIndex, 10), req.user);
  return { ok: true };
}
```

- [ ] **Step 5: Return `stepLocks` from `findById`**

In `cases.service.ts` `findById`, after the family-members block, load locks and attach:

```ts
(c as any).stepLocks = (await this.stepLocksRepo.find({ where: { caseId: id } }))
  .map((l) => ({ stepIndex: l.stepIndex, lockedByName: l.lockedByName, lockedAt: l.lockedAt }));
```

Returning this in the existing detail payload avoids a second round-trip on the case view.

- [ ] **Step 6: Run and commit**

Run: `cd kapwa-server && npm run typecheck && npx jest case-step-locks --silent && npx jest --silent`
Expected: green.

```bash
git add kapwa-server/src/cases/case-step-locks.service.ts \
        kapwa-server/src/cases/case-step-locks.service.spec.ts \
        kapwa-server/src/cases/cases.controller.ts \
        kapwa-server/src/cases/cases.service.ts \
        kapwa-server/src/cases/cases.module.ts
git commit -m "feat(cases): step lock endpoints and stepLocks on the case payload

POST/DELETE /cases/:id/steps/:stepIndex/lock, admin+social_worker. A step may
only be sealed once it is done, re-derived server-side from the shared fixture
rather than trusted from the client. Locking twice updates in place instead of
raising a unique violation. findById now returns stepLocks so the case view
does not need a second request."
```

---

### Task 6: The all-locked gate on `assessed → in_review`

**Files:**
- Modify: `kapwa-server/src/cases/cases.service.ts` (`validateTransition`)
- Test: `kapwa-server/src/cases/cases.service.spec.ts`

**Interfaces:**
- Consumes: `CaseStepLocksService` (Task 5).
- Produces: none — a behaviour, not a signature.

- [ ] **Step 1: Write the failing test**

In the existing `describe` for transitions:

```ts
const fourLocks = [0, 1, 2, 3].map((stepIndex) => ({ caseId: 'c1', stepIndex, lockedBy: 'u1' }));
const fiveLocks = [0, 1, 2, 3, 4].map((stepIndex) => ({ caseId: 'c1', stepIndex, lockedBy: 'u1' }));

it('refuses assessed -> in_review until every step is locked, naming the gap', async () => {
  jest.spyOn(stepLocks, 'listForCase').mockResolvedValue(fourLocks);
  await expect(service.transition('c1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' }))
    .rejects.toThrow(/Intervention & Requirements/);
});

it('allows assessed -> in_review once all five steps are locked', async () => {
  jest.spyOn(stepLocks, 'listForCase').mockResolvedValue(fiveLocks);
  await expect(service.transition('c1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' }))
    .resolves.toBeDefined();
});
```

Also assert Review Focus item 4 — admin is **not** blocked by this rule:

```ts
it('does not apply the all-locked rule to admin', async () => {
  jest.spyOn(stepLocks, 'listForCase').mockResolvedValue([]); // nothing locked
  await expect(service.transition('c1', CaseStatus.IN_REVIEW, { userRole: 'admin' }))
    .resolves.toBeDefined();
});
```

That last one matters. `canTransition` short-circuits `admin` to `true`, so the gate must be scoped to the worker's edge only, or the office head cannot move a case at all.

- [ ] **Step 2: Run and confirm it fails**

Run: `cd kapwa-server && npx jest cases.service --silent=false -t "in_review"`
Expected: the "until every step is locked" test FAILS (currently transitions succeed).

- [ ] **Step 3: Implement**

In `validateTransition`, alongside the existing per-edge checks:

```ts
if (c.status === CaseStatus.ASSESSED && newStatus === CaseStatus.IN_REVIEW) {
  const locks = await this.stepLocks.listForCase(c.id);
  const missing = [0, 1, 2, 3, 4].filter((i) => !locks.some((l) => l.stepIndex === i));
  if (missing.length > 0) {
    throw new BadRequestException(
      `Lock every step before flagging this case for admin review. ` +
      `Still open: ${missing.map((i) => STEP_LABELS[i]).join(', ')}`,
    );
  }
}
```

Export `STEP_LABELS` from a shared place so the message names steps the way the UI does — an error saying "step 1" when the UI says "Intervention & Requirements" wastes the worker's time. This check goes **after** the existing FRVA/SWDI check so the cheaper, more specific error still wins.

- [ ] **Step 4: Run and commit**

Run: `cd kapwa-server && npx jest cases.service --silent && npx jest --silent && npm run lint`
Expected: green, 0 lint errors.

```bash
git add kapwa-server/src/cases/cases.service.ts kapwa-server/src/cases/cases.service.spec.ts
git commit -m "feat(cases): require every step locked before flagging for admin review

assessed -> in_review is the edge the FSM comment calls 'submit for review',
and it was gated only on an FRVA/SWDI score. A worker could flag a case with
no intervention recorded at all.

The check lives in validateTransition rather than behind a button, because the
same worker can call PATCH /cases/:id/status directly and would otherwise walk
straight past it. Scoped to the worker's edge: canTransition short-circuits
admin, so applying this to admin would leave the office head unable to move a
case. Behaviour change — in-flight cases that relied on the old gap will now
be told which steps are open."
```

---

### Task 7: `StepLockBar`

**Files:**
- Create: `kapwa-client/src/components/case-view/StepLockBar.tsx`
- Create: `kapwa-client/src/components/case-view/StepLockBar.test.tsx`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`, `.../fil/index.ts`

**Interfaces:**
- Consumes: `stepperStepDone` and `StepperProgressOpts` from `CaseStepper.tsx`; the lock routes from Task 5.
- Produces:

```ts
interface StepLockBarProps {
  caseId: string;
  stepIndex: number;
  caseData: any;
  interventionCount: number;
  opts?: StepperProgressOpts;
  locked?: { stepIndex: number; lockedByName?: string; lockedAt: string } | null;
  onChanged: () => void | Promise<void>;
  readOnly?: boolean;
}
```

Tasks 8 and 9 mount it five times with exactly these props.

- [ ] **Step 1: Write the failing test for all three states**

`StepLockBar.test.tsx`, mocking `api`:

```tsx
const noop = () => {};
const doneCaseData = { status: 'enrolled', problemsPresented: 'a', clientCategory: 'b' };
const lockedRow = { stepIndex: 0, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };

it('disables Lock and says why when the step is not done', () => {
  render(<StepLockBar caseId="c1" stepIndex={3} caseData={{ status: 'active' }} interventionCount={0} onChanged={noop} />);
  expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
});

it('enables Lock once the step is done', () => {
  render(<StepLockBar caseId="c1" stepIndex={0} caseData={doneCaseData} interventionCount={0} onChanged={noop} />);
  expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
});

it('shows who locked it and when, and offers Unlock', () => {
  render(<StepLockBar caseId="c1" stepIndex={0} caseData={doneCaseData} interventionCount={0} locked={lockedRow} onChanged={noop} />);
  expect(screen.getByText(/Juan Dela Cruz/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
});

it('hides both controls in readOnly', () => {
  render(<StepLockBar caseId="c1" stepIndex={0} caseData={doneCaseData} interventionCount={0} locked={lockedRow} onChanged={noop} readOnly />);
  expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  expect(screen.getByText(/Juan Dela Cruz/)).toBeTruthy(); // the record still reads
});

it('POSTs the lock and refreshes onChanged', async () => {
  const user = userEvent.setup();
  const onChanged = vi.fn();
  (api.post as Mock).mockResolvedValue({});
  render(<StepLockBar caseId="c1" stepIndex={0} caseData={doneCaseData} interventionCount={0} onChanged={onChanged} />);
  await user.click(screen.getByRole('button', { name: /^lock$/i }));
  expect(api.post).toHaveBeenCalledWith('/cases/c1/steps/0/lock');
  expect(onChanged).toHaveBeenCalled();
});

it('DELETEs the lock on unlock', async () => {
  const user = userEvent.setup();
  const onChanged = vi.fn();
  (api.del as Mock).mockResolvedValue({});
  render(<StepLockBar caseId="c1" stepIndex={0} caseData={doneCaseData} interventionCount={0} locked={lockedRow} onChanged={onChanged} />);
  await user.click(screen.getByRole('button', { name: /unlock/i }));
  expect(api.del).toHaveBeenCalledWith('/cases/c1/steps/0/lock');
  expect(onChanged).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd kapwa-client && npx vitest run src/components/case-view/StepLockBar.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement**

Derive `done` with the imported `stepperStepDone` — do not re-implement the predicate here; that is Task 4's whole point. Render:

- not locked, not done → `<Button disabled>` with a `title` explaining the unmet predicate
- not locked, done → `<Button>` calling `api.post(`/cases/${caseId}/steps/${stepIndex}/lock`)` then `onChanged()`
- locked → a strip with `<Lock>` icon, "Locked by {lockedByName} · {lockedAt}", and an Unlock button calling `api.del(...)`

Format the date with the existing `formatDate` from `src/lib/format`. Surface API errors with the existing `humanizeError` helper rather than a bare toast.

- [ ] **Step 4: Add both locales**

Keys under `caseView.lock.*`: `lock`, `unlock`, `lockedBy`, `notDoneHint`, `lockFailed`, `unlockFailed`. Add to `en` and `fil` in the same commit — a key present in one and missing in the other falls back to the key string at runtime.

- [ ] **Step 5: Run and commit**

Run: `cd kapwa-client && npm run typecheck && npx vitest run src/components/case-view/StepLockBar.test.tsx`
Expected: green.

```bash
git add kapwa-client/src/components/case-view/StepLockBar.tsx \
        kapwa-client/src/components/case-view/StepLockBar.test.tsx \
        kapwa-client/src/i18n/locales/en/index.ts \
        kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat(case-view): StepLockBar

One component, mounted five times. Renders a disabled Lock with the reason the
step is not done, an enabled Lock once it is, or a locked strip with the
locker's name and an Unlock. Reversible by design: option (a), so a mistaken
seal needs no admin.

Derives done by calling the existing stepperStepDone rather than restating the
predicate — that duplication is what Task 4's fixture exists to prevent."
```

---

### Task 8: Mount the bar on all five steps

Without this the all-locked gate in Task 6 is unsatisfiable — the rule is the spec, and it needs all five seals.

**Files:**
- Modify: `kapwa-client/src/components/case-view/StepAssessment.tsx` (step 0)
- Modify: `kapwa-client/src/components/case-view/StepInterventions.tsx` (step 1 — also Task 9's layout work lands here; do the mount now, the layout in Task 9)
- Modify: `kapwa-client/src/components/case-view/StepIntegratedDelivery.tsx` (step 2)
- Modify: `kapwa-client/src/components/case-view/StepTransition.tsx` (step 3)
- Modify: `kapwa-client/src/components/case-view/StepClosure.tsx` (step 4)
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (thread `stepLocks` down)
- Test: extend each step's existing spec

**Interfaces:**
- Consumes: `StepLockBar` (Task 7), `stepLocks` from the case payload (Task 5).
- Produces: each step component accepts an optional `stepLock` prop:

```ts
stepLock?: { stepIndex: number; lockedByName?: string; lockedAt: string } | null;
```

- [ ] **Step 1: Thread `stepLocks` from the case view**

In `CaseViewPage`, derive the per-step lock from `caseData.stepLocks`:

```ts
const lockFor = (i: number) => (caseData?.stepLocks ?? []).find((l: any) => l.stepIndex === i) ?? null;
```

Pass `lockFor(0)`…`lockFor(4)` to the five step components. Keep the mapping in the case view so the step components stay unaware of the array.

- [ ] **Step 2: Write a failing test on one step before doing all five**

In `StepAssessment.test.tsx` (create it if absent):

```tsx
it('offers Lock only once the assessment is complete', async () => {
  render(<StepAssessment caseId="c1" caseData={{}} onSaved={noop} />);
  expect(await screen.findByRole('button', { name: /^lock$/i })).toBeDisabled();

  render(<StepAssessment caseId="c1" caseData={{ problemsPresented: 'a', clientCategory: 'b' }} onSaved={noop} />);
  expect(await screen.findByRole('button', { name: /^lock$/i })).toBeEnabled();
});
```

Run: `cd kapwa-client && npx vitest run src/components/case-view/StepAssessment.test.tsx` → FAIL. Now implement.

- [ ] **Step 3: Mount on step 0 and make that test pass**

- [ ] **Step 4: Repeat for steps 1–4**

For each, add the equivalent test to its spec, watch it fail, mount `StepLockBar`, watch it pass. Step 1's `interventionCount` comes from the existing interventions SWR; step 2's `opts` passes `referralNotNeeded`.

For step 1 the `done` predicate needs the same `requirementsMet` the approval-pipeline cards already compute. Read how `CaseViewPage` derives `requirementsMet` (around line 238) and pass it through rather than recomputing.

- [ ] **Step 5: Verify all five**

Run: `cd kapwa-client && npm run typecheck && npx vitest run`
Expected: green, and five separate specs now assert a Lock control.

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/components/case-view/ \
        kapwa-client/src/pages/CaseViewPage.tsx
git commit -m "feat(case-view): mount StepLockBar on all five steps

The all-locked gate is unsatisfiable until all five steps can be sealed, so all
five get the control. StepInterventions gets only the lock mount here; Task 9 does its
layout, so this commit stays reviewable on its own.

The per-step lock is resolved once in CaseViewPage and passed down, so the step
components never see the stepLocks array."
```

---

### Task 9: The merged intervention card

**Files:**
- Modify: `kapwa-client/src/components/case-view/StepInterventions.tsx`
- Modify: `kapwa-client/src/components/case-view/CaseRequirements.tsx` (add `extraProgramIds`)
- Test: `kapwa-client/src/components/case-view/CaseRequirements.test.tsx`

**Interfaces:**
- Consumes: `StepLockBar` (Task 7).
- Produces: `CaseRequirements` gains one optional prop, `extraProgramIds?: string[]`, so the checklist can preview a selected-but-unsaved program.

- [ ] **Step 1: Write the failing test for the preview**

In `CaseRequirements.test.tsx`:

```tsx
it('shows the selected program documents before the intervention is saved', () => {
  // no saved interventions; the program list has "Medical Assistance" with
  // requiredDocuments ['Barangay Certificate of Indigency', 'Medical abstract']
  render(
    <CaseRequirements
      caseId="c1"
      caseData={{}}
      userRole="social_worker"
      extraProgramIds={[medicalProgramId]}
    />,
  );
  expect(screen.getByText('Barangay Certificate of Indigency')).toBeTruthy();
  expect(screen.getByText('Medical abstract')).toBeTruthy();
});
```

Currently `CaseRequirements.tsx:49-53` builds `programIds` only from saved interventions, so this fails.

- [ ] **Step 2: Run and confirm it fails**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseRequirements.test.tsx`
Expected: FAIL — nothing rendered, because `allRequirements.length === 0` returns `null` at line 66.

- [ ] **Step 3: Add the prop**

```ts
interface CaseRequirementsProps {
  caseId: string;
  caseData: any;
  userRole?: string;
  /** Programs selected but not yet saved, so their documents preview here. */
  extraProgramIds?: string[];
}
```

and widen the id set:

```ts
const programIds = [
  ...new Set([...interventions.map((i: any) => i.programId).filter(Boolean), ...(extraProgramIds ?? [])]),
];
```

- [ ] **Step 4: Verify, then restructure the card**

Run the spec → passes.

Now in `StepInterventions.tsx`:
1. Add an `h2` reading "Intervention to be issued" **above** the add-intervention card, not inside the list card.
2. Move `<CaseRequirements … />` from the bottom of the component into the add-intervention card, below a `<Separator />`, so the program select and its document list are one card.
3. Pass `extraProgramIds={form.programId && !form.programId.startsWith('adhoc:') ? [form.programId] : []}` so the checklist tracks the selection live.
4. The intervention list stays its own card below.

Handle Review Focus item 5: when no program is selected and nothing is saved, `CaseRequirements` returns `null` and the card simply shows no checklist. Make sure the step's Lock button is still reachable and still correctly disabled in that state.

- [ ] **Step 5: Verify and commit**

Run: `cd kapwa-client && npm run typecheck && npx vitest run`
Expected: green.

```bash
git add kapwa-client/src/components/case-view/StepInterventions.tsx \
        kapwa-client/src/components/case-view/CaseRequirements.tsx \
        kapwa-client/src/components/case-view/CaseRequirements.test.tsx
git commit -m "feat(case-view): fold required documents into the intervention card

The checklist was a separate card below the add-intervention form, so a worker
picked a program in one place and only learned its document needs in another.

'Intervention to be issued' now heads the add-intervention card and the
checklist sits inside it. CaseRequirements gains extraProgramIds so it can
preview the selected program's documents before the intervention is saved —
otherwise the merged card would show nothing until after Save."
```

---

### Task 10: `CaseActionBar`

**Files:**
- Create: `kapwa-client/src/components/case-view/CaseActionBar.tsx`
- Create: `kapwa-client/src/components/case-view/CaseActionBar.test.tsx`
- Modify: `kapwa-client/src/pages/CaseViewPage.tsx` (mount it)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`, `.../fil/index.ts`

**Interfaces:**
- Consumes: `caseData.stepLocks` (Task 5), `CASE_FSM` via the existing client role map.
- Produces:

```ts
interface CaseActionBarProps {
  caseId: string;
  caseData: any;
  userRole: string;
  onChanged: () => void | Promise<void>;
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
const noop = () => {};
const locksFor = (steps: number[]) => steps.map((stepIndex) => ({ stepIndex, lockedByName: 'X', lockedAt: '2026-10-01T09:00:00Z' }));

it('gives a worker one Flag button, disabled until all five steps are locked', () => {
  render(<CaseActionBar caseId="c1" caseData={{ status: 'assessed', stepLocks: locksFor([0, 1, 2, 3]) }} userRole="social_worker" onChanged={noop} />);
  expect(screen.getByRole('button', { name: /flag for admin review/i })).toBeDisabled();
  expect(screen.getByText(/Intervention & Requirements/)).toBeTruthy(); // names the gap
});

it('enables Flag and names the next status once all five are locked', () => {
  render(<CaseActionBar caseId="c1" caseData={{ status: 'assessed', stepLocks: locksFor([0, 1, 2, 3, 4]) }} userRole="social_worker" onChanged={noop} />);
  expect(screen.getByRole('button', { name: /flag for admin review/i })).toBeEnabled();
});

it.each([
  ['enrolled', 'Mark assessed'],
  ['assessed', 'Send to review'],
  ['in_review', 'Approve & activate'],
  ['active', 'Begin transition'],
  ['transitioning', 'Close case'],
])('gives an admin exactly the %s button', (status, label) => {
  render(<CaseActionBar caseId="c1" caseData={{ status }} userRole="admin" onChanged={noop} />);
  expect(screen.getAllByRole('button')).toHaveLength(1); // only the legal hop
  expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy();
});

it('asks for a signature before approving', async () => {
  const user = userEvent.setup();
  render(<CaseActionBar caseId="c1" caseData={{ status: 'in_review' }} userRole="admin" onChanged={noop} />);
  await user.click(screen.getByRole('button', { name: /approve & activate/i }));
  expect(screen.getByLabelText(/signature/i)).toBeTruthy();
  expect(api.patch).not.toHaveBeenCalled(); // nothing sent until it is filled
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `cd kapwa-client && npx vitest run src/components/case-view/CaseActionBar.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement**

- Worker (`social_worker`, status `assessed`): "Flag for admin review". Compute the missing steps from `stepLocks`; when non-empty, disable and render the list of their labels. When empty, open a confirm dialog naming the effect, then `api.patch(`/cases/${caseId}/status`, { status: 'in_review' })`.
- Admin: a `Record<CaseStatus, { to: CaseStatus; label: string }>` for the five forward hops. Render only the entry matching the current status. Each opens a confirm dialog naming the effect.
- `in_review → active` must collect a signature. `approve` takes `signature: string` (`cases.service.ts:467`) and the existing `ApproveCaseSchema` will reject an empty one — read that schema before building the dialog so the field name matches.
- Surface the server's 400 text verbatim. When the all-locked gate fires from a stale client, its message already names the open steps.

- [ ] **Step 4: Add both locales**

`caseView.action.*`: `flagForReview`, `flagConfirmTitle`, `flagConfirmBody`, `markAssessed`, `sendToReview`, `approveActivate`, `beginTransition`, `closeCase`, `signatureLabel`, `signatureRequired`, `confirm`, `transitionFailed`, `lockedStepsHeading`.

- [ ] **Step 5: Mount in `CaseViewPage`, verify, commit**

Run: `cd kapwa-client && npm run typecheck && npx vitest run`
Expected: green.

```bash
git add kapwa-client/src/components/case-view/CaseActionBar.tsx \
        kapwa-client/src/components/case-view/CaseActionBar.test.tsx \
        kapwa-client/src/pages/CaseViewPage.tsx \
        kapwa-client/src/i18n/locales/en/index.ts \
        kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat(case-view): deliberate case action bar

Workers get one 'Flag for admin review' button, disabled until all five steps
are locked and, while disabled, naming which steps are still open rather than
greying out silently. Admins get one named button per legal forward hop, only
the legal one rendering, each behind a confirm dialog naming its effect.

Option (c) over a single generic 'Advance': a control whose effect depends on
invisible state is exactly the accident this replaces. Approve collects a
signature because the existing schema requires one."
```

---

### Task 11: End-to-end verification against the dev server

Unit tests prove the pieces. This proves the feature works against a real API and a real browser, driven through the local dev server on the podman database.

**Files:**
- Create: `tests/pw-case-locks.mjs` (Playwright MCP suite, untracked by convention)
- Modify: `test-results/pw-stack/FINDINGS.md` (append results)

**Interfaces:**
- Consumes: everything above.
- Produces: verification evidence. No production code changes unless a defect is found, in which case fix it in the task that owns it rather than here.

- [ ] **Step 1: Start the dev server against the podman database**

Per the human partner: verify against a local dev server, not the container
stack. No image rebuild — the client runs under Vite and the API under Nest,
both pointed at the podman Postgres. Much faster to iterate when a check fails.

The podman database is already up and publishing 5432 (`kapwa-db`, healthy).
What must be overridden: `infra/.env.production` points at AWS RDS with
`DB_SSL=true`. **Do not edit that file** — it is the deployed configuration.
Override for the dev process only, from the worktree:

```bash
# from the worktree root, .worktrees/case-step-locks
podman ps --format "{{.Names}}: {{.Status}}" | grep kapwa-db    # must be healthy

cd kapwa-server
DB_HOST=127.0.0.1 DB_PORT=5432 DB_SSL=false npm run start:dev
```

That is the API on :3000. In a second shell the client — Vite proxies `/api`
and `/socket.io` to :3000, so nothing else needs configuring:

```bash
cd kapwa-client && npm run dev
```

Client on :5173. Wait for Nest to report the API listening before starting
Vite, or the first proxied request fails and looks like a product bug. The
server needs the new `case_step_locks` table: run `npm run migration:run`
once against the podman DB (Task 3 added the migration).

Leave both processes running for Steps 3 and 5. Do not commit any `.env`
change — the override lives on the command line only.

- [ ] **Step 2: Run the server suite and the client suite once more**

```bash
cd kapwa-server && npm run typecheck && npx jest --silent && npm run lint
cd ../kapwa-client && npm run typecheck && npx vitest run
```

Expected: all green, 0 lint errors.

- [ ] **Step 3: Drive the flow in a fresh browser page per role**

The Playwright MCP page goes stale after roughly 40 navigations and stops delivering synthetic mouse events. **Use a fresh page for each scenario** and clear storage with a single `evaluate` — an `addInitScript` that clears storage re-runs on every navigation and wipes the token the login just stored.

Scenarios, each as its own page:
1. `worker1@mswdo.test` / `worker123` → open a case → each of the five steps shows a Lock, all disabled, with reasons.
2. Same worker, complete step 0 → Lock for step 0 becomes enabled → click it → the strip shows the worker's name → **attempt an edit and confirm the lock is not silently bypassed** (Review Focus item 2: either the edit is refused or the lock is dropped — whichever you built, assert it).
3. Lock a second time → no error, strip updates (idempotency, Review Focus item 3).
4. Unlock step 0 → the Lock button returns.
5. With four of five locked → "Flag for admin review" is disabled and names the fifth step.
6. With all five locked → the button enables → click → confirm dialog → case moves to `in_review`.
7. `admin@mswdo.test` / `admin123` on the same case → exactly one admin button renders, "Approve & activate", with a signature field.
8. `coordinator.bigte@mswdo.test` / `coordinator123` on a case → **no Lock controls anywhere** (Review Focus item 1).
9. Re-issue a case referral as `worker1` and confirm the letter downloads with no 403 (Task 1's fix, end to end).

- [ ] **Step 4: Prove the server gate is not client-only**

Confirm the gate is not a button in the UI by calling the endpoint the UI bypasses. You are not to query the API directly as a *test method* — the instruction was to drive the app through the browser — but verifying a server-side guard is a different act from exercising the app. If you would rather stay strictly within the rule, verify it in Task 6's Jest test instead (it already asserts the 400) and skip this step. Do not invent a second, weaker assertion to compensate.

- [ ] **Step 5: Record the evidence**

Append a section to `test-results/pw-stack/FINDINGS.md` with the nine scenarios, their outcomes, and any defect found. If a defect surfaced, fix it in its owning task and re-run.

- [ ] **Step 6: Commit**

```bash
git add test-results/pw-stack/FINDINGS.md
git commit -m "docs: record case-lock verification against the podman stack"
```

---

### Task 12: Correct the stale migration count in AGENTS.md

`AGENTS.md` tells the next engineer the chain ends at `…0000000000055` across 55 files. It ends at `…0000000000073` across 76. An agent that trusts it picks a colliding key and TypeORM silently skips the migration.

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Verify the real numbers**

```bash
ls kapwa-server/src/database/migrations/*.ts | wc -l
ls kapwa-server/src/database/migrations/ | grep -oE '[0-9]{13}' | sort | tail -1
```

- [ ] **Step 2: Correct the doc**

Change "55 files, TypeORM migrations" and the `…0000000000056` example to the verified values. Note in the same edit that the count moves and the next key must be read off the filesystem, not the doc — otherwise this rots identically.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: correct the stale migration chain count in AGENTS.md

It claimed 55 files ending at ...0000000000055. The chain is 76 files ending at
...0000000000073. An agent trusting it picks a colliding migration key, and
TypeORM's parseInt ordering then silently skips the migration."
```

---

## Self-Review

**Spec coverage.** Storage §1 → Task 3. Endpoints §2 → Task 5. Gate §3 → Task 6. `StepLockBar` §4 → Task 7. Layout §5 → Task 9, with the mounts in Task 8. Actions §6 → Task 10. PDF fix §7 → Task 1. Dead link §8 → Task 2. Testing → Tasks 4, 11. Migration-key correction, raised while writing the spec, is deliberately not spec-scoped; it gets its own task (12) so it is not lost.

**Dependencies.** Task 4 must precede 5 — the server predicate is written against the fixture, and writing the fixture after the service would mean writing a test to match whatever the service happened to do. Task 7 must precede 8 and 9, which mount it. Task 5 must precede 6, whose error message needs `listForCase`. Task 1 and 2 have no dependencies and can go first or in parallel.

**Type consistency.** `CaseStepLock` fields are set once in Task 3 and read as `stepIndex`/`lockedByName`/`lockedAt` in Task 5, matching `StepLockBarProps.locked` in Task 7 and `lockFor` in Task 8. `StepLockBarProps` is written out in full in Task 7 and referenced by name in Tasks 8 and 9. `CaseActionBarProps` is written in Task 10 and used only there. `CASE_FSM` is not re-declared on the client — the admin button map is keyed by the same `CaseStatus` strings the server enum serialises.

**Placeholders.** Scanned for TBD, TODO, FIXME, "implement later", "add appropriate error handling", "write tests for the above", and elided test bodies. The first pass contained two `/* ... */` markers inside test bodies in Task 5 and two vague setup comments in Task 6; both are now written out in full, with concrete fixtures and expected values. Remaining prose that says "copy the shape of X" points at a named file in this repo, not at an absent artifact.

**A gap worth naming.** Task 6's gate and Task 10's disabled button are two expressions of one rule. If someone changes the rule in one place the other silently disagrees. The spec asked for the server gate specifically so the button cannot be the only check, and that is deliberate — but the button's list of open steps is a *presentation* of the rule and deserves its own test, which Tasks 8 and 10 both carry. Worth watching during review, not worth pre-emptively building a shared constant across the wire for two lines of code.
