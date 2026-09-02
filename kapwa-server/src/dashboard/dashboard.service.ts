import { RECENT_CASES_LIMIT, SLA_OVERDUE_DAYS } from './constants';
import { paginate } from '../common/constants';
import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { VersionVector } from '../sync/version-vector.entity';
import { CacheService } from '../common/cache.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Beneficiary) private benRepo: Repository<Beneficiary>,
    @InjectRepository(VersionVector) private versionVectorRepo: Repository<VersionVector>,
    @Optional() private cache?: CacheService,
  ) {}

  async getLastSync(): Promise<string> {
    if (!this.cache) return '';
    return this.cache.wrap('dashboard:lastSync', async () => {
      const result = await this.versionVectorRepo
        .createQueryBuilder('v')
        .select('MAX(v.lastSyncedAt)', 'last_sync')
        .getRawOne<{ last_sync: Date | null }>();
      if (!result?.last_sync) return 'Never';
      const diff = Date.now() - new Date(result.last_sync).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    }, 10_000);
  }

  async getServedToday(): Promise<number> {
    return 0;
  }

  invalidateCache(): void {
    this.cache?.invalidate('^dashboard:');
  }

  async getMetrics(barangay?: string, startDate?: string, endDate?: string) {
    const key = `dashboard:metrics:${barangay ?? 'all'}:${startDate ?? 'all'}:${endDate ?? 'all'}`;
    const compute = async () => {
      // End is inclusive; treat it as [start, end+1day).
      const endExclusive = endDate ? new Date(new Date(endDate).getTime() + 86_400_000).toISOString().slice(0, 10) : null;
      const caseQb = this.caseRepo.createQueryBuilder('c')
        .leftJoin('c.beneficiary', 'b')
        .leftJoin('b.person', 'p');

      if (barangay) {
        caseQb.where('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
      }
      if (startDate) {
        caseQb.andWhere('c.created_at >= :start', { start: `${startDate}T00:00:00Z` });
      }
      if (endExclusive) {
        caseQb.andWhere('c.created_at < :end', { end: `${endExclusive}T00:00:00Z` });
      }

      const totalCases = await caseQb.clone().getCount();
      const active = await caseQb.clone()
        .andWhere('c.status = :status', { status: CaseStatus.ACTIVE }).getCount();
      const transitioning = await caseQb.clone()
        .andWhere('c.status = :status', { status: CaseStatus.TRANSITIONING }).getCount();

      const byStatusQb = this.caseRepo
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.status');
      if (startDate) byStatusQb.andWhere('c.created_at >= :start', { start: `${startDate}T00:00:00Z` });
      if (endExclusive) byStatusQb.andWhere('c.created_at < :end', { end: `${endExclusive}T00:00:00Z` });
      const byStatus = await byStatusQb.getRawMany();

      // Real disbursement + recent-intervention numbers (were hardcoded 0).
      const intervWhere = startDate || endExclusive
        ? `WHERE delivery_date >= $1 AND delivery_date < $2`
        : '';
      const intervParams = startDate || endExclusive
        ? [startDate ?? '1970-01-01', endExclusive ?? '2999-12-31']
        : [];
      const disbursed = await this.caseRepo.manager.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS interventions
         FROM case_interventions ${intervWhere}`,
        intervParams,
      );
      const totalDisbursed = Number(disbursed[0]?.total ?? 0);
      // Period-aware recent interventions: intersects the selected period with
      // the rolling 7-day window.
      const recentRows = await this.caseRepo.manager.query(
        `SELECT COUNT(*) AS count FROM case_interventions
         WHERE delivery_date >= GREATEST(CURRENT_DATE - INTERVAL '7 days', $1::date)
           AND delivery_date < $2::date`,
        [startDate ?? '1970-01-01', endExclusive ?? '2999-12-31'],
      );
      const recentInterventions = Number(recentRows[0]?.count ?? 0);

      // Unique households with a case opened in the period (period-aware).
      const householdRows = await this.caseRepo.manager.query(
        `SELECT COUNT(DISTINCT b.household_id) AS count
         FROM cases c JOIN beneficiaries b ON b.id = c.beneficiary_id
         WHERE b.household_id IS NOT NULL
           AND c.created_at >= $1::timestamp AND c.created_at < $2::timestamp`,
        [startDate ? `${startDate}T00:00:00Z` : '1970-01-01T00:00:00Z',
         endExclusive ? `${endExclusive}T00:00:00Z` : '2999-12-31T00:00:00Z'],
      );
      const uniqueHouseholds = Number(householdRows[0]?.count ?? 0);

      return {
        totalCases,
        activeCases: active,
        transitioningCases: transitioning,
        totalDisbursedAmount: totalDisbursed,
        uniqueHouseholds: Number(uniqueHouseholds),
        byStatus,
        recentInterventions,
      };
    };
    return this.cache ? this.cache.wrap(key, compute, 30_000) : compute();
  }

  /**
   * Mayor's-report dimension breakdowns (aggregates only — zero PII):
   * interventions by program / fund source, demographics of served
   * beneficiaries (age bracket, gender, barangay, client category), and
   * inter-agency referrals by receiving agency.
   */
  async getReportBreakdowns(startDate?: string, endDate?: string) {
    const q = (sql: string, params: any[] = []) => this.caseRepo.manager.query(sql, params);
    const endExclusive = endDate ? new Date(new Date(endDate).getTime() + 86_400_000).toISOString().slice(0, 10) : null;
    const ivStart = startDate ?? '1970-01-01';
    const ivEnd = endExclusive ?? '2999-12-31';
    // Beneficiaries that actually received an intervention in the period.
    const servedBase = `FROM case_interventions ci
      JOIN cases c ON c.id::text = ci.case_id
      JOIN beneficiaries b ON b.id = c.beneficiary_id
      JOIN persons p ON p.id = b.person_id`;
    const ivFilter = `WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2`;

    const [beneficiariesServed, byProgram, byFundSource, byGender, byAgeBracket, byBarangay, byCategory, referrals] = await Promise.all([
      q(`SELECT COUNT(DISTINCT b.id) AS count ${servedBase} ${ivFilter}`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(pg.name, 'Unassigned') AS program,
           COUNT(DISTINCT c.beneficiary_id) AS beneficiaries,
           COUNT(ci.id) AS interventions,
           COALESCE(SUM(ci.amount), 0) AS amount
         FROM case_interventions ci
         LEFT JOIN cases c ON c.id::text = ci.case_id
         LEFT JOIN programs pg ON pg.id = ci.program_id
         WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2
         GROUP BY 1 ORDER BY amount DESC`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(ci.fund_source, 'Unspecified') AS fund_source,
           COUNT(*) AS interventions,
           COALESCE(SUM(ci.amount), 0) AS amount
         FROM case_interventions ci
         WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2
         GROUP BY 1 ORDER BY amount DESC`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(p.gender, 'Unspecified') AS gender, COUNT(DISTINCT p.id) AS count
         ${servedBase} ${ivFilter} GROUP BY 1 ORDER BY count DESC`, [ivStart, ivEnd]),
      q(`SELECT CASE
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) < 18 THEN '0-17'
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.dob)) <= 59 THEN '18-59'
             ELSE '60+' END AS bracket,
           COUNT(DISTINCT p.id) AS count
         ${servedBase} ${ivFilter} GROUP BY 1 ORDER BY count DESC`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(NULLIF(pa.barangay, ''), SPLIT_PART(pa.raw, ',', 1), 'Unspecified') AS barangay,
           COUNT(DISTINCT p.id) AS count
         ${servedBase}
         LEFT JOIN person_addresses pa ON pa.person_id = p.id AND pa.address_type = 'current'
         ${ivFilter} GROUP BY 1 ORDER BY count DESC`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(br.category, 'Uncategorized') AS category, COUNT(DISTINCT p.id) AS count
         ${servedBase}
         LEFT JOIN beneficiary_roles br ON br.person_id = p.id
         ${ivFilter} GROUP BY 1 ORDER BY count DESC`, [ivStart, ivEnd]),
      q(`SELECT COALESCE(a.name, 'Unspecified Agency') AS agency,
           COUNT(ir.id) AS total,
           COUNT(ir.id) FILTER (WHERE ir.status = 'referred') AS referred,
           COUNT(ir.id) FILTER (WHERE ir.status = 'accepted') AS accepted,
           COUNT(ir.id) FILTER (WHERE ir.status = 'declined') AS declined,
           COUNT(ir.id) FILTER (WHERE ir.status = 'completed') AS completed
         FROM inter_agency_referrals ir
         LEFT JOIN agencies a ON a.id = ir.to_agency_id
         WHERE ir.created_at >= $1 AND ir.created_at < $2
         GROUP BY 1 ORDER BY total DESC`,
        [`${ivStart}T00:00:00Z`, `${ivEnd}T00:00:00Z`]),
    ]);

    return {
      beneficiariesServed: Number(beneficiariesServed[0]?.count ?? 0),
      byProgram,
      byFundSource,
      byGender,
      byAgeBracket,
      byBarangay,
      byCategory,
      referrals,
    };
  }

  async getDailyTracker(_date: Date) {
    return [];
  }

  async getRecentCases(barangay?: string, page = 1, limit = RECENT_CASES_LIMIT) {
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiary', 'b')
      .leftJoinAndSelect('b.person', 'p')
      .leftJoinAndSelect('p.addresses', 'p_addresses')
      .leftJoinAndSelect('p.contacts', 'p_contacts')
      .orderBy('c.updated_at', 'DESC');

    if (barangay) {
      qb.andWhere('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
    }

    paginate(qb, page, limit);
    try {
      return await qb.getMany();
    } catch {
      // TypeORM relation column resolution can fail intermittently (GH#10421).
      // Fallback: load cases and beneficiaries separately.
      const qb2 = this.caseRepo
        .createQueryBuilder('c')
        .orderBy('c.updated_at', 'DESC');
      if (barangay) {
        qb2.where('c.beneficiary_id IN ' +
          '(SELECT b2.id FROM beneficiaries b2 JOIN persons b2p ON b2p.id = b2.person_id ' +
          'WHERE EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = b2p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay)))',
          { barangay: `%${barangay}%` });
      }
      paginate(qb2, page, limit);
      const cases = await qb2.getMany();
      const benIds = cases.map(c => c.beneficiaryId).filter((id): id is string => !!id);
      if (benIds.length > 0) {
        const beneficiaries = await this.benRepo.find({ where: { id: In(benIds) }, relations: ['person'] });
        const benMap = new Map(beneficiaries.map(b => [b.id, b]));
        for (const c of cases) {
          if (c.beneficiaryId) (c as any).beneficiary = benMap.get(c.beneficiaryId);
        }
      }
      return cases;
    }
  }

  async getSlaCompliance() {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - SLA_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
    const overdue = await this.caseRepo
      .createQueryBuilder('c')
      .where('c.created_at < :date', { date: threeDaysAgo })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [CaseStatus.ENROLLED, CaseStatus.ASSESSED, CaseStatus.IN_REVIEW],
      })
      .getCount();

    return {
      overdueCount: overdue,
      slaStatus: overdue > 0 ? 'violated' : 'compliant',
    };
  }

  async getTrends() {
    const compute = async () => {
      const months: { label: string; offset: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months.push({ label, offset: i });
      }

      const results = await Promise.all(months.map(async (m) => {
        const start = new Date();
        start.setMonth(start.getMonth() - m.offset);
        start.setDate(1); start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const casesCreated = await this.caseRepo
          .createQueryBuilder('c')
          .where('c.created_at >= :start AND c.created_at < :end', { start, end })
          .getCount();
        // Real monthly disbursement from case_interventions (was hardcoded 0).
        const disbursedRows = await this.caseRepo.manager.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM case_interventions
           WHERE delivery_date >= $1 AND delivery_date < $2`,
          [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
        );
        const disbursedAmount = Number(disbursedRows[0]?.total ?? 0);

        return {
          month: m.label,
          casesCreated,
          transitioning: disbursedAmount,
        };
      }));

      return results;
    };
    return this.cache ? this.cache.wrap('dashboard:trends', compute, 300_000) : compute();
  }

  async getDailyCounts(year: number, month: number) {
    const key = `dashboard:dailyCounts:${year}-${month}`;
    const compute = async () => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);

      const interventions: any[] = [];

      const casesCreated = await this.caseRepo
        .createQueryBuilder('c')
        .select('c.created_at', 'date')
        .addSelect('COUNT(*)', 'count')
        .where('c.created_at >= :start AND c.created_at < :end', { start, end })
        .groupBy('c.created_at')
        .orderBy('c.created_at', 'ASC')
        .getRawMany();

      const dayMap: Record<string, { interventions: number; cases: number }> = {};
      for (const row of interventions) {
        const d = new Date(row.date).toISOString().slice(0, 10);
        if (!dayMap[d]) dayMap[d] = { interventions: 0, cases: 0 };
        dayMap[d].interventions += Number(row.count);
      }
      for (const row of casesCreated) {
        const d = new Date(row.date).toISOString().slice(0, 10);
        if (!dayMap[d]) dayMap[d] = { interventions: 0, cases: 0 };
        dayMap[d].cases += Number(row.count);
      }

      return dayMap;
    };
    return this.cache ? this.cache.wrap(key, compute, 120_000) : compute();
  }

  private calcAge(dob: Date): number {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
