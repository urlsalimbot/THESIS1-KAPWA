# Program-Based SLA After Active Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once a case reaches `active`, its SLA warning/escalation thresholds come from the assigned program's `waiting_period_days` instead of the global constants.

**Architecture:** `SlaService.checkAndEscalate` already ages ACTIVE cases against `APPROVED_WARNING_DAYS`/`APPROVED_ESCALATION_DAYS`. ACTIVE cases always have ≥ 1 intervention (FSM requires it to go active), and interventions carry `program_id` — so the program is resolved with one join query over `case_interventions` → `programs`, with no schema change. Threshold mapping: escalation = `waiting_period_days`, warning = `max(1, waiting_period_days − 1)`; programs without `waiting_period_days` (or without a program) fall back to the global 2/3 constants. `enrolled`/`in_review` behavior is untouched.

**Tech Stack:** NestJS, TypeORM (`Repository.query` for the join), jest.

## Global Constraints

- No schema/migration changes — resolution goes through `case_interventions.program_id`.
- `enrolled` and `in_review` SLA thresholds remain exactly as today (`PENDING_*`/`REVIEW_*` constants).
- Program-based mapping: escalation = `waiting_period_days`; warning = `max(1, waiting_period_days − 1)`.
- Fallback (no program, or `waiting_period_days` NULL): `APPROVED_WARNING_DAYS` (2) / `APPROVED_ESCALATION_DAYS` (3).
- Tests must be deterministic: use `jest.useFakeTimers().setSystemTime(new Date('2026-09-04T00:00:00Z'))` (a Friday).

---
### Task 1: Rewrite the SLA service spec with program-based ACTIVE tests (TDD)

**Files:**
- Modify: `kapwa-server/src/sla/sla.service.spec.ts` (replace the whole file)

**Interfaces:**
- Consumes: `SlaService.checkAndEscalate(): Promise<{ escalated: number; warnings: number }>` (existing signature).
- Produces: mock repo contract for Task 2 — `caseRepo.find` returns the per-status case arrays; `caseRepo.query` returns rows `[{ case_id: string; waiting_period_days: string }]` for the program join.

- [ ] **Step 1: Write the failing tests**

Replace `kapwa-server/src/sla/sla.service.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaService } from './sla.service';
import { Case, CaseStatus } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';

describe('SlaService', () => {
  let service: SlaService;
  let caseRepo: any;
  let notifRepo: any;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T00:00:00Z'));
    caseRepo = {
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    notifRepo = { save: jest.fn().mockResolvedValue({}) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
      ],
    }).compile();
    service = module.get<SlaService>(SlaService);
    jest.clearAllMocks();
    caseRepo.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const activeCase = (id: string, createdAt: Date) => ({
    id, status: CaseStatus.ACTIVE, assignedWorkerId: 'w1', createdAt,
  });
  // Sep 4 2026 is a Friday. Working days from these starts to Sep 4:
  // Aug 28 (Fri) = 6, Aug 31 (Mon) = 5, Sep 1 (Tue) = 4, Sep 2 (Wed) = 3, Sep 3 (Thu) = 2.
  const date = (d: string) => new Date(`${d}T00:00:00Z`);

  it('escalates an active case at the program waiting period and warns one day earlier', async () => {
    caseRepo.find.mockResolvedValue([
      activeCase('c-esc', date('2026-08-31')), // 5 working days
      activeCase('c-warn', date('2026-09-01')), // 4 working days
      activeCase('c-ok', date('2026-09-02')),   // 3 working days
    ]);
    caseRepo.query.mockResolvedValue([
      { case_id: 'c-esc', waiting_period_days: '5' },
      { case_id: 'c-warn', waiting_period_days: '5' },
      { case_id: 'c-ok', waiting_period_days: '5' },
    ]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(result.warnings).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledTimes(2);
    const titles = (notifRepo.save as jest.Mock).mock.calls.map((c: any[]) => c[0].title);
    expect(titles.some((t: string) => t.includes('c-esc'.length ? 'SLA Escalation' : ''))).toBe(true);
  });

  it('falls back to global thresholds when the program has no waiting period', async () => {
    caseRepo.find.mockResolvedValue([
      activeCase('c-esc', date('2026-09-01')), // 4 working days — above global escalation of 3
    ]);
    caseRepo.query.mockResolvedValue([{ case_id: 'c-esc', waiting_period_days: null }]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1);
    expect(notifRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: 'c-esc' }),
    );
  });

  it('warns at the global threshold when the case has no program at all', async () => {
    caseRepo.find.mockResolvedValue([
      activeCase('c-warn', date('2026-09-02')), // 3 working days → global warning is 2, escalation 3
    ]);
    caseRepo.query.mockResolvedValue([]);

    const result = await service.checkAndEscalate();

    expect(result.escalated).toBe(1); // 3 >= 3 → escalation per global constants
    expect(notifRepo.save).toHaveBeenCalledTimes(1);
  });

  it('leaves enrolled and in_review on the global constants', async () => {
    caseRepo.find
      .mockResolvedValueOnce([{ id: 'c-enrolled', status: CaseStatus.ENROLLED, assignedWorkerId: 'w1', createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([{ id: 'c-review', status: CaseStatus.IN_REVIEW, createdAt: date('2026-09-01') }])
      .mockResolvedValueOnce([]);

    const result = await service.checkAndEscalate();

    // 4 working days: enrolled escalates at 3; in_review escalates at 3.
    expect(result.escalated).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd kapwa-server && npx jest src/sla/sla.service.spec.ts`
