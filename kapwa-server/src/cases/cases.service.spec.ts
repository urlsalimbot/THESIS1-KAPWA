import { Test, TestingModule } from '@nestjs/testing';
import { CasesService } from './cases.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

describe('CasesService', () => {
  let service: CasesService;
  let repoMock: any;
  let historyRepoMock: any;
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

    repoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
    };

    historyRepoMock = {
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
        { provide: getRepositoryToken(CaseHistory), useValue: historyRepoMock },
        { provide: NotificationsService, useValue: notifMock },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a case with pending status', async () => {
      const caseData = {
        serviceRequested: ['Medical Aid'],
        beneficiaryId: 'beneficiary-1',
      };
      const saved = { ...caseData, id: 'case-1', status: CaseStatus.PENDING, controlNo: 'KAPWA-2024-00001' } as Case;
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);

      const result = await service.create(caseData as any);
      expect(result.status).toBe(CaseStatus.PENDING);
      expect(repoMock.create).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all cases when no status filter', async () => {
      const cases = [
        { id: '1', status: CaseStatus.PENDING },
        { id: '2', status: CaseStatus.DISBURSED },
      ] as Case[];
      repoMock.find.mockResolvedValue(cases);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(repoMock.find).toHaveBeenCalledWith({ take: 100 });
    });

    it('should filter by status', async () => {
      const cases = [{ id: '1', status: CaseStatus.PENDING }] as Case[];
      repoMock.find.mockResolvedValue(cases);

      const result = await service.findAll(CaseStatus.PENDING);
      expect(result).toHaveLength(1);
      expect(repoMock.find).toHaveBeenCalledWith({ where: { status: CaseStatus.PENDING }, take: 100 });
    });
  });

  describe('findById', () => {
    it('should return case by id', async () => {
      const caseEntity = { id: '1', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
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
    it('should transition from pending to in_review and notify', async () => {
      const existing = { id: '1', assignedWorkerId: 'w1', controlNo: 'KAPWA-001', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.IN_REVIEW });

      const result = await service.updateStatus('1', CaseStatus.IN_REVIEW);
      expect(result.status).toBe(CaseStatus.IN_REVIEW);
      expect(notifMock.notifyCaseUpdate).toHaveBeenCalledWith('w1', 'KAPWA-001', CaseStatus.IN_REVIEW);
    });

    it('should throw on invalid transition', async () => {
      const existing = { id: '1', status: CaseStatus.CLOSED, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);

      await expect(service.updateStatus('1', CaseStatus.PENDING)).rejects.toThrow('Invalid transition');
    });
  });


describe('FSM — requestReview', () => {
  it('should move case from pending to in_review when role is social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.PENDING, assignedWorkerId: 'w1', controlNo: 'KAPWA-001', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.IN_REVIEW });
    const result = await service.requestReview('1', 'social_worker');
    expect(result.status).toBe(CaseStatus.IN_REVIEW);
  });

  it('should forbid requestReview when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.requestReview('1', 'admin')).rejects.toThrow('Forbidden');
  });

  it('should throw when requestReview called on non-pending case', async () => {
    const existing = { id: '1', status: CaseStatus.IN_REVIEW, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.requestReview('1', 'social_worker')).rejects.toThrow('Bad Request');
  });
});

describe('FSM — disburse', () => {
  it('should move case from approved to disbursed when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.APPROVED, assignedWorkerId: 'w1', controlNo: 'KAPWA-001', beneficiaryId: 'b1', updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.DISBURSED });
    const result = await service.disburse('1', CaseStatus.DISBURSED, 'admin');
    expect(result.status).toBe(CaseStatus.DISBURSED);
  });

  it('should throw when disburse called by social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.APPROVED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.disburse('1', CaseStatus.DISBURSED, 'social_worker')).rejects.toThrow('Forbidden');
  });
});

describe('FSM — close', () => {
  it('should move case from disbursed to closed when role is admin', async () => {
    const existing = { id: '1', status: CaseStatus.DISBURSED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });
    const result = await service.close('1', CaseStatus.CLOSED, 'admin');
    expect(result.status).toBe(CaseStatus.CLOSED);
  });

  it('should close case when role is social_worker', async () => {
    const existing = { id: '1', status: CaseStatus.DISBURSED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.CLOSED });
    const result = await service.close('1', CaseStatus.CLOSED, 'social_worker');
    expect(result.status).toBe(CaseStatus.CLOSED);
  });
});

describe('FSM — overrideStatus', () => {
  it('should move case from any status to any other with mandatory reason', async () => {
    const existing = { id: '1', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.APPROVED });
    const result = await service.overrideStatus('1', CaseStatus.APPROVED, 'Emergency release', 'admin');
    expect(result.status).toBe(CaseStatus.APPROVED);
  });

  it('should throw if override reason is empty', async () => {
    const existing = { id: '1', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.overrideStatus('1', CaseStatus.APPROVED, '', 'admin'))
      .rejects.toThrow('Bad Request');
  });

  it('should record override in CaseHistory with transitionType and overrideReason', async () => {
    const existing = { id: '1', status: CaseStatus.IN_REVIEW, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.APPROVED });
    await service.overrideStatus('1', CaseStatus.APPROVED, 'Directive from mayor', 'admin');
    expect(historyRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ transitionType: 'override', overrideReason: 'Directive from mayor' })
    );
  });
});

describe('FSM — backward transitions', () => {
  it('should throw when moving approved back to in_review via updateStatus', async () => {
    const existing = { id: '1', status: CaseStatus.APPROVED, updatedAt: new Date() } as Case;
    repoMock.findOne.mockResolvedValue(existing);
    await expect(service.updateStatus('1', CaseStatus.IN_REVIEW)).rejects.toThrow('Invalid transition');
  });
});

});
