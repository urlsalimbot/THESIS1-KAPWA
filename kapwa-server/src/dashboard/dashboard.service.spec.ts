import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Case } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { VersionVector } from '../sync/version-vector.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let caseRepoMock: any;
  let benRepoMock: any;
  let versionVectorRepoMock: any;

  beforeEach(async () => {
    caseRepoMock = {
      manager: {
        query: jest.fn().mockResolvedValue([{ total: '17500', count: '7' }]),
      },
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    benRepoMock = {
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '25' }),
      })),
    };

    versionVectorRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: benRepoMock },
        { provide: getRepositoryToken(VersionVector), useValue: versionVectorRepoMock },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns metrics', async () => {
    const result = await service.getMetrics();
    expect(result).toHaveProperty('totalCases');
    expect(result.totalDisbursedAmount).toBe(17500);
    expect(result.recentInterventions).toBe(7);
  });

  it('scopes every metric component to a coordinator barangay', async () => {
    caseRepoMock.manager.query.mockResolvedValue([{ total: '17500', count: '7' }]);

    await service.getMetrics('Bigte');

    const [countsQb, byStatusQb] = caseRepoMock.createQueryBuilder.mock.results.map((r: any) => r.value);
    const existsCalls = [
      ...(countsQb.where as jest.Mock).mock.calls,
      ...(byStatusQb.where as jest.Mock).mock.calls,
    ].filter(([sql]: [string]) => sql.includes('person_addresses'));
    // Both the counts QB and the byStatus QB must carry the EXISTS scope.
    expect(existsCalls).toHaveLength(2);
    for (const [sql, params] of existsCalls) {
      expect(sql).toContain('EXISTS (SELECT 1 FROM person_addresses pa2');
      expect(params).toEqual({ barangay: '%Bigte%' });
    }

    const queryCalls = (caseRepoMock.manager.query as jest.Mock).mock.calls as Array<[string, unknown[]]>;
    expect(queryCalls).toHaveLength(3); // disbursed, recent interventions, unique households
    for (const [sql, params] of queryCalls) {
      expect(sql).toContain('person_addresses'); // every raw metric is barangay-scoped
      expect(params).toContain('%Bigte%');
    }
  });

  it('leaves metrics unscoped when no barangay is passed', async () => {
    caseRepoMock.manager.query.mockResolvedValue([{ total: '17500', count: '7' }]);

    await service.getMetrics();

    const [countsQb, byStatusQb] = caseRepoMock.createQueryBuilder.mock.results.map((r: any) => r.value);
    const existsSqls = [
      ...(countsQb.where as jest.Mock).mock.calls,
      ...(byStatusQb.where as jest.Mock).mock.calls,
    ]
      .map((c: [string]) => c[0])
      .filter((sql: string) => sql.includes('person_addresses'));
    expect(existsSqls).toHaveLength(0);
    const queryCalls = (caseRepoMock.manager.query as jest.Mock).mock.calls as Array<[string, unknown[]]>;
    for (const [sql, params] of queryCalls) {
      expect(sql).not.toContain('person_addresses');
      expect(params).not.toContain('%');
    }
  });

  it('scopes SLA compliance to a coordinator barangay', async () => {
    const qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    };
    caseRepoMock.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

    const result = await service.getSlaCompliance('Bigte');

    expect(qbMock.leftJoin).toHaveBeenCalledWith('c.beneficiary', 'b');
    expect(qbMock.leftJoin).toHaveBeenCalledWith('b.person', 'p');
    const existsCall = (qbMock.andWhere as jest.Mock).mock.calls
      .find((c: [string, unknown]) => c[0].includes('person_addresses'));
    expect(existsCall?.[0]).toContain('EXISTS (SELECT 1 FROM person_addresses pa2');
    expect(existsCall?.[1]).toEqual({ slaBarangay: '%Bigte%' });
    expect(result).toEqual({ overdueCount: 2, slaStatus: 'violated' });
  });

  it('returns recent cases', async () => {
    caseRepoMock.createQueryBuilder = jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: '1' }]),
    }));
    const result = await service.getRecentCases();
    expect(result).toHaveLength(1);
  });

  it('returns SLA compliance', async () => {
    caseRepoMock.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    }));
    const result = await service.getSlaCompliance();
    expect(result.slaStatus).toBe('compliant');
  });
});
