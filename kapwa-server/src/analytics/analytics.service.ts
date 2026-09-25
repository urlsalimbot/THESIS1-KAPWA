import { Injectable, Optional, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { CacheService } from '../common/cache.service';
import { hhi } from './models/stats';
import { complementSuppression, MIN_CELL, suppressCount, suppressRatio, Suppressed } from './suppression';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  barangay?: string;
}

const AGE_BRACKETS: Array<{ bracket: string; min: number; max: number }> = [
  { bracket: '0-5', min: 0, max: 5 },
  { bracket: '6-12', min: 6, max: 12 },
  { bracket: '13-17', min: 13, max: 17 },
  { bracket: '18-24', min: 18, max: 24 },
  { bracket: '25-34', min: 25, max: 34 },
  { bracket: '35-44', min: 35, max: 44 },
  { bracket: '45-59', min: 45, max: 59 },
  { bracket: '60+', min: 60, max: 200 },
];

const INCOME_BANDS: Array<{ label: string; test: (v: number | null) => boolean }> = [
  { label: '<5k', test: v => v != null && v < 5000 },
  { label: '5-10k', test: v => v != null && v >= 5000 && v < 10000 },
  { label: '10-20k', test: v => v != null && v >= 10000 && v < 20000 },
  { label: '20-40k', test: v => v != null && v >= 20000 && v < 40000 },
  { label: '>=40k', test: v => v != null && v >= 40000 },
  { label: 'Unspecified', test: v => v == null },
];

export type HhiLabel = 'dispersed' | 'moderate' | 'concentrated';

