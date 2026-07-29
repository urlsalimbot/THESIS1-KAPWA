import { z } from 'zod';

export const CreateReferralSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.string().optional(),
  gender: z.string().min(1, 'Gender is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  address: z.record(z.any()).optional(),
  phone: z.string().optional(),
  reason: z.string().min(1, 'Reason for referral is required'),
});

export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;

export const DeclineReferralSchema = z.object({
  reason: z.string().min(1, 'Decline reason is required'),
});

export type DeclineReferralInput = z.infer<typeof DeclineReferralSchema>;
