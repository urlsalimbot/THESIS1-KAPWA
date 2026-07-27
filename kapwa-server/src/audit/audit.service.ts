import { HASH_CHAIN_BATCH_LIMIT, AUDIT_LOG_DEFAULT_LIMIT } from './constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import * as crypto from 'crypto';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    @InjectRepository(Beneficiary)
    private readonly benRepo: Repository<Beneficiary>,
    @InjectRepository(ConsentLedger)
    private readonly consentRepo: Repository<ConsentLedger>,
    private cache: CacheService,
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
    cases: { valid: boolean; brokenAt?: string };
    beneficiaries: { valid: boolean; brokenAt?: string };
    consentLedger: { valid: boolean; brokenAt?: string };
  }> {
    return this.cache.wrap('audit:verifyAllChains', async () => {
      const [cas, ben, con] = await Promise.all([
        this.verifyHashChain(this.caseRepo, 'createdAt'),
        this.verifyHashChain(this.benRepo, 'createdAt'),
        this.verifyHashChain(this.consentRepo, 'grantedAt'),
      ]);
      return { cases: cas, beneficiaries: ben, consentLedger: con };
    }, 60_000);
  }

  async getAuditLog(table: string, recordId: string, limit = AUDIT_LOG_DEFAULT_LIMIT) {
    return [];
  }

  async getConsentLedger(beneficiaryId?: string, limit = 50) {
    const where: any = {};
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    return this.consentRepo.find({
      where,
      order: { grantedAt: 'DESC' },
      take: limit,
    });
  }

  async exportForCoa(startDate: Date, endDate: Date) {
    return {
      generatedAt: new Date(),
      period: { startDate, endDate },
      interventions: [],
      summary: { totalAmount: 0, count: 0 },
    };
  }
}
