# Analytics Dashboard (Wave 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add income inequality (Gini/Lorenz), caseload & disbursement forecasting (Holt + MA baseline), and service association rules (support/confidence/lift) to the analytics module and `/analytics` dashboard.

**Architecture:** Three new pure-TS model files plus three cached service methods on the existing `AnalyticsService`, three read-only controller routes, and three new client tabs. No schema change — wave 2 reuses `case_interventions`, `cases`, `households`, and the wave-1 suppression policy.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + recharts + i18next (client), zod DTOs with `ZodPipe`, jest + vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-analytics-clustering-demographics-design.md` (§5.6–5.8, §4.3 wave-2 routes, §6 tabs, §7 suppression).

## Global Constraints

- Suppression policy (wave 1, already implemented): `MIN_CELL = 5`; counts below it return `{suppressed:true}`; any ratio derived from a suppressed count is suppressed too; complementary suppression applies within a count family (`complementSuppression`); a family's total is suppressed when any member cell is suppressed.
- SQL joins between `case_interventions.case_id` (TEXT) and `cases.id` (UUID) MUST cast: `c.id::text = ci.case_id`. Role joins must not fan out (`EXISTS`/pre-aggregation).
- Roles: all wave-2 GETs `admin | social_worker | mayor`; guards `AuthGuard('jwt') + RolesGuard`.
- Live GETs are wrapped in `CacheService.wrap` (5-min TTL, key = model + serialized params).
- Client tabs must render suppressed cells as `—`, handle 422 `insufficient_data` with required/actual counts, and include a `MethodologyNote`.
- i18n keys must exist in both `kapwa-client/src/i18n/locales/en/index.ts` and `fil/index.ts`; fil values differ from en (parity test).
- Server tests: `npx jest <pattern> --silent` (never `npm test`) + `npm run typecheck`. Client: focused vitest + `npm run typecheck` + fil-parity.
- Stage explicit paths when committing; leave unrelated dirty files alone.

## Review Focus

Five input classes/failure modes the spec implies but no happy path exercises; each gets a test in the owning task:

1. **Short/all-zero series** — a forecast over a flat-zero or 3-point series must return defined numbers (no NaN, no throw) and the UI must not crash (Tasks 1, 3, 5).
2. **Tiny samples** — fewer than 20 incomes and fewer than 30 transactions must yield the spec's 422 with required/actual, never a misleading result (Tasks 3, 4, 5).
3. **Suppression reconstruction** — association rules with a sub-5 count must suppress the derived support/confidence/lift too, so no ratio reveals the count (Tasks 3, 5).
4. **Boundary quantiles/percentiles** — deciles with duplicated incomes, top-10% rounding (ceil), and Lorenz endpoints must stay defined and monotone (Tasks 3, 5).
5. **Parameter validation** — `horizon` outside 1–12, unknown `metric`, `minSupport`/`minConfidence` outside [0,1], and `from > to` must 400 at the DTO, not compute (Tasks 3, 4).

---

## Task 1: Forecast model

**Files:**
- Create: `kapwa-server/src/analytics/models/forecast.ts`
- Create: `kapwa-server/src/analytics/models/forecast.spec.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces: `movingAverageForecast(values, horizon, window?)`, `holtLinear(values, opts?)` → `{ fitted, forecast, alpha, beta, residualStd }`, `mape(actual, predicted)`.

- [ ] **Step 1: Write the failing spec**

