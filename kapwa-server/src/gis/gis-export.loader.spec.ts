import { NotFoundException } from '@nestjs/common';
import { CaseStatus } from '../cases/case.entity';
import { loadGisData } from './gis-export.loader';

describe('loadGisData', () => {
  const baseCase = {
    id: 'c1',
    controlNo: 'KAPWA-2026-0001',
    status: CaseStatus.ACTIVE,
    clientCategory: 'Indigent People',
    renewalOfCaseId: null,
    referralRows: [{ reason: 'Medical' }],
    assignedWorkerName: 'Maria Santos',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    beneficiary: {
      id: 'b1',
      personId: 'p1',
      person: {
        surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M', extension: 'Jr.',
        gender: 'Male', dob: new Date('1990-05-15'), placeOfBirth: 'Norzagaray',
        civilStatus: 'Married', occupation: 'Fisherman', estimatedMonthlyIncome: '5000',
        phone: '09171234567',
        addresses: [{ addressType: 'current', raw: 'Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan' }],
      },
      household: {
        members: [
          { relationship: 'Self', person: { surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M', dob: new Date('1990-05-15'), occupation: 'Fisherman', estimatedMonthlyIncome: '5000' } },
          { relationship: 'Wife', person: { surname: 'Dela Cruz', firstName: 'Maria', middleName: 'L', dob: new Date('1993-08-20'), occupation: 'Tindera', estimatedMonthlyIncome: '2500' } },
        ],
      },
    },
  };

  const caseRepoMock = { findOne: jest.fn() };
  const claimantRepoMock = { findOne: jest.fn() };
  const interventionRepoMock = { find: jest.fn() };
  const deps: any = { caseRepo: caseRepoMock, claimantRepo: claimantRepoMock, interventionRepo: interventionRepoMock };

  beforeEach(() => {
    jest.clearAllMocks();
    caseRepoMock.findOne.mockResolvedValue(baseCase);
    claimantRepoMock.findOne.mockResolvedValue({
      relationship: 'Son',
      claimant: { surname: 'Dela Cruz', firstName: 'Pedro', middleName: 'P', gender: 'Male', dob: new Date('2000-01-01'), civilStatus: 'Single', occupation: 'Student', estimatedMonthlyIncome: '0' },
    });
    interventionRepoMock.find.mockResolvedValue([
      { caseId: 'c1', serviceName: 'FOOD ASSISTANCE', amount: '3000', fundSource: '4Ps' },
      { caseId: 'c1', serviceName: 'Medical', amount: null, fundSource: null },
    ]);
  });

  it('maps a case to GisPdfData', async () => {
    const data = await loadGisData(deps, 'c1');
    expect(data.controlNo).toBe('KAPWA-2026-0001');
    expect(data.beneficiary.surname).toBe('Dela Cruz');
    expect(data.beneficiary.address.barangay).toBe('Bigte');
    expect(data.beneficiary.phone).toBe('09171234567');
    expect(data.claimant.surname).toBe('Dela Cruz');
    expect(data.claimant.relationshipToBeneficiary).toBe('Son');
    expect(data.familyMembers).toHaveLength(2);
    expect(data.familyMembers[1].fullName).toContain('Maria');
    expect(data.familyMembers[1].relationship).toBe('Wife');
    expect(data.interventions[0].provided).toBe('FOOD ASSISTANCE');
    expect(data.interventions[0].amount).toBe(3000);
    expect(data.interventions[0].fundSource).toBe('4Ps');
    expect(data.referrals).toHaveLength(1);
    expect(data.hasRenewal).toBe(false);
    expect(data.assignedWorkerName).toBe('Maria Santos');
  });

  it('throws NotFoundException when the case is missing', async () => {
    caseRepoMock.findOne.mockResolvedValue(null);
    await expect(loadGisData(deps, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('never throws when beneficiary/person data is absent (blanks)', async () => {
    caseRepoMock.findOne.mockResolvedValue({ ...baseCase, beneficiary: null });
    claimantRepoMock.findOne.mockResolvedValue(null);
    const data = await loadGisData(deps, 'c1');
    expect(data.controlNo).toBe('KAPWA-2026-0001');
    expect(data.beneficiary.surname).toBe('');
    expect(data.beneficiary.sex).toBe('');
  });

  it('flags renewal when renewalOfCaseId is set', async () => {
    caseRepoMock.findOne.mockResolvedValue({ ...baseCase, renewalOfCaseId: 'c0' });
    const data = await loadGisData(deps, 'c1');
    expect(data.hasRenewal).toBe(true);
  });
});
