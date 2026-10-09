import { personSignals, dedupScore, DEDUP_THRESHOLD_DEFAULT } from './dedup-matcher.service';

const sim = (x: string, y: string): number => (x === y ? 1 : 0.5);

describe('personSignals', () => {
  it('computes exact-match signals for identical persons', () => {
    const p = { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', phone: '09171000005' };
    const s = personSignals(p, p, sim);
    expect(s.simSurname).toBe(1);
    expect(s.simFirstName).toBe(1);
    expect(s.dobMatch).toBe(true);
    expect(s.middleNameMatch).toBe(true);
    expect(s.barangayMatch).toBe(true);
    expect(s.phoneMatch).toBe(true);
  });

  it('normalizes phone digits (strips non-digits, collapses trailing pattern)', () => {
    const a = { lastName: 'R', firstName: 'P', phone: '0917-100-0005' };
    const b = { lastName: 'R', firstName: 'P', phone: '9171000005' };
    expect(personSignals(a, b, () => 0.5).phoneMatch).toBe(true);
  });

  it('flags phonetic surname agreement via soundex', () => {
    const s = personSignals({ lastName: 'Reyes', firstName: 'P' }, { lastName: 'Reys', firstName: 'P' }, () => 0.5);
    expect(s.surnamePhoneticMatch).toBe(true);
  });

  it('never matches on empty identifiers', () => {
    const s = personSignals({ lastName: 'R', firstName: 'P' }, { lastName: 'R', firstName: 'P' }, () => 0.5);
    expect(s.phoneMatch).toBe(false);
    expect(s.emailMatch).toBe(false);
    expect(s.philsysMatch).toBe(false);
  });
});

describe('dedupScore', () => {

  it('is bounded to [0,1] and a full exact match reaches at least 0.95', () => {
    const p = { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', phone: '09171000005' };
    const s = personSignals(p, p, sim);
    const score = dedupScore(s, false);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0.95);
  });

  it('householdServed raises the score', () => {
    const p = { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' };
    const s = personSignals(p, p, sim);
    expect(dedupScore(s, true)).toBeGreaterThan(dedupScore(s, false));
  });

  it('barangay-only agreement scores below a name agreement', () => {
    const nameOnly = personSignals({ lastName: 'Reyes', firstName: 'Pedro' }, { lastName: 'Reys', firstName: 'Pedra' }, () => 0.75);
    const barangayOnly = personSignals({ lastName: 'A', firstName: 'B', barangay: 'Bigte' }, { lastName: 'Z', firstName: 'Y', barangay: 'Bigte' }, () => 0);
    expect(dedupScore(nameOnly, false)).toBeGreaterThan(dedupScore(barangayOnly, false));
  });

  it('exposes the default threshold', () => {
    expect(typeof DEDUP_THRESHOLD_DEFAULT).toBe('number');
    expect(DEDUP_THRESHOLD_DEFAULT).toBeGreaterThan(0.5);
    expect(DEDUP_THRESHOLD_DEFAULT).toBeLessThanOrEqual(1);
  });
});