import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention } from '../interventions/intervention.entity';
import { CsrService } from './csr.service';
import { CsrRecord } from './csr.entity';

describe('CsrService', () => {
  let service: CsrService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ seq: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrService,
        { provide: getRepositoryToken(CsrRecord), useValue: repoMock },
        { provide: getRepositoryToken(Intervention), useValue: repoMock },
      ],
    }).compile();

    service = module.get<CsrService>(CsrService);
  });

  it('creates CSR and generates control number', async () => {
    repoMock.query.mockResolvedValue([{ seq: 1 }]);
    repoMock.create.mockReturnValue({ controlNo: 'CSR-2026-0001' });
    repoMock.save.mockResolvedValue({ id: '1', controlNo: 'CSR-2026-0001', socialWorkerName: 'Jane SW', createdBy: 'user-1' });

    const result = await service.create(
      { caseId: 'case-uuid', socialWorkerName: 'Jane SW' },
      'user-1',
    );
    expect(result.controlNo).toBe('CSR-2026-0001');
    expect(result.createdBy).toBe('user-1');
  });

  it('increments control number', async () => {
    repoMock.query.mockResolvedValue([{ seq: 6 }]);
    repoMock.create.mockReturnValue({ controlNo: 'CSR-2026-0006' });
    repoMock.save.mockResolvedValue({ id: '2', controlNo: 'CSR-2026-0006' });

    const result = await service.create(
      { caseId: 'case-uuid', socialWorkerName: 'John' },
      'user-2',
    );
    expect(result.controlNo).toBe('CSR-2026-0006');
  });

  it('finds all CSR records ordered by date desc', async () => {
    const mockRecords = [
      { id: '1', controlNo: 'CSR-2026-0002', createdAt: new Date('2026-06-10') },
      { id: '2', controlNo: 'CSR-2026-0001', createdAt: new Date('2026-06-09') },
    ];
    repoMock.find.mockResolvedValue(mockRecords);
    const result = await service.findAll();
    expect(result).toHaveLength(2);
    expect(repoMock.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 100 });
  });

  it('finds CSR by id', async () => {
    const record = { id: 'csr-1', controlNo: 'CSR-2026-0001', socialWorkerName: 'Alice' };
    repoMock.findOne.mockResolvedValue(record);
    const result = await service.findById('csr-1');
    expect(result.controlNo).toBe('CSR-2026-0001');
  });

  it('throws when CSR not found by id', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.findById('nonexistent')).rejects.toThrow('CSR record not found');
  });

  it('finds CSR by control number', async () => {
    const record = { id: 'csr-1', controlNo: 'CSR-2026-0001' };
    repoMock.findOne.mockResolvedValue(record);
    const result = await service.findByControlNo('CSR-2026-0001');
    expect(result.id).toBe('csr-1');
  });

  it('throws when CSR not found by control number', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await expect(service.findByControlNo('CSR-2026-9999')).rejects.toThrow('CSR record not found');
  });

  it('updates CSR record', async () => {
    const record = { id: 'csr-1', controlNo: 'CSR-2026-0001', recommendation: 'Old', finalized: false };
    repoMock.findOne.mockResolvedValue(record);
    repoMock.save.mockResolvedValue({ ...record, recommendation: 'Updated rec', finalized: true });

    const result = await service.update('csr-1', { recommendation: 'Updated rec', finalized: true });
    expect(result.recommendation).toBe('Updated rec');
    expect(result.finalized).toBe(true);
  });

  it('deletes CSR record', async () => {
    const record = { id: 'csr-1', controlNo: 'CSR-2026-0001' };
    repoMock.findOne.mockResolvedValue(record);
    await service.remove('csr-1');
    expect(repoMock.remove).toHaveBeenCalledWith(record);
  });

  it('generates PDF buffer from control number', async () => {
    const record = {
      id: 'csr-1',
      controlNo: 'CSR-2026-0001',
      caseId: 'case-uuid',
      socialWorkerName: 'Jane SW',
      socialWorkerPosition: 'SWO I',
      referralOrigin: 'Barangay Bigte',
      reasonForReferral: 'Poverty',
      problemPresented: 'Food insufficiency',
      familyBackground: '4 siblings',
      socioEconomicProfile: 'Low income',
      assessmentAnalysis: 'Needs assistance',
      recommendation: 'FA recommended',
      interventionPlan: 'Monthly food aid',
      createdAt: new Date('2026-06-15'),
    };
    repoMock.findOne.mockResolvedValue(record);

    const buffer = await service.generatePdf('CSR-2026-0001');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  }, 30000);
});
