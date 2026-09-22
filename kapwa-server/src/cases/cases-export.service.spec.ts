import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CasesExportService } from './cases-export.service';
import { OrgService } from '../common/org.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { FilingService } from '../filing/filing.service';
import { GisExportService } from '../gis/gis-export.service';
import { IrfExportService } from '../irf/irf-export.service';

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
        { provide: GisExportService, useValue: { generateGisPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF')) } },
        { provide: IrfExportService, useValue: { buildIrfPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF')) } },
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

  it('issues COE and PCV once each and reuses the stored URL', async () => {
    const filedUrl = '/filing/doc-1/download';
    const caseRepo = {
      findOne: jest.fn()
        .mockResolvedValueOnce({ ...baseCase, certificateUrl: undefined })
        .mockResolvedValueOnce({ ...baseCase, certificateUrl: filedUrl })
        .mockResolvedValueOnce({ ...baseCase, pettyCashVoucherUrl: undefined })
        .mockResolvedValueOnce({ ...baseCase, pettyCashVoucherUrl: filedUrl }),
      save: jest.fn(async (x: any) => x),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    const filing = { upload: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
    const svc: any = new (CasesExportService as any)(caseRepo, {} as any, {} as any, filing, {} as any);
    svc.org = { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') };

    await expect(svc.issueCoe('c1', 'u1')).resolves.toBe(filedUrl);
    await expect(svc.issueCoe('c1', 'u1')).resolves.toBe(filedUrl);
    await expect(svc.issuePcv('c1', 'u1')).resolves.toBe(filedUrl);
    await expect(svc.issuePcv('c1', 'u1')).resolves.toBe(filedUrl);

    expect(filing.upload).toHaveBeenCalledTimes(2);
    const coe = filing.upload.mock.calls[0][0];
    const pcv = filing.upload.mock.calls[1][0];
    expect(coe.originalname).toBe('COE-KAPWA-2026-0001.pdf');
    expect(pcv.originalname).toBe('PCV-KAPWA-2026-0001.pdf');
    expect((coe.buffer as Buffer).toString('latin1')).toContain('%PDF');
    expect(caseRepo.save).toHaveBeenCalledTimes(2);
  });

  it('does not re-file or re-save when the document already exists', async () => {
    const filedUrl = '/filing/doc-9/download';
    const caseRepo = {
      findOne: jest.fn().mockResolvedValue({ ...baseCase, certificateUrl: filedUrl }),
      save: jest.fn(),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    const filing = { upload: jest.fn() };
    const svc: any = new (CasesExportService as any)(caseRepo, {} as any, {} as any, filing, {} as any);

    await expect(svc.issueCoe('c1', 'u1')).resolves.toBe(filedUrl);
    expect(filing.upload).not.toHaveBeenCalled();
    expect(caseRepo.save).not.toHaveBeenCalled();
  });
});

describe('CasesExportService — CSR bundle', () => {
  const bundleCase = () => ({
    id: 'c1', controlNo: 'KAPWA-2026-0001', status: CaseStatus.CLOSED, clientCategory: 'Senior',
    serviceRequested: ['Financial Assistance'], updatedAt: new Date('2026-08-01'),
    beneficiary: {
      id: 'b1',
      person: {
        surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M', gender: 'Male',
        phone: '09171234567', philsysNumber: '1234-5678-9012', dob: new Date('1950-01-01'),
        address: 'Poblacion', currentAddress: { barangay: 'Poblacion' },
      },
      household: { barangay: 'Poblacion' },
    },
  });

  it('composes cover + PCV + COE + GIS through the merge step', async () => {
    const caseRepo = { findOne: jest.fn().mockResolvedValue(bundleCase()), manager: { query: jest.fn().mockResolvedValue([]) } };
    const gis = { generateGisPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
    const svc: any = new (CasesExportService as any)(caseRepo, {} as any, {} as any, {} as any, {} as any, gis, {} as any);
    svc.org = { officeName: jest.fn().mockResolvedValue('MSWDO') };
    jest.spyOn(svc, 'buildCsrCover').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'buildPettyCashVoucher').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'buildCertificateOfEligibility').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'mergePdfs').mockResolvedValue(Buffer.from('%PDF-merged'));

    const out = await svc.generateCsrPdf('c1');

    expect(out.toString()).toBe('%PDF-merged');
    expect(svc.buildCsrCover).toHaveBeenCalled();
    expect(svc.buildPettyCashVoucher).toHaveBeenCalled();
    expect(svc.buildCertificateOfEligibility).toHaveBeenCalled();
    expect(gis.generateGisPdf).toHaveBeenCalledWith('c1');
    expect(svc.mergePdfs).toHaveBeenCalledTimes(1);
    expect(svc.mergePdfs.mock.calls[0][0]).toHaveLength(4);
  });

  it('adds the IRF when one is linked to the case', async () => {
    const caseRepo = { findOne: jest.fn().mockResolvedValue(bundleCase()), manager: { query: jest.fn().mockResolvedValue([{ id: 'irf-1' }]) } };
    const gis = { generateGisPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
    const irfExport = { buildIrfPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF')) };
    const svc: any = new (CasesExportService as any)(caseRepo, {} as any, {} as any, {} as any, {} as any, gis, irfExport);
    svc.org = { officeName: jest.fn().mockResolvedValue('MSWDO') };
    jest.spyOn(svc, 'buildCsrCover').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'buildPettyCashVoucher').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'buildCertificateOfEligibility').mockResolvedValue(Buffer.from('%PDF'));
    jest.spyOn(svc, 'mergePdfs').mockResolvedValue(Buffer.from('%PDF-merged'));

    await svc.generateCsrPdf('c1');

    expect(irfExport.buildIrfPdfBuffer).toHaveBeenCalledWith('irf-1', {});
    expect(svc.mergePdfs.mock.calls[0][0]).toHaveLength(5);
  });

  it('merges real PDF buffers into one multi-page file', async () => {
    const { PDFDocument } = require('pdf-lib');
    const page = async () => { const d = await PDFDocument.create(); d.addPage(); return Buffer.from(await d.save()); };
    const caseRepo = { findOne: jest.fn().mockResolvedValue(bundleCase()), manager: { query: jest.fn().mockResolvedValue([]) } };
    const gis = { generateGisPdf: jest.fn().mockResolvedValue(await page()) };
    const svc: any = new (CasesExportService as any)(caseRepo, {} as any, {} as any, {} as any, {} as any, gis, {} as any);
    svc.org = { officeName: jest.fn().mockResolvedValue('MSWDO') };
    jest.spyOn(svc, 'buildCsrCover').mockResolvedValue(await page());
    jest.spyOn(svc, 'buildPettyCashVoucher').mockResolvedValue(await page());
    jest.spyOn(svc, 'buildCertificateOfEligibility').mockResolvedValue(await page());

    const out = await svc.generateCsrPdf('c1');
    const doc = await PDFDocument.load(out);

    expect(out.subarray(0, 5).toString()).toBe('%PDF-');
    expect(doc.getPageCount()).toBe(4);
  });
});

describe('CasesExportService — document field mapping', () => {
  const caseFixture = {
    beneficiary: {
      person: {
        surname: 'Dela Cruz',
        firstName: 'Juan',
        middleName: 'M',
        address: 'Poblacion',
        currentAddress: { barangay: 'Poblacion' },
      },
    },
  };
  const make = (query: jest.Mock) =>
    new (CasesExportService as any)({ manager: { query } }, {} as any, {} as any, {} as any, {} as any) as CasesExportService;

  it('formats the beneficiary name as Last Name, First Name and Middle Initial', () => {
    const svc = make(jest.fn().mockResolvedValue([]));
    expect((svc as any).beneficiaryDocumentName(caseFixture)).toBe('Dela Cruz, Juan M.');
    const withExt = {
      beneficiary: { person: { surname: 'Reyes', firstName: 'Pedro', middleName: 'P', extension: 'Jr.' } },
    };
    expect((svc as any).beneficiaryDocumentName(withExt)).toBe('Reyes, Pedro P. Jr.');
  });

  it('falls back to N/A when the beneficiary person is missing', () => {
    const svc = make(jest.fn().mockResolvedValue([]));
    expect((svc as any).beneficiaryDocumentName({})).toBe('N/A');
  });

  it('returns the complete beneficiary address', () => {
    const svc = make(jest.fn().mockResolvedValue([]));
    expect((svc as any).beneficiaryAddress(caseFixture)).toBe('Poblacion');
    expect((svc as any).beneficiaryAddress({})).toBe('');
  });

  it('resolves the acting admin signatory by id', async () => {
    const query = jest.fn().mockResolvedValue([
      { first_name: 'Rosario', middle_name: 'G.', last_name: 'Mendoza', name_extension: null },
    ]);
    const svc = make(query);
    await expect((svc as any).signatoryName('u1')).resolves.toBe('Rosario G. Mendoza');
    expect(query.mock.calls[0][0]).toMatch(/FROM users WHERE id = \$1/);
  });

  it('falls back to the first active admin and appends the name extension', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { first_name: 'Felicisimo', middle_name: 'I.', last_name: 'Santiago', name_extension: 'Jr.' },
      ]);
    const svc = make(query);
    await expect((svc as any).signatoryName('u1')).resolves.toBe('Felicisimo I. Santiago Jr.');
    expect(query.mock.calls[1][0]).toMatch(/role = 'admin'/);
  });

  it('returns a blank signatory when the lookup fails', async () => {
    const svc = make(jest.fn().mockRejectedValue(new Error('db down')));
    await expect((svc as any).signatoryName()).resolves.toBe('');
  });
});

describe('CasesExportService — missingRequiredDocuments', () => {
  it('returns only required keys with no filed document, scoped to the case', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ document_key: 'A' }, { document_key: 'B' }])
      .mockResolvedValueOnce([{ requirement_key: 'A' }, { requirement_key: 'Z' }]);
    const caseRepo = { manager: { query } };
    const svc = new (CasesExportService as any)(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual(['B']);
    expect(query.mock.calls[0][0]).toMatch(/WHERE ci\.case_id = \$1/);
    expect(query.mock.calls[0][1]).toEqual(['c1']);
    expect(query.mock.calls[1][0]).toMatch(/WHERE case_id = \$1/);
    expect(query.mock.calls[1][0]).toMatch(/category = 'requirement'/);
    expect(query.mock.calls[1][1]).toEqual(['c1']);
  });

  it('passes when no program requires documents', async () => {
    const caseRepo = { manager: { query: jest.fn().mockResolvedValueOnce([]) } };
    const svc = new (CasesExportService as any)(caseRepo as any, {} as any, {} as any, {} as any, {} as any);
    await expect(svc.missingRequiredDocuments('c1')).resolves.toEqual([]);
  });
});