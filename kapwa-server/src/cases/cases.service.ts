import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { Person } from '../beneficiaries/person.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../notifications/notification.entity';
import { AssessmentInput, TransitionPlanInput, RequirementsInput, ClosureInput, AssessmentV2Input } from './dto/cases.zod';
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
    @InjectRepository(HouseholdMembership)
    private familyRepo: Repository<HouseholdMembership>,
    @InjectRepository(BeneficiaryClaimant)
    private bcRepo: Repository<BeneficiaryClaimant>,
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
          status: CaseStatus.ENROLLED,
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

  async findAll(page = 1, limit = 10, filters?: { status?: CaseStatus; search?: string; barangay?: string; category?: string; gender?: string; ageRange?: string; sla?: string; dateFrom?: string; dateTo?: string }) {
    const qb = this.caseRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.person', 'person')
      .leftJoinAndSelect('c.assignedWorker', 'assignedWorker');

    if (filters?.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }
    if (filters?.search) {
      qb.andWhere(
        '(person.surname ILIKE :search OR person.first_name ILIKE :search OR person.middle_name ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters?.barangay) {
      qb.andWhere('person.address ILIKE :barangay', { barangay: `%${filters.barangay}%` });
    }
    if (filters?.gender) {
      qb.andWhere('person.gender = :gender', { gender: filters.gender });
    }
    if (filters?.dateFrom) {
      qb.andWhere('c.createdAt >= :dateFrom', { dateFrom: new Date(filters.dateFrom + 'T00:00:00Z') });
    }
    if (filters?.dateTo) {
      qb.andWhere('c.createdAt <= :dateTo', { dateTo: new Date(filters.dateTo + 'T23:59:59Z') });
    }

    qb.skip((page - 1) * limit).take(limit).orderBy('c.createdAt', 'DESC');

    const [cases, total] = await qb.getManyAndCount();

    let filtered = cases.map(c => ({
      ...c,
      slaOverdue: this.computeSlaOverdue(c),
    }));

    if (filters?.sla === 'overdue') {
      filtered = filtered.filter(c => c.slaOverdue);
    } else if (filters?.sla === 'on_track') {
      filtered = filtered.filter(c => !c.slaOverdue);
    }

    // ageRange and category are client-calculated on beneficiary data, filter post-query
    if (filters?.ageRange) {
      filtered = filtered.filter(c => {
        const age = c.beneficiary?.age || 0;
        const range = age < 18 ? '0-17' : age > 59 ? '60+' : '18-59';
        return range === filters.ageRange;
      });
    }
    if (filters?.category) {
      filtered = filtered.filter(c => {
        const cats = (c.serviceRequested as string[]) || [];
        return cats.some(cat => cat.toLowerCase().includes(filters.category!.toLowerCase()));
      });
    }

    return { data: filtered, total };
  }

  async getCaseWithSla(id: string) {
    const c = await this.findById(id);
    return {
      ...c,
      slaOverdue: this.computeSlaOverdue(c),
    };
  }

  async findById(id: string) {
    const c = await this.caseRepo.findOne({
      where: { id },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household', 'beneficiary.household.members', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');

    // Load family members via household_memberships + persons
    if (c.beneficiary?.householdId) {
      const rows = await this.familyRepo.query(
        `SELECT hm.id,
                TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name || ' ', ''), p.surname)) AS full_name,
                hm.relationship, p.age, p.occupation, p.estimated_monthly_income AS income,
                hm.status, hm.is_primary
         FROM household_memberships hm
         JOIN persons p ON p.id = hm.person_id
         WHERE hm.household_id = $1
         ORDER BY hm.is_primary DESC, p.first_name`,
        [c.beneficiary.householdId],
      );
      (c.beneficiary.household as any).familyMembers = rows.map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        relationship: r.relationship,
        age: r.age,
        occupation: r.occupation,
        income: r.income != null ? Number(r.income) : null,
        status: r.status || null,
        isPrimary: r.is_primary,
      }));
    }

    // Load claimant (if different from beneficiary)
    if (c.beneficiary?.personId) {
      const bc = await this.bcRepo.findOne({ where: { beneficiaryId: c.beneficiary.personId }, relations: ['claimant'] });
      if (bc && bc.claimant && bc.claimantId !== c.beneficiary.personId) {
        (c as any).claimant = {
          fullName: `${bc.claimant.firstName || ''} ${bc.claimant.middleName ? bc.claimant.middleName + ' ' : ''}${bc.claimant.surname || ''}`.trim(),
          relationship: bc.relationship,
          phone: bc.claimant.phone,
          address: bc.claimant.address,
        };
      }
    }

    return c;
  }

  private computeSlaOverdue(c: Case): boolean {
    const age = this.workingDays(c.createdAt, new Date());
    switch (c.status) {
      case CaseStatus.ENROLLED:
        return age >= PENDING_ESCALATION_DAYS;
      case CaseStatus.ASSESSED:
        return age >= REVIEW_ESCALATION_DAYS;
      case CaseStatus.IN_REVIEW:
        return age >= APPROVED_ESCALATION_DAYS;
      case CaseStatus.ACTIVE:
        return age >= 30;
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
    return this.transition(id, newStatus, { userRole });
  }

  private async validateTransition(c: Case, newStatus: CaseStatus) {
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.ENROLLED]: [CaseStatus.ASSESSED, CaseStatus.CLOSED],
      [CaseStatus.ASSESSED]: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
      [CaseStatus.IN_REVIEW]: [CaseStatus.ACTIVE, CaseStatus.CLOSED],
      [CaseStatus.ACTIVE]: [CaseStatus.TRANSITIONING, CaseStatus.CLOSED],
      [CaseStatus.TRANSITIONING]: [CaseStatus.CLOSED],
      [CaseStatus.CLOSED]: [],
    };
    if (!transitions[c.status]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
    }
    if (c.status === CaseStatus.ENROLLED && newStatus === CaseStatus.ASSESSED && (!c.problemsPresented || !c.socialWorkerAssessment || !c.clientCategory)) {
      throw new BadRequestException('Assessment must be completed before transitioning to assessed');
    }
    if (c.status === CaseStatus.ASSESSED && newStatus === CaseStatus.IN_REVIEW && (!c.frvaScore && !c.swdiScore)) {
      throw new BadRequestException('FRVA or SWDI score must be provided before review');
    }
    if (c.status === CaseStatus.IN_REVIEW && newStatus === CaseStatus.ACTIVE) {
      const interventionCount = await this.getInterventionCount(c.id);
      if (interventionCount === 0) {
        throw new BadRequestException('At least one intervention must be logged before activating');
      }
    }
    if (c.status === CaseStatus.ACTIVE && newStatus === CaseStatus.TRANSITIONING && (!c.selfRelianceLevel || !c.sustainabilityPlan)) {
      throw new BadRequestException('Self-reliance level and sustainability plan are required for transition');
    }
    if (c.status === CaseStatus.TRANSITIONING && newStatus === CaseStatus.CLOSED && (!c.clientSignature || !c.closureOutcome)) {
      throw new BadRequestException('Client signature and closure outcome are required for closure');
    }
  }

  private getTransitionRoles(status: CaseStatus): string[] {
    const roleTransitions: Partial<Record<CaseStatus, string[]>> = {
      [CaseStatus.ENROLLED]: ['social_worker', 'coordinator'],
      [CaseStatus.ASSESSED]: ['social_worker', 'coordinator'],
      [CaseStatus.IN_REVIEW]: ['admin', 'coordinator'],
      [CaseStatus.ACTIVE]: ['admin', 'social_worker'],
      [CaseStatus.TRANSITIONING]: ['social_worker', 'coordinator'],
      [CaseStatus.CLOSED]: ['admin', 'social_worker', 'coordinator'],
    };
    return roleTransitions[status] || ['admin'];
  }

  async transition(id: string, newStatus: CaseStatus, opts?: { signature?: string; userRole?: string; reason?: string; historyType?: 'standard' | 'override' }) {
    const c = await this.findById(id);
    const oldStatus = c.status;
    await this.validateTransition(c, newStatus);

    const allowedRoles = this.getTransitionRoles(c.status);
    if (opts?.userRole && !allowedRoles.includes(opts.userRole)) {
      throw new ForbiddenException(`Role ${opts.userRole} cannot transition from ${c.status} to ${newStatus}`);
    }

    c.status = newStatus;
    if (opts?.signature) c.approvedBySignature = opts.signature;
    if (opts?.userRole) c.approvedByRole = opts.userRole;
    if (newStatus === CaseStatus.CLOSED) c.closureDate = new Date().toISOString().split('T')[0];
    c.updatedAt = new Date();
    await this.caseRepo.save(c);

    await this.logHistory(id, oldStatus, newStatus, opts?.userRole, undefined, opts?.reason || `Transitioned by ${opts?.userRole || 'system'}`, opts?.historyType);

    if (c.assignedWorkerId) {
      await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.controlNo, newStatus);
    }

    return c;
  }

  async approve(id: string, newStatus: CaseStatus, signature: string, userRole: string) {
    return this.transition(id, newStatus, { signature, userRole, reason: `Approved by ${userRole}` });
  }

  async requestReview(id: string, userRole?: string) {
    const c = await this.findById(id);
    if (c.status !== CaseStatus.ENROLLED) {
      throw new BadRequestException(`Cannot request review from ${c.status}`);
    }
    if (userRole !== 'social_worker') {
      throw new ForbiddenException(`Role ${userRole} cannot request review`);
    }
    if (!c.problemsPresented || !c.socialWorkerAssessment || !c.clientCategory) {
      throw new BadRequestException('Assessment must be completed before requesting review (problems presented, social worker assessment, and client category are required)');
    }
    const oldStatus = c.status;
    c.status = CaseStatus.ASSESSED;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole, undefined, undefined, 'standard');
    return c;
  }

  async disburse(id: string, newStatus: CaseStatus, userRole?: string) {
    return this.transition(id, newStatus, { userRole, reason: `Transitioned by ${userRole}` });
  }

  async close(id: string, newStatus: CaseStatus, userRole?: string) {
    return this.transition(id, newStatus, { userRole, reason: 'Case closed' });
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

  async updateAssessment(id: string, data: AssessmentInput) {
    const c = await this.findById(id);
    Object.assign(c, {
      problemsPresented: data.problemsPresented,
      socialWorkerAssessment: data.socialWorkerAssessment,
      clientCategory: data.clientCategory,
      natureOfService: data.natureOfService,
      financialSubsidies: data.financialSubsidies,
      amountAssistance: data.amountAssistance,
      modeFinancialAssistance: data.modeFinancialAssistance,
      sourceOfFund: data.sourceOfFund,
      legislatorSpecify: data.legislatorSpecify,
      otherAssistance: data.otherAssistance,
      interviewedBy: data.interviewedBy,
      clientSignature: data.clientSignature,
      updatedAt: new Date(),
    });
    return this.caseRepo.save(c);
  }

  async updateTransitionPlan(id: string, data: TransitionPlanInput) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    Object.assign(caseEntity, data);
    return this.caseRepo.save(caseEntity);
  }

  async updateRequirements(id: string, data: RequirementsInput) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    caseEntity.requirementsChecklist = data.requirementsChecklist;
    return this.caseRepo.save(caseEntity);
  }

  async getPendingDisbursed() {
    return this.caseRepo.find({ where: { status: CaseStatus.ACTIVE }, take: DEFAULT_LIST_LIMIT });
  }

  private async getInterventionCount(caseId: string): Promise<number> {
    const result = await this.caseRepo.query(
      'SELECT COUNT(*) as count FROM case_interventions WHERE case_id = $1',
      [caseId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }

  async updateAssessmentV2(id: string, data: AssessmentV2Input) {
    const c = await this.findById(id);
    Object.assign(c, {
      problemsPresented: data.problemsPresented,
      socialWorkerAssessment: data.socialWorkerAssessment,
      clientCategory: data.clientCategory,
      frvaScore: data.frvaScore,
      swdiScore: data.swdiScore,
      familyDialogueNotes: data.familyDialogueNotes,
      natureOfService: data.natureOfService,
      financialSubsidies: data.financialSubsidies,
      amountAssistance: data.amountAssistance,
      modeFinancialAssistance: data.modeFinancialAssistance,
      sourceOfFund: data.sourceOfFund,
      legislatorSpecify: data.legislatorSpecify,
      otherAssistance: data.otherAssistance,
      interviewedBy: data.interviewedBy,
      clientSignature: data.clientSignature,
      updatedAt: new Date(),
    });
    return this.caseRepo.save(c);
  }

  async updateClosure(id: string, data: ClosureInput, userRole?: string) {
    const c = await this.findById(id);
    if (c.status !== CaseStatus.TRANSITIONING) {
      throw new BadRequestException('Case must be in transitioning status to close');
    }
    const allowedRoles = ['admin', 'social_worker', 'coordinator'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} cannot close case`);
    }
    const oldStatus = c.status;
    Object.assign(c, {
      status: CaseStatus.CLOSED,
      closureOutcome: data.closureOutcome,
      exitNotes: data.exitNotes,
      clientSignature: data.clientSignature || c.clientSignature,
      closureDate: data.closureDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date(),
    });
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, CaseStatus.CLOSED, userRole, undefined, `Closed with outcome: ${data.closureOutcome}`);
    return c;
  }

  async getTrackerDaily(date?: string) {
    const target = date ? new Date(date) : new Date();
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);
    return this.getTrackerEntries(start, end);
  }

  async getTrackerRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return this.getTrackerEntries(start, end);
  }

  private async getTrackerEntries(start: Date, end: Date) {
    const rows = await this.caseRepo.query(
      `SELECT
        c.id,
        c.control_no AS "controlNo",
        c.created_at AS "transactionDate",
        p.surname,
        p.first_name AS "firstName",
        p.middle_name AS "middleName",
        p.gender,
        CASE
          WHEN p.age IS NULL THEN 'Unknown'
          WHEN p.age < 18 THEN '0-17'
          WHEN p.age > 59 THEN '60+'
          ELSE '18-59'
        END AS "ageRange",
        c.client_category AS "clientCategory",
        p.address AS barangay,
        COALESCE(c.problems_presented, c.social_worker_assessment, '') AS "interventionRemarks",
        ROW_NUMBER() OVER (PARTITION BY DATE(c.created_at) ORDER BY c.created_at) AS "dailySeqNum"
      FROM cases c
      LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
      LEFT JOIN persons p ON p.id = b.person_id
      WHERE c.created_at >= $1 AND c.created_at <= $2
      ORDER BY c.created_at DESC, "dailySeqNum" ASC`,
      [start, end],
    );
    return rows.map((r: any) => ({
      id: r.id,
      controlNo: r.controlNo,
      transactionDate: r.transactionDate,
      surname: r.surname || '',
      firstName: r.firstName || '',
      middleName: r.middleName || '',
      gender: r.gender || '',
      ageRange: r.ageRange,
      clientCategory: r.clientCategory || '',
      barangay: r.barangay || '',
      interventionRemarks: r.interventionRemarks || '',
      dailySeqNum: Number(r.dailySeqNum),
    }));
  }

  async getTrackerStats() {
    const totalResult = await this.caseRepo.query(`SELECT COUNT(*) AS count FROM cases`);
    const total = parseInt(totalResult[0]?.count || '0', 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayResult = await this.caseRepo.query(
      `SELECT COUNT(*) AS count FROM cases WHERE created_at >= $1`,
      [today],
    );
    const todayEntries = parseInt(todayResult[0]?.count || '0', 10);

    return { totalCasesLogged: total, todayEntries };
  }
}
