import { Test, TestingModule } from '@nestjs/testing';
import { InterventionsService } from './interventions.service';
import { Intervention, InterventionType, FundSource, SignatureStatus } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MinioService } from '../minio/minio.service';

describe('InterventionsService', () => {
  let service: InterventionsService;
  let interventionRepoMock: any;
  let caseRepoMock: any;
  let minioServiceMock: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionsService,
        { provide: getRepositoryToken(Intervention), useValue: interventionRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: MinioService, useValue: minioServiceMock },
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

    // Test 1: create() throws BadRequestException if case status is not disbursed (INT-01)
    it('should throw if case not disbursed', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.APPROVED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      await expect(
        service.create({ caseId: 'case-1', workerSignatureUrl: 'sig.png' } as any, 'user-1'),
      ).rejects.toThrow('Case must be disbursed first');
    });

    // Test 2: create() succeeds with workerSignatureUrl, returns intervention with signatures_collected status
    it('should succeed with workerSignatureUrl and set signatureStatus to collected', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      // Mock household_id query
      interventionRepoMock.query
        .mockResolvedValueOnce([{ cnt: 0 }])           // duplicate check
        .mockResolvedValueOnce([{ id: 'hh-1' }]);       // household_id lookup
      const created = {
        id: 'new-int-1',
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.REGULAR,
        workerSignatureUrl: 'sig.png',
        clientSignatureUrl: undefined,
        clientReceiptUrl: undefined,
        signatureStatus: SignatureStatus.COLLECTED,
        householdId: 'hh-1',
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
      expect(result).toHaveProperty('signatureStatus', SignatureStatus.COLLECTED);
    });

    // Test 3: create() succeeds without workerSignatureUrl but with signatureStatus='signatures_pending' (D-15 deferrable)
    it('should succeed without workerSignatureUrl and set signatureStatus to pending', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.query
        .mockResolvedValueOnce([{ cnt: 0 }])           // duplicate check
        .mockResolvedValueOnce([{ id: 'hh-1' }]);       // household_id lookup
      const created = {
        id: 'new-int-2',
        interventionType: InterventionType.FA,
        amount: 3000,
        fundSource: FundSource.REGULAR,
        workerSignatureUrl: undefined,
        signatureStatus: SignatureStatus.PENDING,
        householdId: 'hh-1',
        caseId: 'case-1',
        loggedById: 'user-1',
      };
      interventionRepoMock.create.mockReturnValue(created);
      interventionRepoMock.save.mockResolvedValue(created);

      const result = await service.create({
        caseId: 'case-1',
        interventionType: InterventionType.FA,
        amount: 3000,
      } as any, 'user-1');

      expect(interventionRepoMock.create).toHaveBeenCalled();
      expect(interventionRepoMock.save).toHaveBeenCalled();
      expect(result).toHaveProperty('signatureStatus', SignatureStatus.PENDING);
    });

    // Test 4: create() throws BadRequestException if duplicate exists within 30 days (INT-03, D-12)
    it('should throw if duplicate intervention found within 30 days', async () => {
      const caseEntity = { id: 'case-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.query.mockResolvedValueOnce([{ cnt: 1 }]);

      await expect(
        service.create({
          caseId: 'case-1',
          interventionType: InterventionType.FA,
        } as any, 'user-1'),
      ).rejects.toThrow(/duplicate/i);
    });

    // Test 5: create() stores fundSource when provided (INT-08)
    it('should store fundSource when provided', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.query
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ id: 'hh-1' }]);
      const created = {
        id: 'new-int-3',
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.PDAF,
        workerSignatureUrl: 'sig.png',
        signatureStatus: SignatureStatus.COLLECTED,
        householdId: 'hh-1',
        caseId: 'case-1',
        loggedById: 'user-1',
      };
      interventionRepoMock.create.mockReturnValue(created);
      interventionRepoMock.save.mockResolvedValue(created);

      const result = await service.create({
        caseId: 'case-1',
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.PDAF,
        workerSignatureUrl: 'sig.png',
      } as any, 'user-1');

      expect(result).toHaveProperty('fundSource', FundSource.PDAF);
    });

    // Test 6: create() defaults fundSource to REGULAR when not provided
    it('should default fundSource to REGULAR when not provided', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.query
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ id: 'hh-1' }]);
      const created = {
        id: 'new-int-4',
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.REGULAR,
        workerSignatureUrl: 'sig.png',
        signatureStatus: SignatureStatus.COLLECTED,
        householdId: 'hh-1',
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

      expect(result).toHaveProperty('fundSource', FundSource.REGULAR);
    });

    // Test 7: create() populates householdId from case→beneficiary→household JOIN
    it('should populate householdId from case-beneficiary-household join', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      interventionRepoMock.query
        .mockResolvedValueOnce([{ cnt: 0 }])           // duplicate check returns 0
        .mockResolvedValueOnce([{ id: 'hh-1' }]);       // household_id query
      const created = {
        id: 'new-int-5',
        interventionType: InterventionType.FA,
        amount: 5000,
        fundSource: FundSource.REGULAR,
        workerSignatureUrl: 'sig.png',
        householdId: 'hh-1',
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

      expect(result).toHaveProperty('householdId', 'hh-1');
    });

    // Test 8: create() still requires access_card_code ("No Card = No Voucher" guard)
    it('should throw if beneficiary has no access card code', async () => {
      const caseEntity = { id: 'case-1', beneficiaryId: 'ben-1', status: CaseStatus.DISBURSED } as Case;
      caseRepoMock.findOne.mockResolvedValue(caseEntity);
      // Mock to return no access_card_code
      caseRepoMock.query.mockResolvedValueOnce([{ access_card_code: null }]);

      await expect(
        service.create({
          caseId: 'case-1',
          interventionType: InterventionType.FA,
          workerSignatureUrl: 'sig.png',
        } as any, 'user-1'),
      ).rejects.toThrow(/no card/i);
    });
  });

  describe('uploadSignature', () => {
    it('should upload signature to MinIO and return URL', async () => {
      const buffer = Buffer.from('fake-image-data');
      const url = await service.uploadSignature(buffer, 'sig-123.png', 'image/png');
      expect(minioServiceMock.uploadFile).toHaveBeenCalledWith(
        'worker-signatures',
        'sig-123.png',
        buffer,
        'image/png',
      );
      expect(url).toBe('https://minio.example.com/signature.png');
    });
  });

  describe('uploadReceipt', () => {
    it('should upload receipt to MinIO and return URL', async () => {
      const buffer = Buffer.from('fake-receipt-data');
      const url = await service.uploadReceipt(buffer, 'receipt-123.png', 'image/png');
      expect(minioServiceMock.uploadFile).toHaveBeenCalledWith(
        'client-receipts',
        'receipt-123.png',
        buffer,
        'image/png',
      );
      expect(url).toBe('https://minio.example.com/signature.png');
    });
  });

  describe('findByCase', () => {
    it('should return interventions for a case', async () => {
      const items = [{ id: '1', caseId: 'case-1' }] as Intervention[];
      interventionRepoMock.find.mockResolvedValue(items);
      const result = await service.findByCase('case-1');
      expect(result).toHaveLength(1);
      expect(interventionRepoMock.find).toHaveBeenCalledWith({ where: { caseId: 'case-1' }, take: 100 });
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
