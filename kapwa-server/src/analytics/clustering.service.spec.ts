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
      update: jest.fn(),
    };
    clusterRepo = { create: jest.fn((d: any) => d), save: jest.fn(), insert: jest.fn(), find: jest.fn(), delete: jest.fn() };
    memberRepo = { insert: jest.fn(), delete: jest.fn() };
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

  it('rejects an empty valid feature set before fetching data', async () => {
    await expect(service.createRun({ features: ['nope' as any] })).rejects.toThrow(UnprocessableEntityException);
    expect(features.getHouseholdFeatures).not.toHaveBeenCalled();
  });

  it('marks the single run row failed when persistence fails midway', async () => {
    features.getHouseholdFeatures.mockResolvedValue(rows(60));
    runRepo.save
      .mockImplementationOnce(async (d: any) => ({ id: 'run-1', ...d }))
      .mockImplementation(async (d: any) => d);
    clusterRepo.save.mockRejectedValue(new Error('db down'));

    await expect(service.createRun({ kRange: [2, 2] }, 'user-1')).rejects.toThrow('db down');
    expect(runRepo.create).toHaveBeenCalledTimes(1);
    expect(runRepo.update).toHaveBeenCalledWith('run-1', expect.objectContaining({
      status: 'failed', error: expect.stringContaining('db down'),
    }));
    expect(clusterRepo.delete).toHaveBeenCalledWith({ runId: 'run-1' });
    expect(memberRepo.delete).toHaveBeenCalledWith({ runId: 'run-1' });
  });

  it('suppresses sub-5 counts in the barangay mix of a visible cluster', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'run-1' });
    clusterRepo.find.mockResolvedValue([
      {
        clusterIndex: 0, size: 30, centroid: { standardized: [1] },
        profile: {
          barangay_mix: [{ barangay: 'Poblacion', count: 28 }, { barangay: 'Unspecified', count: 2 }],
          household_income_median: 20000,
        },
      },
    ]);

    const { clusters } = await service.getRun('run-1');

    expect((clusters[0].profile as any).barangay_mix).toEqual([
      { barangay: 'Poblacion', count: { value: 28 } },
      { barangay: 'Unspecified', count: { suppressed: true } },
    ]);
    expect((clusters[0].profile as any).household_income_median).toBe(20000);
  });

  it('throws NotFound for unknown runs', async () => {
    runRepo.findOne.mockResolvedValue(null);
    await expect(service.getRun('missing')).rejects.toThrow(NotFoundException);
  });

  it('suppresses sub-5 cluster sizes, the complementary cell, and derived cells in run detail', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'run-1' });
    clusterRepo.find.mockResolvedValue([
      { clusterIndex: 0, size: 3, centroid: { standardized: [1] }, profile: { household_income_median: 12345 } },
      { clusterIndex: 1, size: 20, centroid: { standardized: [2] }, profile: { household_income_median: 18000 } },
      { clusterIndex: 2, size: 30, centroid: { standardized: [3] }, profile: { household_income_median: 20000 } },
    ]);

    const { clusters } = await service.getRun('run-1');

    // Size 3 is small, so the smallest remaining size (20) is hidden with it.
    expect(clusters[0].size).toEqual({ suppressed: true });
    expect(clusters[0].profile).toBeUndefined();
    expect(clusters[0].centroid).toBeUndefined();
    expect(clusters[1].size).toEqual({ suppressed: true });
    expect(clusters[1].profile).toBeUndefined();
    expect(clusters[2].size).toBe(30);
    expect(clusters[2].profile).toEqual({ household_income_median: 20000 });
    expect(clusters[2].centroid).toEqual({ standardized: [3] });
  });

  it('leaves cluster sizes untouched when zero or two-plus cells are suppressed', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'run-1' });
    clusterRepo.find.mockResolvedValueOnce([
      { clusterIndex: 0, size: 20, profile: { household_income_median: 18000 } },
      { clusterIndex: 1, size: 30, profile: { household_income_median: 20000 } },
    ]);
    const noSmall = await service.getRun('run-1');
    expect(noSmall.clusters.map(c => c.size)).toEqual([20, 30]);

    clusterRepo.find.mockResolvedValueOnce([
      { clusterIndex: 0, size: 3, profile: { household_income_median: 12345 } },
      { clusterIndex: 1, size: 2, profile: { household_income_median: 8000 } },
      { clusterIndex: 2, size: 30, profile: { household_income_median: 20000 } },
    ]);
    const twoSmall = await service.getRun('run-1');
    expect(twoSmall.clusters[2].size).toBe(30);
    expect(twoSmall.clusters[2].profile).toEqual({ household_income_median: 20000 });
  });

  it('audits member drill-down access', async () => {
    runRepo.findOne.mockResolvedValue({ id: 'run-1' });
    features.getRunMembers.mockResolvedValue({ rows: [], total: 0 });
    await service.getRunMembers('run-1', 0, 1, 20, 'user-7');
    expect(audit.log).toHaveBeenCalledWith('analytics.drilldown', 'run-1', 'user-7', expect.objectContaining({ clusterIndex: 0, page: 1 }));
  });

  it('exports an aggregate CSV with run metadata and a single size column', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'run-1', status: 'completed',
      params: { chosen_k: 2, seed: 5, dataset_size: 60 },
      metrics: { dataset_size: 60 },
      createdAt: new Date('2026-09-25T00:00:00Z'),
    });
    clusterRepo.find.mockResolvedValue([
      { clusterIndex: 0, size: 30, profile: { size: 30, household_income_median: 6000 } },
      { clusterIndex: 1, size: 30, profile: { size: 30, household_income_median: 15000 } },
    ]);
    const { buffer, filename } = await service.exportRunCsv('run-1');
    const text = buffer.toString('utf8');
    expect(text).toContain('# run_id,run-1');
    const header = text.split('\n').find(line => line.startsWith('cluster_index,'));
    expect(header).toBe('cluster_index,size,household_income_median');
    expect(header?.split(',').filter(key => key === 'size')).toHaveLength(1);
    expect(text).toContain('0,30,6000');
    expect(filename).toMatch(/^analytics-clusters-.*\.csv$/);
  });

  it('suppresses sub-5 cluster cells and the complementary size cell in the aggregate CSV', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'run-1', status: 'completed',
      params: { chosen_k: 3, seed: 5, dataset_size: 53 },
      metrics: { dataset_size: 53 },
      createdAt: new Date('2026-09-25T00:00:00Z'),
    });
    clusterRepo.find.mockResolvedValue([
      { clusterIndex: 0, size: 3, profile: { household_income_median: 987654 } },
      { clusterIndex: 1, size: 20, profile: { household_income_median: 12000 } },
      { clusterIndex: 2, size: 30, profile: { household_income_median: 15000 } },
    ]);

    const { buffer } = await service.exportRunCsv('run-1');
    const text = buffer.toString('utf8');
    const rows = text.split('\n');
    // Size 3 is small, so the smallest remaining size (20) is written suppressed too.
    expect(rows.find(r => r.startsWith('0,'))).toBe('0,suppressed,suppressed');
    expect(rows.find(r => r.startsWith('1,'))).toBe('1,suppressed,suppressed');
    expect(rows.find(r => r.startsWith('2,'))).toBe('2,30,15000');
    expect(text).not.toContain('987654');
  });

  it('leaves CSV size cells untouched when the family is already non-invertible', async () => {
    runRepo.findOne.mockResolvedValue({
      id: 'run-1', status: 'completed',
      params: { chosen_k: 3, seed: 5, dataset_size: 35 },
      metrics: { dataset_size: 35 },
      createdAt: new Date('2026-09-25T00:00:00Z'),
    });
    clusterRepo.find.mockResolvedValue([
      { clusterIndex: 0, size: 3, profile: { household_income_median: 3000 } },
      { clusterIndex: 1, size: 2, profile: { household_income_median: 8000 } },
      { clusterIndex: 2, size: 30, profile: { household_income_median: 15000 } },
    ]);

    const { buffer } = await service.exportRunCsv('run-1');
    const rows = buffer.toString('utf8').split('\n');
    expect(rows.find(r => r.startsWith('2,'))).toBe('2,30,15000');
  });
});