// Spec §5.4 heuristic: <0.15 dispersed, 0.15–0.25 moderate, >0.25 concentrated.
export function hhiLabel(value: number): HhiLabel {
  if (value < 0.15) return 'dispersed';
  if (value <= 0.25) return 'moderate';
  return 'concentrated';
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @Optional() private cache?: CacheService,
  ) {}

  async getDemographics(filters: AnalyticsFilters) {
    const compute = () => this.computeDemographics(filters);
    return this.cache?.wrap(`analytics:demographics:${JSON.stringify(filters)}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeDemographics(filters: AnalyticsFilters) {
    const rows: Array<{
      person_id: string; gender: string | null; age: number | null; civil_status: string | null; occupation: string | null;
      has_philhealth: boolean; household_income: string | null; household_id: string | null; barangay: string | null;
    }> = await this.caseRepo.query(
      `SELECT p.id AS person_id, p.gender, EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob))::int AS age,
              p.civil_status, p.occupation,
              (p.philhealth_number IS NOT NULL AND p.philhealth_number <> '') AS has_philhealth,
              ph.estimated_income AS household_income, b.household_id, ph.barangay
       FROM persons p
       JOIN beneficiaries b ON b.person_id = p.id
       LEFT JOIN households ph ON ph.id = b.household_id
       WHERE (($1::date IS NULL AND $2::date IS NULL)
              OR EXISTS (
                SELECT 1 FROM cases c
                JOIN case_interventions ci ON ci.case_id = c.id::text
                WHERE c.beneficiary_id = b.id
                  AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
                  AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
              ))
         AND ($3::text IS NULL OR ph.barangay = $3)`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );

    const dedupedPersons = new Map<string, (typeof rows)[number]>();
    (rows ?? []).forEach(r => {
      if (!dedupedPersons.has(r.person_id)) dedupedPersons.set(r.person_id, r);
    });
    const persons = [...dedupedPersons.values()];
    const personCount = (n: number): Suppressed<number> => suppressCount(n);

    // Each count family is suppressed and then complementarily suppressed
    // before mapping to rows, so a published total cannot isolate one cell.
    const bracketPersons = AGE_BRACKETS.map(({ min, max }) =>
      persons.filter(p => p.age != null && p.age >= min && p.age <= max),
    );
    const maleCells = complementSuppression(
      bracketPersons.map(inBracket => personCount(inBracket.filter(p => p.gender === 'Male').length)),
    );
    const femaleCells = complementSuppression(
      bracketPersons.map(inBracket => personCount(inBracket.filter(p => p.gender === 'Female').length)),
    );
    const ageSex = AGE_BRACKETS.map(({ bracket }, i) => ({ bracket, male: maleCells[i], female: femaleCells[i] }));

    const civilStatuses = [...new Set(persons.map(p => p.civil_status || 'Unspecified'))];
    const civilStatusCells = complementSuppression(
      civilStatuses.map(label => personCount(persons.filter(p => (p.civil_status || 'Unspecified') === label).length)),
    );
    const civilStatus = civilStatuses
      .map((label, i) => ({ label, count: civilStatusCells[i] }))
      .sort((a, b) => ('value' in b.count ? b.count.value : 0) - ('value' in a.count ? a.count.value : 0));

    const occupationCounts = new Map<string, number>();
    persons.forEach(p => {
      const key = p.occupation && p.occupation.trim() ? p.occupation.trim() : 'Unspecified';
      occupationCounts.set(key, (occupationCounts.get(key) ?? 0) + 1);
    });
    const occupation = [...occupationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .filter(([, count]) => count >= 5)
      .map(([label, count]) => ({ label, count: suppressCount(count) }));

    const incomeBandCells = complementSuppression(
      INCOME_BANDS.map(band =>
        personCount(persons.filter(p => band.test(p.household_income != null ? Number(p.household_income) : null)).length),
      ),
    );
    const incomeBands = INCOME_BANDS.map((band, i) => ({ label: band.label, count: incomeBandCells[i] }));

    const householdMembers = new Map<string, number>();
    persons.forEach(p => {
      if (p.household_id) householdMembers.set(p.household_id, (householdMembers.get(p.household_id) ?? 0) + 1);
    });
    const householdSizeCells = complementSuppression(
      Array.from({ length: 8 }, (_, i) => personCount([...householdMembers.values()].filter(n => Math.min(n, 8) === i + 1).length)),
    );
    const householdSize = Array.from({ length: 8 }, (_, i) => ({
      label: i + 1 === 8 ? '8+' : String(i + 1),
      count: householdSizeCells[i],
    }));

    const ages = persons.map(p => p.age).filter((a): a is number => a != null);
    const dependents = ages.filter(a => a <= 14 || a >= 60).length;
    const working = ages.filter(a => a >= 15 && a <= 59).length;
    const dependencyRatio = persons.length >= MIN_CELL && dependents >= MIN_CELL && working >= MIN_CELL
      ? dependents / working
      : null;

    const covered = persons.filter(p => p.has_philhealth).length;
    const philhealthCoverage = persons.length >= MIN_CELL && covered >= MIN_CELL
      ? { value: covered / persons.length }
      : { suppressed: true as const };

    return {
      summary: {
        personsServed: personCount(persons.length),
        householdsCovered: personCount(new Set(persons.map(p => p.household_id).filter(Boolean)).size),
        barangaysCovered: personCount(new Set(persons.map(p => p.barangay).filter(Boolean)).size),
      },
      ageSex,
      civilStatus,
      occupation,
      incomeBands,
      householdSize,
      dependencyRatio,
      philhealthCoverage,
    };
  }

  async getConcentration(filters: AnalyticsFilters) {
    const compute = () => this.computeConcentration(filters);
    return this.cache?.wrap(`analytics:concentration:${JSON.stringify(filters)}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeConcentration(filters: AnalyticsFilters) {
    const rows: Array<{ barangay: string; cases: string; interventions: string; amount: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT c.id) AS cases,
                COUNT(ci.id) AS interventions,
                COALESCE(SUM(ci.amount), 0) AS amount
         FROM case_interventions ci
         JOIN cases c ON c.id::text = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
           AND ($3::text IS NULL OR COALESCE(h.barangay, 'Unspecified') = $3)
         GROUP BY 1
         ORDER BY cases DESC`,
        [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
      );
    const barangays = (rows ?? []).filter(r => Number(r.cases) > 0 || Number(r.interventions) > 0);
    const minBarangays = filters.barangay ? 1 : 3;
    if (barangays.length < minBarangays) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: minBarangays, actual: barangays.length });
    }
    const totalCases = barangays.reduce((acc, r) => acc + Number(r.cases), 0);
    const totalAmount = barangays.reduce((acc, r) => acc + Number(r.amount), 0);
    const caseShares = barangays.map(r => (totalCases > 0 ? Number(r.cases) / totalCases : 0));
    const amountShares = barangays.map(r => (totalAmount > 0 ? Number(r.amount) / totalAmount : 0));
    const caseCells = complementSuppression(barangays.map(r => suppressCount(Number(r.cases))));
    const amountCells = complementSuppression(barangays.map(r => suppressCount(Math.round(Number(r.amount)))));
    // Any suppressed cell makes the family total invertible, so the HHI (a
    // function of every share) must not be published either. A barangay-filtered
    // response has a single row whose HHI would always be 1, so it is null too.
    const singleBarangay = Boolean(filters.barangay);
    const hhiCases = singleBarangay || caseCells.some(cell => 'suppressed' in cell) ? null : hhi(caseShares);
    const hhiAssistance = singleBarangay || amountCells.some(cell => 'suppressed' in cell) ? null : hhi(amountShares);
    return {
      hhiCases,
      hhiCasesLabel: hhiCases == null ? null : hhiLabel(hhiCases),
      hhiAssistance,
      hhiAssistanceLabel: hhiAssistance == null ? null : hhiLabel(hhiAssistance),
      totalCases,
      totalAmount,
      barangays: barangays.map((r, i) => ({
        barangay: r.barangay,
        cases: caseCells[i],
        interventions: suppressCount(Number(r.interventions)),
        amount: amountCells[i],
        caseShare: 'suppressed' in caseCells[i] ? { suppressed: true as const } : suppressRatio(caseShares[i], Number(r.cases)),
        amountShare: 'suppressed' in amountCells[i] ? { suppressed: true as const } : suppressRatio(amountShares[i], Number(r.cases)),
      })),
    };
  }

  async getEquity(filters: AnalyticsFilters) {
    const compute = () => this.computeEquity(filters);
    return this.cache?.wrap(`analytics:equity:${JSON.stringify(filters)}`, compute, 5 * 60 * 1000) ?? compute();
  }

  private async computeEquity(filters: AnalyticsFilters) {
    const served: Array<{ barangay: string; served_households: string; assistance: string; four_ps: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT b.household_id) AS served_households,
                COALESCE(SUM(ci.amount), 0) AS assistance,
                COUNT(DISTINCT b.household_id) FILTER (WHERE EXISTS (
                  SELECT 1 FROM beneficiary_roles br
                  WHERE br.person_id = b.person_id AND br.category ILIKE '%4ps%'
                )) AS four_ps
         FROM case_interventions ci
         JOIN cases c ON c.id::text = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
           AND ($3::text IS NULL OR COALESCE(h.barangay, 'Unspecified') = $3)
         GROUP BY 1`,
        [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
      );
    const householdRows: Array<{ barangay: string; households: string }> = await this.caseRepo.query(
      `SELECT COALESCE(barangay, 'Unspecified') AS barangay, COUNT(*) AS households
       FROM households
       WHERE ($1::text IS NULL OR COALESCE(barangay, 'Unspecified') = $1)
       GROUP BY 1`,
      [filters.barangay ?? null],
    );

    const totalServed = (served ?? []).reduce((acc, r) => acc + Number(r.served_households), 0);
    const totalAssistance = (served ?? []).reduce((acc, r) => acc + Number(r.assistance), 0);
    const totalHouseholds = (householdRows ?? []).reduce((acc, r) => acc + Number(r.households), 0);
    const servedByBarangay = new Map((served ?? []).map(r => [r.barangay, r]));

    // Rows are driven by every barangay in the household universe, so barangays
    // with no served households in range still appear (with suppressed ratios)
    // instead of silently vanishing from the table.
    const equityRows = (householdRows ?? []).map(h => {
      const r = servedByBarangay.get(h.barangay)
        ?? { barangay: h.barangay, served_households: '0', assistance: '0', four_ps: '0' };
      const households = Number(h.households);
      const servedCount = Number(r.served_households);
      const householdsShare = totalHouseholds > 0 ? households / totalHouseholds : 0;
      const servedShare = totalServed > 0 ? servedCount / totalServed : 0;
      return {
        r,
        households,
        servedCount,
        householdsShare,
        servedShare,
        coverageRatio: householdsShare > 0 ? suppressRatio(servedShare / householdsShare, servedCount) : { suppressed: true as const },
      };
    });
    const coverageRatios = equityRows
      .map(row => ('value' in row.coverageRatio ? row.coverageRatio.value : null))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    // quartile = Math.min(3, Math.floor((rankIndex / n) * 4)) + 1; ties share the lowest rank index
    const quartileFor = (ratio: number) =>
      Math.min(3, Math.floor((coverageRatios.indexOf(ratio) / coverageRatios.length) * 4)) + 1;
    const barangays = equityRows.map(row => ({
      barangay: row.r.barangay,
      householdsShare: suppressRatio(row.householdsShare, row.households),
      servedShare: suppressRatio(row.servedShare, row.servedCount),
      assistanceShare: suppressRatio(totalAssistance > 0 ? Number(row.r.assistance) / totalAssistance : 0, row.servedCount),
      coverageRatio: row.coverageRatio,
      coverageQuartile: 'value' in row.coverageRatio ? { value: quartileFor(row.coverageRatio.value) } : { suppressed: true as const },
      fourPsShare: suppressRatio(row.households > 0 ? Number(row.r.four_ps) / row.households : 0, Number(row.r.four_ps)),
    }));
    return { barangays };
  }
}
