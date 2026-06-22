import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FormVersionHistory } from './form-version-history.entity';
import { ProgramsService } from './programs.service';
import { Program } from './program.entity';

describe('ProgramsService', () => {
  let service: ProgramsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        { provide: getRepositoryToken(Program), useValue: repoMock },
        { provide: getRepositoryToken(FormVersionHistory), useValue: { create: jest.fn(), save: jest.fn() } },
      ],
    }).compile();
    service = module.get<ProgramsService>(ProgramsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('saves a new program', async () => {
      const data = { name: 'Test Program', category: 'Medical' };
      const saved = { id: '1', ...data, formVersion: 1, isActive: true };
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);
      const result = await service.create(data);
      expect(repoMock.create).toHaveBeenCalledWith(data);
      expect(repoMock.save).toHaveBeenCalledWith(saved);
      expect(result).toEqual(saved);
    });

    it('creates a program with all fields including approvalWorkflow as ApprovalStep[] and legalBasis', async () => {
      const data = {
        name: 'AICS',
        category: 'Medical Assistance',
        waitingPeriodDays: 3,
        legalBasis: 'RA 11223',
        requiredDocuments: ['Valid ID', 'Barangay Certificate'],
        fundSources: ['DSWD', 'LGU'],
        approvalWorkflow: [
          { stepName: 'Intake Review', approverRole: 'social_worker', slaDays: 3, order: 0 },
          { stepName: 'Supervisor Approval', approverRole: 'admin', slaDays: 5, order: 1 },
        ],
        isActive: true,
      };
      const saved = { id: '1', ...data, formVersion: 1 };
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);
      const result = await service.create(data);
      expect(repoMock.create).toHaveBeenCalledWith(data);
      expect(repoMock.save).toHaveBeenCalledWith(saved);
      expect(result.approvalWorkflow).toHaveLength(2);
      expect(result.approvalWorkflow![0].stepName).toBe('Intake Review');
      expect(result.approvalWorkflow![0].approverRole).toBe('social_worker');
      expect(result.legalBasis).toBe('RA 11223');
    });

    it('succeeds with empty approvalWorkflow array', async () => {
      const data = {
        name: 'Basic Program',
        approvalWorkflow: [],
      };
      const saved = { id: '2', name: 'Basic Program', approvalWorkflow: [], formVersion: 1, isActive: true };
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);
      const result = await service.create(data);
      expect(result.approvalWorkflow).toEqual([]);
    });

    it('succeeds without approvalWorkflow (undefined)', async () => {
      const data = { name: 'Simple Program' };
      const saved = { id: '3', name: 'Simple Program', formVersion: 1, isActive: true };
      repoMock.create.mockReturnValue(saved);
      repoMock.save.mockResolvedValue(saved);
      const result = await service.create(data);
      expect(result.approvalWorkflow).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns list of programs', async () => {
      const list = [
        { id: '1', name: 'AICS', formVersion: 1, isActive: true },
        { id: '2', name: 'Medical', formVersion: 1, isActive: true },
      ];
      repoMock.find.mockResolvedValue(list);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('AICS');
    });

    it('returns active only by default', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findAll();
      expect(repoMock.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });

  describe('update', () => {
    it('modifies fields including approvalWorkflow', async () => {
      const existing = {
        id: '1', name: 'Old Name',
        approvalWorkflow: [{ stepName: 'Step 1', approverRole: 'social_worker', slaDays: 3, order: 0 }],
        formVersion: 1, isActive: true,
      } as unknown as Program;
      repoMock.findOne.mockResolvedValueOnce(existing);
      repoMock.update.mockResolvedValue({ affected: 1 } as any);
      const updated = {
        ...existing,
        name: 'New Name',
        approvalWorkflow: [
          { stepName: 'New Step 1', approverRole: 'admin', slaDays: 5, order: 0 },
        ],
      };
      repoMock.findOne.mockResolvedValueOnce(updated);

      await service.update('1', {
        name: 'New Name',
        approvalWorkflow: [{ stepName: 'New Step 1', approverRole: 'admin', slaDays: 5, order: 0 }],
      } as any);
      expect(repoMock.update).toHaveBeenCalledWith('1', {
        name: 'New Name',
        approvalWorkflow: [{ stepName: 'New Step 1', approverRole: 'admin', slaDays: 5, order: 0 }],
      });
    });
  });

  describe('findById', () => {
    it('returns program with all fields intact', async () => {
      const prog = {
        id: '1',
        name: 'AICS',
        category: 'Medical',
        waitingPeriodDays: 3,
        legalBasis: 'RA 11223',
        requiredDocuments: ['Valid ID'],
        fundSources: ['DSWD'],
        approvalWorkflow: [
          { stepName: 'Review', approverRole: 'social_worker', slaDays: 3, order: 0 },
        ],
        formTemplate: { type: 'object', properties: {} },
        formVersion: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Program;
      repoMock.findOne.mockResolvedValue(prog);
      const result = await service.findById('1');
      expect(result.name).toBe('AICS');
      expect(result.legalBasis).toBe('RA 11223');
      expect(result.approvalWorkflow).toHaveLength(1);
      expect((result.approvalWorkflow as any[])[0].approverRole).toBe('social_worker');
    });
  });
});
