import { z } from 'zod';

// Real date, not in the future, at most 120 years ago.
const dobSchema = z.string().datetime().or(z.string().date()).refine((d) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return false;
  const age = (Date.now() - date.getTime()) / 31557600000;
  return age >= 0 && age <= 120;
}, 'Date of birth must be a real date and at most 120 years ago');

export const CreateBeneficiarySchema = z.object({
  surname: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  gender: z.enum(['Male', 'Female']),
  dob: dobSchema,
  address: z.string().optional(),
  phone: z.string().optional(),
  philsysNumber: z.string().optional(),
  householdId: z.string().uuid().optional(),
  occupation: z.string().optional(),
  civilStatus: z.string().optional(),
  placeOfBirth: z.string().optional(),
  estimatedMonthlyIncome: z.number().optional(),
  philhealthNumber: z.string().optional(),
  category: z.string().optional(),
});

export const UpdateBeneficiarySchema = CreateBeneficiarySchema.partial();

export const RevokeConsentSchema = z.object({
  reason: z.string().optional(),
});

// Grants (or reinstates) consent. The ledger is append-only: a grant adds a
// new active row rather than flipping the revoked one back.
export const GrantConsentSchema = z.object({
  purpose: z.string().max(60).optional(),
  channel: z.string().max(40).optional(),
});

export const NhtsPrSchema = z.object({
  nhtsPrId: z.string().max(50).nullable().optional(),
});

export type CreateBeneficiaryInput = z.infer<typeof CreateBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof UpdateBeneficiarySchema>;
export type NhtsPrInput = z.infer<typeof NhtsPrSchema>;
