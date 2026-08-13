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
    'Indigent',
    '4Ps',
    'Indigenous Person',
    'Family Head and Other Needy Adult',
  ]),
  natureOfService: z.array(z.string()).optional(),
  financialSubsidies: z.record(z.unknown()).optional(),
  amountAssistance: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.number().positive().optional()),
  modeFinancialAssistance: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.enum(['Cash', 'Cheque']).optional()),
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

export const TransitionPlanSchema = z.object({
  selfReliancePlan: z.string().nullable().optional(),
  selfRelianceLevel: z.number().min(1).max(3).nullable().optional(),
  sustainabilityPlan: z.string().nullable().optional(),
  transitionDate: z.string().nullable().optional(),
  referrals: z.array(z.object({
    agencyName: z.string(),
    contactInfo: z.string().nullable().optional(),
    reason: z.string(),
    status: z.enum(['pending', 'completed', 'declined']),
    notes: z.string().nullable().optional(),
  })).nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  exitNotes: z.string().nullable().optional(),
});

export const AssessmentV2Schema = z.object({
  problemsPresented: z.string().min(1, 'Problem/s presented is required'),
  socialWorkerAssessment: z.string().min(1, 'Social worker assessment is required'),
  clientCategory: z.enum([
    'Children in Need of Special Protection',
    'Youth in Need of Special Protection',
    'Women in Especially Difficult Circumstances',
    'Person with Disability',
    'Senior Citizen',
    'Indigent',
    '4Ps',
    'Indigenous Person',
    'Family Head and Other Needy Adult',
  ]),
  frvaScore: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.number().min(0).max(100).optional()),
  swdiScore: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.number().min(0).max(100).optional()),
  familyDialogueNotes: z.string().optional(),
  natureOfService: z.array(z.string()).optional(),
  financialSubsidies: z.record(z.unknown()).optional(),
  amountAssistance: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.number().positive().optional()),
  modeFinancialAssistance: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.enum(['Cash', 'Cheque']).optional()),
  sourceOfFund: z.string().optional(),
  legislatorSpecify: z.string().optional().nullable(),
  otherAssistance: z.record(z.unknown()).optional(),
  interviewedBy: z.string().optional(),
  clientSignature: z.string().optional(),
});

export const ClosureSchema = z.object({
  closureOutcome: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.enum([
    'graduated',
    'self_sufficient',
    'referred',
    'incomplete',
    'deceased',
  ])),
  exitNotes: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.string().optional()),
  clientSignature: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.string().optional()),
  closureDate: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.string().optional()),
});

export const RequirementsSchema = z.object({
  requirementsChecklist: z.record(z.boolean()),
});

export type TransitionPlanInput = z.infer<typeof TransitionPlanSchema>;
export type RequirementsInput = z.infer<typeof RequirementsSchema>;
export type AssessmentV2Input = z.infer<typeof AssessmentV2Schema>;
export type ClosureInput = z.infer<typeof ClosureSchema>;

export const BulkExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Select at least one case').max(500, 'Too many cases selected'),
  masked: z.boolean().default(true),
  unmaskReason: z.preprocess(v => v === '' || v === null || v === undefined ? undefined : v, z.string().trim().optional()),
});
export type BulkExportInput = z.infer<typeof BulkExportSchema>;
