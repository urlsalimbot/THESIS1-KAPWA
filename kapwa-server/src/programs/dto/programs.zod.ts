import { z } from 'zod';

export const ApprovalStepSchema = z.object({
  stepName: z.string().min(1, 'Step name required'),
  approverRole: z.string().min(1, 'Approver role required'),
  slaDays: z.number().int().min(1).default(3),
  order: z.number().int().min(0),
});

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  category: z.string().optional(),
  waitingPeriodDays: z.number().int().nonnegative().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  fundSources: z.array(z.string()).optional(),
  approvalWorkflow: z.array(ApprovalStepSchema).optional(),   // WAS: z.array(z.string())
  legalBasis: z.string().optional(),                            // NEW
  formTemplate: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  waitingPeriodDays: z.number().int().nonnegative().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  fundSources: z.array(z.string()).optional(),
  approvalWorkflow: z.array(ApprovalStepSchema).optional(),
  legalBasis: z.string().optional(),
  formTemplate: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>;
