import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';
import { AccessCardsService } from '../access-cards/access-cards.service';

@Injectable()
export class CaseInterventionsService {
  constructor(
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
    @Inject(forwardRef(() => AccessCardsService))
    private accessCardsService: AccessCardsService,
  ) {}

  async findByCaseId(caseId: string) {
    return this.interventionRepo.find({
      where: { caseId },
      order: { deliveryDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(caseId: string, data: CreateCaseInterventionInput) {
    // RA 10173: a revoked consent blocks new service delivery against the
    // beneficiary's case — historical records stay, new interventions stop.
    const rows = await this.interventionRepo.manager.query(
      `SELECT cl.status FROM cases c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       LEFT JOIN consent_ledger cl ON cl.beneficiary_id = b.id
       WHERE c.id = $1 AND cl.purpose = 'registration'
       LIMIT 1`,
      [caseId],
    );
    if (rows[0]?.status === 'revoked') {
      throw new ForbiddenException('Beneficiary consent has been revoked — new interventions are not allowed');
    }

    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? undefined : v]),
    );
    const intervention = this.interventionRepo.create({ caseId, ...cleaned });
    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.accessCardsService.autoLogFromIntervention({
        caseId: saved.caseId,
        serviceName: saved.serviceName,
        deliveryDate: saved.deliveryDate,
        amount: saved.amount ? Number(saved.amount) : undefined,
      });
    } catch (e) {
      console.warn('Failed to auto-log intervention to access card:', e);
    }

    return saved;
  }

  async update(caseId: string, id: string, data: UpdateCaseInterventionInput) {
    const intervention = await this.interventionRepo.findOne({ where: { id, caseId } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    Object.assign(intervention, data);
    return this.interventionRepo.save(intervention);
  }

  async delete(caseId: string, id: string) {
    const intervention = await this.interventionRepo.findOne({ where: { id, caseId } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    await this.interventionRepo.remove(intervention);
  }
}
