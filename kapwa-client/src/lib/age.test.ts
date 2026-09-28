import { describe, it, expect } from 'vitest';
import { computeAge } from './age';

// Dates are derived from "today" with LOCAL calendar components (never
// toISOString, which shifts a day for negative timezone offsets), so the
// assertions hold in any timezone.
function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yearsAgo(n: number, offsetDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() + offsetDays);
  return localIso(d);
}

describe('computeAge', () => {
  it('returns 0 for missing or invalid dates', () => {
    expect(computeAge(null)).toBe(0);
    expect(computeAge(undefined)).toBe(0);
    expect(computeAge('')).toBe(0);
    expect(computeAge('not-a-date')).toBe(0);
  });

  it('counts an exact year only once the birthday has passed', () => {
    // 47 years ago minus a day → the 47th birthday was yesterday.
    expect(computeAge(yearsAgo(47, -1))).toBe(47);
    // 47 years ago plus a day → the 47th birthday is still tomorrow.
    expect(computeAge(yearsAgo(47, 1))).toBe(46);
  });

  it('is exact on the birthday itself', () => {
    expect(computeAge(yearsAgo(47, 0))).toBe(47);
  });

  it('is at most the raw year difference, and less while the birthday has not passed', () => {
    const dob = yearsAgo(47, 1);
    const raw = new Date().getFullYear() - new Date(dob).getFullYear();
    expect(computeAge(dob)).toBeLessThanOrEqual(raw);
    expect(computeAge(dob)).toBeLessThan(raw);
  });
});