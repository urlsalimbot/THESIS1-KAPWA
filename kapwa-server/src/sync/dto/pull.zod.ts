import { z } from 'zod';

export const PullRequestSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
  versionVectors: z.array(z.object({
    tableName: z.string(),
    localVersion: z.number().int().min(0),
    serverVersion: z.number().int().min(0),
    lastSyncedAt: z.string().nullable().optional(),
  })).default([]),
});

export type PullRequestInput = z.infer<typeof PullRequestSchema>;
