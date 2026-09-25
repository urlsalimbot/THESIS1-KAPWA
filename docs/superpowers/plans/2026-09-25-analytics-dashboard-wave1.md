# Analytics Dashboard (Wave 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the analytics foundation: persisted household k-means clustering runs, deep demographic analysis, geographic concentration, and equity/coverage — server module + `/analytics` dashboard.

**Architecture:** A new NestJS `analytics` module computes live descriptive models from SQL aggregates plus pure-TS math, and persists k-means runs to three new tables. The client adds one lazy `/analytics` page with a shared filter bar and one component per model. Wave 2 (inequality, forecasting, association rules) is a separate plan against the same spec.

**Tech Stack:** NestJS 11 + TypeORM + Postgres (server), React 19 + Vite + SWR + recharts + i18next (client), zod DTOs with `ZodPipe`, jest + vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-analytics-clustering-demographics-design.md`

## Global Constraints

- Every schema change lands in **both** a TypeORM migration and an idempotent statement in `src/database/migrate.ts`. Next migration key: `…0000000000066` (max is 0065 as of 2026-09-25; re-check before creating the file and bump if taken).
- Migration class names end in 13 digits matching the key, e.g. `CreateAnalysisTables0000000000066`.
- Entities extend `BaseEntity` (uuid v7) and declare snake_case `name:` on every column.
- Suppression threshold `MIN_CELL = 5` is enforced **server-side**; suppressed count cells return `{ suppressed: true }` with no value; percentages for suppressed cells are suppressed too.
- Drill-down is `admin | social_worker` only and audited via `AuditLogService.log`; `mayor` gets aggregates only; exports are aggregate-only.
- Roles: analytic GETs `admin | social_worker | mayor`; writes/drill-down `admin | social_worker`.
- `persons.age` is a getter — SQL computes age from `persons.dob` via `AGE`.
- Server tests: `npx jest --silent` (never `npm test`); typecheck `npm run typecheck`; client: `npm run test:run`, `npm run typecheck`.
- i18n keys must exist in both `kapwa-client/src/i18n/locales/en/index.ts` and `fil/index.ts`; fil values differ from en (parity test).
- Disposable Postgres for validation: port 5433, user/db `kapwa`, trust auth at `/tmp/opencode/kapwa-pg/data`.
- Stage explicit paths when committing; conventional commits; never commit secrets.

## Review Focus

Five input classes/failure modes the spec implies but no single task's happy path exercises; each gets a test in the owning task:

1. **Sparse/empty data** — a date range with zero interventions must render an empty state, not crash or divide by zero (Tasks 7, 9, 12).
2. **NULL incomes** — households with NULL `estimated_income` must be median-imputed for clustering and excluded from inequality; no NaN may reach z-scores or centroids (Tasks 4, 5).
3. **Degenerate math inputs** — zero-variance feature columns, a single household, k ≥ n, kRange inverted, empty co-occurrence counts: each must yield a clear error or a defined value, never NaN/Infinity (Tasks 3, 4).
4. **Suppression leaks** — every count cell and any percentage derived from a <5 cell must be suppressed in all wave-1 endpoints (Tasks 7, 8).
5. **Seed reproducibility** — the same seed + dataset + filters must produce identical assignments and metrics (Tasks 4, 6).

---

## Task 1: Schema — analysis run tables

**Files:**
- Create: `kapwa-server/src/database/migrations/CreateAnalysisTables0000000000066.ts`
- Modify: `kapwa-server/src/database/migrate.ts` (insert after the `case_payouts` block, before `form_version_history`)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `analysis_runs`, `analysis_run_clusters`, `analysis_run_members` with indexes `idx_run_member_unique`, `idx_run_member_cluster`, `idx_run_cluster_run`, `idx_runs_created`.

- [ ] **Step 1: Write the migration**

Check the current max key first: `ls kapwa-server/src/database/migrations | grep -oE '[0-9]{13}' | sort -n | tail -1` (currently 0065 → use 0066; if it is ≥0066, use max+1 and adjust the class name/file name accordingly).

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnalysisTables0000000000066 implements MigrationInterface {
  name = 'CreateAnalysisTables0000000000066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        model VARCHAR NOT NULL DEFAULT 'household_clustering',
        status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
        params JSONB,
        metrics JSONB,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id),
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analysis_run_clusters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        cluster_index INT NOT NULL,
        size INT NOT NULL,
        centroid JSONB,
        profile JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS analysis_run_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
        run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
        household_id UUID NOT NULL REFERENCES households(id),
        cluster_index INT NOT NULL,
        distance DECIMAL(12,6),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_run_member_unique ON analysis_run_members(run_id, household_id);
      CREATE INDEX IF NOT EXISTS idx_run_member_cluster ON analysis_run_members(run_id, cluster_index);
      CREATE INDEX IF NOT EXISTS idx_run_cluster_run ON analysis_run_clusters(run_id, cluster_index);
      CREATE INDEX IF NOT EXISTS idx_runs_created ON analysis_runs(created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_run_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_run_clusters`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_runs`);
  }
}
```

- [ ] **Step 2: Mirror it inside migrate.ts**

Insert immediately after the `case_payouts` block's indexes (before the `// Listahanan / NHTS-PR reference id` comment or next to the other history-created tables):

```ts
  // Analytics run tables (CreateAnalysisTables migration)
  await q.query(`CREATE TABLE IF NOT EXISTS analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    model VARCHAR NOT NULL DEFAULT 'household_clustering',
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
    params JSONB,
    metrics JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS analysis_run_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    cluster_index INT NOT NULL,
    size INT NOT NULL,
    centroid JSONB,
    profile JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE TABLE IF NOT EXISTS analysis_run_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id),
    cluster_index INT NOT NULL,
    distance DECIMAL(12,6),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_run_member_unique ON analysis_run_members(run_id, household_id)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_run_member_cluster ON analysis_run_members(run_id, cluster_index)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_run_cluster_run ON analysis_run_clusters(run_id, cluster_index)`);
  await q.query(`CREATE INDEX IF NOT EXISTS idx_runs_created ON analysis_runs(created_at DESC)`);
```

- [ ] **Step 3: Validate against disposable Postgres**

```bash
cd kapwa-server && npm run build
[ -d /tmp/opencode/kapwa-pg/data ] || initdb -D /tmp/opencode/kapwa-pg/data -U kapwa -A trust
pg_ctl -D /tmp/opencode/kapwa-pg/data -o "-p 5433" -l /tmp/opencode/kapwa-pg/pg.log start || true
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE IF EXISTS kapwa_analytics"
psql -h localhost -p 5433 -U kapwa -d postgres -c "CREATE DATABASE kapwa_analytics"
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_analytics node dist/database/migrate.js
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa_analytics node dist/database/migrate.js
psql -h localhost -p 5433 -U kapwa -d kapwa_analytics -c "\d analysis_runs"
psql -h localhost -p 5433 -U kapwa -d kapwa_analytics -c "\d analysis_run_members"
psql -h localhost -p 5433 -U kapwa -d postgres -c "DROP DATABASE kapwa_analytics"
pg_ctl -D /tmp/opencode/kapwa-pg/data stop || true
```

Expected: bootstrap succeeds twice (idempotent); all three tables and four indexes present.

- [ ] **Step 4: Run the server suite**

Run: `npx jest --silent`
Expected: all existing suites pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/database/migrations/CreateAnalysisTables0000000000066.ts kapwa-server/src/database/migrate.ts
git commit -m "feat(schema): analytics run tables"
```

---

## Task 2: Analysis run entities

**Files:**
- Create: `kapwa-server/src/analytics/analysis-run.entity.ts`
- Create: `kapwa-server/src/analytics/analysis-run-cluster.entity.ts`
- Create: `kapwa-server/src/analytics/analysis-run-member.entity.ts`
- Create: `kapwa-server/src/analytics/analysis-entities.spec.ts`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `AnalysisRun` (`model, status, params?, metrics?, startedAt?, completedAt?, createdBy?, error?`), `AnalysisRunCluster` (`runId, clusterIndex, size, centroid?, profile?`), `AnalysisRunMember` (`runId, householdId, clusterIndex, distance?`).

- [ ] **Step 1: Write the failing spec**

```ts
import { getMetadataArgsStorage } from 'typeorm';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';

