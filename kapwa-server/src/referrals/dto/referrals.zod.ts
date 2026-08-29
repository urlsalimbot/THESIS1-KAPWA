import { z } from 'zod';

export const CreateReferralSchema = z.object({
  surname: z.string().optional(),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  extension: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
  address: z.record(z.any()).optional(),
  phone: z.string().optional(),
  personId: z.string().uuid().optional(),
  reason: z.string().min(1, 'Reason for referral is required'),
});

export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;

export const DeclineReferralSchema = z.object({
  reason: z.string().min(1, 'Decline reason is required'),
});

export type DeclineReferralInput = z.infer<typeof DeclineReferralSchema>;
