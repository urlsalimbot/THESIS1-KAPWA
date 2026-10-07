import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional, Logger } from '@nestjs/common';
import { displayFullName } from '../common/person-name';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from './case.entity';
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';
import { CaseFollowUpVisit } from './case-follow-up-visit.entity';
import { CaseStepLock } from './case-step-lock.entity';
import { InterventionRequiredDocument } from './intervention-required-document.entity';
// A plain const from a leaf module, not `CaseStepLocksService`: that service
// injects `CasesService`, so depending on it here would be a require cycle — and
// with `emitDecoratorMetadata` that costs the locks service a Nest DI failure at
// boot, which no unit test can see. The labels are all this file needs, and an
// error that spells a step differently from the stepper costs the worker a trip
// to the UI to find out what is open.
import { CASE_STEP_LABELS, stepsDueAt, stepsForCategory, stepsInPhase } from './case-step-labels';
import { isValidTransition, canTransition } from './case-fsm';
import { CaseHistory } from './case-history.entity';
import { CasesExportService } from './cases-export.service';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TeamScheduleSyncService } from '../team/team-schedule-sync.service';
import { AssessmentInput, TransitionPlanInput, RequirementsInput, ClosureInput, AssessmentV2Input, DiscernmentInput, ProtectionOrderInput, SoloParentInput, AdoptionInput, CaseMetaInput } from './dto/cases.zod';
import {
  SATURDAY, SUNDAY,
  PENDING_ESCALATION_DAYS, REVIEW_ESCALATION_DAYS, APPROVED_ESCALATION_DAYS,
} from '../common/constants';

