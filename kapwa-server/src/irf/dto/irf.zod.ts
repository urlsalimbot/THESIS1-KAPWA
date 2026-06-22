import { z } from 'zod';
import { IrfCategory, IrfDisposition } from '../irf-case.entity';

export const CreateIrfSchema = z.object({
  caseCategory: z.nativeEnum(IrfCategory),
  datetimeReported: z.string().optional(),
  datetimeIncident: z.string().optional(),
  itemAReportingPerson: z.record(z.any()).optional(),
  itemBPersonReported: z.record(z.any()).optional(),
  narration: z.string().optional(),
  msdwSignatureUrl: z.string().optional(),
  reportingSignatureUrl: z.string().optional(),
});

export const UpdateIrfDispositionSchema = z.object({
  disposition: z.nativeEnum(IrfDisposition),
});

export const DismissIrfSchema = z.object({
  reason: z.string().min(1, 'Dismissal reason is required'),
});

export const DecryptNarrationSchema = z.object({
  legalBasis: z.string().min(1, 'Legal basis code is required'),
});

export const OverrideDispositionSchema = z.object({
  targetDisposition: z.nativeEnum(IrfDisposition),
  reason: z.string().min(1, 'Override reason is required'),
});

export type CreateIrfInput = z.infer<typeof CreateIrfSchema>;
export type UpdateIrfDispositionInput = z.infer<typeof UpdateIrfDispositionSchema>;
export type DismissIrfInput = z.infer<typeof DismissIrfSchema>;
export type DecryptNarrationInput = z.infer<typeof DecryptNarrationSchema>;
export type OverrideDispositionInput = z.infer<typeof OverrideDispositionSchema>;
