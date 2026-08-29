import { RECENT_CASES_LIMIT, SLA_OVERDUE_DAYS } from './constants';
import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
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

  async getMetrics(barangay?: string) {
    const key = `dashboard:metrics:${barangay ?? 'all'}`;
    const compute = async () => {
      const caseQb = this.caseRepo.createQueryBuilder('c')
        .leftJoin('c.beneficiary', 'b')
        .leftJoin('b.person', 'p');

      if (barangay) {
        caseQb.where('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
      }

      const totalCases = await caseQb.clone().getCount();
      const active = await caseQb.clone()
        .andWhere('c.status = :status', { status: CaseStatus.ACTIVE }).getCount();
      const transitioning = await caseQb.clone()
        .andWhere('c.status = :status', { status: CaseStatus.TRANSITIONING }).getCount();

      const totalDisbursed = 0;

      const benQb = this.benRepo.createQueryBuilder('b')
        .leftJoin('b.person', 'p');
      if (barangay) {
        benQb.where('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
      }
      const { count: uniqueHouseholds } = await benQb
        .select('COUNT(DISTINCT b.household_id)', 'count')
        .getRawOne() as { count: string };

      const byStatus = await this.caseRepo
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.status')
        .getRawMany();

      const recentInterventions = 0;

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

  async getDailyTracker(_date: Date) {
    return [];
  }

  async getRecentCases(barangay?: string, page = 1, limit = RECENT_CASES_LIMIT) {
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiary', 'b')
      .leftJoinAndSelect('b.person', 'p')
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
        const disbursedAmount = { total: '0' };

        return {
          month: m.label,
          casesCreated,
          transitioning: Number((disbursedAmount as any)?.total || 0),
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
