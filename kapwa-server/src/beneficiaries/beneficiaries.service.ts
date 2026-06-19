import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Beneficiary } from './beneficiary.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { FamilyMember } from './family-member.entity';
import { Case } from '../cases/case.entity';
import { Intervention } from '../interventions/intervention.entity';

const FAMILY_MEMBER_LIMIT = 50;
@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    @InjectRepository(FamilyMember)
    private familyMemberRepo: Repository<FamilyMember>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(Intervention)
    private intRepo: Repository<Intervention>,
  ) {}

  async createBeneficiary(data: Partial<Beneficiary>) {
    const ben = this.benRepo.create({
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      gender: data.gender,
      dob: data.dob,
      address: data.address,
      phone: data.phone,
      philsysNumber: data.philsysNumber,
      accessCardCode: data.accessCardCode,
      householdId: data.householdId,
      consentStatus: 'active',
    });
    await this.benRepo.save(ben);

    await this.consentRepo.save({
      beneficiaryId: ben.id,
      purpose: 'registration',
      channel: 'web',
      status: 'active',
    });

    return ben;
  }

  async findAll(
    barangay?: string,
    search?: string,
    page = 1,
    limit = DEFAULT_LIST_LIMIT,
    category?: string,
  ) {
    const qb = this.benRepo.createQueryBuilder('b').leftJoinAndSelect('b.household', 'h');
    if (barangay) {
      qb.andWhere('b.address ILIKE :barangay', { barangay: `%${barangay}%` });
    }
    if (category) {
      qb.andWhere('b.category = :category', { category });
    }
    if (search && search.length >= 2) {
      if (search.length >= 3) {
        // Full trigram + tsvector path: similarity() for typo tolerance, ts_rank for BM25 ranking
        qb.andWhere(
          `(b.search_vector @@ plainto_tsquery('english', :search)
            OR similarity(b.surname, :search) > 0.3
            OR similarity(b.first_name, :search) > 0.3
            OR b.category ILIKE :categoryMatch)`,
          { search, categoryMatch: `%${search}%` },
        );

        qb.addSelect(
          `COALESCE(ts_rank(b.search_vector, plainto_tsquery('english', :search2)), 0) +
          COALESCE(similarity(b.surname, :search2), 0) +
          COALESCE(similarity(b.first_name, :search2), 0)`,
          'rank',
        ).orderBy('rank', 'DESC');

        qb.setParameters({ search, search2: search, categoryMatch: `%${search}%` });
      } else {
        // Short query (2 chars): tsvector + ILIKE fallback only; no trigram to avoid
        // false positives per RESEARCH.md Pitfall 3
        qb.andWhere(
          `(b.search_vector @@ plainto_tsquery('english', :search)
            OR b.surname ILIKE :like
            OR b.first_name ILIKE :like)`,
          { search, like: `%${search}%` },
        );
        qb.orderBy('ts_rank(b.search_vector, plainto_tsquery(:search))', 'DESC');
      }
    }
    paginate(qb, page, limit);
    return qb.getMany();
  }

  async findById(id: string) {
    const ben = await this.benRepo.findOne({ where: { id }, relations: ['household'] });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    return ben;
  }

  async update(id: string, data: Partial<Beneficiary>) {
    const ben = await this.findById(id);
    Object.assign(ben, data, { updatedAt: new Date() });
    await this.benRepo.save(ben);
    return ben;
  }

  async getFamilyGraph(beneficiaryId: string) {
    const ben = await this.benRepo.findOne({
      where: { id: beneficiaryId },
      select: ['id', 'householdId'],
    });
    if (!ben) throw new NotFoundException('Beneficiary not found');

    // Recursive CTE up to 2 degrees with consent filtering
    const members = await this.familyMemberRepo.query(
      `WITH RECURSIVE family_tree AS (
        -- Base: direct household members
        SELECT fm.id, fm.full_name, fm.relationship, fm.age,
               fm.status_income, fm.is_primary, fm.household_id, 0 AS depth
        FROM family_members fm
        JOIN households h ON h.id = fm.household_id
        WHERE h.primary_beneficiary_id = $1

        UNION

        -- Recursive: members of linked households within 2 degrees
        SELECT fm.id, fm.full_name, fm.relationship, fm.age,
               fm.status_income, fm.is_primary, fm.household_id, ft.depth + 1
        FROM family_members fm
        JOIN households h ON h.id = fm.household_id
        JOIN family_tree ft ON ft.depth < 2
          AND fm.household_id != ft.household_id
          AND EXISTS (
            SELECT 1 FROM beneficiaries b
            WHERE b.household_id = fm.household_id
              AND b.consent_status = 'active'
          )
      )
      SELECT DISTINCT id, full_name, relationship, age,
             status_income, is_primary, depth
      FROM family_tree
      ORDER BY depth, is_primary DESC, full_name
      LIMIT $2`,
      [beneficiaryId, FAMILY_MEMBER_LIMIT],
    );

    const primary = members.find((m: any) => m.isPrimary) || members[0] || null;
    return { primary, members, totalCount: members.length };
  }

  async revokeConsent(beneficiaryId: string, body: { reason?: string }) {
    // Find most recent active consent ledger entry
    const ledger = await this.consentRepo.findOne({
      where: { beneficiaryId, status: 'active' },
      order: { grantedAt: 'DESC' as any },
    });
    if (!ledger) {
      throw new NotFoundException('No active consent found for this beneficiary');
    }

    ledger.status = 'revoked';
    ledger.revokedAt = new Date();
    if (body.reason) (ledger as any).revokedReason = body.reason;
    await this.consentRepo.save(ledger);

    await this.benRepo.update(beneficiaryId, { consentStatus: 'revoked' } as any);

    return { status: 'revoked', revokedAt: ledger.revokedAt };
  }

  async getMyServices(userId: string) {
    const ben = await this.benRepo.findOne({ where: { userId } });
    if (!ben) return { services: [], caseStatus: 'No active case' };
    const cases = await this.caseRepo.find({ where: { beneficiaryId: ben.id } });
    const latestCase = cases[cases.length - 1];
    const services = await this.intRepo.find({ where: { caseId: In(cases.map(c => c.id)) }, order: { loggedAt: 'DESC' } });
    return {
      services: services.map(s => ({ id: s.id, type: s.interventionType, date: s.serviceDate, amount: s.amount, status: 'completed' })),
      caseStatus: latestCase ? latestCase.status.replace('_', ' ') : 'No active case',
    };
  }

  async getMyConsent(userId: string) {
    const ben = await this.benRepo.findOne({ where: { userId } });
    if (!ben) return [];
    return this.consentRepo.find({ where: { beneficiaryId: ben.id }, order: { grantedAt: 'DESC' } });
  }

  async checkConsent(beneficiaryId: string, purpose: string): Promise<boolean> {
    const record = await this.consentRepo.findOne({
      where: {
        beneficiaryId,
        purpose,
        status: 'active',
      },
    });
    return !!record;
  }
}