describe('analytics entities', () => {
  const storage = getMetadataArgsStorage();

  it('maps AnalysisRun to analysis_runs', () => {
    expect(storage.tables.find(t => t.target === AnalysisRun)?.name).toBe('analysis_runs');
    const cols = storage.columns.filter(c => c.target === AnalysisRun).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'model', 'status', 'params', 'metrics', 'startedAt', 'completedAt', 'createdBy', 'error',
    ]));
  });

  it('maps AnalysisRunCluster to analysis_run_clusters', () => {
    expect(storage.tables.find(t => t.target === AnalysisRunCluster)?.name).toBe('analysis_run_clusters');
    const cols = storage.columns.filter(c => c.target === AnalysisRunCluster).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining(['runId', 'clusterIndex', 'size', 'centroid', 'profile']));
  });

  it('maps AnalysisRunMember to analysis_run_members', () => {
    expect(storage.tables.find(t => t.target === AnalysisRunMember)?.name).toBe('analysis_run_members');
    const cols = storage.columns.filter(c => c.target === AnalysisRunMember).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining(['runId', 'householdId', 'clusterIndex', 'distance']));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analysis-entities --silent`
Expected: FAIL — `Cannot find module './analysis-run.entity'`.

- [ ] **Step 3: Write the entities**

`analysis-run.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_runs')
export class AnalysisRun extends BaseEntity {
  @Column({ default: 'household_clustering' })
  model!: string;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: 'completed' | 'failed';

  @Column({ type: 'jsonb', nullable: true })
  params?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: Record<string, unknown>;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

`analysis-run-cluster.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_run_clusters')
export class AnalysisRunCluster extends BaseEntity {
  @Column({ name: 'run_id' })
  runId!: string;

  @Column({ name: 'cluster_index', type: 'int' })
  clusterIndex!: number;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'jsonb', nullable: true })
  centroid?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  profile?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

`analysis-run-member.entity.ts`:

```ts
import { Entity, Column, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('analysis_run_members')
export class AnalysisRunMember extends BaseEntity {
  @Column({ name: 'run_id' })
  runId!: string;

  @Column({ name: 'household_id' })
  householdId!: string;

  @Column({ name: 'cluster_index', type: 'int' })
  clusterIndex!: number;

  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  distance?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest analysis-entities --silent`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/analysis-run.entity.ts \
       kapwa-server/src/analytics/analysis-run-cluster.entity.ts \
       kapwa-server/src/analytics/analysis-run-member.entity.ts \
       kapwa-server/src/analytics/analysis-entities.spec.ts
git commit -m "feat(analytics): analysis run entities"
```

---

## Task 3: Pure statistics helpers

**Files:**
- Create: `kapwa-server/src/analytics/models/stats.ts`
- Create: `kapwa-server/src/analytics/models/stats.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `mean`, `std(xs, ddof?)`, `median`, `quantile(sortedXs, q)`, `zScore(x, m, s)`, `gini`, `lorenzPoints(xs, buckets?)`, `hhi(shares)`, `euclidean(a, b)`, `clamp(v, lo, hi)`.

- [ ] **Step 1: Write the failing spec**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest models/stats --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest models/stats --silent`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/models/stats.ts kapwa-server/src/analytics/models/stats.spec.ts
git commit -m "feat(analytics): pure statistics helpers"
```

---

## Task 4: K-means model

**Files:**
- Create: `kapwa-server/src/analytics/analytics.types.ts`
- Create: `kapwa-server/src/analytics/models/kmeans.ts`
- Create: `kapwa-server/src/analytics/models/kmeans.spec.ts`

**Interfaces:**
- Consumes: `stats.ts` (Task 3).
- Produces: `FEATURE_KEYS`, `FeatureKey`, `HouseholdFeatureRow` (types); `mulberry32(seed)`, `prepareMatrix(rows, features)`, `initCentroids(X, k, rand)`, `runKmeans(X, k, seed, restarts?)`, `silhouette(X, assignments, seed, maxExact?, sample?)`, `evaluateCandidates(X, kRange, seed)`, `chooseK(candidates)`.

- [ ] **Step 1: Write the failing spec**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest models/kmeans --silent`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Write `analytics.types.ts`**

```ts
export const FEATURE_KEYS = [
  'household_income',
  'household_size',
  'children_0_5',
  'children_6_17',
  'adults_18_59',
  'seniors_60',
  'has_pwd',
  'has_solo_parent',
  'has_4ps',
  'case_count',
  'intervention_count',
  'total_assistance',
  'days_since_last_case',
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

export interface HouseholdFeatureRow {
  householdId: string;
  barangay: string | null;
  values: Record<FeatureKey, number | null>;
}
```

- [ ] **Step 4: Write `kmeans.ts`**

```ts
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
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx jest models/kmeans --silent`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/analytics/analytics.types.ts \
       kapwa-server/src/analytics/models/kmeans.ts \
       kapwa-server/src/analytics/models/kmeans.spec.ts
git commit -m "feat(analytics): k-means model with seeded reproducibility"
```

---

## Task 5: Feature extraction + suppression

**Files:**
- Create: `kapwa-server/src/analytics/suppression.ts`
- Create: `kapwa-server/src/analytics/analytics-features.service.ts`
- Create: `kapwa-server/src/analytics/analytics-features.spec.ts`

**Interfaces:**
- Consumes: `HouseholdFeatureRow`, `FeatureKey` (Task 4).
- Produces: `MIN_CELL = 5`; `suppressCount(n)` → `{ value: number } | { suppressed: true }`; `suppressRatio(value, baseCount)`; `AnalyticsFeaturesService.getHouseholdFeatures(filters)` → `HouseholdFeatureRow[]`; `getRunMembers(runId, clusterIndex, page, limit)`.

- [ ] **Step 1: Write the failing spec**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { Household } from '../beneficiaries/household.entity';
import { MIN_CELL, suppressCount, suppressRatio } from './suppression';

describe('suppression', () => {
  it('suppresses counts below the cell minimum', () => {
    expect(suppressCount(4)).toEqual({ suppressed: true });
    expect(suppressCount(5)).toEqual({ value: 5 });
    expect(suppressRatio(0.5, 4)).toEqual({ suppressed: true });
    expect(suppressRatio(0.5, 10)).toEqual({ value: 0.5 });
    expect(MIN_CELL).toBe(5);
  });
});

describe('AnalyticsFeaturesService', () => {
  let service: AnalyticsFeaturesService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsFeaturesService,
        { provide: getRepositoryToken(Household), useValue: repoMock },
      ],
    }).compile();
    service = module.get(AnalyticsFeaturesService);
  });

  it('maps raw SQL rows into feature rows and computes days since last case', async () => {
    repoMock.query.mockResolvedValue([{
      household_id: 'h1', barangay: 'Poblacion', estimated_income: '8500',
      household_size: '4', children_0_5: '1', children_6_17: '1', adults_18_59: '2', seniors_60: '0',
      has_pwd: false, has_solo_parent: true, has_4ps: true,
      case_count: '3', intervention_count: '5', total_assistance: '12500.00', days_since_last_case: '30',
    }]);
    const rows = await service.getHouseholdFeatures({});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      householdId: 'h1',
      barangay: 'Poblacion',
      values: expect.objectContaining({
        household_income: 8500,
        household_size: 4,
        has_solo_parent: 1,
        total_assistance: 12500,
        days_since_last_case: 30,
      }),
    });
    const [sql, params] = repoMock.query.mock.calls[0];
    expect(String(sql)).toContain('FROM households h');
    expect(params).toEqual([null, null, null]);
  });

  it('passes range and barangay filters into the query params', async () => {
    repoMock.query.mockResolvedValue([]);
    await service.getHouseholdFeatures({ from: '2026-01-01', to: '2026-06-30', barangay: 'Bigte' });
    expect(repoMock.query.mock.calls[0][1]).toEqual(['2026-01-01', '2026-06-30', 'Bigte']);
  });

  it('pages run members', async () => {
    repoMock.query.mockResolvedValue([{ household_id: 'h1', cluster_index: 1, distance: '0.5', barangay: 'Bigte', total: '7' }]);
    const page = await service.getRunMembers('run-1', 1, 2, 20);
    expect(page.total).toBe(7);
    expect(page.rows[0]).toEqual({ householdId: 'h1', clusterIndex: 1, distance: 0.5, barangay: 'Bigte' });
    const [sql, params] = repoMock.query.mock.calls[0];
    expect(String(sql)).toContain('FROM analysis_run_members m');
    expect(params).toEqual(['run-1', 1, 20, 20]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analytics-features --silent`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Write `suppression.ts`**

```ts
export const MIN_CELL = 5;

export type Suppressed<T> = { value: T } | { suppressed: true };

export function suppressCount(count: number): Suppressed<number> {
  if (count < MIN_CELL) return { suppressed: true };
  return { value: count };
}

export function suppressRatio(ratio: number, baseCount: number): Suppressed<number> {
  if (baseCount < MIN_CELL) return { suppressed: true };
  return { value: ratio };
}
```

- [ ] **Step 4: Write `analytics-features.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Household } from '../beneficiaries/household.entity';
import type { HouseholdFeatureRow } from './analytics.types';

export interface FeatureFilters {
  from?: string;
  to?: string;
  barangay?: string;
}

interface RawFeatureRow {
  household_id: string;
  barangay: string | null;
  estimated_income: string | null;
  household_size: string;
  children_0_5: string;
  children_6_17: string;
  adults_18_59: string;
  seniors_60: string;
  has_pwd: boolean;
  has_solo_parent: boolean;
  has_4ps: boolean;
  case_count: string;
  intervention_count: string;
  total_assistance: string | null;
  days_since_last_case: string | null;
}

@Injectable()
export class AnalyticsFeaturesService {
  constructor(
    @InjectRepository(Household)
    private householdRepo: Repository<Household>,
  ) {}

  async getHouseholdFeatures(filters: FeatureFilters): Promise<HouseholdFeatureRow[]> {
    const rows: RawFeatureRow[] = await this.householdRepo.query(
      `WITH member_rollup AS (
         SELECT hm.household_id,
                COUNT(*) AS household_size,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) <= 5) AS children_0_5,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) BETWEEN 6 AND 17) AS children_6_17,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) BETWEEN 18 AND 59) AS adults_18_59,
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) >= 60) AS seniors_60,
                BOOL_OR(br.category = 'PWD') AS has_pwd,
                BOOL_OR(br.category = 'Solo Parent') AS has_solo_parent,
                BOOL_OR(br.category = '4Ps') AS has_4ps
         FROM household_memberships hm
         JOIN persons p ON p.id = hm.person_id
         LEFT JOIN beneficiary_roles br ON br.person_id = p.id
         GROUP BY hm.household_id
       ),
       case_rollup AS (
         SELECT b.household_id,
                COUNT(DISTINCT c.id) AS case_count,
                COUNT(ci.id) AS intervention_count,
                COALESCE(SUM(ci.amount), 0) AS total_assistance,
                MAX(c.created_at::date) AS last_case_date
         FROM beneficiaries b
         LEFT JOIN cases c ON c.beneficiary_id = b.id
           AND ($1::date IS NULL OR c.created_at::date >= $1::date)
           AND ($2::date IS NULL OR c.created_at::date <= $2::date)
         LEFT JOIN case_interventions ci ON ci.case_id = c.id
           AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         WHERE b.household_id IS NOT NULL
         GROUP BY b.household_id
       )
       SELECT h.id AS household_id,
              h.barangay,
              h.estimated_income,
              mr.household_size, mr.children_0_5, mr.children_6_17, mr.adults_18_59, mr.seniors_60,
              COALESCE(mr.has_pwd, FALSE) AS has_pwd,
              COALESCE(mr.has_solo_parent, FALSE) AS has_solo_parent,
              COALESCE(mr.has_4ps, FALSE) AS has_4ps,
              COALESCE(cr.case_count, 0) AS case_count,
              COALESCE(cr.intervention_count, 0) AS intervention_count,
              COALESCE(cr.total_assistance, 0) AS total_assistance,
              (CURRENT_DATE - cr.last_case_date) AS days_since_last_case
       FROM households h
       JOIN member_rollup mr ON mr.household_id = h.id
       LEFT JOIN case_rollup cr ON cr.household_id = h.id
       WHERE ($3::text IS NULL OR h.barangay = $3)
       ORDER BY h.id`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );

    return (rows ?? []).map(row => ({
      householdId: row.household_id,
      barangay: row.barangay,
      values: {
        household_income: row.estimated_income != null ? Number(row.estimated_income) : null,
        household_size: Number(row.household_size),
        children_0_5: Number(row.children_0_5),
        children_6_17: Number(row.children_6_17),
        adults_18_59: Number(row.adults_18_59),
        seniors_60: Number(row.seniors_60),
        has_pwd: row.has_pwd ? 1 : 0,
        has_solo_parent: row.has_solo_parent ? 1 : 0,
        has_4ps: row.has_4ps ? 1 : 0,
        case_count: Number(row.case_count),
        intervention_count: Number(row.intervention_count),
        total_assistance: Number(row.total_assistance ?? 0),
        days_since_last_case: row.days_since_last_case != null ? Number(row.days_since_last_case) : null,
      },
    }));
  }

  async getRunMembers(
    runId: string,
    clusterIndex: number,
    page: number,
    limit: number,
  ): Promise<{ rows: Array<{ householdId: string; clusterIndex: number; distance: number | null; barangay: string | null }>; total: number }> {
    const offset = (page - 1) * limit;
    const rows = await this.householdRepo.query(
      `SELECT m.household_id, m.cluster_index, m.distance, h.barangay,
              COUNT(*) OVER() AS total
       FROM analysis_run_members m
       JOIN households h ON h.id = m.household_id
       WHERE m.run_id = $1 AND m.cluster_index = $2
       ORDER BY m.distance ASC
       LIMIT $3 OFFSET $4`,
      [runId, clusterIndex, limit, offset],
    );
    return {
      total: rows?.[0]?.total != null ? Number(rows[0].total) : 0,
      rows: (rows ?? []).map((r: any) => ({
        householdId: r.household_id,
        clusterIndex: Number(r.cluster_index),
        distance: r.distance != null ? Number(r.distance) : null,
        barangay: r.barangay ?? null,
      })),
    };
  }
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx jest analytics-features --silent`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/analytics/suppression.ts \
       kapwa-server/src/analytics/analytics-features.service.ts \
       kapwa-server/src/analytics/analytics-features.spec.ts
git commit -m "feat(analytics): feature extraction and suppression policy"
```

---

## Task 6: Clustering run service

**Files:**
- Create: `kapwa-server/src/analytics/clustering.service.ts`
- Create: `kapwa-server/src/analytics/clustering.service.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5 (`AnalysisRun*` entities, `prepareMatrix`, `evaluateCandidates`, `chooseK`, `AnalyticsFeaturesService`, `AuditLogService`).
- Produces: `ClusteringService.createRun(input, userId?)`, `listRuns(limit)`, `getRun(id)`, `getRunMembers(id, clusterIndex, page, limit, userId?)`, `exportRunCsv(id)`.

- [ ] **Step 1: Write the failing spec**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClusteringService } from './clustering.service';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';
import { AuditLogService } from '../audit/audit-log.service';
import type { HouseholdFeatureRow } from './analytics.types';

