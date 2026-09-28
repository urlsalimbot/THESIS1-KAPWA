import {
  programColumnKey, selectCaseColumn, buildColumns, codeForColumn, mostRelevantProgram,
  SPEC_COLUMNS,
} from './summary-report.types';

const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-assist', name: 'Assistive Device Support', category: 'PWD Welfare' },
  { id: 'p-pwd', name: 'PWD Assistance', category: 'PWD Welfare' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Legal' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Legal' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Technical' },
  { id: 'p-hv', name: 'Home Visit', category: 'Technical' },
  { id: 'p-counsel', name: 'Psychosocial Counseling', category: 'Mental Health' },
  { id: 'p-4ps', name: '4Ps — Pantawid Pamilyang Pilipino Program', category: 'CCT' },
];

const base = { serviceText: '', referralText: '', hasCsr: false, hasVisit: false };

describe('buildColumns', () => {
  it('is the exact 18-column printed form', () => {
    const cols = buildColumns();
    expect(cols.map((c) => c.key)).toEqual([
      'MALE', 'FEMALE',
      'BURIAL', 'MEDICAL', 'ASSISTIVE', 'PWD',
      'LEGAL_PAO', 'LEGAL_OTHERS',
      'BIRTH_DISCREPANCY', 'TRAVEL', 'CSR', 'COUNSELLING', 'PHILHEALTH',
      'CUSTODY', 'HOME_VISIT', 'BALIK', 'TECH_OTHERS',
      'TOTAL',
    ]);
    expect(cols).toHaveLength(18);
    const burial = cols.find((c) => c.key === 'BURIAL');
    expect(burial).toMatchObject({ label: 'Burial', band: 'FINANCIAL', subBand: 'Financial Assistance' });
    expect(cols.find((c) => c.key === 'LEGAL_PAO')).toMatchObject({ label: 'LEGAL/PAO', band: 'LEGAL', subBand: 'Referral' });
    expect(cols.find((c) => c.key === 'OTHERS' as never) ?? cols[16]).toMatchObject({ label: 'Others', band: 'TECHNICAL' });
    expect(cols[17]).toMatchObject({ label: 'TOTAL', band: '' });
  });
});

describe('programColumnKey', () => {
  it('maps programmes onto the printed slots', () => {
    expect(programColumnKey('Burial Assistance')).toBe('BURIAL');
    expect(programColumnKey('Medical Equipment Loan')).toBe('MEDICAL');
    expect(programColumnKey('Assistive Device Support')).toBe('ASSISTIVE');
    expect(programColumnKey('PWD Assistance')).toBe('PWD');
    expect(programColumnKey('Legal Referral (PAO)')).toBe('LEGAL_PAO');
    expect(programColumnKey('Referral and Linkage Services')).toBe('LEGAL_OTHERS');
    expect(programColumnKey('Birth Discrepancy Assistance')).toBe('BIRTH_DISCREPANCY');
    expect(programColumnKey('Travel Assessment')).toBe('TRAVEL');
    expect(programColumnKey('Case Study Report (CSR)')).toBe('CSR');
    expect(programColumnKey('Psychosocial Counseling')).toBe('COUNSELLING');
    expect(programColumnKey('PhilHealth Assistance')).toBe('PHILHEALTH');
    expect(programColumnKey('Child Custody Support')).toBe('CUSTODY');
    expect(programColumnKey('Home Visit')).toBe('HOME_VISIT');
    expect(programColumnKey('Balik Probinsya Assistance')).toBe('BALIK');
    // Programmes outside the form fold into the technical OTHERS slot.
    expect(programColumnKey('Educational Assistance')).toBe('TECH_OTHERS');
    expect(programColumnKey('4Ps — Pantawid Pamilyang Pilipino Program')).toBe('TECH_OTHERS');
  });
});

describe('codeForColumn', () => {
  it('derives case-list remark codes', () => {
    expect(codeForColumn('BURIAL')).toBe('FA');
    expect(codeForColumn('CSR')).toBe('CSR');
    expect(codeForColumn('HOME_VISIT')).toBe('HV');
    expect(codeForColumn('LEGAL_PAO')).toBe('R');
    expect(codeForColumn('COUNSELLING')).toBe('H');
    expect(codeForColumn('TECH_OTHERS')).toBe('C');
  });
});

describe('selectCaseColumn', () => {
  it('uses the programme-linked intervention slot', () => {
    expect(selectCaseColumn({ ...base, programId: 'p-burial' }, PROGRAMS)).toEqual({ key: 'BURIAL', code: 'FA' });
    expect(selectCaseColumn({ ...base, programName: 'Psychosocial Counseling' }, PROGRAMS)).toEqual({ key: 'COUNSELLING', code: 'H' });
    expect(selectCaseColumn({ ...base, programId: 'p-4ps' }, PROGRAMS)).toEqual({ key: 'TECH_OTHERS', code: 'C' });
  });

  it('maps referrals: legal to LEGAL/PAO, others to a relevant programme or OTHERS', () => {
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PAO for legal aid' }, PROGRAMS)).toEqual({ key: 'LEGAL_PAO', code: 'R' });
    expect(selectCaseColumn({ ...base, referralText: 'referred for counseling sessions' }, PROGRAMS)).toEqual({ key: 'COUNSELLING', code: 'R' });
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PCSO' }, PROGRAMS)).toEqual({ key: 'LEGAL_OTHERS', code: 'R' });
  });

  it('falls back to CSR / Home Visit, then ad-hoc service text', () => {
    expect(selectCaseColumn({ ...base, hasCsr: true }, PROGRAMS)).toEqual({ key: 'CSR', code: 'CSR' });
    expect(selectCaseColumn({ ...base, hasVisit: true }, PROGRAMS)).toEqual({ key: 'HOME_VISIT', code: 'HV' });
    expect(selectCaseColumn({ ...base, serviceText: 'funeral assistance claim' }, PROGRAMS)).toEqual({ key: 'BURIAL', code: 'FA' });
  });

  it('sends everything unmatched to the technical OTHERS slot', () => {
    expect(selectCaseColumn(base, PROGRAMS)).toEqual({ key: 'TECH_OTHERS', code: 'C' });
    expect(selectCaseColumn({ ...base, serviceText: 'definitely not a service' }, PROGRAMS).key).toBe('TECH_OTHERS');
  });
});

describe('mostRelevantProgram', () => {
  it('scores by shared tokens and returns undefined without a match', () => {
    expect(mostRelevantProgram('home visitation for the elderly', PROGRAMS)?.id).toBe('p-hv');
    expect(mostRelevantProgram('nothing in common here', PROGRAMS)).toBeUndefined();
  });
});

describe('SPEC_COLUMNS', () => {
  it('exposes the printed header labels verbatim', () => {
    const labels = SPEC_COLUMNS.map((c) => c.label);
    for (const l of ['Male', 'Female', 'Burial', 'Medical', 'Assistive Devices', 'PWD', 'LEGAL/PAO', 'OTHERS',
      'Birth Discrepancy', 'Travel Assessment', 'Case Study Report', 'Counselling', 'PhilHealth',
      'Child Custody', 'Home Visit', 'Balik Probinsya', 'Others', 'TOTAL']) {
      expect(labels).toContain(l);
    }
  });
});