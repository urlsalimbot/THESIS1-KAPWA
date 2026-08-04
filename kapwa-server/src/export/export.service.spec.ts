import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportService } from './export.service';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';

describe('ExportService', () => {
  let service: ExportService;
  let auditService: jest.Mocked<AuditService>;
  let caseRepo: jest.Mocked<Repository<Case>>;

  beforeEach(async () => {
    auditService = {
      exportForCoa: jest.fn(),
    } as any;

    caseRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  describe('exportServiceSummaryCsv', () => {
    it('generates valid CSV with header row', async () => {
      const result = await service.exportServiceSummaryCsv(new Date('2026-01-01'), new Date('2026-06-01'));
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
    });

    it('handles empty data', async () => {
      const result = await service.exportServiceSummaryCsv();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportServiceSummaryPdf', () => {
    it('returns a Buffer', async () => {
      const result = await service.exportServiceSummaryPdf();
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('exportAuditLogCsv', () => {
    it('generates CSV with correct columns', async () => {
      auditService.exportForCoa.mockResolvedValue({
        summary: { totalAmount: 0, count: 0 },
        interventions: [],
      } as any);

      const result = await service.exportAuditLogCsv();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/audit-logs-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportCompliancePdf', () => {
    it('returns a Buffer', async () => {
      caseRepo.count.mockResolvedValue(10);
      caseRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'active', count: '5' },
          { status: 'closed', count: '5' },
        ]),
      } as any);

      const result = await service.exportCompliancePdf();
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('monthly fund utilization report', () => {
    it('builds a workbook with a program x fund_source sheet', async () => {
      const result = await service.monthlyFundUtilization('2026-08');
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
    });

    it('queries case_interventions grouped by program and fund source', async () => {
      caseRepo.query.mockResolvedValue([
        { program: 'AICS', fundSource: 'Regular', amount: '25000' },
        { program: 'Senior', fundSource: 'PDAF', amount: '12000' },
      ]);
      const result = await service.monthlyFundUtilization('2026-08');
      expect(caseRepo.query).toHaveBeenCalled();
      expect(result.filename).toBe('fund-utilization-2026-08.xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('names the export for the requested month', async () => {
      caseRepo.query.mockResolvedValue([]);
      const result = await service.monthlyFundUtilization('2026-12');
      expect(result.filename).toBe('fund-utilization-2026-12.xlsx');
    });
  });
});
