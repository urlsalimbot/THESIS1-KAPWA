import { Test, TestingModule } from '@nestjs/testing';
import { CasesService } from './cases.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { CaseAssistance } from './case-assistance.entity';

describe('CasesService', () => {
  let service: CasesService;
  let repoMock: any;
  let historyRepoMock: any;
  let familyRepoMock: any;
  let bcRepoMock: any;
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
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
    };

    familyRepoMock = {
      find: jest.fn().mockResolvedValue([]),
    };

    historyRepoMock = {
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    bcRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
        { provide: getRepositoryToken(CaseHistory), useValue: historyRepoMock },
        { provide: getRepositoryToken(HouseholdMembership), useValue: familyRepoMock },
        { provide: getRepositoryToken(BeneficiaryClaimant), useValue: bcRepoMock },
        { provide: NotificationsService, useValue: notifMock },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
  });

  describe('updateStatus', () => {
    it('should transition from enrolled to assessed and notify', async () => {
      const existing = { id: '1', assignedWorkerId: 'w1', controlNo: 'KAPWA-001', status: CaseStatus.ENROLLED, problemsPresented: 'Issue', socialWorkerAssessment: 'Needs aid', clientCategory: 'Senior Citizen', updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.ASSESSED });

      const result = await service.updateStatus('1', CaseStatus.ASSESSED);
      expect(result.status).toBe(CaseStatus.ASSESSED);
      expect(notifMock.notifyCaseUpdate).toHaveBeenCalledWith('w1', 'KAPWA-001', CaseStatus.ASSESSED);
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
    const existing = { id: '1', status: CaseStatus.ACTIVE, assignedWorkerId: 'w1', controlNo: 'KAPWA-001', beneficiaryId: 'b1', selfRelianceLevel: 3, sustainabilityPlan: 'livelihood', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.TRANSITIONING });
    const result = await service.disburse('1', CaseStatus.TRANSITIONING, 'admin');
    expect(result.status).toBe(CaseStatus.TRANSITIONING);
  });

  it('should throw when disburse called by social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.ACTIVE, selfRelianceLevel: 3, sustainabilityPlan: 'livelihood', updatedAt: new Date() } as Case;
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
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, clientSignature: 'sig', closureOutcome: 'graduated', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });
    const result = await service.close('1', CaseStatus.CLOSED, 'social_worker');
    expect(result.status).toBe(CaseStatus.CLOSED);
  });

  it('should throw when closing without client signature', async () => {
    const existing = { id: '1', status: CaseStatus.TRANSITIONING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.close('1', CaseStatus.CLOSED, 'admin')).rejects.toThrow('Client signature and closure outcome are required');
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
