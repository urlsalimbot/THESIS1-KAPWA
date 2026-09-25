# Analytics Dashboard — K-Means Clustering, Demographics & Statistical Models — Design

- **Date:** 2026-09-25
- **Status:** Approved in brainstorm (2026-09-25); pending written-spec review
- **Umbrella:** New KAPWA analytics subsystem (server `analytics` module + `/analytics` dashboard)

## 1. Objective

Give the MSWDO decision-support analytics on real system data with thesis-grade rigor: deep demographic profiling, household vulnerability clustering (k-means with elbow/silhouette validation), income inequality, caseload/disbursement forecasting, equity/coverage by barangay, geographic concentration, and service association rules — all reproducible (persisted clustering runs), privacy-safe (small-cell suppression), and exportable as aggregate evidence.

## 2. Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Primary purpose | Both: decision support for MSWDO/mayor, with thesis-grade methodology & reproducibility |
| Clustering unit | Households (feature vector below) |
| Cluster lifecycle | Persisted runs (params, candidates, metrics, assignments); no scheduler |
| Structural form | One spec → two implementation waves |
| Privacy | Aggregate-first + authorized drill-down; cells <5 suppressed; exports aggregate-only |
| Advanced models deferred | Case lifecycle/renewal, anomaly/outlier, cohort retention, scheduled runs, run comparison UI, choropleth map, Python backend |

## 3. Scope

**Wave 1 (foundation + core):**
1. `analytics` module skeleton + migration `analysis_runs` / `analysis_run_clusters` / `analysis_run_members`.
2. Deep demographic analysis.
3. Geographic concentration.
4. Equity & coverage ratios.
5. Household k-means clustering with persisted runs (k=2–8 candidates, elbow + silhouette, seeded).

**Wave 2 (advanced models, no schema change):**
6. Income inequality (Lorenz, Gini, deciles, top-10% share).
7. Caseload & disbursement forecasting (Holt linear + MA(3) baseline, MAPE, 95% band).
8. Service association rules (pairwise support/confidence/lift).

**Deferred (recorded, out of this spec):** time-to-approval/time-to-close percentiles, renewal rate, anomaly/outlier flags, cohort retention, scheduled auto-runs, run-comparison UI, barangay choropleth map, external Python model backend, coordinator/barangay-scoped analytics, member-level exports.

## 4. Architecture

### 4.1 Server — new `kapwa-server/src/analytics/` module

```
analytics/
  analytics.module.ts            # forFeature([AnalysisRun, AnalysisRunCluster, AnalysisRunMember]); AuthModule
  analytics.controller.ts        # /analytics; RolesGuard + AbacGuard; ClassSerializerInterceptor
  analytics.service.ts           # live models (demographics, concentration, equity, inequality, forecast, associations)
  clustering.service.ts          # run lifecycle: features → candidate k's → persist
  analytics-features.service.ts  # SQL household feature vectors + drill-down queries
  models/
    stats.ts                     # mean, std, median, quantiles, z-score, Gini, Lorenz, HHI, silhouette, euclidean
    kmeans.ts                    # mulberry32 PRNG, k-means++ init, Lloyd, restarts, candidate evaluation
    forecast.ts                  # Holt linear, MA(3), MAPE, prediction band
    associations.ts              # pairwise support/confidence/lift
  analysis-run.entity.ts
  analysis-run-cluster.entity.ts
  analysis-run-member.entity.ts
```

`models/*` are pure functions with no Nest/TypeORM imports (fully unit-testable). `clustering.service.ts` uses `CacheService` only for reads; run creation is never cached. Register `AnalyticsModule` in `app.module.ts`.

### 4.2 Persistence — migration `…0000000000066` (+ idempotent `migrate.ts` mirror)

Repo double-file rule applies; the next sequential 13-digit key is confirmed at implementation time (currently 0065 is max).

