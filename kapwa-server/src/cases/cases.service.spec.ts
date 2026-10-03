import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { CaseAssistance } from './case-assistance.entity';
import { CaseStepLock } from './case-step-lock.entity';
import { canTransition } from './case-fsm';

describe('CasesService', () => {
  let service: CasesService;
  let repoMock: any;
  let historyRepoMock: any;
  let familyRepoMock: any;
  let bcRepoMock: any;
  let stepLocksRepoMock: any;
  let notifMock: any;

  beforeEach(async () => {
    const queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        })),
      },
    };

    notifMock = {
      notifyCaseUpdate: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({}),
    };

    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
        query: jest.fn().mockResolvedValue([]),
      },
    };

    familyRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };

    historyRepoMock = {
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };

    bcRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
    };

    // findById attaches the sealed steps, so a case with no seals is the default.
    stepLocksRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
        { provide: getRepositoryToken(CaseHistory), useValue: historyRepoMock },
        { provide: getRepositoryToken(HouseholdMembership), useValue: familyRepoMock },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: bcRepoMock },
        { provide: getRepositoryToken(CaseStepLock), useValue: stepLocksRepoMock },
        { provide: NotificationsService, useValue: notifMock },
        { provide: CasesExportService, useValue: { missingRequiredDocuments: jest.fn().mockResolvedValue([]), issueCoe: jest.fn(), issuePcv: jest.fn() } },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateControlNo', () => {
    it('takes the next value from the atomic per-year counter', async () => {
      repoMock.manager.query = jest.fn().mockResolvedValue([{ last_seq: 47 }]);
      const year = new Date().getFullYear();
      await expect(service.generateControlNo()).resolves.toBe(`KAPWA-${year}-00047`);
      const [sql, params] = repoMock.manager.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO case_control_counters/);
      expect(sql).toMatch(/ON CONFLICT \(year\) DO UPDATE/);
      expect(params).toEqual([year]);
    });

    it('falls back to 1 when the counter returns no row', async () => {
      repoMock.manager.query = jest.fn().mockResolvedValue([]);
      const year = new Date().getFullYear();
      await expect(service.generateControlNo()).resolves.toBe(`KAPWA-${year}-00001`);
    });
  });

  describe('approval document gate', () => {
    it('blocks in_review -> active when required documents are missing', async () => {
      const c = {
        id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001',
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      (service as any).getInterventionCount = jest.fn().mockResolvedValue(1);
      (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue(['Valid ID']) };

      await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1'))
        .rejects.toThrow(/missing required document/i);
    });

    it('allows in_review -> active when no documents are required', async () => {
      const c = {
        id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001',
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      repoMock.save.mockImplementation(async (x: any) => x);
      (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue([]) };
      (service as any).getInterventionCount = jest.fn().mockResolvedValue(1);

      await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1')).resolves.toBeTruthy();
    });

    /**
     * The `interventionNotNeeded` arm of the same gate.
     *
     * "No intervention is issued — record at least one referral" was checked
     * against `c.referrals`, the transition plan's agency list. A case that
     * referred its client by endorsement letter holds no row there, so this arm
     * refused exactly the cases it exists to admit, and — once step 3's predicate
     * was corrected — left one rule with two surfaces reading two different
     * tables. Stubbed through the query for the same reason as the transition gate
     * below: the case object carries no trace of a real referral.
     */
    describe('the interventionNotNeeded arm', () => {
      const referralOnlyCase = (over: Record<string, unknown> = {}) => ({
        id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001',
        interventionNotNeeded: true, referralNotNeeded: false,
        // Empty, and empty on purpose.
        referrals: [],
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
        ...over,
      } as unknown as Case);

      const withReferral = (n = 1) =>
        repoMock.query.mockImplementation(async (sql: string) => {
          if (sql.includes('inter_agency_referrals')) return [{ count: n }];
          if (sql.includes('case_interventions')) return [{ count: 0 }];
          return [];
        });

      beforeEach(() => {
        repoMock.save.mockImplementation(async (x: any) => x);
        (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue([]) };
        (service as any).getInterventionCount = jest.fn().mockResolvedValue(0);
      });

      it('activates a referral-only case whose endorsement letter is on record', async () => {
        repoMock.findOne.mockResolvedValue(referralOnlyCase());
        withReferral();

        await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1')).resolves.toBeTruthy();
      });

      it('still refuses a referral-only case with no referral on record', async () => {
        repoMock.findOne.mockResolvedValue(referralOnlyCase());
        withReferral(0);

        await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1'))
          .rejects.toThrow(/at least one referral/i);
      });

      it('does not accept a case_referrals row as the referral', async () => {
        repoMock.findOne.mockResolvedValue(
          referralOnlyCase({ referrals: [{ agencyName: 'RHU', status: 'referred' }] }),
        );
        withReferral(0);

        await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'admin', 'u1'))
          .rejects.toThrow(/at least one referral/i);
      });
    });
  });

  describe('issueDocument', () => {
    it('delegates to the export service for an active case', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', updatedAt: new Date() } as unknown as Case);
      (service as any).casesExport = { issueCoe: jest.fn().mockResolvedValue('/filing/x/download') };
      await expect(service.issueDocument('1', 'coe', 'u1')).resolves.toEqual({ url: '/filing/x/download' });
    });

    it('rejects before the case is active', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-2026-00001', updatedAt: new Date() } as unknown as Case);
      await expect(service.issueDocument('1', 'coe', 'u1')).rejects.toThrow(/active/i);
    });
  });

  describe('referral decision gate', () => {
    /**
     * A referral the count sees, stubbed through the *query* rather than on the
     * case object.
     *
     * That is the point of these tests. The gate used to read `c.referrals`, the
     * @Expose() getter over `case_referrals` — the transition plan's agency list,
     * written only by `updateTransitionPlan` and read by no step, which is why it
     * holds 0 rows in every database this project has run. A referral the product
     * means is the row the endorsement letter writes, so the case object carries
     * no trace of it and a gate reading the getter refuses a case that has one.
     * Stubbing the object property would reproduce that bug rather than catch it.
     */
    const withInterAgencyReferral = (n = 1) =>
      repoMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('inter_agency_referrals')) return [{ count: n }];
        if (sql.includes('case_interventions')) return [{ count: 1 }];
        return [];
      });

    it('blocks active -> transitioning until a referral decision is recorded', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', referrals: [],
        referralNotNeeded: false, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1'))
        .rejects.toThrow(/referral/i);
    });

    it('allows active -> transitioning when no referral is needed', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', referrals: [],
        referralNotNeeded: true, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      repoMock.save.mockImplementation(async (x: any) => x);
      await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1')).resolves.toBeTruthy();
    });

    // The gate the bug produced: a real endorsement letter on file, the case row
    // carrying nothing, and the transition refused for a referral that exists.
    it('accepts active -> transitioning when an inter-agency referral is on record', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001',
        // Empty on purpose: this is what the database actually holds, since the
        // letter writes `inter_agency_referrals` and nothing writes this list.
        referrals: [],
        referralNotNeeded: false, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      repoMock.save.mockImplementation(async (x: any) => x);
      withInterAgencyReferral();

      await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1')).resolves.toBeTruthy();
    });

    // …and the negative, so the pass above cannot be the gate simply not running.
    it('still refuses when the referrals table holds nothing for the case', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', referrals: [],
        referralNotNeeded: false, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      withInterAgencyReferral(0);

      await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1'))
        .rejects.toThrow(/referral/i);
    });

    // A `case_referrals` row must not stand in for one: that is the whole point
    // of the split, and it is the direction that would let a case through.
    it('does not accept a case_referrals row as an inter-agency referral', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001',
        referrals: [{ agencyName: 'RHU', status: 'referred' }],
        referralNotNeeded: false, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      withInterAgencyReferral(0);

      await expect(service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1'))
        .rejects.toThrow(/referral/i);
    });

    it('counts referrals off inter_agency_referrals, scoped to this case', async () => {
      const c = {
        id: '1', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', referrals: [],
        referralNotNeeded: true, selfRelianceLevel: 3, sustainabilityPlan: 'plan',
        beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      } as unknown as Case;
      repoMock.findOne.mockResolvedValue(c);
      repoMock.save.mockImplementation(async (x: any) => x);
      repoMock.query.mockResolvedValue([]);

      await service.updateStatus('1', CaseStatus.TRANSITIONING, 'admin', 'u1');

      const [sql, params] = repoMock.query.mock.calls.find(([q]: [string]) => q.includes('inter_agency_referrals'));
      expect(sql).toContain('inter_agency_referrals');
      expect(params).toEqual(['1']);
    });
  });

  describe('create', () => {
    it('should create a case with enrolled status', async () => {
      const caseData = {
        serviceRequested: ['Medical Aid'],
        beneficiaryId: 'beneficiary-1',
      };
      const saved = { ...caseData, id: 'case-1', status: CaseStatus.ENROLLED, controlNo: 'KAPWA-2024-00001' } as Case;
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);

      const result = await service.create(caseData as any);
      expect(result.status).toBe(CaseStatus.ENROLLED);
      expect(repoMock.create).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated cases', async () => {
      const cases = [
        { id: '1', status: CaseStatus.ENROLLED, beneficiary: { age: 25 } },
        { id: '2', status: CaseStatus.ACTIVE, beneficiary: { age: 30 } },
      ] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 2]);

      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(repoMock.createQueryBuilder).toHaveBeenCalledWith('c');
    });

    it('should filter by status', async () => {
      const cases = [{ id: '1', status: CaseStatus.ENROLLED, beneficiary: { age: 25 } }] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 1]);

      const result = await service.findAll(1, 10, { status: CaseStatus.ENROLLED });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by beneficiaryId when provided (beneficiary profile Cases panel)', async () => {
      const cases = [{ id: '1', beneficiaryId: 'ben-1' }] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 1]);

      const result = await service.findAll(1, 10, { beneficiaryId: 'ben-1' });

      expect(result.data).toHaveLength(1);
      const filterCall = (qbMock.andWhere as jest.Mock).mock.calls
        .find((c: [string, unknown]) => c[0].includes('c.beneficiaryId'));
      expect(filterCall?.[0]).toBe('c.beneficiaryId = :beneficiaryId');
      expect(filterCall?.[1]).toEqual({ beneficiaryId: 'ben-1' });
    });

    it('leaves the list unfiltered when beneficiaryId is omitted', async () => {
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 10);

      const filterCalls = (qbMock.andWhere as jest.Mock).mock.calls
        .filter((c: [string, unknown]) => c[0].includes('c.beneficiaryId'));
      expect(filterCalls).toHaveLength(0);
      expect(qbMock.getManyAndCount).toHaveBeenCalledTimes(1);
    });

    it('pushes ageRange and category filters into SQL before pagination', async () => {
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(1, 10, { ageRange: '0-17', category: 'medical' });

      const andWhereCalls = (qbMock.andWhere as jest.Mock).mock.calls
        .map((c: [string, unknown]) => c[0]);
      const ageSql = andWhereCalls.find(s => s.includes('18 years'));
      const catSql = andWhereCalls.find(s => s.includes('c.client_category ILIKE'));
      expect(ageSql).toBeDefined();
      expect(ageSql).toContain('IS NULL OR');
      expect(catSql).toBeDefined();
      expect(qbMock.getManyAndCount).toHaveBeenCalledTimes(1);

      await service.findAll(1, 10, { ageRange: '60+' });
      const seniorSql = (qbMock.andWhere as jest.Mock).mock.calls
        .map((c: [string, unknown]) => c[0])
        .find(s => s.includes("INTERVAL '60 years'"));
      expect(seniorSql).toBe("person.dob <= NOW() - INTERVAL '60 years'");
    });

    it('matches control numbers in the search filter (Tracker search)', async () => {
      const cases = [{ id: '1', controlNo: 'KAPWA-2026-00020' }] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 1]);

      const result = await service.findAll(1, 10, { search: 'KAPWA-2026-00020' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      const searchCall = (qbMock.andWhere as jest.Mock).mock.calls
        .find((c: [string, unknown]) => c[0].includes('ILIKE :search'));
      expect(searchCall?.[0]).toContain('c.controlNo ILIKE :search');
      expect(searchCall?.[1]).toEqual({ search: '%KAPWA-2026-00020%' });
    });

    it('still matches names when the search filter runs', async () => {
      const cases = [{ id: '1' }] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 1]);

      await service.findAll(1, 10, { search: 'Dela Cruz' });

      const searchCall = (qbMock.andWhere as jest.Mock).mock.calls
        .find((c: [string, unknown]) => c[0].includes('ILIKE :search'));
      expect(searchCall?.[0]).toContain('person.surname ILIKE :search');
      expect(searchCall?.[0]).toContain('person.first_name ILIKE :search');
      expect(searchCall?.[0]).toContain('person.middle_name ILIKE :search');
    });

    /**
     * The list's referral count.
     *
     * The approval pipeline's chips come from the same `stepperStepDone` as the
     * case view's stepper, and step 2 asks for the inter-agency referral count.
     * Without this on the row, that page reports "no referral" for a case that
     * has one — two surfaces of one predicate disagreeing, which is the failure
     * mode the shared fixture exists to prevent.
     *
     * Asserted per-case rather than "the field exists": a mutation that stamped
     * the same number on every row would still set the field, and a mutation that
     * dropped the assignment leaves it `undefined`, which `toEqual` against an
     * expected object would forgive. Hence `Object.keys` spelled explicitly.
     */
    it('attaches each case\'s own inter-agency referral count', async () => {
      const cases = [
        { id: '1', status: CaseStatus.ACTIVE, beneficiary: { age: 25 } },
        { id: '2', status: CaseStatus.ACTIVE, beneficiary: { age: 30 } },
      ] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 2]);
      // Two grouped queries in one batch: interventions first, referrals second.
      (repoMock.manager as any).query = jest.fn()
        .mockResolvedValueOnce([{ case_id: '1', count: 3 }])
        .mockResolvedValueOnce([{ case_id: '2', count: 1 }]);

      const result = await service.findAll(1, 10);

      expect(Object.keys(result.data[0] as object).sort()).toContain('interAgencyReferralCount');
      expect((result.data[0] as any).interAgencyReferralCount).toBe(0);
      expect((result.data[1] as any).interAgencyReferralCount).toBe(1);
      // The count is read from the referrals table, scoped to this page's ids.
      const [referralSql, referralParams] = (repoMock.manager.query as jest.Mock).mock.calls[1];
      expect(referralSql).toContain('inter_agency_referrals');
      expect(referralParams).toEqual([['1', '2']]);
    });

    /**
     * The detail payload carries the same case-level count.
     *
     * The case view's stepper and step-2 seal bar used to read the length of the
     * caller-scoped `GET /inter-agency-referrals/case/:caseId` list, so a worker
     * whose agency was not on a referral saw 0 and could not seal step 2 — while
     * the server's own seal counts every row for the case. The count that decides
     * "does this case have a referral" is a case fact, so it travels on the case
     * and both surfaces read the same number.
     */
    it('stamps the case-level referral count on the detail payload', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.TRANSITIONING } as Case);
      repoMock.query.mockResolvedValue([{ count: '2' }]);

      const result = await service.getCaseWithSla('1');

      expect((result as any).interAgencyReferralCount).toBe(2);
      const [sql, params] = repoMock.query.mock.calls.at(-1);
      expect(sql).toContain('inter_agency_referrals');
      expect(params).toEqual(['1']);
    });

    it('counts interventions and referrals in one batch, not one query per case', async () => {
      const cases = [
        { id: '1', status: CaseStatus.ACTIVE, beneficiary: { age: 25 } },
        { id: '2', status: CaseStatus.ACTIVE, beneficiary: { age: 30 } },
        { id: '3', status: CaseStatus.ACTIVE, beneficiary: { age: 31 } },
      ] as Case[];
      const qbMock = repoMock.createQueryBuilder();
      qbMock.getManyAndCount.mockResolvedValue([cases, 3]);
      (repoMock.manager as any).query = jest.fn().mockResolvedValue([]);

      await service.findAll(1, 10);

      // Two calls total for three cases: a per-case count would be an N+1, and
      // the `?? 0` below would never fire.
      expect(repoMock.manager.query).toHaveBeenCalledTimes(2);
    });

    it('computes sla filter over a candidate set and paginates in memory', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-04T00:00:00Z'));
      try {
        const qbMock = repoMock.createQueryBuilder();
        qbMock.getMany.mockResolvedValue([
          { id: 'c-old', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00001', createdAt: new Date('2026-01-01T00:00:00Z') },
          { id: 'c-new', status: CaseStatus.ACTIVE, controlNo: 'KAPWA-2026-00002', createdAt: new Date('2026-09-02T00:00:00Z') },
        ]);

        const result = await service.findAll(1, 10, { sla: 'overdue' });

        expect(result.total).toBe(1);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('c-old');
        expect(qbMock.getManyAndCount).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('findById', () => {
    it('should return case by id', async () => {
      const caseEntity = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(caseEntity);

      const result = await service.findById('1');
      expect(result).toEqual(caseEntity);
    });

    it('should throw if not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow('Case not found');
    });

    // The seal strip reads stepLocks off the detail payload rather than
    // issuing a second request, so the three fields and their order are part of
    // the response contract, not an implementation detail.
    it('carries the sealed steps on the detail payload', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ACTIVE } as Case);
      stepLocksRepoMock.find.mockResolvedValue([
        { id: 'r1', caseId: '1', stepIndex: 1, lockedBy: 'u1', lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
        { id: 'r2', caseId: '1', stepIndex: 3, lockedBy: 'u2', lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
      ]);

      const result: any = await service.findById('1');
      expect(result.stepLocks).toEqual([
        { stepIndex: 1, lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-02') },
        { stepIndex: 3, lockedByName: 'Lorna B. Santos', lockedAt: new Date('2026-10-01') },
      ]);
    });

    // The row id and lockedBy are server-internal; a welfare case file should
    // not leak a user uuid to the client through the case payload.
    it('omits the lock row id and locker uuid from the payload', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ACTIVE } as Case);
      stepLocksRepoMock.find.mockResolvedValue([
        { id: 'r1', caseId: '1', stepIndex: 0, lockedBy: 'u1', lockedByName: 'Juan Dela Cruz', lockedAt: new Date() },
      ]);

      const result: any = await service.findById('1');
      expect(Object.keys(result.stepLocks[0]).sort()).toEqual(['lockedAt', 'lockedByName', 'stepIndex']);
    });

    it('asks for the sealed steps in step order, one query per case', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ENROLLED } as Case);
      stepLocksRepoMock.find.mockResolvedValue([]);

      const result: any = await service.findById('1');
      expect(result.stepLocks).toEqual([]);
      expect(stepLocksRepoMock.find).toHaveBeenCalledWith({
        where: { caseId: '1' },
        order: { stepIndex: 'ASC' },
      });
      expect(stepLocksRepoMock.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus', () => {
    it('should transition from enrolled to assessed and notify', async () => {
      const existing = { id: '1', assignedWorkerId: 'w1', controlNo: 'KAPWA-001', status: CaseStatus.ENROLLED, problemsPresented: 'Issue', socialWorkerAssessment: 'Needs aid', clientCategory: 'Senior Citizen', updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ASSESSED });

      const result = await service.updateStatus('1', CaseStatus.ASSESSED);
      expect(result.status).toBe(CaseStatus.ASSESSED);
      expect(notifMock.notifyCaseUpdate).toHaveBeenCalledWith('w1', '1', 'KAPWA-001', CaseStatus.ASSESSED);
    });

    it('should notify the linked claimant account on transition', async () => {
      const existing = { id: '1', beneficiaryId: 'ben-1', assignedWorkerId: 'w1', controlNo: 'KAPWA-001', status: CaseStatus.ENROLLED, problemsPresented: 'Issue', socialWorkerAssessment: 'Needs aid', clientCategory: 'Senior Citizen', updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ASSESSED });
      repoMock.query.mockResolvedValue([{ id: 'claimant-user-1' }]);

      await service.updateStatus('1', CaseStatus.ASSESSED);

      expect(repoMock.query).toHaveBeenCalledWith(
        expect.stringContaining('users u'),
        ['ben-1'],
      );
      expect(notifMock.notifyCaseUpdate).toHaveBeenCalledWith('claimant-user-1', '1', 'KAPWA-001', CaseStatus.ASSESSED);
    });

    it('should throw on invalid transition', async () => {
      const existing = { id: '1', status: CaseStatus.CLOSED, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);

      await expect(service.updateStatus('1', CaseStatus.ENROLLED)).rejects.toThrow('Invalid transition');
    });

    it('should throw when transitioning enrolled to assessed without completed assessment', async () => {
      const existing = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      await expect(service.updateStatus('1', CaseStatus.ASSESSED)).rejects.toThrow('Assessment must be completed');
    });
  });

  // A case cannot be flagged for admin review until every step is sealed.
  // assessed -> in_review is the hand-off, and CASE_FSM_ROLES hands that edge to
  // the social worker, so the gate belongs on the service, not behind a button:
  // the same worker can PATCH /cases/:id/status and would walk past a client-only
  // check.
  describe('all-locked gate on assessed -> in_review', () => {
    // Assessed, with the score the *previous* check asks for, so these tests
    // isolate the step-lock rule and nothing else.
    const assessed = (extra: Record<string, unknown> = {}) => ({
      id: '1', status: CaseStatus.ASSESSED, controlNo: 'KAPWA-2026-00001',
      frvaScore: 62, beneficiaryId: null, assignedWorkerId: null, updatedAt: new Date(),
      ...extra,
    } as unknown as Case);

    const sealed = (...stepIndexes: number[]) => stepIndexes.map((stepIndex) => ({
      id: `lock-${stepIndex}`, caseId: '1', stepIndex, lockedBy: 'u1',
      lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-01'),
    }));

    beforeEach(() => {
      repoMock.save.mockImplementation(async (c: any) => c);
    });

    // At `assessed` (status index 1) the due steps are 0, 1 and 2 — assessment,
    // intervention, referrals. Steps 4 and 5 are Phase-Out work floored at
    // `active` and `transitioning`: their Lock buttons are disabled in the UI and
    // the seal endpoint rejects them, so demanding them here made the gate
    // unsatisfiable for the only role it applies to.
    it('allows the hand-off once the steps due at assessed are sealed, without the phase-out steps', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2));

      const result = await service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' });

      expect(result.status).toBe(CaseStatus.IN_REVIEW);
      expect(repoMock.save).toHaveBeenCalled();
    });

    // Steps 3 and 4 unsealed as well, so this also proves the gate ignores them
    // rather than passing on some accident of ordering.
    it('ignores steps that cannot be sealed yet at this status', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2));

      const result = await service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' });

      expect(result.status).toBe(CaseStatus.IN_REVIEW);
    });

    it('refuses the hand-off while a due step is still open, naming it the way the stepper does', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 2));

      await expect(service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' }))
        .rejects.toThrow(/Still open: Intervention & Requirements/);
    });

    // One seal, two gaps: the message is the worker's work list, so it has to
    // name every open *due* step, by the UI's name, in step order — and nothing
    // else, or a worker at `assessed` is told to seal a step whose Lock button is
    // disabled.
    it('names every open due step, in step order, and no step that is not yet due', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(1));

      await expect(service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' }))
        .rejects.toThrow(
          'Lock every step before flagging this case for admin review. Still open: ' +
          'Assess & Interview, Inter-agency Referrals',
        );
    });

    it('never names a phase-out step in the message at assessed', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue([]);

      const error = await service
        .transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' })
        .then(() => null, (e: Error) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error!.message).not.toContain('Evaluate Help Given');
      expect(error!.message).not.toContain('Case Study & Closure');
    });

    // Sealing more than is due stays harmless: the worker who got to `in_review`
    // and kept working should not be blocked from handing on.
    it('allows the hand-off when all five steps are sealed', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2, 3, 4));

      const result = await service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' });

      expect(result.status).toBe(CaseStatus.IN_REVIEW);
    });

    // canTransition short-circuits admin, so applying the rule to admin would
    // leave the office head unable to move a case at all.
    it('does not apply the all-locked rule to admin', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue([]);

      const result = await service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'admin' });

      expect(result.status).toBe(CaseStatus.IN_REVIEW);
    });

    // The guard keys on "is not admin", never on "a role was supplied" — a
    // caller that omits userRole is treated as the worker, not as the office
    // head, so it cannot walk past the gate by forgetting an argument.
    it('still gates a caller that passes no role at all', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue([]);

      await expect(service.transition('1', CaseStatus.IN_REVIEW)).rejects.toThrow(/Lock every step/);
    });

    // The FRVA/SWDI complaint is cheaper and more specific, so it must still be
    // the one a worker with a half-filled form sees.
    it('leaves the FRVA/SWDI complaint in front of the lock complaint', async () => {
      repoMock.findOne.mockResolvedValue(assessed({ frvaScore: null, swdiScore: null }));
      stepLocksRepoMock.find.mockResolvedValue([]);

      await expect(service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' }))
        .rejects.toThrow('FRVA or SWDI score must be provided before review');
    });

    /**
     * A15: `findById` already loads this case's seals onto the payload for the
     * seal strip, so the gate's own `stepLocksRepo.find` is a second round-trip
     * for an answer already in hand. Only the call count can see it — the answer
     * is identical either way.
     */
    it('reads the seals findById already loaded, with no second query', async () => {
      repoMock.findOne.mockResolvedValue(assessed());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2));

      await service.transition('1', CaseStatus.IN_REVIEW, { userRole: 'social_worker' });

      expect(stepLocksRepoMock.find).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Step 5 ("Case Study & Closure") had no seal gate anywhere. The all-locked
   * gate asks for the steps due at a status, and step 5 only becomes due at
   * `transitioning` — the very status it gates the *exit* from — so nothing ever
   * asked whether anyone deliberately sealed it. A case could reach `closed` with
   * its closure step never sealed by anyone.
   *
   * The existing `clientSignature`/`closureOutcome` check is step 5's
   * done-predicate, not a seal: it asks whether the *data* is there, which a
   * form can satisfy on its own. What was missing is the deliberate act.
   */
  describe('step-5 seal gate on transitioning -> closed', () => {
    // Everything `validateTransition` asks for at `closed`, so these tests
    // isolate the seal rule: step 5's own done-predicate is already satisfied.
    const transitioning = (extra: Record<string, unknown> = {}) => ({
      id: '1',
      status: CaseStatus.TRANSITIONING,
      clientSignature: 'sig',
      closureOutcome: 'graduated',
      controlNo: 'KAPWA-2026-00001',
      beneficiaryId: null,
      assignedWorkerId: null,
      updatedAt: new Date(),
      ...extra,
    } as unknown as Case);

    const sealed = (...stepIndexes: number[]) => stepIndexes.map((stepIndex) => ({
      id: `lock-${stepIndex}`, caseId: '1', stepIndex, lockedBy: 'u1',
      lockedByName: 'Juan Dela Cruz', lockedAt: new Date('2026-10-01'),
    }));

    beforeEach(() => {
      repoMock.save.mockImplementation(async (c: any) => c);
    });

    it('closes once every due step, closure included, is sealed', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2, 3, 4));

      const result = await service.transition('1', CaseStatus.CLOSED, { userRole: 'social_worker' });

      expect(result.status).toBe(CaseStatus.CLOSED);
    });

    // Step 4's data is present and step 4 is sealed, so the only thing missing is
    // the closure step's own seal — which is the hole.
    it('refuses to close while the closure step is unsealed, naming it as the stepper does', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2, 3));

      await expect(service.transition('1', CaseStatus.CLOSED, { userRole: 'social_worker' }))
        .rejects.toThrow('Still open: Case Study & Closure');
    });

    // Closure requires every step due at `transitioning` — all five — not just
    // the step whose work completes on this edge. Step 4's own edge
    // (`active -> transitioning`) is admin-only, so it can never carry a gate;
    // closure is the last point step 4 can be asked for. The message therefore
    // names every open due step, closure included.
    it('names every open due step, closure included', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue([]);

      await expect(service.transition('1', CaseStatus.CLOSED, { userRole: 'social_worker' }))
        .rejects.toThrow('Lock every step before closing this case. Still open: Assess & Interview, Intervention & Requirements, Inter-agency Referrals, Evaluate Help Given, Case Study & Closure');
    });

    // Same carve-out as the hand-off gate, for the same stated reason: an admin
    // who could not close a case at all would be worse than the gap.
    it('does not apply the seal gate to admin', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue([]);

      const result = await service.transition('1', CaseStatus.CLOSED, { userRole: 'admin' });

      expect(result.status).toBe(CaseStatus.CLOSED);
    });

    it('still gates a caller that passes no role at all', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue([]);

      await expect(service.transition('1', CaseStatus.CLOSED)).rejects.toThrow(/Still open/);
    });

    // The missing-data complaint is cheaper and more specific, so it must still be
    // the one a worker sees before being told to go and seal a step.
    it('leaves the missing-outcome complaint in front of the seal complaint', async () => {
      repoMock.findOne.mockResolvedValue(transitioning({ closureOutcome: null }));
      stepLocksRepoMock.find.mockResolvedValue([]);

      await expect(service.transition('1', CaseStatus.CLOSED, { userRole: 'social_worker' }))
        .rejects.toThrow('Closure outcome is required for closure');
    });

    /**
     * A15: `findById` already loads the case's seals onto the payload, so the
     * gates must read them off the case rather than issue a second indexed
     * query. Asserted by call count, which is the only way to see it — the
     * answer is identical either way.
     */
    it('reads the seals findById already loaded, with no second query', async () => {
      repoMock.findOne.mockResolvedValue(transitioning());
      stepLocksRepoMock.find.mockResolvedValue(sealed(0, 1, 2, 3, 4));

      await service.transition('1', CaseStatus.CLOSED, { userRole: 'social_worker' });

      expect(stepLocksRepoMock.find).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Step 4 ("Evaluate Help Given") has no seal gate either — but its only edge
   * out of `active` is one no non-admin role may take (`CASE_FSM_ROLES[ACTIVE]` is
   * empty, so `canTransition` admits `admin` and nothing else), and `admin` is the
   * one caller the gates carve out. So a seal gate there would bind nobody.
   *
   * Pinned as a fact about the FSM rather than left as a reading of it, because
   * the gap only closes for real if `CASE_FSM_ROLES[ACTIVE]` ever gains a role —
   * and then this test is what says the gate is still missing.
   */
  describe('active -> transitioning has no reachable non-admin actor', () => {
    it('admits no role but admin, who is the one the gates exempt', async () => {
      expect(canTransition(CaseStatus.ACTIVE, 'social_worker')).toBe(false);
      expect(canTransition(CaseStatus.ACTIVE, 'coordinator')).toBe(false);
      expect(canTransition(CaseStatus.ACTIVE, 'admin')).toBe(true);
    });
  });

  /**
   * An approval records an approver. `transition()` only writes
   * `approvedBySignature` when the value is truthy, so a blank signature was
   * accepted and the field silently dropped — leaving an approval record with no
   * approver on it, which is the thing the deliberate-actions feature exists to
   * prevent.
   *
   * `PATCH /cases/:id/approve` is the only path that carries a signature, and
   * `ApproveCaseSchema` now refuses a blank one. This is the same rule stated at
   * the service, so it also holds for anything that is not an HTTP request.
   */
  describe('approve refuses an approval with no signature', () => {
    it('refuses an empty signature', async () => {
      await expect(service.approve('1', CaseStatus.ACTIVE, '', 'admin', 'u1'))
        .rejects.toThrow('Approver signature is required to approve a case');
    });

    it('refuses a whitespace-only signature', async () => {
      await expect(service.approve('1', CaseStatus.ACTIVE, '   ', 'admin', 'u1'))
        .rejects.toThrow('Approver signature is required to approve a case');
    });

    it('never reaches the case at all', async () => {
      await expect(service.approve('1', CaseStatus.ACTIVE, '', 'admin', 'u1')).rejects.toThrow();
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('accepts a real signature', async () => {
      const existing = { id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-1', updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockImplementation(async (c: any) => c);
      (service as any).getInterventionCount = jest.fn().mockResolvedValue(1);

      await expect(service.approve('1', CaseStatus.ACTIVE, 'Lorna Santos', 'admin', 'u1')).resolves.toBeTruthy();
    });
  });

  describe('updateReferralDecision', () => {
    it('should persist the not-needed decision and return the updated case', async () => {
      const existing = { id: '1', status: CaseStatus.ACTIVE, referralNotNeeded: false, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, referralNotNeeded: true });

      const result = await service.updateReferralDecision('1', true);

      expect(repoMock.save).toHaveBeenCalled();
      expect(result.referralNotNeeded).toBe(true);
    });

    it('should be able to reverse an earlier not-needed decision', async () => {
      const existing = { id: '1', status: CaseStatus.ACTIVE, referralNotNeeded: true, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, referralNotNeeded: false });

      const result = await service.updateReferralDecision('1', false);

      expect(result.referralNotNeeded).toBe(false);
    });

    it('should throw if the case is not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.updateReferralDecision('nonexistent', true)).rejects.toThrow('Case not found');
    });
  });

  describe('getHistory', () => {
    // The timeline must name the actor, not just the role slug: a history row
    // that reads "by social worker" is unactionable for a supervisor.
    it('resolves the actor display name alongside the role', async () => {
      historyRepoMock.query.mockResolvedValue([
        {
          id: 'h1', case_id: 'c1', from_status: 'assessed', to_status: 'in_review',
          changed_by_role: 'social_worker', changed_by_id: 'u1', remarks: null,
          transition_type: 'standard', override_reason: null, created_at: new Date('2026-01-02'),
          changed_by_name: 'Lorna Santos',
        },
      ]);

      const rows = await service.getHistory('c1');

      expect(rows[0].changedByName).toBe('Lorna Santos');
      expect(rows[0].changedByRole).toBe('social_worker');
      expect(rows[0].toStatus).toBe('in_review');
    });

    it('leaves changedByName null for system-driven entries with no actor', async () => {
      // Postgres returns '' (not NULL) for CONCAT_WS over all-NULL name parts,
      // so the mapping has to fold empty strings back to null or every consumer
      // ends up distinguishing '' from "absent".
      historyRepoMock.query.mockResolvedValue([
        {
          id: 'h2', case_id: 'c1', from_status: '', to_status: 'enrolled',
          changed_by_role: '', changed_by_id: null, remarks: 'Imported',
          transition_type: 'standard', override_reason: '', created_at: new Date('2026-01-01'),
          changed_by_name: '',
        },
      ]);

      const rows = await service.getHistory('c1');

      expect(rows[0].changedByName).toBeNull();
      expect(rows[0].changedByRole).toBeUndefined();
      expect(rows[0].fromStatus).toBeUndefined();
      expect(rows[0].overrideReason).toBeUndefined();
      expect(rows[0].remarks).toBe('Imported');
    });

    it('keeps a full actor name including middle name and suffix', async () => {
      historyRepoMock.query.mockResolvedValue([
        {
          id: 'h3', case_id: 'c1', from_status: 'in_review', to_status: 'active',
          changed_by_role: 'admin', changed_by_id: 'u2', remarks: null,
          transition_type: 'standard', override_reason: null, created_at: new Date('2026-01-03'),
          changed_by_name: 'Ana Santos Dela Cruz Jr.',
        },
      ]);

      const rows = await service.getHistory('c1');

      expect(rows[0].changedByName).toBe('Ana Santos Dela Cruz Jr.');
    });

    it('scopes the join to the requested case', async () => {
      await service.getHistory('case-42');
      expect(historyRepoMock.query).toHaveBeenCalledWith(expect.stringContaining('FROM case_history'), ['case-42']);
    });
  });


describe('FSM — requestReview', () => {
  it('should move case from enrolled to assessed when role is social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.ENROLLED, assignedWorkerId: 'w1', controlNo: 'KAPWA-001', problemsPresented: 'Issue', socialWorkerAssessment: 'Needs aid', clientCategory: 'Senior Citizen', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ASSESSED });
    const result = await service.requestReview('1', 'social_worker');
    expect(result.status).toBe(CaseStatus.ASSESSED);
  });

  it('should forbid requestReview when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.requestReview('1', 'admin')).rejects.toThrow('Role admin cannot request review');
  });

  it('should throw when requestReview called on non-enrolled case', async () => {
    const existing = { id: '1', status: CaseStatus.ASSESSED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.requestReview('1', 'social_worker')).rejects.toThrow('Cannot request review from');
  });

  it('should throw when requestReview called without completed assessment', async () => {
    const existing = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.requestReview('1', 'social_worker')).rejects.toThrow('Assessment must be completed');
  });
});

