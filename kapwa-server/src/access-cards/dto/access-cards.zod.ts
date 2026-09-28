import { z } from 'zod';

/**
 * The sanctioned access-card service categories. `payout` and `compliance` account
 * recurring-program (e.g. 4Ps) disbursements and conditional-cash-transfer
 * checkoffs, which the 4Ps module writes to the same table.
 *
 * The card's category tabs filter on exactly this list, and every manual form
 * renders its dropdown from the matching client-side constant. A writer that
 * invents a private value (the 4Ps module used to write `4ps_compliance` and
 * `4ps_payout`) produces a row that matches no tab, so keep writers on this list.
 */
export const ACCESS_CARD_CATEGORIES = [
  'case_service',
  'referral',
  'community_service',
  'seminar',
  'payout',
  'compliance',
] as const;

export const LogServiceSchema = z.object({
  accessCardCode: z.string().min(1),
  serviceRendered: z.string().min(1),
  serviceDate: z.string().min(1),
  cost: z.number().nonnegative().optional(),
  agencyId: z.string().uuid().optional(),
  workerNameSign: z.string().optional(),
  category: z.enum(ACCESS_CARD_CATEGORIES).optional().default('referral'),
});

export type LogServiceInput = z.infer<typeof LogServiceSchema>;