import { memberToPerson } from './member-person';
import type { FamilyMemberInput } from './dto/intake.zod';

describe('memberToPerson', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 31, 12));
  });

  afterEach(() => jest.useRealTimers());

  const base: FamilyMemberInput = {
    surname: 'Reyes',
    firstName: 'Ana',
    gender: 'Female',
    dob: '2015-08-10',
    relationship: 'Child',
  };

  it('maps gender, parses dob, and derives age from dob when age is absent', () => {
    const p = memberToPerson(base);
    expect(p.gender).toBe('Female');
    expect(p.dob).toEqual(new Date('2015-08-10'));
    expect(p.age).toBe(10);
  });

  it('prefers a provided age over the computed one', () => {
    const p = memberToPerson({ ...base, age: 99 });
    expect(p.age).toBe(99);
  });

  it('maps income to estimatedMonthlyIncome', () => {
    const p = memberToPerson({ ...base, income: 12500 });
    expect(p.estimatedMonthlyIncome).toBe(12500);
  });

  it('never falls back to a default gender or dob', () => {
    const p = memberToPerson(base);
    expect(p.gender).not.toBe('Male');
    expect(p.dob.getTime()).not.toBe(new Date().getTime());
  });
});