```sql
CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  model VARCHAR NOT NULL DEFAULT 'household_clustering',
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  params JSONB,        -- features, k_range, chosen_k, seed, filters, imputation notes
  metrics JSONB,       -- candidates: [{k, inertia, silhouette}], chosen scores, dataset_size, feature means/stds
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE analysis_run_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  cluster_index INT NOT NULL,
  size INT NOT NULL,
  centroid JSONB,      -- standardized + original (inverse-transformed) values
  profile JSONB,       -- medians, barangay mix, category-flag shares
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE analysis_run_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id),
  cluster_index INT NOT NULL,
  distance DECIMAL(12,6),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_run_member_unique ON analysis_run_members(run_id, household_id);
CREATE INDEX idx_run_member_cluster ON analysis_run_members(run_id, cluster_index);
CREATE INDEX idx_run_cluster_run ON analysis_run_clusters(run_id, cluster_index);
CREATE INDEX idx_runs_created ON analysis_runs(created_at DESC);
```

### 4.3 Endpoints

Roles: GETs `admin | social_worker | mayor`; writes/drill-down `admin | social_worker`. Sensitivity `internal`; mayor read-only.

```
GET  /analytics/demographics?from&to&barangay          wave 1
GET  /analytics/concentration?from&to                  wave 1
GET  /analytics/equity?from&to                         wave 1
POST /analytics/clustering/runs                        wave 1  body: {kRange?, features?, from?, to?, barangay?, seed?}
GET  /analytics/clustering/runs?limit                  wave 1
GET  /analytics/clustering/runs/:id                    wave 1
GET  /analytics/clustering/runs/:id/members?clusterIndex&page&limit  wave 1  (admin/social_worker; audited)
GET  /analytics/clustering/runs/:id/export             wave 1  (aggregate CSV)
GET  /analytics/inequality?from&to                     wave 2
GET  /analytics/forecast?metric=cases|disbursement&horizon  wave 2
GET  /analytics/associations?from&to&minSupport&minConfidence  wave 2
```

Live GETs cached via `CacheService.wrap` (TTL 5 min, key = model + serialized filters). Clustering runs synchronously and returns the run summary (`201`); `status` supports a future async worker. CSV responses use the repo's `exportFileName` helper and `text/csv` + `Content-Disposition`.

## 5. Model specifications

Shared filters: `from` / `to` (inclusive dates), `barangay`. "Served in range" means a person/household linked to a case with ≥1 intervention whose `delivery_date` is in range; with no range, all records. All displayed cells <5 are suppressed (see §7).

### 5.1 Household feature vector (default, fixed set for this wave)

| Feature | Source |
|---|---|
| `household_income` | `households.estimated_income` (median-imputed when NULL; imputed count recorded in metrics) |
| `household_size` | count of `household_memberships` |
| `children_0_5`, `children_6_17`, `adults_18_59`, `seniors_60` | member ages from `persons.dob` (SQL `AGE`) |
| `has_pwd`, `has_solo_parent`, `has_4ps` | member `beneficiary_roles.category` ∈ {`PWD`,`Solo Parent`,`4Ps`} → 0/1 |
| `case_count` | count of `cases` |
| `intervention_count` | count of `case_interventions` |
| `total_assistance` | `SUM(case_interventions.amount)` |
| `days_since_last_case` | `CURRENT_DATE − MAX(cases.created_at)` (NULL → dataset max, recorded as imputed) |

`barangay` is **not** a distance feature; it is stored for profiling. Households with zero members are excluded; `n` is recorded in run metrics. A run may select a subset of these keys via `features` (unknown keys → 400); the default is all keys.

### 5.2 K-means + validation (`models/kmeans.ts`)

- Require `n ≥ 20` households, else `422 {code:'insufficient_data', required:20, actual:n}`.
- Standardize each feature (z-score; `std = 0 → z = 0`); means/stds persisted in `metrics` for reproducibility.
- Seeded PRNG: `mulberry32(seed)`; `seed` defaults to a generated 32-bit int stored in `params`.
- Init: k-means++ (D² sampling via the PRNG). Lloyd iterations ≤100, stop when max centroid shift < 1e-4. Restarts: 5, keep lowest inertia.
- Candidate k: requested range clamped to `[2, min(10, n−1)]`, default `2..8`. Per k persist `inertia` and `silhouette` (exact for `n ≤ 2000`, else 500-point PRNG sample).
- `chosen_k` = argmax silhouette (tie → smaller k). Assignments + per-member distance persisted; cluster profiles = medians of features, size, top-3 barangay mix, category-flag shares; centroids in standardized and inverse-transformed units.
- Runs are immutable; a re-run with the same seed, filters, and dataset reproduces identical assignments (tested).

