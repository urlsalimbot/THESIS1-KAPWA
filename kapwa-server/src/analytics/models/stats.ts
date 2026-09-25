export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[], ddof = 0): number {
  if (xs.length === 0 || xs.length - ddof <= 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - ddof);
  return Math.sqrt(variance);
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}

export function quantile(sortedXs: number[], q: number): number {
  if (sortedXs.length === 0) return 0;
  const pos = clamp(q, 0, 1) * (sortedXs.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedXs[lo];
  return sortedXs[lo] + (sortedXs[hi] - sortedXs[lo]) * (pos - lo);
}

export function zScore(x: number, m: number, s: number): number {
  if (!s) return 0;
  return (x - m) / s;
}

export function gini(xs: number[]): number {
  const values = xs.filter(x => Number.isFinite(x) && x >= 0);
  const n = values.length;
  if (n === 0) return 0;
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * sorted[i];
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

export function lorenzPoints(xs: number[], buckets = 10): Array<{ p: number; share: number }> {
  const values = xs.filter(x => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (values.length === 0) return [{ p: 0, share: 0 }, { p: 1, share: 1 }];
  const total = values.reduce((a, b) => a + b, 0);
  const points: Array<{ p: number; share: number }> = [{ p: 0, share: 0 }];
  if (total <= 0) return [{ p: 0, share: 0 }, { p: 1, share: 1 }];
  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += values[i];
    const isLast = i === values.length - 1;
    const atBucket = (i + 1) % Math.max(1, Math.floor(values.length / buckets)) === 0;
    if (isLast || atBucket) {
      points.push({ p: (i + 1) / values.length, share: cumulative / total });
    }
  }
  if (points[points.length - 1].p < 1) points.push({ p: 1, share: 1 });
  return points;
}

export function hhi(shares: number[]): number {
  const clean = shares.filter(s => Number.isFinite(s));
  if (clean.length === 0) return 0;
  return clean.reduce((acc, s) => acc + s * s, 0);
}

export function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
