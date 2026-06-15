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

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
