import { Test, TestingModule } from '@nestjs/testing';
import { CasesService } from './cases.service';
import { Case, CaseStatus } from './case.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('CasesService', () => {
  let service: CasesService;
  let repoMock: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
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
      expect(repoMock.find).toHaveBeenCalledWith();
    });

    it('should filter by status', async () => {
      const cases = [{ id: '1', status: CaseStatus.PENDING }] as Case[];
      repoMock.find.mockResolvedValue(cases);

      const result = await service.findAll(CaseStatus.PENDING);
      expect(result).toHaveLength(1);
      expect(repoMock.find).toHaveBeenCalledWith({ where: { status: CaseStatus.PENDING } });
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
    it('should transition from pending to in_review', async () => {
      const existing = { id: '1', status: CaseStatus.PENDING, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);
      repoMock.save.mockResolvedValue({ ...existing, status: CaseStatus.IN_REVIEW });

      const result = await service.updateStatus('1', CaseStatus.IN_REVIEW);
      expect(result.status).toBe(CaseStatus.IN_REVIEW);
    });

    it('should throw on invalid transition', async () => {
      const existing = { id: '1', status: CaseStatus.CLOSED, updatedAt: new Date() } as Case;
      repoMock.findOne.mockResolvedValue(existing);

      await expect(service.updateStatus('1', CaseStatus.PENDING)).rejects.toThrow('Invalid transition');
    });
  });
});
