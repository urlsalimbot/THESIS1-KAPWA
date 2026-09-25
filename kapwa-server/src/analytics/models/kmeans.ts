import { mean, std, zScore, euclidean, median } from './stats';
import type { FeatureKey, HouseholdFeatureRow } from '../analytics.types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MatrixPrep {
  X: number[][];
  imputed: { income: number; daysSinceLastCase: number };
  means: number[];
  stds: number[];
}

export function prepareMatrix(rows: HouseholdFeatureRow[], features: FeatureKey[]): MatrixPrep {
  const incomes = rows.map(r => r.values.household_income).filter((v): v is number => v != null && Number.isFinite(v));
  const incomeFallback = incomes.length > 0 ? median(incomes) : 0;
  const days = rows.map(r => r.values.days_since_last_case).filter((v): v is number => v != null && Number.isFinite(v));
  const daysFallback = days.length > 0 ? Math.max(...days) : 0;

  let incomeImputed = 0;
  let daysImputed = 0;
  const raw = rows.map(r => features.map(key => {
    const value = r.values[key];
    if (value != null && Number.isFinite(value)) return value;
    if (key === 'household_income') { incomeImputed++; return incomeFallback; }
    if (key === 'days_since_last_case') { daysImputed++; return daysFallback; }
    return 0;
  }));

  const means = features.map((_, i) => mean(raw.map(v => v[i])));
  const stds = features.map((_, i) => std(raw.map(v => v[i])));
  const X = raw.map(vec => vec.map((v, i) => zScore(v, means[i], stds[i])));

  return { X, imputed: { income: incomeImputed, daysSinceLastCase: daysImputed }, means, stds };
}

export function initCentroids(X: number[][], k: number, rand: () => number): number[][] {
  if (X.length === 0) return [];
  const centroids: number[][] = [X[Math.floor(rand() * X.length) % X.length]];
  while (centroids.length < k) {
    const distances = X.map(point => Math.min(...centroids.map(c => euclidean(point, c) ** 2)));
    const total = distances.reduce((a, b) => a + b, 0);
    let pick: number;
    if (total <= 0) {
      pick = Math.floor(rand() * X.length) % X.length;
    } else {
      let target = rand() * total;
      pick = X.length - 1;
      for (let i = 0; i < distances.length; i++) {
        target -= distances[i];
        if (target <= 0) { pick = i; break; }
      }
    }
    centroids.push(X[pick]);
  }
  return centroids.map(c => [...c]);
}

export interface KmeansResult {
  assignments: number[];
  centroids: number[][];
  inertia: number;
}

export function runKmeans(X: number[][], k: number, seed: number, restarts = 5): KmeansResult {
  let best: KmeansResult | null = null;
  for (let restart = 0; restart < restarts; restart++) {
    const rand = mulberry32(seed + restart * 7919);
    let centroids = initCentroids(X, k, rand);
    let assignments: number[] = new Array(X.length).fill(0);
    for (let iter = 0; iter < 100; iter++) {
      assignments = X.map(point => {
        let bestIndex = 0;
        let bestDistance = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = euclidean(point, centroids[c]);
          if (d < bestDistance) { bestDistance = d; bestIndex = c; }
        }
        return bestIndex;
      });
      const next = centroids.map((centroid, c) => {
        const members = X.filter((_, i) => assignments[i] === c);
        if (members.length === 0) return centroid;
        return centroid.map((_, dim) => mean(members.map(m => m[dim])));
      });
      const shift = Math.max(...next.map((c, i) => euclidean(c, centroids[i])));
      centroids = next;
      if (shift < 1e-4) break;
    }
    const inertia = X.reduce((acc, point, i) => acc + euclidean(point, centroids[assignments[i]]) ** 2, 0);
    if (!best || inertia < best.inertia) best = { assignments, centroids, inertia };
  }
  return best as KmeansResult;
}

export function silhouette(X: number[][], assignments: number[], seed: number, maxExact = 2000, sample = 500): number {
  if (X.length === 0) return 0;
  const clusters = [...new Set(assignments)];
  if (clusters.length < 2) return 0;
  const rand = mulberry32(seed);
  const indices = X.map((_, i) => i);
  const subset = X.length <= maxExact ? indices : (() => {
    const pool = [...indices];
    const picked: number[] = [];
    const size = Math.min(sample, pool.length);
    for (let i = 0; i < size; i++) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return picked;
  })();

  let total = 0;
  for (const i of subset) {
    const same = indices.filter(j => j !== i && assignments[j] === assignments[i]);
    if (same.length === 0) continue;
    const a = mean(same.map(j => euclidean(X[i], X[j])));
    let b = Infinity;
    for (const c of clusters) {
      if (c === assignments[i]) continue;
      const others = indices.filter(j => assignments[j] === c);
      if (others.length === 0) continue;
      b = Math.min(b, mean(others.map(j => euclidean(X[i], X[j]))));
    }
    if (Number.isFinite(b)) total += (b - a) / Math.max(a, b);
  }
  return total / subset.length;
}

export interface CandidateK {
  k: number;
  inertia: number;
  silhouette: number;
  assignments: number[];
  centroids: number[][];
}

export function evaluateCandidates(X: number[][], kRange: [number, number], seed: number): CandidateK[] {
  const maxK = Math.min(kRange[1], X.length - 1);
  const results: CandidateK[] = [];
  for (let k = kRange[0]; k <= maxK; k++) {
    const result = runKmeans(X, k, seed);
    results.push({
      k,
      inertia: result.inertia,
      silhouette: silhouette(X, result.assignments, seed + k),
      assignments: result.assignments,
      centroids: result.centroids,
    });
  }
  return results;
}

export function chooseK(candidates: CandidateK[]): CandidateK {
  return candidates.reduce((best, c) =>
    c.silhouette > best.silhouette || (c.silhouette === best.silhouette && c.k < best.k) ? c : best,
  );
}
