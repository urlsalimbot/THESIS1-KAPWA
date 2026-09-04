import { buildGisPdf } from './gis-pdf.builder';
import { GisPdfData } from './gis-export.types';

const fullData: GisPdfData = {
  controlNo: 'KAPWA-2026-0001',
  caseId: 'c1',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  hasRenewal: false,
  clientCategory: 'Indigent People',
  referrals: [{ reason: 'Medical' }],
  assignedWorkerName: 'Maria Santos',
  approvedByRole: 'social_worker',
  beneficiary: {
    surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M', extension: 'Jr.',
    sex: 'Male', dob: new Date('1990-05-15'), placeOfBirth: 'Norzagaray',
    civilStatus: 'Married', occupation: 'Fisherman', income: 5000, phone: '09171234567',
    address: { street: 'Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
  },
  claimant: {
    surname: 'Dela Cruz', firstName: 'Pedro', middleName: 'P',
    sex: 'Male', dob: new Date('2000-01-01'), civilStatus: 'Single',
    occupation: 'Student', income: 0, phone: '09201234567',
    address: { street: '', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
    relationshipToBeneficiary: 'Son',
  },
  familyMembers: [
    { fullName: 'Dela Cruz, Juan M', relationship: 'Self', age: 36, occupation: 'Fisherman', income: 5000 },
    { fullName: 'Dela Cruz, Maria L', relationship: 'Wife', age: 33, occupation: 'Tindera', income: 2500 },
  ],
  interventions: [
    { provided: 'FOOD ASSISTANCE', amount: 3000, fundSource: '4Ps' },
  ],
};

describe('buildGisPdf', () => {
  it('produces a PDF buffer with populated fields', async () => {
    const buf = await buildGisPdf(fullData);
    expect(buf[0]).toBe(0x25); // '%'
    const text = buf.toString('latin1');
    expect(text).toContain('%PDF');
    expect(text).toContain('KAPWA-2026-0001');
    expect(text).toContain('Dela Cruz');
    expect(text).toContain('Pedro');
    expect(text).toContain('FOOD ASSISTANCE');
    expect(text).toContain('4Ps');
    expect(text).toContain('It is evident that the family is in dire need');
    expect(text).toContain('Maria Santos');
    expect(text).toContain('GENERAL INTAKE SHEET');
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeLessThanOrEqual(3);
  });

  it('never crashes on minimal data (blanks)', async () => {
    const bare: GisPdfData = {
      controlNo: 'KAPWA-X',
      caseId: 'c9',
      createdAt: new Date(),
      hasRenewal: true,
      clientCategory: null,
      referrals: [],
      assignedWorkerName: null,
      beneficiary: {
        surname: '', firstName: '', sex: 'Male',
        address: { street: '', barangay: '', city: '', province: '', region: '' },
      },
      claimant: {
        surname: '', firstName: '', sex: 'Male',
        address: { street: '', barangay: '', city: '', province: '', region: '' },
      },
      familyMembers: [],
      interventions: [],
    };
    const buf = await buildGisPdf(bare);
    expect(buf.toString('latin1')).toContain('%PDF');
  });
});
