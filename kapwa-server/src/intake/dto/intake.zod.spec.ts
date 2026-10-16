import { FamilyMemberSchema, IntakeInputCheckedSchema, IntakeInputSchema } from './intake.zod';

describe('PersonSchema (via IntakeInputSchema)', () => {
  const address = { street: '12 Probe St', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: 'Region III', postalCode: '3013' };
  const person = {
    surname: 'Santos', firstName: 'Maria', gender: 'Female', dob: '1990-05-04',
    placeOfBirth: 'Norzagaray', civilStatus: 'Single', cellularNumber: '09171234567',
    email: 'maria@example.test', currentAddress: address, occupation: 'Vendor',
    estimatedMonthlyIncome: 5000,
  };
  const intake = (over: Record<string, unknown>) => IntakeInputCheckedSchema.safeParse({
    beneficiary: { ...person, ...over },
    claimant: { ...person, ...over, relationshipToBeneficiary: 'Self' },
    case: {},
  });

  it('accepts a valid adult dob', () => {
    expect(intake({}).success).toBe(true);
  });

  it('rejects a future dob', () => {
    expect(intake({ dob: '2030-01-01' }).success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    expect(intake({ dob: '2026-02-30' }).success).toBe(false);
  });

  it('rejects a dob more than 120 years ago', () => {
    expect(intake({ dob: '1800-01-01' }).success).toBe(false);
  });

  it('accepts a self-claim with contact details', () => {
    expect(intake({}).success).toBe(true);
  });

  it('accepts a self-claim without contact details (the office issues the account)', () => {
    // The rule that rejected this was the reason a person with no phone and no
    // email address could not be taken in at all. The intake now accepts it and
    // AccountProvisioningService issues a printable claimant ID and password.
    const r = IntakeInputCheckedSchema.safeParse({
      beneficiary: { ...person, cellularNumber: '', email: '' },
      claimant: { ...person, cellularNumber: '', email: '', relationshipToBeneficiary: 'Self' },
      case: {},
    });
    expect(r.success).toBe(true);
  });

  it('still rejects a malformed contact when one is given', () => {
    // Optional does not mean unvalidated: a wrong number is worse than none.
    const r = IntakeInputCheckedSchema.safeParse({
      beneficiary: { ...person, cellularNumber: '12345', email: '' },
      claimant: { ...person, relationshipToBeneficiary: 'Mother' },
      case: {},
    });
    expect(r.success).toBe(false);
  });

  it('accepts a beneficiary without contact details when a separate claimant claims for them', () => {
    const r = IntakeInputCheckedSchema.safeParse({
      beneficiary: { ...person, cellularNumber: '', email: '' },
      claimant: {
        ...person, surname: 'Dela Cruz', firstName: 'Elena',
        relationshipToBeneficiary: 'Mother', cellularNumber: '09170000000', email: 'elena@example.test',
      },
      case: {},
    });
    expect(r.success).toBe(true);
  });

  it('accepts a claimant without contact details', () => {
    // The person who signs for the beneficiary often has no handset either.
    // Their account is issued at the counter instead of by email/SMS.
    const r = IntakeInputCheckedSchema.safeParse({
      beneficiary: { ...person, cellularNumber: '', email: '' },
      claimant: {
        ...person, surname: 'Dela Cruz', firstName: 'Elena',
        relationshipToBeneficiary: 'Mother', cellularNumber: '', email: '',
      },
      case: {},
    });
    expect(r.success).toBe(true);
  });

  it('accepts an isIndigenous flag on the beneficiary', () => {
    expect(intake({ isIndigenous: true }).success).toBe(true);
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
