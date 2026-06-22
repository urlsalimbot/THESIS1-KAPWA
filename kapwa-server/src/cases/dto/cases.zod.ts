import { z } from 'zod';
import { CaseStatus } from '../case.entity';

export const CreateCaseSchema = z.object({
  serviceRequested: z.array(z.string()).optional(),
  requirementsChecklist: z.record(z.boolean()).optional(),
  beneficiaryId: z.string().uuid().optional(),
  assignedWorkerId: z.string().uuid().optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export const ApproveCaseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  signature: z.string().optional(),
});

export const UpdateDocumentsSchema = z.object({
  certificateUrl: z.string().optional(),
  pettyCashVoucherUrl: z.string().optional(),
});

export const OverrideStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  reason: z.string().min(1, 'Override reason is required'),
});

export const DisburseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type ApproveCaseInput = z.infer<typeof ApproveCaseSchema>;
export type UpdateDocumentsInput = z.infer<typeof UpdateDocumentsSchema>;
export type OverrideStatusInput = z.infer<typeof OverrideStatusSchema>;
export type DisburseInput = z.infer<typeof DisburseSchema>;
