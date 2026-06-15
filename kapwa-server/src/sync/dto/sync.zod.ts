import { z } from 'zod';

export const SyncChangeSchema = z.object({
  id: z.string(),
  tableName: z.string(),
  recordId: z.string(),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  payload: z.record(z.any()),
  clientUpdatedAt: z.string().datetime(),
});

export const VersionVectorSchema = z.object({
  tableName: z.string(),
  localVersion: z.number().int().min(0),
  serverVersion: z.number().int().min(0),
  lastSyncedAt: z.string().nullable().optional(),
});

export const SyncRequestSchema = z.object({
  deviceId: z.string().min(1),
  changes: z.array(SyncChangeSchema).default([]),
  versionVectors: z.array(VersionVectorSchema).default([]),
  idempotencyKey: z.string().min(1),
  signature: z.string().min(1),
});

export const ResolveConflictSchema = z.object({
  resolution: z.enum(['server', 'client']),
});

export type SyncChangeInput = z.infer<typeof SyncChangeSchema>;
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;
export type VersionVectorInput = z.infer<typeof VersionVectorSchema>;
