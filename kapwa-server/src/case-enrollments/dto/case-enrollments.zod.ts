import { z } from 'zod';

export const CreateProgramEnrollmentSchema = z.object({
  programId: z.string().uuid(),
  enrolledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'enrolledAt must be a YYYY-MM-DD date'),
  status: z.enum(['active', 'completed', 'withdrawn']).default('active'),
});

export const UpdateProgramEnrollmentSchema = z.object({
  status: z.enum(['active', 'completed', 'withdrawn']).optional(),
  enrolledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'enrolledAt must be a YYYY-MM-DD date').optional(),
});

export type CreateProgramEnrollmentInput = z.infer<typeof CreateProgramEnrollmentSchema>;
export type UpdateProgramEnrollmentInput = z.infer<typeof UpdateProgramEnrollmentSchema>;