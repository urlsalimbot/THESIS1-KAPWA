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

  it('returns report breakdowns (zero-PII dimensions)', async () => {
    caseRepoMock.manager.query
      .mockResolvedValueOnce([{ count: '5' }])            // beneficiariesServed
      .mockResolvedValueOnce([{ program: 'AICS', beneficiaries: '3', interventions: '4', amount: '12000' }])
      .mockResolvedValueOnce([{ fund_source: 'LGU', interventions: '4', amount: '12000' }])
      .mockResolvedValueOnce([{ gender: 'Female', count: '3' }])
      .mockResolvedValueOnce([{ bracket: '60+', count: '2' }])
      .mockResolvedValueOnce([{ barangay: 'Bigte', count: '2' }])
      .mockResolvedValueOnce([{ category: 'Indigent', count: '3' }])
      .mockResolvedValueOnce([{ agency: 'RHU', total: '1', referred: '1', accepted: '0', declined: '0', completed: '0' }]);
    const result = await service.getReportBreakdowns();
    expect(result.beneficiariesServed).toBe(5);
    expect(result.byProgram).toHaveLength(1);
    expect(result.byProgram[0]).toMatchObject({ program: 'AICS' });
    expect(result.byFundSource).toHaveLength(1);
    expect(result.byGender).toHaveLength(1);
    expect(result.referrals).toHaveLength(1);
  });

  it('returns daily tracker', async () => {
    const result = await service.getDailyTracker(new Date());
    expect(result).toEqual([]);
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