### 5.3 Demographic analysis

Returns: total persons served, households covered, barangays covered; age–sex pyramid (brackets `0-5, 6-12, 13-17, 18-24, 25-34, 35-44, 45-59, 60+` × `Male/Female`); civil status counts; top-10 occupations (empty → `Unspecified`); household income bands (`<5k, 5–10k, 10–20k, 20–40k, ≥40k, Unspecified` — relative bands, **not** official poverty thresholds, stated in the UI methodology note); household size distribution (1 … 8+) and dependency ratio `(0–14 + 60+) / (15–59)`; PhilHealth coverage rate (persons with `philhealth_number` ÷ served).

### 5.4 Geographic concentration

Per barangay in range: case count, intervention count, assistance amount, and shares. Concentration score = HHI of the case distribution (`Σ share²`, 0–1) plus HHI of the assistance distribution. Labels: `<0.15 dispersed`, `0.15–0.25 moderate`, `>0.25 concentrated` (documented heuristic). Requires ≥3 barangays with data, else `422 insufficient_data` (consistent with §8). Ranked table returned.

### 5.5 Equity & coverage ratios

Per barangay: `households_share` (all households ÷ municipal households), `served_share` (served households in range), `assistance_share`, `coverage_ratio = served_share / households_share`, plus 4Ps-household share. Neutral presentation: ratio and quartile rank only — no normative "underserved" labels in the API; the UI may color ratios <1.

### 5.6 Income inequality

Household incomes (non-null, >0) in scope; require `n ≥ 20`. Returns Lorenz curve points at each decile (cumulative population vs cumulative income share), Gini coefficient (trapezoid integration; equal incomes → 0), top-10% income share, decile boundaries, and excluded-missing count. Uses household `estimated_income` only.

### 5.7 Forecasting

- Series: monthly buckets over the last `months` (default 24, min 12; months with no data = 0) for `metric ∈ {cases, disbursement}` (`cases.created_at`; `SUM(case_interventions.amount)` by `delivery_date`).
- Model: Holt's linear trend; α, β grid-searched over 0.05–0.95 step 0.05 minimizing one-step SSE. Horizon `h` default 6 (1–12), 95% band = `1.96 · residual_std · √h` (documented random-walk widening approximation).
- Validation: last-6-month holdout MAPE, compared against an MA(3) baseline MAPE. Returns history, fitted, forecast, band, metrics, fitted params.

### 5.8 Service association rules

Transactions = cases in range; items = distinct `case_interventions.service_name` per case. Pairwise itemsets only; `support ≥ minSupport` (default 0.05), `confidence ≥ minConfidence` (default 0.5), ranked by lift, top 20. Each rule returns `{a, b, support, confidence, lift, count_a, count_b, count_both}`. Require ≥30 transactions else `422 insufficient_data`. Rule cells with counts <5 are suppressed.

## 6. Client dashboard

- Route `/analytics` (lazy-loaded), roles `admin | social_worker | mayor`; nav entry via `nav-config.tsx` for those roles.
- `PageShell` with a shared filter bar: date-range presets (30d / 90d / 6m / 1y / All) + barangay select + apply; cached-data indicator (existing `PageShell` `cachedAt` pattern).
- Tabs, one component per model in `src/components/analytics/`:
  - **Demographics** — pyramid (horizontal bars), summary cards, civil status/occupation/income-band bars, composition + dependency, PhilHealth coverage.
  - **Clustering** — run controls (k range, optional seed, date range, barangay), run list, candidates chart (inertia + silhouette vs k, dual axis), selected-run cluster cards with profiles, barangay-mix stacked bar, member drill-down table (admin/social_worker only; paged), aggregate CSV export.
  - **Concentration** — HHI cards + ranked bar/table. **Equity** — share comparison bars + ratio table. **(wave 2)** **Inequality** — Lorenz line; **Forecast** — history + forecast with band and MAPE cards; **Associations** — rules table.
