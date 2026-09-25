import { AnalyticsRangeSchema, ClusteringRunSchema } from './analytics.zod';

describe('analytics zod schemas', () => {
  it('accepts an ascending or absent date range', () => {
    expect(AnalyticsRangeSchema.safeParse({ from: '2026-01-01', to: '2026-06-30' }).success).toBe(true);
    expect(AnalyticsRangeSchema.safeParse({}).success).toBe(true);
  });

  it('rejects from after to on both range schemas', () => {
    expect(AnalyticsRangeSchema.safeParse({ from: '2026-06-30', to: '2026-01-01' }).success).toBe(false);
    const run = ClusteringRunSchema.safeParse({ from: '2026-06-30', to: '2026-01-01' });
    expect(run.success).toBe(false);
    if (!run.success) expect(run.error.issues[0].message).toContain('from must be on or before to');
  });

  it('keeps the clustering k range and seed guards', () => {
    expect(ClusteringRunSchema.safeParse({ kRange: [3, 2] }).success).toBe(false);
    expect(ClusteringRunSchema.safeParse({ kRange: [2, 4], seed: 7 }).success).toBe(true);
    expect(ClusteringRunSchema.safeParse({ seed: -1 }).success).toBe(false);
  });
});