function rows(n: number): HouseholdFeatureRow[] {
  return Array.from({ length: n }, (_, i) => ({
    householdId: `h${i}`,
    barangay: i % 2 === 0 ? 'Poblacion' : 'Bigte',
    values: {
      household_income: 5000 + (i % 10) * 1000,
      household_size: 1 + (i % 6),
      children_0_5: i % 3, children_6_17: i % 4, adults_18_59: 1 + (i % 3), seniors_60: i % 2,
      has_pwd: i % 5 === 0 ? 1 : 0, has_solo_parent: i % 7 === 0 ? 1 : 0, has_4ps: i % 2,
      case_count: i % 4, intervention_count: i % 6, total_assistance: (i % 5) * 1000,
      days_since_last_case: i * 3,
    },
  }));
}

describe('ClusteringService', () => {
  let service: ClusteringService;
  let runRepo: any;
  let clusterRepo: any;
  let memberRepo: any;
  let features: any;
  let audit: any;

  beforeEach(async () => {
    runRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn(async (d: any) => ({ id: 'run-1', ...d })),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    clusterRepo = { create: jest.fn((d: any) => d), save: jest.fn(), insert: jest.fn() };
    memberRepo = { insert: jest.fn() };
    features = { getHouseholdFeatures: jest.fn(), getRunMembers: jest.fn() };
    audit = { log: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ClusteringService,
        { provide: getRepositoryToken(AnalysisRun), useValue: runRepo },
        { provide: getRepositoryToken(AnalysisRunCluster), useValue: clusterRepo },
        { provide: getRepositoryToken(AnalysisRunMember), useValue: memberRepo },
        { provide: AnalyticsFeaturesService, useValue: features },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();
    service = module.get(ClusteringService);
  });

  it('rejects datasets below the minimum size', async () => {
    features.getHouseholdFeatures.mockResolvedValue(rows(19));
    await expect(service.createRun({})).rejects.toThrow(UnprocessableEntityException);
  });

  it('persists a completed run with candidates, clusters, and members', async () => {
    features.getHouseholdFeatures.mockResolvedValue(rows(60));
    runRepo.save
      .mockImplementationOnce(async (d: any) => ({ id: 'run-1', ...d }))
      .mockImplementation(async (d: any) => d);
    clusterRepo.save.mockImplementation(async (d: any) => d);
    memberRepo.insert.mockResolvedValue({ identifiers: [] });

    const run = await service.createRun({ kRange: [2, 3], seed: 99 }, 'user-1');

    expect(run.id).toBe('run-1');
    expect(runRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'household_clustering', status: 'completed', createdBy: 'user-1',
    }));
    const params = runRepo.create.mock.calls[0][0].params;
    expect(params.seed).toBe(99);
    expect(params.chosen_k).toBeGreaterThanOrEqual(2);
    const metrics = runRepo.create.mock.calls[0][0].metrics;
    expect(metrics.dataset_size).toBe(60);
    expect(metrics.candidates.map((c: any) => c.k)).toEqual([2, 3]);
    expect(clusterRepo.save).toHaveBeenCalled();
    expect(clusterRepo.save).toHaveBeenCalledTimes(params.chosen_k);
    expect(memberRepo.insert).toHaveBeenCalled();
    expect(memberRepo.insert.mock.calls[0][0]).toHaveLength(60);
  });

  it('persists a failed run and rethrows', async () => {
    features.getHouseholdFeatures.mockResolvedValue(rows(60));
    runRepo.save
      .mockImplementationOnce(async (d: any) => ({ id: 'run-failed', ...d }))
      .mockImplementation(async (d: any) => d);
    clusterRepo.save.mockRejectedValue(new Error('db down'));

    await expect(service.createRun({ kRange: [2, 2] }, 'user-1')).rejects.toThrow('db down');
    const failed = runRepo.create.mock.calls.find(c => c[0].status === 'failed');
    expect(failed?.[0].error).toContain('db down');
  });

  it('throws NotFound for unknown runs', async () => {
    runRepo.findOne.mockResolvedValue(null);
    await expect(service.getRun('missing')).rejects.toThrow(NotFoundException);
  });

  it('audits member drill-down access', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'run-1' });
    features.getRunMembers.mockResolvedValue({ rows: [], total: 0 });
    await service.getRunMembers('run-1', 0, 1, 20, 'user-7');
    expect(audit.log).toHaveBeenCalledWith('analytics.drilldown', 'run-1', 'user-7', expect.objectContaining({ clusterIndex: 0, page: 1 }));
  });

  it('exports an aggregate CSV with run metadata', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'run-1', status: 'completed',
      params: { chosen_k: 2, seed: 5, dataset_size: 60 },
      metrics: { dataset_size: 60 },
      createdAt: new Date('2026-09-25T00:00:00Z'),
    });
    clusterRepo.find.mockResolvedValue([
      { clusterIndex: 0, size: 30, profile: { household_income_median: 6000 } },
      { clusterIndex: 1, size: 30, profile: { household_income_median: 15000 } },
    ]);
    const { buffer, filename } = await service.exportRunCsv('run-1');
    const text = buffer.toString('utf8');
    expect(text).toContain('# run_id,run-1');
    expect(text).toContain('cluster_index,size');
    expect(text).toContain('0,30');
    expect(filename).toMatch(/^analytics-clusters-.*\.csv$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest clustering.service --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the service**

```ts
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FEATURE_KEYS, FeatureKey } from './analytics.types';
import { prepareMatrix, evaluateCandidates, chooseK, CandidateK } from './models/kmeans';
import { median } from './models/stats';

const MIN_DATASET = 20;

export interface CreateRunInput {
  kRange?: [number, number];
  features?: FeatureKey[];
  from?: string;
  to?: string;
  barangay?: string;
  seed?: number;
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Injectable()
export class ClusteringService {
  constructor(
    @InjectRepository(AnalysisRun)
    private runRepo: Repository<AnalysisRun>,
    @InjectRepository(AnalysisRunCluster)
    private clusterRepo: Repository<AnalysisRunCluster>,
    @InjectRepository(AnalysisRunMember)
    private memberRepo: Repository<AnalysisRunMember>,
    private features: AnalyticsFeaturesService,
    private auditLog: AuditLogService,
  ) {}

  async createRun(input: CreateRunInput, userId?: string): Promise<AnalysisRun> {
    const startedAt = new Date();
    const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
    const featureKeys = (input.features && input.features.length > 0 ? input.features : [...FEATURE_KEYS])
      .filter(key => FEATURE_KEYS.includes(key));
    const kRange: [number, number] = input.kRange ?? [2, 8];

    const rows = await this.features.getHouseholdFeatures({ from: input.from, to: input.to, barangay: input.barangay });
    if (rows.length < MIN_DATASET) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: MIN_DATASET, actual: rows.length });
    }

    try {
      const prep = prepareMatrix(rows, featureKeys);
      const candidates = evaluateCandidates(prep.X, kRange, seed);
      const chosen = chooseK(candidates);

      const clusterRows = chosen.centroids.map((centroid, clusterIndex) => {
        const members = rows.filter((_, i) => chosen.assignments[i] === clusterIndex);
        const profile: Record<string, unknown> = {
          size: members.length,
          barangay_mix: [...members.reduce((map, m) => {
            const key = m.barangay ?? 'Unspecified';
            map.set(key, (map.get(key) ?? 0) + 1);
            return map;
          }, new Map<string, number>())]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([barangay, count]) => ({ barangay, count })),
        };
        featureKeys.forEach((key, dim) => {
          const values = members.map(m => m.values[key]).filter((v): v is number => v != null && Number.isFinite(v));
          profile[`${key}_median`] = values.length > 0 ? median(values) : null;
          const rawCentroid = centroid[dim] * prep.stds[dim] + prep.means[dim];
          profile[`${key}_centroid`] = Number(rawCentroid.toFixed(4));
        });
        return this.clusterRepo.create({
          runId: '', clusterIndex, size: members.length,
          centroid: { standardized: centroid.map(v => Number(v.toFixed(6))), features: featureKeys },
          profile,
        });
      });

      const run = await this.runRepo.save(this.runRepo.create({
        model: 'household_clustering',
        status: 'completed',
        params: {
          features: featureKeys, k_range: kRange, chosen_k: chosen.k, seed,
          filters: { from: input.from ?? null, to: input.to ?? null, barangay: input.barangay ?? null },
          imputation: prep.imputed,
        },
        metrics: {
          dataset_size: rows.length,
          candidates: candidates.map(c => ({ k: c.k, inertia: Number(c.inertia.toFixed(6)), silhouette: Number(c.silhouette.toFixed(6)) })),
          chosen: { k: chosen.k, inertia: chosen.inertia, silhouette: chosen.silhouette },
          feature_means: prep.means, feature_stds: prep.stds,
        },
        startedAt, completedAt: new Date(),
        createdBy: userId,
      }));

      for (const cluster of clusterRows) {
        await this.clusterRepo.save({ ...cluster, runId: run.id });
      }
      await this.memberRepo.insert(rows.map((row, i) => ({
        runId: run.id,
        householdId: row.householdId,
        clusterIndex: chosen.assignments[i],
        distance: Number(
          Math.sqrt(featureKeys.reduce((acc, key, dim) => {
            const x = prep.X[i][dim];
            return acc + (x - chosen.centroids[chosen.assignments[i]][dim]) ** 2;
          }, 0)).toFixed(6),
        ),
      })));

      return run;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runRepo.save(this.runRepo.create({
        model: 'household_clustering', status: 'failed',
        params: { features: featureKeys, k_range: kRange, seed, filters: { from: input.from ?? null, to: input.to ?? null, barangay: input.barangay ?? null } },
        startedAt, completedAt: new Date(), createdBy: userId, error: message,
      }));
      throw err;
    }
  }

  async listRuns(limit = 20): Promise<AnalysisRun[]> {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 100) });
  }

  async getRun(id: string): Promise<{ run: AnalysisRun; clusters: AnalysisRunCluster[] }> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Analysis run not found');
    const clusters = await this.clusterRepo.find({ where: { runId: id }, order: { clusterIndex: 'ASC' } });
    return { run, clusters };
  }

  async getRunMembers(id: string, clusterIndex: number, page: number, limit: number, userId?: string) {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Analysis run not found');
    const result = await this.features.getRunMembers(id, clusterIndex, page, limit);
    await this.auditLog.log('analytics.drilldown', id, userId ?? null, { clusterIndex, page, limit });
    return result;
  }

  async exportRunCsv(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Analysis run not found');
    const clusters = await this.clusterRepo.find({ where: { runId: id }, order: { clusterIndex: 'ASC' } });
    const profileKeys = [...new Set(clusters.flatMap(c => Object.keys(c.profile ?? {})))]
      .filter(key => key !== 'barangay_mix');
    const lines: string[] = [
      `# run_id,${run.id}`,
      `# status,${run.status}`,
      `# chosen_k,${(run.params as any)?.chosen_k ?? ''}`,
      `# seed,${(run.params as any)?.seed ?? ''}`,
      `# dataset_size,${(run.metrics as any)?.dataset_size ?? ''}`,
      `# generated_at,${new Date().toISOString()}`,
      ['cluster_index', 'size', ...profileKeys].join(','),
      ...clusters.map(c => [c.clusterIndex, c.size, ...profileKeys.map(key => csvEscape((c.profile as any)?.[key]))].join(',')),
    ];
    const date = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(lines.join('\n'), 'utf8'), filename: `analytics-clusters-${run.id.slice(0, 8)}-${date}.csv` };
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest clustering.service --silent`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/clustering.service.ts kapwa-server/src/analytics/clustering.service.spec.ts
git commit -m "feat(analytics): persisted clustering run service"
```

---

## Task 7: Descriptive models service (demographics, concentration, equity)

**Files:**
- Create: `kapwa-server/src/analytics/analytics.service.ts`
- Create: `kapwa-server/src/analytics/analytics.service.spec.ts`

