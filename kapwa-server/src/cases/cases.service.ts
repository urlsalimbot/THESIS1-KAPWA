import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification.entity';

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
    if (status) {
      return this.caseRepo.find({ where: { status }, take: DEFAULT_LIST_LIMIT });
    }
    return this.caseRepo.find({ take: DEFAULT_LIST_LIMIT });
  }

  async findById(id: string) {
    const c = await this.caseRepo.findOne({ where: { id }, relations: ['beneficiary'] });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  private async logHistory(caseId: string, fromStatus: CaseStatus | undefined, toStatus: CaseStatus, changedByRole?: string, changedById?: string, remarks?: string) {
    await this.historyRepo.save({
      caseId,
      fromStatus,
      toStatus,
      changedByRole,
      changedById,
      remarks,
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
