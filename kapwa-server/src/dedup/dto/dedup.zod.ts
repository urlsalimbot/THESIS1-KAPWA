import { z } from 'zod';

const ColumnMapSchema = z.object({
  baseline: z.object({
    lastName: z.string().min(1), firstName: z.string().min(1), middleName: z.string().min(1),
    birthDate: z.string().min(1), barangay: z.string().min(1), remarks: z.string().min(1),
  }),
  extras: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(['text', 'date', 'number']),
    identifier: z.enum(['phone', 'email', 'philsys']).optional(),
    sourceColumn: z.string().min(1),
  })).default([]),
});

export const CreateDedupOperationSchema = z.object({
  source: z.string().min(1),
  interventionType: z.string().min(1, 'An intervention type is required'),
  columnMap: ColumnMapSchema,
  matchThreshold: z.number().min(0).max(1).optional(),
});
export type CreateDedupOperationInput = z.infer<typeof CreateDedupOperationSchema>;

/**
 * The match decision — two shapes the controller routes by presence:
 * phase 1 pairs use `keep`; phase 2 record/household matches use
 * `samePerson` (+ `position` for "same person?" = yes).
 */
export const DedupDecisionSchema = z
  .object({
    keep: z.enum(['import_row', 'other_import_row']).optional(),
    samePerson: z.boolean().optional(),
    position: z.enum(['keep', 'deprioritize']).optional(),
    remark: z.string().optional(),
  })
  .refine((b) => (b.keep != null) !== (b.samePerson != null), {
    message: 'Either keep (phase 1) or samePerson (phase 2) is required',
  });
export type DedupDecisionInput = z.infer<typeof DedupDecisionSchema>;

export const EligibilityDecisionSchema = z.object({
  decision: z.enum(['waive', 'confirm']),
  /** Optional: decide ONE match of the row; omitted = decide all matches. */
  matchId: z.string().optional(),
});
export type EligibilityDecisionInput = z.infer<typeof EligibilityDecisionSchema>;

export const AddRemarkSchema = z.object({ remark: z.string().min(1) });
export type AddRemarkInput = z.infer<typeof AddRemarkSchema>;
