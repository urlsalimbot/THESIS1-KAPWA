import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './beneficiary.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { Household } from './household.entity';
import { FamilyMember } from './family-member.entity';

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
      return this.benRepo.find({ where: { address: barangay } });
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
