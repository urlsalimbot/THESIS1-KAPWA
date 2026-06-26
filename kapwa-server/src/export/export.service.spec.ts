import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportService } from './export.service';
import { Intervention } from '../interventions/intervention.entity';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';

describe('ExportService', () => {
  let service: ExportService;
  let auditService: jest.Mocked<AuditService>;
  let intRepo: jest.Mocked<Repository<Intervention>>;
  let caseRepo: jest.Mocked<Repository<Case>>;

  beforeEach(async () => {
    auditService = {
      exportForCoa: jest.fn(),
    } as any;

    intRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    } as any;

    caseRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(Intervention), useValue: intRepo },
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  describe('exportServiceSummaryCsv', () => {
    it('generates valid CSV with header row', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { interventionType: 'FA', serviceCount: '5', totalAmount: '10000', uniqueHouseholds: '3' },
          { interventionType: 'CSR', serviceCount: '3', totalAmount: '5000', uniqueHouseholds: '2' },
        ]),
      };
      intRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.exportServiceSummaryCsv(new Date('2026-01-01'), new Date('2026-06-01'));
      const content = result.buffer.toString();
      expect(content).toContain('Program');
      expect(content).toContain('ServicesRendered');
      expect(content).toContain('FA');
      expect(content).toContain('CSR');
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
    });

    it('handles empty data', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      intRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.exportServiceSummaryCsv();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportServiceSummaryPdf', () => {
    it('returns a Buffer', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { interventionType: 'FA', serviceCount: '5', totalAmount: '10000', uniqueHouseholds: '3' },
        ]),
      };
      intRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.exportServiceSummaryPdf();
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('exportAuditLogCsv', () => {
    it('generates CSV with correct columns', async () => {
      auditService.exportForCoa.mockResolvedValue({
        summary: { totalAmount: 15000, count: 2 },
        interventions: [
          { date: '2026-03-01', type: 'FA', amount: 10000, voucherNo: 'V-001' },
          { date: '2026-03-15', type: 'CSR', amount: 5000, voucherNo: null },
        ],
      } as any);

      const result = await service.exportAuditLogCsv();
      const content = result.buffer.toString();
      expect(content).toContain('Date');
      expect(content).toContain('Type');
      expect(content).toContain('V-001');
      expect(content).toContain('CSR');
      expect(result.filename).toMatch(/audit-logs-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportCompliancePdf', () => {
    it('returns Buffer', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'pending_assessment', count: '10' },
          { status: 'approved', count: '5' },
        ]),
      };
      caseRepo.createQueryBuilder.mockReturnValue(mockQb as any);
      caseRepo.count.mockResolvedValue(15);

      const result = await service.exportCompliancePdf();
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
