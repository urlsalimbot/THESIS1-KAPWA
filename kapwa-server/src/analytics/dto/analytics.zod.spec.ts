import { AnalyticsRangeSchema, ClusteringRunSchema, ForecastQuerySchema, AssociationsQuerySchema } from './analytics.zod';

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

describe('analytics wave-2 query schemas', () => {
  it('defaults and bounds the forecast query', () => {
    expect(ForecastQuerySchema.parse({})).toEqual({ metric: 'cases', horizon: 6 });
    expect(ForecastQuerySchema.safeParse({ metric: 'bogus' }).success).toBe(false);
    expect(ForecastQuerySchema.safeParse({ horizon: '0' }).success).toBe(false);
    expect(ForecastQuerySchema.safeParse({ horizon: '13' }).success).toBe(false);
    expect(ForecastQuerySchema.parse({ metric: 'disbursement', horizon: '12' }))
      .toEqual({ metric: 'disbursement', horizon: 12 });
  });

  it('bounds association thresholds and rejects inverted ranges', () => {
    expect(AssociationsQuerySchema.parse({})).toEqual({ minSupport: 0.05, minConfidence: 0.5 });
    expect(AssociationsQuerySchema.safeParse({ minSupport: '1.5' }).success).toBe(false);
    expect(AssociationsQuerySchema.safeParse({ minConfidence: '-0.1' }).success).toBe(false);
    expect(AssociationsQuerySchema.safeParse({ from: '2026-06-01', to: '2026-01-01' }).success).toBe(false);
    expect(AssociationsQuerySchema.parse({ minSupport: '0.2', minConfidence: '0.6' }))
      .toEqual({ minSupport: 0.2, minConfidence: 0.6 });
  });
});
