import { z } from 'zod';

export const UploadMetadataSchema = z.object({
  caseId: z.string().optional(),
  beneficiaryId: z.string().optional(),
  irfId: z.string().optional(),
  announcementId: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  requirementKey: z.string().optional(),
});

export const VerifyDocumentSchema = z.object({
  verified: z.boolean(),
});

export type UploadMetadataInput = z.infer<typeof UploadMetadataSchema>;
export type VerifyDocumentInput = z.infer<typeof VerifyDocumentSchema>;
