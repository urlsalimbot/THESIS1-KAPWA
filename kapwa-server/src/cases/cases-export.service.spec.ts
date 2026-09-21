import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CasesExportService } from './cases-export.service';
import { OrgService } from '../common/org.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { FilingService } from '../filing/filing.service';

describe('CasesExportService', () => {
  let service: CasesExportService;
  let caseRepoMock: any;
  let historyRepoMock: any;

  const baseCase = {
    id: 'c1',
    controlNo: 'KAPWA-2026-0001',
    status: CaseStatus.ACTIVE,
    clientCategory: 'Senior',
    serviceRequested: ['Financial Assistance'],
    amountAssistance: '4500',
    updatedAt: new Date('2026-08-01'),
    beneficiary: {
      id: 'b1',
      person: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        middleName: 'M',
        gender: 'Male',
        phone: '09171234567',
        philsysNumber: '1234-5678-9012',
        dob: new Date('1950-01-01'),
        address: 'Poblacion',
        currentAddress: { barangay: 'Poblacion' },
      },
      household: { barangay: 'Poblacion' },
    },
  };

  beforeEach(async () => {
    caseRepoMock = { find: jest.fn().mockResolvedValue([baseCase]), findOne: jest.fn() };
    historyRepoMock = {
      create: jest.fn((h: Partial<CaseHistory>) => h),
      save: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesExportService,
        { provide: OrgService, useValue: { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') } },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(CaseHistory), useValue: historyRepoMock },
        { provide: getRepositoryToken(CaseIntervention), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: FilingService, useValue: { upload: jest.fn().mockResolvedValue({ id: 'doc-1' }) } },
      ],
    }).compile();

    service = module.get<CasesExportService>(CasesExportService);
  });

  it('returns CSV with masked PII by default', async () => {
    const buf = await service.buildBulkCsv(['c1'], true, undefined, 'u1', 'admin');
    const csv = buf.toString('utf8');
    expect(csv).toContain('Control No');
    expect(csv).toContain('KAPWA-2026-0001');
    expect(csv).toContain('***-***-****');
    expect(csv).toContain('****-***-****');
    expect(csv).not.toContain('09171234567');
    expect(csv).not.toContain('1234-5678-9012');
    expect(historyRepoMock.save).not.toHaveBeenCalled();
  });

  it('throws when unmasked export has no justification', async () => {
    await expect(service.buildBulkCsv(['c1'], false, undefined, 'u1', 'admin')).rejects.toThrow(BadRequestException);
    await expect(service.buildBulkCsv(['c1'], false, '   ', 'u1', 'admin')).rejects.toThrow(BadRequestException);
  });

  it('includes unmasked PII and writes audit history entries when justified', async () => {
    const buf = await service.buildBulkCsv(['c1'], false, 'COA audit request', 'u1', 'social_worker');
    const csv = buf.toString('utf8');
    expect(csv).toContain('09171234567');
    expect(csv).toContain('1234-5678-9012');
    expect(historyRepoMock.save).toHaveBeenCalledWith([
      expect.objectContaining({
        caseId: 'c1',
        transitionType: 'bulk_export_unmasked',
        changedById: 'u1',
        remarks: expect.stringContaining('COA audit request'),
      }),
    ]);
  });

  it('findIdByControlNo resolves a case id from a control number', async () => {
    caseRepoMock.findOne.mockResolvedValue({ id: 'c1', controlNo: 'KAPWA-2026-00008' });
    await expect(service.findIdByControlNo('KAPWA-2026-00008')).resolves.toBe('c1');
  });

  it('findIdByControlNo throws NotFound for unknown control numbers', async () => {
    caseRepoMock.findOne.mockResolvedValue(null);
    await expect(service.findIdByControlNo('KAPWA-9999')).rejects.toThrow(NotFoundException);
  });

  it('generates approval documents stamped with system office identity', async () => {
    caseRepoMock.findOne.mockResolvedValue({
      ...baseCase,
      interviewedBy: 'Maria Clara Santos',
      serviceRequested: ['Financial Assistance'],
      amountAssistance: '4500',
      sourceOfFund: 'AICS',
      beneficiary: { person: { firstName: 'Juan', middleName: 'M', surname: 'Dela Cruz', address: 'Poblacion, Norzagaray' } },
    });
    const filingMock = (service as any).filing;
    filingMock.upload.mockClear();
    filingMock.upload.mockResolvedValue({ id: 'doc-1' });

    await service.generateApprovalDocuments('c1', 'u1');

    expect(filingMock.upload).toHaveBeenCalledTimes(2);
    const coe = filingMock.upload.mock.calls[0][0];
    const pcv = filingMock.upload.mock.calls[1][0];
    expect(coe.originalname).toBe('COE-KAPWA-2026-0001.pdf');
    expect(pcv.originalname).toBe('PCV-KAPWA-2026-0001.pdf');
    const coeText = (coe.buffer as Buffer).toString('latin1');
    const pcvText = (pcv.buffer as Buffer).toString('latin1');
    expect(coeText).toContain('%PDF');
    expect(coeText).toContain('Municipal Social Welfare and Development Office');
    expect(pcvText).toContain('Municipal Social Welfare and Development Office');
  });
});

describe('CasesExportService — missingRequiredDocuments', () => {
  it('returns only required keys with no filed document, scoped to the case', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ document_key: 'A' }, { document_key: 'B' }])
      .mockResolvedValueOnce([{ requirement_key: 'A' }, { requirement_key: 'Z' }]);
    const caseRepo = { manager: { query } };
    const svc = new CasesExportService(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual(['B']);
    expect(query.mock.calls[0][0]).toMatch(/WHERE ci\.case_id = \$1/);
    expect(query.mock.calls[0][1]).toEqual(['c1']);
    expect(query.mock.calls[1][0]).toMatch(/WHERE case_id = \$1/);
    expect(query.mock.calls[1][1]).toEqual(['c1']);
  });

  it('passes when no program requires documents', async () => {
    const caseRepo = { manager: { query: jest.fn().mockResolvedValueOnce([]) } };
    const svc = new CasesExportService(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual([]);
  });
});