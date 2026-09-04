import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Person } from '../beneficiaries/person.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '../notifications/notification.entity';
import { UserRole } from '../auth/user.entity';
import {
  InterAgencyReferral,
  InterAgencyReferralStatus,
} from './inter-agency-referral.entity';
import {
  CloseReferralInput,
  CreateInterAgencyReferralInput,
  DeclineReferralInput,
} from './dto/inter-agency-referrals.zod';

const TRANSITIONS: Record<InterAgencyReferralStatus, InterAgencyReferralStatus[]> = {
  referred: ['received', 'declined'],
  received: ['actioned'],
  actioned: ['closed'],
  closed: [],
  declined: [],
};

@Injectable()
export class InterAgencyReferralsService {
  private readonly logger = new Logger(InterAgencyReferralsService.name);

  constructor(
    @InjectRepository(InterAgencyReferral)
    private repo: Repository<InterAgencyReferral>,
    @InjectRepository(Agency)
    private agencyRepo: Repository<Agency>,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    private casesService: CasesService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notifService: NotificationsService,
  ) {}

  async create(dto: CreateInterAgencyReferralInput, caller: User) {
    let fromAgencyId = caller.agencyId as string | undefined;
    if (!fromAgencyId && (caller.role === UserRole.ADMIN || caller.role === UserRole.SW)) {
      // MSWDO staff are not linked to an agency on production accounts;
      // fall back to the designated MSWDO agency so case-flow referrals work.
      const mswdo = await this.agencyRepo.findOne({ where: { code: 'MSWDO', isActive: true } });
      if (mswdo) fromAgencyId = mswdo.id;
    }
    if (!fromAgencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    const toAgency = await this.agencyRepo.findOne({ where: { id: dto.toAgencyId, isActive: true } });
    if (!toAgency) throw new UnprocessableEntityException('Unknown target agency');
    if (toAgency.id === fromAgencyId) throw new BadRequestException('Cannot refer to your own agency');

    const personId = await this.resolvePersonId(dto);
    const ref = this.repo.create({
      personId,
      caseId: dto.caseId,
      fromAgencyId,
      toAgencyId: toAgency.id,
      reason: dto.reason,
      notes: dto.notes,
      legalBasisCode: dto.legalBasisCode,
      consentLedgerId: dto.consentLedgerId,
      status: 'referred',
      createdBy: caller.id,
    });
    const saved = await this.repo.save(ref);
    try {
      await this.notifyAgency(toAgency.id, 'New Inter-Agency Referral', `New referral from ${fromAgencyId}: ${dto.reason}`);
    } catch (err) {
      this.logger.warn(`Failed to send referral notification: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  async findInbox(caller: User) {
    if (caller.role === 'admin') {
      return this.repo.find({
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'person', 'case'],
      });
    }
    if (!caller.agencyId) return [];
    return this.repo.find({
      where: [
        { fromAgencyId: caller.agencyId },
        { toAgencyId: caller.agencyId },
      ],
      order: { createdAt: 'DESC' },
      relations: ['fromAgency', 'toAgency', 'person', 'case'],
    });
  }

  async findOne(id: string, caller: User): Promise<InterAgencyReferral> {
    const ref = await this.repo.findOne({
      where: { id },
      relations: ['fromAgency', 'toAgency', 'person', 'case'],
    });
    if (!ref) throw new NotFoundException('Inter-agency referral not found');
    if (caller.role === 'admin') return ref;
    if (caller.agencyId && (ref.fromAgencyId === caller.agencyId || ref.toAgencyId === caller.agencyId)) return ref;
    if (caller.role === UserRole.SW && ref.createdBy === caller.id) return ref;
    throw new NotFoundException('Inter-agency referral not found');
  }

  async findByPerson(personId: string, caller: User) {
    const scoped = await this.findInbox(caller);
    return scoped.filter(r => r.personId === personId);
  }

  /**
   * Inter-facility aide ledger: aggregates every benefit/service a person has
   * received across all municipal offices/agencies (MSWDO interventions, access
   * card services logged by any agency, and inter-agency referrals). Groups by
   * facility so a social worker or admin can see — at a glance — whether the
   * same person is drawing aid from multiple offices (e.g. Municipal LTO gas
   * subsidy + MSWDO financial aid) and flag potential duplicate receipt.
   */
  async getPersonBenefitLedger(personId: string, caller: User) {
    const person = await this.benRepo.manager.query('SELECT id FROM persons WHERE id = $1', [personId]);
    if (!person || person.length === 0) {
      throw new NotFoundException('Person not found');
    }
    const isAdmin = caller.role === 'admin';
    const isMswdo = isAdmin || caller.role === 'social_worker';
    const callerAgency = caller.agencyId;
    if (!isMswdo && !callerAgency) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }

    // Resolve all access card codes for this person (household + role keys).
    const cards = await this.benRepo.manager.query(
      `SELECT DISTINCT COALESCE(h.access_card_code, br.access_card_code) AS code
       FROM beneficiaries b
       LEFT JOIN households h ON h.id = b.household_id
       LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id
       WHERE b.person_id = $1
         AND COALESCE(h.access_card_code, br.access_card_code) IS NOT NULL`,
      [personId],
    );
    const cardCodes = (cards as Array<{ code: string }>).map(c => c.code);

    // 1. Access card services (logged by any agency/office) → "who got what, from which office".
    const cardServices = cardCodes.length
      ? await this.benRepo.manager.query(
          `SELECT acs.access_card_code AS "cardCode",
                  acs.service_rendered AS service,
                  acs.service_date AS date,
                  COALESCE(acs.cost, 0) AS amount,
                  a.id AS "agencyId", a.code AS "agencyCode", a.name AS "agencyName",
                  acs.category
           FROM access_card_services acs
           LEFT JOIN agencies a ON a.id = acs.agency_id
           WHERE acs.access_card_code = ANY($1)
           ORDER BY acs.service_date DESC`,
          [cardCodes],
        )
      : [];

    // 2. MSWDO case interventions (financial aid / relief) — default facility = MSWDO.
    const interventions = await this.benRepo.manager.query(
      `SELECT ci.id, ci.service_name AS service,
              ci.delivery_date AS date,
              COALESCE(ci.amount, 0) AS amount,
              ci.fund_source AS "fundSource",
              'MSWDO' AS "agencyCode", 'MSWDO Norzagaray' AS "agencyName",
              'MSWDO' AS "agencyId"
       FROM case_interventions ci
       JOIN cases c ON c.id::text = ci.case_id
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       WHERE b.person_id = $1
       ORDER BY ci.delivery_date DESC NULLS LAST`,
      [personId],
    );

    // 3. Inter-agency referrals involving this person (activity across offices).
    const referrals = await this.benRepo.manager.query(
      `SELECT ir.id, ir.status,
              ir.reason, ir.outcome,
              ir.created_at AS date,
              f.id AS "fromAgencyId", f.code AS "fromAgencyCode", f.name AS "fromAgencyName",
              t.id AS "toAgencyId", t.code AS "toAgencyCode", t.name AS "toAgencyName"
       FROM inter_agency_referrals ir
       LEFT JOIN agencies f ON f.id = ir.from_agency_id
       LEFT JOIN agencies t ON t.id = ir.to_agency_id
       WHERE ir.person_id = $1
       ORDER BY ir.created_at DESC`,
      [personId],
    );

    // Build per-facility records, then apply the agency scope.
    const rows: Array<{
      date: string | null;
      type: string;
      service: string;
      amount: number;
      agencyId: string;
      agencyCode: string;
      agencyName: string;
      category?: string;
    }> = [];
    for (const s of cardServices as any[]) {
      rows.push({
        date: s.date ? new Date(s.date).toISOString().slice(0, 10) : null,
        type: 'service',
        service: s.service,
        amount: Number(s.amount) || 0,
        agencyId: s.agencyId || 'UNASSIGNED',
        agencyCode: s.agencyCode || '—',
        agencyName: s.agencyName || 'Unassigned office',
        category: s.category,
      });
    }
    for (const i of interventions as any[]) {
      rows.push({
        date: i.date ? String(i.date).slice(0, 10) : null,
        type: 'intervention',
        service: i.service,
        amount: Number(i.amount) || 0,
        agencyId: i.agencyId,
        agencyCode: i.agencyCode,
        agencyName: i.agencyName,
        category: i.fundSource,
      });
    }

    const scopedRows = isMswdo
      ? rows
      : rows.filter(r => r.agencyId === callerAgency || r.agencyId === 'UNASSIGNED');

    const byAgency = new Map<string, { agency: string; agencyCode: string; type: string; serviceCount: number; totalAmount: number; services: typeof rows }>();
    for (const r of scopedRows) {
      const key = `${r.agencyId}|${r.agencyName}`;
      let bucket = byAgency.get(key);
      if (!bucket) {
        bucket = {
          agency: r.agencyName,
          agencyCode: r.agencyCode,
          type: 'facility',
          serviceCount: 0,
          totalAmount: 0,
          services: [],
        };
        byAgency.set(key, bucket);
      }
      bucket.serviceCount += 1;
      bucket.totalAmount += r.amount;
      bucket.services.push(r);
    }

    const totalAidAmount = scopedRows.reduce((sum, r) => sum + r.amount, 0);
    const facilityList = Array.from(byAgency.values());
    const multiFacilityDetected = facilityList.length > 1;

    return {
      person: { id: personId },
      totalAidAmount,
      distinctFacilities: facilityList.length,
      multiFacilityDetected,
      byAgency: facilityList,
      services: scopedRows,
      referrals,
    };
  }

  async findForCase(caseId: string, caller: User) {
    if (caller.role === 'admin') {
      return this.repo.find({
        where: { caseId },
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'person', 'case'],
      });
    }
    const where: { caseId: string; fromAgencyId?: string; toAgencyId?: string; createdBy?: string }[] = [];
    if (caller.agencyId) {
      where.push({ caseId, fromAgencyId: caller.agencyId });
      where.push({ caseId, toAgencyId: caller.agencyId });
    }
    if (caller.role === UserRole.SW) {
      // Unlinked MSWDO staff see referrals they created from the case workflow.
      where.push({ caseId, createdBy: caller.id });
    }
    if (where.length === 0) return [];
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['fromAgency', 'toAgency', 'person', 'case'],
    });
  }

  async searchBeneficiaries(q: string, caller: User) {
    if (!q.trim()) return [];
    if (caller.role !== 'admin' && !caller.agencyId) return [];

    const escaped = q.trim().replace(/[%_]/g, (m) => '\\' + m);

    const qb = this.repo
      .createQueryBuilder('r')
      .innerJoin(Beneficiary, 'b', 'b.person_id = r.person_id')
      .innerJoin(Person, 'p', 'p.id = b.person_id')
      .leftJoin(Household, 'h', 'h.id = b.household_id')
      .select('b.id', 'id')
      .distinct()
      .addSelect(
        `TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.surname, '')))`,
        'full_name',
      )
      .addSelect(`COALESCE(h.access_card_code, p.philsys_number)`, 'control_no')
      .addSelect('h.barangay', 'barangay')
      .addSelect('p.surname', 'surname')
      .where(
        `(p.first_name ILIKE :q ESCAPE '\\' OR p.surname ILIKE :q ESCAPE '\\')`,
        { q: `%${escaped}%` },
      )
      .orderBy('p.surname', 'ASC')
      .limit(10);

    if (caller.role !== 'admin') {
      qb.andWhere('(r.from_agency_id = :agencyId OR r.to_agency_id = :agencyId)', {
        agencyId: caller.agencyId,
      });
    }

    const rows = await qb.getRawMany<{
      id: string;
      full_name: string;
      control_no: string | null;
      barangay: string | null;
    }>();
    return rows.map(r => ({
      id: r.id,
      fullName: r.full_name,
      controlNo: r.control_no ?? null,
      barangay: r.barangay ?? null,
    }));
  }

  async receive(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'received');
    ref.status = 'received';
    ref.receivedAt = new Date();
    const saved = await this.repo.save(ref);
    try {
      await this.notifyCreator(saved);
    } catch (err) {
      this.logger.warn(`Failed to send referral notification: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  async action(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'actioned');
    ref.status = 'actioned';
    ref.actionedAt = new Date();
    const saved = await this.repo.save(ref);
    try {
      await this.notifyCreator(saved);
    } catch (err) {
      this.logger.warn(`Failed to send referral notification: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  async close(id: string, caller: User, dto: CloseReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'closed');
    ref.status = 'closed';
    ref.outcome = dto.outcome;
    ref.closedAt = new Date();
    const saved = await this.repo.save(ref);
    try {
      await this.notifyCreator(saved);
    } catch (err) {
      this.logger.warn(`Failed to send referral notification: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  async decline(id: string, caller: User, dto: DeclineReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'declined');
    ref.status = 'declined';
    ref.declinedReason = dto.declinedReason;
    const saved = await this.repo.save(ref);
    try {
      await this.notifyCreator(saved);
    } catch (err) {
      this.logger.warn(`Failed to send referral notification: ${err instanceof Error ? err.message : err}`);
    }
    return saved;
  }

  async promoteToCase(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    if (ref.caseId) throw new ConflictException('Referral already linked to a case');
    if (ref.status === 'closed' || ref.status === 'declined') {
      throw new ConflictException(`Cannot promote a "${ref.status}" referral to a case`);
    }
    const ben = await this.benRepo.findOne({ where: { personId: ref.personId } });
    if (!ben) throw new ConflictException('No beneficiary found for the referred person');
    const created = await this.casesService.create({
      beneficiaryId: ben.id,
      serviceRequested: [ref.reason],
      assignedWorkerId: caller.id,
    });
    ref.caseId = created.id;
    ref.status = 'actioned';
    ref.actionedAt = new Date();
    await this.repo.save(ref);
    return created;
  }

  private async notifyCreator(ref: InterAgencyReferral) {
    if (ref.createdBy) {
      await this.notifService.create({
        recipientId: ref.createdBy,
        title: 'Inter-Agency Referral Update',
        message: `Referral #${ref.id.slice(0, 8)} was ${ref.status} by the receiving agency.`,
        category: NotificationCategory.CASE_UPDATE,
        channel: NotificationType.IN_APP,
      });
    }
  }

  private async notifyAgency(agencyId: string, title: string, message: string) {
    const staff = await this.userRepo.find({ where: { agencyId, role: UserRole.AGENCY_STAFF } });
    for (const s of staff) {
      await this.notifService.create({
        recipientId: s.id,
        title,
        message,
        category: NotificationCategory.CASE_UPDATE,
        channel: NotificationType.IN_APP,
      });
    }
  }

  private async resolvePersonId(dto: CreateInterAgencyReferralInput): Promise<string> {
    if (dto.beneficiaryId) {
      const ben = await this.benRepo.findOne({ where: { id: dto.beneficiaryId } });
      if (!ben?.personId) throw new UnprocessableEntityException('Beneficiary has no linked person');
      return ben.personId;
    }
    if (dto.caseId) {
      const c = await this.caseRepo.findOne({ where: { id: dto.caseId } });
      if (!c?.beneficiaryId) throw new UnprocessableEntityException('Case has no beneficiary');
      const ben = await this.benRepo.findOne({ where: { id: c.beneficiaryId } });
      if (!ben?.personId) throw new UnprocessableEntityException('Case has no linked person');
      return ben.personId;
    }
    return dto.personId as string;
  }

  private async getScoped(id: string, caller: User): Promise<InterAgencyReferral> {
    const ref = await this.repo.findOne({ where: { id } });
    if (!ref) throw new NotFoundException('Referral not found');
    if (
      caller.role !== 'admin' &&
      caller.agencyId !== ref.fromAgencyId &&
      caller.agencyId !== ref.toAgencyId
    ) {
      throw new ForbiddenException('Referral is not associated with your agency');
    }
    return ref;
  }

  private assertReceiver(ref: InterAgencyReferral, caller: User) {
    if (caller.role !== 'admin' && caller.agencyId !== ref.toAgencyId) {
      throw new ForbiddenException('Only the receiving agency can update this referral');
    }
  }

  private assertTransition(current: InterAgencyReferralStatus, next: InterAgencyReferralStatus) {
    const allowed = TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ConflictException(
        `Cannot transition from "${current}" to "${next}". Allowed: ${allowed?.join(', ') || 'none'}`,
      );
    }
  }
}
