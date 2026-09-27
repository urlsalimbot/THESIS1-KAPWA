import { programBand, selectCaseColumn, buildColumns, codeForProgram } from './summary-report.types';

const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Social Services' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Social Services' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Social Services' },
  { id: 'p-hv', name: 'Home Visit', category: 'Family Welfare' },
  { id: 'p-4ps', name: '4Ps — Pantawid Pamilyang Pilipino Program', category: 'CCT' },
];

const base = { serviceText: '', referralText: '', hasCsr: false, hasVisit: false };

describe('programBand', () => {
  it('maps programs to the reference bands', () => {
    expect(programBand('Burial Assistance', 'Burial')).toEqual({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' });
    expect(programBand('Medical Assistance', 'Medical')).toEqual({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' });
    expect(programBand('Assistive Device Support', 'PWD Welfare')).toEqual({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' });
    expect(programBand('PWD Assistance', 'PWD Welfare')).toEqual({ band: 'FINANCIAL', subBand: undefined });
    expect(programBand('Legal Referral (PAO)', 'Social Services')).toEqual({ band: 'LEGAL', subBand: 'REFERRAL' });
    expect(programBand('Birth Discrepancy Assistance', 'Civil Registration').band).toBe('TECHNICAL');
    expect(programBand('Home Visit', 'Family Welfare').band).toBe('TECHNICAL');
    expect(programBand('4Ps — Pantawid Pamilyang Pilipino Program', 'CCT').band).toBe('OTHER PROGRAMS');
  });
});

describe('selectCaseColumn', () => {
  it('uses the first program-linked intervention', () => {
    expect(selectCaseColumn({ ...base, programId: 'p-burial' }, PROGRAMS)).toEqual({ key: 'p-burial', code: 'FA' });
    expect(selectCaseColumn({ ...base, programId: 'p-csr' }, PROGRAMS)).toEqual({ key: 'p-csr', code: 'CSR' });
    expect(selectCaseColumn({ ...base, programName: 'Medical Assistance' }, PROGRAMS)).toEqual({ key: 'p-med', code: 'FA' });
  });

  it('maps referral-only cases to the legal referral programs', () => {
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PAO for legal aid' }, PROGRAMS)).toEqual({ key: 'p-pao', code: 'R' });
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PCSO' }, PROGRAMS)).toEqual({ key: 'p-ref', code: 'R' });
  });

  it('falls back to CSR / Home Visit columns', () => {
    expect(selectCaseColumn({ ...base, hasCsr: true }, PROGRAMS)).toEqual({ key: 'p-csr', code: 'CSR' });
    expect(selectCaseColumn({ ...base, hasVisit: true }, PROGRAMS)).toEqual({ key: 'p-hv', code: 'HV' });
  });

  it('returns UNASSIGNED when nothing matches or the program is gone', () => {
    expect(selectCaseColumn(base, PROGRAMS).key).toBe('UNASSIGNED');
    expect(selectCaseColumn({ ...base, programId: 'p-gone' }, PROGRAMS).key).toBe('UNASSIGNED');
  });
});

describe('codeForProgram', () => {
  it('derives remark codes from band and name', () => {
    expect(codeForProgram('Burial Assistance', 'FINANCIAL')).toBe('FA');
    expect(codeForProgram('Case Study Report (CSR)', 'TECHNICAL')).toBe('CSR');
    expect(codeForProgram('Home Visit', 'TECHNICAL')).toBe('HV');
    expect(codeForProgram('Legal Referral (PAO)', 'LEGAL')).toBe('R');
    expect(codeForProgram('Psychosocial Counseling', 'TECHNICAL')).toBe('H');
    expect(codeForProgram('4Ps — Pantawid Pamilyang Pilipino Program', 'OTHER PROGRAMS')).toBe('C');
  });
});

describe('buildColumns', () => {
  it('builds SEX + programs + UNASSIGNED + TOTAL columns in order', () => {
    const cols = buildColumns(PROGRAMS);
    expect(cols[0]).toMatchObject({ key: 'MALE', band: 'SEX' });
    expect(cols[1]).toMatchObject({ key: 'FEMALE', band: 'SEX' });
    expect(cols.map(c => c.key)).toContain('p-burial');
    expect(cols[cols.length - 2]).toMatchObject({ key: 'UNASSIGNED', band: '' });
    expect(cols[cols.length - 1]).toMatchObject({ key: 'TOTAL', band: '' });
    const burial = cols.find(c => c.key === 'p-burial');
    expect(burial).toMatchObject({ label: 'Burial Assistance', band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' });
  });
});