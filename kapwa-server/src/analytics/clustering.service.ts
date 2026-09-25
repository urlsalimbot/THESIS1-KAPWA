import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
import { MIN_CELL } from './suppression';

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

    if (featureKeys.length === 0) {
      throw new UnprocessableEntityException({ code: 'invalid_features', features: input.features ?? [] });
    }

    const rows = await this.features.getHouseholdFeatures({ from: input.from, to: input.to, barangay: input.barangay });
    if (rows.length < MIN_DATASET) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: MIN_DATASET, actual: rows.length });
    }

    let run: AnalysisRun | undefined;

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

      run = await this.runRepo.save(this.runRepo.create({
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

      const savedRun: AnalysisRun = run;

      for (const cluster of clusterRows) {
        await this.clusterRepo.save({ ...cluster, runId: savedRun.id });
      }
      await this.memberRepo.insert(rows.map((row, i) => ({
        runId: savedRun.id,
        householdId: row.householdId,
        clusterIndex: chosen.assignments[i],
        distance: Number(
          Math.sqrt(featureKeys.reduce((acc, key, dim) => {
            const x = prep.X[i][dim];
            return acc + (x - chosen.centroids[chosen.assignments[i]][dim]) ** 2;
          }, 0)).toFixed(6),
        ),
      })));

      return savedRun;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        if (run?.id) {
          await this.clusterRepo.delete({ runId: run.id });
          await this.memberRepo.delete({ runId: run.id });
          await this.runRepo.update(run.id, { status: 'failed', error: message });
        } else {
          await this.runRepo.save(this.runRepo.create({
            model: 'household_clustering', status: 'failed',
            params: { features: featureKeys, k_range: kRange, seed, filters: { from: input.from ?? null, to: input.to ?? null, barangay: input.barangay ?? null } },
            startedAt, completedAt: new Date(), createdBy: userId, error: message,
          }));
        }
      } catch {
        // recovery is best-effort; never mask the original error
      }
      throw err;
    }
  }

  async listRuns(limit = 20): Promise<AnalysisRun[]> {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 100) });
  }

  async getRun(id: string) {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Analysis run not found');
    const clusters = (await this.clusterRepo.find({ where: { runId: id }, order: { clusterIndex: 'ASC' } }))
      .map(cluster => cluster.size < MIN_CELL
        ? { ...cluster, size: { suppressed: true as const }, centroid: undefined, profile: undefined }
        : cluster);
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
      ...clusters.map(c => (c.size < MIN_CELL
        ? [c.clusterIndex, 'suppressed', ...profileKeys.map(() => 'suppressed')]
        : [c.clusterIndex, c.size, ...profileKeys.map(key => csvEscape((c.profile as any)?.[key]))]
      ).join(',')),
    ];
    const date = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(lines.join('\n'), 'utf8'), filename: `analytics-clusters-${run.id.slice(0, 8)}-${date}.csv` };
  }
}
