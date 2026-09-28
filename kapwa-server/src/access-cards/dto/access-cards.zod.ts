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

/**
 * The same shape, but for callers that already hold a `Date`.
 *
 * `POST /access-cards/log` is the only writer that goes through `ZodPipe`.
 * `FourPsService.logToCard` and `AccessCardsService.autoLogFromIntervention`
 * call `logService` as a plain method — no HTTP, no pipe, no guards — so the
 * schema has to be enforced at the service boundary too or those callers write
 * whatever they like. That gap is how `4ps_compliance` rows survived: they
 * inserted cleanly, tests passed, and the row matched no category tab.
 *
 * `serviceDate` is coerced rather than re-typed because the controller has
 * already turned the request's string into a `Date` by this point.
 */
export const LogServiceRowSchema = LogServiceSchema.extend({
  serviceDate: z.coerce.date(),
});

export type LogServiceRow = z.infer<typeof LogServiceRowSchema>;