describe('FSM — disburse', () => {
  it('should move case from active to transitioning when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.ACTIVE, assignedWorkerId: 'w1', controlNo: 'KAPWA-001', beneficiaryId: 'b1', selfRelianceLevel: 3, sustainabilityPlan: 'livelihood', referralNotNeeded: true, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.TRANSITIONING });
    const result = await service.disburse('1', CaseStatus.TRANSITIONING, 'admin');
    expect(result.status).toBe(CaseStatus.TRANSITIONING);
  });

  it('should throw when disburse called by social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.ACTIVE, selfRelianceLevel: 3, sustainabilityPlan: 'livelihood', referralNotNeeded: true, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.disburse('1', CaseStatus.TRANSITIONING, 'social_worker')).rejects.toThrow('cannot transition from active to transitioning');
  });
});

describe('FSM — close', () => {
  it('should move case from transitioning to closed when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, clientSignature: 'sig', closureOutcome: 'graduated', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });
    const result = await service.close('1', CaseStatus.CLOSED, 'admin');
    expect(result.status).toBe(CaseStatus.CLOSED);
  });

  it('should close case when role is social_worker', async () => {
    // Closure requires every step due at `transitioning`, so a social worker
    // closing a case arrives with all five seals taken — the case the gate
    // exists for.
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, closureOutcome: 'graduated', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    stepLocksRepoMock.find.mockResolvedValue(
      [0, 1, 2, 3, 4].map((stepIndex) => ({
        id: `lock-${stepIndex}`, caseId: '1', stepIndex, lockedBy: 'u1', lockedByName: 'Juan', lockedAt: new Date(),
      })),
    );
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });
    const result = await service.close('1', CaseStatus.CLOSED, 'social_worker');
    expect(result.status).toBe(CaseStatus.CLOSED);
  });

  it('should throw when closing without a closure outcome', async () => {
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.close('1', CaseStatus.CLOSED, 'admin')).rejects.toThrow('Closure outcome is required for closure');
  });

  it('rejects closing a case straight from enrolled (no signature/outcome/case study)', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case);
    await expect(service.close('1', CaseStatus.CLOSED, 'admin')).rejects.toThrow(/Invalid transition/);
  });

  it('rejects closing a case straight from active even with a signature and outcome', async () => {
    const existing = { id: '1', status: CaseStatus.ACTIVE, clientSignature: 'sig', closureOutcome: 'graduated', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.updateStatus('1', CaseStatus.CLOSED, 'admin')).rejects.toThrow(/Invalid transition/);
  });
});

