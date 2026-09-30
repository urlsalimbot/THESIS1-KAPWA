import { Test } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClusteringService } from './clustering.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  const analytics = {
    getDemographics: jest.fn(), getConcentration: jest.fn(), getEquity: jest.fn(),
    getInequality: jest.fn(), getForecast: jest.fn(), getAssociations: jest.fn(),
  };
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

  // Analytics is a staff feature: every endpoint must admit social workers,
  // not just admins. Guards the client nav/route that now offers it to both.
  const ENDPOINTS = [
    'demographics', 'concentration', 'equity', 'inequality', 'forecast',
    'associations', 'createRun', 'listRuns', 'getRun', 'runMembers', 'exportCsv',
  ] as const;

  it.each(ENDPOINTS)('%s is available to social workers and admins', (method) => {
    const roles = Reflect.getMetadata('roles', AnalyticsController.prototype[method]) as string[] | undefined;
    expect(roles).toEqual(expect.arrayContaining(['admin', 'social_worker']));
  });

  it.each(ENDPOINTS)('%s stays closed to coordinators and claimants', (method) => {
    const roles = Reflect.getMetadata('roles', AnalyticsController.prototype[method]) as string[] | undefined;
    expect(roles).not.toContain('coordinator');
    expect(roles).not.toContain('claimant');
  });
});
