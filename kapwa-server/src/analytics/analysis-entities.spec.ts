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

  it('pins uuid column types on foreign keys', () => {
    expect(storage.columns.find(c => c.target === AnalysisRun && c.propertyName === 'createdBy')?.options.type).toBe('uuid');
    expect(storage.columns.find(c => c.target === AnalysisRunCluster && c.propertyName === 'runId')?.options.type).toBe('uuid');
    expect(storage.columns.find(c => c.target === AnalysisRunMember && c.propertyName === 'runId')?.options.type).toBe('uuid');
    expect(storage.columns.find(c => c.target === AnalysisRunMember && c.propertyName === 'householdId')?.options.type).toBe('uuid');
  });
});
