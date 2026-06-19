import { HASH_CHAIN_BATCH_LIMIT, AUDIT_LOG_DEFAULT_LIMIT } from './constants';
import { Injectable } from '@nestjs/common';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention } from '../interventions/intervention.entity';
import { Case } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { FindOptionsWhere } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Intervention)
    private readonly intRepo: Repository<Intervention>,
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    @InjectRepository(Beneficiary)
    private readonly benRepo: Repository<Beneficiary>,
    @InjectRepository(ConsentLedger)
    private readonly consentRepo: Repository<ConsentLedger>,
  ) {}

  async verifyHashChain(
    repo: Repository<any>,
    orderField: string = 'createdAt',
  ): Promise<{ valid: boolean; brokenAt?: string }> {
    const records = await repo.find({ order: { [orderField]: 'ASC' } });
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      if (!curr.hash) continue;
      const expected = crypto.createHash('sha256')
        .update(JSON.stringify({ id: prev.id, hash: prev.hash }))
        .digest('hex');
      if (curr.hash !== expected) {
        return { valid: false, brokenAt: curr.id };
      }
    }
    return { valid: true };
  }

  async verifyAllChains(): Promise<{
    interventions: { valid: boolean; brokenAt?: string };
    cases: { valid: boolean; brokenAt?: string };
    beneficiaries: { valid: boolean; brokenAt?: string };
    consentLedger: { valid: boolean; brokenAt?: string };
  }> {
    const [int, cas, ben, con] = await Promise.all([
      this.verifyHashChain(this.intRepo),
      this.verifyHashChain(this.caseRepo),
      this.verifyHashChain(this.benRepo),
      this.verifyHashChain(this.consentRepo, 'grantedAt'),
    ]);
    return { interventions: int, cases: cas, beneficiaries: ben, consentLedger: con };
  }

  async verifyInterventionChain(startId?: string): Promise<{ valid: boolean; brokenAt?: string }> {
    const interventions = await this.intRepo.find({
      order: { loggedAt: 'ASC' },
      take: startId ? undefined : HASH_CHAIN_BATCH_LIMIT,
    });
    const startIdx = startId ? interventions.findIndex(i => i.id === startId) : 0;
    if (startIdx === -1) return { valid: false, brokenAt: startId || 'unknown' };
    for (let i = Math.max(startIdx, 1); i < interventions.length; i++) {
      const prev = interventions[i - 1];
      const curr = interventions[i];
      if (!curr.hash) continue;
      const expected = crypto.createHash('sha256')
        .update(JSON.stringify({ id: prev.id, type: prev.interventionType, amount: prev.amount, hash: prev.hash }))
        .digest('hex');
      if (curr.hash !== expected) {
        return { valid: false, brokenAt: curr.id };
      }
    }
    return { valid: true };
  }

  async getAuditLog(table: string, recordId: string, limit = AUDIT_LOG_DEFAULT_LIMIT) {
    const ints = await this.intRepo.find({
      where: { id: recordId } as any,
      order: { loggedAt: 'DESC' },
      take: limit,
    });
    return ints.map(i => ({
      table,
      recordId: i.id,
      action: 'INSERT',
      timestamp: i.loggedAt,
      data: { type: i.interventionType, amount: i.amount },
    }));
  }

  async exportForCoa(startDate: Date, endDate: Date) {
    const where: FindOptionsWhere<Intervention> = {};
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
