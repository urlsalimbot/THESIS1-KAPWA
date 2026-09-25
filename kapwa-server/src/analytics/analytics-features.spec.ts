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
    expect(String(sql)).toContain('COUNT(DISTINCT p.id)');
    expect(String(sql)).toContain('ci.case_id = c.id::text');
    expect(String(sql)).toContain('role_flags');
    expect(String(sql)).toContain("ILIKE '%pwd%'");
    expect(String(sql)).toContain("ILIKE '%solo%parent%'");
    expect(params).toEqual([null, null, null]);
  });

  it('passes range and barangay filters into the query params', async () => {
    repoMock.query.mockResolvedValue([]);
    await service.getHouseholdFeatures({ from: '2026-01-01', to: '2026-06-30', barangay: 'Bigte' });
    expect(repoMock.query.mock.calls[0][1]).toEqual(['2026-01-01', '2026-06-30', 'Bigte']);
  });

  it('pages run members', async () => {
    repoMock.query
      .mockResolvedValueOnce([{ total: 7 }])
      .mockResolvedValueOnce([{ household_id: 'h1', cluster_index: 1, distance: '0.5', barangay: 'Bigte' }]);
    const page = await service.getRunMembers('run-1', 1, 2, 20);
    expect(page.total).toBe(7);
    expect(page.rows[0]).toEqual({ householdId: 'h1', clusterIndex: 1, distance: 0.5, barangay: 'Bigte' });
    expect(repoMock.query).toHaveBeenCalledTimes(2);
    const [countSql, countParams] = repoMock.query.mock.calls[0];
    expect(String(countSql)).toContain('COUNT(*)::int');
    expect(String(countSql)).not.toContain('LIMIT');
    expect(countParams).toEqual(['run-1', 1]);
    const [sql, params] = repoMock.query.mock.calls[1];
    expect(String(sql)).toContain('FROM analysis_run_members m');
    expect(params).toEqual(['run-1', 1, 20, 20]);
  });
});
