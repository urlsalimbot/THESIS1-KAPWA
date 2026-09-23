import { CreateBeneficiarySchema } from './beneficiaries.zod';

const base = { surname: 'Santos', firstName: 'Maria', gender: 'Female' as const };

describe('CreateBeneficiarySchema dob', () => {
  it('accepts a real past date', () => {
    expect(CreateBeneficiarySchema.safeParse({ ...base, dob: '1990-05-04' }).success).toBe(true);
  });

  it('rejects a future date', () => {
    expect(CreateBeneficiarySchema.safeParse({ ...base, dob: '2030-01-01' }).success).toBe(false);
  });

  it('rejects a date more than 120 years ago', () => {
    expect(CreateBeneficiarySchema.safeParse({ ...base, dob: '1800-01-01' }).success).toBe(false);
  });
});
