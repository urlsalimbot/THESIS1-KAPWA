import { FamilyMemberSchema } from './intake.zod';

describe('FamilyMemberSchema', () => {
  const base = {
    surname: 'Dela Cruz',
    firstName: 'Maria',
    gender: 'Female',
    dob: '2015-08-10',
    relationship: 'Child',
  };

  it('accepts a member with gender, dob, and no age', () => {
    const r = FamilyMemberSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('accepts a newborn with age 0', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2026-07-31', age: 0 });
    expect(r.success).toBe(true);
  });

  it('accepts a provided age', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, age: 10 });
    expect(r.success).toBe(true);
  });

  it('rejects a missing gender', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, gender: undefined });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some(i => i.message === 'Sex is required')).toBe(true);
    }
  });

  it('rejects an invalid gender', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, gender: 'Other' });
    expect(r.success).toBe(false);
  });

  it('rejects a missing dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: undefined });
    expect(r.success).toBe(false);
  });

  it('rejects a wrongly formatted dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '10/08/2015' });
    expect(r.success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2023-02-30' });
    expect(r.success).toBe(false);
  });

  it('rejects a dob more than 120 years ago', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '1800-01-01' });
    expect(r.success).toBe(false);
  });

  it('rejects a future dob', () => {
    const r = FamilyMemberSchema.safeParse({ ...base, dob: '2999-01-01' });
    expect(r.success).toBe(false);
  });
});