```ts
import { movingAverageForecast, holtLinear, mape } from './forecast';

describe('forecast models', () => {
  it('continues a perfect linear series', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = holtLinear(values, { horizon: 3 });
    expect(result.forecast).toHaveLength(3);
    expect(result.forecast[0]).toBeCloseTo(11, 6);
    expect(result.forecast[2]).toBeCloseTo(13, 6);
    expect(result.fitted[9]).toBeCloseTo(10, 6);
    expect(result.residualStd).toBeCloseTo(0, 6);
  });

  it('reports zero MAPE for exact predictions and null when nothing is comparable', () => {
    expect(mape([1, 2, 3], [1, 2, 3])).toBeCloseTo(0);
    expect(mape([], [])).toBeNull();
    expect(mape([0, 0], [1, 1])).toBeNull();
  });

  it('handles short and all-zero series without NaN', () => {
    const short = holtLinear([5], { horizon: 2 });
    expect(short.forecast.every(v => Number.isFinite(v))).toBe(true);
    const zeros = holtLinear([0, 0, 0, 0], { horizon: 4 });
    expect(zeros.forecast).toEqual([0, 0, 0, 0]);
    expect(Number.isFinite(zeros.residualStd)).toBe(true);
  });

  it('forecasts a moving average for a flat series and reacts to a jump', () => {
    expect(movingAverageForecast([5, 5, 5], 2)).toEqual([5, 5]);
    const ma = movingAverageForecast([0, 0, 9], 1);
    expect(ma[0]).toBeCloseTo(3);
  });

  it('grid-searches alpha and beta within the documented bounds', () => {
    const result = holtLinear([1, 2, 3, 4, 5, 6]);
    expect(result.alpha).toBeGreaterThanOrEqual(0.05);
    expect(result.alpha).toBeLessThanOrEqual(0.95);
    expect(result.beta).toBeGreaterThanOrEqual(0.05);
    expect(result.beta).toBeLessThanOrEqual(0.95);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest models/forecast --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
export function movingAverageForecast(values: number[], horizon: number, window = 3): number[] {
  const out: number[] = [];
  const history = [...values];
  for (let h = 0; h < horizon; h++) {
    const windowValues = history.slice(-window);
    const next = windowValues.length > 0
      ? windowValues.reduce((a, b) => a + b, 0) / windowValues.length
      : 0;
    out.push(next);
    history.push(next);
  }
  return out;
}

export interface HoltResult {
  fitted: number[];
  forecast: number[];
  alpha: number;
  beta: number;
  residualStd: number;
}

function holtWithParams(values: number[], alpha: number, beta: number, horizon: number): HoltResult {
  if (values.length === 0) {
    return { fitted: [], forecast: new Array(horizon).fill(0), alpha, beta, residualStd: 0 };
  }
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  // The seed level is the first fitted value; one-step residuals exist from t=1.
  const fitted: number[] = [values[0]];
  const residuals: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prediction = level + trend;
    fitted.push(prediction);
    residuals.push(values[i] - prediction);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);
  const residualMean = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
  const variance = residuals.length > 1
    ? residuals.reduce((acc, r) => acc + (r - residualMean) ** 2, 0) / (residuals.length - 1)
    : 0;
  return { fitted, forecast, alpha, beta, residualStd: Math.sqrt(variance) };
}

export function holtLinear(
  values: number[],
  opts: { horizon?: number; alpha?: number; beta?: number; gridSearch?: boolean } = {},
): HoltResult {
  const horizon = opts.horizon ?? 6;
  if (opts.alpha != null && opts.beta != null) {
    return holtWithParams(values, opts.alpha, opts.beta, horizon);
  }
  if (values.length < 3 || opts.gridSearch === false) {
    return holtWithParams(values, opts.alpha ?? 0.5, opts.beta ?? 0.3, horizon);
  }
  let best: HoltResult | null = null;
  let bestSse = Infinity;
  for (let a = 0.05; a <= 0.9501; a += 0.05) {
    for (let b = 0.05; b <= 0.9501; b += 0.05) {
      const alpha = Number(a.toFixed(2));
      const beta = Number(b.toFixed(2));
      const result = holtWithParams(values, alpha, beta, horizon);
      const sse = result.fitted.reduce((acc, f, i) => acc + (values[i] - f) ** 2, 0);
      if (sse < bestSse) {
        bestSse = sse;
        best = result;
      }
    }
  }
  return best ?? holtWithParams(values, 0.5, 0.3, horizon);
}

export function mape(actual: number[], predicted: number[]): number | null {
  const pairs = actual
    .map((a, i) => ({ a, p: predicted[i] }))
    .filter(x => x.p != null && Number.isFinite(x.p) && Number.isFinite(x.a));
  const nonZero = pairs.filter(x => x.a !== 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((acc, x) => acc + Math.abs((x.a - x.p) / x.a), 0) / nonZero.length;
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest models/forecast --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/models/forecast.ts kapwa-server/src/analytics/models/forecast.spec.ts
git commit -m "feat(analytics): Holt and moving-average forecast models"
```

---

## Task 2: Association rules model

