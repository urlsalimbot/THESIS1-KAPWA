import { Injectable, NotFoundException, ForbiddenException, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { ProgramIntervention } from '../programs/program-intervention.entity';
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
    @InjectRepository(ProgramIntervention)
    private matrixRepo: Repository<ProgramIntervention>,
    @Inject(forwardRef(() => AccessCardsService))
    private accessCardsService: AccessCardsService,
  ) {}

  /**
   * The typed service must be a row of the enrolled program's matrix — the
   * logging UI offers only these rows, and the API must not accept a code the
   * program does not render (audit 3.2.6: any catalog code used to be logged
   * against any program, dragging that code's document minimums into the gate).
   * Returns the row's required-form obligation, which is persisted on the
   * intervention (audit 3.2.4).
   */
  private async matrixObligation(programId: string, interventionType: string): Promise<string | null> {
    const row = await this.matrixRepo.findOne({ where: { programId, interventionType } });
    if (!row) {
      throw new BadRequestException(
        `"${interventionType}" is not a service the enrolled program renders — pick one from the program's matrix.`,
      );
    }
    return row.requiredForm ?? null;
  }

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
    // Member of the program's matrix, and its form obligation on the row.
    const requiredForm = data.interventionType
      ? await this.matrixObligation(enrollmentRows[0].program_id, data.interventionType)
      : null;

    data = stripFinancialFields(data);
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? undefined : v]),
    );
    // callerId is optional for legacy call paths; achievements count rows by
    // created_by, and rows recorded without it count to nobody.
    const intervention = this.interventionRepo.create({ caseId, ...cleaned, requiredForm, createdBy: callerId });
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
    const next = stripFinancialFields(data);
    // The anchor fields (enrollment / program / type) must pass the same
    // membership checks as create when any of them moves — the update path used
    // to validate nothing, so an enrollment could be retargeted to another
    // case's row (audit 3.2.6). The obligation follows the type.
    const touchedAnchor = next.programEnrollmentId !== undefined
      || next.programId !== undefined
      || next.interventionType !== undefined;
    if (touchedAnchor) {
      const pushedEnrollment = (next.programEnrollmentId ?? intervention.programEnrollmentId) as string | undefined;
      const pushedType = next.interventionType !== undefined ? next.interventionType : intervention.interventionType;
      // The matrix is resolved from the enrollment's program when one is on
      // file; a legacy row with no enrollment falls back to its own programId
      // (and with neither, there is no matrix to consult — the form is simply
      // not derivable and no membership check applies).
      let programIdForMatrix: string | null = null;
      if (pushedEnrollment) {
        const rows = await this.interventionRepo.manager.query(
          `SELECT program_id FROM program_enrollments WHERE id = $1 AND case_id = $2`,
          [pushedEnrollment, caseId],
        );
        if (rows.length === 0) {
          throw new NotFoundException('Program enrollment not found on this case');
        }
        programIdForMatrix = rows[0].program_id;
        const pushedProgram = (next.programId ?? intervention.programId) as string | undefined;
        if (pushedProgram && rows[0].program_id !== pushedProgram) {
          throw new ForbiddenException(
            'The enrollment belongs to a different program than the one named on the intervention',
          );
        }
      } else {
        programIdForMatrix = (next.programId ?? intervention.programId) as string | null;
      }
      Object.assign(intervention, next, {
        requiredForm: pushedType && programIdForMatrix
          ? await this.matrixObligation(programIdForMatrix, pushedType)
          : null,
      });
    } else {
      Object.assign(intervention, next);
    }
    return this.interventionRepo.save(intervention);
  }

  async delete(caseId: string, id: string) {
    const intervention = await this.interventionRepo.findOne({ where: { id, caseId } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    await this.interventionRepo.remove(intervention);
  }
}
