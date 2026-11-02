import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportService } from './export.service';
import { OrgService } from '../common/org.service';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';

describe('ExportService', () => {
  let service: ExportService;
  let auditService: jest.Mocked<AuditService>;
  let caseRepo: jest.Mocked<Repository<Case>>;

  beforeEach(async () => {
    auditService = {
      getAuditLog: jest.fn(),
    } as any;

    caseRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: OrgService, useValue: { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') } },
        { provide: getRepositoryToken(Case), useValue: caseRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  describe('exportServiceSummaryCsv', () => {
    it('writes the header and the aggregated rows', async () => {
      caseRepo.query.mockResolvedValue([
        { program: 'AICS', category: 'Medical', services: 3, amount: '4500', households: 2 },
      ]);
      const result = await service.exportServiceSummaryCsv('2026-01-01', '2026-06-01');
      const text = result.buffer.toString('utf8');
      expect(text.split('\n')[0]).toBe('Program,Category,Services Rendered,Total Amount,Unique Households');
      expect(text).toContain('AICS,Medical,3,4500,2');
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
      const [sql, params] = caseRepo.query.mock.calls[0];
      expect(sql).toContain('case_interventions');
      expect(params).toEqual(['2026-01-01', '2026-06-01']);
    });

    it('still emits a header when there is no data', async () => {
      caseRepo.query.mockResolvedValue([]);
      const result = await service.exportServiceSummaryCsv();
      expect(result.buffer.toString('utf8').trim()).toBe('Program,Category,Services Rendered,Total Amount,Unique Households');
      expect(result.filename).toMatch(/service-summary-\d{4}-\d{2}-\d{2}\.csv/);
    });
  });

  describe('exportAuditLogCsv', () => {
    it('generates CSV with correct columns', async () => {
      auditService.getAuditLog.mockResolvedValue([
        { action: 'case.create', reference_id: 'c1', user_name: 'Rosario Mendoza', created_at: new Date('2026-09-09T00:00:00Z') },
      ] as any);

      const result = await service.exportAuditLogCsv();
      const text = result.buffer.toString('utf8');
      expect(result.filename).toBe('audit-logs.csv');
      expect(text).toContain('action,table,entity,actor,timestamp');
      expect(text).toContain('case.create,case,c1,Rosario Mendoza,');
    });

    it('keeps only rows inside the requested Manila date range, end day inclusive', async () => {
      auditService.getAuditLog.mockResolvedValue([
        { action: 'a.before', reference_id: '1', created_at: new Date('2026-09-30T23:59:00+08:00') },
        { action: 'a.first', reference_id: '2', created_at: new Date('2026-10-01T00:30:00+08:00') },
        { action: 'a.last', reference_id: '3', created_at: new Date('2026-10-02T23:00:00+08:00') },
        { action: 'a.after', reference_id: '4', created_at: new Date('2026-10-03T00:10:00+08:00') },
      ] as any);

      const result = await service.exportAuditLogCsv('2026-10-01', '2026-10-02');
      const text = result.buffer.toString('utf8');
      expect(text).toContain('a.first');
      expect(text).toContain('a.last');
      expect(text).not.toContain('a.before');
      expect(text).not.toContain('a.after');
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

    it('counts all interventions in the month (no case-status filter)', async () => {
      caseRepo.query.mockResolvedValue([]);
      await service.monthlyFundUtilization('2026-08');
      const [sql, params] = caseRepo.query.mock.calls[0];
      expect(sql).toContain('JOIN cases c ON c.id = ci.case_id');
      expect(sql).not.toContain('transitioning');
      expect(params).toEqual(['2026-08-01', '2026-09-01']);
    });

    it('joins on the uuid case id directly', async () => {
      caseRepo.query.mockResolvedValue([]);
      await service.monthlyFundUtilization('2026-08');
      const [sql] = caseRepo.query.mock.calls[0];
      expect(sql).toContain('c.id = ci.case_id');
      expect(sql).not.toContain('::text = ci.case_id');
    });
  });

  describe('certificate generation', () => {
    it('produces PDFs for eligibility and referral certificates with filenames', async () => {
      const result = await service.generateCertificate('eligibility', { fullName: 'Maria Santos', date: '2026-08-04', details: 'Approved for AICS assistance.' });
      expect(result.buffer.toString('ascii', 0, 4)).toBe('%PDF');
      expect(result.filename).toMatch(/^certificate-eligibility-\d+\.pdf$/);

      const referral = await service.generateCertificate('referral', { fullName: 'Pedro Reyes', address: 'Purok 3', date: '2026-08-04' });
      expect(referral.buffer.toString('ascii', 0, 4)).toBe('%PDF');
      expect(referral.filename).toMatch(/^certificate-referral-\d+\.pdf$/);
    });
  });
});
