import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CasesExportService } from './cases-export.service';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';

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
    caseRepoMock = { find: jest.fn().mockResolvedValue([baseCase]) };
    historyRepoMock = {
      create: jest.fn((h: Partial<CaseHistory>) => h),
      save: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesExportService,
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(CaseHistory), useValue: historyRepoMock },
        { provide: getRepositoryToken(CaseIntervention), useValue: { find: jest.fn().mockResolvedValue([]) } },
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
});