Expected: FAIL — the ACTIVE branch ignores `waiting_period_days`, so the first test's counts don't match (global 3/2 applies, giving `escalated`/`warnings` of 2/1 instead of 1/1).

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/sla/sla.service.spec.ts
git commit -m "test(sla): program-based ACTIVE thresholds + global fallback coverage"
```

---
### Task 2: Implement program-based thresholds in the ACTIVE branch

**Files:**
- Modify: `kapwa-server/src/sla/sla.service.ts:58-70` (the ACTIVE branch of `checkAndEscalate`)

**Interfaces:**
- Consumes: `this.caseRepo.find`, `this.caseRepo.query` as mocked in Task 1.
- Produces: `checkAndEscalate()` returning `{ escalated, warnings }` where ACTIVE cases use `waiting_period_days` (fallback global).

- [ ] **Step 1: Replace the ACTIVE branch**

In `kapwa-server/src/sla/sla.service.ts`, replace lines 58-70:

```ts
    const activeOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.ACTIVE },
    });
    for (const c of activeOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      if (age >= APPROVED_ESCALATION_DAYS) {
        await this.createAlert(c, 'active', 'Admin attention required — case active > 3 days without transition');
        escalated++;
      } else if (age >= APPROVED_WARNING_DAYS) {
        await this.createAlert(c, 'active', 'Warning: case active > 2 days without transition');
        warnings++;
      }
    }
```

with:

```ts
    // ACTIVE cases carry ≥1 intervention (FSM gate), so the program is resolved
    // via case_interventions.program_id. SLA thresholds then come from the
    // program's waiting_period_days (escalation = waiting period, warning = one
    // working day earlier); programs without it fall back to the global
    // APPROVED_* constants.
    const activeOverdue = await this.caseRepo.find({
      where: { status: CaseStatus.ACTIVE },
    });
    let wpdByCase = new Map<string, number>();
    if (activeOverdue.length > 0) {
      const rows = await this.caseRepo.query(
        `SELECT ci.case_id, p.waiting_period_days
         FROM case_interventions ci
         JOIN programs p ON p.id = ci.program_id
         WHERE ci.case_id = ANY($1)
           AND p.waiting_period_days IS NOT NULL`,
        [activeOverdue.map(c => c.id)],
      );
      wpdByCase = new Map(
        (rows as Array<{ case_id: string; waiting_period_days: string | number }>).map(r => [
          r.case_id,
          Number(r.waiting_period_days),
        ]),
      );
    }
    for (const c of activeOverdue) {
      const age = this.workingDays(c.createdAt, new Date());
      const wpd = wpdByCase.get(c.id);
      const escDays = wpd ?? APPROVED_ESCALATION_DAYS;
      const warnDays = wpd != null ? Math.max(1, wpd - 1) : APPROVED_WARNING_DAYS;
      if (age >= escDays) {
        await this.createAlert(c, 'active', `Admin attention required — case active > ${escDays} days without transition`);
        escalated++;
      } else if (age >= warnDays) {
        await this.createAlert(c, 'active', `Warning: case active > ${warnDays} days without transition`);
        warnings++;
      }
    }
```

- [ ] **Step 2: Run the spec to verify it passes**

Run: `cd kapwa-server && npx jest src/sla/sla.service.spec.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 3: Typecheck + full server suite**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent`
Expected: typecheck clean; `Test Suites: 54 passed`, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/sla/sla.service.ts
git commit -m "feat(sla): program-based ACTIVE thresholds via waiting_period_days

Once a case is active, resolve its program through case_interventions.program_id
(active cases always carry an intervention) and age the case against the
program's waiting_period_days — escalation at the waiting period, warning one
working day earlier, with the global APPROVED_* constants as fallback."
```

---
## Self-Review

**Spec coverage:** "program based SLA after getting active status" → Task 2 changes exactly the ACTIVE branch; Task 1 locks the behavior with deterministic tests. Fallback + untouched statuses are explicit tests.

**Placeholder scan:** no TBDs; every step carries real code and commands.

**Type consistency:** `caseRepo.query` rows typed as `{ case_id; waiting_period_days }` in both Task 1 mocks and Task 2 implementation; `checkAndEscalate` signature unchanged.