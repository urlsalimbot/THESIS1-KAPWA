import { FamilyMemberSchema, batchFamilySchema } from './intake.zod';

describe('batch-family schema', () => {
  const base = {
    caseId: 'case-1',
    primary: { surname: 'Dela Cruz', firstName: 'Juan', gender: 'Male', dob: '1990-01-01' },
    members: [{ surname: 'Dela Cruz', firstName: 'Ana', gender: 'Female', dob: '1992-02-02', relationship: 'Spouse' }],
  };

  it('validates a caseId plus primary and member array', () => {
    const result = batchFamilySchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('rejects when caseId is missing', () => {
    const result = batchFamilySchema.safeParse({
      primary: base.primary,
      members: base.members,
    });
    expect(result.success).toBe(false);
  });
});

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
