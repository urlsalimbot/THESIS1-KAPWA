import { DEFAULT_LIST_LIMIT, paginate } from '../common/constants';
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service';
import { Person } from './person.entity';
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';
import { Beneficiary } from './beneficiary.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { HouseholdMembership } from './household-membership.entity';
import { Household } from './household.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
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
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  // Resolves the beneficiary a claimant owns. Prefers the stamped
  // beneficiaries.user_id; falls back to the beneficiary_claimants person link
  // so a claimant representing a 2nd beneficiary still resolves.
  private async resolveMyBeneficiary(userId: string): Promise<Beneficiary | null> {
    const direct = await this.benRepo.findOne({ where: { userId }, order: { createdAt: 'ASC' } });
    if (direct) return direct;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.personId) return null;
    const link = await this.bcRepo.findOne({ where: { claimantId: user.personId }, order: { createdAt: 'ASC' } });
    if (!link) return null;
    return this.benRepo.findOne({ where: { id: link.beneficiaryId } });
  }

  async createBeneficiary(
    data: {
    surname: string; firstName: string; middleName?: string;
    gender: string; dob: Date; address?: string; phone?: string;
    philsysNumber?: string; householdId?: string;
    occupation?: string; civilStatus?: string; placeOfBirth?: string;
    estimatedMonthlyIncome?: number; philhealthNumber?: string; category?: string;
  },
    actorId?: string,
  ) {
    const buildPerson = (): Person => {
      const person = this.personRepo.create({
        surname: data.surname,
        firstName: data.firstName,
        middleName: data.middleName,
        gender: data.gender as 'Male' | 'Female',
        dob: data.dob,
        philsysNumber: data.philsysNumber,
        occupation: data.occupation,
        civilStatus: data.civilStatus,
        placeOfBirth: data.placeOfBirth,
        estimatedMonthlyIncome: data.estimatedMonthlyIncome,
        philhealthNumber: data.philhealthNumber,
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

    await this.auditLog?.log('beneficiary.create', ben.id, actorId, {
      personId: savedPerson.id,
      category: (data as any).category,
      surname: data.surname,
      firstName: data.firstName,
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
      .leftJoinAndSelect('p.roles', 'roles')
      .leftJoinAndSelect('b.household', 'h');
    if (barangay) {
      qb.andWhere('EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND (pa2.barangay ILIKE :barangay OR pa2.raw ILIKE :barangay))', { barangay: `%${barangay}%` });
    }
    if (category) {
      qb.andWhere('roles.category = :category', { category });
    }
    if (search && search.length >= 2) {
      if (search.length >= 3) {
        qb.andWhere(
          `(p.search_vector @@ plainto_tsquery('english', :search)
            OR similarity(p.surname, :search) > 0.3
            OR similarity(p.first_name, :search) > 0.3
            OR roles.category ILIKE :categoryMatch
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

    // Enrich with the client category from the beneficiary's latest case: the
    // assessment sets cases.client_category, while beneficiary_roles.category is
    // usually empty, so the list column would otherwise always show "—".
    const benIds = data.map(b => b.id).filter(Boolean);
    if (benIds.length > 0) {
      try {
        const cats: Array<{ beneficiary_id: string; client_category: string }> = await this.benRepo.query(
          `SELECT DISTINCT ON (beneficiary_id) beneficiary_id, client_category
             FROM cases
            WHERE beneficiary_id = ANY($1::uuid[]) AND client_category IS NOT NULL
            ORDER BY beneficiary_id, created_at DESC`,
          [benIds],
        );
        const catMap = new Map(cats.map(r => [r.beneficiary_id, r.client_category]));
        for (const b of data) {
          (b as any).clientCategory = catMap.get(b.id) ?? undefined;
        }
      } catch {
        // Enrichment only — never fail the list because the category lookup failed.
      }
    }

    return { data, total };
  }

  async findByUserId(userId: string) {
    return this.resolveMyBeneficiary(userId);
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

  async setHouseholdNhtsPr(
    beneficiaryId: string,
    nhtsPrId?: string | null,
  ): Promise<{ householdId: string; nhtsPrId: string | null }> {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId }, relations: ['household'] });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    if (!ben.household) throw new NotFoundException('Beneficiary has no household');
    const value = nhtsPrId ? nhtsPrId.trim() : null;
    await this.benRepo.manager.update(Household, ben.household.id, { nhtsPrId: value } as any);
    return { householdId: ben.household.id, nhtsPrId: value };
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
      surname: person.surname,
      firstName: person.firstName,
      middleName: person.middleName ?? null,
      extension: person.extension ?? null,
      gender: person.gender ?? null,
      dob: person.dob instanceof Date ? person.dob.toISOString().slice(0, 10) : null,
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
              p.surname, p.first_name, p.middle_name, p.extension, p.gender,
              p.dob::date AS dob,
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
      surname: m.surname,
      firstName: m.first_name,
      middleName: m.middle_name,
      extension: m.extension,
      gender: m.gender,
      dob: m.dob ? String(m.dob).slice(0, 10) : null,
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
    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) return { services: [], caseStatus: 'No active case', case: null };
    const cases = await this.caseRepo.find({
      where: { beneficiaryId: ben.id },
      relations: ['assignedWorker'],
      order: { createdAt: 'DESC' },
    });
    const latestCase = cases[0];
    if (!latestCase) return { services: [], caseStatus: 'No active case', case: null };

    const interventions = await this.caseRepo.manager.query(
      `SELECT id, service_name AS "serviceName", delivery_date AS "deliveryDate", amount
       FROM case_interventions WHERE case_id = $1
       ORDER BY delivery_date DESC`,
      [latestCase.id],
    );
    const services = interventions.map((iv: any) => ({
      id: iv.id,
      type: iv.serviceName,
      date: iv.deliveryDate ? new Date(iv.deliveryDate).toISOString() : latestCase.createdAt.toISOString(),
      amount: Number(iv.amount) || 0,
      status: 'completed',
    }));

    const worker = latestCase.assignedWorker;
    return {
      services,
      caseStatus: latestCase.status.replace('_', ' '),
      case: {
        id: latestCase.id,
        controlNo: latestCase.controlNo,
        status: latestCase.status,
        serviceRequested: latestCase.serviceRequested || [],
        createdAt: latestCase.createdAt,
        updatedAt: latestCase.updatedAt,
        amountAssistance: latestCase.amountAssistance != null ? Number(latestCase.amountAssistance) : null,
        assignedWorkerName: worker
          ? worker.fullName || [worker.firstName, worker.lastName].filter(Boolean).join(' ')
          : latestCase.assignedWorkerName || null,
      },
    };
  }

  // Documentary needs for the claimant's own case. The client can upload a
  // document remotely against a specific need; it then shows as pending until
  // MSWDO staff confirm it on-site (or the client passes it on-site directly).
  async getMyRequirements(userId: string) {
    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) return { case: null, requirements: [] };
    const cases = await this.caseRepo.find({
      where: { beneficiaryId: ben.id },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const latestCase = cases[0];
    if (!latestCase) return { case: null, requirements: [] };

    const rows = await this.caseRepo.manager.query(
      `SELECT prd.document_key AS key,
              COALESCE(cr.met, FALSE) AS met
         FROM case_interventions ci
         JOIN program_required_documents prd ON prd.program_id = ci.program_id
         LEFT JOIN case_requirements cr
                ON cr.case_id::text = ci.case_id AND cr.requirement_key = prd.document_key
        WHERE ci.case_id = $1
        GROUP BY prd.document_key, cr.met
        ORDER BY prd.document_key`,
      [latestCase.id],
    );

    const docs = await this.caseRepo.manager.query(
      `SELECT id, original_name AS "originalName", requirement_key AS "requirementKey",
              verified_at AS "verifiedAt", created_at AS "createdAt"
         FROM document_vault
        WHERE case_id = $1 AND requirement_key IS NOT NULL
        ORDER BY created_at DESC`,
      [latestCase.id],
    );

    const documentsByKey = new Map<string, any[]>();
    for (const d of docs) {
      const list = documentsByKey.get(d.requirementKey) || [];
      list.push({
        id: d.id,
        originalName: d.originalName,
        verifiedAt: d.verifiedAt,
        createdAt: d.createdAt,
      });
      documentsByKey.set(d.requirementKey, list);
    }

    const requirements = rows.map((r: any) => {
      const documents = documentsByKey.get(r.key) || [];
      return {
        key: r.key,
        // All intervention documents are required; the legacy per-document
        // mandatory flag is no longer used to relax this.
        mandatory: true,
        met: Boolean(r.met),
        documents,
        pendingVerification: documents.some((d) => !d.verifiedAt),
      };
    });

    return {
      case: { id: latestCase.id, controlNo: latestCase.controlNo, status: latestCase.status },
      requirements,
    };
  }

  async getMyConsent(userId: string) {    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) return [];
    return this.consentRepo.find({ where: { beneficiaryId: ben.id }, order: { grantedAt: 'DESC' } });
  }

  // Staff view: consent history for a specific beneficiary.
  async getConsentHistory(beneficiaryId: string) {
    return this.consentRepo.find({ where: { beneficiaryId }, order: { grantedAt: 'DESC' } });
  }

  // Grants (or reinstates) consent: appends a new active ledger row so the
  // revoke/grant trail stays append-only.
  async grantConsent(beneficiaryId: string, body: { purpose?: string; channel?: string }) {
    const ben = await this.benRepo.findOne({ where: { id: beneficiaryId }, select: ['id', 'personId'] });
    if (!ben) throw new NotFoundException('Beneficiary not found');
    const record = await this.consentRepo.save(
      this.consentRepo.create({
        beneficiaryId,
        purpose: body.purpose || 'data_processing',
        channel: body.channel || 'in_person',
        status: 'active',
        grantedAt: new Date(),
      }),
    );
    if (ben.personId) {
      await this.roleRepo.update({ personId: ben.personId }, { consentStatus: 'active' });
    }
    return record;
  }

  async grantMyConsent(userId: string, body: { purpose?: string; channel?: string }) {
    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) throw new NotFoundException('No beneficiary linked to this account');
    return this.grantConsent(ben.id, body);
  }

  // Disbursement records for the claimant: interventions with an amount plus
  // access-card payout entries, each with a receipt reference when available.
  async getMyDisbursements(userId: string) {
    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) return { disbursements: [], total: 0 };
    const rows = await this.caseRepo.manager.query(
      `SELECT ci.id, ci.service_name AS "serviceName", ci.delivery_date AS "date",
              ci.amount, ci.fund_source AS "fundSource", c.control_no AS "controlNo"
         FROM case_interventions ci
         JOIN cases c ON c.id::text = ci.case_id
        WHERE c.beneficiary_id = $1::uuid AND ci.amount IS NOT NULL AND ci.amount > 0
        ORDER BY ci.delivery_date DESC NULLS LAST`,
      [ben.id],
    );
    const disbursements = rows.map((r: any) => ({
      id: r.id,
      controlNo: r.controlNo,
      serviceName: r.serviceName,
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
      amount: Number(r.amount) || 0,
      fundSource: r.fundSource || null,
      receiptUrl: null,
    }));
    const total = disbursements.reduce((sum: number, d: any) => sum + d.amount, 0);
    return { disbursements, total };
  }

  async getAccessCard(userId: string) {
    const ben = await this.resolveMyBeneficiary(userId);
    if (!ben) throw new NotFoundException('No Access Card found. Please contact the MSWDO office.');
    const withHousehold = await this.benRepo.findOne({ where: { id: ben.id }, relations: ['person', 'household'] });
    const resolved = withHousehold || ben;
    const household = (resolved as any).household;
    if (!household?.accessCardCode) {
      throw new NotFoundException('No Access Card found. Please contact the MSWDO office.');
    }
    // The card is the household's accounting ledger — surface its entries so
    // the claimant's /my-access-card view is populated, not empty.
    const rows = await this.caseRepo.manager.query(
      `SELECT service_rendered, service_date, cost, category
       FROM access_card_services
       WHERE access_card_code = $1
       ORDER BY service_date DESC`,
      [household.accessCardCode],
    );
    const services = rows.map((r: any) => ({
      serviceRendered: r.service_rendered,
      serviceDate: r.service_date ? new Date(r.service_date).toISOString().slice(0, 10) : null,
      cost: r.cost != null ? Number(r.cost) : null,
      category: r.category,
    }));
    const person = (resolved as any).person;
    return {
      code: household.accessCardCode,
      beneficiary: {
        name: [person?.firstName, person?.surname].filter(Boolean).join(' '),
        barangay: household?.barangay || (person?.address || '').split(',').pop()?.trim() || '',
      },
      services,
      remainingSlots: Math.max(0, 18 - services.length),
    };
  }

  async checkConsent(beneficiaryId: string, purpose: string): Promise<boolean> {
    const record = await this.consentRepo.findOne({
      where: { beneficiaryId, purpose, status: 'active' },
    });
    return !!record;
  }
}
