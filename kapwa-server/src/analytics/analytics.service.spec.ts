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
        { person_id: 'p1', gender: 'Male', age: 4, civil_status: 'Single', occupation: null, has_philhealth: false, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p2', gender: 'Female', age: 10, civil_status: 'Single', occupation: 'Student', has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p3', gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { person_id: 'p4', gender: 'Female', age: 65, civil_status: 'Widowed', occupation: 'Retired', has_philhealth: false, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { person_id: 'p5', gender: 'Male', age: 30, civil_status: 'Married', occupation: null, has_philhealth: false, household_income: null, household_id: 'h3', barangay: null },
      ]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 5 });
      expect(result.summary.householdsCovered).toEqual({ suppressed: true });
      expect(result.summary.barangaysCovered).toEqual({ suppressed: true });
      expect(result.ageSex.find(b => b.bracket === '0-5')?.male).toEqual({ suppressed: true });
      expect(result.civilStatus.find(s => s.label === 'Married')?.count).toEqual({ suppressed: true });
      expect(result.occupation).toEqual([]);
      expect(result.incomeBands.find(b => b.label === '<5k')?.count).toEqual({ suppressed: true });
      // working-age denominator (2) is below MIN_CELL, so the ratio is suppressed
      expect(result.dependencyRatio).toBeNull();
      expect(result.philhealthCoverage).toEqual({ value: 0.4 });
    });

    it('computes non-suppressed values for a larger cohort', async () => {
      const rows = [
        ...Array.from({ length: 8 }, (_, i) => ({ person_id: `pa${i}`, gender: 'Male', age: 4, civil_status: 'Single', occupation: 'Farmer', has_philhealth: true, household_income: '4000', household_id: `ha${i}`, barangay: 'Poblacion' })),
        ...Array.from({ length: 12 }, (_, i) => ({ person_id: `pb${i}`, gender: 'Female', age: 30, civil_status: 'Married', occupation: 'Teacher', has_philhealth: false, household_income: '12000', household_id: `hb${i}`, barangay: 'Bigte' })),
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
      expect(result.householdSize.find(b => b.label === '1')?.count).toEqual({ value: 20 });
    });

    it('buckets households by size, capping at 8+, and suppresses small buckets', async () => {
      const rows = [
        { person_id: 's1p1', gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '4000', household_id: 'small', barangay: 'Poblacion' },
        ...Array.from({ length: 9 }, (_, i) => ({ person_id: `s9p${i}`, gender: 'Female', age: 30, civil_status: 'Married', occupation: 'Teacher', has_philhealth: true, household_income: '12000', household_id: 'large', barangay: 'Bigte' })),
      ];
      repoMock.query.mockResolvedValue(rows);
      const result = await service.getDemographics({});
      expect(result.householdSize.map(b => b.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8+']);
      // one household of size 1 and one of size 9 (capped to 8+): both below MIN_CELL
      expect(result.householdSize.find(b => b.label === '1')?.count).toEqual({ suppressed: true });
      expect(result.householdSize.find(b => b.label === '8+')?.count).toEqual({ suppressed: true });
    });

    it('returns an empty state when there are no persons', async () => {
      repoMock.query.mockResolvedValue([]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ suppressed: true });
      expect(result.ageSex.every(b => 'suppressed' in b.male && 'suppressed' in b.female)).toBe(true);
      expect(result.dependencyRatio).toBeNull();
    });

    it('complementarily suppresses a second cell in each age-sex family when exactly one is small', async () => {
      const ageByBracket: Record<string, number> = {
        '0-5': 3, '6-12': 8, '13-17': 15, '18-24': 20, '25-34': 30, '35-44': 40, '45-59': 50, '60+': 65,
      };
      const byGender = (gender: 'Male' | 'Female', small: string) =>
        Object.entries(ageByBracket).flatMap(([bracket, age]) =>
          Array.from({ length: bracket === small ? 1 : 5 }, (_, i) => ({
            person_id: `${gender[0]}_${bracket}_${i}`, gender, age, civil_status: 'Single', occupation: null,
            has_philhealth: false, household_income: '12000', household_id: `${gender[0]}h_${bracket}_${i}`, barangay: 'Poblacion',
          })));
      repoMock.query.mockResolvedValue([...byGender('Male', '0-5'), ...byGender('Female', '60+')]);
      const result = await service.getDemographics({});
      const bracket = (name: string) => result.ageSex.find(b => b.bracket === name);
      // Male: only 0-5 is small, so the smallest remaining cell (6-12) is hidden with it.
      expect(bracket('0-5')?.male).toEqual({ suppressed: true });
      expect(bracket('6-12')?.male).toEqual({ suppressed: true });
      expect(bracket('13-17')?.male).toEqual({ value: 5 });
      // Female: only 60+ is small; the smallest remaining cell (0-5) is hidden with it.
      expect(bracket('60+')?.female).toEqual({ suppressed: true });
      expect(bracket('0-5')?.female).toEqual({ suppressed: true });
      expect(bracket('6-12')?.female).toEqual({ value: 5 });
    });

    it('complementarily suppresses a second civil-status cell when exactly one is small', async () => {
      const person = (id: string, status: string) => ({
        person_id: id, gender: 'Male', age: 40, civil_status: status, occupation: null,
        has_philhealth: false, household_income: '12000', household_id: `h_${id}`, barangay: 'Poblacion',
      });
      repoMock.query.mockResolvedValue([
        ...Array.from({ length: 6 }, (_, i) => person(`s${i}`, 'Single')),
        ...Array.from({ length: 5 }, (_, i) => person(`m${i}`, 'Married')),
        person('w0', 'Widowed'),
      ]);
      const result = await service.getDemographics({});
      const status = (label: string) => result.civilStatus.find(s => s.label === label);
      expect(status('Single')?.count).toEqual({ value: 6 });
      expect(status('Married')?.count).toEqual({ suppressed: true });
      expect(status('Widowed')?.count).toEqual({ suppressed: true });
    });

    it('complementarily suppresses a second income band when exactly one is small', async () => {
      const person = (id: string, income: string | null) => ({
        person_id: id, gender: 'Male', age: 40, civil_status: 'Single', occupation: null,
        has_philhealth: false, household_income: income, household_id: `h_${id}`, barangay: 'Poblacion',
      });
      const rows = [
        ...Array.from({ length: 10 }, (_, i) => person(`a${i}`, '4000')),
        ...Array.from({ length: 5 }, (_, i) => person(`b${i}`, '7000')),
        ...Array.from({ length: 6 }, (_, i) => person(`c${i}`, '12000')),
        ...Array.from({ length: 5 }, (_, i) => person(`d${i}`, '30000')),
        ...Array.from({ length: 5 }, (_, i) => person(`e${i}`, '45000')),
        person('u0', null),
      ];
      repoMock.query.mockResolvedValue(rows);
      const result = await service.getDemographics({});
      const band = (label: string) => result.incomeBands.find(b => b.label === label);
      expect(band('<5k')?.count).toEqual({ value: 10 });
      expect(band('5-10k')?.count).toEqual({ suppressed: true });
      expect(band('Unspecified')?.count).toEqual({ suppressed: true });
      expect(band('10-20k')?.count).toEqual({ value: 6 });
    });

    it('complementarily suppresses a second household-size bucket when exactly one is small', async () => {
      const rows: Array<Record<string, unknown>> = [];
      for (let size = 1; size <= 7; size++) {
        for (let h = 0; h < 5; h++) {
          for (let m = 0; m < size; m++) {
            rows.push({
              person_id: `s${size}h${h}p${m}`, gender: 'Male', age: 40, civil_status: 'Married', occupation: null,
              has_philhealth: false, household_income: '12000', household_id: `s${size}h${h}`, barangay: 'Poblacion',
            });
          }
        }
      }
      for (let m = 0; m < 8; m++) {
        rows.push({
          person_id: `s8h0p${m}`, gender: 'Male', age: 40, civil_status: 'Married', occupation: null,
          has_philhealth: false, household_income: '12000', household_id: 's8h0', barangay: 'Poblacion',
        });
      }
      repoMock.query.mockResolvedValue(rows);
      const result = await service.getDemographics({});
      const size = (label: string) => result.householdSize.find(b => b.label === label);
      expect(size('1')?.count).toEqual({ suppressed: true });
      expect(size('2')?.count).toEqual({ value: 5 });
      expect(size('8+')?.count).toEqual({ suppressed: true });
    });

    it('adds no complementary suppression when a family has zero or two-plus small cells', async () => {
      const person = (id: string, status: string) => ({
        person_id: id, gender: 'Male', age: 40, civil_status: status, occupation: null,
        has_philhealth: false, household_income: '12000', household_id: `h_${id}`, barangay: 'Poblacion',
      });
      repoMock.query.mockResolvedValue([
        ...Array.from({ length: 6 }, (_, i) => person(`z1_${i}`, 'Single')),
        ...Array.from({ length: 6 }, (_, i) => person(`z2_${i}`, 'Married')),
      ]);
      const noSmall = await service.getDemographics({});
      expect(noSmall.civilStatus.map(s => s.count)).toEqual([{ value: 6 }, { value: 6 }]);

      repoMock.query.mockResolvedValue([
        ...Array.from({ length: 6 }, (_, i) => person(`m1_${i}`, 'Single')),
        ...Array.from({ length: 2 }, (_, i) => person(`m2_${i}`, 'Married')),
        person('m3', 'Widowed'),
      ]);
      const twoSmall = await service.getDemographics({});
      expect(twoSmall.civilStatus.find(s => s.label === 'Single')?.count).toEqual({ value: 6 });
      expect(twoSmall.civilStatus.filter(s => 'suppressed' in s.count)).toHaveLength(2);
    });

    it('counts a person once when duplicate beneficiary rows are returned', async () => {
      repoMock.query.mockResolvedValue([
        { person_id: 'p1', gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p1', gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p2', gender: 'Male', age: 4, civil_status: 'Single', occupation: null, has_philhealth: false, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p3', gender: 'Female', age: 10, civil_status: 'Single', occupation: 'Student', has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p4', gender: 'Female', age: 65, civil_status: 'Widowed', occupation: 'Retired', has_philhealth: false, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { person_id: 'p5', gender: 'Male', age: 30, civil_status: 'Married', occupation: null, has_philhealth: false, household_income: null, household_id: 'h3', barangay: null },
      ]);
      const result = await service.getDemographics({});
      expect(result.summary.personsServed).toEqual({ value: 5 });
      // working-age denominator (2) is below MIN_CELL, so the ratio is suppressed
      expect(result.dependencyRatio).toBeNull();
    });

    it('suppresses the dependency ratio for cohorts below the cell minimum', async () => {
      repoMock.query.mockResolvedValue([
        { person_id: 'p1', gender: 'Male', age: 4, civil_status: 'Single', occupation: null, has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p2', gender: 'Female', age: 10, civil_status: 'Single', occupation: 'Student', has_philhealth: true, household_income: '4000', household_id: 'h1', barangay: 'Poblacion' },
        { person_id: 'p3', gender: 'Male', age: 40, civil_status: 'Married', occupation: 'Farmer', has_philhealth: true, household_income: '12000', household_id: 'h2', barangay: 'Bigte' },
        { person_id: 'p4', gender: 'Female', age: 30, civil_status: 'Married', occupation: 'Teacher', has_philhealth: false, household_income: '12000', household_id: 'h3', barangay: 'Bigte' },
      ]);
      const result = await service.getDemographics({});
      expect(result.dependencyRatio).toBeNull();
    });

    it('suppresses the dependency ratio when the working-age denominator is below the cell minimum', async () => {
      const person = (id: string, age: number) => ({
        person_id: id, gender: 'Male', age, civil_status: 'Single', occupation: null,
        has_philhealth: false, household_income: '12000', household_id: `h_${id}`, barangay: 'Poblacion',
      });
      repoMock.query.mockResolvedValue([
        ...Array.from({ length: 6 }, (_, i) => person(`d${i}`, 4)),
        ...Array.from({ length: 2 }, (_, i) => person(`w${i}`, 30)),
      ]);
      const smallDenominator = await service.getDemographics({});
      expect(smallDenominator.dependencyRatio).toBeNull();

      repoMock.query.mockResolvedValue([
        ...Array.from({ length: 5 }, (_, i) => person(`w2_${i}`, 30)),
        person('d2', 4),
      ]);
      const visibleDenominator = await service.getDemographics({});
      expect(visibleDenominator.dependencyRatio).toBeCloseTo(1 / 5);
    });

    it('casts the case intervention join to text for the uuid case id', async () => {
      repoMock.query.mockResolvedValue([]);
      await service.getDemographics({});
      expect(String(repoMock.query.mock.calls[0][0])).toContain('ci.case_id = c.id::text');
    });
  });

  describe('getConcentration', () => {
    it('computes shares and HHI per barangay and complementarily suppresses one small family', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
        { barangay: 'Matictic', cases: '0', interventions: '2', amount: '0' },
      ]);
      const result = await service.getConcentration({});
      expect(result.barangays).toHaveLength(3);
      expect(result.hhiCases).toBeCloseTo(0.5);
      expect(result.hhiCasesLabel).toBe('concentrated');
      expect(result.hhiAssistance).toBeCloseTo(0.36 + 0.16);
      expect(result.hhiAssistanceLabel).toBe('concentrated');
      // The zero-case Matictic cell is suppressed, so the smallest remaining
      // case cell (Poblacion, first of the 6s) is suppressed with it.
      expect(result.barangays[0].cases).toEqual({ suppressed: true });
      expect(result.barangays[1].cases).toEqual({ value: 6 });
      // The zero-amount Matictic cell is suppressed, so Bigte's 4000 goes too.
      expect(result.barangays[0].amount).toEqual({ value: 6000 });
      expect(result.barangays[1].amount).toEqual({ suppressed: true });
    });

    it('leaves case and amount cells untouched when no cell is small', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '7', interventions: '9', amount: '7000' },
        { barangay: 'Matictic', cases: '8', interventions: '11', amount: '8000' },
      ]);
      const result = await service.getConcentration({});
      expect(result.barangays.map(b => b.cases)).toEqual([{ value: 6 }, { value: 7 }, { value: 8 }]);
      expect(result.barangays.map(b => b.amount)).toEqual([{ value: 6000 }, { value: 7000 }, { value: 8000 }]);
    });

    it('leaves the case family untouched when two or more cells are already suppressed', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '2', interventions: '3', amount: '0' },
        { barangay: 'Matictic', cases: '1', interventions: '2', amount: '1' },
      ]);
      const result = await service.getConcentration({});
      expect(result.barangays[0].cases).toEqual({ value: 6 });
      expect(result.barangays.filter(b => 'suppressed' in b.cases)).toHaveLength(2);
      expect(result.barangays.filter(b => 'suppressed' in b.amount)).toHaveLength(2);
    });

    it('throws insufficient_data when fewer than three barangays have data', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
      ]);
      await expect(service.getConcentration({})).rejects.toThrow(UnprocessableEntityException);
    });

    it('casts the case join to text for the uuid case id', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Poblacion', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '6', interventions: '8', amount: '4000' },
        { barangay: 'Matictic', cases: '0', interventions: '2', amount: '0' },
      ]);
      await service.getConcentration({});
      expect(String(repoMock.query.mock.calls[0][0])).toContain('c.id::text = ci.case_id');
    });

    it('applies the barangay filter to the concentration query', async () => {
      repoMock.query.mockResolvedValue([
        { barangay: 'Bigte', cases: '6', interventions: '10', amount: '6000' },
        { barangay: 'Bigte', cases: '7', interventions: '8', amount: '4000' },
        { barangay: 'Bigte', cases: '8', interventions: '9', amount: '5000' },
      ]);
      await service.getConcentration({ barangay: 'Bigte' });
      const [sql, params] = repoMock.query.mock.calls[0];
      expect(String(sql)).toContain("($3::text IS NULL OR COALESCE(h.barangay, 'Unspecified') = $3)");
      expect(params).toEqual([null, null, 'Bigte']);
    });

    it('labels the HHI with the spec dispersion heuristic', async () => {
      repoMock.query.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ barangay: `B${i}`, cases: '10', interventions: '10', amount: '1000' })),
      );
      const dispersed = await service.getConcentration({});
      expect(dispersed.hhiCases).toBeCloseTo(0.1);
      expect(dispersed.hhiCasesLabel).toBe('dispersed');
      expect(dispersed.hhiAssistanceLabel).toBe('dispersed');

      repoMock.query.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ barangay: `B${i}`, cases: '20', interventions: '20', amount: '2000' })),
      );
      const moderate = await service.getConcentration({});
      expect(moderate.hhiCases).toBeCloseTo(0.2);
      expect(moderate.hhiCasesLabel).toBe('moderate');
      expect(moderate.hhiAssistanceLabel).toBe('moderate');
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

    it('casts the case join and matches 4Ps members with EXISTS instead of a role join', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', served_households: '8', assistance: '8000', four_ps: '6' },
          { barangay: 'Bigte', served_households: '2', assistance: '1000', four_ps: '1' },
        ])
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', households: '40' },
          { barangay: 'Bigte', households: '60' },
        ]);
      await service.getEquity({});
      const sql = String(repoMock.query.mock.calls[0][0]);
      expect(sql).toContain('c.id::text = ci.case_id');
      expect(sql).toContain('FROM beneficiary_roles br');
      expect(sql).toContain("ILIKE '%4ps%'");
      expect(sql).not.toContain('JOIN beneficiary_roles');
    });

    it('assigns coverage quartiles from the non-suppressed ratios in ascending order', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'A', served_households: '6', assistance: '600', four_ps: '0' },
          { barangay: 'B', served_households: '6', assistance: '600', four_ps: '0' },
          { barangay: 'C', served_households: '6', assistance: '600', four_ps: '0' },
          { barangay: 'D', served_households: '6', assistance: '600', four_ps: '0' },
          { barangay: 'E', served_households: '2', assistance: '100', four_ps: '0' },
        ])
        .mockResolvedValueOnce([
          { barangay: 'A', households: '48' },
          { barangay: 'B', households: '24' },
          { barangay: 'C', households: '16' },
          { barangay: 'D', households: '12' },
          { barangay: 'E', households: '60' },
        ]);
      const result = await service.getEquity({});
      const byName = (name: string) => result.barangays.find(b => b.barangay === name);
      // quartile = Math.min(3, Math.floor((rankIndex / n) * 4)) + 1 over ascending non-suppressed coverage ratios
      expect(byName('A')?.coverageQuartile).toEqual({ value: 1 });
      expect(byName('B')?.coverageQuartile).toEqual({ value: 2 });
      expect(byName('C')?.coverageQuartile).toEqual({ value: 3 });
      expect(byName('D')?.coverageQuartile).toEqual({ value: 4 });
      expect(byName('E')?.coverageQuartile).toEqual({ suppressed: true });
    });

    it('keeps zero-served barangays in the table with suppressed shares', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', served_households: '8', assistance: '8000', four_ps: '6' },
        ])
        .mockResolvedValueOnce([
          { barangay: 'Poblacion', households: '40' },
          { barangay: 'Bigte', households: '60' },
        ]);
      const result = await service.getEquity({});
      expect(result.barangays.map(b => b.barangay)).toEqual(['Poblacion', 'Bigte']);
      const bigte = result.barangays.find(b => b.barangay === 'Bigte');
      expect(bigte?.householdsShare).toEqual({ value: 0.6 });
      expect(bigte?.servedShare).toEqual({ suppressed: true });
      expect(bigte?.assistanceShare).toEqual({ suppressed: true });
      expect(bigte?.coverageRatio).toEqual({ suppressed: true });
      expect(bigte?.coverageQuartile).toEqual({ suppressed: true });
      expect(bigte?.fourPsShare).toEqual({ suppressed: true });
    });

    it('applies the barangay filter to both equity queries', async () => {
      repoMock.query
        .mockResolvedValueOnce([
          { barangay: 'Bigte', served_households: '8', assistance: '8000', four_ps: '6' },
        ])
        .mockResolvedValueOnce([{ barangay: 'Bigte', households: '60' }]);
      await service.getEquity({ barangay: 'Bigte' });
      const predicate = "($3::text IS NULL OR COALESCE(h.barangay, 'Unspecified') = $3)";
      expect(String(repoMock.query.mock.calls[0][0])).toContain(predicate);
      expect(repoMock.query.mock.calls[0][1]).toEqual([null, null, 'Bigte']);
      expect(String(repoMock.query.mock.calls[1][0])).toContain("($1::text IS NULL OR COALESCE(barangay, 'Unspecified') = $1)");
      expect(repoMock.query.mock.calls[1][1]).toEqual(['Bigte']);
    });
  });
});