/**
 * Recording the exit record is not closing the case.
 *
 * `PATCH /cases/:id/closure` used to set `status: CLOSED` itself, which skipped
 * the `transitioning -> closed` seal gate in `validateTransition` — a second
 * control for one edge, ungated. The route now records the exit record only; the
 * gated `PATCH /cases/:id/close` hop is the one close. This test is what fails if
 * the direct close is ever re-added.
 */
describe('recording closure data does not close the case', () => {
  it('leaves the status at transitioning', async () => {
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockImplementation(async (c: any) => c);

    const result = await service.updateClosure(
      '1',
      { closureOutcome: 'graduated', clientSignature: 'sig' } as any,
      'social_worker',
    );

    expect(result.status).toBe(CaseStatus.TRANSITIONING);
    expect(repoMock.save).toHaveBeenCalled();
    // No history row claiming a transition that did not happen.
    expect(historyRepoMock.save).not.toHaveBeenCalled();
  });
});

describe('FSM — authorization precedes prerequisite validation', () => {
  it('returns 403 (not a missing-document 400) for a social worker approving', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.IN_REVIEW, controlNo: 'KAPWA-1', updatedAt: new Date() } as Case);
    (service as any).casesExport = { missingRequiredDocuments: jest.fn().mockResolvedValue(['Valid ID']) };
    (service as any).getInterventionCount = jest.fn().mockResolvedValue(1);
    await expect(service.approve('1', CaseStatus.ACTIVE, 'sig', 'social_worker', 'u1'))
      .rejects.toThrow(/cannot transition/);
    expect((service as any).casesExport.missingRequiredDocuments).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-social-worker requesting review before checking case state', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case);
    await expect(service.requestReview('1', 'admin')).rejects.toThrow(/cannot request review/);
  });
});

