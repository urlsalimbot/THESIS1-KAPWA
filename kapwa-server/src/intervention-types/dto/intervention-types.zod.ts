import { z } from 'zod';

export const CreateInterventionTypeSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateInterventionTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateInterventionTypeInput = z.infer<typeof CreateInterventionTypeSchema>;
export type UpdateInterventionTypeInput = z.infer<typeof UpdateInterventionTypeSchema>;
