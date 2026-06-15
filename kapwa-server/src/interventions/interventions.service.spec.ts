import { Test, TestingModule } from '@nestjs/testing';
import { InterventionsService } from './interventions.service';
import { Intervention, InterventionType, FundSource } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('InterventionsService', () => {
  let service: InterventionsService;
  let interventionRepoMock: any;
  let caseRepoMock: any;

  beforeEach(async () => {
    interventionRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    caseRepoMock = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionsService,
        { provide: getRepositoryToken(Intervention), useValue: interventionRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
      ],
    }).compile();

    service = module.get<InterventionsService>(InterventionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw if caseId missing', async () => {
      await expect(service.create({}, 'user-1')).rejects.toThrow('Case required');
    });

    it('should throw if case not found', async () => {
      caseRepoMock.findOne.mockResolvedValue(null);
      await expect(service.create({ caseId: 'case-1' } as any, 'user-1')).rejects.toThrow('Case not found');
    });

    it('should throw if case not disbursed', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.APPROVED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      await expect(service.create({ caseId: 'case-1', workerSignatureUrl: 'sig.png' } as any, 'user-1')).rejects.toThrow('Case must be disbursed first');
    });

    it('should throw if no worker signature', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      await expect(service.create({ caseId: 'case-1' } as any, 'user-1')).rejects.toThrow('Worker signature required');
    });

    it('should create intervention after disbursed case', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      const created = {
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.REGULAR,
        workerSignatureUrl: 'sig.png',
        caseId: 'case-1',
        loggedById: 'user-1',
      };
      interventionRepoMock.create.mockReturnValue(created);
      interventionRepoMock.save.mockResolvedValue(created);

      const result = await service.create({
        caseId: 'case-1',
        interventionType: InterventionType.FA,
        amount: 5000,
        workerSignatureUrl: 'sig.png',
      } as any, 'user-1');

      expect(interventionRepoMock.create).toHaveBeenCalled();
      expect(interventionRepoMock.save).toHaveBeenCalled();
      expect(result).toHaveProperty('caseId', 'case-1');
    });
  });

  describe('findByCase', () => {
    it('should return interventions for a case', async () => {
      const items = [{ id: '1', caseId: 'case-1' }] as Intervention[];
      interventionRepoMock.find.mockResolvedValue(items);
      const result = await service.findByCase('case-1');
      expect(result).toHaveLength(1);
      expect(interventionRepoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' } });
    });
  });

  describe('findAll', () => {
    it('should return all interventions', async () => {
      const items = [{ id: '1' }, { id: '2' }] as Intervention[];
      interventionRepoMock.find.mockResolvedValue(items);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should return intervention by id', async () => {
      const item = { id: '1' } as Intervention;
      interventionRepoMock.findOne.mockResolvedValue(item);
      const result = await service.findById('1');
      expect(result).toEqual(item);
    });

    it('should throw if not found', async () => {
      interventionRepoMock.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow('Intervention not found');
    });
  });
});
