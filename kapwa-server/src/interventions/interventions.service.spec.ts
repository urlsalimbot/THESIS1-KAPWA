import { Test, TestingModule } from '@nestjs/testing';
import { InterventionsService } from './interventions.service';
import { Intervention, InterventionType, FundSource, SignatureStatus } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MinioService } from '../minio/minio.service';
import { TrackerService } from '../tracker/tracker.service';

describe('InterventionsService', () => {
  let service: InterventionsService;
  let interventionRepoMock: any;
  let caseRepoMock: any;
  let minioServiceMock: any;
  let trackerServiceMock: any;

  beforeEach(async () => {
    interventionRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([{ cnt: 0 }]),
    };
    caseRepoMock = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([{ access_card_code: 'NORZ-AC-2024-0001' }]),
    };
    minioServiceMock = {
      uploadFile: jest.fn().mockResolvedValue('https://minio.example.com/signature.png'),
    };
    trackerServiceMock = {
      generateTrackerId: jest.fn().mockResolvedValue('NORZ-TRACK-2026-0622-001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionsService,
        { provide: getRepositoryToken(Intervention), useValue: interventionRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: MinioService, useValue: minioServiceMock },
        { provide: TrackerService, useValue: trackerServiceMock },
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
      const caseEntity = { id: 'case-1', status: CaseStatus.APPROVED } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      await expect(
        service.create({ caseId: 'case-1', interventionType: InterventionType.FA } as any, 'user-1'),
      ).rejects.toThrow('Case must be disbursed first');
    });

    it('should create intervention successfully', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.create.mockReturnValue({ id: 'int-1', caseId: 'case-1' });
      interventionRepoMock.save.mockResolvedValue({ id: 'int-1', caseId: 'case-1' });

      const result = await service.create(
        { caseId: 'case-1', interventionType: InterventionType.FA } as any,
        'user-1',
      );
      expect(result).toBeDefined();
      expect(result.intervention.id).toBe('int-1');
    });

    it('should set signatureStatus to PENDING by default', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.create.mockImplementation((dto: any) => dto);
      interventionRepoMock.save.mockImplementation((entity: any) => Promise.resolve({ ...entity, id: 'int-1' }));

      const result = await service.create(
        { caseId: 'case-1', interventionType: InterventionType.FA } as any,
        'user-1',
      );
      expect(result.intervention?.signatureStatus).toBe(SignatureStatus.PENDING);
    });

    it('should throw ConflictException for duplicate intervention within 30 days', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.findOne.mockResolvedValueOnce({ id: 'existing-int' });
      interventionRepoMock.query.mockResolvedValue([{ cnt: '1' }]);

      await expect(
        service.create(
          { caseId: 'case-1', interventionType: InterventionType.FA, householdId: 'hh-1' } as any,
          'user-1',
        ),
      ).rejects.toThrow('Duplicate intervention');
    });
  });

  describe('No Card guard', () => {
    it('throws BadRequestException when no card and override not sent', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED, beneficiaryId: 'ben-1' } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      caseRepoMock.query.mockResolvedValueOnce([{ access_card_code: null }]);
      await expect(
        service.create({ caseId: 'case-1', interventionType: InterventionType.FA } as any, 'user-1')
      ).rejects.toThrow('overrideNoCardCheck');
    });

    it('returns warning when no card and overrideNoCardCheck=true', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED, beneficiaryId: 'ben-1' } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      caseRepoMock.query.mockResolvedValueOnce([{ access_card_code: null }]);
      interventionRepoMock.create.mockReturnValue({ id: 'int-1' });
      interventionRepoMock.save.mockResolvedValue({ id: 'int-1' });
      const result = await service.create(
        { caseId: 'case-1', interventionType: InterventionType.FA, overrideNoCardCheck: true } as any,
        'user-1'
      );
      expect(result.warning).toBeDefined();
      expect(result.intervention).toBeDefined();
    });

    it('throws BadRequestException when no card and overrideNoCardCheck=false', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED, beneficiaryId: 'ben-1' } as unknown as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      caseRepoMock.query.mockResolvedValueOnce([{ access_card_code: null }]);
      await expect(
        service.create(
          { caseId: 'case-1', interventionType: InterventionType.FA, overrideNoCardCheck: false } as any,
          'user-1'
        )
      ).rejects.toThrow('overrideNoCardCheck');
    });
  });

  describe('uploadSignature', () => {
    it('should upload signature via MinioService', async () => {
      const result = await service.uploadSignature(Buffer.from('mock'), 'sig.png', 'image/png');
      expect(minioServiceMock.uploadFile).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('uploadReceipt', () => {
    it('should upload receipt via MinioService', async () => {
      const result = await service.uploadReceipt(Buffer.from('mock'), 'receipt.png', 'image/png');
      expect(minioServiceMock.uploadFile).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findByCase', () => {
    it('should return interventions for a case', async () => {
      interventionRepoMock.find.mockResolvedValue([
        { id: 'int-1', interventionType: InterventionType.FA },
        { id: 'int-2', interventionType: InterventionType.CSR },
      ]);
      const result = await service.findByCase('case-1');
      expect(interventionRepoMock.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });
});
