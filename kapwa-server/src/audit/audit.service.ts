import { AUDIT_LOG_DEFAULT_LIMIT } from './constants';
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

  async getAuditLog(table?: string, recordId?: string, limit = AUDIT_LOG_DEFAULT_LIMIT) {
    // audit_log.action carries an entity prefix (e.g. 'case.create',
    // 'beneficiary.create', 'IRF_DECRYPT'), so match by prefix + record id.
    // Filters are optional — no table/recordId returns the whole trail.
    const where: string[] = [];
    const params: any[] = [];
    if (table) { params.push(`${table}%`); where.push(`al.action ILIKE $${params.length}`); }
    if (recordId) { params.push(recordId); where.push(`al.reference_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    return this.consentRepo.manager.query(
      `SELECT al.id, al.action, al.reference_id, al.user_id,
              al.details, al.created_at,
              u.email AS user_email,
              TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name,
                CASE WHEN u.name_extension IS NOT NULL AND u.name_extension <> '' THEN u.name_extension ELSE NULL END)) AS user_name
       FROM audit_log al
       LEFT JOIN users u ON u.id::text = al.user_id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
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
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    const interventions = await this.consentRepo.manager.query(
      `SELECT ci.service_name, ci.category, ci.delivery_date, ci.amount,
              ci.fund_source, ci.notes, ci.mode_of_delivery,
              c.control_no, p.surname, p.first_name
       FROM case_interventions ci
       LEFT JOIN cases c ON c.id = ci.case_id::uuid
       LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
       LEFT JOIN persons p ON p.id = b.person_id
       WHERE ci.delivery_date BETWEEN $1 AND $2
       ORDER BY ci.delivery_date`,
      [start, end],
    );
    const totalAmount = interventions.reduce(
      (sum: number, r: any) => sum + (Number(r.amount) || 0),
      0,
    );
    return {
      generatedAt: new Date(),
      period: { startDate, endDate },
      interventions,
      summary: { totalAmount, count: interventions.length },
    };
  }
}
