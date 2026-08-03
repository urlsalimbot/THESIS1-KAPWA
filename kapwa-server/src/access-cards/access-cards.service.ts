import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessCardService } from './access-card-service.entity';
import { Agency } from '../agencies/agency.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { User } from '../auth/user.entity';

const ACCESS_CARD_PAD_WIDTH = 4;
@Injectable()
export class AccessCardsService {
  constructor(
    @InjectRepository(AccessCardService)
    private repo: Repository<AccessCardService>,
    @InjectRepository(Agency)
    private agencyRepo: Repository<Agency>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    @InjectRepository(InterAgencyReferral)
    private referralRepo: Repository<InterAgencyReferral>,
  ) {}

  async generateAndAssign(beneficiaryId: string): Promise<string> {
    const year = new Date().getFullYear();
    const queryRunner = this.repo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const result = await queryRunner.manager.query(
        `INSERT INTO access_card_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
        [year]
      );
      const seqId = result[0]?.id || 1;
      const code = `NORZ-AC-${year}-${String(seqId).padStart(ACCESS_CARD_PAD_WIDTH, '0')}`;

      await queryRunner.manager.query(
        `UPDATE households SET access_card_code = $1 WHERE id = (SELECT household_id FROM beneficiaries WHERE id = $2)`,
        [code, beneficiaryId]
      );

      await queryRunner.commitTransaction();
      return code;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getSummary(beneficiaryId: string) {
    const ben = await this.repo.query(
      'SELECT b.id, h.access_card_code, p.surname, p.first_name FROM beneficiaries b JOIN households h ON h.id = b.household_id JOIN persons p ON p.id = b.person_id WHERE b.id = $1',
      [beneficiaryId]
    );
    if (!ben?.[0]?.access_card_code) {
      throw new NotFoundException('Beneficiary has no Access Card');
    }
    const code = ben[0].access_card_code;
    const services = await this.repo.find({ where: { accessCardCode: code } });
    const byCategory: Record<string, number> = {};
    for (const s of services) {
      const cat = s.category || 'case_service';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    return { cardCode: code, total: services.length, byCategory };
  }

  async findBeneficiaryCard(beneficiaryId: string) {
    const ben = await this.repo.query(
      'SELECT b.id, h.access_card_code, p.surname, p.first_name FROM beneficiaries b JOIN households h ON h.id = b.household_id JOIN persons p ON p.id = b.person_id WHERE b.id = $1',
      [beneficiaryId]
    );
    if (!ben?.[0]?.access_card_code) {
      throw new NotFoundException('Beneficiary has no Access Card');
    }
    const services = await this.repo.find({
      where: { accessCardCode: ben[0].access_card_code },
      order: { serviceDate: 'DESC' },
    });
    return { beneficiary: ben[0], code: ben[0].access_card_code, services };
  }

  async logService(data: { accessCardCode: string; serviceRendered: string; serviceDate: Date; cost?: number; agency?: string; agencyId?: string; workerNameSign?: string; category?: string; loggedBy?: string; sourceBarangay?: string }) {
    let agencyId = data.agencyId;
    if (!agencyId && data.agency && data.agency.trim()) {
      agencyId = await this.resolveAgencyId(data.agency);
    }
    const entry = this.repo.create({
      accessCardCode: data.accessCardCode,
      serviceRendered: data.serviceRendered,
      serviceDate: data.serviceDate,
      cost: data.cost,
      agency: data.agency,
      agencyId,
      workerNameSign: data.workerNameSign,
      category: data.category || 'referral',
      loggedBy: data.loggedBy,
      sourceBarangay: data.sourceBarangay,
    });
    return this.repo.save(entry);
  }

  private async resolveAgencyId(agencyText: string): Promise<string> {
    const trimmed = agencyText.trim();
    const agency = await this.agencyRepo.findOne({
      where: [{ code: trimmed.toUpperCase() }, { name: trimmed }],
    });
    if (!agency) throw new UnprocessableEntityException(`Unknown agency: ${agencyText}`);
    return agency.id;
  }

  async getAgencySummary(cardCode: string, caller: User) {
    const rows = await this.repo.query(
      `SELECT b.id AS beneficiary_id, b.person_id, p.surname, p.first_name
       FROM households h
       JOIN beneficiaries b ON b.household_id = h.id
       JOIN persons p ON p.id = b.person_id
       WHERE h.access_card_code = $1
       LIMIT 1`,
      [cardCode],
    );
    if (!rows?.[0]) throw new NotFoundException('No access card found for this code');
    const ben = rows[0];

    const consent = await this.consentRepo.findOne({
      where: { beneficiaryId: ben.beneficiary_id, purpose: 'inter_agency_sharing', status: 'active' },
    });
    const sharingConsentActive = !!consent;
    const isAdmin = caller.role === 'admin';
    const callerAgency = caller.agencyId;
    const isOwnPerson =
      caller.role === 'claimant' && !!caller.personId && caller.personId === ben.person_id;

    const services = await this.repo.find({
      where: { accessCardCode: cardCode },
      order: { serviceDate: 'DESC' },
      relations: ['agencyRef'],
    });

    const servicesRendered =
      caller.role === 'claimant' && !isOwnPerson
        ? []
        : services.filter(s =>
            isAdmin || !callerAgency || s.agencyId === callerAgency || !s.agencyId,
          );

    const servicesFromOtherAgencies =
      sharingConsentActive || isAdmin
        ? services.filter(s => callerAgency && s.agencyId && s.agencyId !== callerAgency)
        : [];

    let referralHistory: InterAgencyReferral[];
    if (caller.role === 'claimant') {
      referralHistory = isOwnPerson
        ? await this.referralRepo.find({
            where: { personId: ben.person_id },
            order: { createdAt: 'DESC' },
            relations: ['fromAgency', 'toAgency', 'case'],
          })
        : [];
    } else if (isAdmin) {
      referralHistory = await this.referralRepo.find({
        where: { personId: ben.person_id },
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'case'],
      });
    } else if (callerAgency) {
      referralHistory = await this.referralRepo.find({
        where: [
          { personId: ben.person_id, fromAgencyId: callerAgency },
          { personId: ben.person_id, toAgencyId: callerAgency },
        ],
        order: { createdAt: 'DESC' },
        relations: ['fromAgency', 'toAgency', 'case'],
      });
    } else {
      referralHistory = [];
    }

    return {
      cardCode,
      person: { id: ben.person_id, firstName: ben.first_name, surname: ben.surname },
      servicesRendered,
      servicesFromOtherAgencies,
      referralHistory,
      sharingConsentActive,
    };
  }

  async autoLogFromIntervention(intervention: { caseId: string; serviceName: string; deliveryDate?: string; amount?: number }) {
    const caseRow = await this.repo.query(
      'SELECT id, beneficiary_id FROM cases WHERE id = $1',
      [intervention.caseId]
    );
    if (!caseRow?.[0]?.beneficiary_id) return;
    const ben = await this.repo.query(
      'SELECT b.id, h.access_card_code FROM beneficiaries b JOIN households h ON h.id = b.household_id WHERE b.id = $1',
      [caseRow[0].beneficiary_id]
    );
    if (!ben?.[0]?.access_card_code) return;
    const entry = this.repo.create({
      accessCardCode: ben[0].access_card_code,
      serviceRendered: intervention.serviceName,
      serviceDate: intervention.deliveryDate ? new Date(intervention.deliveryDate) : new Date(),
      cost: intervention.amount,
      category: 'case_service',
    });
    await this.repo.save(entry);
  }

  async findByCard(cardCode: string) {
    return this.repo.find({ where: { accessCardCode: cardCode }, order: { serviceDate: 'DESC' } });
  }

  async findAll(page = 1, limit = 10, sourceBarangay?: string) {
    const where: any = {};
    if (sourceBarangay) where.sourceBarangay = sourceBarangay;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { serviceDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
