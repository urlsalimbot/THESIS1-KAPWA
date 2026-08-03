import { z } from 'zod';

export const CreateInterAgencyReferralSchema = z
  .object({
    personId: z.string().uuid().optional(),
    beneficiaryId: z.string().uuid().optional(),
    caseId: z.string().uuid().optional(),
    toAgencyId: z.string().uuid().min(1, 'Target agency is required'),
    reason: z.string().trim().min(1, 'Reason is required'),
    notes: z.string().optional(),
    legalBasisCode: z.string().trim().min(1, 'Legal basis is required'),
    consentLedgerId: z.string().uuid().optional(),
  })
  .refine(dto => dto.personId || dto.beneficiaryId || dto.caseId, {
    message: 'personId, beneficiaryId, or caseId is required',
  });

export type CreateInterAgencyReferralInput = z.infer<typeof CreateInterAgencyReferralSchema>;

export const CloseReferralSchema = z.object({
  outcome: z.string().trim().min(1, 'Outcome is required'),
});
export type CloseReferralInput = z.infer<typeof CloseReferralSchema>;

export const DeclineReferralSchema = z.object({
  declinedReason: z.string().trim().min(1, 'Reason for declining is required'),
});
export type DeclineReferralInput = z.infer<typeof DeclineReferralSchema>;