**Interfaces:**
- Consumes: `stats.ts` (`hhi`), `suppression.ts`.
- Produces: `AnalyticsService.getDemographics(filters)`, `getConcentration(filters)`, `getEquity(filters)`.

- [ ] **Step 1: Write the failing spec**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Case } from '../cases/case.entity';

describe('AnalyticsService', () => {
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

  describe('getDemographics', () => {
    it('suppresses small cells and keeps cells of 5 or more', async () => {
      repoMock.query.mockResolvedValue([
        { gender: 'Male', age: 4, civil_status: 'Single', occupation: null, has_philhealth: false, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { gender: 'Female', age: 10, civil_status: 'Single', occupation: 'Student', has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { gender: 'Female', age: 65, civil_status: 'Widowed', occupation: 'Retired', has_philhealth: false, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { gender: 'Male', age: 30, civil_status: 'Married', occupation: null, has_philhealth: false, household_income: null, household_id: 'h3', barangay: null },
      ]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 5 });
      expect(result.summary.householdsCovered).toEqual({ suppressed: true });
      expect(result.summary.barangaysCovered).toEqual({ suppressed: true });
      expect(result.ageSex.find(b => b.bracket === '0-5')?.male).toEqual({ suppressed: true });
      expect(result.civilStatus.find(s => s.label === 'Married')?.count).toEqual({ suppressed: true });
      expect(result.occupation).toEqual([]);
      expect(result.incomeBands.find(b => b.label === '<5k')?.count).toEqual({ suppressed: true });
      expect(result.dependencyRatio).toBeCloseTo(1.5);
      expect(result.philhealthCoverage).toEqual({ value: 0.4 });
    });

    it('computes non-suppressed values for a larger cohort', async () => {
      const rows = [
        ...Array.from({ length: 8 }, (_, i) => ({ gender: 'Male', age: 4, civil_status: 'Single', occupation: 'Farmer', has_philhealth: true, household_income: '4000', household_id: `ha${i}`, barangay: 'Poblacion' })),
        ...Array.from({ length: 12 }, (_, i) => ({ gender: 'Female', age: 30, civil_status: 'Married', occupation: 'Teacher', has_philhealth: false, household_income: '12000', household_id: `hb${i}`, barangay: 'Bigte' })),
      ];
      repoMock.query.mockResolvedValue(rows);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 20 });
      expect(result.summary.householdsCovered).toEqual({ value: 20 });
      expect(result.summary.barangaysCovered).toEqual({ suppressed: true });
      expect(result.ageSex.find(b => b.bracket === '0-5')?.male).toEqual({ value: 8 });
      expect(result.occupation).toEqual([
        { label: 'Teacher', count: { value: 12 } },
        { label: 'Farmer', count: { value: 8 } },
      ]);
      expect(result.dependencyRatio).toBeCloseTo(8 / 12);
      expect(result.philhealthCoverage).toEqual({ value: 0.4 });
    });

    it('returns an empty state when there are no persons', async () => {
      repoMock.query.mockResolvedValue([]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ suppressed: true });
      expect(result.ageSex.every(b => b.male.suppressed && b.female.suppressed)).toBe(true);
      expect(result.dependencyRatio).toBeNull();
    });
  });

  describe('getConcentration', () => {
    it('computes shares and HHI per barangay', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
        { barangay: 'Matictic', cases: '0', interventions: '2', amount: '0' },
      ]);
      const result = await service.getConcentration({});
      expect(result.barangays).toHaveLength(3);
      expect(result.hhiCases).toBeCloseTo(0.5);
      expect(result.hhiAssistance).toBeCloseTo(0.36 + 0.16);
      expect(result.barangays[0].cases).toEqual({ value: 6 });
    });

    it('throws insufficient_data when fewer than three barangays have data', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
      ]);
      await expect(service.getConcentration({})).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getEquity', () => {
    it('computes coverage ratios against household shares', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', served_households: '8', assistance: '8000', four_ps: '6' },
          { barangay: 'Bigte', served_households: '2', assistance: '1000', four_ps: '1' },
        ])
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', households: '40' },
          { barangay: 'Bigte', households: '60' },
        ]);
      const result = await service.getEquity({});
      const poblacion = result.barangays.find(b => b.barangay === 'Poblacion');
      expect(poblacion?.householdsShare).toBeCloseTo(0.4);
      expect(poblacion?.servedShare).toBeCloseTo(0.8);
      expect(poblacion?.coverageRatio).toBeCloseTo(2);
      const bigte = result.barangays.find(b => b.barangay === 'Bigte');
      expect(bigte?.fourPsShare).toEqual({ suppressed: true });
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analytics.service --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the service**

```ts
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { hhi } from './models/stats';
import { suppressCount, suppressRatio, Suppressed } from './suppression';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  barangay?: string;
}

const AGE_BRACKETS: Array<{ bracket: string; min: number; max: number }> = [
  { bracket: '0-5', min: 0, max: 5 },
  { bracket: '6-12', min: 6, max: 12 },
  { bracket: '13-17', min: 13, max: 17 },
  { bracket: '18-24', min: 18, max: 24 },
  { bracket: '25-34', min: 25, max: 34 },
  { bracket: '35-44', min: 35, max: 44 },
  { bracket: '45-59', min: 45, max: 59 },
  { bracket: '60+', min: 60, max: 200 },
];

const INCOME_BANDS: Array<{ label: string; test: (v: number | null) => boolean }> = [
  { label: '<5k', test: v => v != null && v < 5000 },
  { label: '5-10k', test: v => v != null && v >= 5000 && v < 10000 },
  { label: '10-20k', test: v => v != null && v >= 10000 && v < 20000 },
  { label: '20-40k', test: v => v != null && v >= 20000 && v < 40000 },
  { label: '>=40k', test: v => v != null && v >= 40000 },
  { label: 'Unspecified', test: v => v == null },
];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}

  async getDemographics(filters: AnalyticsFilters) {
    const rows: Array<{
      gender: string | null; age: number | null; civil_status: string | null; occupation: string | null;
      has_philhealth: boolean; household_income: string | null; household_id: string | null; barangay: string | null;
    }> = await this.caseRepo.query(
      `SELECT p.gender, EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob))::int AS age,
              p.civil_status, p.occupation,
              (p.philhealth_number IS NOT NULL AND p.philhealth_number <> '') AS has_philhealth,
              ph.estimated_income AS household_income, b.household_id, ph.barangay
       FROM persons p
       JOIN beneficiaries b ON b.person_id = p.id
       LEFT JOIN households ph ON ph.id = b.household_id
       WHERE (($1::date IS NULL AND $2::date IS NULL)
              OR EXISTS (
                SELECT 1 FROM cases c
                JOIN case_interventions ci ON ci.case_id = c.id
                WHERE c.beneficiary_id = b.id
                  AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
                  AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
              ))
         AND ($3::text IS NULL OR ph.barangay = $3)`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );

    const persons = rows ?? [];
    const personCount = (n: number): Suppressed<number> => suppressCount(n);

    const ageSex = AGE_BRACKETS.map(({ bracket, min, max }) => {
      const inBracket = persons.filter(p => p.age != null && p.age >= min && p.age <= max);
      return {
        bracket,
        male: personCount(inBracket.filter(p => p.gender === 'Male').length),
        female: personCount(inBracket.filter(p => p.gender === 'Female').length),
      };
    });

    const civilStatuses = [...new Set(persons.map(p => p.civil_status || 'Unspecified'))];
    const civilStatus = civilStatuses
      .map(label => ({ label, count: personCount(persons.filter(p => (p.civil_status || 'Unspecified') === label).length) }))
      .sort((a, b) => ('value' in b.count ? b.count.value : 0) - ('value' in a.count ? a.count.value : 0));

    const occupationCounts = new Map<string, number>();
    persons.forEach(p => {
      const key = p.occupation && p.occupation.trim() ? p.occupation.trim() : 'Unspecified';
      occupationCounts.set(key, (occupationCounts.get(key) ?? 0) + 1);
    });
    const occupation = [...occupationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .filter(([, count]) => count >= 5)
      .map(([label, count]) => ({ label, count: suppressCount(count) }));

    const incomeBands = INCOME_BANDS.map(band => ({
      label: band.label,
      count: personCount(persons.filter(p => band.test(p.household_income != null ? Number(p.household_income) : null)).length),
    }));

    const ages = persons.map(p => p.age).filter((a): a is number => a != null);
    const dependents = ages.filter(a => a <= 14 || a >= 60).length;
    const working = ages.filter(a => a >= 15 && a <= 59).length;
    const dependencyRatio = working > 0 ? dependents / working : null;

    const covered = persons.filter(p => p.has_philhealth).length;
    const philhealthCoverage = persons.length >= 5 ? { value: covered / persons.length } : { suppressed: true as const };

    return {
      summary: {
        personsServed: personCount(persons.length),
        householdsCovered: personCount(new Set(persons.map(p => p.household_id).filter(Boolean)).size),
        barangaysCovered: personCount(new Set(persons.map(p => p.barangay).filter(Boolean)).size),
      },
      ageSex,
      civilStatus,
      occupation,
      incomeBands,
      dependencyRatio,
      philhealthCoverage,
    };
  }

  async getConcentration(filters: AnalyticsFilters) {
    const rows: Array<{ barangay: string; cases: string; interventions: string; amount: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT c.id) AS cases,
                COUNT(ci.id) AS interventions,
                COALESCE(SUM(ci.amount), 0) AS amount
         FROM case_interventions ci
         JOIN cases c ON c.id = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         GROUP BY 1
         ORDER BY cases DESC`,
        [filters.from ?? null, filters.to ?? null],
      );
    const barangays = (rows ?? []).filter(r => Number(r.cases) > 0 || Number(r.interventions) > 0);
    if (barangays.length < 3) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: 3, actual: barangays.length });
    }
    const totalCases = barangays.reduce((acc, r) => acc + Number(r.cases), 0);
    const totalAmount = barangays.reduce((acc, r) => acc + Number(r.amount), 0);
    const caseShares = barangays.map(r => (totalCases > 0 ? Number(r.cases) / totalCases : 0));
    const amountShares = barangays.map(r => (totalAmount > 0 ? Number(r.amount) / totalAmount : 0));
    return {
      hhiCases: hhi(caseShares),
      hhiAssistance: hhi(amountShares),
      totalCases,
      totalAmount,
      barangays: barangays.map((r, i) => ({
        barangay: r.barangay,
        cases: suppressCount(Number(r.cases)),
        interventions: suppressCount(Number(r.interventions)),
        amount: suppressCount(Math.round(Number(r.amount))),
        caseShare: suppressRatio(caseShares[i], Number(r.cases)),
        amountShare: suppressRatio(amountShares[i], Number(r.cases)),
      })),
    };
  }

  async getEquity(filters: AnalyticsFilters) {
    const served: Array<{ barangay: string; served_households: string; assistance: string; four_ps: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT b.household_id) AS served_households,
                COALESCE(SUM(ci.amount), 0) AS assistance,
                COUNT(DISTINCT b.household_id) FILTER (WHERE br.category = '4Ps') AS four_ps
         FROM case_interventions ci
         JOIN cases c ON c.id = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         GROUP BY 1`,
        [filters.from ?? null, filters.to ?? null],
      );
    const householdRows: Array<{ barangay: string; households: string }> = await this.caseRepo.query(
      `SELECT COALESCE(barangay, 'Unspecified') AS barangay, COUNT(*) AS households
       FROM households GROUP BY 1`,
    );

    const totalServed = (served ?? []).reduce((acc, r) => acc + Number(r.served_households), 0);
    const totalAssistance = (served ?? []).reduce((acc, r) => acc + Number(r.assistance), 0);
    const totalHouseholds = (householdRows ?? []).reduce((acc, r) => acc + Number(r.households), 0);
    const householdsByBarangay = new Map((householdRows ?? []).map(r => [r.barangay, Number(r.households)]));

    const barangays = (served ?? []).map(r => {
      const households = householdsByBarangay.get(r.barangay) ?? 0;
      const servedCount = Number(r.served_households);
      const householdsShare = totalHouseholds > 0 ? households / totalHouseholds : 0;
      const servedShare = totalServed > 0 ? servedCount / totalServed : 0;
      return {
        barangay: r.barangay,
        householdsShare: suppressRatio(householdsShare, households),
        servedShare: suppressRatio(servedShare, servedCount),
        assistanceShare: suppressRatio(totalAssistance > 0 ? Number(r.assistance) / totalAssistance : 0, servedCount),
        coverageRatio: householdsShare > 0 ? suppressRatio(servedShare / householdsShare, servedCount) : { suppressed: true as const },
        fourPsShare: suppressRatio(households > 0 ? Number(r.four_ps) / households : 0, Number(r.four_ps)),
      };
    });
    return { barangays };
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest analytics.service --silent`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/analytics/analytics.service.ts kapwa-server/src/analytics/analytics.service.spec.ts
git commit -m "feat(analytics): demographics, concentration, and equity models"
```

---

## Task 8: Controller, DTOs, module wiring

**Files:**
- Create: `kapwa-server/src/analytics/dto/analytics.zod.ts`
- Create: `kapwa-server/src/analytics/analytics.controller.ts`
- Create: `kapwa-server/src/analytics/analytics.controller.spec.ts`
- Create: `kapwa-server/src/analytics/analytics.module.ts`
- Modify: `kapwa-server/src/app.module.ts`

**Interfaces:**
- Consumes: `AnalyticsService`, `ClusteringService` (Tasks 6–7).
- Produces: routes from spec §4.3 (wave-1 subset); `AnalyticsModule`.

- [ ] **Step 1: Write the failing controller spec**

```ts
import { Test } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  const analytics = { getDemographics: jest.fn(), getConcentration: jest.fn(), getEquity: jest.fn() };
  const clustering = {
    createRun: jest.fn(), listRuns: jest.fn(), getRun: jest.fn(),
    getRunMembers: jest.fn(), exportRunCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analytics },
        { provide: ClusteringService, useValue: clustering },
      ],
    }).compile();
    controller = module.get(AnalyticsController);
    Object.values({ ...analytics, ...clustering }).forEach(fn => fn.mockReset());
  });

  it('returns demographics for the query filters', async () => {
    analytics.getDemographics.mockResolvedValue({ summary: {} });
    await controller.demographics({ from: '2026-01-01', to: '2026-06-30', barangay: 'Bigte' });
    expect(analytics.getDemographics).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-06-30', barangay: 'Bigte' });
  });

  it('creates a clustering run with the submitting user', async () => {
    clustering.createRun.mockResolvedValue({ id: 'run-1' });
    await expect(controller.createRun({ kRange: [2, 4], seed: 7 }, { user: { id: 'u1' } } as any))
      .resolves.toEqual({ id: 'run-1' });
    expect(clustering.createRun).toHaveBeenCalledWith({ kRange: [2, 4], seed: 7 }, 'u1');
  });

  it('pages run members with the caller recorded', async () => {
    clustering.getRunMembers.mockResolvedValue({ rows: [], total: 0 });
    await controller.runMembers('run-1', { clusterIndex: 0, page: 2, limit: 10 }, { user: { id: 'u2' } } as any);
    expect(clustering.getRunMembers).toHaveBeenCalledWith('run-1', 0, 2, 10, 'u2');
  });

  it('streams the aggregate CSV', async () => {
    clustering.exportRunCsv.mockResolvedValue({ buffer: Buffer.from('a,b\n1,2'), filename: 'analytics-clusters-run1.csv' });
    const res = { set: jest.fn(), send: jest.fn() };
    await controller.exportCsv('run-1', res as any);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'text/csv' }));
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest analytics.controller --silent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the DTO schemas**

