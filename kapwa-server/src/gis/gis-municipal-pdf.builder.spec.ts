import { buildMunicipalGisPdf } from './gis-municipal-pdf.builder';
import { GisPdfData } from './gis-export.types';
import { searchableText } from './gis-pdf-test.util';

// Municipal (MSWDO Norzagaray) General Intake Sheet — the second GIS
// variation. Assertions cover the form's own sections, the Filipino labels,
// the data the case supplies, and the MSWDO signatory block.

const municipalData: GisPdfData = {
  controlNo: 'MSWD-2026-00001',
  caseId: 'c1',
  createdAt: new Date('2026-10-05T10:00:00Z'),
  hasRenewal: false,
  clientCategory: 'Indigent People',
  referrals: [{ reason: 'Medical' }],
  assignedWorkerName: 'Juan D. Dela Cruz',
  approvedByRole: 'social_worker',
  officeName: 'MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE',
  assessment: 'Eligible for financial assistance; relatives cannot provide support.',
  problemsPresented: 'Natigil sa trabaho dahil sa sakit.',
  natureOfService: ['medical_assistance', 'transport_assistance'],
  modeFinancialAssistance: 'Cash',
  sourceOfFund: 'Regular Funds',
  legislatorSpecify: 'Hon. Sample Legislator',
  otherAssistance: { food_pack: {}, used_clothing: {} },
  beneficiary: {
    surname: 'Reyes',
    firstName: 'Pedro',
    middleName: 'Poblete',
    sex: 'Male',
    dob: new Date('1988-03-21'),
    age: 38,
    placeOfBirth: 'Norzagaray, Bulacan',
    civilStatus: 'Married',
    occupation: 'Tricycle Driver',
    income: 7000,
    phone: '09171000005',
    address: { street: 'Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
  },
  claimant: {
    surname: 'Reyes',
    firstName: 'Pedro',
    middleName: 'Poblete',
    sex: 'Male',
    address: { street: 'Purok 1', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
  },
  familyMembers: [
    { fullName: 'Reyes, Pedro P.', relationship: 'Self', age: 38, occupation: 'Tricycle Driver', income: 7000 },
    { fullName: 'Reyes, Elena R.', relationship: 'Spouse', age: 36, occupation: 'Housewife', income: 0 },
  ],
  interventions: [
    { provided: 'medical_assistance', amount: 5000, fundSource: 'Regular Funds', modeOfDelivery: 'Cash' },
    { provided: 'transport_assistance', amount: 1000, fundSource: 'Regular Funds', modeOfDelivery: 'Cash' },
  ],
};

describe('buildMunicipalGisPdf', () => {
  it('produces a single-page PDF with the municipal form sections', async () => {
    const buf = await buildMunicipalGisPdf(municipalData);
    expect(buf[0]).toBe(0x25); // '%'
    const text = searchableText(buf);
    expect(text).toContain('GENERAL INTAKE SHEET');
    expect(text).toContain('I. PERSONAL INFORMATION');
    expect(text).toContain('II. FAMILY COMPOSITION');
    expect(text).toContain('III. ASSESSMENT');
    expect(text).toContain('IV. RECOMMENDED SERVICES AND ASSISTANCE');
    const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBe(1);
  });

  it('prints the Filipino field labels of the paper form', async () => {
    const text = searchableText(await buildMunicipalGisPdf(municipalData));
    for (const label of [
      'Kliyente',
      'Apelyido',
      'Unang Pangalan',
      'Gitnang Apelyido',
      'Kasarian',
      'Kaarawan',
      'Natapos sa Pag-aaral',
      'Hanapbuhay',
      'Tirahan',
      'Pangalan',
      'Relasyon',
      'Trabaho',
      'Lagda ng Kliyente',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('fills the client, family and assessment data from the case', async () => {
    const text = searchableText(await buildMunicipalGisPdf(municipalData));
    expect(text).toContain('Reyes');
    expect(text).toContain('Pedro');
    expect(text).toContain('Poblete');
    expect(text).toContain('Tricycle Driver');
    expect(text).toContain('Bigte');
    expect(text).toContain('Reyes, Elena R.');
    expect(text).toContain('Natigil sa trabaho dahil sa sakit.');
    expect(text).toContain('Eligible for financial assistance; relatives cannot provide support.');
    expect(text).toContain('MSWD-2026-00001');
  });

  it('prints the service, amount and fund-source blocks', async () => {
    const text = searchableText(await buildMunicipalGisPdf(municipalData));
    expect(text).toContain('15. Nature of Service/Assistance');
    expect(text).toContain('Financial Assistance');
    expect(text).toContain('Counseling');
    expect(text).toContain('Legal Assistance');
    expect(text).toContain('Burial');
    expect(text).toContain('Amount of Financial Assistance');
    expect(text).toContain('PHP 6,000');
    expect(text).toContain('Mode of Financial Assistance');
    expect(text).toContain('Guarantee Letter');
    expect(text).toContain('Priority Development Assistance Fund');
    expect(text).toContain('Hon. Sample Legislator');
  });

  it('prints the MSWDO signatory block and the interviewing worker', async () => {
    const text = searchableText(await buildMunicipalGisPdf(municipalData));
    expect(text).toContain('Interviewed by');
    expect(text).toContain('Juan D. Dela Cruz');
    expect(text).toContain('Reviewed and Approved by');
    expect(text).toContain('ANNALYN JOY C. SAN PEDRO, RSW');
    expect(text).toContain('MSWDO');
  });

  it('never crashes on minimal data (blanks)', async () => {
    const empty: GisPdfData = {
      controlNo: 'X',
      caseId: 'c2',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      hasRenewal: false,
      referrals: [],
      beneficiary: {
        surname: '',
        firstName: '',
        sex: '',
        address: { street: '', barangay: '', city: '', province: '', region: '' },
      },
      claimant: {
        surname: '',
        firstName: '',
        sex: '',
        address: { street: '', barangay: '', city: '', province: '', region: '' },
      },
      familyMembers: [],
      interventions: [],
    };
    const buf = await buildMunicipalGisPdf(empty);
    expect(buf.toString('latin1')).toContain('%PDF');
    expect(searchableText(buf)).toContain('GENERAL INTAKE SHEET');
  });
});
