import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { FamilyMember } from '../beneficiaries/family-member.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import type { IntakeInput, MatchCheckInput, MatchCandidate, ConfirmMatchInput, ConfirmMatchResponse } from './dto/intake.zod';

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
        age: data.beneficiary.age || undefined,
        placeOfBirth: data.beneficiary.placeOfBirth,
        civilStatus: data.beneficiary.civilStatus,
        phone: data.beneficiary.cellularNumber,
        currentAddress: data.beneficiary.currentAddress,
        provincialAddress: data.beneficiary.provincialAddress,
        philhealthNumber: data.beneficiary.philhealthNumber || undefined,
        occupation: data.beneficiary.occupation,
        estimatedMonthlyIncome: data.beneficiary.estimatedMonthlyIncome,
        address: data.beneficiary.currentAddress?.street
          ? `${data.beneficiary.currentAddress.street}, ${data.beneficiary.currentAddress.barangay || ''}`
          : undefined,
        consentStatus: 'active',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      // 2. Create Household
      const household = this.hhRepo.create({
        primaryBeneficiaryId: savedBeneficiary.id,
        barangay: data.beneficiary.currentAddress?.barangay || '',
        estimatedIncome: data.beneficiary.estimatedMonthlyIncome,
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
            income: fm.income,
            status: fm.status,
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

  async matchCheck(data: MatchCheckInput, workerBarangays: string[]): Promise<{ candidates: MatchCandidate[] }> {
    const familyNames = (data.familyMembers || []).map(f => f.fullName).filter(Boolean);

    const raw = await this.dataSource.query(
      `WITH household_scores AS (
        SELECT
          h.id,
          GREATEST(
            similarity(b.surname, $1),
            similarity(b.first_name, $2)
          ) AS ben_score,
          CASE WHEN $3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0 THEN (
            SELECT COALESCE(AVG(sub.best), 0)
            FROM (
              SELECT MAX(similarity(fm.full_name, u.name)) AS best
              FROM family_members fm
              CROSS JOIN unnest($3::text[]) AS u(name)
              WHERE fm.household_id = h.id
              GROUP BY u.name
            ) sub
          ) ELSE 0 END AS family_score
        FROM households h
        JOIN beneficiaries b ON h.primary_beneficiary_id = b.id
      )
      SELECT
        hs.id AS household_id,
        (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) AS score,
        b.id AS ben_id, b.surname, b.first_name, b.address,
        b.phone, b.occupation, b.estimated_monthly_income,
        b.civil_status, b.current_address, b.philhealth_number, b.age, b.gender, b.middle_name, b.category,
        (SELECT json_agg(json_build_object('id', b2.id, 'surname', b2.surname, 'first_name', b2.first_name))
         FROM beneficiaries b2 WHERE b2.household_id = h.id) AS all_beneficiaries,
        (SELECT json_agg(json_build_object(
          'id', fm.id, 'fullName', fm.full_name, 'relationship', fm.relationship,
          'age', fm.age, 'occupation', fm.occupation, 'income', fm.income, 'status', fm.status
         )) FROM family_members fm WHERE fm.household_id = h.id) AS family_members,
        (SELECT MAX(c.created_at) FROM cases c
         JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
         WHERE b3.household_id = h.id AND c.status = 'approved') AS last_case_date
      FROM household_scores hs
      JOIN households h ON h.id = hs.id
      JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
      WHERE (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) >= 0.6
      ORDER BY (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) DESC
      LIMIT 10`,
      [data.surname, data.firstName, familyNames.length > 0 ? familyNames : null],
    );

    const candidates: MatchCandidate[] = (raw as any[])
      .filter(r => {
        if (workerBarangays.length === 0) return true;
        const addr = r.current_address as Record<string, string> | null;
        const barangay = addr?.barangay || '';
        return workerBarangays.includes(barangay);
      })
      .map(r => ({
        householdId: r.household_id,
        score: parseFloat(r.score) || 0,
        primaryBeneficiary: {
          id: r.ben_id,
          surname: r.surname,
          firstName: r.first_name,
          middleName: r.middle_name || undefined,
          gender: r.gender,
          age: r.age,
          phone: r.phone || '',
          occupation: r.occupation || '',
          estimatedMonthlyIncome: r.estimated_monthly_income ? parseFloat(r.estimated_monthly_income) : 0,
          civilStatus: r.civil_status || '',
          currentAddress: r.current_address || null,
          philhealthNumber: r.philhealth_number || undefined,
          category: r.category || undefined,
        },
        allBeneficiaries: r.all_beneficiaries || [],
        familyMembers: r.family_members || [],
        lastApprovedCaseDate: r.last_case_date ? r.last_case_date.toISOString() : null,
      }));

    return { candidates };
  }

  async confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[]): Promise<ConfirmMatchResponse> {
    const household = await this.hhRepo.findOne({ where: { id: householdId } });
    if (!household) throw new NotFoundException('Household not found');
    if (workerBarangays.length > 0 && household.barangay && !workerBarangays.includes(household.barangay)) {
      throw new ForbiddenException('You do not have permission for this barangay');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const beneficiary = this.benRepo.create({
        surname: data.beneficiary.surname,
        firstName: data.beneficiary.firstName,
        middleName: data.beneficiary.middleName,
        gender: data.beneficiary.gender,
        dob: new Date(data.beneficiary.dob),
        age: data.beneficiary.age || undefined,
        placeOfBirth: data.beneficiary.placeOfBirth,
        civilStatus: data.beneficiary.civilStatus,
        phone: data.beneficiary.cellularNumber,
        currentAddress: data.beneficiary.currentAddress,
        provincialAddress: data.beneficiary.provincialAddress,
        philhealthNumber: data.beneficiary.philhealthNumber || undefined,
        occupation: data.beneficiary.occupation,
        estimatedMonthlyIncome: data.beneficiary.estimatedMonthlyIncome,
        address: data.beneficiary.currentAddress?.street
          ? `${data.beneficiary.currentAddress.street}, ${data.beneficiary.currentAddress.barangay || ''}`
          : undefined,
        householdId,
        consentStatus: 'active',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      if (data.familyMembers && data.familyMembers.length > 0) {
        const validMembers = data.familyMembers.filter(m => m.fullName && m.fullName.trim().length > 0);
        for (const fm of validMembers) {
          const member = this.fmRepo.create({
            householdId,
            fullName: fm.fullName,
            relationship: fm.relationship,
            age: fm.age,
            occupation: fm.occupation,
            income: fm.income,
            status: fm.status,
          });
          await queryRunner.manager.save(member);
        }
      }

      const lastCase = await this.caseRepo.findOne({
        where: { beneficiaryId: In(
          (await this.benRepo.find({ where: { householdId }, select: ['id'] })).map(b => b.id)
        ), status: CaseStatus.APPROVED },
        order: { createdAt: 'DESC' },
      });

      const lastApprovedDate = lastCase?.createdAt || null;
      const nextEligibleDate = lastApprovedDate
        ? new Date(lastApprovedDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date();

      const controlNo = await this.casesService.generateControlNo();

      const caseEntity = this.caseRepo.create({
        controlNo,
        beneficiaryId: savedBeneficiary.id,
        status: CaseStatus.PENDING,
        serviceRequested: data.case.serviceRequested,
        requirementsChecklist: data.case.requirementsChecklist,
        assignedWorkerId: data.case.assignedWorkerId,
      });
      const savedCase = await queryRunner.manager.save(caseEntity);

      const consent = this.consentRepo.create({
        beneficiaryId: savedBeneficiary.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      await queryRunner.manager.save(consent);

      await queryRunner.commitTransaction();

      return {
        beneficiaryId: savedBeneficiary.id,
        caseId: savedCase.id,
        controlNo,
        status: CaseStatus.PENDING,
        nextEligibleDate: nextEligibleDate.toISOString(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Confirm match transaction failed',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
