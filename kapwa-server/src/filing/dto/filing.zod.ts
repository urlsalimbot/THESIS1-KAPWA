import { z } from 'zod';

export const UploadMetadataSchema = z.object({
  caseId: z.string().optional(),
  beneficiaryId: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export type UploadMetadataInput = z.infer<typeof UploadMetadataSchema>;