`dto/analytics.zod.ts`:

```ts
import { z } from 'zod';
import { FEATURE_KEYS } from '../analytics.types';

const isoDate = z.string().date();

export const AnalyticsRangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  barangay: z.string().min(1).max(120).optional(),
}).refine(v => !v.from || !v.to || v.from <= v.to, { message: 'from must be on or before to' });

export const ClusteringRunSchema = z.object({
  kRange: z.tuple([z.number().int().min(2).max(10), z.number().int().min(2).max(10)])
    .refine(([a, b]) => a <= b, { message: 'kRange must be ascending' })
    .optional(),
  features: z.array(z.enum(FEATURE_KEYS)).min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  barangay: z.string().min(1).max(120).optional(),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
});

export const RunMembersQuerySchema = z.object({
  clusterIndex: z.coerce.number().int().min(0),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const RunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AnalyticsRangeInput = z.infer<typeof AnalyticsRangeSchema>;
export type ClusteringRunInput = z.infer<typeof ClusteringRunSchema>;
export type RunMembersQueryInput = z.infer<typeof RunMembersQuerySchema>;
export type RunListQueryInput = z.infer<typeof RunListQuerySchema>;
```

- [ ] **Step 4: Write the controller**

```ts
import { Controller, Get, Post, Param, Query, Body, Res, Request, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';
import {
  AnalyticsRangeSchema, AnalyticsRangeInput,
  ClusteringRunSchema, ClusteringRunInput,
  RunMembersQuerySchema, RunMembersQueryInput,
  RunListQuerySchema, RunListQueryInput,
} from './dto/analytics.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private analytics: AnalyticsService,
    private clustering: ClusteringService,
  ) {}

  @Get('demographics')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Demographic analysis for a date range and barangay' })
  async demographics(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getDemographics(query);
  }

  @Get('concentration')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Geographic concentration of cases and assistance (HHI)' })
  async concentration(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getConcentration(query);
  }

  @Get('equity')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Barangay equity and coverage ratios' })
  async equity(@Query(new ZodPipe(AnalyticsRangeSchema)) query: AnalyticsRangeInput) {
    return this.analytics.getEquity(query);
  }

  @Post('clustering/runs')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Run household k-means clustering and persist the run' })
  async createRun(
    @Body(new ZodPipe(ClusteringRunSchema)) body: ClusteringRunInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.clustering.createRun(body, req.user?.id);
  }

  @Get('clustering/runs')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'List clustering runs (newest first)' })
  async listRuns(@Query(new ZodPipe(RunListQuerySchema)) query: RunListQueryInput) {
    return this.clustering.listRuns(query.limit);
  }

  @Get('clustering/runs/:id')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Get a clustering run with cluster profiles' })
  async getRun(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.clustering.getRun(id);
  }

  @Get('clustering/runs/:id/members')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Paged household drill-down for a cluster (audited)' })
  async runMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodPipe(RunMembersQuerySchema)) query: RunMembersQueryInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.clustering.getRunMembers(id, query.clusterIndex, query.page, query.limit, req.user?.id);
  }

  @Get('clustering/runs/:id/export')
  @Roles('admin', 'social_worker', 'mayor')
  @ApiOperation({ summary: 'Export a run summary as an aggregate CSV' })
  async exportCsv(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: any) {
    const { buffer, filename } = await this.clustering.exportRunCsv(id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
```

- [ ] **Step 5: Write the module and register it**

`analytics.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case } from '../cases/case.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisRun, AnalysisRunCluster, AnalysisRunMember, Household, Case]),
    AuditModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ClusteringService, AnalyticsFeaturesService],
  exports: [AnalyticsService, ClusteringService],
})
export class AnalyticsModule {}
```

In `app.module.ts`: add `import { AnalyticsModule } from './analytics/analytics.module';` after the `ContactMessagesModule` import, and `AnalyticsModule,` in the `imports` array after `ContactMessagesModule,`.

- [ ] **Step 6: Run the controller spec + typecheck**

Run: `npx jest analytics --silent && npm run typecheck`
Expected: PASS (all analytics suites); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/analytics/dto/analytics.zod.ts \
       kapwa-server/src/analytics/analytics.controller.ts \
       kapwa-server/src/analytics/analytics.controller.spec.ts \
       kapwa-server/src/analytics/analytics.module.ts \
       kapwa-server/src/app.module.ts
git commit -m "feat(analytics): analytics API and module wiring"
```

---

## Task 9: Client foundation — API helper, keys, route, nav, i18n, page shell

**Files:**
- Modify: `kapwa-client/src/lib/api.ts`
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/nav-config.tsx`
- Modify: `kapwa-client/src/i18n/locales/en/index.ts`
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts`
- Create: `kapwa-client/src/components/analytics/AnalyticsFilters.tsx`
- Create: `kapwa-client/src/components/analytics/AnalyticsFilters.test.tsx`

**Interfaces:**
- Consumes: server routes from Task 8.
- Produces: `downloadAnalyticsCsv(path, fallbackFilename)`, `queryKeys.analytics.*`, `AnalyticsPage` route `/analytics`, `AnalyticsFilters({ value, onChange })`, i18n `analytics.*`.

- [ ] **Step 1: Write the failing filter test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsFilters } from './AnalyticsFilters';

describe('AnalyticsFilters', () => {
  it('renders range and barangay selects and reports changes', () => {
    const onChange = vi.fn();
    render(<AnalyticsFilters value={{ range: '1y', barangay: '' }} onChange={onChange} />);
    const range = screen.getByLabelText('Date range');
    expect(range).toHaveValue('1y');
    expect(screen.getAllByRole('option').length).toBeGreaterThanOrEqual(6);
    fireEvent.change(range, { target: { value: '30d' } });
    expect(onChange).toHaveBeenCalledWith({ range: '30d', barangay: '' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `kapwa-client/`): `npx vitest run src/components/analytics/AnalyticsFilters.test.tsx`
Expected: FAIL — cannot resolve `./AnalyticsFilters`.

- [ ] **Step 3: Add the API download helper**

Append to `kapwa-client/src/lib/api.ts` (models `downloadGisPdf`, uses the exported `dispositionFilename`):

```ts
export async function downloadAnalyticsCsv(path: string, fallbackFilename: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Analytics export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, fallbackFilename);
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Add query keys**

In `query-keys.ts`, add after the `fourps` block:

```ts
  analytics: {
    demographics: (filters: Record<string, unknown>) =>
      memo(`analytics.demographics.${JSON.stringify(filters)}`, () => ['analytics', 'demographics', filters] as const),
    concentration: (filters: Record<string, unknown>) =>
      memo(`analytics.concentration.${JSON.stringify(filters)}`, () => ['analytics', 'concentration', filters] as const),
    equity: (filters: Record<string, unknown>) =>
      memo(`analytics.equity.${JSON.stringify(filters)}`, () => ['analytics', 'equity', filters] as const),
    runs: (limit: number) =>
      memo(`analytics.runs.${limit}`, () => ['analytics', 'runs', { limit }] as const),
    run: (id: string) => memo(`analytics.run.${id}`, () => ['analytics', 'run', id] as const),
    runMembers: (id: string, clusterIndex: number, page: number) =>
      memo(`analytics.runMembers.${id}.${clusterIndex}.${page}`, () => ['analytics', 'run', id, 'members', { clusterIndex, page }] as const),
  },
```

- [ ] **Step 5: Add i18n keys**

en (inside the top-level object, before `} as const;`):

