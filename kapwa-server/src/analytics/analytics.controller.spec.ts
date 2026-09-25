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
