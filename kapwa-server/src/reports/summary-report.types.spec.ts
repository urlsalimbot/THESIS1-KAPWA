import { programBand, selectCaseColumn, buildColumns, codeForProgram } from './summary-report.types';

const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Legal' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Legal' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Technical' },
  { id: 'p-hv', name: 'Home Visit', category: 'Technical' },
  { id: 'p-ph', name: 'PhilHealth Assistance', category: 'Medical' },
  { id: 'p-4ps', name: '4Ps — Pantawid Pamilyang Pilipino Program', category: 'CCT' },
];

const base = { serviceText: '', referralText: '', hasCsr: false, hasVisit: false };

describe('programBand', () => {
  it('maps programs to the reference bands', () => {
    expect(programBand('Burial Assistance', 'Burial')).toMatchObject({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE', slot: 1 });
    expect(programBand('Medical Assistance', 'Medical')).toMatchObject({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE', slot: 2 });
    expect(programBand('Assistive Device Support', 'PWD Welfare')).toMatchObject({ band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE', slot: 3 });
    expect(programBand('PWD Assistance', 'PWD Welfare')).toMatchObject({ band: 'FINANCIAL', slot: 4 });
    expect(programBand('PWD Assistance', 'PWD Welfare').subBand).toBeUndefined();
    expect(programBand('Legal Referral (PAO)', 'Legal')).toMatchObject({ band: 'LEGAL', subBand: 'REFERRAL', slot: 1 });
    expect(programBand('Birth Discrepancy Assistance', 'Technical').band).toBe('TECHNICAL');
    expect(programBand('Home Visit', 'Technical').band).toBe('TECHNICAL');
    // PhilHealth sits under TECHNICAL in the reference column order.
    expect(programBand('PhilHealth Assistance', 'Medical')).toMatchObject({ band: 'TECHNICAL', slot: 5 });
    expect(programBand('4Ps — Pantawid Pamilyang Pilipino Program', 'CCT').band).toBe('OTHER PROGRAMS');
  });
});

describe('selectCaseColumn', () => {
  it('uses the first program-linked intervention', () => {
    expect(selectCaseColumn({ ...base, programId: 'p-burial' }, PROGRAMS)).toEqual({ key: 'p-burial', code: 'FA' });
    expect(selectCaseColumn({ ...base, programId: 'p-csr' }, PROGRAMS)).toEqual({ key: 'p-csr', code: 'CSR' });
    expect(selectCaseColumn({ ...base, programName: 'Medical Assistance' }, PROGRAMS)).toEqual({ key: 'p-med', code: 'FA' });
  });

  it('maps referral-only cases to the legal referral programs or a relevant match', () => {
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PAO for legal aid' }, PROGRAMS)).toEqual({ key: 'p-pao', code: 'R' });
    // No exact legal match → align to the most relevant programme.
    expect(selectCaseColumn({ ...base, referralText: 'referred for home visitation services' }, PROGRAMS)).toEqual({ key: 'p-hv', code: 'R' });
    // No shared token with any programme → UNASSIGNED.
    expect(selectCaseColumn({ ...base, referralText: 'Referred to PCSO' }, PROGRAMS).key).toBe('UNASSIGNED');
  });

  it('aligns ad-hoc service text to the most relevant programme column', () => {
    expect(selectCaseColumn({ ...base, serviceText: 'home visitation for the elderly' }, PROGRAMS)).toEqual({ key: 'p-hv', code: 'HV' });
    expect(selectCaseColumn({ ...base, serviceText: 'funeral assistance claim' }, PROGRAMS).key).toBe('p-burial');
    expect(selectCaseColumn({ ...base, serviceText: 'definitely not a service' }, PROGRAMS).key).toBe('UNASSIGNED');
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
  it('builds SEX + programs + UNASSIGNED + TOTAL columns in reference order', () => {
    const cols = buildColumns(PROGRAMS);
    expect(cols[0]).toMatchObject({ key: 'MALE', band: 'SEX' });
    expect(cols[1]).toMatchObject({ key: 'FEMALE', band: 'SEX' });
    const keys = cols.map((c) => c.key);
    // Reference order: BURIAL, MEDICAL before PWD; LEGAL/PAO before OTHERS;
    // TECHNICAL birth<travel<csr<philhealth; 4Ps in OTHER PROGRAMS.
    expect(keys.indexOf('p-burial')).toBeLessThan(keys.indexOf('p-med'));
    expect(keys.indexOf('p-med')).toBeLessThan(keys.indexOf('p-hv'));
    expect(keys.indexOf('p-pao')).toBeLessThan(keys.indexOf('p-ref'));
    expect(keys.indexOf('p-csr')).toBeLessThan(keys.indexOf('p-ph'));
    expect(keys.indexOf('p-ph')).toBeLessThan(keys.indexOf('p-4ps'));
    expect(cols[cols.length - 2]).toMatchObject({ key: 'UNASSIGNED', band: '' });
    expect(cols[cols.length - 1]).toMatchObject({ key: 'TOTAL', band: '' });
    const burial = cols.find((c) => c.key === 'p-burial');
    expect(burial).toMatchObject({ label: 'Burial Assistance', band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' });
  });
});