```ts
  "analytics": {
    "title": "Analytics",
    "description": "Demographics, household clustering, concentration, and equity",
    "filters": {
      "range": "Date range",
      "range30d": "Last 30 days",
      "range90d": "Last 90 days",
      "range6m": "Last 6 months",
      "range1y": "Last year",
      "rangeAll": "All time",
      "barangay": "Barangay",
      "allBarangays": "All barangays",
      "apply": "Apply"
    },
    "tabs": {
      "demographics": "Demographics",
      "clustering": "Clustering",
      "concentration": "Concentration",
      "equity": "Equity"
    },
    "suppressed": "Suppressed (<5)",
    "noData": "No data for the selected filters",
    "insufficientData": "Not enough data (needs {{required}}, found {{actual}})",
    "methodology": "How this is computed",
    "export": "Export CSV",
    "demographics": {
      "personsServed": "Persons served",
      "households": "Households",
      "barangays": "Barangays",
      "ageSex": "Age and sex",
      "civilStatus": "Civil status",
      "occupation": "Occupation (top 10)",
      "income": "Household income bands",
      "incomeNote": "Relative bands, not official poverty thresholds",
      "dependency": "Dependency ratio",
      "householdSize": "Household size",
      "philhealth": "PhilHealth coverage",
      "male": "Male",
      "female": "Female"
    },
    "clustering": {
      "runTitle": "New clustering run",
      "kRange": "Candidate k range",
      "seed": "Seed (optional)",
      "seedHint": "Leave blank for a random seed; runs are reproducible by seed",
      "run": "Run clustering",
      "running": "Running…",
      "runs": "Runs",
      "chosenK": "Chosen k",
      "datasetSize": "Households",
      "candidates": "k selection (elbow and silhouette)",
      "inertia": "Inertia",
      "silhouette": "Silhouette",
      "clusters": "Segments",
      "size": "Households",
      "profile": "Profile",
      "barangayMix": "Barangay mix",
      "viewMembers": "View households",
      "membersTitle": "Households in segment {{index}}",
      "household": "Household",
      "distance": "Distance"
    },
    "concentration": {
      "hhiCases": "Case concentration (HHI)",
      "hhiAssistance": "Assistance concentration (HHI)",
      "barangay": "Barangay",
      "cases": "Cases",
      "interventions": "Interventions",
      "amount": "Assistance",
      "caseShare": "Case share",
      "amountShare": "Assistance share"
    },
    "equity": {
      "householdsShare": "Household share",
      "servedShare": "Served share",
      "assistanceShare": "Assistance share",
      "coverageRatio": "Coverage ratio",
      "coverageQuartile": "Coverage quartile",
      "fourPsShare": "4Ps household share",
      "note": "Ratios compare each barangay's served share with its share of all households"
    }
  },
```

fil (same shape; values differ):

```ts
  "analytics": {
    "title": "Analitika",
    "description": "Demografia, pag-cluster ng sambahayan, konsentrasyon, at pagkakapantay-pantay",
    "filters": {
      "range": "Saklaw ng petsa",
      "range30d": "Huling 30 araw",
      "range90d": "Huling 90 araw",
      "range6m": "Huling 6 na buwan",
      "range1y": "Huling taon",
      "rangeAll": "Lahat ng panahon",
      "barangay": "Barangay",
      "allBarangays": "Lahat ng barangay",
      "apply": "Ilapat"
    },
    "tabs": {
      "demographics": "Demografia",
      "clustering": "Pag-cluster",
      "concentration": "Konsentrasyon",
      "equity": "Pagkakapantay-pantay"
    },
    "suppressed": "Nakubli (<5)",
    "noData": "Walang datos para sa napiling filter",
    "insufficientData": "Kulang ang datos (kailangan {{required}}, nahanap {{actual}})",
    "methodology": "Paano ito kinakalkula",
    "export": "I-export ang CSV",
    "demographics": {
      "personsServed": "Naserbisyuhan",
      "households": "Sambahayan",
      "barangays": "Barangay",
      "ageSex": "Edad at kasarian",
      "civilStatus": "Katayuang sibil",
      "occupation": "Trabaho (top 10)",
      "income": "Antas ng kita ng sambahayan",
      "incomeNote": "Relatibong antas, hindi opisyal na poverty threshold",
      "dependency": "Dependency ratio",
      "householdSize": "Laki ng sambahayan",
      "philhealth": "Saklaw ng PhilHealth",
      "male": "Lalaki",
      "female": "Babae"
    },
    "clustering": {
      "runTitle": "Bagong clustering run",
      "kRange": "Saklaw ng k",
      "seed": "Seed (opsyonal)",
      "seedHint": "Iwanang blangko para sa random na seed; reproduksible ang run sa pamamagitan ng seed",
      "run": "Patakbuhin ang clustering",
      "running": "Tumatakbo…",
      "runs": "Mga run",
      "chosenK": "Napiling k",
      "datasetSize": "Sambahayan",
      "candidates": "Pagpili ng k (elbow at silhouette)",
      "inertia": "Inertia",
      "silhouette": "Silhouette",
      "clusters": "Mga segment",
      "size": "Sambahayan",
      "profile": "Profile",
      "barangayMix": "Halo ng barangay",
      "viewMembers": "Tingnan ang sambahayan",
      "membersTitle": "Mga sambahayan sa segment {{index}}",
      "household": "Sambahayan",
      "distance": "Distansya"
    },
    "concentration": {
      "hhiCases": "Konsentrasyon ng kaso (HHI)",
      "hhiAssistance": "Konsentrasyon ng tulong (HHI)",
      "barangay": "Barangay",
      "cases": "Kaso",
      "interventions": "Interbensyon",
      "amount": "Tulong",
      "caseShare": "Bahagi ng kaso",
      "amountShare": "Bahagi ng tulong"
    },
    "equity": {
      "householdsShare": "Bahagi ng sambahayan",
      "servedShare": "Bahagi ng naserbisyuhan",
      "assistanceShare": "Bahagi ng tulong",
      "coverageRatio": "Coverage ratio",
      "coverageQuartile": "Quartile ng coverage",
      "fourPsShare": "Bahagi ng 4Ps na sambahayan",
      "note": "Inihahambing ng ratio ang bahagi ng naserbisyuhan sa bahagi ng lahat ng sambahayan"
    }
  },
```

- [ ] **Step 6: Add the filter component**

`src/components/analytics/AnalyticsFilters.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { BARANGAYS } from '@/lib/constants';
import { Button } from '@/components/ui/button';

export interface AnalyticsFilterValue {
  range: '30d' | '90d' | '6m' | '1y' | 'all';
  barangay: string;
}

export function rangeToDates(range: AnalyticsFilterValue['range']): { from?: string; to?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  if (range === '30d') from.setDate(from.getDate() - 30);
  if (range === '90d') from.setDate(from.getDate() - 90);
  if (range === '6m') from.setMonth(from.getMonth() - 6);
  if (range === '1y') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export function AnalyticsFilters({
  value,
  onChange,
}: {
  value: AnalyticsFilterValue;
  onChange: (next: AnalyticsFilterValue) => void;
}) {
  const { t } = useTranslation();
  const ranges: Array<{ key: AnalyticsFilterValue['range']; label: string }> = [
    { key: '30d', label: t('analytics.filters.range30d', 'Last 30 days') },
    { key: '90d', label: t('analytics.filters.range90d', 'Last 90 days') },
    { key: '6m', label: t('analytics.filters.range6m', 'Last 6 months') },
    { key: '1y', label: t('analytics.filters.range1y', 'Last year') },
    { key: 'all', label: t('analytics.filters.rangeAll', 'All time') },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="analytics-range">
          {t('analytics.filters.range', 'Date range')}
        </label>
        <select
          id="analytics-range"
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={value.range}
          onChange={e => onChange({ ...value, range: e.target.value as AnalyticsFilterValue['range'] })}
        >
          {ranges.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="analytics-barangay">
          {t('analytics.filters.barangay', 'Barangay')}
        </label>
        <select
          id="analytics-barangay"
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={value.barangay}
          onChange={e => onChange({ ...value, barangay: e.target.value })}
        >
          <option value="">{t('analytics.filters.allBarangays', 'All barangays')}</option>
          {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange({ ...value })}>
        {t('analytics.filters.apply', 'Apply')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Run the filter test + parity + typecheck**

Run (from `kapwa-client/`): `npx vitest run src/components/analytics/AnalyticsFilters.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS. (`AnalyticsPage.tsx`, the `/analytics` route, and the nav entry are created in Task 12, after all four tab components exist.)

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/src/lib/api.ts \
       kapwa-client/src/lib/query-keys.ts \
       kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts \
       kapwa-client/src/components/analytics/AnalyticsFilters.tsx \
       kapwa-client/src/components/analytics/AnalyticsFilters.test.tsx
git commit -m "feat(analytics): client analytics foundation (helpers, keys, i18n, filters)"
```

---

## Task 10: Demographics tab

**Files:**
- Create: `kapwa-client/src/components/analytics/DemographicsTab.tsx`
- Create: `kapwa-client/src/components/analytics/DemographicsTab.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.analytics.demographics(filters)`; server response from Task 7 (`summary`, `ageSex`, `civilStatus`, `occupation`, `incomeBands`, `dependencyRatio`, `philhealthCoverage` where count/rate fields are `{ value }` or `{ suppressed: true }`).
- Produces: `DemographicsTab({ filters }: { filters: Record<string, unknown> })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { DemographicsTab } from './DemographicsTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <DemographicsTab filters={{}} />
    </SWRConfig>,
  );
}

