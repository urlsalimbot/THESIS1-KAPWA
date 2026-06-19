import { z } from 'zod';

/**
 * Known MinIO buckets for the Kapwa system.
 */
export const KNOWN_BUCKETS = [
  'worker-signatures',
  'client-receipts',
  'irf-attachments',
  'coa-exports',
  'backups',
  'documents',
] as const;

export const BucketNameSchema = z.enum(KNOWN_BUCKETS);

export const UploadRequestSchema = z.object({
  bucket: BucketNameSchema.default('documents'),
});

export const SignedUrlRequestSchema = z.object({
  bucket: BucketNameSchema,
  fileName: z.string().min(1, 'File name is required').max(255),
});

export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export type SignedUrlRequest = z.infer<typeof SignedUrlRequestSchema>;
