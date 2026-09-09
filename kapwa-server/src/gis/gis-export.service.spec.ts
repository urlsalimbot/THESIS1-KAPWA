import { NotFoundException } from '@nestjs/common';
import { CaseStatus } from '../cases/case.entity';
import { GisExportService } from './gis-export.service';

describe('GisExportService', () => {
  const baseCase = {
    id: 'c1',
    controlNo: 'KAPWA-2026-0001',
    status: CaseStatus.ACTIVE,
    clientCategory: 'Indigent People',
    referralRows: [],
    assignedWorkerName: 'Maria Santos',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    beneficiary: {
      id: 'b1',
      personId: 'p1',
      person: {
        surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male',
        dob: new Date('1990-05-15'),
        addresses: [{ addressType: 'current', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan' }],
      },
      household: { members: [] },
    },
  };

  const caseRepoMock = { findOne: jest.fn() };
  const claimantRepoMock = { findOne: jest.fn() };
  const interventionRepoMock = { find: jest.fn() };

  let service: GisExportService;
  beforeEach(() => {
    jest.clearAllMocks();
    caseRepoMock.findOne.mockResolvedValue(baseCase);
    claimantRepoMock.findOne.mockResolvedValue(null);
    interventionRepoMock.find.mockResolvedValue([]);
    service = new GisExportService(
      caseRepoMock as any,
      claimantRepoMock as any,
      interventionRepoMock as any,
    );
  });

  it('returns a PDF buffer for an existing case', async () => {
    const buf = await service.generateGisPdf('c1');
    expect(buf.toString('latin1')).toContain('%PDF');
    expect(buf.toString('latin1')).toContain('KAPWA-2026-0001');
  });

  it('throws NotFoundException for a missing case', async () => {
    caseRepoMock.findOne.mockResolvedValue(null);
    await expect(service.generateGisPdf('missing')).rejects.toThrow(NotFoundException);
  });

  it('returns the case controlNo for export filenames', async () => {
    await expect(service.controlNo('c1')).resolves.toBe('KAPWA-2026-0001');
  });

  it('falls back to the caseId when controlNo is missing', async () => {
    caseRepoMock.findOne.mockResolvedValue({ id: 'c1', controlNo: null });
    await expect(service.controlNo('c1')).resolves.toBe('c1');
  });

  it('throws NotFoundException for a missing case in controlNo', async () => {
    caseRepoMock.findOne.mockResolvedValue(null);
    await expect(service.controlNo('missing')).rejects.toThrow(NotFoundException);
  });
});
