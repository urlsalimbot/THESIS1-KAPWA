import { computeAgeFromDob } from './compute-age';

describe('computeAgeFromDob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 31, 12));
  });

  afterEach(() => jest.useRealTimers());

  it('computes full years on the birthday', () => {
    expect(computeAgeFromDob(new Date(2006, 6, 31))).toBe(20);
  });

  it('computes full years when the birthday has already passed this year', () => {
    expect(computeAgeFromDob(new Date(2000, 0, 15))).toBe(26);
  });

  it('decrements when this year\'s birthday has not occurred yet', () => {
    expect(computeAgeFromDob(new Date(2000, 11, 31))).toBe(25);
  });

  it('returns 0 for a newborn', () => {
    expect(computeAgeFromDob(new Date('2026-07-31'))).toBe(0);
  });

  it('returns a negative number for a future date', () => {
    expect(computeAgeFromDob(new Date('2027-01-01'))).toBe(-1);
  });

  it('returns NaN for a non-date string', () => {
    expect(computeAgeFromDob('not-a-date')).toBeNaN();
  });

  it('returns NaN for an impossible calendar date', () => {
    expect(computeAgeFromDob('2023-02-30')).toBeNaN();
  });
});
