import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './person.entity';
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';
import { Beneficiary } from './beneficiary.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { HouseholdMembership } from './household-membership.entity';
import { Case } from '../cases/case.entity';
const FAMILY_MEMBER_LIMIT = 50;
@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(BeneficiaryRole)
    private roleRepo: Repository<BeneficiaryRole>,
    @InjectRepository(BeneficiaryClaimant)
    private bcRepo: Repository<BeneficiaryClaimant>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    @InjectRepository(HouseholdMembership)
    private hmRepo: Repository<HouseholdMembership>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}

  async createBeneficiary(data: {
    surname: string; firstName: string; middleName?: string;
    gender: string; dob: Date; address?: string; phone?: string;
    philsysNumber?: string; householdId?: string;
  }) {
    const buildPerson = (): Person => {
      const person = this.personRepo.create({
        surname: data.surname,
        firstName: data.firstName,
        middleName: data.middleName,
        gender: data.gender as 'Male' | 'Female',
        dob: data.dob,
        philsysNumber: data.philsysNumber,
      });
      person.contacts = data.phone ? [{ personId: undefined as any, contactType: 'phone', value: data.phone, isPrimary: true } as PersonContact] : [];
      person.addresses = data.address ? [{ personId: undefined as any, addressType: 'current', raw: data.address, isPrimary: true } as PersonAddress] : [];
      return person;
    };

    let savedPerson: Person;
    if (data.philsysNumber) {
      const existing = await this.personRepo.findOne({ where: { philsysNumber: data.philsysNumber } });
      if (existing) {
        savedPerson = existing;
      } else {
        savedPerson = await this.personRepo.save(buildPerson());
      }
    } else {
      savedPerson = await this.personRepo.save(buildPerson());
    }

    const ben = this.benRepo.create({
      personId: savedPerson.id,
      householdId: data.householdId,
    });
    await this.benRepo.save(ben);

    const existingRole = await this.roleRepo.findOne({ where: { personId: savedPerson.id } });
    if (!existingRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          personId: savedPerson.id,
          householdId: data.householdId,
          consentStatus: 'active',
          category: (data as any).category,
        }),
      );
    }

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
    const qb = this.benRepo.createQueryBuilder('b')
      .leftJoinAndSelect('b.person', 'p')
      .leftJoinAndSelect('b.household', 'h')
      .leftJoin('beneficiary_roles', 'br', 'br.person_id = b.person_id');
    if (barangay) {
      qb.andWhere('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
    }
    if (category) {
      qb.andWhere('br.category = :category', { category });
    }
    if (search && search.length >= 2) {
      if (search.length >= 3) {
        qb.andWhere(
          `(p.search_vector @@ plainto_tsquery('english', :search)
            OR similarity(p.surname, :search) > 0.3
            OR similarity(p.first_name, :search) > 0.3
            OR br.category ILIKE :categoryMatch
            OR EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :addressMatch OR pa2.raw ILIKE :addressMatch)))`,
          { search, categoryMatch: `%${search}%`, addressMatch: `%${search}%` },
        );
        qb.addSelect(
          `COALESCE(ts_rank(p.search_vector, plainto_tsquery('english', :search2)), 0) +
          COALESCE(similarity(p.surname, :search2), 0) +
          COALESCE(similarity(p.first_name, :search2), 0)`,
          'rank',
        ).orderBy('rank', 'DESC');
        qb.setParameters({ search, search2: search, categoryMatch: `%${search}%` });
      } else {
        qb.andWhere(
          `(p.search_vector @@ plainto_tsquery('english', :search)
            OR p.surname ILIKE :like
            OR p.first_name ILIKE :like
            OR EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :like OR pa2.raw ILIKE :like)))`,
          { search, like: `%${search}%` },
        );
        qb.orderBy('ts_rank(p.search_vector, plainto_tsquery(:search))', 'DESC');
      }
    }

    paginate(qb, page, limit);
    const [data, total] = await qb.getManyAndCount();

    // Enrich with family member counts from household_memberships
    const householdIds = data
      .map(b => b.household?.id)
      .filter((id): id is string => !!id);
    if (householdIds.length > 0) {
      const counts: Array<{ household_id: string; cnt: string }> = await this.benRepo.query(
        `SELECT hm.household_id, COUNT(*)::text AS cnt
         FROM household_memberships hm
         WHERE hm.household_id = ANY($1)
         GROUP BY hm.household_id`,
        [householdIds],
      );
      const countMap = new Map(counts.map(r => [r.household_id, parseInt(r.cnt, 10)]));
      for (const b of data) {
        if (b.household?.id) {
          (b.household as any).familyMemberCount = countMap.get(b.household.id) || 0;
        }
      }
    }

    return { data, total };
  }

  async findByUserId(userId: string) {
    return this.benRepo.findOne({ where: { userId }, relations: ['person'] });
  }

  async findById(id: string) {
    const ben = await this.benRepo.findOne({ where: { id }, relations: ['household', 'person'] });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    return ben;
  }

  async getClaimant(beneficiaryId: string): Promise<{ person: Person; relationship: string } | null> {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId }, select: ['id', 'personId'] });
    if (!ben || !ben.personId) return null;
    const bc = await this.bcRepo.findOne({ where: { beneficiaryId: ben.personId }, relations: ['claimant'] });
    if (!bc || !bc.claimant) return null;
    const samePerson = bc.claimantId === ben.personId;
    if (samePerson) return null;
    return { person: bc.claimant, relationship: bc.relationship };
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
      select: ['id', 'householdId', 'personId'],
    });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    if (!ben.householdId) return { primary: null, members: [], totalCount: 0 };

    const person = await this.personRepo.findOne({
      where: { id: ben.personId },
      select: ['id', 'surname', 'firstName', 'middleName', 'dob', 'occupation', 'estimatedMonthlyIncome'],
    });

    const primaryMember = person ? {
      id: `primary-${ben.id}`,
      fullName: `${person.firstName} ${person.middleName ? person.middleName + ' ' : ''}${person.surname}`.trim(),
      relationship: 'Self',
      age: person.age ?? 0,
      occupation: person.occupation ?? null,
      income: person.estimatedMonthlyIncome != null ? Number(person.estimatedMonthlyIncome) : null,
      status: null,
      isPrimary: true,
      depth: 0,
    } : null;

    const members = await this.hmRepo.query(
      `SELECT hm.id,
              TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name || ' ', ''), p.surname)) AS full_name,
              hm.relationship, EXTRACT(YEAR FROM AGE(NOW(), p.dob))::integer AS age, p.occupation, p.estimated_monthly_income AS income,
              hm.status, hm.is_primary
       FROM household_memberships hm
       JOIN persons p ON p.id = hm.person_id
       WHERE hm.household_id = $1
       ORDER BY hm.is_primary DESC, p.surname, p.first_name
       LIMIT $2`,
      [ben.householdId, FAMILY_MEMBER_LIMIT],
    );

    const camelCase = (m: any) => ({
      id: m.id,
      fullName: m.full_name,
      relationship: m.relationship,
      age: m.age,
      occupation: m.occupation,
      income: m.income != null ? Number(m.income) : null,
      status: m.status || null,
      isPrimary: m.is_primary,
      depth: 0,
    });
    const mapped = members.map(camelCase);

    const allMembers = primaryMember ? [primaryMember, ...mapped] : mapped;
    const primary = primaryMember || allMembers[0] || null;
    return { primary, members: allMembers, totalCount: allMembers.length };
  }

  async revokeConsent(beneficiaryId: string, body: { reason?: string }) {
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

    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId }, select: ['id', 'personId'] });
    if (ben?.personId) {
      await this.roleRepo.update({ personId: ben.personId }, { consentStatus: 'revoked' });
    }

    return { status: 'revoked', revokedAt: ledger.revokedAt };
  }

  async getMyServices(userId: string) {
    const ben = await this.benRepo.findOne({ where: { userId } });
    if (!ben) return { services: [], caseStatus: 'No active case' };
    const cases = await this.caseRepo.find({ where: { beneficiaryId: ben.id } });
    const latestCase = cases[cases.length - 1];
    return {
      services: [],
      caseStatus: latestCase ? latestCase.status.replace('_', ' ') : 'No active case',
    };
  }

  async getMyConsent(userId: string) {
    const ben = await this.benRepo.findOne({ where: { userId } });
    if (!ben) return [];
    return this.consentRepo.find({ where: { beneficiaryId: ben.id }, order: { grantedAt: 'DESC' } });
  }

  async getAccessCard(userId: string) {
    const ben = await this.benRepo.findOne({ where: { userId }, relations: ['person', 'household'] });
    if (!ben || !ben.household?.accessCardCode) {
      throw new NotFoundException('No Access Card found. Please contact the MSWDO office.');
    }
    return {
      code: ben.household.accessCardCode,
      beneficiary: {
        name: (ben.person?.firstName || '') + ' ' + (ben.person?.surname || ''),
        barangay: (ben.person?.address || '').split(',').pop()?.trim(),
      },
      services: [],
      remainingSlots: 18,
    };
  }

  async checkConsent(beneficiaryId: string, purpose: string): Promise<boolean> {
    const record = await this.consentRepo.findOne({
      where: { beneficiaryId, purpose, status: 'active' },
    });
    return !!record;
  }
}
