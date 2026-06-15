import { z } from 'zod';

export const CreateBeneficiarySchema = z.object({
  surname: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  gender: z.enum(['Male', 'Female']),
  dob: z.string().datetime().or(z.string().date()),
  address: z.string().optional(),
  phone: z.string().optional(),
  philsysNumber: z.string().optional(),
  accessCardCode: z.string().optional(),
  householdId: z.string().uuid().optional(),
});

export const UpdateBeneficiarySchema = CreateBeneficiarySchema.partial();

export type CreateBeneficiaryInput = z.infer<typeof CreateBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof UpdateBeneficiarySchema>;
