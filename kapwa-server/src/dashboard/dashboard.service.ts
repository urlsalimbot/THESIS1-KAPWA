import { RECENT_CASES_LIMIT, SLA_OVERDUE_DAYS } from './constants';
import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Intervention } from '../interventions/intervention.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { VersionVector } from '../sync/version-vector.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Intervention) private intRepo: Repository<Intervention>,
    @InjectRepository(Beneficiary) private benRepo: Repository<Beneficiary>,
    @InjectRepository(VersionVector) private versionVectorRepo: Repository<VersionVector>
  ) {}

  async getLastSync(): Promise<string> {
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
  }

  async getServedToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.intRepo.count({
      where: { serviceDate: today as any },
    });
  }

  async getMetrics(barangay?: string) {
    const caseQb = this.caseRepo.createQueryBuilder('c')
      .leftJoin('c.beneficiary', 'b');

    if (barangay) {
      caseQb.where('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
    }

    const totalCases = await caseQb.clone().getCount();
    const approved = await caseQb.clone()
      .andWhere('c.status = :status', { status: CaseStatus.APPROVED }).getCount();
    const disbursed = await caseQb.clone()
      .andWhere('c.status = :status', { status: CaseStatus.DISBURSED }).getCount();

    const { total: totalDisbursed } = await this.intRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.amount), 0)', 'total')
      .getRawOne() as { total: string };

    const benQb = this.benRepo.createQueryBuilder('b');
    if (barangay) {
      benQb.where('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentInterventions = await this.intRepo
      .createQueryBuilder('i')
      .where('i.logged_at > :date', { date: sevenDaysAgo })
      .getCount();

    return {
      totalCases,
      approvedCases: approved,
      disbursedCases: disbursed,
      totalDisbursedAmount: Number(totalDisbursed),
      uniqueHouseholds: Number(uniqueHouseholds),
      byStatus,
      recentInterventions,
    };
  }

  async getDailyTracker(date: Date) {
    const interventions = await this.intRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.case', 'c')
      .leftJoinAndSelect('c.beneficiary', 'b')
      .where('i.service_date = :date', { date })
      .getMany();

    return interventions.map(i => ({
      dailySeqNum: i.id,
      transactionDate: i.serviceDate,
      surname: i.case?.beneficiary?.surname || '',
      firstName: i.case?.beneficiary?.firstName || '',
      middleName: i.case?.beneficiary?.middleName || '',
      gender: i.case?.beneficiary?.gender || '',
      age: i.case?.beneficiary?.dob ? this.calcAge(i.case.beneficiary.dob) : 0,
      interventionType: i.interventionType,
      remarks: `${i.interventionType} - ${i.fundSource}`,
    }));
  }

  async getRecentCases(barangay?: string, page = 1, limit = RECENT_CASES_LIMIT) {
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiary', 'b')
      .orderBy('c.updated_at', 'DESC');

    if (barangay) {
      qb.andWhere('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
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
          '(SELECT b2.id FROM beneficiaries b2 WHERE b2.address ILIKE :barangay)',
          { barangay: `%${barangay}%` });
      }
      paginate(qb2, page, limit);
      const cases = await qb2.getMany();
      const benIds = cases.map(c => c.beneficiaryId).filter((id): id is string => !!id);
      if (benIds.length > 0) {
        const beneficiaries = await this.benRepo.find({ where: { id: In(benIds) } });
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
        statuses: [CaseStatus.PENDING, CaseStatus.IN_REVIEW],
      })
      .getCount();

    return {
      overdueCount: overdue,
      slaStatus: overdue > 0 ? 'violated' : 'compliant',
    };
  }

  async getTrends() {
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

      const casesCreated = await this.caseRepo.count({
        where: { createdAt: start as any },
      });
      const disbursedAmount = await this.intRepo
        .createQueryBuilder('i')
        .select('COALESCE(SUM(i.amount), 0)', 'total')
        .where('i.service_date >= :start AND i.service_date < :end', { start, end })
        .getRawOne();

      return {
        month: m.label,
        casesCreated,
        disbursed: Number((disbursedAmount as any)?.total || 0),
      };
    }));

    return results;
  }

  async getDailyCounts(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const interventions = await this.intRepo
      .createQueryBuilder('i')
      .select('i.service_date', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('i.service_date >= :start AND i.service_date < :end', { start, end })
      .groupBy('i.service_date')
      .orderBy('i.service_date', 'ASC')
      .getRawMany();

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
