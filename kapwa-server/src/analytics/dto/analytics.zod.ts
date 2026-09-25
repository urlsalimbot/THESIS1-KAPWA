import { z } from 'zod';
import { FEATURE_KEYS } from '../analytics.types';

const isoDate = z.string().date();

export const AnalyticsRangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  barangay: z.string().min(1).max(120).optional(),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: 'from must be on or before to' });

export const ClusteringRunSchema = z.object({
  kRange: z.tuple([z.number().int().min(2).max(10), z.number().int().min(2).max(10)])
    .refine(([a, b]) => a <= b, { message: 'kRange must be ascending' })
    .optional(),
  features: z.array(z.enum(FEATURE_KEYS)).min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  barangay: z.string().min(1).max(120).optional(),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
});

export const RunMembersQuerySchema = z.object({
  clusterIndex: z.coerce.number().int().min(0),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const RunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AnalyticsRangeInput = z.infer<typeof AnalyticsRangeSchema>;
export type ClusteringRunInput = z.infer<typeof ClusteringRunSchema>;
export type RunMembersQueryInput = z.infer<typeof RunMembersQuerySchema>;
export type RunListQueryInput = z.infer<typeof RunListQuerySchema>;
