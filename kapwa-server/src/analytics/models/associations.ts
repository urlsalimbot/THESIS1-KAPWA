export interface Rule {
  a: string;
  b: string;
  countA: number;
  countB: number;
  countBoth: number;
  support: number;
  confidence: number;
  lift: number;
}

export function pairwiseRules(
  transactions: string[][],
  opts: { minSupport?: number; minConfidence?: number; limit?: number } = {},
): Rule[] {
  const minSupport = opts.minSupport ?? 0.05;
  const minConfidence = opts.minConfidence ?? 0.5;
  const limit = opts.limit ?? 20;
  const total = transactions.length;
  if (total === 0) return [];

  const itemCounts = new Map<string, number>();
  for (const tx of transactions) {
    for (const item of new Set(tx)) itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
  }

  const pairCounts = new Map<string, number>();
  for (const tx of transactions) {
    const items = [...new Set(tx)].sort();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = `${items[i]}\u0000${items[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const rules: Rule[] = [];
  for (const [key, countBoth] of pairCounts) {
    const [a, b] = key.split('\u0000');
    const countA = itemCounts.get(a) ?? 0;
    const countB = itemCounts.get(b) ?? 0;
    if (countA === 0 || countB === 0) continue;
    const support = countBoth / total;
    if (support < minSupport) continue;
    const confidence = countBoth / countA;
    if (confidence < minConfidence) continue;
    const lift = confidence / (countB / total);
    rules.push({ a, b, countA, countB, countBoth, support, confidence, lift });
  }

  return rules
    .sort((x, y) => y.lift - x.lift || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
    .slice(0, limit);
}
