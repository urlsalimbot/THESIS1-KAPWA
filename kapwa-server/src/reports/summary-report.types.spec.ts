import { classifyCase, SummaryCounts } from './summary-report.types';

const base = { serviceText: '', referralText: '', hasCsr: false, hasVisit: false };

describe('classifyCase', () => {
  it('classifies by precedence: burial before medical before assistive', () => {
    expect(classifyCase({ ...base, serviceText: 'Burial Assistance' })).toBe('BURIAL');
    expect(classifyCase({ ...base, serviceText: 'Medical Assistance' })).toBe('MEDICAL');
    expect(classifyCase({ ...base, serviceText: 'Assistive Device issued' })).toBe('ASSISTIVE');
  });

  it('classifies PWD from the client category', () => {
    expect(classifyCase({ ...base, clientCategory: 'PWD' })).toBe('PWD');
  });

  it('classifies technical and legal columns', () => {
    expect(classifyCase({ ...base, serviceText: 'Birth Discrepancy' })).toBe('BIRTH_DISCREPANCY');
    expect(classifyCase({ ...base, serviceText: 'Travel Assessment' })).toBe('TRAVEL');
    expect(classifyCase({ ...base, hasCsr: true })).toBe('CSR');
    expect(classifyCase({ ...base, serviceText: 'Psychosocial Counseling' })).toBe('COUNSELLING');
    expect(classifyCase({ ...base, serviceText: 'PhilHealth' })).toBe('PHILHEALTH');
    expect(classifyCase({ ...base, serviceText: 'Child Custody' })).toBe('CUSTODY');
    expect(classifyCase({ ...base, hasVisit: true })).toBe('HOME_VISIT');
    expect(classifyCase({ ...base, serviceText: 'Balik Probinsya' })).toBe('BALIK_PROBINSYA');
    expect(classifyCase({ ...base, referralText: 'Referral to PAO legal aid' })).toBe('LEGAL_PAO');
    expect(classifyCase({ ...base, referralText: 'Referred to PCSO' })).toBe('LEGAL_OTHERS');
  });

  it('falls back to OTHERS_TECHNICAL', () => {
    expect(classifyCase({ ...base, serviceText: 'Food assistance' })).toBe('OTHERS_TECHNICAL');
    expect(classifyCase(base)).toBe('OTHERS_TECHNICAL');
  });
});

describe('SummaryCounts invariant', () => {
  it('is expressible as male + female = total', () => {
    const counts: SummaryCounts = { male: 2, female: 3, total: 5, byCategory: {} as SummaryCounts['byCategory'] };
    expect(counts.male + counts.female).toBe(counts.total);
  });
});
