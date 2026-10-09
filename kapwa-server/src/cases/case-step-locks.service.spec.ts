import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CaseStepLocksService, CASE_STEP_LABELS, CASE_STEP_UNGUARDED_FIELDS } from './case-step-locks.service';
import { COMMON_STEPS, CASE_STEP_FLOORS, CASE_STATUS_INDEX } from './case-step-labels';
import { CaseStepLock } from './case-step-lock.entity';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { ProgramEnrollment } from '../case-enrollments/program-enrollment.entity';
import { CaseEvent } from '../case-events/case-event.entity';
import { InterventionRequiredDocument } from './intervention-required-document.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { Program } from '../programs/program.entity';
import { ProgramRequiredDocument } from '../programs/program-required-document.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { User } from '../auth/user.entity';

interface DoneFixtureCase {
  name: string;
  step: string;
  caseData: Record<string, unknown>;
  interventionCount: number;
  enrollmentCount?: number;
  opts: {
    requirementsMet?: boolean;
    referralNotNeeded?: boolean;
    interventionNotNeeded?: boolean;
    enrollmentsNotNeeded?: boolean;
    /**
     * How many `inter_agency_referrals` rows the case has — what the referrals
     * step counts as "a referral is issued". Declared here rather than inferred
     * from `caseData.referrals` because `Case.referrals` is the *transition
     * plan's* agency list over `case_referrals`, a different table the referral
     * letter never writes; an entry that put them in `caseData` would be
     * asserting a rule the predicate no longer has.
     */
    interAgencyReferralCount?: number;
    /** How many non-cancelled `case_events` rows the court_hearings step counts. */
    courtHearingCount?: number;
  };
  /**
   * The server-facing inputs for the interventions step's requirements branch:
   * which programs the case's interventions name, what documents those programs
   * require, and the `case_requirements` rows behind the checklist.
   * `opts.requirementsMet` stays the *given* the client consumes; these fields
   * are the shape the server re-derives it from, and the two must agree — see
   * "the given and the declared inputs describe the same step".
   */
  requirements?: {
    interventionProgramIds: Array<string | null>;
    programs: Array<{ id: string; documentKeys: Array<{ key: string; mandatory: boolean }> }>;
    checklist: Record<string, boolean>;
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
 * The fixture states the progress flags in the client's `opts` form.
 * Server-side each one is a column on the case instead, so the flag is
 * rendered as the column that produces it: `requirementsMet` as a
 * `requirementsChecklist` whose entries are all met (or one that is not), and
 * the recorded decisions as their boolean columns. `caseData` is already
 * keyed on the `Case` field and getter names, so it passes through as-is.
 *
 * A case that declares `requirements` uses that case's own checklist, because
 * the flag the server reads is not the checklist but the programs behind the
 * case's interventions — a synthesized `{ 'Valid ID': … }` cannot reproduce a
 * checklist of three documents or a stray entry belonging to no program.
 */
function caseFor(fx: DoneFixtureCase): Partial<Case> {
  const { requirementsMet, referralNotNeeded, interventionNotNeeded, enrollmentsNotNeeded } = fx.opts;
  return {
    id: 'c1',
    ...fx.caseData,
    // An absent flag must leave the checklist undefined, not empty-but-met:
    // the service reads undefined as "nothing outstanding".
    ...(requirementsMet === undefined && !fx.requirements
      ? {}
      : { requirementsChecklist: fx.requirements?.checklist ?? { 'Valid ID': requirementsMet } }),
    ...(referralNotNeeded === undefined ? {} : { referralNotNeeded }),
    ...(interventionNotNeeded === undefined ? {} : { interventionNotNeeded }),
    ...(enrollmentsNotNeeded === undefined ? {} : { enrollmentsNotNeeded }),
  } as unknown as Partial<Case>;
}

/**
 * A real `Program`, loaded the way TypeORM would hand one back: the rows are
 * there and both `requiredDocuments` and `requiredDocumentDetails` are derived
 * from them, so the service cannot read a getter that the database does not
 * back. Built through the entity rather than as an object literal for exactly
 * that reason — a literal could hand the service a shape the API never sends.
 */
function programRow(id: string, documentKeys: Array<{ key: string; mandatory: boolean }>): Program {
  const program = new Program();
  program.id = id;
  program.name = id;
  program.requiredDocumentRows = documentKeys.map(({ key, mandatory }) => {
    const row = new ProgramRequiredDocument();
    row.programId = id;
    row.documentKey = key;
    row.mandatory = mandatory;
    return row;
  });
  return program;
}

describe('CaseStepLocksService', () => {
  let service: CaseStepLocksService;
  let casesService: CasesService;
  let lockRepo: any;
  let programRepo: { find: jest.Mock };
  let interventionRepo: { query: jest.Mock };
  let enrollmentRepo: { count: jest.Mock };
  let caseEventRepo: { count: jest.Mock };
  let interventionDocsRepo: { find: jest.Mock };
  let auditLog: { log: jest.Mock };

  const swUser = {
    id: 'u1', role: 'social_worker', agencyId: null,
    firstName: 'Juan', middleName: 'Dela', lastName: 'Cruz', nameExtension: null,
  } as unknown as User;
  const otherSwUser = {
    id: 'u2', role: 'social_worker', agencyId: null,
    firstName: 'Lorna', middleName: 'B.', lastName: 'Santos', nameExtension: null,
  } as unknown as User;

  // The assessment step is done only when problemsPresented,
  // socialWorkerAssessment, clientCategory and caseCategory are all set, so an
  // empty case is the cheapest way to make a step not-done.
  const notDoneCase = { id: 'c1', status: 'enrolled' } as unknown as Case;
  const doneCase = {
    id: 'c1', status: 'enrolled',
    problemsPresented: 'a', clientCategory: 'b', socialWorkerAssessment: 'c', caseCategory: 'd',
  } as unknown as Case;

  const findById = jest.fn();
  const interventionCount = jest.fn().mockResolvedValue(0);
  // The `inter_agency_referrals` count the referrals step reads. Stubbed on the
  // repository rather than the case, because the rows live in their own table —
  // a stub that answered off `findById` would let a predicate reading
  // `case.referrals` pass.
  const referralCount = jest.fn().mockResolvedValue(0);
  // The interventions-step requirement inputs: which programs the case's
  // interventions name, and what those programs require. Both default to "no
  // program imposes anything", which is what an intervention with a null
  // `program_id` looks like — the client reads that as nothing outstanding too.
  const interventionQuery = jest.fn().mockResolvedValue([]);
  const programFind = jest.fn().mockResolvedValue([]);
  // The program_enrollments count the enrollments step reads.
  const enrollmentCount = jest.fn().mockResolvedValue(0);
  // The non-cancelled case_events count the court_hearings step reads.
  const courtHearingCount = jest.fn().mockResolvedValue(0);
  // The intervention-anchored documentary minimums the interventions step
  // reads in crisis mode.
  const interventionDocsFind = jest.fn().mockResolvedValue([]);

  /**
   * Stand in for the two queries the interventions step makes against the
   * case's programs. A fixture case that declares no `requirements` falls back
   * to "no program imposes anything", so a case that never had programs keeps
   * its meaning without having to declare a program to say so.
   */
  const stubRequirementInputs = (fx: DoneFixtureCase) => {
    const req = fx.requirements;
    interventionQuery.mockResolvedValue(
      (req?.interventionProgramIds ?? []).map((program_id) => ({ program_id })),
    );
    programFind.mockResolvedValue((req?.programs ?? []).map((p) => programRow(p.id, p.documentKeys)));
  };

  /**
   * The referrals step's inputs. An absent `interAgencyReferralCount` means zero
   * referrals, which is also what the stub's own default says — so an entry
   * that forgets to declare a referral is asserting "none issued", which is
   * what it means.
   */
  const stubReferralInputs = (fx: DoneFixtureCase) => {
    referralCount.mockResolvedValue(fx.opts.interAgencyReferralCount ?? 0);
  };

  /** The interventions step on an enrolled case: floor 0, so the checklist decides. */
  const stepInterventionsCase = (checklist: Record<string, boolean> | undefined) =>
    ({ id: 'c1', status: 'enrolled', requirementsChecklist: checklist } as unknown as Case);

  beforeEach(async () => {
    jest.clearAllMocks();
    findById.mockResolvedValue(notDoneCase);
    interventionCount.mockResolvedValue(0);
    referralCount.mockResolvedValue(0);
    enrollmentCount.mockResolvedValue(0);
    interventionQuery.mockResolvedValue([]);
    programFind.mockResolvedValue([]);
    interventionRepo = { query: interventionQuery };
    programRepo = { find: programFind };
    enrollmentRepo = { count: enrollmentCount };
    caseEventRepo = { count: courtHearingCount };
    interventionDocsRepo = { find: interventionDocsFind };
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
            step_key: v.stepKey,
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
    const referralRepo = { count: referralCount };

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
        { provide: getRepositoryToken(Program), useValue: programRepo },
        { provide: getRepositoryToken(CaseIntervention), useValue: interventionRepo },
        { provide: getRepositoryToken(ProgramEnrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(InterAgencyReferral), useValue: referralRepo },
        { provide: getRepositoryToken(CaseEvent), useValue: caseEventRepo },
        { provide: getRepositoryToken(InterventionRequiredDocument), useValue: interventionDocsRepo },
      ],
    }).compile();

    casesService = module.get<CasesService>(CasesService);
    service = module.get<CaseStepLocksService>(CaseStepLocksService);

    jest.spyOn(casesService, 'findById').mockImplementation(findById as any);
    jest.spyOn(casesService, 'getInterventionCount' as any).mockImplementation(interventionCount as any);
  });

  it('rejects locking a step that is not done, naming the predicate', async () => {
    findById.mockResolvedValue(notDoneCase);
    await expect(service.lock('c1', 'assessment', swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 'assessment', swUser)).rejects.toThrow(/not complete/i);
    // The rejection happens before any write.
    expect(lockRepo.save).not.toHaveBeenCalled();
    expect(lockRepo.insertQb.execute).not.toHaveBeenCalled();
  });

  it('names the lifecycle floor, not the work, when a recorded hearing is sealed below review', async () => {
    // Everything this step asks for is on file — one non-cancelled hearing — so
    // the only thing refusing the seal is the case's position. Calling that
    // "not complete yet" sends the worker back to work they already did; the
    // message has to name the status the case must reach.
    findById.mockResolvedValue({
      id: 'c1',
      status: 'assessed',
      caseCategory: 'Children in Conflict with the Law (CICL)',
    } as unknown as Case);
    courtHearingCount.mockResolvedValue(1);

    await expect(service.lock('c1', 'court_hearings', swUser)).rejects.toThrow(/reaches in_review/i);
    // Still refused before any write.
    expect(lockRepo.insertQb.execute).not.toHaveBeenCalled();
  });

  it('seals a recorded hearing while the case is still in review', async () => {
    // The prod case: a legal case can have a hearing on file before the admin
    // activates it, and only `admin` may take `in_review -> active`
    // (`CASE_FSM_ROLES[IN_REVIEW]` is empty). Refusing the seal there parked the
    // worker's Lock behind an action they could not take.
    findById.mockResolvedValue({
      id: 'c1',
      status: 'in_review',
      caseCategory: 'Children in Conflict with the Law (CICL)',
    } as unknown as Case);
    courtHearingCount.mockResolvedValue(1);

    const saved = await service.lock('c1', 'court_hearings', swUser);
    expect(saved.stepKey).toBe('court_hearings');
  });

  it('locks a done step and snapshots the locker name', async () => {
    findById.mockResolvedValue(doneCase);
    const saved = await service.lock('c1', 'assessment', swUser);
    expect(saved.stepKey).toBe('assessment');
    expect(saved.lockedBy).toBe('u1');
    expect(saved.lockedByName).toBe('Juan Dela Cruz');
  });

  it('is idempotent when the same step is locked twice', async () => {
    findById.mockResolvedValue(doneCase);
    const first = await service.lock('c1', 'assessment', swUser);
    const again = await service.lock('c1', 'assessment', otherSwUser);
    expect(again.lockedByName).toBe('Lorna B. Santos');
    expect(again.lockedBy).toBe('u2');
    expect(again.stepKey).toBe('assessment');
    // A second seal of the same step is one upsert, not an insert that would
    // violate uq_case_step_locks_case_step_key.
    expect(lockRepo.insertQb.execute).toHaveBeenCalledTimes(2);
    expect(lockRepo.save).not.toHaveBeenCalled();
    expect(first).toBeDefined();
  });

  // The old implementation was findOne-then-save, so two concurrent POSTs both
  // saw null and both inserted. Pin the atomic form: one upsert, conflicting on
  // the (case, step) unique key, and the seal timestamp left alone so the row
  // keeps the moment of the *first* seal.
  it('seals with a single atomic upsert rather than a read-then-write', async () => {
    findById.mockResolvedValue({ id: 'c1', status: 'active' } as unknown as Case);
    // The referrals step needs a referral to be done at all, and a referral is
    // an `inter_agency_referrals` row.
    referralCount.mockResolvedValue(1);
    await service.lock('c1', 'referrals', swUser);
    expect(lockRepo.findOne).not.toHaveBeenCalled();
    expect(lockRepo.insertQb.insert).toHaveBeenCalled();
    expect(lockRepo.insertQb.into).toHaveBeenCalledWith(CaseStepLock);
    expect(lockRepo.insertQb.values).toHaveBeenCalledWith({
      caseId: 'c1', stepKey: 'referrals', lockedBy: 'u1', lockedByName: 'Juan Dela Cruz',
    });
    expect(lockRepo.insertQb.orUpdate).toHaveBeenCalledWith(
      ['locked_by', 'locked_by_name'],
      ['case_id', 'step_key'],
    );
    // locked_at is deliberately absent: overwriting it would reset the seal
    // time on every re-seal.
    expect(lockRepo.insertQb.orUpdate.mock.calls[0][0]).not.toContain('locked_at');
  });

  it('unlocks only the named step', async () => {
    findById.mockResolvedValue(doneCase);
    await service.lock('c1', 'assessment', swUser);
    await service.unlock('c1', 'assessment', swUser);
    expect(lockRepo.delete).toHaveBeenCalledWith({ caseId: 'c1', stepKey: 'assessment' });
  });

  /**
   * A release is one `DELETE ... WHERE case_id = ? AND step_key = ?`, so a
   * concurrent seal cannot be undone by a read that saw the old state — and a
   * concurrent release cannot be lost by two callers both deciding to proceed.
   * A read-then-delete would reintroduce both. This is the same reasoning as
   * `lock`'s upsert, and it is why neither method reads the row it writes.
   */
  it('releases in one statement, never reading the row it deletes', async () => {
    await service.unlock('c1', 'closure', swUser);

    expect(lockRepo.delete).toHaveBeenCalledTimes(1);
    expect(lockRepo.delete).toHaveBeenCalledWith({ caseId: 'c1', stepKey: 'closure' });
    expect(lockRepo.findOne).not.toHaveBeenCalled();
    expect(lockRepo.find).not.toHaveBeenCalled();
  });

  it('rejects an unknown step key', async () => {
    await expect(service.lock('c1', '7', swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 'not-a-step', swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', '', swUser)).rejects.toThrow(BadRequestException);
    // A bad key never reaches the case lookup.
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects a step that is not part of the case template', async () => {
    // A common-template case (no category) has no discernment step.
    findById.mockResolvedValue(notDoneCase);
    await expect(service.lock('c1', 'discernment', swUser)).rejects.toThrow(BadRequestException);
    await expect(service.lock('c1', 'discernment', swUser)).rejects.toThrow(/template/i);
  });

  it('names every step so an error message cannot spell one step two ways', () => {
    expect(Object.keys(CASE_STEP_LABELS).sort()).toEqual(
      ['adoption', 'assessment', 'closure', 'court_hearings', 'discernment', 'enrollments', 'evaluate',
        'interventions', 'protection_order', 'referrals', 'solo_parent'],
    );
    for (const [key, label] of Object.entries(CASE_STEP_LABELS)) {
      expect(typeof label).toBe('string');
      expect((label as string).length).toBeGreaterThan(0);
      // The lock rejection names the step by this label, so a blank or
      // missing entry would surface as `"" is not complete yet`.
      expect(key).toMatch(/^[a-z_]+$/);
    }
  });

  it('records an audit entry for both a seal and a release', async () => {
    findById.mockResolvedValue(doneCase);
    await service.lock('c1', 'assessment', swUser);
    expect(auditLog.log).toHaveBeenCalledWith('case.step_lock', 'c1', 'u1', { stepKey: 'assessment' });
    await service.unlock('c1', 'assessment', swUser);
    expect(auditLog.log).toHaveBeenCalledWith('case.step_unlock', 'c1', 'u1', { stepKey: 'assessment' });
  });

  describe('assertUnsealed', () => {
    it('passes when the step carries no seal', async () => {
      lockRepo.findOne.mockResolvedValue(null);

      await expect(service.assertUnsealed('c1', 'assessment')).resolves.toBeUndefined();
    });

    it('refuses when the step is sealed, naming the step and who sealed it', async () => {
      lockRepo.findOne.mockResolvedValue({
        caseId: 'c1', stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-01'),
      });

      await expect(service.assertUnsealed('c1', 'assessment')).rejects.toThrow(ConflictException);
      // The message has to name the step *and* say how to proceed, or a worker
      // who needs to correct a sealed step is simply stuck.
      await expect(service.assertUnsealed('c1', 'assessment')).rejects.toThrow(/Assess & Interview/);
      await expect(service.assertUnsealed('c1', 'assessment')).rejects.toThrow(/Juan Dela Cruz/);
      await expect(service.assertUnsealed('c1', 'assessment')).rejects.toThrow(/release the seal/i);
    });

    // The refusal must be about *this* step. A `findOne` that ignored its where
    // clause would pass the test above and refuse an edit to a step that was
    // never sealed.
    it('asks about the named step only', async () => {
      lockRepo.findOne.mockResolvedValue(null);

      await service.assertUnsealed('c1', 'closure');

      expect(lockRepo.findOne).toHaveBeenCalledWith({ where: { caseId: 'c1', stepKey: 'closure' } });
    });

    // Not a fast path: the whole point is that the client cannot be trusted to
    // have asked, and a cache would answer "unsealed" for a step sealed since.
    it('re-reads the seal on every call rather than caching', async () => {
      lockRepo.findOne.mockResolvedValue(null);
      await service.assertUnsealed('c1', 'assessment');

      lockRepo.findOne.mockResolvedValue({ caseId: 'c1', stepKey: 'assessment', lockedByName: 'Lorna', lockedAt: new Date() });
      await expect(service.assertUnsealed('c1', 'assessment')).rejects.toThrow(ConflictException);

      expect(lockRepo.findOne).toHaveBeenCalledTimes(2);
    });

    /**
     * The unguarded-fields exemption.
     *
     * A seal claims the *step's own data* is finished. One route carries that
     * plus data the seal never claimed — `PATCH /cases/:id/transition-plan`
     * writes the `evaluate` step's self-reliance assessment and the case's
     * follow-up / home visits, which are ongoing monitoring in no step's
     * done-predicate. Guarding the route would mean a worker who sealed the
     * assessment could never record another home visit, which is the
     * `StepTransition` mount comment's warning taken as fact.
     *
     * So the guard judges *the keys the body carries*, and this is where that
     * rule is pinned. The step key and the exemption live in one file
     * (`case-step-labels.ts`) precisely so the guard here and the comment at
     * the mount cannot disagree about which step owns what.
     */
    describe('bodies that change nothing the seal guards', () => {
      const VISITS = [{ date: '2026-10-01', type: 'Home Visit', notes: '', outcome: '' }];
      const sealedEvaluate = () =>
        lockRepo.findOne.mockResolvedValue({
          caseId: 'c1', stepKey: 'evaluate', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-01'),
        });

      it('lets a visits-only body past a sealed evaluate step', async () => {
        sealedEvaluate();

        await expect(service.assertUnsealed('c1', 'evaluate', { followUpVisits: VISITS })).resolves.toBeUndefined();
        // It never even asks: a body that cannot change the sealed step does not
        // need to know whether it is sealed.
        expect(lockRepo.findOne).not.toHaveBeenCalled();
      });

      it('still refuses a body that also moves the assessment', async () => {
        sealedEvaluate();

        await expect(
          service.assertUnsealed('c1', 'evaluate', { followUpVisits: VISITS, sustainabilityPlan: 'new plan' }),
        ).rejects.toThrow(ConflictException);
      });

      it('refuses an assessment-only body', async () => {
        sealedEvaluate();

        await expect(
          service.assertUnsealed('c1', 'evaluate', { selfRelianceLevel: 3 }),
        ).rejects.toThrow(ConflictException);
      });

      // An unsealed step takes anything, exemption or not.
      it('is not consulted when the step carries no seal', async () => {
        lockRepo.findOne.mockResolvedValue(null);

        await expect(
          service.assertUnsealed('c1', 'evaluate', { selfRelianceLevel: 3, followUpVisits: VISITS }),
        ).resolves.toBeUndefined();
        expect(lockRepo.findOne).toHaveBeenCalled();
      });

      // Every other step guards its whole route: their bodies carry nothing but
      // their own data, so an exemption there would be an unexplained hole.
      it.each(['assessment', 'enrollments', 'interventions', 'referrals', 'discernment', 'protection_order', 'solo_parent', 'adoption', 'court_hearings', 'closure'])(
        'guards step %s even for a visits-only body', async (step) => {
          lockRepo.findOne.mockResolvedValue({
            caseId: 'c1', stepKey: step, lockedByName: 'Ana', lockedAt: new Date(),
          });

          await expect(service.assertUnsealed('c1', step, { followUpVisits: VISITS })).rejects.toThrow(ConflictException);
        });

      // Three shapes that fail closed rather than open. Each is a shape Zod has
      // already rejected by the time the guard runs, so none is reachable in
      // production — and a guard is exactly the place where "shouldn't happen"
      // must resolve to the safe answer.
      it.each([
        ['an absent body', undefined],
        ['an empty body', {}],
        ['a null body', null],
        ['an array body', VISITS],
        ['a string body', 'followUpVisits=[]'],
      ])('refuses %s', async (_name, body) => {
        lockRepo.findOne.mockResolvedValue({
          caseId: 'c1', stepKey: 'evaluate', lockedByName: 'Ana', lockedAt: new Date(),
        });

        await expect(service.assertUnsealed('c1', 'evaluate', body)).rejects.toThrow(ConflictException);
      });

      // The declaration itself, so the two files cannot drift.
      it('declares the exemption for the evaluate step only, and names the visit fields', () => {
        expect(Object.keys(CASE_STEP_UNGUARDED_FIELDS)).toEqual(['evaluate']);
        expect(CASE_STEP_UNGUARDED_FIELDS.evaluate).toEqual(['followUpVisits', 'followUpDate']);
      });
    });

    // An unknown key is the same 400 the seal endpoint raises, so a route
    // wired to a wrong step key is a loud failure rather than a silent
    // "nothing to check".
    it('rejects an unknown step before it looks anything up', async () => {
      await expect(service.assertUnsealed('c1', 'nope')).rejects.toThrow(BadRequestException);
      expect(lockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('isSealed', () => {
    it('answers false when the step carries no seal', async () => {
      lockRepo.findOne.mockResolvedValue(null);

      await expect(service.isSealed('c1', 'interventions')).resolves.toBe(false);
    });

    it('answers true when the step is sealed', async () => {
      lockRepo.findOne.mockResolvedValue({ caseId: 'c1', stepKey: 'interventions', lockedByName: 'Ana', lockedAt: new Date() });

      await expect(service.isSealed('c1', 'interventions')).resolves.toBe(true);
    });

    it('asks about the named case and step only', async () => {
      lockRepo.findOne.mockResolvedValue(null);

      await service.isSealed('c9', 'interventions');

      expect(lockRepo.findOne).toHaveBeenCalledWith({ where: { caseId: 'c9', stepKey: 'interventions' } });
    });

    it('rejects an unknown step rather than reporting unsealed', async () => {
      await expect(service.isSealed('c1', 'nope')).rejects.toThrow(BadRequestException);
      expect(lockRepo.findOne).not.toHaveBeenCalled();
    });
  });

  it('lists the sealed steps of a case in template order', async () => {
    const rows = [
      { stepKey: 'evaluate', lockedBy: 'u2', lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
      { stepKey: 'interventions', lockedBy: 'u1', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
    ];
    lockRepo.find.mockResolvedValue(rows);
    findById.mockResolvedValue({ id: 'c1', status: 'active', caseCategory: null } as unknown as Case);

    const listed = await service.listForCase('c1');
    expect(listed).toEqual([
      { stepKey: 'interventions', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
      { stepKey: 'evaluate', lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
    ]);
    // Only the three fields the payload needs: the row id and lockedBy are
    // server-internal and must not ride along to the client.
    expect(Object.keys(listed[0]).sort()).toEqual(['lockedAt', 'lockedByName', 'stepKey']);
    // The order is the template's, not a database sort: step keys do not sort
    // lexically in template order.
    expect(lockRepo.find).toHaveBeenCalledWith({ where: { caseId: 'c1' } });
  });

  describe('the required documents behind the case’s programs', () => {
    // The client's `interventionRequirementsMet` iterates the *programs'* keys;
    // an earlier server copy iterated the *checklist's* keys instead, so the two
    // surfaces could disagree in the one direction that matters — a program
    // document that never became a checklist row is invisible to a
    // checklist-keyed walk, so the server answered "met" on a case the UI
    // refused to seal. Every test here states one direction of that gap.
    beforeEach(() => {
      interventionCount.mockResolvedValue(1);
    });

    // The dangerous direction: the checklist is entirely met, but the program
    // requires a document nobody ever recorded. The UI keeps Lock disabled; the
    // server must refuse too, or the seal lands on a case that was never ready.
    it('refuses to seal when a program requires a document the checklist never got', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([
        programRow('p1', [
          { key: 'Valid ID', mandatory: true },
          { key: 'Barangay Certificate', mandatory: true },
        ]),
      ]);

      await expect(service.lock('c1', 'interventions', swUser)).rejects.toThrow(/not complete/i);
    });

    // The same case with the missing document recorded as met: now both
    // surfaces agree, and the seal must go through.
    it('seals once every document the programs require is on the checklist', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true, 'Barangay Certificate': true }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([
        programRow('p1', [
          { key: 'Valid ID', mandatory: true },
          { key: 'Barangay Certificate', mandatory: true },
        ]),
      ]);

      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    // The fail-safe direction, and the mirror of the case above: a checklist row
    // belonging to no program of this case. The client weighs only program keys
    // and ignores it, so an unmet stray cannot hold a step hostage — the server
    // used to weigh it and refuse a seal the UI happily offers.
    it('ignores an unmet checklist entry that belongs to no program of the case', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true, 'Medical Abstract': false }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([programRow('p1', [{ key: 'Valid ID', mandatory: true }])]);

      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    // The empty case: no program imposes anything, so an unmet checklist row is
    // not outstanding against any of them. Matches the client, which answers
    // from `requiredKeys.length === 0` before it ever looks at the checklist.
    it('treats a case whose interventions name no program as imposing nothing', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': false }));
      interventionQuery.mockResolvedValue([{ program_id: null }]);

      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
      // Nothing to weigh, so the programs are never loaded.
      expect(programFind).not.toHaveBeenCalled();
    });

    // A program with no required documents imposes nothing either, and the
    // checklist is not consulted for it — the client's `requiredKeys` is empty
    // across the whole case and it returns before reading the checklist.
    it('treats a linked program that requires nothing as imposing nothing', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': false }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([programRow('p1', [])]);

      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    // `mandatory` is display-only: a conditional document ("… if applicable")
    // counts exactly like any other. The client states this explicitly, so a
    // server that relaxed on the flag would disagree with it on every program
    // that carries one.
    it('requires a document the program flags as non-mandatory', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([
        programRow('p1', [
          { key: 'Valid ID', mandatory: true },
          { key: 'Death certificate (if applicable)', mandatory: false },
        ]),
      ]);

      await expect(service.lock('c1', 'interventions', swUser)).rejects.toThrow(/not complete/i);
    });

    // Only the programs behind *this* case's interventions count, and the keys
    // are de-duplicated across them, so a document two programs share is one
    // requirement — the client's `[...new Set(...)]` over the flatMap.
    it('weighs only the linked programs, counting a shared document once', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }, { program_id: 'p1' }]);
      programFind.mockImplementation(({ where }: any) =>
        Promise.resolve(
          [
            programRow('p1', [{ key: 'Valid ID', mandatory: true }]),
            // Not linked to this case: a second program that shares the key.
            programRow('p2', [{ key: 'Valid ID', mandatory: true }, { key: 'Solo form', mandatory: true }]),
          ].filter((p) => {
            const ids = where.id._value ?? where.id;
            return (Array.isArray(ids) ? ids : [ids]).includes(p.id);
          }),
        ),
      );

      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    // The programs come off `case_interventions`, the table
    // `getInterventionCount` already reads — one parameterized query, the same
    // conventions, so the two cannot drift onto different rows.
    it('reads the programs off case_interventions the way the count does', async () => {
      findById.mockResolvedValue(stepInterventionsCase({ 'Valid ID': true }));
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([programRow('p1', [{ key: 'Valid ID', mandatory: true }])]);

      await service.lock('c1', 'interventions', swUser);
      expect(interventionQuery).toHaveBeenCalledWith(
        expect.stringContaining('case_interventions'),
        ['c1'],
      );
    });

    // Steps other than interventions never read the checklist, so they must not
    // pay for the two program queries either.
    it('loads no program for a step that does not weigh requirements', async () => {
      findById.mockResolvedValue(doneCase);

      await service.lock('c1', 'assessment', swUser);
      expect(interventionQuery).not.toHaveBeenCalled();
      expect(programFind).not.toHaveBeenCalled();
    });

    // The enrollments count is only for the enrollments step.
    it('loads no enrollment count for a step that does not weigh enrollments', async () => {
      findById.mockResolvedValue(doneCase);

      await service.lock('c1', 'assessment', swUser);
      expect(enrollmentCount).not.toHaveBeenCalled();
    });

    it('loads the enrollment count for the enrollments step', async () => {
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled' } as unknown as Case);
      enrollmentCount.mockResolvedValue(1);

      await expect(service.lock('c1', 'enrollments', swUser)).resolves.toBeDefined();
      expect(enrollmentCount).toHaveBeenCalledWith({ where: { caseId: 'c1' } });
    });
  });

  describe('the shared step-done fixture', () => {
    // One assertion per fixture case, named, so a dropped branch is a named
    // failure rather than a single opaque boolean mismatch.
    it.each(FIXTURE)('$name', async (fx) => {
      findById.mockResolvedValue(caseFor(fx));
      interventionCount.mockResolvedValue(fx.interventionCount);
      enrollmentCount.mockResolvedValue(fx.enrollmentCount ?? 0);
      courtHearingCount.mockResolvedValue(fx.opts.courtHearingCount ?? 0);
      stubRequirementInputs(fx);
      stubReferralInputs(fx);
      lockRepo.create.mockImplementation((data: Partial<CaseStepLock>) => ({ ...data }));
      lockRepo.save.mockImplementation(async (row: any) => row);

      if (fx.expected) {
        await expect(service.lock('c1', fx.step, swUser)).resolves.toBeDefined();
      } else {
        // Two refusals wear one boolean. A step floored above the case's status
        // is refused for the case's *position* and the message names the status
        // it must reach; only a step that is due and short of data is told to
        // "finish". Assert the branch this fixture case actually takes.
        const c = caseFor(fx);
        const floor = CASE_STEP_FLOORS[fx.step] ?? 0;
        const index = c.status == null ? undefined : CASE_STATUS_INDEX[c.status];
        const floored = index !== undefined && index < floor;
        await expect(service.lock('c1', fx.step, swUser)).rejects.toThrow(
          floored ? /opens once the case reaches/i : /not complete/i,
        );
      }
    });

    it('covers every step the common template offers', () => {
      expect(new Set(FIXTURE.map(f => f.step))).toEqual(new Set([...COMMON_STEPS, 'court_hearings']));
    });

    /**
     * A fixture entry that declares `requirements` describes the same step twice:
     * `opts.requirementsMet` is the given the client's suite consumes, and
     * `requirements` is the program-and-checklist shape this suite re-derives it
     * from. Both are hand-written, so they can drift — and each suite only ever
     * sees its own half, so a drifted entry passes both.
     *
     * The two halves are tied together here instead. Once an intervention
     * exists, the interventions step's first clause (`interventionCount > 0 ||
     * interventionNotNeeded`) is already true whatever the no-intervention
     * decision says, so the step's verdict is exactly `requirementsMet ?? true` —
     * the same value the branch itself computes, which is why the filter below
     * keys on `interventionCount > 0` alone and needs nothing about
     * `interventionNotNeeded`. `expected` and the given are therefore the same
     * statement about the case, and the `it.each` above already proves this
     * suite's answer follows the *declared* inputs. Asserted on the pair, an
     * entry whose halves disagree fails in one place with both visible.
     */
    it.each(FIXTURE.filter((fx) => fx.requirements && fx.interventionCount > 0))(
      '$name — the given agrees with the declared inputs',
      (fx) => {
        // `?? true` rather than the raw flag, mirroring stepDone's own
        // `opts.requirementsMet ?? true`: an entry that omits the flag is not
        // asserting `false`, it is asserting the branch's default.
        expect(fx.opts.requirementsMet ?? true).toBe(fx.expected);
        // An entry that answers "not met" has to actually name a document the
        // checklist does not satisfy, or it is not testing the branch it claims
        // to. The "imposes nothing" entries legitimately name no document at
        // all — the empty-set branch is what they are for.
        if (!fx.expected) {
          const requiredKeys = new Set(
            (fx.requirements?.programs ?? []).flatMap((p) => p.documentKeys.map((d) => d.key)),
          );
          expect([...requiredKeys].some((k) => fx.requirements?.checklist[k] !== true)).toBe(true);
        }
      },
    );

    /**
     * The justification for the `it.each` filter above, as an executable claim
     * rather than a comment: with an intervention on the case, the recorded
     * no-intervention decision cannot rescue the interventions step, because
     * the first clause of the branch is already satisfied. So an entry carrying
     * `interventionNotNeeded: true` alongside `interventionCount: 1` still has
     * to follow `requirementsMet`, and excluding such entries from the filter
     * would quietly skip checking them rather than protect them.
     */
    it('still weighs requirements when a no-intervention decision is also recorded', async () => {
      findById.mockResolvedValue({
        id: 'c1', status: 'enrolled', interventionNotNeeded: true,
        requirementsChecklist: { 'Valid ID': false },
      } as unknown as Case);
      interventionCount.mockResolvedValue(1);
      interventionQuery.mockResolvedValue([{ program_id: 'p1' }]);
      programFind.mockResolvedValue([programRow('p1', [{ key: 'Valid ID', mandatory: true }])]);

      // The decision does not buy the step its way past an unmet document.
      await expect(service.lock('c1', 'interventions', swUser)).rejects.toThrow(/not complete/i);

      // …and once the document is met, the step is done and the decision is
      // simply redundant rather than contradictory.
      findById.mockResolvedValue({
        id: 'c1', status: 'enrolled', interventionNotNeeded: true,
        requirementsChecklist: { 'Valid ID': true },
      } as unknown as Case);
      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    // The `default:` arm of the predicate is unreachable through the common
    // template keys, and the key range is validated before the predicate runs.
    // Pin that ordering, so relaxing the range check cannot turn an unknown
    // step into a silently-sealable one.
    it('rejects an unknown step before the predicate could answer for it', async () => {
      await expect(service.lock('c1', 'bogus', swUser)).rejects.toThrow(BadRequestException);
      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe('crisis-mode requirements', () => {
    it('requires intervention-anchored documents for ad-hoc services in crisis mode', async () => {
      // An ad-hoc medical_assistance in crisis mode must have its documents met.
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled', crisisMode: true });
      interventionCount.mockResolvedValue(1);
      // The intervention has no program → no program documents.
      interventionQuery.mockResolvedValue([{ intervention_type: 'medical_assistance' }]);
      // But intervention_required_documents has medical_assistance → medical_certificate.
      interventionDocsFind.mockResolvedValue([{ interventionType: 'medical_assistance', documentKey: 'medical_certificate' }]);
      // The checklist does not have it → requirementsMet = false → seal refused.
      await expect(service.lock('c1', 'interventions', swUser)).rejects.toThrow(/not complete/i);
    });

    it('does not require intervention documents when crisis mode is off', async () => {
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled', crisisMode: false });
      interventionCount.mockResolvedValue(1);
      interventionQuery.mockResolvedValue([{ intervention_type: 'medical_assistance' }]);
      interventionDocsFind.mockResolvedValue([{ interventionType: 'medical_assistance', documentKey: 'medical_certificate' }]);
      // No program documents, no intervention documents (crisis off) → seal allowed.
      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });

    it('allows the seal when intervention documents are met in crisis mode', async () => {
      findById.mockResolvedValue({ id: 'c1', status: 'enrolled', crisisMode: true, requirementsChecklist: { medical_certificate: true } });
      interventionCount.mockResolvedValue(1);
      interventionQuery.mockResolvedValue([{ intervention_type: 'medical_assistance' }]);
      interventionDocsFind.mockResolvedValue([{ interventionType: 'medical_assistance', documentKey: 'medical_certificate' }]);
      await expect(service.lock('c1', 'interventions', swUser)).resolves.toBeDefined();
    });
  });
});