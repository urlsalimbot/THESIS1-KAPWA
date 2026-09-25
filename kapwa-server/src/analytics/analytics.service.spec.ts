import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnprocessableEntityException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Case } from '../cases/case.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = { query: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Case), useValue: repoMock },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('getDemographics', () => {
    it('suppresses small cells and keeps cells of 5 or more', async () => {
      repoMock.query.mockResolvedValue([
        { gender: 'Male', age: 4, civil_status: 'Single', occupation: null, has_philhealth: false, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { gender: 'Female', age: 10, civil_status: 'Single', occupation: 'Student', has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { gender: 'Female', age: 65, civil_status: 'Widowed', occupation: 'Retired', has_philhealth: false, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { gender: 'Male', age: 30, civil_status: 'Married', occupation: null, has_philhealth: false, household_income: null, household_id: 'h3', barangay: null },
      ]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 5 });
      expect(result.summary.householdsCovered).toEqual({ suppressed: true });
      expect(result.summary.barangaysCovered).toEqual({ suppressed: true });
      expect(result.ageSex.find(b => b.bracket === '0-5')?.male).toEqual({ suppressed: true });
      expect(result.civilStatus.find(s => s.label === 'Married')?.count).toEqual({ suppressed: true });
      expect(result.occupation).toEqual([]);
      expect(result.incomeBands.find(b => b.label === '<5k')?.count).toEqual({ suppressed: true });
      expect(result.dependencyRatio).toBeCloseTo(1.5);
      expect(result.philhealthCoverage).toEqual({ value: 0.4 });
    });

    it('computes non-suppressed values for a larger cohort', async () => {
      const rows = [
        ...Array.from({ length: 8 }, (_, i) => ({ gender: 'Male', age: 4, civil_status: 'Single', occupation: 'Farmer', has_philhealth: true, household_income: '4000', household_id: `ha${i}`, barangay: 'Poblacion' })),
        ...Array.from({ length: 12 }, (_, i) => ({ gender: 'Female', age: 30, civil_status: 'Married', occupation: 'Teacher', has_philhealth: false, household_income: '12000', household_id: `hb${i}`, barangay: 'Bigte' })),
      ];
      repoMock.query.mockResolvedValue(rows);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 20 });
      expect(result.summary.householdsCovered).toEqual({ value: 20 });
      expect(result.summary.barangaysCovered).toEqual({ suppressed: true });
      expect(result.ageSex.find(b => b.bracket === '0-5')?.male).toEqual({ value: 8 });
      expect(result.occupation).toEqual([
        { label: 'Teacher', count: { value: 12 } },
        { label: 'Farmer', count: { value: 8 } },
      ]);
      expect(result.dependencyRatio).toBeCloseTo(8 / 12);
      expect(result.philhealthCoverage).toEqual({ value: 0.4 });
    });

    it('returns an empty state when there are no persons', async () => {
      repoMock.query.mockResolvedValue([]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ suppressed: true });
      expect(result.ageSex.every(b => 'suppressed' in b.male && 'suppressed' in b.female)).toBe(true);
      expect(result.dependencyRatio).toBeNull();
    });
  });

  describe('getConcentration', () => {
    it('computes shares and HHI per barangay', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
        { barangay: 'Matictic', cases: '0', interventions: '2', amount: '0' },
      ]);
      const result = await service.getConcentration({});
      expect(result.barangays).toHaveLength(3);
      expect(result.hhiCases).toBeCloseTo(0.5);
      expect(result.hhiAssistance).toBeCloseTo(0.36 + 0.16);
      expect(result.barangays[0].cases).toEqual({ value: 6 });
    });

    it('throws insufficient_data when fewer than three barangays have data', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
      ]);
      await expect(service.getConcentration({})).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getEquity', () => {
    it('computes coverage ratios against household shares', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', served_households: '8', assistance: '8000', four_ps: '6' },
          { barangay: 'Bigte', served_households: '2', assistance: '1000', four_ps: '1' },
        ])
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', households: '40' },
          { barangay: 'Bigte', households: '60' },
        ]);
      const result = await service.getEquity({});
      const poblacion = result.barangays.find(b => b.barangay === 'Poblacion');
      expect(poblacion?.householdsShare).toEqual({ value: 0.4 });
      expect(poblacion?.servedShare).toEqual({ value: 0.8 });
      expect(poblacion?.coverageRatio).toEqual({ value: 2 });
      const bigte = result.barangays.find(b => b.barangay === 'Bigte');
      expect(bigte?.fourPsShare).toEqual({ suppressed: true });
    });
  });
});
