import { z } from 'zod';
import { InterventionType, FundSource, SignatureStatus } from '../intervention.entity';

export const CreateInterventionSchema = z.object({
  caseId: z.string().uuid(),
  interventionType: z.nativeEnum(InterventionType).default(InterventionType.FA),
  amount: z.number().nonnegative().default(0),
  fundSource: z.nativeEnum(FundSource).default(FundSource.REGULAR),
  serviceDate: z.string().datetime().optional(),
  workerSignatureUrl: z.string().url().optional(),
  clientSignatureUrl: z.string().url().optional(),
  signatureStatus: z.nativeEnum(SignatureStatus).optional(),
  clientReceiptUrl: z.string().url().optional(),
  agency: z.string().optional(),
  voucherNo: z.string().optional(),
  orReference: z.string().optional(),
  overrideNoCardCheck: z.boolean().optional(),
});

export type CreateInterventionInput = z.infer<typeof CreateInterventionSchema>;
