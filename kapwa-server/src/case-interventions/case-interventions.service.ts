import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';
import { AccessCardsService } from '../access-cards/access-cards.service';
import { isFinancialIntervention } from '../common/case-catalog';
import { roundMoney } from '../common/utils';

/**
 * A non-financial service renders no money — amount, mode of delivery and fund
 * source do not apply to it. Strip them on the way in (create and update), so
 * a client that renders them away can never still persist them.
 */
function stripFinancialFields<T extends { interventionType?: string | null; amount?: unknown; modeOfDelivery?: unknown; fundSource?: unknown }>(data: T): T {
  if (data.interventionType && !isFinancialIntervention(data.interventionType)) {
    return { ...data, amount: null, modeOfDelivery: null, fundSource: null };
  }
  // Centavo rounding at the boundary: the form accepts "1,234.567" and
  // numeric(12,2) then rounds it silently — better to store what was typed,
  // rounded once, than to have the books disagree with the receipt.
  return { ...data, amount: roundMoney(data.amount) };
}

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

  async create(caseId: string, data: CreateCaseInterventionInput, callerId?: string) {    // RA 10173: a revoked consent blocks new service delivery against the
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

    // An intervention is a service rendered under a program ASSIGNED to the
    // case: the enrollment is mandatory, and it has to be this case's row for
    // this program — otherwise the service rows under the wrong program.
    const enrollmentRows = await this.interventionRepo.manager.query(
      `SELECT program_id FROM program_enrollments WHERE id = $1 AND case_id = $2`,
      [data.programEnrollmentId, caseId],
    );
    if (enrollmentRows.length === 0) {
      throw new NotFoundException('Program enrollment not found on this case');
    }
    if (data.programId && enrollmentRows[0].program_id !== data.programId) {
      throw new ForbiddenException(
        'The enrollment belongs to a different program than the one named on the intervention',
      );
    }

    data = stripFinancialFields(data);
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? undefined : v]),
    );
    // callerId is optional for legacy call paths; achievements count rows by
    // created_by, and rows recorded without it count to nobody.
    const intervention = this.interventionRepo.create({ caseId, ...cleaned, createdBy: callerId });
    const saved = await this.interventionRepo.save(intervention);

    try {
      if (saved.caseId) {
        await this.accessCardsService.autoLogFromIntervention({
          caseId: saved.caseId,
          serviceName: saved.serviceName,
          deliveryDate: saved.deliveryDate,
          amount: saved.amount ? Number(saved.amount) : undefined,
        });
      }
    } catch (e) {
      console.warn('Failed to auto-log intervention to access card:', e);
    }

    return saved;
  }

  async update(caseId: string, id: string, data: UpdateCaseInterventionInput) {
    const intervention = await this.interventionRepo.findOne({ where: { id, caseId } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    Object.assign(intervention, stripFinancialFields(data));
    return this.interventionRepo.save(intervention);
  }

  async delete(caseId: string, id: string) {
    const intervention = await this.interventionRepo.findOne({ where: { id, caseId } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    await this.interventionRepo.remove(intervention);
  }
}
