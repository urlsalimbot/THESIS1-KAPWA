import { z } from 'zod';

export const ImportLcrRecordSchema = z.record(z.string(), z.unknown());

export const ImportLcrBatchSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())),
});

export type ImportLcrRecordInput = z.infer<typeof ImportLcrRecordSchema>;
export type ImportLcrBatchInput = z.infer<typeof ImportLcrBatchSchema>;