const MAX_RETRY_ATTEMPTS = 3;
const CONTROL_NO_PAD_WIDTH = 5;
@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(CaseHistory)
    private historyRepo: Repository<CaseHistory>,
    @InjectRepository(HouseholdMembership)
    private familyRepo: Repository<HouseholdMembership>,
    @InjectRepository(BeneficiaryClaimant)
    private bcRepo: Repository<BeneficiaryClaimant>,
    @InjectRepository(CaseStepLock)
    private stepLocksRepo: Repository<CaseStepLock>,
    private notifService: NotificationsService,
    private casesExport: CasesExportService,
    @Optional() private auditLog?: AuditLogService,
    @Optional() private syncService?: TeamScheduleSyncService,
    @Optional() @InjectRepository(InterventionRequiredDocument)
    private interventionDocsRepo?: Repository<InterventionRequiredDocument>,
  ) {}

  /**
   * The crisis-mode documentary catalog: every intervention-anchored document
   * minimum, for the client's requirements panel (GET /cases/intervention-documents,
   * declared before the `:id` route so it is not swallowed).
   */
  async listInterventionDocuments(): Promise<InterventionRequiredDocument[]> {
    return this.interventionDocsRepo?.find({ order: { interventionType: 'ASC', documentKey: 'ASC' } }) ?? [];
  }

  /**
   * Next control number for the current year, e.g. MSWD-2026-00047.
   *
   * Backed by an atomic per-year counter row (`case_control_counters`) rather
   * than max+1 over existing rows: deleting the newest case no longer lets a
   * later intake reuse its number, and concurrent intakes each get a distinct
   * value (the ON CONFLICT UPDATE takes a row lock). Uniqueness is on the full
   * string, so legacy `KAPWA-…` numbers coexist untouched.
   */
  async generateControlNo(): Promise<string> {
    const year = new Date().getFullYear();
    const rows: Array<{ last_seq: number }> = await this.caseRepo.manager.query(
      `INSERT INTO case_control_counters (year, last_seq)
       VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE
         SET last_seq = case_control_counters.last_seq + 1, updated_at = NOW()
       RETURNING last_seq`,
      [year],
    );
    const seq = Number(rows[0]?.last_seq ?? 1);
    return `MSWD-${year}-${String(seq).padStart(CONTROL_NO_PAD_WIDTH, '0')}`;
  }

  async create(data: Partial<Case>, actorId?: string) {
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const controlNo = await this.generateControlNo();
        const c = this.caseRepo.create({
          controlNo,
          status: CaseStatus.ENROLLED,
          serviceRequested: data.serviceRequested,
          beneficiaryId: data.beneficiaryId,
          assignedWorkerId: data.assignedWorkerId,
        });
        if ((data as any).requirementsChecklist && Object.keys((data as any).requirementsChecklist).length > 0) {
          c.requirements = Object.entries((data as any).requirementsChecklist).map(([requirementKey, met]) =>
            this.caseRepo.manager.create(CaseRequirement, { caseId: c.id, requirementKey, met: met as boolean }),
          );
        }
        if ((data as any).amountAssistance != null || (data as any).financialSubsidies != null || (data as any).modeFinancialAssistance != null || (data as any).sourceOfFund != null || (data as any).legislatorSpecify != null) {
          c.assistances = [
            this.caseRepo.manager.create(CaseAssistance, {
              assistanceType: 'financial',
              amount: (data as any).amountAssistance,
              mode: (data as any).modeFinancialAssistance,
              sourceOfFund: (data as any).sourceOfFund,
              legislatorSpecify: (data as any).legislatorSpecify,
              details: (data as any).financialSubsidies,
            }),
          ];
        }
        await this.caseRepo.save(c);
        await this.auditLog?.log('case.create', c.id, actorId, { controlNo, beneficiaryId: c.beneficiaryId });
        return c;
      } catch (err: any) {
        lastError = err;
        if (err?.code === '23505' && attempt < 3) continue;
        throw err;
      }
    }
    throw lastError;
  }

  // Attach per-case intervention counts (one grouped query) so the approval
  // pipeline can show the case stepper's Implement HIP / Service Delivery
  // progress without N+1 fetches.
  //
  // The inter-agency referral count rides along for the same reason and in the
  // same shape: the pipeline's chips are drawn from the *same* `stepperStepDone`
  // as the case view's stepper, and step 2 now asks for the referral count
  // rather than reading `case.referrals`. A list row that omits it would answer
  // "no referral" for a case that has one — the two surfaces of one predicate
  // disagreeing, which is precisely what the shared fixture exists to prevent.
  // The same two queries, so the cost is unchanged per page.
  /**
   * Stamps the per-case counts the stepper's done-predicate reads but that are
   * not columns on `cases`: `interventionCount`, `interAgencyReferralCount`,
   * `enrollmentCount` and `courtHearingCount`.
   *
   * The last two were missing, and the approval pipeline has no other way to
   * learn them — it renders straight from `GET /cases`, so a case with
   * enrollments or hearings on file still drew those two chips as pending and a
   * phase never read as closed no matter what had actually been accomplished.
   *
   * `courtHearingCount` counts non-cancelled hearings only, matching the case
   * view's own derivation: a cancelled hearing is a decision not to hold it.
   */
  private async attachInterventionCounts(cases: Case[]): Promise<Case[]> {
    if (cases.length === 0) return cases;
    const ids = cases.map((c) => c.id);
    const [interventionRows, referralRows, enrollmentRows, hearingRows] = await Promise.all([
      this.caseRepo.manager.query(
        `SELECT case_id, COUNT(*)::int AS count FROM case_interventions
         WHERE case_id::uuid = ANY($1::uuid[]) GROUP BY case_id`,
        [ids],
      ),
      this.caseRepo.manager.query(
        `SELECT case_id, COUNT(*)::int AS count FROM inter_agency_referrals
         WHERE case_id::uuid = ANY($1::uuid[]) GROUP BY case_id`,
        [ids],
      ),
      this.caseRepo.manager.query(
        `SELECT case_id, COUNT(*)::int AS count FROM program_enrollments
         WHERE case_id::uuid = ANY($1::uuid[]) GROUP BY case_id`,
        [ids],
      ),
      this.caseRepo.manager.query(
        `SELECT case_id, COUNT(*)::int AS count FROM case_events
         WHERE event_type = 'court_hearing' AND status <> 'cancelled'
           AND case_id::uuid = ANY($1::uuid[]) GROUP BY case_id`,
        [ids],
      ),
    ]);
    const counts = new Map((interventionRows as any[]).map((r: any) => [r.case_id, Number(r.count)]));
    const referralCounts = new Map((referralRows as any[]).map((r: any) => [r.case_id, Number(r.count)]));
    const enrollmentCounts = new Map((enrollmentRows as any[]).map((r: any) => [r.case_id, Number(r.count)]));
    const hearingCounts = new Map((hearingRows as any[]).map((r: any) => [r.case_id, Number(r.count)]));
    for (const c of cases) {
      (c as any).interventionCount = counts.get(c.id) ?? 0;
      c.interAgencyReferralCount = referralCounts.get(c.id) ?? 0;
      (c as any).enrollmentCount = enrollmentCounts.get(c.id) ?? 0;
      (c as any).courtHearingCount = hearingCounts.get(c.id) ?? 0;
    }
    return cases;
  }

  async findAll(page = 1, limit = 10, filters?: { status?: CaseStatus; search?: string; barangay?: string; category?: string; caseCategory?: string; gender?: string; ageRange?: string; sla?: string; dateFrom?: string; dateTo?: string; beneficiaryId?: string }) {
    const qb = this.caseRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.beneficiary', 'beneficiary')
      .leftJoinAndSelect('beneficiary.person', 'person')
      .leftJoinAndSelect('person.addresses', 'person_addresses')
      .leftJoinAndSelect('person.contacts', 'person_contacts')
      .leftJoinAndSelect('c.assignedWorker', 'assignedWorker')
      .leftJoinAndSelect('c.requirements', 'case_requirements')
      .leftJoinAndSelect('c.referralRows', 'case_referrals')
      .leftJoinAndSelect('c.assistances', 'case_assistances');

    if (filters?.status) {
      qb.andWhere('c.status = :status', { status: filters.status });
    }
    // Beneficiary profile "Cases" panel: /cases?beneficiaryId=X must return
    // only that beneficiary's cases (omitted = unfiltered).
    if (filters?.beneficiaryId) {
      qb.andWhere('c.beneficiaryId = :beneficiaryId', { beneficiaryId: filters.beneficiaryId });
    }
    if (filters?.search) {
      qb.andWhere(
        '(person.surname ILIKE :search OR person.first_name ILIKE :search OR person.middle_name ILIKE :search OR c.controlNo ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters?.barangay) {
      qb.andWhere('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = person.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${filters.barangay}%` });
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

    if (filters?.ageRange) {
      switch (filters.ageRange) {
        case '0-17':
          qb.andWhere("(person.dob IS NULL OR person.dob > NOW() - INTERVAL '18 years')");
          break;
        case '60+':
          qb.andWhere("person.dob <= NOW() - INTERVAL '60 years'");
          break;
        case '18-59':
          qb.andWhere("person.dob <= NOW() - INTERVAL '18 years' AND person.dob > NOW() - INTERVAL '60 years'");
          break;
      }
    }
    if (filters?.category) {
      qb.andWhere('c.client_category ILIKE :category', { category: `%${filters.category}%` });
    }
    // The case's own category (CICL, VAWC, CNSP, …), matched exactly rather than
    // by substring: the filter offers whole stored values, and a substring would
    // make "Adoption & Foster Care Case" sweep up anything containing those words.
    if (filters?.caseCategory) {
      qb.andWhere('c.case_category = :caseCategory', { caseCategory: filters.caseCategory });
    }

    qb.orderBy('c.createdAt', 'DESC');

    if (filters?.sla) {
      // Matches statuses computeSlaOverdue evaluates; ASSESSED cases are flagged
      // overdue at REVIEW_ESCALATION_DAYS. Intentionally excludes TRANSITIONING/CLOSED
      // which computeSlaOverdue marks not-overdue (default case).
      qb.andWhere('c.status IN (:...slaStatuses)', {
        slaStatuses: [CaseStatus.ENROLLED, CaseStatus.IN_REVIEW, CaseStatus.ACTIVE, CaseStatus.ASSESSED],
      });
      const candidate = await qb.getMany();
      let mapped = candidate.map(c => ({
        c,
        slaOverdue: this.computeSlaOverdue(c),
      }));
      if (filters.sla === 'overdue') {
        mapped = mapped.filter(m => m.slaOverdue);
      } else if (filters.sla === 'on_track') {
        mapped = mapped.filter(m => !m.slaOverdue);
      }
      const sTotal = mapped.length;
      return {
        data: mapped
          .slice((page - 1) * limit, page * limit)
          .map(m => Object.assign(m.c, { slaOverdue: m.slaOverdue })),
        total: sTotal,
      };
    }

    qb.skip((page - 1) * limit).take(limit);
    const [cases, total] = await qb.getManyAndCount();
    const data = await this.attachInterventionCounts(cases);
    for (const c of data) {
      (c as any).slaOverdue = this.computeSlaOverdue(c);
    }
    return { data, total };
  }

  async getCaseWithSla(id: string) {
    const c = await this.findById(id);
    (c as any).slaOverdue = this.computeSlaOverdue(c);
    // The case-level referral count, unscoped. The case view's step-2 predicate
    // must not read the caller-scoped referral list: "does this case have a
    // referral" is a fact about the case, and the scoped list answers a different
    // question (which rows this caller may read). Both surfaces now read this one
    // number, which is the same one `attachInterventionCounts` stamps on list
    // rows for the approval pipeline.
    c.interAgencyReferralCount = await this.getInterAgencyReferralCount(id);
    return c;
  }

  async findById(id: string) {
    const c = await this.caseRepo.findOne({
      where: { id },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household', 'beneficiary.household.members', 'assignedWorker', 'assistances'],
    });
    if (!c) throw new NotFoundException('Case not found');

    // Load family members via household_memberships + persons
    if (c.beneficiary?.householdId) {
      const rows = await this.familyRepo.query(
        `SELECT hm.id,
                TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name || ' ', ''), p.surname)) AS full_name,
                hm.relationship, EXTRACT(YEAR FROM AGE(NOW(), p.dob))::integer AS age, p.occupation, p.estimated_monthly_income AS income,
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

    // Sealed steps travel with the detail payload so the case view's seal strip
    // does not need a second round-trip, in the case's template order. `case_step_locks.case_id`
    // is TEXT and `cases.id` is UUID, but this is a TypeORM `where` on a bound
    // string, so there is no text = uuid comparison to trip over.
    const templateOrder = stepsForCategory(c.caseCategory);
    const lockedRows = await this.stepLocksRepo.find({ where: { caseId: id } });
    const lockByKey = new Map(lockedRows.map((l) => [l.stepKey, l]));
    (c as any).stepLocks = templateOrder
      .filter((key) => lockByKey.has(key))
      .map((key) => {
        const l = lockByKey.get(key)!;
        return { stepKey: l.stepKey, lockedByName: l.lockedByName, lockedAt: l.lockedAt };
      });

    // Load claimant (if different from beneficiary)
    if (c.beneficiary?.personId) {
      const bc = await this.bcRepo.findOne({ where: { beneficiaryId: c.beneficiary.personId }, relations: ['claimant'] });
      if (bc && bc.claimant && bc.claimantId !== c.beneficiary.personId) {
        (c as any).claimant = {
          fullName: displayFullName({ firstName: bc.claimant.firstName, middleName: bc.claimant.middleName, surname: bc.claimant.surname, nameExtension: bc.claimant.extension }),
          relationship: bc.relationship,
          phone: bc.claimant.phone,
          address: bc.claimant.address,
          currentAddress: bc.claimant.currentAddress,
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

  /**
   * The case's transition trail, each entry attributed to a named actor. The
   * `case_history` row only stores `changed_by_id` (plus the role slug), so the
   * display name is joined here — without it the timeline can only ever read
   * "by social worker" and never "Lorna Santos — MSWDO Social Worker".
   *
   * The LEFT JOIN keeps system-driven entries (no actor id) and deleted accounts
   * in the trail; those fall back to the role label on the client.
   */
  async getHistory(caseId: string) {
    const rows: any[] = await this.historyRepo.query(
      `SELECT ch.id, ch.case_id, ch.from_status, ch.to_status, ch.changed_by_role,
              ch.changed_by_id, ch.remarks, ch.transition_type, ch.override_reason,
              ch.created_at,
              TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.name_extension)) AS changed_by_name
       FROM case_history ch
       LEFT JOIN users u ON u.id::text = ch.changed_by_id
       WHERE ch.case_id = $1
       ORDER BY ch.created_at ASC`,
      [caseId],
    );
    // CONCAT_WS over all-NULL name parts yields '' rather than NULL, so empty
    // strings are normalized back to null here — consumers must not have to
    // treat '' and "absent" as different things.
    const nullable = (v: unknown) => (v === null || v === undefined || v === '' ? null : v);
    return rows.map(r => ({
      id: r.id,
      caseId: r.case_id,
      fromStatus: nullable(r.from_status) ?? undefined,
      toStatus: r.to_status,
      changedByRole: nullable(r.changed_by_role) ?? undefined,
      changedById: nullable(r.changed_by_id) ?? undefined,
      changedByName: nullable(r.changed_by_name),
      remarks: nullable(r.remarks) ?? undefined,
      transitionType: r.transition_type,
      overrideReason: nullable(r.override_reason) ?? undefined,
      createdAt: r.created_at,
    }));
  }

  async updateStatus(id: string, newStatus: CaseStatus, userRole?: string, actorId?: string) {
    return this.transition(id, newStatus, { userRole, actorId });
  }

  /**
   * Refuse a transition while any of `requiredSteps` is unsealed.
   *
   * Reads the seals off the case rather than asking the repository: `findById`
   * already loaded them onto the payload for the seal strip, so a query here is a
   * second round-trip for an answer in hand. A case that somehow carries no
   * `stepLocks` is read as carrying no seals, so this fails closed.
   *
   * `requiredSteps` comes from `case-step-labels.ts` — never an index written out
   * here — so the set a gate demands is by construction a set the seal endpoint
   * will accept at this status.
   */
  private assertStepsSealed(c: Case, requiredSteps: string[], doing: string): void {
    const sealed = ((c as any).stepLocks ?? []) as Array<{ stepKey: string }>;
    const open = requiredSteps.filter((key) => !sealed.some((l) => l.stepKey === key));
    if (open.length === 0) return;
    // Name the steps as the stepper does. "closure" in an error while the UI
    // says "Case Study & Closure" sends the worker looking for the right name.
    throw new BadRequestException(
      `Lock every step before ${doing}. ` +
      `Still open: ${open.map((key) => CASE_STEP_LABELS[key] ?? key).join(', ')}`,
    );
  }

  private async validateTransition(c: Case, newStatus: CaseStatus, userRole?: string) {
    if (!isValidTransition(c.status, newStatus)) {
      throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
    }
    if (newStatus === CaseStatus.CLOSED) {
      // The FSM only allows transitioning -> closed, but guard here too so any
      // future FSM change cannot close a case without the exit record.
      if (c.status !== CaseStatus.TRANSITIONING) {
        throw new BadRequestException('Case must be in transitioning status to close');
      }
      if (!c.closureOutcome) {
        throw new BadRequestException('Closure outcome is required for closure');
      }
    }
    if (c.status === CaseStatus.ENROLLED && newStatus === CaseStatus.ASSESSED && (!c.problemsPresented || !c.socialWorkerAssessment || !c.clientCategory || !c.caseCategory)) {
      throw new BadRequestException('Assessment must be completed before transitioning to assessed');
    }
    if (c.status === CaseStatus.ASSESSED && newStatus === CaseStatus.IN_REVIEW && (!c.frvaScore && !c.swdiScore)) {
      throw new BadRequestException('FRVA or SWDI score must be provided before review');
    }
    // A case cannot be flagged for admin review until the worker has sealed
    // every step *that is due at this lifecycle position*. This edge is the
    // hand-off — CASE_FSM_ROLES gives it to the social worker — and it was gated
    // only on an FRVA/SWDI score, so a worker could flag a case with no
    // intervention recorded at all.
    //
    // "Due", not all five: at `assessed` the Phase-Out steps are floored at
    // `active` and `transitioning`, so their Lock buttons are disabled and the
    // seal endpoint rejects them with a 400. Requiring them made the gate
    // unsatisfiable for the only role it applies to — a social worker could
    // never hand a case up, and only `admin` (who bypasses) could move it.
    // `stepsDueAt` derives the set from the same `CASE_STEP_MIN_STATUS` the
    // seal service's done-predicate floors each step with, so the steps this
    // gate names are exactly the steps that can be sealed here.
    //
    // Sits after the FRVA/SWDI check so the cheaper, more specific complaint
    // still wins, and reads `stepLocksRepo` directly rather than
    // `CaseStepLocksService`, which injects this service and would be a cycle.
    //
    // The guard keys on the role being *admin*, never on a role being present:
    // `canTransition` short-circuits admin to true, and an admin that could not
    // move a case at all would be worse than the gap this closes. A caller that
    // omits `userRole` is therefore gated, not waved through — fail closed, so
    // forgetting the argument cannot become the bypass.
    if (c.status === CaseStatus.ASSESSED && newStatus === CaseStatus.IN_REVIEW && userRole !== 'admin') {
      this.assertStepsSealed(c, stepsDueAt(c.status, c.caseCategory),
        'flagging this case for admin review');
    }
    // Phase-Out. Step 4 (Evaluate Help Given) and step 5 (Case Study & Closure)
    // had no seal gate anywhere: the gate above asks for the steps *due* at a
    // status, and these two only become due at `active` and `transitioning` — so
    // nothing asked whether anyone deliberately sealed them, and a case could
    // reach `closed` with its closure step never sealed by anyone.
    //
    // Closure therefore asks for every step due at `transitioning` — all five —
    // not just the step whose work completes on this edge. Step 4's own edge,
    // `active -> transitioning`, cannot carry its gate (`CASE_FSM_ROLES[ACTIVE]`
    // is empty, so only `admin` may take it, and `admin` is the caller this rule
    // exempts), so closure is the last point at which step 4 can be required of
    // anyone. Requiring the earlier steps again costs nothing: a case only reaches
    // `transitioning` through `in_review -> active`, which already required them,
    // and re-checking also catches a step unlocked after approval.
    //
    // `active -> transitioning` is deliberately *not* gated, and the gap is real:
    // `CASE_FSM_ROLES[ACTIVE]` is empty, so `canTransition` admits `admin` and
    // nothing else, and `admin` is the caller this rule exempts. A gate there
    // would bind nobody. `cases.service.spec.ts` pins that as a fact about the
    // FSM, so it becomes a gap to close if a role is ever added there — not a
    // silent assumption.
    if (c.status === CaseStatus.TRANSITIONING && newStatus === CaseStatus.CLOSED && userRole !== 'admin') {
      this.assertStepsSealed(c, stepsDueAt(c.status, c.caseCategory), 'closing this case');
    }
    // Terminal aftercare: only a closed case may move to aftercare (post-closure
    // follow-up, DSWD AO 10 s. 2007 §VIII.G). No outgoing edges exist in the FSM.
    if (newStatus === CaseStatus.AFTERCARE) {
      if (c.status !== CaseStatus.CLOSED) {
        throw new BadRequestException('Case must be closed before moving to aftercare');
      }
    }
    if (c.status === CaseStatus.IN_REVIEW && newStatus === CaseStatus.ACTIVE) {
      const interventionCount = await this.getInterventionCount(c.id);
      const hasReferral = (await this.getInterAgencyReferralCount(c.id)) > 0;
      // At least one of the two service channels must be real: either an
      // intervention was issued, or — when no intervention is issued — a
      // referral exists. Recording "no referral needed" still demands an
      // intervention (and vice versa), so a case can never be empty on both.
      if (interventionCount === 0 && !c.interventionNotNeeded) {
        throw new BadRequestException('At least one intervention must be logged (or record that no intervention is issued) before activating');
      }
      if (c.interventionNotNeeded && !hasReferral) {
        throw new BadRequestException('No intervention is issued — record at least one referral before activating');
      }
      if (c.referralNotNeeded && interventionCount === 0) {
        throw new BadRequestException('No referral will be issued — log at least one intervention before activating');
      }
      if (interventionCount > 0) {
        const missing = await this.casesExport.missingRequiredDocuments(c.id);
        if (missing.length > 0) {
          throw new BadRequestException(
            `Cannot activate: missing required document(s): ${missing.join(', ')}`,
          );
        }
      }
    }
    if (c.status === CaseStatus.ACTIVE && newStatus === CaseStatus.TRANSITIONING) {
      if (!c.selfRelianceLevel || !c.sustainabilityPlan) {
        throw new BadRequestException('Self-reliance level and sustainability plan are required for transition');
      }
      if (!(await this.getInterAgencyReferralCount(c.id)) && !c.referralNotNeeded) {
        throw new BadRequestException('Record the inter-agency referral decision before transitioning');
      }
      // The Implementation phase's own gate. `assessed -> in_review` covers the
      // Phase-In work and `transitioning -> closed` covers Phase-Out, but this
      // edge — leaving the phase the services were actually delivered in — was
      // the only one with no seal gate, so a case could be transitioned with its
      // Court Hearings never sealed by anyone.
      //
      // Phrased as a *phase* rather than `stepsDueAt('active')`. That set is
      // floored, and at `active` it also contains `evaluate` — Phase-Out work,
      // owed before `closed` instead. Demanding it here would seal Phase-Out
      // during Implementation and leave only `closure` for the phase that owns
      // it. `stepsInPhase` filters the case's own template, so a category with
      // no `discernment` is never asked for one, and every member is floored at
      // ≤ 3 — sealable at this status, which is what `assertStepsSealed`
      // requires of any set it is handed.
      //
      // No admin exemption, unlike the two gates above: `CASE_FSM_ROLES[ACTIVE]`
      // is empty, so this edge admits `admin` and nobody else — exempting the
      // only role that can take it would bind no one. The comment above this
      // block that called a gate here useless was describing the absence; this
      // is what makes it real.
      this.assertStepsSealed(c, stepsInPhase(c.caseCategory, 'implementation'),
        'transitioning out of the implementation phase');
    }
  }

  async transition(id: string, newStatus: CaseStatus, opts?: { userRole?: string; reason?: string; historyType?: 'standard' | 'override'; actorId?: string }) {
    const c = await this.findById(id);
    const oldStatus = c.status;

    // Authorize before validating prerequisites: an unauthorized role must get a
    // 403 and must not learn which documents/fields are missing.
    if (opts?.userRole && !canTransition(c.status, opts.userRole)) {
      throw new ForbiddenException(`Role ${opts.userRole} cannot transition from ${c.status} to ${newStatus}`);
    }

    await this.validateTransition(c, newStatus, opts?.userRole);

    c.status = newStatus;
    if (opts?.userRole) c.approvedByRole = opts.userRole;
    // Resolve the actor's display name so the case view can show
    // "Approved by {name — role}" rather than a bare role slug.
    if (opts?.actorId) {
      const rows = await this.caseRepo.manager.query(
        `SELECT first_name, middle_name, last_name, name_extension FROM users WHERE id = $1 LIMIT 1`,
        [opts.actorId],
      );
      const u = rows[0];
      if (u) {
        c.approvedByName = [u.first_name, u.middle_name, u.last_name, u.name_extension]
          .filter(Boolean)
          .join(' ');
      }
    }
    if (newStatus === CaseStatus.CLOSED) c.closureDate = new Date().toISOString().split('T')[0];
    c.updatedAt = new Date();
    await this.caseRepo.save(c);

    await this.logHistory(id, oldStatus, newStatus, opts?.userRole, opts?.actorId, opts?.reason || `Transitioned by ${opts?.userRole || 'system'}`, opts?.historyType);

    await this.auditLog?.log('case.transition', id, opts?.actorId, { from: oldStatus, to: newStatus, by: opts?.userRole, controlNo: c.controlNo });

    if (c.assignedWorkerId) {
      await this.notifService.notifyCaseUpdate(c.assignedWorkerId, c.id, c.controlNo, newStatus);
    }

    // The beneficiary's linked claimant account should also be notified of
    // case updates so walk-in clients can monitor their case status.
    if (c.beneficiaryId) {
      const claimantRows = await this.caseRepo.query(
        `SELECT u.id FROM users u
         JOIN beneficiaries b ON b.person_id = u.person_id
         WHERE b.id = $1 AND u.is_active = TRUE
         LIMIT 1`,
        [c.beneficiaryId],
      );
      const claimantUserId = claimantRows?.[0]?.id as string | undefined;
      if (claimantUserId) {
        await this.notifService.notifyCaseUpdate(claimantUserId, c.id, c.controlNo, newStatus);
      }
    }

    return c;
  }

  async approve(id: string, newStatus: CaseStatus, userRole: string, actorId?: string) {
    // The approver is the caller: `transition()` records them as the actor, so
    // the approval is attributed without a separate typed signature. The signed
    // paperwork is the exported document, not a field here.
    return this.transition(id, newStatus, { userRole, actorId, reason: `Approved by ${userRole}` });
  }

  async issueDocument(id: string, type: 'coe' | 'pcv', actorId?: string) {
    const c = await this.findById(id);
    if (![CaseStatus.ACTIVE, CaseStatus.TRANSITIONING, CaseStatus.CLOSED].includes(c.status)) {
      throw new BadRequestException('COE/PCV can only be issued once the case is active');
    }
    const url = type === 'coe'
      ? await this.casesExport.issueCoe(id, actorId)
      : await this.casesExport.issuePcv(id, actorId);
    await this.auditLog?.log(`case.issue_${type}`, id, actorId, { controlNo: c.controlNo, url });
    return { url };
  }

  async requestReview(id: string, userRole?: string, actorId?: string) {
    const c = await this.findById(id);
    // Authorize first so an unauthorized role cannot probe the case's state.
    if (userRole !== 'social_worker') {
      throw new ForbiddenException(`Role ${userRole} cannot request review`);
    }
    if (c.status !== CaseStatus.ENROLLED) {
      throw new BadRequestException(`Cannot request review from ${c.status}`);
    }
    if (!c.problemsPresented || !c.socialWorkerAssessment || !c.clientCategory) {
      throw new BadRequestException('Assessment must be completed before requesting review (problems presented, social worker assessment, and client category are required)');
    }
    const oldStatus = c.status;
    c.status = CaseStatus.ASSESSED;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(id, oldStatus, c.status, userRole, undefined, undefined, 'standard');
    await this.auditLog?.log('case.request_review', id, actorId, { to: c.status, by: userRole, controlNo: c.controlNo });
    return c;
  }

  async disburse(id: string, newStatus: CaseStatus, userRole?: string, actorId?: string) {
    return this.transition(id, newStatus, { userRole, actorId, reason: `Transitioned by ${userRole}` });
  }

  async close(id: string, newStatus: CaseStatus, userRole?: string, actorId?: string) {
    return this.transition(id, newStatus, { userRole, actorId, reason: 'Case closed' });
  }

  // Reject a case: a terminal outcome for an intake that must not proceed to
  // service delivery. Distinct from the admin-only override because it is a
  // documented decision (reason required) available to the case workers who
  // actually triage intakes, and it only applies while the case is still in
  // Phase-In (enrolled / assessed / in_review).
  async reject(id: string, reason: string, userRole?: string, actorId?: string) {
    const c = await this.findById(id);
    if (userRole !== 'admin' && userRole !== 'social_worker') {
      throw new ForbiddenException(`Role ${userRole} cannot reject a case`);
    }
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }
    const rejectable: CaseStatus[] = [CaseStatus.ENROLLED, CaseStatus.ASSESSED, CaseStatus.IN_REVIEW];
    if (!rejectable.includes(c.status)) {
      throw new BadRequestException(`A case in ${c.status} cannot be rejected`);
    }
    const oldStatus = c.status;
    c.status = CaseStatus.CLOSED;
    c.closureOutcome = 'incomplete';
    c.closureDate = new Date().toISOString().split('T')[0];
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    await this.logHistory(
      id,
      oldStatus,
      CaseStatus.CLOSED,
      userRole,
      actorId,
      `Case rejected: ${reason}`,
      'standard',
    );
    await this.auditLog?.log('case.reject', id, actorId, { from: oldStatus, reason, controlNo: c.controlNo });
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

  async updateAssessment(id: string, data: AssessmentInput, actorId?: string) {
    const c = await this.findById(id);
    Object.assign(c, {
      problemsPresented: data.problemsPresented,
      socialWorkerAssessment: data.socialWorkerAssessment,
      clientCategory: data.clientCategory,
      natureOfService: data.natureOfService,
      interviewedBy: data.interviewedBy,
      clientSignature: data.clientSignature,
      updatedAt: new Date(),
    });
    const saved = await this.caseRepo.save(c);
    await this.auditLog?.log('case.assessment', id, actorId, { clientCategory: data.clientCategory, interviewedBy: data.interviewedBy });
    return saved;
  }

  async updateTransitionPlan(id: string, data: TransitionPlanInput, actorId?: string) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    const { referrals, followUpVisits, ...rest } = data;
    Object.assign(caseEntity, rest);
    if (referrals !== undefined && referrals !== null) {
      // actorId is optional for legacy call paths; achievements count referral
      // rows by created_by, and rows recorded without it count to nobody.
      caseEntity.referralRows = referrals.map(r =>
        this.caseRepo.manager.create(CaseReferral, { caseId: caseEntity.id, agency: r.agencyName, status: r.status, notes: r.notes ?? undefined, reason: r.reason, contactInfo: r.contactInfo ?? undefined, createdBy: actorId }),
      );
    }
    await this.caseRepo.save(caseEntity);

    // Follow-up / home visits are replaced wholesale. Done with explicit
    // delete+insert (rather than reassigning the collection) so removing a visit
    // deletes the row instead of nulling its NOT NULL case_id.
    if (followUpVisits !== undefined) {
      await this.caseRepo.manager.delete(CaseFollowUpVisit, { caseId: id });
      const visits = (followUpVisits ?? []).map(v =>
        this.caseRepo.manager.create(CaseFollowUpVisit, {
          caseId: id,
          visitDate: v.date,
          visitType: v.type,
          notes: v.notes ?? undefined,
          outcome: v.outcome ?? undefined,
        }),
      );
      if (visits.length > 0) await this.caseRepo.manager.save(CaseFollowUpVisit, visits);
    }
    return this.caseRepo.findOne({ where: { id }, relations: ['followUpVisitRows'] });
  }

  async updateRequirements(id: string, data: RequirementsInput) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    // Replace the checklist wholesale. Explicit delete+insert (not a collection
    // reassignment) keeps the (case, requirement) uniqueness intact.
    await this.caseRepo.manager.delete(CaseRequirement, { caseId: id });
    const rows = Object.entries(data.requirementsChecklist).map(([requirementKey, met]) =>
      this.caseRepo.manager.create(CaseRequirement, { caseId: id, requirementKey, met }),
    );
    if (rows.length > 0) await this.caseRepo.manager.save(CaseRequirement, rows);
    return this.caseRepo.findOne({ where: { id }, relations: ['requirements'] });
  }

  async updateReferralDecision(id: string, notNeeded: boolean) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    caseEntity.referralNotNeeded = notNeeded;
    return this.caseRepo.save(caseEntity);
  }

  async updateInterventionDecision(id: string, notNeeded: boolean) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    caseEntity.interventionNotNeeded = notNeeded;
    return this.caseRepo.save(caseEntity);
  }

  async updateEnrollmentsDecision(id: string, notNeeded: boolean) {
    const caseEntity = await this.caseRepo.findOne({ where: { id } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    // Recording "no program needed" and enrolling at the same time is a
    // contradiction a worker might not notice; the enrollments step's
    // done-predicate accepts either, so the decision is reverted when an
    // enrollment exists.
    caseEntity.enrollmentsNotNeeded = notNeeded;
    return this.caseRepo.save(caseEntity);
  }

  /** Category-step savers — each refuses a category whose template lacks the step. */
  private requireCategory(c: Case, expected: string, stepLabel: string): void {
    if (stepsForCategory(c.caseCategory).includes(stepLabel)) return;
    throw new BadRequestException(
      `"${CASE_STEP_LABELS[stepLabel]}" is not part of the template for category "${c.caseCategory ?? '(none)'}".`,
    );
  }

  private async saveCategoryStepFields(
    id: string,
    fields: Array<[keyof Case, unknown]>,
    expectedCategoryKey: string,
    stepKey: string,
    actorId?: string,
  ) {
    const c = await this.findById(id);
    this.requireCategory(c, expectedCategoryKey, stepKey);
    for (const [field, value] of fields) {
      if (value !== undefined) (c as any)[field] = value;
    }
    c.updatedAt = new Date();
    const saved = await this.caseRepo.save(c);
    await this.auditLog?.log(`case.${stepKey}`, id, actorId, { [stepKey]: true });
    return saved;
  }

  async updateDiscernment(id: string, data: DiscernmentInput, actorId?: string) {
    return this.saveCategoryStepFields(id, [
      ['discernmentAssessedAt', data.discernmentAssessedAt],
      ['discernmentResult', data.discernmentResult],
      ['discernmentNotes', data.discernmentNotes],
    ], 'Children in Conflict with the Law (CICL)', 'discernment', actorId);
  }

  async updateProtectionOrder(id: string, data: ProtectionOrderInput, actorId?: string) {
    return this.saveCategoryStepFields(id, [
      ['protectionOrderType', data.protectionOrderType],
      ['protectionOrderIssuedAt', data.protectionOrderIssuedAt],
      ['protectionOrderIssuedBy', data.protectionOrderIssuedBy],
      ['protectionOrderNotes', data.protectionOrderNotes],
    ], 'Violence Against Women and Their Children (VAWC)', 'protection_order', actorId);
  }

  async updateSoloParent(id: string, data: SoloParentInput, actorId?: string) {
    return this.saveCategoryStepFields(id, [
      ['soloParentIdIssuedDate', data.soloParentIdIssuedDate],
      ['soloParentIdNumber', data.soloParentIdNumber],
      ['soloParentNotes', data.soloParentNotes],
    ], 'Solo Parent', 'solo_parent', actorId);
  }

  async updateAdoption(id: string, data: AdoptionInput, actorId?: string) {
    return this.saveCategoryStepFields(id, [
      ['adoptionDvcDate', data.adoptionDvcDate],
      ['adoptionCaseStudyDate', data.adoptionCaseStudyDate],
      ['adoptionCdclaaReceived', data.adoptionCdclaaReceived],
      ['adoptionNotes', data.adoptionNotes],
    ], 'Adoption & Foster Care Case', 'adoption', actorId);
  }

  async updateCaseMeta(id: string, data: CaseMetaInput, actorId?: string) {
    const c = await this.findById(id);
    const prevWorker = c.assignedWorkerId;
    if (data.courtDocketNumber !== undefined) c.courtDocketNumber = data.courtDocketNumber;
    // null clears the assignment (column is nullable; the entity type omits null).
    if (data.assignedWorkerId !== undefined) (c as any).assignedWorkerId = data.assignedWorkerId;
    if (data.crisisMode !== undefined) (c as any).crisisMode = data.crisisMode;
    c.updatedAt = new Date();
    const saved = await this.caseRepo.save(c);
    if (data.assignedWorkerId !== undefined && data.assignedWorkerId !== prevWorker) {
      // Reassignment (spec §6): synced case-event blocks follow the worker.
      await this.syncService?.moveForCase(id, data.assignedWorkerId ?? null);
    }
    await this.auditLog?.log('case.meta', id, actorId, data);
    return saved;
  }

  /**
   * Public because the step-done predicate reuses it: a second count query
   * against `case_interventions` could disagree with this one and let a step be
   * sealed on a count the activation gate does not see.
   */
  async getInterventionCount(caseId: string): Promise<number> {
    const result = await this.caseRepo.query(
      'SELECT COUNT(*) as count FROM case_interventions WHERE case_id = $1',
      [caseId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * The case's inter-agency referrals, counted off `inter_agency_referrals`.
   *
   * Public, and for the same reason as `getInterventionCount`: two count queries
   * against one table can disagree, and the step-done predicate, the list
   * endpoint and these FSM preconditions all have to see the same number.
   *
   * **`inter_agency_referrals`, not `Case.referrals`.** That getter is over
   * `case_referrals`, which is the transition plan's agency list — written only by
   * `updateTransitionPlan` and read by no step, which is why it has 0 rows in
   * every database this project has run. A referral, as the product means it, is
   * the row the endorsement letter writes (`InterAgencyRefervalsService.create`).
   * The gates below used the getter, so a case that issued a real referral was
   * refused for "no referral" — and once the step-done predicate was corrected
   * to count the right table, the same rule had two surfaces reading two
   * different tables, which is the drift the shared fixture exists to prevent.
   *
   * These are FSM preconditions, not step-done predicates, so the shared fixture
   * does not reach them; `cases.service.spec.ts` pins each gate instead.
   */
  async getInterAgencyReferralCount(caseId: string): Promise<number> {
    const result = await this.caseRepo.query(
      'SELECT COUNT(*) as count FROM inter_agency_referrals WHERE case_id = $1',
      [caseId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }

  async updateAssessmentV2(id: string, data: AssessmentV2Input, actorId?: string) {
    const c = await this.findById(id);
    // The case category defines the step template, so it is editable only while
    // the case is `enrolled` (step 1 in progress). Once the case leaves
    // `enrolled`, a category change would retroactively swap the template the
    // seals were taken against (spec §9).
    if (data.caseCategory !== undefined && c.status !== CaseStatus.ENROLLED && data.caseCategory !== c.caseCategory) {
      throw new BadRequestException(
        'The case category cannot be changed once the case leaves the enrolled status — the step template it defines is already locked.',
      );
    }
    // Only assign fields the payload actually provides. TypeORM skips
    // `undefined` on save, so an unconditional Object.assign would *clear*
    // scores when a later partial save (e.g. "Save Assessment" after
    // "Save Assessment Tools") omits them.
    const fields: Array<keyof AssessmentV2Input> = [
      'problemsPresented', 'socialWorkerAssessment', 'clientCategory', 'caseCategory',
      'frvaScore', 'swdiScore', 'familyDialogueNotes', 'natureOfService',
      'interviewedBy', 'clientSignature',
    ];
    for (const key of fields) {
      if (data[key] !== undefined) {
        (c as any)[key] = data[key];
      }
    }
    c.updatedAt = new Date();

    const assistances: CaseAssistance[] = [];
    const hasFinancial =
      data.amountAssistance != null ||
      data.modeFinancialAssistance != null ||
      data.sourceOfFund != null ||
      data.legislatorSpecify != null ||
      data.financialSubsidies != null;
    if (hasFinancial) {
      assistances.push(this.caseRepo.manager.create(CaseAssistance, {
        caseId: c.id,
        assistanceType: 'financial',
        amount: data.amountAssistance,
        mode: data.modeFinancialAssistance,
        sourceOfFund: data.sourceOfFund,
        legislatorSpecify: data.legislatorSpecify ?? undefined,
        details: data.financialSubsidies,
      }));
    }
    if (data.otherAssistance) {
      for (const [key, value] of Object.entries(data.otherAssistance)) {
        assistances.push(this.caseRepo.manager.create(CaseAssistance, {
          caseId: c.id,
          assistanceType: key,
          details: value as Record<string, unknown>,
        }));
      }
    }
    c.assistances = assistances;

    await this.caseRepo.manager.delete(CaseAssistance, { caseId: id });
    const saved = await this.caseRepo.save(c);
    await this.auditLog?.log('case.assessment', id, actorId, { clientCategory: data.clientCategory, interviewedBy: data.interviewedBy, financial: data.amountAssistance ?? null });
    return saved;
  }

  /**
   * Record the exit record — outcome, notes, signature — without closing.
   *
   * This route used to set `status: CLOSED` itself, which skipped the
   * `transitioning -> closed` seal gate: closing is a forward hop, and every
   * forward hop that ends a step's work runs `assertStepsSealed`. Two jobs in
   * one route meant one of them (the close) was ungated. Split: this method
   * saves the step-5 data and nothing else, and the close goes through
   * `PATCH /cases/:id/close` -> `transition()`, where the gate lives.
   *
   * The route still opens with `assertUnsealed(id, 4)`: the exit record *is*
   * step 5's own data, so it refuses to move a sealed step. Sealing is a
   * precondition for closing, not a bar to it — the previous code had the two
   * rules inverted, refusing to close a sealed step and closing an unsealed one.
   */
  async updateClosure(id: string, data: ClosureInput, userRole?: string) {
    const c = await this.findById(id);
    // Authorize first so an unauthorized role cannot probe the case's state.
    const allowedRoles = ['admin', 'social_worker', 'coordinator'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} cannot record closure data`);
    }
    if (c.status !== CaseStatus.TRANSITIONING) {
      throw new BadRequestException('Case must be in transitioning status to record closure data');
    }
    Object.assign(c, {
      closureOutcome: data.closureOutcome,
      exitNotes: data.exitNotes,
      clientSignature: data.clientSignature || c.clientSignature,
      closureDate: data.closureDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date(),
    });
    await this.caseRepo.save(c);
    await this.auditLog?.log('case.closure_record', id, undefined, { controlNo: c.controlNo, outcome: data.closureOutcome });
    return c;
  }

  async getTrackerDaily(date?: string, status?: string, barangay?: string) {
    const target = date ? new Date(date) : new Date();
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);
    return this.getTrackerEntries(start, end, status, barangay);
  }

  async getTrackerRange(startDate: string, endDate: string, status?: string, barangay?: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return this.getTrackerEntries(start, end, status, barangay);
  }

  private async getTrackerEntries(start: Date, end: Date, status?: string, barangay?: string) {
    // Sanitize free-form barangay text before SQL interpolation (same pattern
    // as the existing status interpolation).
    const b = barangay ? barangay.replace(/'/g, "''") : null;
    const rows = await this.caseRepo.query(
      `SELECT
        c.id,
        c.control_no AS "controlNo",
        c.status,
        c.created_at AS "transactionDate",
        p.surname,
        p.first_name AS "firstName",
        p.middle_name AS "middleName",
        p.gender,
        CASE
          WHEN p.dob IS NULL THEN 'Unknown'
          WHEN p.dob > NOW() - INTERVAL '18 years' THEN '0-17'
          WHEN p.dob <= NOW() - INTERVAL '60 years' THEN '60+'
          ELSE '18-59'
        END AS "ageRange",
        c.client_category AS "clientCategory",
        c.case_category AS "caseCategory",
        COALESCE((SELECT pa2.barangay FROM person_addresses pa2 WHERE pa2.person_id = p.id AND pa2.address_type = 'current' LIMIT 1), (SELECT pa3.raw FROM person_addresses pa3 WHERE pa3.person_id = p.id LIMIT 1)) AS barangay,
        COALESCE(c.problems_presented, c.social_worker_assessment, '') AS "interventionRemarks",
        ROW_NUMBER() OVER (PARTITION BY DATE(c.created_at) ORDER BY c.created_at) AS "dailySeqNum"
      FROM cases c
      LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
      LEFT JOIN persons p ON p.id = b.person_id
      WHERE c.created_at >= $1 AND c.created_at <= $2 AND c.status <> 'closed'
        ${status ? `AND c.status = '${status}'` : ''}
        ${b ? `AND EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE '%${b}%' OR pa2.raw ILIKE '%${b}%'))` : ''}
      ORDER BY c.created_at DESC, "dailySeqNum" ASC`,
      [start, end],
    );
    return rows.map((r: any) => ({
      id: r.id,
      controlNo: r.controlNo,
      status: r.status,
      transactionDate: r.transactionDate,
      surname: r.surname || '',
      firstName: r.firstName || '',
      middleName: r.middleName || '',
      gender: r.gender || '',
      ageRange: r.ageRange,
      clientCategory: r.clientCategory || '',
      caseCategory: r.caseCategory || '',
      barangay: r.barangay || '',
      interventionRemarks: r.interventionRemarks || '',
      dailySeqNum: Number(r.dailySeqNum),
    }));
  }

  async getTrackerStats(barangay?: string) {
    // Cases created since the Monday of the current calendar week (Mon–Sun).
    const now = new Date();
    const diffToMonday = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const b = barangay ? barangay.replace(/'/g, "''") : null;
    const scopeClause = b
      ? ` AND EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = pp.id AND (pa2.barangay ILIKE '%${b}%' OR pa2.raw ILIKE '%${b}%'))`
      : '';

    const weekResult = await this.caseRepo.query(
      `SELECT COUNT(*) AS count FROM cases c
        LEFT JOIN beneficiaries bb ON bb.id = c.beneficiary_id
        LEFT JOIN persons pp ON pp.id = bb.person_id
        WHERE c.created_at >= $1${scopeClause}`,
      [monday],
    );
    const thisWeekCases = parseInt(weekResult[0]?.count || '0', 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayResult = await this.caseRepo.query(
      `SELECT COUNT(*) AS count FROM cases c
        LEFT JOIN beneficiaries bb ON bb.id = c.beneficiary_id
        LEFT JOIN persons pp ON pp.id = bb.person_id
        WHERE c.created_at >= $1${scopeClause}`,
      [today],
    );
    const todayEntries = parseInt(todayResult[0]?.count || '0', 10);

    return { thisWeekCases, todayEntries };
  }
}
