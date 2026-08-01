import { z } from 'zod';

export const CheckDuplicateSchema = z.object({
  beneficiaryId: z.string().uuid(),
  serviceRequested: z.array(z.string()).min(1),
  windowDays: z.number().int().positive().default(90),
});

export type CheckDuplicateInput = z.infer<typeof CheckDuplicateSchema>;
