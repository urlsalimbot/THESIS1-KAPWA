import { RECENT_CASES_LIMIT, SLA_OVERDUE_DAYS } from '../common/constants';
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

  /**
   * The first day (ISO yyyy-mm-dd) covered by a dashboard range, on the same
   * window basis `getTrends` buckets by: '1w' is the Monday of the current
   * calendar week, '1m' the first of the current month, '3m'/'6m' the first of
   * the month that starts the 3- or 6-month window. Shared with the metrics and
   * recent-cases filters so every date-derived number on the dashboard counts
   * from the same edge the trend chart draws.
   *
   * Open-ended callers: the selector was added with the existing endpoints in
   * mind, so `rangeToDate` and `getTrends` agree by construction — the cutoff is
   * the first bucket's start.
   */
  static rangeStart(range: string | undefined): string | undefined {
    const now = new Date();
    if (range === '1w') {
      // Monday-first calendar week, exactly as getTrends computes it.
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return monday.toISOString().slice(0, 10);
    }
    if (range === '1m') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    if (range === '3m') return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
    if (range === '6m') return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
    // Unknown or absent range: no cutoff, matching the endpoints' former
    // unfiltered behavior rather than guessing a window.
    return undefined;
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

      // byStatus must obey the same barangay scoping as the counts above:
      // the coordinator dashboard reads it directly (and derives pendingReview
      // from it), so an unscoped query leaks every barangay's status counts.
      const byStatusQb = this.caseRepo
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .leftJoin('c.beneficiary', 'b')
        .leftJoin('b.person', 'p')
        .groupBy('c.status');
      if (barangay) {
        byStatusQb.where('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
      }
      if (startDate) byStatusQb.andWhere('c.created_at >= :start', { start: `${startDate}T00:00:00Z` });
      if (endExclusive) byStatusQb.andWhere('c.created_at < :end', { end: `${endExclusive}T00:00:00Z` });
      const byStatus = await byStatusQb.getRawMany();

      // Real disbursement + recent-intervention numbers (were hardcoded 0).
      // The date window keeps its fixed $1/$2 slots (defaults are a no-op), so
      // the optional barangay scope can occupy $3 without shifting numbering.
      const intervParams: (string | null)[] = [startDate ?? '1970-01-01', endExclusive ?? '2999-12-31'];
      const barangayExists = barangay
        ? `AND EXISTS (
             SELECT 1 FROM cases c2
             JOIN beneficiaries b2 ON b2.id = c2.beneficiary_id
             JOIN persons p2 ON p2.id = b2.person_id
             WHERE c2.id::text = ci.case_id
               AND EXISTS (SELECT 1 FROM person_addresses pa2
                 WHERE pa2.person_id = p2.id AND (pa2.barangay ILIKE $3 OR pa2.raw ILIKE $3)))`
        : '';
      if (barangay) intervParams.push(`%${barangay}%`);
      const disbursed = await this.caseRepo.manager.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS interventions
         FROM case_interventions ci
         WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2 ${barangayExists}`,
        intervParams,
      );
      const totalDisbursed = Number(disbursed[0]?.total ?? 0);
      // Period-aware recent interventions: intersects the selected period with
      // the rolling 7-day window.
      const recentRows = await this.caseRepo.manager.query(
        `SELECT COUNT(*) AS count FROM case_interventions ci
         WHERE ci.delivery_date >= GREATEST(CURRENT_DATE - INTERVAL '7 days', $1::date)
           AND ci.delivery_date < $2::date ${barangayExists}`,
        intervParams,
      );
      const recentInterventions = Number(recentRows[0]?.count ?? 0);

      // Unique households with a case opened in the period (period-aware).
      const householdRows = await this.caseRepo.manager.query(
        `SELECT COUNT(DISTINCT b.household_id) AS count
         FROM cases c JOIN beneficiaries b ON b.id = c.beneficiary_id
         WHERE b.household_id IS NOT NULL
           AND c.created_at >= $1::timestamp AND c.created_at < $2::timestamp
           ${barangay ? `AND EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = b.person_id AND (pa2.barangay ILIKE $3 OR pa2.raw ILIKE $3))` : ''}`,
        intervParams,
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


  async getRecentCases(barangay?: string, page = 1, limit = RECENT_CASES_LIMIT, createdAfter?: string) {
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
    // The dashboard's range selector drives this; a case is "in range" when
    // filed within the window, on the same created_at basis the metrics use.
    if (createdAfter) {
      qb.andWhere('c.created_at >= :createdAfter', { createdAfter: `${createdAfter}T00:00:00Z` });
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
      if (createdAfter) {
        qb2.andWhere('c.created_at >= :createdAfter', { createdAfter: `${createdAfter}T00:00:00Z` });
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

  async getSlaCompliance(barangay?: string) {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - SLA_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .where('c.created_at < :date', { date: threeDaysAgo })
      .andWhere('c.status IN (:...statuses)', {
        statuses: [CaseStatus.ENROLLED, CaseStatus.ASSESSED, CaseStatus.IN_REVIEW],
      });
    // Coordinators see only their assigned barangay's overdue count.
    if (barangay) {
      qb.leftJoin('c.beneficiary', 'b')
        .leftJoin('b.person', 'p')
        .andWhere('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :slaBarangay OR pa2.raw ILIKE :slaBarangay))', { slaBarangay: `%${barangay}%` });
    }
    const overdue = await qb.getCount();

    return {
      overdueCount: overdue,
      slaStatus: overdue > 0 ? 'violated' : 'compliant',
    };
  }

  async getTrends(range = '6m') {
    const compute = async () => {
      const now = new Date();
      const buckets: { label: string; start: Date; end: Date }[] = [];

      const pushMonthly = (count: number) => {
        for (let i = count - 1; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          // Label with the 1st of each month so the window reads as whole
          // months (e.g. 3m = "Jul 1, Aug 1, Sep 1" → Jul 1–Sep 30).
          buckets.push({
            label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            start,
            end,
          });
        }
      };
      if (range === '1w') {
        // Current calendar week, Monday-first (Mon–Sun) — never a rolling
        // 7-day window.
        const diffToMonday = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        monday.setHours(0, 0, 0, 0);
        for (let i = 0; i < 7; i++) {
          const start = new Date(monday);
          start.setDate(monday.getDate() + i);
          const end = new Date(start);
          end.setDate(end.getDate() + 1);
          buckets.push({
            label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            start,
            end,
          });
        }
      } else if (range === '1m') {
        // Whole current calendar month (1st → last day), daily buckets — no
        // interloping dates across month boundaries.
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        for (let d = new Date(first); d.getTime() <= last.getTime(); d.setDate(d.getDate() + 1)) {
          const start = new Date(d);
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(end.getDate() + 1);
          buckets.push({
            label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            start,
            end,
          });
        }
      } else if (range === '3m') {
        pushMonthly(3);
      } else {
        pushMonthly(6);
      }

      const results = await Promise.all(buckets.map(async (b) => {
        const casesCreated = await this.caseRepo
          .createQueryBuilder('c')
          .where('c.created_at >= :start AND c.created_at < :end', { start: b.start, end: b.end })
          .getCount();
        const disbursedRows = await this.caseRepo.manager.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM case_interventions
           WHERE delivery_date >= $1 AND delivery_date < $2`,
          [b.start.toISOString().slice(0, 10), b.end.toISOString().slice(0, 10)],
        );
        return {
          month: b.label,
          casesCreated,
          transitioning: Number(disbursedRows[0]?.total ?? 0),
        };
      }));

      return results;
    };
    return this.cache ? this.cache.wrap(`dashboard:trends:${range}`, compute, 300_000) : compute();
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
