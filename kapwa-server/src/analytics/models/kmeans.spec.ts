import { prepareMatrix, runKmeans, silhouette, evaluateCandidates, chooseK, mulberry32 } from './kmeans';
import type { HouseholdFeatureRow, FeatureKey } from '../analytics.types';

const FEATURES: FeatureKey[] = ['household_income', 'household_size'];

function row(id: string, income: number | null, size: number): HouseholdFeatureRow {
  return { householdId: id, barangay: 'Poblacion', values: { household_income: income, household_size: size } as HouseholdFeatureRow['values'] };
}

function blobRows(): HouseholdFeatureRow[] {
  const rows: HouseholdFeatureRow[] = [];
  for (let i = 0; i < 30; i++) rows.push(row(`a${i}`, 4000 + (i % 3), 2 + (i % 2)));
  for (let i = 0; i < 30; i++) rows.push(row(`b${i}`, 20000 + (i % 3), 7 + (i % 2)));
  for (let i = 0; i < 30; i++) rows.push(row(`c${i}`, 9000 + (i % 3), 4 + (i % 2)));
  return rows;
}

describe('kmeans', () => {
  it('prepares and standardizes a matrix, imputing NULL incomes with the median', () => {
    const rows = [row('h1', 1000, 1), row('h2', null, 2), row('h3', 3000, 3)];
    const prep = prepareMatrix(rows, FEATURES);
    expect(prep.X).toHaveLength(3);
    expect(prep.imputed.income).toBe(1);
    expect(prep.X[1][0]).toBeCloseTo(0); // 2000 (median) is the standardized mean
    for (const vec of prep.X) for (const v of vec) expect(Number.isFinite(v)).toBe(true);
  });

  it('handles zero-variance columns without NaN', () => {
    const rows = [row('h1', 1000, 1), row('h2', 1000, 1)];
    const prep = prepareMatrix(rows, FEATURES);
    for (const vec of prep.X) for (const v of vec) expect(Number.isFinite(v)).toBe(true);
  });

  it('recovers three well-separated blobs', () => {
    const prep = prepareMatrix(blobRows(), FEATURES);
    const result = runKmeans(prep.X, 3, 42);
    const byCluster = new Map<number, string[]>();
    blobRows().forEach((r, i) => {
      const c = result.assignments[i];
      byCluster.set(c, [...(byCluster.get(c) ?? []), r.householdId[0]]);
    });
    // every cluster should be dominated by a single source blob
    let pure = 0;
    for (const members of byCluster.values()) {
      const counts = new Map<string, number>();
      members.forEach(m => counts.set(m, (counts.get(m) ?? 0) + 1));
      pure += Math.max(...counts.values());
    }
    expect(pure / 90).toBeGreaterThanOrEqual(0.95);
  });

  it('is reproducible for the same seed and differs across seeds', () => {
    const X = prepareMatrix(blobRows(), FEATURES).X;
    const a = runKmeans(X, 3, 7);
    const b = runKmeans(X, 3, 7);
    expect(a.assignments).toEqual(b.assignments);
    const rand1 = mulberry32(1);
    const rand2 = mulberry32(2);
    expect(rand1()).not.toBe(rand2());
  });

  it('returns a silhouette within bounds', () => {
    const X = prepareMatrix(blobRows(), FEATURES).X;
    const result = runKmeans(X, 3, 42);
    const s = silhouette(X, result.assignments, 42);
    expect(s).toBeGreaterThanOrEqual(-1);
    expect(s).toBeLessThanOrEqual(1);
    expect(s).toBeGreaterThan(0.5); // separated blobs score well
  });

  it('evaluates a candidate k range and chooses the best silhouette', () => {
    const X = prepareMatrix(blobRows(), FEATURES).X;
    const candidates = evaluateCandidates(X, [2, 5], 42);
    expect(candidates.map(c => c.k)).toEqual([2, 3, 4, 5]);
    const chosen = chooseK(candidates);
    expect(candidates.some(c => c.k === chosen.k)).toBe(true);
    expect(chosen.silhouette).toBe(Math.max(...candidates.map(c => c.silhouette)));
  });
});
