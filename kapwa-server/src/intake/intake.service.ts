import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Raw, Repository } from 'typeorm';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import { memberToPerson } from './member-person';
import type { IntakeInput, MatchCheckInput, MatchCandidate, ConfirmMatchInput, ConfirmMatchResponse, BatchFamilyInput } from './dto/intake.zod';

@Injectable()
export class IntakeService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
    @InjectRepository(Household)
    private hhRepo: Repository<Household>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(ConsentLedger)
    private consentRepo: Repository<ConsentLedger>,
    private casesService: CasesService,
  ) {}

  private async findOrCreatePerson(
    data: Partial<Person> & { surname: string; firstName: string; gender: string; dob: Date },
    queryRunner?: any,
    deduplicate = false,
    scope?: { currentAddress?: Record<string, string> },
  ): Promise<Person> {
    const find = (where: any) => queryRunner
      ? queryRunner.manager.findOne(Person, { where })
      : this.personRepo.findOne({ where });
    const save = (entity: Person) => queryRunner
      ? queryRunner.manager.save(Person, entity)
      : this.personRepo.save(entity);

    if (deduplicate) {
      let existing: Person | null = null;
      if (data.philhealthNumber) {
        existing = await find({ philhealthNumber: data.philhealthNumber });
      }
      if (!existing) {
        const where: Record<string, unknown> = {
          surname: data.surname,
          firstName: data.firstName,
          dob: data.dob,
        };
        const barangay = scope?.currentAddress?.barangay;
        if (barangay) {
          // Scope dedup to the household's barangay so a same-name/same-dob
          // person in a different barangay is never matched.
          where.currentAddress = Raw((alias) => `${alias}->>'barangay' = :barangay`, { barangay });
        }
        existing = await find(where);
      }
      if (existing) {
        const updatable = { ...data } as Partial<Person>;
        for (const [k, v] of Object.entries(updatable)) {
          if (v === undefined || v === null || v === '') delete (updatable as Record<string, unknown>)[k];
        }
        if (data.currentAddress && typeof data.currentAddress === 'object') {
          updatable.currentAddress = { ...(existing.currentAddress || {}), ...data.currentAddress };
        }
        return save(Object.assign(existing, updatable));
      }
    }
    return save(this.personRepo.create(data as Person));
  }

  private personFromInput(data: {
    surname: string; firstName: string; middleName?: string; extension?: string;
    gender: string; dob: string; age?: number; placeOfBirth?: string;
    civilStatus?: string; cellularNumber?: string; email?: string;
    currentAddress?: Record<string, string>;
    philhealthNumber?: string; occupation?: string; estimatedMonthlyIncome?: number;
  }): Partial<Person> & { surname: string; firstName: string; gender: string; dob: Date } {
    return {
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      extension: data.extension,
      gender: data.gender as 'Male' | 'Female',
      dob: new Date(data.dob),
      age: data.age || undefined,
      placeOfBirth: data.placeOfBirth,
      civilStatus: data.civilStatus,
      phone: data.cellularNumber,
      email: data.email,
      currentAddress: data.currentAddress,
      philhealthNumber: data.philhealthNumber || undefined,
      occupation: data.occupation,
      estimatedMonthlyIncome: data.estimatedMonthlyIncome,
    };
  }

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
      // 1. Find or create Person for BENEFICIARY (with dedup check)
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true);

      // 2. Create Beneficiary (thin record linked to Person)
      const beneficiary = this.benRepo.create({
        personId: benPerson.id,
        consentStatus: 'active',
      });
      const savedBeneficiary = await queryRunner.manager.save(beneficiary);

      // 3. Create Person for CLAIMANT (always new, no dedup)
      const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, false);

      // 4. Create BeneficiaryClaimant link
      await queryRunner.manager.save(queryRunner.manager.create(BeneficiaryClaimant, {
        beneficiaryId: benPerson.id,
        claimantId: claimPerson.id,
        relationship: data.claimant.relationshipToBeneficiary,
        isPrimary: true,
        calendarYear: new Date().getFullYear(),
      }));

      // 5. Create Household
      const household = this.hhRepo.create({
        primaryBeneficiaryId: savedBeneficiary.id,
        barangay: data.beneficiary.currentAddress?.barangay || '',
        estimatedIncome: data.beneficiary.estimatedMonthlyIncome,
      });
      const savedHousehold = await queryRunner.manager.save(household);

      // 6. Link Beneficiary to Household
      savedBeneficiary.householdId = savedHousehold.id;
      await queryRunner.manager.save(savedBeneficiary);

      // 7. Create HouseholdMemberships (always new persons, no dedup)
      if (data.familyMembers && data.familyMembers.length > 0) {
        const validMembers = data.familyMembers.filter(m => m.surname && m.surname.trim().length > 0);
        for (const fm of validMembers) {
          const memberPerson = await this.findOrCreatePerson(memberToPerson(fm), queryRunner, false);
          const membership = queryRunner.manager.create(HouseholdMembership, {
            personId: memberPerson.id,
            householdId: savedHousehold.id,
            relationship: fm.relationship,
            isPrimary: false,
            status: fm.status,
          });
          await queryRunner.manager.save(membership);
        }
      }

      // 8. Generate controlNo
      const controlNo = await this.casesService.generateControlNo();

      // 9. Create Case
      const caseEntity = this.caseRepo.create({
        controlNo,
        beneficiaryId: savedBeneficiary.id,
        status: CaseStatus.ENROLLED,
        serviceRequested: data.case.serviceRequested,
        requirementsChecklist: data.case.requirementsChecklist,
        assignedWorkerId: data.case.assignedWorkerId,
      });
      const savedCase = await queryRunner.manager.save(caseEntity);

      // 10. Create ConsentLedger
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
        status: CaseStatus.ENROLLED,
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

  async submitBatchFamily(input: BatchFamilyInput): Promise<{
    beneficiaryId: string;
    caseId: string;
    controlNo: string;
    status: string;
  }> {
    const requiredPrimaryFields = ['surname', 'firstName', 'gender', 'dob'] as const;
    const missing = requiredPrimaryFields.filter((field) => {
      const value = (input.primary as Record<string, unknown>)[field];
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Batch family primary is missing required fields: ${missing.join(', ')}`,
      );
    }

    // The single intake already created the Beneficiary, Household, Case, and
    // member Persons. Link batch members to that EXISTING household instead of
    // creating duplicate records that would inflate reporting counts.
    const existingCase = await this.caseRepo.findOne({ where: { id: input.caseId } });
    if (!existingCase) throw new NotFoundException('Case not found');

    const beneficiary = await this.benRepo.findOne({ where: { id: existingCase.beneficiaryId } });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    const householdId = beneficiary.householdId;
    if (!householdId) throw new BadRequestException('Beneficiary is not linked to a household');

    // Dedup scope: only match existing persons from the primary household's
    // barangay so a same-name/same-dob person in another barangay is never
    // linked to this household.
    const household = await this.hhRepo.findOne({ where: { id: householdId } });
    const dedupScope = household?.barangay
      ? { currentAddress: { barangay: household.barangay } }
      : undefined;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const validMembers = (input.members || []).filter(m => m.surname && m.surname.trim().length > 0);
      for (const fm of validMembers) {
        const memberPerson = await this.findOrCreatePerson(memberToPerson(fm), queryRunner, true, dedupScope);
        const existingMembership = await queryRunner.manager.findOne(HouseholdMembership, {
          where: { personId: memberPerson.id, householdId },
        });
        if (!existingMembership) {
          const membership = queryRunner.manager.create(HouseholdMembership, {
            personId: memberPerson.id,
            householdId,
            relationship: fm.relationship,
            isPrimary: false,
            status: fm.status,
          });
          await queryRunner.manager.save(membership);
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Batch family transaction failed',
      );
    } finally {
      await queryRunner.release();
    }

    return {
      beneficiaryId: beneficiary.id,
      caseId: existingCase.id,
      controlNo: existingCase.controlNo,
      status: existingCase.status,
    };
  }

  async matchCheck(data: MatchCheckInput, workerBarangays: string[]): Promise<{ candidates: MatchCandidate[] }> {
    const familyNames = (data.familyMembers || []).map(f => `${f.surname}, ${f.firstName}`).filter(Boolean);

    const raw = await this.dataSource.query(
      `WITH household_scores AS (
        SELECT
          h.id,
          GREATEST(
            similarity(p.surname, $1),
            similarity(p.first_name, $2)
          ) AS ben_score,
          CASE WHEN $3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0 THEN (
            SELECT COALESCE(AVG(sub.best), 0)
            FROM (
              SELECT MAX(similarity(TRIM(CONCAT(p2.first_name, ' ', p2.surname)), u.name)) AS best
              FROM household_memberships hm2
              JOIN persons p2 ON p2.id = hm2.person_id
              CROSS JOIN unnest($3::text[]) AS u(name)
              WHERE hm2.household_id = h.id
              GROUP BY u.name
            ) sub
          ) ELSE 0 END AS family_score
        FROM households h
        JOIN beneficiaries b ON h.primary_beneficiary_id = b.id
        JOIN persons p ON p.id = b.person_id
      )
      SELECT
        hs.id AS household_id,
        (0.6 * COALESCE(hs.ben_score, 0) + 0.4 * COALESCE(hs.family_score, 0)) AS score,
        b.id AS ben_id, p.surname, p.first_name, p.address,
        p.phone, p.occupation, p.estimated_monthly_income,
        p.civil_status, p.current_address, p.philhealth_number, p.age, p.gender, p.middle_name, b.category,
        (SELECT json_agg(json_build_object('id', b2.id, 'surname', p2.surname, 'first_name', p2.first_name))
         FROM beneficiaries b2
         JOIN persons p2 ON p2.id = b2.person_id
         WHERE b2.household_id = h.id) AS all_beneficiaries,
        (SELECT json_agg(json_build_object(
          'id', hm.id, 'fullName', TRIM(CONCAT(p3.first_name, ' ', p3.surname)),
          'relationship', hm.relationship,
          'age', p3.age, 'occupation', p3.occupation,
          'income', p3.estimated_monthly_income, 'status', hm.status
         )) FROM household_memberships hm
           JOIN persons p3 ON p3.id = hm.person_id
           WHERE hm.household_id = h.id) AS family_members,
        (SELECT EXISTS(
          SELECT 1 FROM cases c
          JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
          WHERE b3.household_id = h.id
          AND c.created_at > NOW() - INTERVAL '30 days'
        )) AS case_exists_30d,
        (SELECT MAX(c.created_at) FROM cases c
         JOIN beneficiaries b3 ON b3.id = c.beneficiary_id
          WHERE b3.household_id = h.id AND c.status = 'active') AS last_case_date
      FROM household_scores hs
      JOIN households h ON h.id = hs.id
      JOIN beneficiaries b ON b.id = h.primary_beneficiary_id
      JOIN persons p ON p.id = b.person_id
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
        caseExistsWithin30Days: Boolean(r.case_exists_30d),
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

    const [lk1, lk2] = this.hashToLockPair(
      data.beneficiary.surname, data.beneficiary.firstName, data.beneficiary.dob,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(`SELECT pg_advisory_xact_lock($1, $2)`, [lk1, lk2]);

    try {
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true);

      let savedBeneficiary = await queryRunner.manager.findOne(Beneficiary, {
        where: { personId: benPerson.id },
      });
      if (!savedBeneficiary) {
        savedBeneficiary = await queryRunner.manager.save(queryRunner.manager.create(Beneficiary, {
          personId: benPerson.id,
          householdId,
          consentStatus: 'active',
        }));
      }

      const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true);
      const existingClaimantLink = await queryRunner.manager.findOne(BeneficiaryClaimant, {
        where: { beneficiaryId: benPerson.id, isPrimary: true },
      });
      if (existingClaimantLink) {
        if (existingClaimantLink.relationship !== data.claimant.relationshipToBeneficiary) {
          existingClaimantLink.relationship = data.claimant.relationshipToBeneficiary;
          await queryRunner.manager.save(existingClaimantLink);
        }
      } else {
        await queryRunner.manager.save(queryRunner.manager.create(BeneficiaryClaimant, {
          beneficiaryId: benPerson.id,
          claimantId: claimPerson.id,
          relationship: data.claimant.relationshipToBeneficiary,
          isPrimary: true,
          calendarYear: new Date().getFullYear(),
        }));
      }

      if (data.familyMembers && data.familyMembers.length > 0) {
        const validMembers = data.familyMembers.filter(m => m.surname && m.surname.trim().length > 0);
        for (const fm of validMembers) {
          const memberPerson = await this.findOrCreatePerson(memberToPerson(fm), queryRunner, true);
          const existingMembership = await queryRunner.manager.findOne(HouseholdMembership, {
            where: { personId: memberPerson.id, householdId },
          });
          if (!existingMembership) {
            const membership = queryRunner.manager.create(HouseholdMembership, {
              personId: memberPerson.id, householdId,
              relationship: fm.relationship, isPrimary: false,
              status: fm.status,
            });
            await queryRunner.manager.save(membership);
          }
        }
      }

      const recentCase = await this.caseRepo.findOne({
        where: {
          beneficiaryId: In(
            (await this.benRepo.find({ where: { householdId }, select: ['id'] })).map(b => b.id)
          ),
          createdAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        },
        order: { createdAt: 'DESC' },
      });

      const controlNo = recentCase ? undefined : await this.casesService.generateControlNo();

      let savedCase = null;
      if (!recentCase) {
        const caseEntity = this.caseRepo.create({
          controlNo,
          beneficiaryId: savedBeneficiary.id,
          status: CaseStatus.ENROLLED,
          serviceRequested: data.case.serviceRequested,
          requirementsChecklist: data.case.requirementsChecklist,
          assignedWorkerId: data.case.assignedWorkerId,
        });
        savedCase = await queryRunner.manager.save(caseEntity);
      }

      const consent = this.consentRepo.create({
        beneficiaryId: savedBeneficiary.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      await queryRunner.manager.save(consent);

      await queryRunner.commitTransaction();

      const existingCaseDate = recentCase?.createdAt?.toISOString() || null;

      return {
        updated: true,
        caseCreated: !recentCase,
        beneficiaryId: savedBeneficiary.id,
        caseId: savedCase?.id || null,
        controlNo: controlNo || null,
        status: recentCase ? null : CaseStatus.ENROLLED,
        existingCaseDate,
        message: recentCase
          ? `Info updated. No new case created — this household already has a case from ${new Date(recentCase.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.`
          : 'Info updated and new case created.',
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

  private hashToLockPair(surname: string, firstName: string, dob?: string): [number, number] {
    const str = `${surname.toLowerCase()},${firstName.toLowerCase()},${dob || ''}`;
    let h1 = 5381;
    let h2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      h1 = ((h1 << 5) + h1 + code) | 0;
      h2 = ((h2 << 13) - h2 + code) | 0;
    }
    return [Math.abs(h1 || 1), Math.abs(h2 || 1)];
  }
}
