import { z } from 'zod';

export const LogServiceSchema = z.object({
  accessCardCode: z.string().min(1),
  serviceRendered: z.string().min(1),
  serviceDate: z.string().min(1),
  cost: z.number().nonnegative().optional(),
  agencyId: z.string().uuid().optional(),
  workerNameSign: z.string().optional(),
  // payout/compliance account recurring-program (e.g. 4Ps) disbursements and
  // conditional-cash-transfer compliance checkoffs against the access card.
  category: z.enum(['case_service', 'referral', 'community_service', 'seminar', 'payout', 'compliance']).optional().default('referral'),
});

export type LogServiceInput = z.infer<typeof LogServiceSchema>;