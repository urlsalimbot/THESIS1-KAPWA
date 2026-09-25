import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { hhi } from './models/stats';
import { suppressCount, suppressRatio, Suppressed } from './suppression';

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

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}

  async getDemographics(filters: AnalyticsFilters) {
    const rows: Array<{
      gender: string | null; age: number | null; civil_status: string | null; occupation: string | null;
      has_philhealth: boolean; household_income: string | null; household_id: string | null; barangay: string | null;
    }> = await this.caseRepo.query(
      `SELECT p.gender, EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob))::int AS age,
              p.civil_status, p.occupation,
              (p.philhealth_number IS NOT NULL AND p.philhealth_number <> '') AS has_philhealth,
              ph.estimated_income AS household_income, b.household_id, ph.barangay
       FROM persons p
       JOIN beneficiaries b ON b.person_id = p.id
       LEFT JOIN households ph ON ph.id = b.household_id
       WHERE (($1::date IS NULL AND $2::date IS NULL)
              OR EXISTS (
                SELECT 1 FROM cases c
                JOIN case_interventions ci ON ci.case_id = c.id
                WHERE c.beneficiary_id = b.id
                  AND ($1::date IS NULL OR ci.delivery_date >= $1::date)
                  AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
              ))
         AND ($3::text IS NULL OR ph.barangay = $3)`,
      [filters.from ?? null, filters.to ?? null, filters.barangay ?? null],
    );

    const persons = rows ?? [];
    const personCount = (n: number): Suppressed<number> => suppressCount(n);

    const ageSex = AGE_BRACKETS.map(({ bracket, min, max }) => {
      const inBracket = persons.filter(p => p.age != null && p.age >= min && p.age <= max);
      return {
        bracket,
        male: personCount(inBracket.filter(p => p.gender === 'Male').length),
        female: personCount(inBracket.filter(p => p.gender === 'Female').length),
      };
    });

    const civilStatuses = [...new Set(persons.map(p => p.civil_status || 'Unspecified'))];
    const civilStatus = civilStatuses
      .map(label => ({ label, count: personCount(persons.filter(p => (p.civil_status || 'Unspecified') === label).length) }))
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

    const incomeBands = INCOME_BANDS.map(band => ({
      label: band.label,
      count: personCount(persons.filter(p => band.test(p.household_income != null ? Number(p.household_income) : null)).length),
    }));

    const ages = persons.map(p => p.age).filter((a): a is number => a != null);
    const dependents = ages.filter(a => a <= 14 || a >= 60).length;
    const working = ages.filter(a => a >= 15 && a <= 59).length;
    const dependencyRatio = working > 0 ? dependents / working : null;

    const covered = persons.filter(p => p.has_philhealth).length;
    const philhealthCoverage = persons.length >= 5 ? { value: covered / persons.length } : { suppressed: true as const };

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
      dependencyRatio,
      philhealthCoverage,
    };
  }

  async getConcentration(filters: AnalyticsFilters) {
    const rows: Array<{ barangay: string; cases: string; interventions: string; amount: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT c.id) AS cases,
                COUNT(ci.id) AS interventions,
                COALESCE(SUM(ci.amount), 0) AS amount
         FROM case_interventions ci
         JOIN cases c ON c.id = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         GROUP BY 1
         ORDER BY cases DESC`,
        [filters.from ?? null, filters.to ?? null],
      );
    const barangays = (rows ?? []).filter(r => Number(r.cases) > 0 || Number(r.interventions) > 0);
    if (barangays.length < 3) {
      throw new UnprocessableEntityException({ code: 'insufficient_data', required: 3, actual: barangays.length });
    }
    const totalCases = barangays.reduce((acc, r) => acc + Number(r.cases), 0);
    const totalAmount = barangays.reduce((acc, r) => acc + Number(r.amount), 0);
    const caseShares = barangays.map(r => (totalCases > 0 ? Number(r.cases) / totalCases : 0));
    const amountShares = barangays.map(r => (totalAmount > 0 ? Number(r.amount) / totalAmount : 0));
    return {
      hhiCases: hhi(caseShares),
      hhiAssistance: hhi(amountShares),
      totalCases,
      totalAmount,
      barangays: barangays.map((r, i) => ({
        barangay: r.barangay,
        cases: suppressCount(Number(r.cases)),
        interventions: suppressCount(Number(r.interventions)),
        amount: suppressCount(Math.round(Number(r.amount))),
        caseShare: suppressRatio(caseShares[i], Number(r.cases)),
        amountShare: suppressRatio(amountShares[i], Number(r.cases)),
      })),
    };
  }

  async getEquity(filters: AnalyticsFilters) {
    const served: Array<{ barangay: string; served_households: string; assistance: string; four_ps: string }> =
      await this.caseRepo.query(
        `SELECT COALESCE(h.barangay, 'Unspecified') AS barangay,
                COUNT(DISTINCT b.household_id) AS served_households,
                COALESCE(SUM(ci.amount), 0) AS assistance,
                COUNT(DISTINCT b.household_id) FILTER (WHERE br.category = '4Ps') AS four_ps
         FROM case_interventions ci
         JOIN cases c ON c.id = ci.case_id
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN households h ON h.id = b.household_id
         LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id
         WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
           AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
         GROUP BY 1`,
        [filters.from ?? null, filters.to ?? null],
      );
    const householdRows: Array<{ barangay: string; households: string }> = await this.caseRepo.query(
      `SELECT COALESCE(barangay, 'Unspecified') AS barangay, COUNT(*) AS households
       FROM households GROUP BY 1`,
    );

    const totalServed = (served ?? []).reduce((acc, r) => acc + Number(r.served_households), 0);
    const totalAssistance = (served ?? []).reduce((acc, r) => acc + Number(r.assistance), 0);
    const totalHouseholds = (householdRows ?? []).reduce((acc, r) => acc + Number(r.households), 0);
    const householdsByBarangay = new Map((householdRows ?? []).map(r => [r.barangay, Number(r.households)]));

    const barangays = (served ?? []).map(r => {
      const households = householdsByBarangay.get(r.barangay) ?? 0;
      const servedCount = Number(r.served_households);
      const householdsShare = totalHouseholds > 0 ? households / totalHouseholds : 0;
      const servedShare = totalServed > 0 ? servedCount / totalServed : 0;
      return {
        barangay: r.barangay,
        householdsShare: suppressRatio(householdsShare, households),
        servedShare: suppressRatio(servedShare, servedCount),
        assistanceShare: suppressRatio(totalAssistance > 0 ? Number(r.assistance) / totalAssistance : 0, servedCount),
        coverageRatio: householdsShare > 0 ? suppressRatio(servedShare / householdsShare, servedCount) : { suppressed: true as const },
        fourPsShare: suppressRatio(households > 0 ? Number(r.four_ps) / households : 0, Number(r.four_ps)),
      };
    });
    return { barangays };
  }
}