describe('DemographicsTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      summary: { personsServed: { value: 120 }, householdsCovered: { value: 40 }, barangaysCovered: { value: 7 } },
      ageSex: [{ bracket: '0-5', male: { value: 12 }, female: { suppressed: true } }],
      civilStatus: [{ label: 'Married', count: { value: 60 } }, { label: 'Widowed', count: { suppressed: true } }],
      occupation: [{ label: 'Farmer', count: { value: 30 } }],
      incomeBands: [{ label: '<5k', count: { value: 20 } }],
      householdSize: [{ label: '1', count: { value: 10 } }, { label: '8+', count: { suppressed: true } }],
      dependencyRatio: 0.8,
      philhealthCoverage: { value: 0.55 },
    });
  });

  it('renders summary cards and suppressed cells as hidden', async () => {
    renderTab();
    expect(await screen.findByText('120')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the no-data state on error', async () => {
    mockApiGet.mockRejectedValue(new Error('nope'));
    renderTab();
    expect(await screen.findByText(/No data for the selected filters/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/analytics/DemographicsTab.test.tsx`
Expected: FAIL — cannot resolve `./DemographicsTab`.

- [ ] **Step 3: Write the component**

```tsx
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { queryKeys } from '@/lib/query-keys';

export type SuppressedCell = { value: number } | { suppressed: true };

interface DemographicsResponse {
  summary: { personsServed: SuppressedCell; householdsCovered: SuppressedCell; barangaysCovered: SuppressedCell };
  ageSex: Array<{ bracket: string; male: SuppressedCell; female: SuppressedCell }>;
  civilStatus: Array<{ label: string; count: SuppressedCell }>;
  occupation: Array<{ label: string; count: SuppressedCell }>;
  incomeBands: Array<{ label: string; count: SuppressedCell }>;
  householdSize: Array<{ label: string; count: SuppressedCell }>;
  dependencyRatio: number | null;
  philhealthCoverage: SuppressedCell;
}

function cellText(cell: SuppressedCell | undefined): string {
  if (!cell) return '—';
  return 'value' in cell ? String(cell.value) : '—';
}

function isSuppressed(cell: SuppressedCell | undefined): boolean {
  return !cell || 'suppressed' in cell;
}

export function DemographicsTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<DemographicsResponse>(queryKeys.analytics.demographics(filters));

  if (error) {
    const body = (error as { body?: { code?: string; required?: number; actual?: number } }).body;
    if (body?.code === 'insufficient_data') {
      return <p className="text-sm text-muted-foreground">{t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: body.required, actual: body.actual })}</p>;
    }
    return <p className="text-sm text-destructive">{t('analytics.noData', 'No data for the selected filters')}</p>;
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  const pyramid = data.ageSex.map(row => ({
    bracket: row.bracket,
    male: isSuppressed(row.male) ? 0 : (row.male as { value: number }).value,
    female: isSuppressed(row.female) ? 0 : (row.female as { value: number }).value,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: t('analytics.demographics.personsServed', 'Persons served'), cell: data.summary.personsServed },
          { label: t('analytics.demographics.households', 'Households'), cell: data.summary.householdsCovered },
          { label: t('analytics.demographics.barangays', 'Barangays'), cell: data.summary.barangaysCovered },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{card.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{cellText(card.cell)}</p>
              {isSuppressed(card.cell) && <p className="text-xs text-muted-foreground">{t('analytics.suppressed', 'Suppressed (<5)')}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.ageSex', 'Age and sex')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pyramid} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="bracket" tick={{ fontSize: 10 }} width={50} />
              <Tooltip contentStyle={{ fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="male" name={t('analytics.demographics.male', 'Male')} fill="#3b82f6" />
              <Bar dataKey="female" name={t('analytics.demographics.female', 'Female')} fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.civilStatus', 'Civil status')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.civilStatus.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.occupation', 'Occupation (top 10)')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.occupation.length === 0 && <p className="text-xs text-muted-foreground">{t('analytics.suppressed', 'Suppressed (<5)')}</p>}
            {data.occupation.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.income', 'Household income bands')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.incomeBands.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">{t('analytics.demographics.incomeNote', 'Relative bands, not official poverty thresholds')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.dependency', 'Dependency ratio')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{data.dependencyRatio != null ? data.dependencyRatio.toFixed(2) : '—'}</p>
            <p className="text-sm text-muted-foreground">{t('analytics.demographics.philhealth', 'PhilHealth coverage')}: {cellText(data.philhealthCoverage)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.demographics.householdSize', 'Household size')}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.householdSize.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span>{row.label}</span><span className="font-medium">{cellText(row.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```


Add `"loading": "Loading…"` to the `analytics` block in both locales (en) and `"loading": "Naglo-load…"` (fil).

- [ ] **Step 4: Run the test + parity + typecheck**

Run: `npx vitest run src/components/analytics/DemographicsTab.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/analytics/DemographicsTab.tsx \
       kapwa-client/src/components/analytics/DemographicsTab.test.tsx \
       kapwa-client/src/i18n/locales/en/index.ts \
       kapwa-client/src/i18n/locales/fil/index.ts
git commit -m "feat(analytics): demographics tab"
```

---

## Task 11: Clustering tab

**Files:**
- Create: `kapwa-client/src/components/analytics/ClusteringTab.tsx`
- Create: `kapwa-client/src/components/analytics/ClusteringTab.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.analytics.runs(limit)`, `queryKeys.analytics.run(id)`, `queryKeys.analytics.runMembers(id, clusterIndex, page)`; `api.post('/analytics/clustering/runs', body)`; `downloadAnalyticsCsv(`/analytics/clustering/runs/${id}/export`, filename)`; `useAuth` role.
- Produces: `ClusteringTab({ filters })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ClusteringTab } from './ClusteringTab';

const { mockApiGet, mockApiPost, mockUseAuth } = vi.hoisted(() => ({
  mockApiGet: vi.fn(), mockApiPost: vi.fn(), mockUseAuth: vi.fn(),
}));
vi.mock('../../lib/api', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: (...a: unknown[]) => mockApiPost(...a) },
  downloadAnalyticsCsv: vi.fn(),
}));
vi.mock('../../lib/auth-context', () => ({ useAuth: (...a: unknown[]) => mockUseAuth(...a) }));

const RUN = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'completed',
  params: { chosen_k: 2, seed: 42, dataset_size: 60 },
  metrics: { dataset_size: 60, candidates: [{ k: 2, inertia: 10, silhouette: 0.6 }, { k: 3, inertia: 6, silhouette: 0.5 }] },
  createdAt: '2026-09-25T00:00:00Z',
};

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ClusteringTab filters={{}} />
    </SWRConfig>,
  );
}

describe('ClusteringTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' } });
    mockApiGet.mockImplementation((key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('"runs"')) return Promise.resolve([RUN]);
      if (k.includes('members')) return Promise.resolve({ rows: [{ householdId: 'h1', clusterIndex: 0, distance: 0.4, barangay: 'Bigte' }], total: 1 });
      if (k.includes('"run"')) return Promise.resolve({ run: RUN, clusters: [{ clusterIndex: 0, size: 30, profile: { household_income_median: 5000 } }, { clusterIndex: 1, size: 30, profile: { household_income_median: 15000 } }] });
      return Promise.resolve(null);
    });
    mockApiPost.mockResolvedValue(RUN);
  });

  it('lists runs and renders the chosen run candidates', async () => {
    renderTab();
    expect(await screen.findByText(/Chosen k/i)).toBeTruthy();
    expect(screen.getByText(/Chosen k: 2/)).toBeTruthy();
    expect(screen.getAllByText(/Segment|Segments/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers a run and shows members only for worker roles', async () => {
    renderTab();
    const runButton = await screen.findByRole('button', { name: /Run clustering/i });
    fireEvent.click(runButton);
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/analytics/clustering/runs', expect.objectContaining({})));

    fireEvent.click(await screen.findByRole('button', { name: /View households/i }));
    expect(await screen.findByText(/h1/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/analytics/ClusteringTab.test.tsx`
Expected: FAIL — cannot resolve `./ClusteringTab`.

- [ ] **Step 3: Write the component**

```tsx
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Download, Play, Users } from 'lucide-react';
import { api, downloadAnalyticsCsv } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RunSummary {
  id: string;
  status: string;
  params?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  createdAt: string;
}
interface RunDetail {
  run: RunSummary;
  clusters: Array<{ clusterIndex: number; size: number; profile?: Record<string, unknown> }>;
}

function CellValue({ value }: { value: unknown }) {
  if (value == null) return <>—</>;
  if (typeof value === 'object' && 'suppressed' in (value as object)) return <>—</>;
  const num = typeof value === 'number' ? value : Number(value);
  return <>{Number.isFinite(num) ? num.toLocaleString() : String(value)}</>;
}

export function ClusteringTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canDrill = user?.role === 'admin' || user?.role === 'social_worker';
  const [kMin, setKMin] = useState(2);
  const [kMax, setKMax] = useState(8);
  const [seed, setSeed] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [memberCluster, setMemberCluster] = useState<number | null>(null);
  const [memberPage, setMemberPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const { data: runs, mutate: mutateRuns } = useSWR<RunSummary[]>(queryKeys.analytics.runs(20));
  const activeRunId = selectedRunId ?? runs?.[0]?.id ?? null;
  const { data: detail } = useSWR<RunDetail>(activeRunId ? queryKeys.analytics.run(activeRunId) : null);
  const { data: members } = useSWR(
    activeRunId && memberCluster != null ? queryKeys.analytics.runMembers(activeRunId, memberCluster, memberPage) : null,
  );

  const candidates = useMemo(() => {
    const raw = (detail?.run.metrics as { candidates?: Array<{ k: number; inertia: number; silhouette: number }> })?.candidates ?? [];
    return raw.map(c => ({ ...c }));
  }, [detail]);

  async function runClustering() {
    setRunning(true);
    setError('');
    try {
      const body: Record<string, unknown> = { kRange: [kMin, kMax], ...filters };
      if (seed.trim() !== '') body.seed = Number(seed);
      await api.post('/analytics/clustering/runs', body);
      await mutateRuns();
    } catch {
      setError(t('analytics.noData', 'No data for the selected filters'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.runTitle', 'New clustering run')}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="k-min">{t('analytics.clustering.kRange', 'Candidate k range')}</label>
            <div className="flex items-center gap-1">
              <Input id="k-min" type="number" min={2} max={10} className="h-9 w-16" value={kMin} onChange={e => setKMin(Number(e.target.value))} />
              <span className="text-xs">–</span>
              <Input id="k-max" type="number" min={2} max={10} className="h-9 w-16" value={kMax} onChange={e => setKMax(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="seed">{t('analytics.clustering.seed', 'Seed (optional)')}</label>
            <Input id="seed" type="number" className="h-9 w-32" value={seed} onChange={e => setSeed(e.target.value)} placeholder={t('analytics.clustering.seedHint', 'Leave blank for a random seed; runs are reproducible by seed')} />
          </div>
          <Button size="sm" onClick={runClustering} disabled={running}>
            <Play size={14} className="mr-1" />
            {running ? t('analytics.clustering.running', 'Running…') : t('analytics.clustering.run', 'Run clustering')}
          </Button>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.runs', 'Runs')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(runs ?? []).map(run => (
              <button
                key={run.id}
                type="button"
                onClick={() => { setSelectedRunId(run.id); setMemberCluster(null); setMemberPage(1); }}
                className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${run.id === activeRunId ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <span className="flex items-center justify-between">
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                  <Badge variant={run.status === 'completed' ? 'default' : 'destructive'} className="text-[10px]">{run.status}</Badge>
                </span>
                <span className="text-muted-foreground">
                  {t('analytics.clustering.chosenK', 'Chosen k')}: {(run.params as { chosen_k?: number })?.chosen_k ?? '—'} · {t('analytics.clustering.datasetSize', 'Households')}: {(run.metrics as { dataset_size?: number })?.dataset_size ?? '—'}
                </span>
              </button>
            ))}
            {(runs ?? []).length === 0 && <p className="text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.candidates', 'k selection (elbow and silhouette)')}</CardTitle></CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={candidates}>
                  <XAxis dataKey="k" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line yAxisId="left" dataKey="inertia" name={t('analytics.clustering.inertia', 'Inertia')} stroke="#3b82f6" dot={false} />
                  <Line yAxisId="right" dataKey="silhouette" name={t('analytics.clustering.silhouette', 'Silhouette')} stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {detail && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.clusters.map(cluster => (
            <Card key={cluster.clusterIndex}>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{t('analytics.clustering.clusters', 'Segments')} #{cluster.clusterIndex + 1}</span>
                  <Badge variant="secondary" className="text-[10px]">{cluster.size}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {Object.entries(cluster.profile ?? {})
                  .filter(([key]) => key !== 'barangay_mix')
                  .slice(0, 5)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                      <span className="font-medium"><CellValue value={value} /></span>
                    </div>
                  ))}
                {canDrill && (
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => { setMemberCluster(cluster.clusterIndex); setMemberPage(1); }}>
                    <Users size={14} className="mr-1" /> {t('analytics.clustering.viewMembers', 'View households')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {detail && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => downloadAnalyticsCsv(`/analytics/clustering/runs/${detail.run.id}/export`, `analytics-clusters-${detail.run.id.slice(0, 8)}.csv`)}>
            <Download size={14} className="mr-1" /> {t('analytics.export', 'Export CSV')}
          </Button>
        </div>
      )}

      {memberCluster != null && members && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">{t('analytics.clustering.membersTitle', 'Households in segment {{index}}', { index: memberCluster + 1 })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {members.rows.map(row => (
              <div key={row.householdId} className="flex justify-between border-b py-1 last:border-0">
                <span>{row.householdId} · {row.barangay ?? '—'}</span>
                <span className="text-xs text-muted-foreground">{t('analytics.clustering.distance', 'Distance')}: {row.distance ?? '—'}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="outline" disabled={memberPage <= 1} onClick={() => setMemberPage(p => p - 1)}>‹</Button>
              <span className="text-xs text-muted-foreground">{memberPage} / {Math.max(1, Math.ceil(members.total / 20))}</span>
              <Button size="sm" variant="outline" disabled={memberPage >= Math.ceil(members.total / 20)} onClick={() => setMemberPage(p => p + 1)}>›</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test + typecheck**

Run: `npx vitest run src/components/analytics/ClusteringTab.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/components/analytics/ClusteringTab.tsx kapwa-client/src/components/analytics/ClusteringTab.test.tsx
git commit -m "feat(analytics): clustering tab with run controls and drill-down"
```

---

## Task 12: Concentration + equity tabs, page, route, nav

**Files:**
- Create: `kapwa-client/src/components/analytics/ConcentrationTab.tsx`
- Create: `kapwa-client/src/components/analytics/EquityTab.tsx`
- Create: `kapwa-client/src/components/analytics/ConcentrationTab.test.tsx`
- Create: `kapwa-client/src/pages/AnalyticsPage.tsx`
- Modify: `kapwa-client/src/routes.tsx`
- Modify: `kapwa-client/src/lib/nav-config.tsx`
- Create: `kapwa-client/src/pages/AnalyticsPage.test.tsx`

**Interfaces:**
- Consumes: `queryKeys.analytics.concentration/equity`; Tasks 9–11 components.
- Produces: the `/analytics` route and nav entry; `AnalyticsPage`.

- [ ] **Step 1: Write the failing concentration test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ConcentrationTab } from './ConcentrationTab';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: (...a: unknown[]) => mockApiGet(...a) } }));

function renderTab() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <ConcentrationTab filters={{}} />
    </SWRConfig>,
  );
}

describe('ConcentrationTab', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiGet.mockResolvedValue({
      hhiCases: 0.31, hhiAssistance: 0.4, totalCases: 120, totalAmount: 50000,
      barangays: [
        { barangay: 'Poblacion', cases: { value: 60 }, interventions: { value: 90 }, amount: { value: 30000 }, caseShare: { value: 0.5 }, amountShare: { value: 0.6 } },
        { barangay: 'Bigte', cases: { suppressed: true }, interventions: { suppressed: true }, amount: { suppressed: true }, caseShare: { suppressed: true }, amountShare: { suppressed: true } },
      ],
    });
  });

  it('renders HHI cards and suppressed rows', async () => {
    renderTab();
    expect(await screen.findByText(/0\.31/)).toBeTruthy();
    expect(screen.getByText('Poblacion')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/analytics/ConcentrationTab.test.tsx`
Expected: FAIL — cannot resolve `./ConcentrationTab`.

- [ ] **Step 3: Write both tab components**

`ConcentrationTab.tsx`:

```tsx
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';

type Cell = { value: number } | { suppressed: true };
interface ConcentrationResponse {
  hhiCases: number;
  hhiAssistance: number;
  totalCases: number;
  totalAmount: number;
  barangays: Array<{ barangay: string; cases: Cell; interventions: Cell; amount: Cell; caseShare: Cell; amountShare: Cell }>;
}

function cellText(cell: Cell | undefined): string {
  if (!cell || 'suppressed' in cell) return '—';
  return typeof cell.value === 'number' ? cell.value.toLocaleString() : String(cell.value);
}

export function ConcentrationTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<ConcentrationResponse>(queryKeys.analytics.concentration(filters));
  if (error) return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.concentration.hhiCases', 'Case concentration (HHI)')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data.hhiCases.toFixed(3)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('analytics.concentration.hhiAssistance', 'Assistance concentration (HHI)')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data.hhiAssistance.toFixed(3)}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.concentration.barangay', 'Barangay')}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1">{t('analytics.concentration.barangay', 'Barangay')}</th>
                <th>{t('analytics.concentration.cases', 'Cases')}</th>
                <th>{t('analytics.concentration.interventions', 'Interventions')}</th>
                <th>{t('analytics.concentration.amount', 'Assistance')}</th>
                <th>{t('analytics.concentration.caseShare', 'Case share')}</th>
                <th>{t('analytics.concentration.amountShare', 'Assistance share')}</th>
              </tr>
            </thead>
            <tbody>
              {data.barangays.map(row => (
                <tr key={row.barangay} className="border-t">
                  <td className="py-1">{row.barangay}</td>
                  <td>{cellText(row.cases)}</td>
                  <td>{cellText(row.interventions)}</td>
                  <td>{cellText(row.amount)}</td>
                  <td>{cellText(row.caseShare)}</td>
                  <td>{cellText(row.amountShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

`EquityTab.tsx`:

```tsx
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '../../lib/query-keys';

type Cell = { value: number } | { suppressed: true };
interface EquityResponse {
  barangays: Array<{ barangay: string; householdsShare: Cell; servedShare: Cell; assistanceShare: Cell; coverageRatio: Cell; coverageQuartile: Cell; fourPsShare: Cell }>;
}

function cellText(cell: Cell | undefined): string {
  if (!cell || 'suppressed' in cell) return '—';
  return cell.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function EquityTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<EquityResponse>(queryKeys.analytics.equity(filters));
  if (error) return <p className="text-sm text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t('analytics.loading', 'Loading…')}</p>;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{t('analytics.tabs.equity', 'Equity')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('analytics.equity.note', "Ratios compare each barangay's served share with its share of all households")}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1">{t('analytics.concentration.barangay', 'Barangay')}</th>
              <th>{t('analytics.equity.householdsShare', 'Household share')}</th>
              <th>{t('analytics.equity.servedShare', 'Served share')}</th>
              <th>{t('analytics.equity.assistanceShare', 'Assistance share')}</th>
              <th>{t('analytics.equity.coverageRatio', 'Coverage ratio')}</th>
              <th>{t('analytics.equity.coverageQuartile', 'Coverage quartile')}</th>
              <th>{t('analytics.equity.fourPsShare', '4Ps household share')}</th>
            </tr>
          </thead>
          <tbody>
            {data.barangays.map(row => (
              <tr key={row.barangay} className="border-t">
                <td className="py-1">{row.barangay}</td>
                <td>{cellText(row.householdsShare)}</td>
                <td>{cellText(row.servedShare)}</td>
                <td>{cellText(row.assistanceShare)}</td>
                <td>{cellText(row.coverageRatio)}</td>
                <td>{cellText(row.coverageQuartile)}</td>
                <td>{cellText(row.fourPsShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the concentration test + typecheck**

Run: `npx vitest run src/components/analytics/ConcentrationTab.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Write the page, route, and nav**

Create `src/pages/AnalyticsPage.tsx` (code from Task 9 Step 7).

In `routes.tsx`: add the lazy import after the `PayoutSchedulePage` import:

```tsx
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
```

and the route after the payouts route:

```tsx
  { path: '/analytics', element: <Private roles={['admin','social_worker','mayor']}><AnalyticsPage /></Private> },
```

In `nav-config.tsx`: add a new group before the `Mayor` group:

```tsx
  {
    label: 'Insights',
    items: [
      { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} />, roles: ['admin', 'social_worker', 'mayor'] },
    ],
  },
```

- [ ] **Step 6: Write the page test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AnalyticsPage } from './AnalyticsPage';

const { mockApiGet, mockUseAuth } = vi.hoisted(() => ({ mockApiGet: vi.fn(), mockUseAuth: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...a: unknown[]) => mockApiGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
  downloadAnalyticsCsv: vi.fn(),
}));
vi.mock('../lib/auth-context', () => ({ useAuth: (...a: unknown[]) => mockUseAuth(...a) }));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: '1', role: 'admin' }, loading: false });
    mockApiGet.mockResolvedValue({ barangays: [], summary: {}, ageSex: [], civilStatus: [], occupation: [], incomeBands: [] });
  });

  it('renders the shell with all four tabs', async () => {
    render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <MemoryRouter initialEntries={['/analytics']}><AnalyticsPage /></MemoryRouter>
      </SWRConfig>,
    );
    expect(await screen.findByRole('heading', { name: /Analytics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Demographics/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Clustering/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Concentration/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Equity/i })).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run tests + typecheck + parity**

Run (from `kapwa-client/`): `npx vitest run src/components/analytics src/pages/AnalyticsPage.test.tsx src/i18n/__tests__/fil-parity.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add kapwa-client/src/components/analytics/ConcentrationTab.tsx \
       kapwa-client/src/components/analytics/EquityTab.tsx \
       kapwa-client/src/components/analytics/ConcentrationTab.test.tsx \
       kapwa-client/src/pages/AnalyticsPage.tsx \
       kapwa-client/src/pages/AnalyticsPage.test.tsx \
       kapwa-client/src/routes.tsx \
       kapwa-client/src/lib/nav-config.tsx
git commit -m "feat(analytics): concentration and equity tabs, page, route, nav"
```

---

## Task 13: Wave-1 close — docs, full verification, boot smoke

**Files:**
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: everything above.
- Produces: verified wave-1 state.

- [ ] **Step 1: Append the ledger entry**

```markdown
## 2026-09-25 — Analytics Wave 1 (clustering, demographics, concentration, equity)
- Spec: docs/superpowers/specs/2026-09-25-analytics-clustering-demographics-design.md
- Plan: docs/superpowers/plans/2026-09-25-analytics-dashboard-wave1.md
- Added analysis_runs / analysis_run_clusters / analysis_run_members (migration 0066 + migrate.ts).
- New analytics module: feature extraction, suppression (<5), seeded k-means with k=2–8 elbow/silhouette candidates, persisted runs, audited drill-down, aggregate CSV.
- Client: /analytics page with filter bar and Demographics / Clustering / Concentration / Equity tabs.
- Wave 2 (inequality, forecasting, association rules) planned separately.
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
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa node dist/database/migrate.js
DB_HOST=localhost DB_PORT=5433 DB_USER=kapwa DB_PASSWORD=kapwa DB_NAME=kapwa PORT=3100 node dist/main.js > /tmp/kapwa-analytics-boot.log 2>&1 &
BOOT_PID=$!
sleep 15
grep -E "Nest application successfully started|Nest can't resolve dependencies|ERROR" /tmp/kapwa-analytics-boot.log | head -30
kill $BOOT_PID 2>/dev/null || true
pg_ctl -D /tmp/opencode/kapwa-pg/data stop || true
```

Expected: `Nest application successfully started`, no DI errors (MinIO bucket logs are benign).

- [ ] **Step 4: Commit**

```bash
git add .superpowers/sdd/progress.md
git commit -m "docs: record analytics wave 1" || echo "ledger is gitignored - nothing to commit"
```

---

## Self-Review

**1. Spec coverage (wave 1):**

| Spec section | Task |
|---|---|
| §4.1 module layout | Tasks 3–8 |
| §4.2 migration + tables | Task 1 |
| §4.3 endpoints (wave 1) | Task 8 |
| §5.1 feature vector | Task 5 |
| §5.2 k-means + validation | Tasks 3–4 |
| §5.3 demographics | Task 7 |
| §5.4 concentration | Task 7 |
| §5.5 equity/coverage | Task 7 |
| §6 client dashboard (wave-1 tabs, filters, exports, methodology) | Tasks 9–12 |
| §7 privacy/suppression/drill-down/audit | Tasks 5, 6, 8, 12 |
| §8 validation/errors/performance | Tasks 4–8 |
| §9 testing strategy (known-answer math, service, controller, client, reproducibility) | Tasks 3–12 |
| §10 success criteria | Task 13 gates |
| §11 docs | Task 13 |

Wave 2 (§5.6–5.8) is explicitly out of this plan; it gets its own plan against the same spec.

**2. Placeholder scan:** no TBD/TODO; every code step carries real code; no step defers work with vague language.

**3. Type consistency:** `HouseholdFeatureRow`/`FeatureKey` defined in Task 4 and used in Tasks 5–6; `CandidateK` from Task 4 used in Task 6; `Suppressed<T>`/`suppressCount`/`suppressRatio` from Task 5 used in Task 7; controller method names in Task 8 match the service methods in Tasks 6–7; client query keys in Task 9 match the SWR calls in Tasks 10–12.

**4. Review Focus coverage:** sparse/empty → Tasks 7, 10, 12; NULL incomes → Tasks 4, 5; degenerate math → Tasks 3, 4; suppression leaks → Tasks 5, 7, 8; seed reproducibility → Tasks 4, 6.
