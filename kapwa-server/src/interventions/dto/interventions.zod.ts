import { z } from 'zod';
import { InterventionType, FundSource } from '../intervention.entity';

export const CreateInterventionSchema = z.object({
  caseId: z.string().uuid(),
  interventionType: z.nativeEnum(InterventionType).default(InterventionType.FA),
  amount: z.number().positive().default(0),
  fundSource: z.nativeEnum(FundSource).default(FundSource.REGULAR),
  serviceDate: z.string().datetime().optional(),
  workerSignatureUrl: z.string().url(),
  agency: z.string().optional(),
  voucherNo: z.string().optional(),
  orReference: z.string().optional(),
});

export type CreateInterventionInput = z.infer<typeof CreateInterventionSchema>;
