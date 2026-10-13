import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { middleInitialOf } from '../common/person-name';
import { Case } from '../cases/case.entity';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { IssueEndorsementLetterInput } from './dto/inter-agency-referrals.zod';
import { buildEndorsementLetterPdf, EndorsementLetterData } from './endorsement-letter.builder';

/**
 * The module's whole surface is the endorsement letter: issuing it records the
 * referral (the letter is a read of that row, so it has to outlive the action),
 * and re-downloading it needs the id. Nothing else in the old lifecycle —
 * receive/action/close/decline, consent, legal basis, benefit ledger — exists
 * anymore.
 */
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
  ) {}

  // MSWDO staff are not linked to an agency on production accounts; issuing a
  // letter substitutes the MSWDO agency as fromAgencyId for them. `isMswdoStaff`
  // names that caller so issue can place the referral, and it is the *only*
  // place "unlinked MSWDO" is decided.
  //
  // The `!agencyId` half is load-bearing: a worker who *is* linked to a partner
  // agency (RHU, LTO, …) is agency staff, and must stay scoped to their own
  // referrals. Only the unlinked MSWDO roles are exempt.
  private isMswdoStaff(caller: User): boolean {
    if (caller.agencyId) return false;
    return caller.role === UserRole.ADMIN || caller.role === UserRole.SW;
  }

  /**
   * The one rule for "may this caller see this referral", stated once.
   *
   * Every read of a referral row goes through it: the by-case list and the
   * endorsement letter. It had three near-copies, and the drift is what
   * produced the letter's authorization bug: the letter asked `isMswdoStaff`,
   * which exempts an unlinked MSWDO worker from agency scoping *entirely*, so
   * it handed out the letter for referrals the worker had no link to at all.
   *
   * The three answers, in order, and none of them is a role shortcut:
   *  - an admin sees every referral, agency-linked or not.
   *  - otherwise a participating agency — sender or receiver — sees it.
   *  - otherwise the social worker who created it sees it.
   */
  private referralVisibleTo(
    ref: Pick<InterAgencyReferral, 'fromAgencyId' | 'toAgencyId' | 'createdBy'>,
    caller: User,
  ): boolean {
    if (caller.role === UserRole.ADMIN) return true;
    if (caller.agencyId && (ref.fromAgencyId === caller.agencyId || ref.toAgencyId === caller.agencyId)) return true;
    return caller.role === UserRole.SW && ref.createdBy === caller.id;
  }

  async issueEndorsementLetter(
    caseId: string,
    dto: IssueEndorsementLetterInput,
    caller: User,
  ): Promise<{ referral: InterAgencyReferral; pdf: Buffer }> {
    let fromAgencyId = caller.agencyId as string | undefined;
    if (this.isMswdoStaff(caller)) {
      const mswdo = await this.agencyRepo.findOne({ where: { code: 'MSWDO', isActive: true } });
      if (mswdo) fromAgencyId = mswdo.id;
    }
    if (!fromAgencyId) {
      throw new ForbiddenException('Your account is not linked to an agency');
    }
    const toAgency = await this.agencyRepo.findOne({ where: { id: dto.toAgencyId, isActive: true } });
    if (!toAgency) throw new UnprocessableEntityException('Unknown target agency');
    if (toAgency.id === fromAgencyId) throw new BadRequestException('Cannot refer to your own agency');

    const caseRow = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!caseRow) throw new NotFoundException('Case not found');
    const ben = caseRow.beneficiaryId
      ? await this.benRepo.findOne({ where: { id: caseRow.beneficiaryId } })
      : null;
    const personId = ben?.personId;
    if (!personId) throw new UnprocessableEntityException('Case has no beneficiary person to refer');

    const referral = await this.repo.save(this.repo.create({
      caseId,
      personId,
      fromAgencyId,
      toAgencyId: toAgency.id,
      reason: dto.reason,
      notes: dto.notes,
      createdBy: caller.id,
    }));

    const pdf = await this.endorsementLetterPdf(referral.id, caller);
    return { referral, pdf };
  }

  async endorsementLetterPdf(referralId: string, caller: User): Promise<Buffer> {
    const ref = await this.repo.findOne({
      where: { id: referralId },
      relations: ['toAgency', 'fromAgency', 'case', 'person'],
    });
    if (!ref) throw new NotFoundException('Referral not found');
    // The letter is a read of this row, so it is scoped by `referralVisibleTo`.
    if (!this.referralVisibleTo(ref, caller)) {
      throw new ForbiddenException('Referral is not associated with your agency');
    }

    const mswdo = await this.agencyRepo.findOne({ where: { code: 'MSWDO', isActive: true } });
    const officeName = mswdo?.name || 'MSWDO Norzagaray';

    const person = ref.person;
    const nameParts = [
      person?.firstName,
      middleInitialOf(person?.middleName),
      person?.surname,
      person?.extension,
    ].filter((p): p is string => Boolean(p));
    const beneficiaryName = nameParts.join(' ').trim() || 'Client';

    const data: EndorsementLetterData = {
      officeName,
      letterNo: ref.case?.controlNo || ref.id.slice(0, 8).toUpperCase(),
      dateLabel: new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
      toAgencyName: ref.toAgency?.name || ref.toAgencyId,
      beneficiaryName,
      caseCategory: ref.case?.clientCategory,
      reason: ref.reason,
      notes: ref.notes,
      preparedBy: caller.fullName || 'MSWDO',
      preparedByRole: caller.role === 'admin' ? 'MSWDO Admin' : caller.role === 'social_worker' ? 'MSWDO Social Worker' : undefined,
    };

    return buildEndorsementLetterPdf(data);
  }

  async findForCase(caseId: string, caller: User) {
    // The row-set form of `referralVisibleTo`, because TypeORM ORs an array of
    // `where` objects rather than testing them per row. `[]` means unscoped,
    // which is only correct for the admin case `referralVisibleTo` also waves
    // through.
    if (caller.role === UserRole.ADMIN) {
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

  /** One referral by id, for the revocation route's seal check. */
  async findById(referralId: string) {
    const row = await this.repo.findOne({ where: { id: referralId } });
    if (!row) throw new NotFoundException('Referral not found');
    return row;
  }

  /** Revoke a referral. The controller guards the referrals step's seal first. */
  async remove(referralId: string): Promise<{ deleted: boolean }> {
    const row = await this.findById(referralId);
    await this.repo.remove(row);
    return { deleted: true };
  }
}