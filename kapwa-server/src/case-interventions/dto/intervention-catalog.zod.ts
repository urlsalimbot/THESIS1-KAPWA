import { z } from 'zod';

/**
 * A service an admin adds to the intervention catalog. The code is derived from
 * the label (slug) and then fixed — rows already reference it — so only the
 * label, its money-carrying flag and its active state are editable.
 */
export const CreateServiceTypeSchema = z.object({
  label: z.string().trim().min(2, 'The service name is too short').max(80),
  isFinancial: z.boolean().optional(),
});

export const UpdateServiceTypeSchema = z
  .object({
    label: z.string().trim().min(2, 'The service name is too short').max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(v => v.label !== undefined || v.isActive !== undefined, { message: 'Nothing to update' });

export type CreateServiceTypeInput = z.infer<typeof CreateServiceTypeSchema>;
export type UpdateServiceTypeInput = z.infer<typeof UpdateServiceTypeSchema>;
