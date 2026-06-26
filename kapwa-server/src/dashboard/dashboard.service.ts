import { RECENT_CASES_LIMIT, SLA_OVERDUE_DAYS } from './constants';
import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from '../cases/case.entity';
import { Intervention } from '../interventions/intervention.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Case) private caseRepo: Repository<Case>,
    @InjectRepository(Intervention) private intRepo: Repository<Intervention>,
    @InjectRepository(Beneficiary) private benRepo: Repository<Beneficiary>
  ) {}

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
      qb.where('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
    }

    paginate(qb, page, limit);
    return qb.getMany();
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

  private calcAge(dob: Date): number {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
