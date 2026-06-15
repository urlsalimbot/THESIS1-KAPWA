import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { Beneficiary } from './beneficiary.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { Household } from './household.entity';
import { FamilyMember } from './family-member.entity';
import { Case } from '../cases/case.entity';
import { Intervention } from '../interventions/intervention.entity';

@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    @InjectRepository(Household)
    private householdRepo: Repository<Household>,
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

  async findAll(barangay?: string) {
    if (barangay) {
      return this.benRepo.find({ where: { address: ILike(`%${barangay}%`) } });
    }
    return this.benRepo.find({ relations: ['household'] });
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
      relations: ['household'],
    });
    if (!ben) return null;

    let members: FamilyMember[] = [];
    if (ben.household) {
      members = await this.familyMemberRepo.find({
        where: { household: { id: ben.household.id } },
      });
    }

    return { primary: ben, household: ben.household, members };
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
