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

export const DedupDecisionSchema = z.object({
  keep: z.enum(['import_row', 'existing_record', 'other_import_row']),
  remark: z.string().optional(),
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
