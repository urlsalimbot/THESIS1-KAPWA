import { z } from 'zod';

export const LogServiceSchema = z.object({
  accessCardCode: z.string().min(1),
  serviceRendered: z.string().min(1),
  serviceDate: z.string().min(1),
  cost: z.number().nonnegative().optional(),
  agency: z.string().optional(),
  workerNameSign: z.string().optional(),
  category: z.enum(['case_service', 'referral', 'community_service', 'seminar']).optional().default('referral'),
});

export type LogServiceInput = z.infer<typeof LogServiceSchema>;