describe('FSM — overrideStatus', () => {
  it('should move case from any status to any other with mandatory reason', async () => {
    const existing = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ACTIVE });
    const result = await service.overrideStatus('1', CaseStatus.ACTIVE, 'Emergency release', 'admin');
    expect(result.status).toBe(CaseStatus.ACTIVE);
  });

  it('should throw if override reason is empty', async () => {
    const existing = { id: '1', status: CaseStatus.ENROLLED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.overrideStatus('1', CaseStatus.ACTIVE, '', 'admin')).rejects.toThrow('Override reason is required');
  });

  it('should record override in CaseHistory with transitionType and overrideReason', async () => {
    const existing = { id: '1', status: CaseStatus.ASSESSED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ACTIVE });
    await service.overrideStatus('1', CaseStatus.ACTIVE, 'Directive from mayor', 'admin');
    expect(historyRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ transitionType: 'override', overrideReason: 'Directive from mayor' })
    );
  });
});

describe('FSM — rejectCase', () => {
  it('closes a Phase-In case as incomplete and records the reason', async () => {
    const existing = { id: '1', status: CaseStatus.ASSESSED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });

    const result = await service.reject('1', 'Duplicate intake', 'social_worker');

    expect(result.status).toBe(CaseStatus.CLOSED);
    expect(historyRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: CaseStatus.CLOSED, remarks: 'Case rejected: Duplicate intake' }),
    );
  });

  it('requires a reason', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ASSESSED } as Case);
    await expect(service.reject('1', '   ', 'admin')).rejects.toThrow('Rejection reason is required');
  });

  it('refuses roles other than admin / social_worker', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ASSESSED } as Case);
    await expect(service.reject('1', 'Not eligible', 'claimant')).rejects.toThrow('cannot reject a case');
  });

  it('refuses to reject a case that already left Phase-In', async () => {
    repoMock.findOne.mockResolvedValue({ id: '1', status: CaseStatus.ACTIVE } as Case);
    await expect(service.reject('1', 'Too late', 'admin')).rejects.toThrow('cannot be rejected');
  });
});

