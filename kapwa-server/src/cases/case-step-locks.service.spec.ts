import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CaseStepLocksService, CASE_STEP_LABELS } from './case-step-locks.service';
import { CaseStepLock } from './case-step-lock.entity';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { User } from '../auth/user.entity';

interface DoneFixtureCase {
  name: string;
  step: number;
  caseData: Record<string, unknown>;
  interventionCount: number;
  opts: {
    requirementsMet?: boolean;
    referralNotNeeded?: boolean;
    interventionNotNeeded?: boolean;
  };
  expected: boolean;
}

// The server re-derives the done-predicate in TypeScript (the server program
// has no resolveJsonModule and its tsconfig `include` stops at src/, so it
// cannot import this file), which puts the risk of the two copies drifting
// entirely on this test. Read the shared fixture and drive the service through
// every case: drop a branch in either copy and one case here fails.
const FIXTURE_PATH = join(
  __dirname, '..', '..', '..', 'docs', 'superpowers', 'specs', 'case-step-done-fixture.json',
);
const FIXTURE: DoneFixtureCase[] = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

/**
 * Translate one fixture case into the `Case` shape `findById` returns.
 *
 * The fixture states the three progress flags in the client's `opts` form.
 * Server-side each one is a column on the case instead, so the flag is
 * rendered as the column that produces it: `requirementsMet` as a
 * `requirementsChecklist` whose entries are all met (or one that is not), and
 * the two recorded decisions as their boolean columns. `caseData` is already
 * keyed on the `Case` field and getter names, so it passes through as-is.
 */
function caseFor(fx: DoneFixtureCase): Partial<Case> {
  const { requirementsMet, referralNotNeeded, interventionNotNeeded } = fx.opts;
  return {
    id: 'c1',
    ...fx.caseData,
    // An absent flag must leave the checklist undefined, not empty-but-met:
    // the service reads undefined as "nothing outstanding".
    ...(requirementsMet === undefined
      ? {}
      : { requirementsChecklist: { 'Valid ID': requirementsMet } }),
    ...(referralNotNeeded === undefined ? {} : { referralNotNeeded }),
    ...(interventionNotNeeded === undefined ? {} : { interventionNotNeeded }),
  } as unknown as Partial<Case>;
}

