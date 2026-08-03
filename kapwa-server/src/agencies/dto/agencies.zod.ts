import { z } from 'zod';

export const CreateAgencySchema = z.object({
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(100),
  type: z.string().max(50).optional(),
  contactInfo: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAgencyInput = z.infer<typeof CreateAgencySchema>;
