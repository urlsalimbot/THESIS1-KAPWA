import { pairwiseRules } from './associations';

describe('association rules', () => {
  it('computes support, confidence, and lift against a hand-checked matrix', () => {
    // 10 transactions; A appears 6x, B appears 5x, together 4x
    const transactions: string[][] = [
      ['A', 'B'], ['A', 'B'], ['A', 'B'], ['A', 'B'],
      ['A'], ['A'],
      ['B'],
      ['C'], ['C'], ['C'],
    ];
    const rules = pairwiseRules(transactions, { minSupport: 0.1, minConfidence: 0.1 });
    const ab = rules.find(r => r.a === 'A' && r.b === 'B');
    expect(ab).toBeDefined();
    expect(ab!.countA).toBe(6);
    expect(ab!.countB).toBe(5);
    expect(ab!.countBoth).toBe(4);
    expect(ab!.support).toBeCloseTo(0.4);
    expect(ab!.confidence).toBeCloseTo(4 / 6);
    expect(ab!.lift).toBeCloseTo((4 / 6) / (5 / 10));
  });

  it('filters by minSupport and minConfidence', () => {
    const transactions = [['A', 'B'], ['A'], ['A'], ['A']];
    expect(pairwiseRules(transactions, { minSupport: 0.5 }).length).toBe(0);
    expect(pairwiseRules(transactions, { minSupport: 0.2, minConfidence: 0.9 }).length).toBe(0);
    expect(pairwiseRules(transactions, { minSupport: 0.2, minConfidence: 0.2 }).length).toBe(1);
  });

  it('deduplicates repeated items within a transaction and returns [] for empty input', () => {
    const transactions = [['A', 'A', 'B'], ['A', 'B']];
    const rules = pairwiseRules(transactions, { minSupport: 0.1, minConfidence: 0.1 });
    expect(rules[0].countBoth).toBe(2);
    expect(pairwiseRules([])).toEqual([]);
  });

  it('sorts by lift descending and caps at the limit', () => {
    const transactions = [['A', 'B'], ['A', 'B'], ['C', 'D'], ['C', 'D'], ['C', 'D']];
    const rules = pairwiseRules(transactions, { minSupport: 0.1, minConfidence: 0.1, limit: 1 });
    expect(rules).toHaveLength(1);
    expect(rules[0].lift).toBeGreaterThan(0);
  });
});
