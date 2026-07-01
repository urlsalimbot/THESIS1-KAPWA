import { z } from 'zod';

export const CreateTrackerEntrySchema = z.object({
  transactionDate: z.string().optional(),
  surname: z.string().optional(),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  gender: z.string().optional(),
  ageRange: z.string().optional(),
  clientCategory: z.string().optional(),
  barangay: z.string().optional(),
  interventionRemarks: z.string().optional(),
});

export type CreateTrackerEntryInput = z.infer<typeof CreateTrackerEntrySchema>;