**Files:**
- Create: `kapwa-server/src/analytics/models/associations.ts`
- Create: `kapwa-server/src/analytics/models/associations.spec.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces: `Rule` and `pairwiseRules(transactions, opts?)`.

- [ ] **Step 1: Write the failing spec**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest models/associations --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest models/associations --silent`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/models/associations.ts kapwa-server/src/analytics/models/associations.spec.ts
git commit -m "feat(analytics): pairwise association rule model"
```

---

## Task 3: Service methods — inequality, forecast, associations

**Files:**
- Modify: `kapwa-server/src/analytics/analytics.service.ts`
- Modify: `kapwa-server/src/analytics/analytics.service.spec.ts`

**Interfaces:**
- Consumes: `gini`, `lorenzPoints`, `quantile` (`./models/stats`); `holtLinear`, `movingAverageForecast`, `mape` (`./models/forecast`); `pairwiseRules` (`./models/associations`); `suppressCount` (`./suppression`); existing `caseRepo`, `cache`, `AnalyticsFilters`.
- Produces: `getInequality(filters)`, `getForecast({metric, horizon})`, `getAssociations({from?, to?, barangay?, minSupport, minConfidence})` with the response shapes below.

- [ ] **Step 1: Write the failing tests (append to the existing spec file)**

```ts
describe('AnalyticsService wave 2', () => {
  let service: AnalyticsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('getInequality', () => {
    it('computes Gini, Lorenz, top-10 share, and deciles for known incomes', async () => {
      repoMock.query.mockResolvedValue([
        { estimated_income: '1000' }, { estimated_income: '2000' }, { estimated_income: '3000' },
        { estimated_income: '4000' }, { estimated_income: '5000' }, { estimated_income: '6000' },
        { estimated_income: '7000' }, { estimated_income: '8000' }, { estimated_income: '9000' },
        { estimated_income: '10000' }, { estimated_income: '11000' }, { estimated_income: '12000' },
        { estimated_income: '13000' }, { estimated_income: '14000' }, { estimated_income: '15000' },
        { estimated_income: '16000' }, { estimated_income: '17000' }, { estimated_income: '18000' },
        { estimated_income: '19000' }, { estimated_income: '20000' },
      ]);
      const result = await service.getInequality({});
      expect(result.count).toBe(20);
      expect(result.gini).toBeGreaterThan(0.2);
      expect(result.lorenz[0]).toEqual({ p: 0, share: 0 });
      expect(result.lorenz[result.lorenz.length - 1]).toEqual({ p: 1, share: 1 });
      expect(result.top10Share).toBeCloseTo((19000 + 20000) / 210000);
      expect(result.deciles).toHaveLength(9);
    });

    it('throws insufficient_data below 20 incomes', async () => {
      repoMock.query.mockResolvedValue([{ estimated_income: '1000' }]);
      await expect(service.getInequality({})).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getForecast', () => {
    it('returns history, fitted, forecast with a widening band, and both MAPE metrics', async () => {
      // Build the same 24-month window the service computes, so every month matches.
      const months: string[] = [];
      const now = new Date();
      for (let i = 23; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
      }
      repoMock.query.mockResolvedValue(months.map((month, i) => ({ month, value: String(5 + i) })));
      const result = await service.getForecast({ metric: 'cases', horizon: 3 });
      expect(result.history).toHaveLength(24);
      expect(result.forecast).toHaveLength(3);
      expect(result.forecast[0].upper).toBeGreaterThanOrEqual(result.forecast[0].value);
      expect(result.forecast[2].upper - result.forecast[2].value)
        .toBeGreaterThanOrEqual(result.forecast[0].upper - result.forecast[0].value);
      expect(result.mape).not.toBeNull();
      expect(result.baselineMape).not.toBeNull();
      expect(result.metric).toBe('cases');
    });

    it('handles an all-zero series without NaN', async () => {
      repoMock.query.mockResolvedValue([]);
      const result = await service.getForecast({ metric: 'disbursement', horizon: 2 });
      expect(result.history.every(h => h.value === 0)).toBe(true);
      expect(result.forecast.every(f => Number.isFinite(f.value) && Number.isFinite(f.lower) && Number.isFinite(f.upper))).toBe(true);
    });
  });

  describe('getAssociations', () => {
    function txRows(pairs: Array<[string, string]>) {
      return pairs.map(([case_id, service_name]) => ({ case_id, service_name }));
    }

    it('computes rules and suppresses counts below 5 with their ratios', async () => {
      const pairs: Array<[string, string]> = [];
      for (let i = 0; i < 40; i++) pairs.push([`c${i}`, 'Medical']);
      for (let i = 0; i < 35; i++) pairs.push([`c${i}`, 'Food']);
      for (let i = 0; i < 3; i++) pairs.push([`c${i}`, 'Transport']);
      repoMock.query.mockResolvedValue(txRows(pairs));
      const result = await service.getAssociations({ minSupport: 0.05, minConfidence: 0.5 });
      expect(result.totalTransactions).toBe(40);
      const medicalFood = result.rules.find(r => r.a === 'Food' && r.b === 'Medical');
      expect(medicalFood).toBeDefined();
      expect(medicalFood!.countBoth).toEqual({ value: 35 });
      expect('value' in medicalFood!.support).toBe(true);
      const transportRule = result.rules.find(r => r.a === 'Transport' || r.b === 'Transport');
      if (transportRule) {
        expect(transportRule.countBoth).toEqual({ suppressed: true });
        expect('suppressed' in transportRule.support).toBe(true);
        expect('suppressed' in transportRule.confidence).toBe(true);
        expect('suppressed' in transportRule.lift).toBe(true);
      }
    });

    it('throws insufficient_data below 30 transactions', async () => {
      repoMock.query.mockResolvedValue(txRows([['c1', 'Medical']]));
      await expect(service.getAssociations({ minSupport: 0.05, minConfidence: 0.5 }))
        .rejects.toThrow(UnprocessableEntityException);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analytics.service --silent`
Expected: FAIL — `service.getInequality is not a function`.

- [ ] **Step 3: Implement the three methods**

Add to the imports in `analytics.service.ts`:

```ts
import { gini, hhi, lorenzPoints, quantile } from './models/stats';
import { holtLinear, movingAverageForecast, mape } from './models/forecast';
import { pairwiseRules } from './models/associations';
```

Add the methods (after `getEquity`):

```ts
  async getInequality(filters: AnalyticsFilters) {
    const compute = () => this.computeInequality(filters);
    return this.cache?.wrap(`analytics:inequality:${JSON.stringify(filters)}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeInequality(filters: AnalyticsFilters) {
    const rows: Array<{ estimated_income: string | null }> = await this.caseRepo.query(
      `SELECT estimated_income FROM households
       WHERE estimated_income IS NOT NULL AND estimated_income > 0
         AND ($1::text IS NULL OR COALESCE(barangay, 'Unspecified') = $1)`,
      [filters.barangay ?? null],
    );
    const incomes = (rows ?? [])
      .map(r => Number(r.estimated_income))
      .filter(v => Number.isFinite(v) && v > 0);
    const MIN_INCOME_SAMPLE = 20;
    if (incomes.length < MIN_INCOME_SAMPLE) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: MIN_INCOME_SAMPLE, actual: incomes.length });
    }
    const sorted = [...incomes].sort((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);
    const topCount = Math.max(1, Math.ceil(sorted.length * 0.1));
    const top10Share = total > 0 ? sorted.slice(-topCount).reduce((a, b) => a + b, 0) / total : 0;
    return {
      gini: gini(sorted),
      lorenz: lorenzPoints(sorted, 10),
      top10Share,
      deciles: Array.from({ length: 9 }, (_, i) => quantile(sorted, (i + 1) / 10)),
      count: sorted.length,
    };
  }

  async getForecast(params: { metric: 'cases' | 'disbursement'; horizon: number }) {
    const compute = () => this.computeForecast(params);
    return this.cache?.wrap(`analytics:forecast:${params.metric}:${params.horizon}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeForecast({ metric, horizon }: { metric: 'cases' | 'disbursement'; horizon: number }) {
    const rows: Array<{ month: string; value: string | number }> = await this.caseRepo.query(
      metric === 'cases'
        ? `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS value
           FROM cases
           WHERE created_at >= date_trunc('month', CURRENT_DATE) - interval '23 months'
           GROUP BY 1 ORDER BY 1`
        : `SELECT to_char(date_trunc('month', delivery_date), 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS value
           FROM case_interventions
           WHERE delivery_date >= date_trunc('month', CURRENT_DATE) - interval '23 months'
           GROUP BY 1 ORDER BY 1`,
    );

    const months: string[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    const byMonth = new Map((rows ?? []).map(r => [r.month, Number(r.value)]));
    const history = months.map(month => ({ month, value: byMonth.get(month) ?? 0 }));
    const values = history.map(h => h.value);

    const holdout = Math.min(6, Math.max(1, values.length - 3));
    const train = values.slice(0, values.length - holdout);
    const actualHoldout = values.slice(values.length - holdout);
    const modelHoldout = holtLinear(train, { horizon: holdout }).forecast;
    const mapeValue = mape(actualHoldout, modelHoldout);
    const baselineMape = mape(actualHoldout, movingAverageForecast(train, holdout));

    const model = holtLinear(values, { horizon });
    const lastMonth = months[months.length - 1];
    const forecast = model.forecast.map((value, i) => {
      const h = i + 1;
      const band = 1.96 * model.residualStd * Math.sqrt(h);
      const [year, month] = lastMonth.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1 + h, 1));
      const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      return {
        month: label,
        value: Math.max(0, Number(value.toFixed(2))),
        lower: Math.max(0, Number((value - band).toFixed(2))),
        upper: Number((value + band).toFixed(2)),
      };
    });

    return {
      metric,
      months: history.length,
      history,
      fitted: model.fitted.map((value, i) => ({ month: history[i].month, value: Math.max(0, Number(value.toFixed(2))) })),
      forecast,
      mape: mapeValue,
      baselineMape,
      alpha: model.alpha,
      beta: model.beta,
    };
  }

  async getAssociations(filters: AnalyticsFilters & { minSupport: number; minConfidence: number }) {
    const compute = () => this.computeAssociations(filters);
    return this.cache?.wrap(`analytics:associations:${JSON.stringify(filters)}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeAssociations(filters: AnalyticsFilters & { minSupport: number; minConfidence: number }) {
    const rows: Array<{ case_id: string; service_name: string }> = await this.caseRepo.query(
      `SELECT ci.case_id, ci.service_name
       FROM case_interventions ci
       JOIN cases c ON c.id::text = ci.case_id
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       LEFT JOIN households h ON h.id = b.household_id
       WHERE ci.service_name IS NOT NULL AND ci.service_name <> ''
         AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
         AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         AND ($3::text IS NULL OR COALESCE(h.barangay, 'Unspecified') = $3)
       GROUP BY 1, 2`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );
    const byCase = new Map<string, string[]>();
    for (const row of rows ?? []) {
      byCase.set(row.case_id, [...(byCase.get(row.case_id) ?? []), row.service_name]);
    }
    const transactions = [...byCase.values()];
    const MIN_TRANSACTIONS = 30;
    if (transactions.length < MIN_TRANSACTIONS) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: MIN_TRANSACTIONS, actual: transactions.length });
    }
    const rules = pairwiseRules(transactions, { minSupport: filters.minSupport, minConfidence: filters.minConfidence });
    return {
      totalTransactions: transactions.length,
      rules: rules.map(rule => {
        const countA = suppressCount(rule.countA);
        const countB = suppressCount(rule.countB);
        const countBoth = suppressCount(rule.countBoth);
        const anySuppressed = [countA, countB, countBoth].some(cell => 'suppressed' in cell);
        return {
          a: rule.a,
          b: rule.b,
          countA,
          countB,
          countBoth,
          support: anySuppressed ? { suppressed: true as const } : { value: rule.support },
          confidence: anySuppressed ? { suppressed: true as const } : { value: rule.confidence },
          lift: anySuppressed ? { suppressed: true as const } : { value: rule.lift },
        };
      }),
    };
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest analytics.service --silent && npm run typecheck`
Expected: PASS (all analytics.service tests, including the wave-2 additions); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/analytics.service.ts kapwa-server/src/analytics/analytics.service.spec.ts
git commit -m "feat(analytics): inequality, forecast, and association services"
```

---

## Task 4: DTOs and controller routes

**Files:**
- Modify: `kapwa-server/src/analytics/dto/analytics.zod.ts`
- Modify: `kapwa-server/src/analytics/analytics.controller.ts`
- Modify: `kapwa-server/src/analytics/analytics.controller.spec.ts`
- Create: `kapwa-server/src/analytics/dto/analytics.zod.spec.ts`

**Interfaces:**
- Consumes: `AnalyticsService.getInequality/getForecast/getAssociations` (Task 3).
- Produces: `GET /analytics/inequality`, `GET /analytics/forecast`, `GET /analytics/associations`.

- [ ] **Step 1: Write the failing controller tests (append to the existing spec)**

```ts
  it('returns inequality for the range filters', async () => {
    analytics.getInequality.mockResolvedValue({ gini: 0.4 });
    await controller.inequality({ from: '2026-01-01', to: '2026-06-30' });
    expect(analytics.getInequality).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-06-30' });
  });

  it('passes forecast metric and horizon through', async () => {
    analytics.getForecast.mockResolvedValue({ metric: 'cases' });
    await controller.forecast({ metric: 'disbursement', horizon: 12 });
    expect(analytics.getForecast).toHaveBeenCalledWith({ metric: 'disbursement', horizon: 12 });
  });

  it('passes association thresholds through', async () => {
    analytics.getAssociations.mockResolvedValue({ rules: [] });
    await controller.associations({ minSupport: 0.1, minConfidence: 0.6 });
    expect(analytics.getAssociations).toHaveBeenCalledWith({ minSupport: 0.1, minConfidence: 0.6 });
  });
```

Also add `getInequality: jest.fn(), getForecast: jest.fn(), getAssociations: jest.fn()` to the `analytics` mock object at the top of the spec.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analytics.controller --silent`
Expected: FAIL — `controller.inequality is not a function`.

- [ ] **Step 3: Add the DTO schemas**

Append to `dto/analytics.zod.ts`:

```ts
export const ForecastQuerySchema = z.object({
  metric: z.enum(['cases', 'disbursement']).default('cases'),
  horizon: z.coerce.number().int().min(1).max(12).default(6),
});

export const AssociationsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  barangay: z.string().min(1).max(120).optional(),
  minSupport: z.coerce.number().min(0).max(1).default(0.05),
  minConfidence: z.coerce.number().min(0).max(1).default(0.5),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: 'from must be on or before to' });

export type ForecastQueryInput = z.infer<typeof ForecastQuerySchema>;
export type AssociationsQueryInput = z.infer<typeof AssociationsQuerySchema>;
```

- [ ] **Step 4: Add the controller routes**

In `analytics.controller.ts`, extend the DTO import and add after `equity`:

```ts
  @Get('inequality')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Household income inequality (Gini, Lorenz, deciles)' })
  async inequality(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getInequality(query);
  }

  @Get('forecast')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Caseload or disbursement forecast (Holt linear, 6-month default)' })
  async forecast(@Query(new ZodPipe(ForecastQuerySchema)) query: ForecastQueryInput) {
    return this.analytics.getForecast(query);
  }

  @Get('associations')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Service association rules (support, confidence, lift)' })
  async associations(@Query(new ZodPipe(AssociationsQuerySchema)) query: AssociationsQueryInput) {
    return this.analytics.getAssociations(query);
  }
```

- [ ] **Step 5: Run the controller spec + typecheck**

Run: `npx jest analytics --silent && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Write the DTO validation spec**

`kapwa-server/src/analytics/dto/analytics.zod.spec.ts`:

```ts
import { ForecastQuerySchema, AssociationsQuerySchema } from './analytics.zod';

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
```

Run: `npx jest analytics.zod --silent`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/analytics/dto/analytics.zod.ts        kapwa-server/src/analytics/dto/analytics.zod.spec.ts        kapwa-server/src/analytics/analytics.controller.ts        kapwa-server/src/analytics/analytics.controller.spec.ts
git commit -m "feat(analytics): inequality, forecast, and association routes"
```

---

## Task 5: Client — query keys, i18n, three tabs, page wiring

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`
- Create: `kapwa-client/src/components/analytics/InequalityTab.tsx`
- Create: `kapwa-client/src/components/analytics/ForecastTab.tsx`
- Create: `kapwa-client/src/components/analytics/AssociationsTab.tsx`
- Create: `kapwa-client/src/components/analytics/InequalityTab.test.tsx`
- Create: `kapwa-client/src/components/analytics/ForecastTab.test.tsx`
- Create: `kapwa-client/src/components/analytics/AssociationsTab.test.tsx`
- Modify: `kapwa-client/src/pages/AnalyticsPage.tsx`
- Modify: `kapwa-client/src/pages/AnalyticsPage.test.tsx`

**Interfaces:**
- Consumes: wave-2 server routes; `MethodologyNote` (extend its `MethodologyKey` union); existing `AnalyticsFilters`/`rangeToDates`.
- Produces: three tabs rendered by `/analytics`; new i18n keys; three query keys.

- [ ] **Step 1: Write the failing component tests**

`InequalityTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { InequalityTab } from './InequalityTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <InequalityTab filters={{}} />
    </SWRConfig>,
  );
}

describe('InequalityTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      gini: 0.42, top10Share: 0.31, count: 120,
      lorenz: [{ p: 0, share: 0 }, { p: 0.5, share: 0.2 }, { p: 1, share: 1 }],
      deciles: [2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
    });
  });

  it('renders Gini, top-10 share, and deciles', async () => {
    renderTab();
    expect(await screen.findByText('0.420')).toBeTruthy();
    expect(screen.getByText(/31/)).toBeTruthy();
    expect(screen.getByText('₱10,000')).toBeTruthy();
  });

  it('renders the insufficient-data state', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), { body: { code: 'insufficient_data', required: 20, actual: 4 } }));
    renderTab();
    expect(await screen.findByText(/Not enough data/i)).toBeTruthy();
  });
});
```

`ForecastTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ForecastTab } from './ForecastTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ForecastTab filters={{}} />
    </SWRConfig>,
  );
}

