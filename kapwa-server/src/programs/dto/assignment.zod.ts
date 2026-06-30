import { z } from 'zod';

export const CreateAssignmentSchema = z.object({
  caseId: z.string().uuid(),
  programId: z.string().uuid(),
  assignedWorkerId: z.string().uuid(),
});

export const ApproveStepSchema = z.object({
  stepOrder: z.number().int().min(0),
  remarks: z.string().optional(),
});

export const RejectStepSchema = z.object({
  stepOrder: z.number().int().min(0),
  remarks: z.string().min(1, 'Rejection reason required'),
});

export const OverrideStepSchema = z.object({
  stepOrder: z.number().int().min(0),
  overrideStatus: z.enum(['approved', 'rejected']),
  remarks: z.string().min(1, 'Override reason required'),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type ApproveStepInput = z.infer<typeof ApproveStepSchema>;
export type RejectStepInput = z.infer<typeof RejectStepSchema>;
export type OverrideStepInput = z.infer<typeof OverrideStepSchema>;
