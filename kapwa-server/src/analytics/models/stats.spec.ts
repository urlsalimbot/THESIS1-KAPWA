import { mean, std, median, quantile, zScore, gini, lorenzPoints, hhi, euclidean, clamp } from './stats';

describe('stats helpers', () => {
  it('computes central tendency and spread', () => {
    expect(mean([1, 2, 3])).toBeCloseTo(2);
    expect(median([3, 1, 2])).toBeCloseTo(2);
    expect(median([1, 2, 3, 4])).toBeCloseTo(2.5);
    expect(std([2, 2, 2])).toBe(0);
    expect(std([1, 3])).toBeCloseTo(1); // population std
  });

  it('handles empty and single-value inputs without NaN', () => {
    expect(mean([])).toBe(0);
    expect(median([])).toBe(0);
    expect(std([])).toBe(0);
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([7], 0.9)).toBe(7);
  });

  it('computes quantiles via linear interpolation', () => {
    const xs = [1, 2, 3, 4, 5];
    expect(quantile(xs, 0)).toBe(1);
    expect(quantile(xs, 0.5)).toBe(3);
    expect(quantile(xs, 1)).toBe(5);
    expect(quantile(xs, 0.25)).toBeCloseTo(2);
  });

  it('guards z-scores against zero variance', () => {
    expect(zScore(5, 5, 0)).toBe(0);
    expect(zScore(7, 5, 2)).toBe(1);
  });

  it('computes Gini with known answers', () => {
    expect(gini([100, 100, 100, 100])).toBeCloseTo(0);
    expect(gini([0, 0, 0, 100])).toBeCloseTo(0.75); // 1 - 1/n
    expect(gini([])).toBe(0);
    expect(gini([0, 0])).toBe(0);
  });

  it('produces Lorenz endpoints and monotone shares', () => {
    const points = lorenzPoints([0, 0, 0, 100], 4);
    expect(points[0]).toEqual({ p: 0, share: 0 });
    expect(points[points.length - 1]).toEqual({ p: 1, share: 1 });
    for (let i = 1; i < points.length; i++) expect(points[i].share).toBeGreaterThanOrEqual(points[i - 1].share);
  });

  it('computes HHI bounds', () => {
    expect(hhi([0.5, 0.5])).toBeCloseTo(0.5);
    expect(hhi([1])).toBeCloseTo(1);
    expect(hhi([0.2, 0.2, 0.2, 0.2, 0.2])).toBeCloseTo(0.2);
    expect(hhi([])).toBe(0);
  });

  it('computes euclidean distance and clamps', () => {
    expect(euclidean([0, 0], [3, 4])).toBeCloseTo(5);
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
  });
});
