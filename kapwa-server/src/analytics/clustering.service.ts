import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisRun } from './analysis-run.entity';
import { AnalysisRunCluster } from './analysis-run-cluster.entity';
import { AnalysisRunMember } from './analysis-run-member.entity';
import { AnalyticsFeaturesService } from './analytics-features.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FEATURE_KEYS, FeatureKey } from './analytics.types';
import { prepareMatrix, evaluateCandidates, chooseK } from './models/kmeans';
import { median } from './models/stats';
import { complementSuppression, suppressCount, MIN_CELL } from './suppression';

const MIN_DATASET = 20;

/**
 * Per-cell suppression for the display-only barangay mix (a top-3 list, not a
 * partition), so sub-5 counts never leave the API.
 */
function suppressProfileMix(profile: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined {
  if (!profile || !Array.isArray(profile.barangay_mix)) return profile;
  return {
    ...profile,
    barangay_mix: (profile.barangay_mix as Array<{ barangay: string; count: number }>).map(entry => ({
      ...entry,
      count: suppressCount(Number(entry.count)),
    })),
  };
}

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

/**
 * Response shape for run detail: cluster sizes (and the derived dataset size)
 * may be replaced with suppressed-cell wrappers on read.
 */
export interface RunDetailCluster {
  clusterIndex: number;
  size: number | { suppressed: true };
  centroid?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface RunDetail {
  run: {
    id: string;
    model: string;
    status: string;
    params?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
    startedAt?: Date;
    completedAt?: Date;
    createdBy?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  clusters: RunDetailCluster[];
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

    if (featureKeys.length === 0) {
      throw new UnprocessableEntityException({ code: 'invalid_features', features: input.features ?? [] });
    }

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
        return {
          clusterIndex, size: members.length,
          centroid: { standardized: centroid.map(v => Number(v.toFixed(6))), features: featureKeys },
          profile,
        };
      });

      const memberRows = rows.map((row, i) => ({
        householdId: row.householdId,
        clusterIndex: chosen.assignments[i],
        distance: Number(
          Math.sqrt(featureKeys.reduce((acc, key, dim) => {
            const x = prep.X[i][dim];
            return acc + (x - chosen.centroids[chosen.assignments[i]][dim]) ** 2;
          }, 0)).toFixed(6),
        ),
      }));

      // One transaction: a run is either fully persisted (run + clusters +
      // members) or not persisted at all.
      const saved = await this.runRepo.manager.transaction(async manager => {
        const run = await manager.save(manager.create(AnalysisRun, {
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
          await manager.save(manager.create(AnalysisRunCluster, { ...cluster, runId: run.id }));
        }
        await manager.insert(AnalysisRunMember, memberRows.map(member => ({ ...member, runId: run.id })));
        return run;
      });

      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      new Logger(ClusteringService.name).warn(`Clustering run failed: ${message}`);
      try {
        await this.runRepo.save(this.runRepo.create({
          model: 'household_clustering', status: 'failed',
          params: { features: featureKeys, k_range: kRange, seed, filters: { from: input.from ?? null, to: input.to ?? null, barangay: input.barangay ?? null } },
          startedAt, completedAt: new Date(), createdBy: userId, error: message,
        }));
      } catch {
        // recovery is best-effort; never mask the original error
      }
      throw err;
    }
  }

  async listRuns(limit = 20): Promise<AnalysisRun[]> {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 100) });
  }

  async getRun(id: string): Promise<RunDetail> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Analysis run not found');
    const stored = await this.clusterRepo.find({ where: { runId: id }, order: { clusterIndex: 'ASC' } });
    const sizeCells = complementSuppression(
      stored.map(cluster => (cluster.size < MIN_CELL ? { suppressed: true as const } : { value: cluster.size })),
    );
    const clusters = stored.map((cluster, i) => ('suppressed' in sizeCells[i]
      ? { ...cluster, size: { suppressed: true as const }, centroid: undefined, profile: undefined }
      : { ...cluster, profile: suppressProfileMix(cluster.profile) ?? undefined }));
    // The persisted dataset size equals the sum of the (possibly suppressed)
    // cluster sizes, so it is suppressed in the response when any size is
    // hidden. The stored row is left untouched.
    const anySizeSuppressed = sizeCells.some(cell => 'suppressed' in cell);
    const runResponse = anySizeSuppressed
      ? { ...run, metrics: { ...(run.metrics ?? {}), dataset_size: { suppressed: true as const } } }
      : run;
    return { run: runResponse, clusters };
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
    const sizeCells = complementSuppression(
      clusters.map(cluster => (cluster.size < MIN_CELL ? { suppressed: true as const } : { value: cluster.size })),
    );
    const anySizeSuppressed = sizeCells.some(cell => 'suppressed' in cell);
    const profileKeys = [...new Set(clusters.flatMap(c => Object.keys(c.profile ?? {})))]
      .filter(key => key !== 'barangay_mix' && key !== 'size');
    const lines: string[] = [
      `# run_id,${run.id}`,
      `# status,${run.status}`,
      `# chosen_k,${(run.params as any)?.chosen_k ?? ''}`,
      `# seed,${(run.params as any)?.seed ?? ''}`,
      `# dataset_size,${anySizeSuppressed ? 'suppressed' : ((run.metrics as any)?.dataset_size ?? '')}`,
      `# generated_at,${new Date().toISOString()}`,
      ['cluster_index', 'size', ...profileKeys].join(','),
      ...clusters.map((c, i) => ('suppressed' in sizeCells[i]
        ? [c.clusterIndex, 'suppressed', ...profileKeys.map(() => 'suppressed')]
        : [c.clusterIndex, c.size, ...profileKeys.map(key => csvEscape((c.profile as any)?.[key]))]
      ).join(',')),
    ];
    const date = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(lines.join('\n'), 'utf8'), filename: `analytics-clusters-${run.id.slice(0, 8)}-${date}.csv` };
  }
}
