import { z } from 'zod';

export const createCsrSchema = z.object({
  caseId: z.string().uuid(),
  socialWorkerName: z.string().min(1, 'Social worker name is required'),
  socialWorkerPosition: z.string().optional(),
  referralOrigin: z.string().optional(),
  reasonForReferral: z.string().optional(),
  problemPresented: z.string().optional(),
  familyBackground: z.string().optional(),
  socioEconomicProfile: z.string().optional(),
  assessmentAnalysis: z.string().optional(),
  recommendation: z.string().optional(),
  interventionPlan: z.string().optional(),
  clientSignatureUrl: z.string().optional(),
  workerSignatureUrl: z.string().optional(),
});

export const updateCsrSchema = createCsrSchema.partial().extend({
  finalized: z.boolean().optional(),
});

export const generatePdfSchema = z.object({
  controlNo: z.string(),
  orientation: z.enum(['portrait', 'landscape']).optional().default('portrait'),
});