- Suppressed cells render `—` with an accessible tooltip "Suppressed (<5)"; insufficient-data responses render a friendly empty state with the required/actual counts.
- Each tab has a methodology popover (short plain-language explanation of the model, its assumptions, and the not-official-thresholds note for income bands).
- Charts use `recharts` (already a dependency). CSV export uses an authenticated blob download helper mirroring `downloadGisPdf`.

## 7. Privacy & access

- Suppression threshold `MIN_CELL = 5` applied **server-side**: any count/size/rule cell below 5 is returned as `{suppressed: true}` without the value; percentages for suppressed cells are suppressed too. Whole responses with `n < 5` return an empty state.
- Drill-down (`/members`) is `admin | social_worker` only, paginated (default 20, max 100), and logged via `AuditLogService.log` (`action: 'analytics.drilldown'`, run id + cluster index + pager). Existing PII masking applies to the member rows.
- `mayor` receives aggregates only (drill-down endpoints return 403). Exports are aggregate-only — no member rows are exportable in this spec.
- No raw `estimated_income` of identifiable households appears in aggregate responses (bands only; clustering profiles use medians).

## 8. Error handling, validation & performance

- Zod query/body schemas: ISO dates with `from ≤ to`, `horizon 1–12`, `kRange` ascending ints within `2–10`, `metric` enum, `minSupport`/`minConfidence` ∈ [0,1], `seed` int32. Invalid input → 400 via the existing `ZodPipe`.
- Insufficient data → `422 {code:'insufficient_data', required, actual}` (clustering n≥20, inequality n≥20, associations ≥30 transactions, concentration ≥3 barangays).
- A clustering run that throws is persisted with `status='failed'` and `error`, then surfaced as `500` with the run id.
- Feature extraction is one SQL query; k-means at thesis scale (n ≤ ~5k, k ≤ 10, 5 restarts) runs in well under a second. Live GETs cached 5 min. New indexes only on the three run tables.

## 9. Testing strategy

- **Known-answer unit tests (`models/`):** Gini(equal incomes)=0 and Gini(one holder)=1−1/n; Lorenz endpoints (0,0)/(1,1); HHI bounds; z-score with zero variance; k-means recovers 3 synthetic well-separated blobs (assignment accuracy ≥95%) and is seed-reproducible; silhouette ∈ [−1,1]; Holt recovers a perfectly linear series trend; MAPE=0 on an exact line; lift against a hand-computed 2×2 co-occurrence matrix; suppression helper.
- **Service specs:** feature extraction mapping, run persistence (params/metrics/clusters/members), candidate clamping, failure persistence, cache keying, insufficient-data errors.
- **Controller specs:** route/role/pipe binding, member drill-down role gate, CSV headers, audit log call.
- **Client:** tab component tests (render, empty/insufficient state, suppressed cell rendering, run trigger + candidates chart data, drill-down visibility by role), CSV download helper test.
- **Reproducibility test:** same seed + same dataset + same filters → identical cluster assignments and metrics.

## 10. Success criteria

1. Admin can trigger a household clustering run and see data-driven k selection (elbow + silhouette), segment profiles, sizes, and barangay mix; runs are immutable and reproducible by seed.
2. Every descriptive model renders for a chosen range/barangay with honest empty/insufficient states.
3. Suppression (<5) is enforced by the server and visible in tests; drill-downs are role-gated and audited.
4. Forecasts report MAPE and a baseline comparison; association rules are ranked by lift with support/confidence; income bands are clearly labeled as relative, not official thresholds.
5. Run metadata (seed, params, dataset size, feature means/stds, date range) is inspectable and exportable for the thesis appendix.
6. Server and client suites + typechecks stay green.

## 11. Documentation

- Spec committed under `docs/superpowers/specs/`; implementation plan under `docs/superpowers/plans/`.
- `.superpowers/sdd/progress.md` ledger entries per task.
- In-app methodology notes per tab (plain language) double as thesis-defensible method descriptions.

## 12. Out of scope

Everything in §3 "Deferred", plus: scheduled/auto runs, run comparison UI, choropleth/GIS map integration, external Python/scikit-learn service, coordinator/barangay-scoped analytics, member-level exports, and official poverty-threshold classification (relative bands only).
