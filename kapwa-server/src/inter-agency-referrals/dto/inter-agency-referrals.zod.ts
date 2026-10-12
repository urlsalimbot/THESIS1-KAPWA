import { z } from 'zod';

// The case step's only referral action: issue the endorsement letter, which
// records the referral. The subject is bound to the case by the route, so no
// person/beneficiary/case is taken from the body.
export const IssueEndorsementLetterSchema = z.object({
  toAgencyId: z.string().uuid().min(1, 'Target agency is required'),
  reason: z.string().trim().min(1, 'Reason is required'),
  notes: z.string().optional(),
});
export type IssueEndorsementLetterInput = z.infer<typeof IssueEndorsementLetterSchema>;