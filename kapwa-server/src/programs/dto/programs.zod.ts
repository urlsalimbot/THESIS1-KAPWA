import { z } from 'zod';
import { INTERVENTION_FORM_FORMATS, PROGRAM_TYPES } from '../../common/case-catalog';

// The catalog vocabularies, as zod enums: the UI cannot invent a program type
// or a form format the rest of the system does not know (audit 3.2.9).
const ProgramTypeSchema = z.enum(PROGRAM_TYPES as unknown as [string, ...string[]]);
const FormFormatSchema = z.enum(INTERVENTION_FORM_FORMATS as unknown as [string, ...string[]]);

export const ApprovalStepSchema = z.object({
  stepName: z.string().min(1, 'Step name required'),
  approverRole: z.string().min(1, 'Approver role required'),
  slaDays: z.number().int().min(1).default(3),
  order: z.number().int().min(0),
});

/** One row of the Program → Interventions matrix: an intervention the program renders, with an optional form format it obliges. */
export const ProgramInterventionInputSchema = z.object({
  interventionType: z.string().min(1, 'Intervention is required'),
  requiredForm: FormFormatSchema.nullish(), // one of INTERVENTION_FORM_FORMATS
});

/**
 * Duplicate matrix rows corrupt the rewrite (delete-then-insert fails mid-loop
 * and a truncated matrix is left on disk) — refuse them at the schema edge so
 * the 400 carries the reason instead of a 500 (audit 3.2.5).
 */
const uniqueMatrix = <T>(interventions: Array<{ interventionType: string }> | undefined): boolean =>
  !interventions || new Set(interventions.map((i) => i.interventionType)).size === interventions.length;

export const CreateProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  programType: ProgramTypeSchema.optional(),
  category: z.string().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  fundSources: z.array(z.string()).optional(),
  approvalWorkflow: z.array(ApprovalStepSchema).optional(),   // WAS: z.array(z.string())
  legalBasis: z.string().optional(),                            // NEW
  formTemplate: z.record(z.any()).optional(),
  interventions: z.array(ProgramInterventionInputSchema).optional(),
  isActive: z.boolean().optional(),
}).refine((d) => uniqueMatrix(d.interventions), {
  message: 'Each intervention may appear only once in the program matrix',
  path: ['interventions'] as const,
});

export const UpdateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  programType: ProgramTypeSchema.optional(),
  category: z.string().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  fundSources: z.array(z.string()).optional(),
  approvalWorkflow: z.array(ApprovalStepSchema).optional(),
  legalBasis: z.string().optional(),
  formTemplate: z.record(z.any()).optional(),
  interventions: z.array(ProgramInterventionInputSchema).optional(),
  isActive: z.boolean().optional(),
}).refine((d) => uniqueMatrix(d.interventions), {
  message: 'Each intervention may appear only once in the program matrix',
  path: ['interventions'] as const,
});

export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>;
export type ProgramInterventionInput = z.infer<typeof ProgramInterventionInputSchema>;