describe('FSM — backward transitions', () => {
  it('should throw when moving active back to assessed via updateStatus', async () => {
    const existing = { id: '1', status: CaseStatus.ACTIVE, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.updateStatus('1', CaseStatus.ASSESSED)).rejects.toThrow('Invalid transition');
  });
});

describe('updateAssessmentV2 — case_assistances', () => {
  let created: CaseAssistance[];

  beforeEach(() => {
    created = [];
    repoMock.findOne.mockResolvedValue({
      id: 'case-1',
      status: CaseStatus.ASSESSED,
      updatedAt: new Date(),
      assistances: [],
    } as any);
    (repoMock.manager as any).create = (_entity: any, input: any) => {
      const obj: any = { ...input };
      created.push(obj);
      return obj;
    };
    (repoMock.manager as any).delete = jest.fn().mockResolvedValue({ affected: 0 });
    repoMock.save.mockImplementation((c: any) => {
      c.id = c.id ?? 'case-1';
      return Promise.resolve(c);
    });
  });

  it('does NOT create a financial case_assistance when no financial data is provided', async () => {
    await service.updateAssessmentV2('case-1', {
      problemsPresented: 'need',
      socialWorkerAssessment: 'assess',
      clientCategory: 'Indigent',
      frvaScore: 65,
    } as any);
    expect(created).toEqual([]);
  });

  it('sets caseId on case_assistance rows when financial data is provided', async () => {
    await service.updateAssessmentV2('case-1', {
      problemsPresented: 'need',
      socialWorkerAssessment: 'assess',
      clientCategory: 'Indigent',
      amountAssistance: 5000,
      modeFinancialAssistance: 'Cash',
    } as any);
    expect(created.length).toBe(1);
    expect(created[0].assistanceType).toBe('financial');
    expect(created[0].caseId).toBe('case-1');
  });
});

});
