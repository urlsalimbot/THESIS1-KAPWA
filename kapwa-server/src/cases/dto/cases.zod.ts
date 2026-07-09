import { z } from 'zod';
import { CaseStatus } from '../case.entity';

export const CreateCaseSchema = z.object({
  serviceRequested: z.array(z.string()).optional(),
  requirementsChecklist: z.record(z.boolean()).optional(),
  beneficiaryId: z.string().uuid().optional(),
  assignedWorkerId: z.string().uuid().optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export const ApproveCaseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  signature: z.string().optional(),
});

export const UpdateDocumentsSchema = z.object({
  certificateUrl: z.string().optional(),
  pettyCashVoucherUrl: z.string().optional(),
});

export const OverrideStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  reason: z.string().min(1, 'Override reason is required'),
});

export const DisburseSchema = z.object({
  status: z.nativeEnum(CaseStatus),
});

export const AssessmentSchema = z.object({
  problemsPresented: z.string().min(1, 'Problem/s presented is required'),
  socialWorkerAssessment: z.string().min(1, 'Social worker assessment is required'),
  clientCategory: z.enum([
    'Children in Need of Special Protection',
    'Youth in Need of Special Protection',
    'Women in Especially Difficult Circumstances',
    'Person with Disability',
    'Senior Citizen',
    'Family Head and Other Needy Adult',
  ]),
  natureOfService: z.array(z.string()).optional(),
  financialSubsidies: z.record(z.unknown()).optional(),
  amountAssistance: z.number().positive().optional(),
  modeFinancialAssistance: z.enum(['Cash', 'Cheque']).optional().nullable(),
  sourceOfFund: z.string().optional(),
  legislatorSpecify: z.string().optional().nullable(),
  otherAssistance: z.record(z.unknown()).optional(),
  interviewedBy: z.string().optional(),
  clientSignature: z.string().optional(),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type ApproveCaseInput = z.infer<typeof ApproveCaseSchema>;
export type UpdateDocumentsInput = z.infer<typeof UpdateDocumentsSchema>;
export type OverrideStatusInput = z.infer<typeof OverrideStatusSchema>;
export type DisburseInput = z.infer<typeof DisburseSchema>;
export type AssessmentInput = z.infer<typeof AssessmentSchema>;
