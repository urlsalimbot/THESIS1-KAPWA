import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { FamilyMember } from '../beneficiaries/family-member.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import type { IntakeInput } from './dto/intake.zod';

@Injectable()
export class IntakeService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(Household)
    private hhRepo: Repository<Household>,
    @InjectRepository(FamilyMember)
    private fmRepo: Repository<FamilyMember>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    private casesService: CasesService,
  ) {}

  async submitIntake(data: IntakeInput): Promise<{
    beneficiaryId: string;
    caseId: string;
    controlNo: string;
    status: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // 1. Create Beneficiary
      const beneficiary = this.benRepo.create({
        surname: data.beneficiary.surname,
        firstName: data.beneficiary.firstName,
        middleName: data.beneficiary.middleName,
        gender: data.beneficiary.gender,
        dob: new Date(data.beneficiary.dob),
        address: data.beneficiary.purok
          ? `${data.beneficiary.purok}, ${data.beneficiary.barangay}`
          : data.beneficiary.barangay,
        phone: data.beneficiary.phone,
        category: data.beneficiary.category,
        consentStatus: 'active',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      // 2. Create Household
      const household = this.hhRepo.create({
        primaryBeneficiaryId: savedBeneficiary.id,
        barangay: data.beneficiary.barangay,
      });
      const savedHousehold = await queryRunner.manager.save(household);

      // 3. Link Beneficiary to Household
      savedBeneficiary.householdId = savedHousehold.id;
      await queryRunner.manager.save(savedBeneficiary);

      // 4. Create FamilyMembers (filter empty fullName)
      if (data.familyMembers && data.familyMembers.length > 0) {
        const validMembers = data.familyMembers.filter(m => m.fullName && m.fullName.trim().length > 0);
        for (const fm of validMembers) {
          const member = this.fmRepo.create({
            householdId: savedHousehold.id,
            fullName: fm.fullName,
            relationship: fm.relationship,
            age: fm.age,
            occupation: fm.occupation,
          });
          await queryRunner.manager.save(member);
        }
      }

      // 5. Generate controlNo via CasesService
      const controlNo = await this.casesService.generateControlNo();

      // 6. Create Case
      const caseEntity = this.caseRepo.create({
        controlNo,
        beneficiaryId: savedBeneficiary.id,
        status: CaseStatus.PENDING,
        serviceRequested: data.case.serviceRequested,
        requirementsChecklist: data.case.requirementsChecklist,
        assignedWorkerId: data.case.assignedWorkerId,
      });
      const savedCase = await queryRunner.manager.save(caseEntity);

      // 7. Create ConsentLedger
      const consent = this.consentRepo.create({
        beneficiaryId: savedBeneficiary.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      await queryRunner.manager.save(consent);

      // Commit
      await queryRunner.commitTransaction();

      return {
        beneficiaryId: savedBeneficiary.id,
        caseId: savedCase.id,
        controlNo,
        status: CaseStatus.PENDING,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Intake transaction failed',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
