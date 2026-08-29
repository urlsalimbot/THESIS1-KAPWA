import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { BeneficiaryRole } from '../beneficiaries/beneficiary-role.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import { memberToPerson } from './member-person';
import { User, UserRole } from '../auth/user.entity';
import type { IntakeInput, MatchCheckInput, MatchCandidate, ConfirmMatchInput, ConfirmMatchResponse, BatchFamilyInput } from './dto/intake.zod';

// Only MSWDO staff (admin / social worker) may be assigned as a case worker;
// coordinators are not MSWDO employees and must never be assigned.
function isCaseWorker(role?: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.SW;
}

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

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
    extras?: { phone?: string; email?: string; currentAddress?: Record<string, string> },
  ): Promise<Person> {
    const find = (where: any) => queryRunner
      ? queryRunner.manager.findOne(Person, { where })
      : this.personRepo.findOne({ where });
    const save = (entity: Person) => queryRunner
      ? queryRunner.manager.save(Person, entity)
      : this.personRepo.save(entity);

    let saved: Person;
    if (deduplicate) {
      let existing: Person | null = null;
      if (data.philhealthNumber) {
        existing = await find({ philhealthNumber: data.philhealthNumber });
      }
      if (!existing) {
        const barangay = scope?.currentAddress?.barangay;
        if (barangay) {
          // Scope dedup to the household's barangay so a same-name/same-dob
          // person in a different barangay is never matched. The current
          // address lives in person_addresses, so scope via an EXISTS subquery.
          const repo = queryRunner ? queryRunner.manager.getRepository(Person) : this.personRepo;
          existing = (await repo
            .createQueryBuilder('p')
            .where('p.surname = :surname', { surname: data.surname })
            .andWhere('p.first_name = :firstName', { firstName: data.firstName })
            .andWhere('p.dob = :dob', { dob: data.dob })
            .andWhere(
              `EXISTS (SELECT 1 FROM person_addresses pa2 WHERE pa2.person_id = p.id AND pa2.address_type = 'current' AND pa2.barangay = :barangay)`,
              { barangay },
            )
            .getOne()) ?? null;
        } else {
          existing = await find({ surname: data.surname, firstName: data.firstName, dob: data.dob });
        }
      }
      if (existing) {
        const updatable = { ...data } as Partial<Person>;
        for (const [k, v] of Object.entries(updatable)) {
          if (v === undefined || v === null || v === '') delete (updatable as Record<string, unknown>)[k];
        }
        saved = await save(Object.assign(existing, updatable));
      } else {
        saved = await save(this.personRepo.create(data as Person));
      }
    } else {
      saved = await save(this.personRepo.create(data as Person));
    }

    await this.persistPersonExtras(saved.id, extras || {}, queryRunner);
    return saved;
  }

  private personExtras(data: {
    cellularNumber?: string; email?: string; currentAddress?: Record<string, string>;
  }): { phone?: string; email?: string; currentAddress?: Record<string, string> } {
    return {
      phone: data.cellularNumber,
      email: data.email,
      currentAddress: data.currentAddress,
    };
  }

  private async persistPersonExtras(
    personId: string,
    extras: { phone?: string; email?: string; currentAddress?: Record<string, string> },
    queryRunner?: any,
  ): Promise<void> {
    const { phone, email, currentAddress } = extras || {};
    if (!phone && !email && !currentAddress) return;
    const run = (sql: string, params: unknown[]) =>
      queryRunner ? queryRunner.query(sql, params) : this.personRepo.query(sql, params);

    const upsertContact = async (contactType: string, value: string) => {
      await run(
        `WITH updated AS (
           UPDATE person_contacts SET value = $3, is_primary = TRUE
           WHERE person_id = $1 AND contact_type = $2 RETURNING id
         )
         INSERT INTO person_contacts (person_id, contact_type, value, is_primary)
         SELECT $1, $2, $3, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM updated)`,
        [personId, contactType, value],
      );
    };

    if (phone) await upsertContact('phone', phone);
    if (email) await upsertContact('email', email);

    if (currentAddress) {
      await run(
        `WITH updated AS (
           UPDATE person_addresses SET
             barangay = $2,
             city = $3,
             province = $4,
             is_primary = TRUE
           WHERE person_id = $1 AND address_type = 'current' RETURNING id
         )
         INSERT INTO person_addresses (person_id, address_type, barangay, city, province, is_primary)
         SELECT $1, 'current', $2, $3, $4, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM updated)`,
        [personId, currentAddress.barangay ?? null, currentAddress.city ?? null, currentAddress.province ?? null],
      );
    }
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
      placeOfBirth: data.placeOfBirth,
      civilStatus: data.civilStatus,
      philhealthNumber: data.philhealthNumber || undefined,
      occupation: data.occupation,
      estimatedMonthlyIncome: data.estimatedMonthlyIncome,
    };
  }

  async submitIntake(data: IntakeInput, caller?: Pick<User, 'id' | 'role'>): Promise<{
    beneficiaryId: string;
    caseId: string;
    controlNo: string;
    status: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    await queryRunner.query(`SELECT pg_advisory_xact_lock($1, $2)`, this.hashToLockPair(data.beneficiary.surname, data.beneficiary.firstName, data.beneficiary.dob));

    try {
      // 1. Find or create Person for BENEFICIARY (with dedup check)
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true, undefined, this.personExtras(data.beneficiary));

      // 1b. Duplicate-case guard: if this person already has a Beneficiary + Household + a recent
      //     Case (30 days), reuse that household/case instead of creating duplicates. This mirrors
      //     confirmMatch and closes the "case created even when persons match" gap that occurs when
      //     the client-side match-check misses (near-miss names, barangay scope, or a failed check).
      const existingBeneficiary = await queryRunner.manager.findOne(Beneficiary, {
        where: { personId: benPerson.id },
      });
      const existingHousehold = existingBeneficiary
        ? await queryRunner.manager.findOne(Household, {
            where: { primaryBeneficiaryId: existingBeneficiary.id },
          })
        : null;

      if (existingBeneficiary && existingHousehold) {
        const recentCase = await this.caseRepo.findOne({
          where: {
            beneficiaryId: In(
              (await this.benRepo.find({
                where: { householdId: existingHousehold.id },
                select: ['id'],
              })).map(b => b.id),
            ),
            createdAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
          },
          order: { createdAt: 'DESC' },
        });

        if (recentCase) {
          // Reuse: link claimant + family members into the existing household, then return the
          // existing case — no new Beneficiary / Household / Case is created.
const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true, undefined, this.personExtras(data.claimant));
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
                where: { personId: memberPerson.id, householdId: existingHousehold.id },
              });
              if (!existingMembership) {
                await queryRunner.manager.save(queryRunner.manager.create(HouseholdMembership, {
                  personId: memberPerson.id,
                  householdId: existingHousehold.id,
                  relationship: fm.relationship,
                  isPrimary: false,
                  status: fm.status,
                }));
              }
            }
          }
          await queryRunner.commitTransaction();
          return {
            beneficiaryId: existingBeneficiary.id,
            caseId: recentCase.id,
            controlNo: recentCase.controlNo,
            status: recentCase.status,
          };
        }
      }

      // 2. Beneficiary — reuse the existing thin record if the person already has one, else create.
      let savedBeneficiary = existingBeneficiary ?? null;
      if (!savedBeneficiary) {
        const beneficiary = this.benRepo.create({
          personId: benPerson.id,
        });
        savedBeneficiary = await queryRunner.manager.save(beneficiary);

        // Own category/consent_status via the person-keyed beneficiary_roles child row.
        await queryRunner.manager.save(
          queryRunner.manager.create(BeneficiaryRole, {
            personId: benPerson.id,
            consentStatus: 'active',
          }),
        );
      }

      // 3. Create Person for CLAIMANT (always new, no dedup)
      const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, false, undefined, this.personExtras(data.claimant));

      // 4. Create BeneficiaryClaimant link
      await queryRunner.manager.save(queryRunner.manager.create(BeneficiaryClaimant, {
        beneficiaryId: benPerson.id,
        claimantId: claimPerson.id,
        relationship: data.claimant.relationshipToBeneficiary,
        isPrimary: true,
        calendarYear: new Date().getFullYear(),
      }));

      // 5. Household — reuse the existing one when present (new assistance episode), else create.
      let savedHousehold = existingHousehold;
      if (!savedHousehold) {
        const household = this.hhRepo.create({
          primaryBeneficiaryId: savedBeneficiary.id,
          barangay: data.beneficiary.currentAddress?.barangay || '',
          estimatedIncome: data.beneficiary.estimatedMonthlyIncome,
        });
        savedHousehold = await queryRunner.manager.save(household);
      }

      // 6. Link Beneficiary to Household
      if (savedBeneficiary.householdId !== savedHousehold.id) {
        savedBeneficiary.householdId = savedHousehold.id;
        await queryRunner.manager.save(savedBeneficiary);
      }

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
        assignedWorkerId: caller && isCaseWorker(caller.role) ? caller.id : undefined,
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
      this.logger.error('submitIntake failed', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Service temporarily unavailable. Please try again.');
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

    if (!existingCase.beneficiaryId) {
      throw new BadRequestException('Case is not linked to a beneficiary');
    }

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
      this.logger.error('submitBatchFamily failed', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Service temporarily unavailable. Please try again.');
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
        b.id AS ben_id, p.surname, p.first_name,
        (SELECT pa2.raw FROM person_addresses pa2 WHERE pa2.person_id = p.id AND pa2.address_type = 'current' LIMIT 1) AS address,
        (SELECT pc2.value FROM person_contacts pc2 WHERE pc2.person_id = p.id AND pc2.contact_type = 'phone' LIMIT 1) AS phone,
        p.occupation, p.estimated_monthly_income,
        p.civil_status,
        (SELECT jsonb_build_object('barangay', pa3.barangay, 'city', pa3.city, 'province', pa3.province)
         FROM person_addresses pa3 WHERE pa3.person_id = p.id AND pa3.address_type = 'current' LIMIT 1) AS current_address,
        p.philhealth_number, EXTRACT(YEAR FROM AGE(NOW(), p.dob))::integer AS age, p.gender, p.middle_name, br.category,
        (SELECT json_agg(json_build_object('id', b2.id, 'surname', p2.surname, 'first_name', p2.first_name))
         FROM beneficiaries b2
         JOIN persons p2 ON p2.id = b2.person_id
         WHERE b2.household_id = h.id) AS all_beneficiaries,
        (SELECT json_agg(json_build_object(
          'id', hm.id, 'fullName', TRIM(CONCAT(p3.first_name, ' ', p3.surname)),
          'relationship', hm.relationship,
          'age', EXTRACT(YEAR FROM AGE(NOW(), p3.dob))::integer, 'occupation', p3.occupation,
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
      LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id
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

  async confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[], caller: Pick<User, 'id' | 'role'>): Promise<ConfirmMatchResponse> {
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
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true, undefined, this.personExtras(data.beneficiary));

      let savedBeneficiary = await queryRunner.manager.findOne(Beneficiary, {
        where: { personId: benPerson.id },
      });
      if (!savedBeneficiary) {
        savedBeneficiary = await queryRunner.manager.save(queryRunner.manager.create(Beneficiary, {
          personId: benPerson.id,
          householdId,
        }));

        await queryRunner.manager.save(
          queryRunner.manager.create(BeneficiaryRole, {
            personId: benPerson.id,
            consentStatus: 'active',
          }),
        );
      }

      const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true, undefined, this.personExtras(data.claimant));
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
assignedWorkerId: caller && isCaseWorker(caller.role) ? caller.id : undefined,
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
      this.logger.error('confirmMatch failed', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Service temporarily unavailable. Please try again.');
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
