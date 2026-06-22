import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification.entity';
import {
  SATURDAY, SUNDAY,
  PENDING_ESCALATION_DAYS, REVIEW_ESCALATION_DAYS, APPROVED_ESCALATION_DAYS,
} from '../sla/constants';

const MAX_RETRY_ATTEMPTS = 3;
const CONTROL_NO_PAD_WIDTH = 5;
@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(CaseHistory)
    private historyRepo: Repository<CaseHistory>,
    private notifService: NotificationsService,
  ) {}

  async generateControlNo(): Promise<string> {
    const year = new Date().getFullYear();
    const queryRunner = this.caseRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const last = await queryRunner.manager
        .createQueryBuilder(Case, 'c')
        .where(`c.control_no LIKE :pattern`, { pattern: `KAPWA-${year}-%` })
        .orderBy('c.control_no', 'DESC')
        .getOne();
      const lastSeq = last
        ? parseInt(last.controlNo.split('-')[2] || '0', 10)
        : 0;
      await queryRunner.commitTransaction();
      return `KAPWA-${year}-${String(lastSeq + 1).padStart(CONTROL_NO_PAD_WIDTH, '0')}`;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async create(data: Partial<Case>) {
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const controlNo = await this.generateControlNo();
        const c = this.caseRepo.create({
          controlNo,
          status: CaseStatus.PENDING,
          serviceRequested: data.serviceRequested,
          requirementsChecklist: data.requirementsChecklist,
          beneficiaryId: data.beneficiaryId,
          assignedWorkerId: data.assignedWorkerId,
        });
        await this.caseRepo.save(c);
        return c;
      } catch (err: any) {
        lastError = err;
        if (err?.code === '23505' && attempt < 3) continue;
        throw err;
      }
    }
    throw lastError;
  }

  async findAll(status?: CaseStatus) {
    let cases: Case[];
    if (status) {
      cases = await this.caseRepo.find({ where: { status }, take: DEFAULT_LIST_LIMIT });
    } else {
      cases = await this.caseRepo.find({ take: DEFAULT_LIST_LIMIT });
    }
    return cases.map(c => ({
      ...c,
      slaOverdue: this.computeSlaOverdue(c),
    }));
  }

  async getCaseWithSla(id: string) {
    const c = await this.findById(id);
    return {
      ...c,
      slaOverdue: this.computeSlaOverdue(c),
    };
  }

  async findById(id: string) {
    const c = await this.caseRepo.findOne({ where: { id }, relations: ['beneficiary'] });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  private computeSlaOverdue(c: Case): boolean {
    const age = this.workingDays(c.createdAt, new Date());
    switch (c.status) {
      case CaseStatus.PENDING:
        return age >= PENDING_ESCALATION_DAYS;
      case CaseStatus.IN_REVIEW:
        return age >= REVIEW_ESCALATION_DAYS;
      case CaseStatus.APPROVED:
        return age >= APPROVED_ESCALATION_DAYS;
      default:
        return false;
    }
  }

  private workingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== SUNDAY && day !== SATURDAY) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  private async logHistory(caseId: string, fromStatus: CaseStatus | undefined, toStatus: CaseStatus, changedByRole?: string, changedById?: string, remarks?: string, transitionType?: 'standard' | 'override', overrideReason?: string) {
    await this.historyRepo.save({
      caseId,
      fromStatus,
      toStatus,
      changedByRole,
      changedById,
      remarks,
      transitionType: transitionType || 'standard',
      overrideReason,
    });
  }

  async getHistory(caseId: string) {
    return this.historyRepo.find({
      where: { caseId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(id: string, newStatus: CaseStatus, userRole?: string) {
    const c = await this.findById(id);
    const oldStatus = c.status;
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
      [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED, CaseStatus.CLOSED],
      [CaseStatus.APPROVED]: [CaseStatus.DISBURSED, CaseStatus.CLOSED],
      [CaseStatus.DISBURSED]: [CaseStatus.CLOSED],
      [CaseStatus.CLOSED]: [],
    };
    if (!transitions[c.status]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
    }

    const roleTransitions: Record<CaseStatus, string[]> = {
      [CaseStatus.PENDING]: ['social_worker', 'coordinator'],
      [CaseStatus.IN_REVIEW]: ['admin'],
      [CaseStatus.APPROVED]: ['admin'],
      [CaseStatus.DISBURSED]: ['admin'],
      [CaseStatus.CLOSED]: ['admin', 'social_worker'],
    };
    const allowedRoles = roleTransitions[c.status] || ['admin'];
    if (userRole && !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} cannot transition from ${c.status} to ${newStatus}`);
    }

    c.status = newStatus;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);

    await this.logHistory(id, oldStatus, newStatus, userRole);

    if (c.assignedWorkerId) {
      await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.controlNo, newStatus);
    }
    if (newStatus === CaseStatus.DISBURSED && c.beneficiaryId) {
      await this.notifService.create({
        recipientId: c.beneficiaryId,
        title: 'Disbursement Approved',
        message: `Case ${c.controlNo} has been approved for disbursement. Please coordinate with the MSWDO office.`,
        category: NotificationCategory.DISBURSEMENT,
        referenceId: c.controlNo,
      });
    }

    return c;
  }

  async approve(id: string, newStatus: CaseStatus, signature: string, userRole: string) {
    const c = await this.findById(id);
    const oldStatus = c.status;
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
      [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED, CaseStatus.CLOSED],
      [CaseStatus.APPROVED]: [CaseStatus.DISBURSED, CaseStatus.CLOSED],
      [CaseStatus.DISBURSED]: [CaseStatus.CLOSED],
      [CaseStatus.CLOSED]: [],
    };
    if (!transitions[c.status]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
    }
    const roleTransitions: Partial<Record<CaseStatus, string[]>> = {
      [CaseStatus.IN_REVIEW]: ['admin'],
      [CaseStatus.APPROVED]: ['admin'],
      [CaseStatus.DISBURSED]: ['admin'],
    };
    const allowedRoles = roleTransitions[c.status] || ['admin'];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} cannot approve this case`);
    }

    c.status = newStatus;
    c.approvedBySignature = signature;
    c.approvedByRole = userRole;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);

    await this.logHistory(id, oldStatus, newStatus, userRole, undefined, `Approved by ${userRole}`);

    if (c.assignedWorkerId) {
      await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.controlNo, newStatus);
    }
    if (newStatus === CaseStatus.DISBURSED && c.beneficiaryId) {
      await this.notifService.create({
        recipientId: c.beneficiaryId,
        title: 'Disbursement Approved',
        message: `Case ${c.controlNo} has been approved for disbursement. Please coordinate with the MSWDO office.`,
        category: NotificationCategory.DISBURSEMENT,
        referenceId: c.controlNo,
      });
    }

    return c;
  }

  async requestReview(id: string, userRole?: string) {
    const c = await this.findById(id);
    if (c.status !== CaseStatus.PENDING) {
      throw new BadRequestException(`Cannot request review from ${c.status}`);
    }
    if (userRole !== 'social_worker') {
      throw new ForbiddenException(`Role ${userRole} cannot request review`);
    }
    const oldStatus = c.status;
    c.status = CaseStatus.IN_REVIEW;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole, undefined, undefined, 'standard');
    return c;
  }

  async disburse(id: string, newStatus: CaseStatus, userRole?: string) {
    const c = await this.findById(id);
    if (c.status !== CaseStatus.APPROVED) {
      throw new BadRequestException(`Cannot disburse from ${c.status}`);
    }
    if (userRole !== 'admin') {
      throw new ForbiddenException(`Role ${userRole} cannot disburse`);
    }
    const oldStatus = c.status;
    c.status = CaseStatus.DISBURSED;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole, undefined, 'Disbursed by admin');
    if (c.beneficiaryId) {
      await this.notifService.create({
        recipientId: c.beneficiaryId,
        title: 'Disbursement Approved',
        message: `Case ${c.controlNo} has been approved for disbursement. Please coordinate with the MSWDO office.`,
        category: NotificationCategory.DISBURSEMENT,
        referenceId: c.controlNo,
      });
    }
    return c;
  }

  async close(id: string, newStatus: CaseStatus, userRole?: string) {
    const c = await this.findById(id);
    if (c.status !== CaseStatus.DISBURSED) {
      throw new BadRequestException(`Cannot close from ${c.status}`);
    }
    const allowedRoles = ['admin', 'social_worker'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} cannot close case`);
    }
    const oldStatus = c.status;
    c.status = CaseStatus.CLOSED;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole);
    return c;
  }

  async overrideStatus(id: string, targetStatus: CaseStatus, reason: string, userRole?: string) {
    const c = await this.findById(id);
    if (userRole !== 'admin') {
      throw new ForbiddenException(`Role ${userRole} cannot override case status`);
    }
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Override reason is required');
    }
    const oldStatus = c.status;
    c.status = targetStatus;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole, undefined, undefined, 'override', reason);
    return c;
  }

  async updateDocuments(id: string, data: { certificateUrl?: string; pettyCashVoucherUrl?: string }) {
    const c = await this.findById(id);
    if (data.certificateUrl !== undefined) c.certificateUrl = data.certificateUrl;
    if (data.pettyCashVoucherUrl !== undefined) c.pettyCashVoucherUrl = data.pettyCashVoucherUrl;
    c.updatedAt = new Date();
    return this.caseRepo.save(c);
  }

  async getPendingDisbursed() {
    return this.caseRepo.find({ where: { status: CaseStatus.DISBURSED }, take: DEFAULT_LIST_LIMIT });
  }
}
