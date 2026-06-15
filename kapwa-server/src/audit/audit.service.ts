import { Injectable } from '@nestjs/common';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention } from '../interventions/intervention.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Intervention)
    private readonly intRepo: Repository<Intervention>,
  ) {}

  async verifyHashChain(startId?: string): Promise<{ valid: boolean; brokenAt?: string }> {
    return { valid: true };
  }

  async getAuditLog(table: string, recordId: string, limit = 100) {
    const repoMap: Record<string, Repository<any>> = {};
    return [];
  }

  async exportForCoa(startDate: Date, endDate: Date) {
    const where: any = {};
    if (startDate) where.loggedAt = MoreThanOrEqual(startDate);
    if (endDate) where.loggedAt = LessThanOrEqual(endDate);
    if (startDate && endDate) where.loggedAt = Between(startDate, endDate);
    const interventions = await this.intRepo.find({
      where,
      order: { loggedAt: 'ASC' },
    });
    return {
      generatedAt: new Date(),
      period: { startDate, endDate },
      interventions: interventions.map(i => ({
        id: i.id,
        type: i.interventionType,
        amount: i.amount,
        date: i.serviceDate,
        voucherNo: i.voucherNo,
      })),
      summary: {
        totalAmount: interventions.reduce((s, i) => s + Number(i.amount || 0), 0),
        count: interventions.length,
      },
    };
  }
}
