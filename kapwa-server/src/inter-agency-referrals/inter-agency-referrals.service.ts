import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesService } from '../cases/cases.service';
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
  ) {}

  async create(dto: CreateInterAgencyReferralInput, caller: User) {
    if (caller.role !== 'admin' && !caller.agencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    const fromAgencyId = caller.agencyId as string;
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
    return this.repo.save(ref);
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

  async findByPerson(personId: string, caller: User) {
    const scoped = await this.findInbox(caller);
    return scoped.filter(r => r.personId === personId);
  }

  async receive(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'received');
    ref.status = 'received';
    ref.receivedAt = new Date();
    return this.repo.save(ref);
  }

  async action(id: string, caller: User) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'actioned');
    ref.status = 'actioned';
    ref.actionedAt = new Date();
    return this.repo.save(ref);
  }

  async close(id: string, caller: User, dto: CloseReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'closed');
    ref.status = 'closed';
    ref.outcome = dto.outcome;
    ref.closedAt = new Date();
    return this.repo.save(ref);
  }

  async decline(id: string, caller: User, dto: DeclineReferralInput) {
    const ref = await this.getScoped(id, caller);
    this.assertReceiver(ref, caller);
    this.assertTransition(ref.status, 'declined');
    ref.status = 'declined';
    ref.declinedReason = dto.declinedReason;
    return this.repo.save(ref);
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