describe('CaseStepLocksService', () => {
  let service: CaseStepLocksService;
  let casesService: CasesService;
  let lockRepo: any;
  let auditLog: { log: jest.Mock };

  const swUser = {
    id: 'u1', role: 'social_worker', agencyId: null,
    firstName: 'Juan', middleName: 'Dela', lastName: 'Cruz', nameExtension: null,
  } as unknown as User;
  const otherSwUser = {
    id: 'u2', role: 'social_worker', agencyId: null,
    firstName: 'Lorna', middleName: 'B.', lastName: 'Santos', nameExtension: null,
  } as unknown as User;

  // Step 0 is done only when problemsPresented and clientCategory are both set,
  // so an empty case is the cheapest way to make a step not-done.
  const notDoneCase = { id: 'c1', status: 'enrolled' } as unknown as Case;
  const doneCase = { id: 'c1', status: 'enrolled', problemsPresented: 'a', clientCategory: 'b' } as unknown as Case;

  const findById = jest.fn();
  const interventionCount = jest.fn().mockResolvedValue(0);

  beforeEach(async () => {
    jest.clearAllMocks();
    findById.mockResolvedValue(notDoneCase);
    interventionCount.mockResolvedValue(0);

    // The insert half of the upsert: every builder call returns itself, and
    // `execute` hands back the row Postgres would have returned.
    const insertQb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      // `RETURNING *` hands back the row Postgres stored, in column names. The
      // stub echoes the inserted values so a caller sees what it wrote, and
      // stamps a locked_at the way the DEFAULT would.
      execute: jest.fn(async function (this: any) {
        const v = this.values.mock.calls.at(-1)?.[0] ?? {};
        return {
          raw: [{
            id: 'row-1',
            case_id: v.caseId,
            step_index: v.stepIndex,
            locked_by: v.lockedBy,
            locked_by_name: v.lockedByName,
            locked_at: new Date('2026-10-01'),
          }],
        };
      }),
    };
    lockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data: Partial<CaseStepLock>) => ({ ...data })),
      save: jest.fn(async (row: any) => row),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => insertQb),
      insertQb,
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        CaseStepLocksService,
        { provide: getRepositoryToken(Case), useValue: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), query: jest.fn().mockResolvedValue([]), manager: { query: jest.fn().mockResolvedValue([]) } } },
        { provide: getRepositoryToken(CaseHistory), useValue: { find: jest.fn(), save: jest.fn(), query: jest.fn() } },
        { provide: getRepositoryToken(HouseholdMembership), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: { findOne: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyCaseUpdate: jest.fn() } },
        { provide: CasesExportService, useValue: {} },
        { provide: AuditLogService, useValue: auditLog },
        { provide: getRepositoryToken(CaseStepLock), useValue: lockRepo },
      ],
    }).compile();

    casesService = module.get<CasesService>(CasesService);
    service = module.get<CaseStepLocksService>(CaseStepLocksService);

    jest.spyOn(casesService, 'findById').mockImplementation(findById as any);
    jest.spyOn(casesService, 'getInterventionCount' as any).mockImplementation(interventionCount as any);
  });

  it('rejects locking a step that is not done, naming the predicate', async () => {
    findById.mockResolvedValue(notDoneCase);
    await expect(service.lock('c1', 0, swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 0, swUser)).rejects.toThrow(/not complete/i);
    // The rejection happens before any write.
    expect(lockRepo.save).not.toHaveBeenCalled();
  });

  it('locks a done step and snapshots the locker name', async () => {
    findById.mockResolvedValue(doneCase);
    const saved = await service.lock('c1', 0, swUser);
    expect(saved.stepIndex).toBe(0);
    expect(saved.lockedBy).toBe('u1');
    expect(saved.lockedByName).toBe('Juan Dela Cruz');
  });

  it('is idempotent when the same step is locked twice', async () => {
    findById.mockResolvedValue(doneCase);
    const first = await service.lock('c1', 0, swUser);
    const again = await service.lock('c1', 0, otherSwUser);
    expect(again.lockedByName).toBe('Lorna B. Santos');
    expect(again.lockedBy).toBe('u2');
    expect(again.stepIndex).toBe(0);
    // A second seal of the same step is one upsert, not an insert that would
    // violate uq_case_step_locks_case_step.
    expect(lockRepo.insertQb.execute).toHaveBeenCalledTimes(2);
    expect(lockRepo.save).not.toHaveBeenCalled();
    expect(first).toBeDefined();
  });

  // The old implementation was findOne-then-save, so two concurrent POSTs both
  // saw null and both inserted. Pin the atomic form: one upsert, conflicting on
  // the (case, step) unique key, and the seal timestamp left alone so the row
  // keeps the moment of the *first* seal.
  it('seals with a single atomic upsert rather than a read-then-write', async () => {
    findById.mockResolvedValue(doneCase);
    // Step 2 (Inter-agency Referrals) needs a referral to be done at all.
    findById.mockResolvedValue({
      id: 'c1', status: 'active', referrals: [{ agencyName: 'MSWDO' }],
    } as unknown as Case);
    await service.lock('c1', 2, swUser);
    expect(lockRepo.findOne).not.toHaveBeenCalled();
    expect(lockRepo.insertQb.insert).toHaveBeenCalled();
    expect(lockRepo.insertQb.into).toHaveBeenCalledWith(CaseStepLock);
    expect(lockRepo.insertQb.values).toHaveBeenCalledWith({
      caseId: 'c1', stepIndex: 2, lockedBy: 'u1', lockedByName: 'Juan Dela Cruz',
    });
    expect(lockRepo.insertQb.orUpdate).toHaveBeenCalledWith(
      ['locked_by', 'locked_by_name'],
      ['case_id', 'step_index'],
    );
    // locked_at is deliberately absent: overwriting it would reset the seal
    // time on every re-seal.
    expect(lockRepo.insertQb.orUpdate.mock.calls[0][0]).not.toContain('locked_at');
  });

  it('unlocks only the named step', async () => {
    findById.mockResolvedValue(doneCase);
    await service.lock('c1', 0, swUser);
    await service.unlock('c1', 0, swUser);
    expect(lockRepo.delete).toHaveBeenCalledWith({ caseId: 'c1', stepIndex: 0 });
  });

  it('rejects a step index outside 0..4', async () => {
    await expect(service.lock('c1', 7, swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', -1, swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 1.5, swUser)).rejects.toThrow(BadRequestException);
    // A bad index never reaches the case lookup.
    expect(findById).not.toHaveBeenCalled();
  });

  it('names every step so an error message cannot spell one step two ways', () => {
    expect(Object.keys(CASE_STEP_LABELS).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    for (const [index, label] of Object.entries(CASE_STEP_LABELS)) {
      expect(typeof label).toBe('string');
      expect((label as string).length).toBeGreaterThan(0);
      // The lock rejection names the step by this label, so a blank or
      // missing entry would surface as `"" is not complete yet`.
      expect(index).toMatch(/^[0-4]$/);
    }
  });

  it('records an audit entry for both a seal and a release', async () => {
    findById.mockResolvedValue(doneCase);
    await service.lock('c1', 0, swUser);
    expect(auditLog.log).toHaveBeenCalledWith('case.step_lock', 'c1', 'u1', { stepIndex: 0 });
    await service.unlock('c1', 0, swUser);
    expect(auditLog.log).toHaveBeenCalledWith('case.step_unlock', 'c1', 'u1', { stepIndex: 0 });
  });

  it('lists the sealed steps of a case in step order', async () => {
    const rows = [
      { stepIndex: 3, lockedBy: 'u2', lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
      { stepIndex: 1, lockedBy: 'u1', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
    ];
    // The stub honours the `order` the service asks for, the way Postgres
    // would: asserting the ascending result is only meaningful if the sort is
    // really the database's job and not the service quietly re-sorting.
    lockRepo.find.mockImplementation((opts: any) =>
      Promise.resolve(
        [...rows].sort((a, b) =>
          opts?.order?.stepIndex === 'ASC' ? a.stepIndex - b.stepIndex : 0,
        ),
      ),
    );
    const listed = await service.listForCase('c1');
    expect(listed).toEqual([
      { stepIndex: 1, lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
      { stepIndex: 3, lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
    ]);
    // Only the three fields the payload needs: the row id and lockedBy are
    // server-internal and must not ride along to the client.
    expect(Object.keys(listed[0]).sort()).toEqual(['lockedAt', 'lockedByName', 'stepIndex']);
    expect(lockRepo.find).toHaveBeenCalledWith({
      where: { caseId: 'c1' },
      order: { stepIndex: 'ASC' },
    });
  });

  describe('the shared step-done fixture', () => {
    // One assertion per fixture case, named, so a dropped branch is a named
    // failure rather than a single opaque boolean mismatch.
    it.each(FIXTURE)('$name', async (fx) => {
      findById.mockResolvedValue(caseFor(fx));
      interventionCount.mockResolvedValue(fx.interventionCount);
      lockRepo.create.mockImplementation((data: Partial<CaseStepLock>) => ({ ...data }));
      lockRepo.save.mockImplementation(async (row: any) => row);

      if (fx.expected) {
        await expect(service.lock('c1', fx.step, swUser)).resolves.toBeDefined();
      } else {
        await expect(service.lock('c1', fx.step, swUser)).rejects.toThrow(/not complete/i);
      }
    });

    it('covers every step the stepper offers', () => {
      expect(new Set(FIXTURE.map(f => f.step))).toEqual(new Set([0, 1, 2, 3, 4]));
    });

    // The `default:` arm of the predicate is unreachable through the five
    // stepper indexes, and the index range is validated before the predicate
    // runs. Pin that ordering, so relaxing the range check cannot turn an
    // unknown step into a silently-sealable one.
    it('rejects an out-of-range step before the predicate could answer for it', async () => {
      await expect(service.lock('c1', 5, swUser)).rejects.toThrow(BadRequestException);
      expect(findById).not.toHaveBeenCalled();
    });
  });
});