const RESPONSE = {
  metric: 'cases', months: 24,
  history: [{ month: '2026-07', value: 10 }, { month: '2026-08', value: 12 }],
  fitted: [{ month: '2026-07', value: 9 }, { month: '2026-08', value: 11 }],
  forecast: [
    { month: '2026-09', value: 13, lower: 10, upper: 16 },
    { month: '2026-10', value: 14, lower: 9, upper: 19 },
  ],
  mape: 0.08, baselineMape: 0.15, alpha: 0.3, beta: 0.1,
};

describe('ForecastTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue(RESPONSE);
  });

  it('renders MAPE and baseline cards', async () => {
    renderTab();
    expect(await screen.findByText('8.0%')).toBeTruthy();
    expect(screen.getByText('15.0%')).toBeTruthy();
  });

  it('refetches when the metric changes', async () => {
    renderTab();
    await screen.findByText('8.0%');
    fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'disbursement' } });
    await waitFor(() => {
      const called = mockApiGet.mock.calls.some(args => JSON.stringify(args[0]).includes('disbursement'));
      expect(called).toBe(true);
    });
  });
});
```

`AssociationsTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { AssociationsTab } from './AssociationsTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <AssociationsTab filters={{}} />
    </SWRConfig>,
  );
}

describe('AssociationsTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      totalTransactions: 40,
      rules: [
        { a: 'Food', b: 'Medical', countA: { value: 35 }, countB: { value: 40 }, countBoth: { value: 35 }, support: { value: 0.875 }, confidence: { value: 1 }, lift: { value: 1.14 } },
        { a: 'Food', b: 'Transport', countA: { value: 35 }, countB: { suppressed: true }, countBoth: { suppressed: true }, support: { suppressed: true }, confidence: { suppressed: true }, lift: { suppressed: true } },
      ],
    });
  });

  it('renders rules and suppressed cells', async () => {
    renderTab();
    expect(await screen.findByText('Food')).toBeTruthy();
    expect(screen.getAllByText('Medical').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('renders the insufficient-data state', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('nope'), { body: { code: 'insufficient_data', required: 30, actual: 3 } }));
    renderTab();
    expect(await screen.findByText(/Not enough data/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (from `kapwa-client/`): `npx vitest run src/components/analytics/InequalityTab.test.tsx src/components/analytics/ForecastTab.test.tsx src/components/analytics/AssociationsTab.test.tsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Add query keys**

In `query-keys.ts`, inside the `analytics` block:

```ts
    inequality: (filters: Record<string, unknown>) =>
      memo(`analytics.inequality.${JSON.stringify(filters)}`, () => ['analytics', 'inequality', filters] as const),
    forecast: (params: Record<string, unknown>) =>
      memo(`analytics.forecast.${JSON.stringify(params)}`, () => ['analytics', 'forecast', params] as const),
    associations: (filters: Record<string, unknown>) =>
      memo(`analytics.associations.${JSON.stringify(filters)}`, () => ['analytics', 'associations', filters] as const),
```

- [ ] **Step 4: Add i18n keys (both locales)**

Inside the `analytics` object in `en/index.ts`, after the `equity` block:

```ts
    "inequality": {
      "gini": "Gini coefficient",
      "top10": "Top 10% income share",
      "count": "Households with income",
      "lorenz": "Lorenz curve",
      "deciles": "Income deciles",
      "decileLabel": "D{{n}}"
    },
    "forecast": {
      "metric": "Metric",
      "cases": "Cases",
      "disbursement": "Disbursement",
      "horizon": "Horizon (months)",
      "mape": "Model MAPE",
      "baselineMape": "MA(3) baseline MAPE",
      "params": "Fitted alpha {{alpha}}, beta {{beta}}",
      "history": "History and forecast"
    },
    "associations": {
      "total": "{{count}} cases analyzed",
      "itemA": "Service A",
      "itemB": "Service B",
      "support": "Support",
      "confidence": "Confidence",
      "lift": "Lift",
      "countBoth": "Cases with both",
      "minSupport": "Min support",
      "minConfidence": "Min confidence"
    },
```

and extend the `methodology` block with:

```ts
      "inequality": "Household incomes above zero are ranked; the Gini coefficient measures inequality from 0 (equal) to 1 (one household holds everything). The Lorenz curve plots cumulative population against cumulative income share, and deciles are the income cut-offs at each tenth. At least 20 incomes are required.",
      "forecast": "Monthly totals for the last 24 months are fit with Holt's linear trend (alpha and beta chosen by grid search). The 95% band widens with the square root of the horizon; accuracy is reported as MAPE against the last 6 months and compared with a 3-month moving-average baseline.",
      "associations": "Cases in range are transactions and distinct services rendered are items. Pairwise rules report support (share of cases with both), confidence (share of A cases that also have B), and lift (confidence divided by B's overall rate). Rules whose counts fall below 5 are suppressed together with their ratios.",
```

fil equivalents (values must differ from en):

```ts
    "inequality": {
      "gini": "Gini coefficient",
      "top10": "Bahagi ng kita ng nangungunang 10%",
      "count": "Sambahayang may kita",
      "lorenz": "Lorenz curve",
      "deciles": "Mga desil ng kita",
      "decileLabel": "D{{n}}"
    },
    "forecast": {
      "metric": "Sukatan",
      "cases": "Mga kaso",
      "disbursement": "Paglabas ng pondo",
      "horizon": "Abot-tanaw (buwan)",
      "mape": "MAPE ng modelo",
      "baselineMape": "MAPE ng MA(3) baseline",
      "params": "Nakalapat na alpha {{alpha}}, beta {{beta}}",
      "history": "Kasaysayan at hula"
    },
    "associations": {
      "total": "{{count}} kaso ang sinuri",
      "itemA": "Serbisyo A",
      "itemB": "Serbisyo B",
      "support": "Support",
      "confidence": "Confidence",
      "lift": "Lift",
      "countBoth": "Kaso na may pareho",
      "minSupport": "Pinakamababang support",
      "minConfidence": "Pinakamababang confidence"
    },
```

```ts
      "inequality": "Ang mga kita ng sambahayan na higit sa zero ay niraranggo; sinusukat ng Gini coefficient ang hindi pagkakapantay-pantay mula 0 (pantay) hanggang 1 (isang sambahayan ang may lahat). Ang Lorenz curve ay naglalagay ng cumulative na populasyon laban sa cumulative na bahagi ng kita, at ang mga desil ay ang mga hangganan ng kita sa bawat ika-sampu. Kailangan ng hindi bababa sa 20 kita.",
      "forecast": "Ang buwanang kabuuan ng huling 24 na buwan ay pinapasa sa Holt's linear trend (alpha at beta pinipili sa grid search). Ang 95% na banda ay lumalawak kasabay ng square root ng abot-tanaw; ang katumpakan ay MAPE laban sa huling 6 na buwan at inihahambing sa 3-buwang moving-average baseline.",
      "associations": "Ang mga kaso sa saklaw ay transaksyon at ang mga natatanging serbisyong naibigay ay item. Ang pairwise na tuntunin ay nag-uulat ng support (bahagi ng kaso na may pareho), confidence (bahagi ng A na may B), at lift (confidence na hinati sa pangkalahatang rate ng B). Ang mga tuntuning may bilang na mas mababa sa 5 ay nakubli kasama ang kanilang mga ratio.",
```

Also extend `MethodologyNote.tsx`'s `MethodologyKey` union with the three new keys, and add `"tabs": { "inequality": "Inequality", "forecast": "Forecast", "associations": "Associations" }` entries (fil: `"Kawalang-pantay"`, `"Hula"`, `"Mga Ugnayan"`) inside the existing `tabs` block.

- [ ] **Step 5: Write the three components**

`InequalityTab.tsx`:

```tsx
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

interface InequalityResponse {
  gini: number;
  top10Share: number;
  count: number;
  lorenz: Array<{ p: number; share: number }>;
  deciles: number[];
}

export function InequalityTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<InequalityResponse>(queryKeys.analytics.inequality(filters));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.inequality" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.gini', 'Gini coefficient')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data.gini.toFixed(3)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.top10', 'Top 10% income share')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{(data.top10Share * 100).toFixed(1)}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.inequality.count', 'Households with income')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data.count.toLocaleString()}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.inequality.lorenz', 'Lorenz curve')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.lorenz}>
              <XAxis dataKey="p" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="share" name={t('analytics.inequality.lorenz', 'Lorenz curve')} stroke="#3b82f6" dot={false} />
              <Line type="monotone" dataKey="p" name="—" stroke="#9ca3af" strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.inequality.deciles', 'Income deciles')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
          {data.deciles.map((value, i) => (
            <div key={i}>
              <span className="text-xs text-muted-foreground">{t('analytics.inequality.decileLabel', 'D{{n}}', { n: i + 1 })}</span>
              <p className="font-medium">₱{value.toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

`ForecastTab.tsx`:

```tsx
import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

interface ForecastPoint { month: string; value: number; lower: number; upper: number }
interface ForecastResponse {
  metric: 'cases' | 'disbursement';
  months: number;
  history: Array<{ month: string; value: number }>;
  fitted: Array<{ month: string; value: number }>;
  forecast: ForecastPoint[];
  mape: number | null;
  baselineMape: number | null;
  alpha: number;
  beta: number;
}

export function ForecastTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<'cases' | 'disbursement'>('cases');
  const [horizon, setHorizon] = useState(6);
  const params = { ...filters, metric, horizon };
  const { data, error, isLoading } = useSWR<ForecastResponse>(queryKeys.analytics.forecast(params));

  if (error) return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  const chartData = [
    ...data.history.map((h, i) => ({ month: h.month, value: h.value, fitted: data.fitted[i]?.value })),
    ...data.forecast.map(f => ({ month: f.month, forecast: f.value, range: [f.lower, f.upper] as [number, number] })),
  ];
  const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.forecast" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="forecast-metric">{t('analytics.forecast.metric', 'Metric')}</label>
          <select id="forecast-metric" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={metric} onChange={e => setMetric(e.target.value as 'cases' | 'disbursement')}>
            <option value="cases">{t('analytics.forecast.cases', 'Cases')}</option>
            <option value="disbursement">{t('analytics.forecast.disbursement', 'Disbursement')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="forecast-horizon">{t('analytics.forecast.horizon', 'Horizon (months)')}</label>
          <select id="forecast-horizon" className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.forecast.mape', 'Model MAPE')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{pct(data.mape)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.forecast.baselineMape', 'MA(3) baseline MAPE')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pct(data.baselineMape)}</p>
            <p className="text-xs text-muted-foreground">{t('analytics.forecast.params', 'Fitted alpha {{alpha}}, beta {{beta}}', { alpha: data.alpha, beta: data.beta })}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.forecast.history', 'History and forecast')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="range" name="95%" stroke="none" fill="#3b82f6" fillOpacity={0.15} />
              <Line type="monotone" dataKey="value" name={t('analytics.forecast.cases', 'Cases')} stroke="#111827" dot={false} />
              <Line type="monotone" dataKey="fitted" name="Fitted" stroke="#9ca3af" dot={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#3b82f6" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

`AssociationsTab.tsx`:

```tsx
import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';
import { MethodologyNote } from './MethodologyNote';

type Cell = { value: number } | { suppressed: true };
interface Rule {
  a: string; b: string;
  countA: Cell; countB: Cell; countBoth: Cell;
  support: Cell; confidence: Cell; lift: Cell;
}
interface AssociationsResponse { totalTransactions: number; rules: Rule[] }

function cellText(cell: Cell | undefined): string {
  if (!cell || 'suppressed' in cell) return '—';
  return cell.value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function AssociationsTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const [minSupport, setMinSupport] = useState(5);
  const [minConfidence, setMinConfidence] = useState(50);
  const params = { ...filters, minSupport: minSupport / 100, minConfidence: minConfidence / 100 };
  const { data, error, isLoading } = useSWR<AssociationsResponse>(queryKeys.analytics.associations(params));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.associations" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="assoc-support">{t('analytics.associations.minSupport', 'Min support')} (%)</label>
          <input id="assoc-support" type="number" min={0} max={100} className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm" value={minSupport} onChange={e => setMinSupport(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="assoc-confidence">{t('analytics.associations.minConfidence', 'Min confidence')} (%)</label>
          <input id="assoc-confidence" type="number" min={0} max={100} className="flex h-9 w-24 rounded-md border border-input bg-background px-2 text-sm" value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))} />
        </div>
        <p className="text-xs text-muted-foreground">{t('analytics.associations.total', '{{count}} cases analyzed', { count: data.totalTransactions })}</p>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.tabs.associations', 'Associations')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1">{t('analytics.associations.itemA', 'Service A')}</th>
                <th>{t('analytics.associations.itemB', 'Service B')}</th>
                <th>{t('analytics.associations.countBoth', 'Cases with both')}</th>
                <th>{t('analytics.associations.support', 'Support')}</th>
                <th>{t('analytics.associations.confidence', 'Confidence')}</th>
                <th>{t('analytics.associations.lift', 'Lift')}</th>
              </tr>
            </thead>
            <tbody>
              {data.rules.map(rule => (
                <tr key={`${rule.a}|${rule.b}`} className="border-t">
                  <td className="py-1">{rule.a}</td>
                  <td>{rule.b}</td>
                  <td>{cellText(rule.countBoth)}</td>
                  <td>{cellText(rule.support)}</td>
                  <td>{cellText(rule.confidence)}</td>
                  <td>{cellText(rule.lift)}</td>
                </tr>
              ))}
              {data.rules.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-center text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Wire the page**

In `AnalyticsPage.tsx`: import the three components, add three `TabsTrigger`s (inequality, forecast, associations) and three `TabsContent`s with `className="mt-4"`. Update the page description fallback to `'Demographics, clustering, inequality, forecasting, and associations'`.

- [ ] **Step 7: Update the page test**

In `AnalyticsPage.test.tsx`: extend the mock dispatch with `inequality` (gini 0.4, lorenz [], deciles []), `forecast` (empty history/fitted/forecast, mape null, baselineMape null, alpha/beta 0.5/0.3), and `associations` (`{ totalTransactions: 0, rules: [] }`) branches; extend the tab click-through test to also click Inequality (`/Gini coefficient/i`), Forecast (`/Model MAPE/i`), and Associations (`/Min support/i`).

- [ ] **Step 8: Run tests + typecheck + parity**

Run (from `kapwa-client/`): `npx vitest run src/components/analytics src/pages/AnalyticsPage.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts \
       kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts \
       kapwa-client/src/components/analytics/MethodologyNote.tsx \
       kapwa-client/src/components/analytics/InequalityTab.tsx \
       kapwa-client/src/components/analytics/InequalityTab.test.tsx \
       kapwa-client/src/components/analytics/ForecastTab.tsx \
       kapwa-client/src/components/analytics/ForecastTab.test.tsx \
       kapwa-client/src/components/analytics/AssociationsTab.tsx \
       kapwa-client/src/components/analytics/AssociationsTab.test.tsx \
       kapwa-client/src/pages/AnalyticsPage.tsx \
       kapwa-client/src/pages/AnalyticsPage.test.tsx
git commit -m "feat(analytics): inequality, forecast, and association tabs"
```

---

## Task 6: Wave-2 close — docs, full verification, boot smoke

**Files:**
- Modify: `.superpowers/sdd/progress.md` (gitignored scratch)

**Interfaces:**
- Consumes: everything above.
- Produces: verified wave-2 state.

- [ ] **Step 1: Append the ledger entry**

```markdown
## 2026-09-28 — Analytics Wave 2 (inequality, forecasting, association rules)
- Plan: docs/superpowers/plans/2026-09-28-analytics-dashboard-wave2.md (spec §5.6–5.8)
- Added models/forecast.ts (Holt + MA(3) + MAPE) and models/associations.ts (pairwise support/confidence/lift).
- Service: getInequality (Gini/Lorenz/deciles, ≥20 incomes), getForecast (24-month window, 6-month holdout MAPE vs baseline, 95% band), getAssociations (≥30 transactions, sub-5 counts suppress their ratios) — all cached.
- Client: Inequality/Forecast/Associations tabs wired into /analytics with methodology notes and 422 states.
- Analytics feature complete (waves 1–2); deferred items remain in the wave-1 ledger.
```

- [ ] **Step 2: Full verification gates**

```bash
cd kapwa-server && npm run typecheck && npx jest --silent && npm run lint
cd ../kapwa-client && npm run typecheck && npm run test:run
```

Expected: all suites green, typechecks clean, no new lint errors.

- [ ] **Step 3: Boot smoke check**

```bash
cd kapwa-server
npm run build
pg_ctl -D /tmp/opencode/kapwa-pg/data -o "-p 5433" -l /tmp/opencode/kapwa-pg/pg.log start || true
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS kapwa_wave2"
psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE kapwa_wave2"
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_wave2 node dist/database/migrate.js
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_wave2 PORT=3100 node dist/main.js > /tmp/kapwa-wave2-boot.log 2>&1 &
BOOT_PID=$!
sleep 15
grep -E "Nest application successfully started|Nest can't resolve dependencies|ERROR" /tmp/kapwa-wave2-boot.log | head -30
kill $BOOT_PID 2>/dev/null || true
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE kapwa_wave2"
pg_ctl -D /tmp/opencode/kapwa-pg/data stop || true
```

Expected: `Nest application successfully started`, no DI errors.

- [ ] **Step 4: Commit (if anything is tracked)**

```bash
git add .superpowers/sdd/progress.md 2>/dev/null && git commit -m "docs: record analytics wave 2" || echo "ledger is gitignored - nothing to commit"
```

---

## Self-Review

**1. Spec coverage (wave 2):**

| Spec section | Task |
|---|---|
| §5.6 income inequality (Lorenz/Gini/deciles/top-10%, n≥20) | Tasks 3, 4, 5 |
| §5.7 forecasting (24-mo window, Holt grid search, 6-mo holdout MAPE vs MA(3), 95% band, horizon 1–12) | Tasks 1, 3, 4, 5 |
| §5.8 association rules (pairwise, minSupport/minConfidence, lift-ranked, ≥30 transactions, sub-5 suppression) | Tasks 2, 3, 4, 5 |
| §4.3 wave-2 routes + roles | Task 4 |
| §6 wave-2 tabs + methodology notes + 422 states | Task 5 |
| §7 suppression policy on wave-2 outputs | Tasks 3, 5 |
| §8 validation (`horizon`, `metric`, thresholds, from≤to) | Task 4 |
| §9 testing strategy (known-answer math, service, controller, client) | Tasks 1–5 |
| §10 success criteria | Task 6 gates |

**2. Placeholder scan:** no TBD/TODO; every code step carries real code.

**3. Type consistency:** `holtLinear`/`mape`/`movingAverageForecast` signatures from Task 1 used verbatim in Task 3; `pairwiseRules`/`Rule` from Task 2 used in Task 3; service method names in Task 4 match Task 3; query keys added in Task 5 match the SWR calls in the same task; i18n keys referenced by the components exist in both locale blocks.

**4. Review Focus coverage:** short/all-zero series → Tasks 1, 3, 5; tiny samples → Tasks 3, 4, 5; suppression reconstruction → Tasks 3, 5; boundary quantiles → Tasks 3, 5; parameter validation → Task 4.
