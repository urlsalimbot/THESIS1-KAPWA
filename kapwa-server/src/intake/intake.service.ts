import { Injectable, InternalServerErrorException, HttpException, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { Person } from '../beneficiaries/person.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { BeneficiaryRole } from '../beneficiaries/beneficiary-role.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case, CaseStatus } from '../cases/case.entity';
import { CaseHistory } from '../cases/case-history.entity';
import { CaseRequirement } from '../cases/case-requirement.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesService } from '../cases/cases.service';
import { AccessCardsService } from '../access-cards/access-cards.service';
import { AccountProvisioningService } from '../accounts/account-provisioning.service';
import { Referral, ReferralStatus } from '../referrals/referral.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { memberToPerson } from './member-person';
import { assessMatchCandidate, soundex } from './match-scoring';
import { User, UserRole } from '../auth/user.entity';
import type { IntakeInput, MatchCheckInput, MatchCandidate, ConfirmMatchInput, ConfirmMatchResponse } from './dto/intake.zod';

// Only MSWDO staff (admin / social worker) may be assigned as a case worker;
// coordinators are not MSWDO employees and must never be assigned.
function isCaseWorker(role?: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.SW;
}

// Claimant relationships that mean the claimant lives in the beneficiary's
// household. A claimant with one of these is recorded as a household member;
// everyone else (Legal Guardian, Unrelated Caretaker, Self, …) is linked via
// beneficiary_claimants only and is NOT added to the household.
const FAMILY_HOUSEHOLD_RELATIONSHIPS = new Set(['spouse', 'child', 'parent', 'sibling', 'relative']);

function isFamilyHouseholdRelationship(relationship?: string | null): boolean {
  const normalized = (relationship ?? '').trim().toLowerCase();
  return normalized.length > 0 && FAMILY_HOUSEHOLD_RELATIONSHIPS.has(normalized);
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
    private accessCards: AccessCardsService,
    private claimants: AccountProvisioningService,
  ) {}

  // Best-effort claimant account provisioning, run AFTER the intake commits.
  // Never throws: an email/SMS failure must not fail a successful intake.
  private async provisionClaimant(
    claimantPersonId: string | undefined,
    beneficiaryId: string,
    beneficiaryName: string,
    controlNo: string,
    data: IntakeInput,
    actorId?: string,
  ): Promise<void> {
    if (!claimantPersonId) return;
    try {
      await this.claimants.provision({
        claimantPersonId,
        beneficiaryId,
        beneficiaryName,
        controlNo,
        email: data.claimant?.email,
        phone: data.claimant?.cellularNumber,
        actorId,
      });
    } catch (e) {
      this.logger.warn(`Claimant provisioning failed for beneficiary ${beneficiaryId}: ${(e as Error)?.message ?? e}`);
    }
  }

  /**
   * Attach the case produced by this intake to the referral that handed off to
   * it. Runs inside the caller's transaction, so a case can never be committed
   * without its referral link.
   *
   * An unknown, not-yet-accepted, or differently-linked referral is logged and
   * skipped: the intake is the primary operation and the link is bookkeeping.
   */
  private async linkSourceReferral(
    manager: EntityManager,
    sourceReferral: IntakeInput['sourceReferral'],
    caseId: string | undefined,
  ): Promise<void> {
    if (!sourceReferral || !caseId) return;
    const { type, id } = sourceReferral;

    if (type === 'barangay') {
      const referral = await manager.findOne(Referral, { where: { id } });
      if (!referral) {
        this.logger.warn(`Intake ${caseId}: barangay referral ${id} not found; link skipped`);
        return;
      }
      if (referral.status !== ReferralStatus.ACCEPTED) {
        this.logger.warn(
          `Intake ${caseId}: barangay referral ${id} is "${referral.status}", not accepted; link skipped`,
        );
        return;
      }
      if (referral.caseId && referral.caseId !== caseId) {
        this.logger.warn(
          `Intake ${caseId}: barangay referral ${id} already linked to ${referral.caseId}; link skipped`,
        );
        return;
      }
      await manager.update(Referral, id, { caseId });
      return;
    }

    const referral = await manager.findOne(InterAgencyReferral, { where: { id } });
    if (!referral) {
      this.logger.warn(`Intake ${caseId}: inter-agency referral ${id} not found; link skipped`);
      return;
    }
    if (referral.status !== 'received') {
      this.logger.warn(
        `Intake ${caseId}: inter-agency referral ${id} is "${referral.status}", not received; link skipped`,
      );
      return;
    }
    if (referral.caseId && referral.caseId !== caseId) {
      this.logger.warn(
        `Intake ${caseId}: inter-agency referral ${id} already linked to ${referral.caseId}; link skipped`,
      );
      return;
    }
    await manager.update(InterAgencyReferral, id, { caseId });
  }

  // A PhilHealth number is unique per client. Only treat the holder as "the
  // same client" when surname + firstName (and dob, when both sides carry one)
  // agree — otherwise the number belongs to someone else and the intake must be
  // rejected, never silently reuse/overwrite that person's record.
  private isSameClient(
    existing: Partial<Person>,
    incoming: Partial<Person>,
  ): boolean {
    const sameName =
      String(existing.surname ?? '').trim().toLowerCase() ===
        String(incoming.surname ?? '').trim().toLowerCase() &&
      String(existing.firstName ?? '').trim().toLowerCase() ===
        String(incoming.firstName ?? '').trim().toLowerCase();
    if (!sameName) return false;
    if (!existing.dob || !incoming.dob) return true;
    return new Date(existing.dob as any).toDateString() ===
      new Date(incoming.dob as any).toDateString();
  }

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

    // Duplicate-PhilHealth guard, on every path (dedup-reuse and fresh-create
    // alike): a number already registered to a DIFFERENT client was previously
    // either silently merged into that client's record or blew up as a generic
    // 500 (DB unique violation). Surface it as a field-targeted 409 instead.
    let existing: Person | null = null;
    if (data.philhealthNumber) {
      existing = await find({ philhealthNumber: data.philhealthNumber });
      if (existing && !this.isSameClient(existing, data)) {
        throw new ConflictException('PhilHealth number already registered to another client');
      }
    }

    let saved: Person;
    if (deduplicate) {
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
             street = $2,
             barangay = $3,
             city = $4,
             province = $5,
             region = $6,
             postal = $7,
             is_primary = TRUE
           WHERE person_id = $1 AND address_type = 'current' RETURNING id
         )
         INSERT INTO person_addresses (person_id, address_type, street, barangay, city, province, region, postal, is_primary)
         SELECT $1, 'current', $2, $3, $4, $5, $6, $7, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM updated)`,
        [
          personId,
          currentAddress.street ?? null,
          currentAddress.barangay ?? null,
          currentAddress.city ?? null,
          currentAddress.province ?? null,
          currentAddress.region ?? null,
          currentAddress.postalCode ?? null,
        ],
      );
    }
  }

  /**
   * Add a person to a household's roster (idempotent). Used for claimants who
   * are household/family relations, so they appear in the roster and in
   * match-check alongside beneficiaries and other members.
   */
  private async ensureHouseholdMembership(
    em: EntityManager,
    personId: string,
    householdId: string,
    relationship: string,
  ): Promise<void> {
    const existing = await em.findOne(HouseholdMembership, { where: { personId, householdId } });
    if (!existing) {
      await em.save(em.create(HouseholdMembership, {
        personId,
        householdId,
        relationship,
        isPrimary: false,
      }));
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

  /**
   * Refuse an intake for a referral that has already produced a case.
   *
   * Accepting a referral no longer creates the case (the intake does), so a
   * worker who re-enters the pre-filled intake — after a reload, via Continue
   * intake, or by pressing Back after submitting — would otherwise open a second
   * case for the same referral. `linkSourceReferral` only refuses to *re-point*
   * an existing link, which is too late: the duplicate case already exists.
   */
  private async assertReferralNotConverted(
    sourceReferral: IntakeInput['sourceReferral'],
  ): Promise<void> {
    if (!sourceReferral) return;

    const caseId = sourceReferral.type === 'barangay'
      ? (await this.dataSource.getRepository(Referral).findOne({ where: { id: sourceReferral.id } }))?.caseId
      : (await this.dataSource.getRepository(InterAgencyReferral).findOne({ where: { id: sourceReferral.id } }))?.caseId;
    if (!caseId) return;

    const existing = await this.caseRepo.findOne({ where: { id: caseId } });
    throw new ConflictException(
      `This referral already has case ${existing?.controlNo ?? caseId}. Open that case instead of starting a new intake.`,
    );
  }

  async submitIntake(data: IntakeInput, caller?: Pick<User, 'id' | 'role'>): Promise<{
    beneficiaryId: string;
    caseId: string;
    controlNo: string;
    status: string;
  }> {
    await this.assertReferralNotConverted(data.sourceReferral);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    await queryRunner.query(`SELECT pg_advisory_xact_lock($1, $2)`, this.hashToLockPair(data.beneficiary.surname, data.beneficiary.firstName, data.beneficiary.dob));

    try {
      // 1. Find or create Person for BENEFICIARY (with dedup check)
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true, { currentAddress: data.beneficiary.currentAddress }, this.personExtras(data.beneficiary));

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
const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true, { currentAddress: data.claimant.currentAddress }, this.personExtras(data.claimant));
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
          // Family-relation claimants live in the household: roster them as members too.
          if (isFamilyHouseholdRelationship(data.claimant.relationshipToBeneficiary)) {
            await this.ensureHouseholdMembership(queryRunner.manager, claimPerson.id, existingHousehold.id, data.claimant.relationshipToBeneficiary);
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
          await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, recentCase.id);
          await queryRunner.commitTransaction();
          await this.provisionClaimant(
            claimPerson.id,
            existingBeneficiary.id,
            `${data.beneficiary.firstName} ${data.beneficiary.surname}`.trim(),
            recentCase.controlNo,
            data,
            caller?.id,
          );
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

      // 7b. Family-relation claimants live in the household: roster them as members too.
      if (isFamilyHouseholdRelationship(data.claimant.relationshipToBeneficiary)) {
        await this.ensureHouseholdMembership(queryRunner.manager, claimPerson.id, savedHousehold.id, data.claimant.relationshipToBeneficiary);
      }

      // 8. Generate controlNo
      const controlNo = await this.casesService.generateControlNo();

      // 9. Create Case
      const caseEntity = this.caseRepo.create({
        controlNo,
        beneficiaryId: savedBeneficiary.id,
        renewalOfCaseId: data.renewalOfCaseId,
        status: CaseStatus.ENROLLED,
        serviceRequested: data.case.serviceRequested,
        assignedWorkerId: caller && isCaseWorker(caller.role) ? caller.id : undefined,
      });
      const savedCase = await queryRunner.manager.save(caseEntity);

      // Record the intake in the case history so the Case History panel has an
      // opening entry from the moment the case exists, instead of staying empty
      // until the first status transition.
      await queryRunner.manager.save(CaseHistory, {
        caseId: savedCase.id,
        fromStatus: undefined,
        toStatus: CaseStatus.ENROLLED,
        changedByRole: caller?.role,
        changedById: caller?.id,
        remarks: data.renewalOfCaseId
          ? 'Case created by renewal intake'
          : 'Case created by general intake',
        transitionType: 'standard',
      });

      if (data.case?.requirementsChecklist) {
        for (const [requirementKey, met] of Object.entries(data.case.requirementsChecklist)) {
          await queryRunner.manager.save(CaseRequirement, {
            caseId: savedCase.id,
            requirementKey,
            met,
          });
        }
      }

      // 10. Create ConsentLedger
      const consent = this.consentRepo.create({
        beneficiaryId: savedBeneficiary.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      await queryRunner.manager.save(consent);

      await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, savedCase.id);

      await queryRunner.commitTransaction();

      // Auto-assign the household access card (best-effort — a card failure
      // must never fail the intake itself; the card can be assigned later
      // from the beneficiary page).
      try {
        await this.accessCards.ensureHouseholdCard(savedBeneficiary.id);
      } catch (e) {
        this.logger.warn(`Access card auto-assign failed for beneficiary ${savedBeneficiary.id}: ${(e as Error)?.message ?? e}`);
      }

      await this.provisionClaimant(
        claimPerson.id,
        savedBeneficiary.id,
        `${data.beneficiary.firstName} ${data.beneficiary.surname}`.trim(),
        controlNo,
        data,
        caller?.id,
      );

      return {
        beneficiaryId: savedBeneficiary.id,
        caseId: savedCase.id,
        controlNo,
        status: CaseStatus.ENROLLED,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Surface deliberate 4xx outcomes (duplicate referral, validation, …)
      // instead of masking every failure as a generic 500.
      if (error instanceof HttpException) {
        this.logger.warn(`submitIntake rejected: ${error.message}`);
        throw error;
      }
      // Safety net for the duplicate-PhilHealth guard: if a prod-only unique
      // index on persons.philhealth_number rejects the insert (e.g. the dedup
      // lookup raced two different identities under the same number), report it
      // as the same field-targeted 409 instead of the generic 500.
      if (
        (error as { code?: string; message?: string })?.code === '23505' &&
        /philhealth/i.test((error as { message?: string })?.message ?? '')
      ) {
        throw new ConflictException('PhilHealth number already registered to another client');
      }
      this.logger.error('submitIntake failed', error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Service temporarily unavailable. Please try again.');
    } finally {
      await queryRunner.release();
    }
  }

  async matchCheck(data: MatchCheckInput, workerBarangays: string[]): Promise<{ candidates: MatchCandidate[] }> {
    const familyNames = (data.familyMembers || []).map(f => `${f.surname}, ${f.firstName}`).filter(Boolean);

    // Score in SQL (pg_trgm + cheap exact-PII flags), decide in TS:
    // the coarse WHERE is multi-pass blocking (name trigram OR any PII block)
    // that keeps every row that could still qualify under assessMatchCandidate.
    // Roster: every person linked to the household — all beneficiaries sharing
    // the household plus household_memberships rows — deduplicated per person
    // (beneficiary wins over member). One candidate per household, carrying the
    // best-scoring matched person.
    const raw = await this.dataSource.query(
      `WITH roster AS (
        SELECT
          h.id AS household_id,
          b.id AS ben_id,
          p.id AS person_id,
          'beneficiary' AS role,
          NULL::text AS member_relationship,
          p.surname, p.first_name, p.middle_name, p.gender, p.dob,
          p.philhealth_number, p.occupation, p.estimated_monthly_income, p.civil_status
        FROM households h
        JOIN beneficiaries b ON b.household_id = h.id
        JOIN persons p ON p.id = b.person_id
        UNION ALL
        SELECT
          h.id, NULL, p.id, 'member', hm.relationship,
          p.surname, p.first_name, p.middle_name, p.gender, p.dob,
          p.philhealth_number, p.occupation, p.estimated_monthly_income, p.civil_status
        FROM households h
        JOIN household_memberships hm ON hm.household_id = h.id
        JOIN persons p ON p.id = hm.person_id
      ),
      ranked AS (
        SELECT r.*,
          ROW_NUMBER() OVER (
            PARTITION BY r.household_id, r.person_id
            ORDER BY CASE r.role WHEN 'beneficiary' THEN 0 ELSE 1 END
          ) AS rn
        FROM roster r
      ),
      scores AS (
        SELECT
          hs.household_id, hs.person_id, hs.ben_id, hs.role, hs.member_relationship,
          hs.surname, hs.first_name, hs.middle_name, hs.gender,
          hs.dob, hs.philhealth_number, hs.occupation, hs.estimated_monthly_income, hs.civil_status,
          similarity(hs.surname, $1::text) AS sim_surname,
          similarity(hs.first_name, $2::text) AS sim_first,
          CASE WHEN $3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0 THEN (
            SELECT COALESCE(AVG(sub.best), 0)
            FROM (
              SELECT MAX(similarity(TRIM(CONCAT(p2.first_name, ' ', p2.surname)), u.name)) AS best
              FROM household_memberships hm2
              JOIN persons p2 ON p2.id = hm2.person_id
              CROSS JOIN unnest($3::text[]) AS u(name)
              WHERE hm2.household_id = hs.household_id
              GROUP BY u.name
            ) sub
          ) ELSE 0 END AS family_score,
          (CASE WHEN $4::text IS NOT NULL AND $4::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN hs.dob = $4::date ELSE false END) AS dob_match,
          (CASE WHEN $5::text IS NOT NULL AND $5::text <> '' THEN EXISTS (
            SELECT 1 FROM person_contacts pc
            WHERE pc.person_id = hs.person_id AND pc.contact_type = 'phone'
              AND right('0000000000' || regexp_replace(pc.value, '[^0-9]', '', 'g'), 10)
                = right('0000000000' || regexp_replace($5::text, '[^0-9]', '', 'g'), 10)
          ) ELSE false END) AS phone_match,
          (CASE WHEN $6::text IS NOT NULL AND $6::text <> '' THEN EXISTS (
            SELECT 1 FROM person_contacts pc
            WHERE pc.person_id = hs.person_id AND pc.contact_type = 'email'
              AND lower(trim(pc.value)) = lower(trim($6::text))
          ) ELSE false END) AS email_match,
          (CASE WHEN $7::text IS NOT NULL AND $7::text <> '' THEN
            COALESCE(regexp_replace(hs.philhealth_number, '[^0-9]', '', 'g') = regexp_replace($7::text, '[^0-9]', '', 'g'), false)
          ELSE false END) AS philhealth_match,
          (CASE WHEN $8::text IS NOT NULL AND $8::text <> '' THEN EXISTS (
            SELECT 1 FROM person_addresses pa
            WHERE pa.person_id = hs.person_id AND pa.address_type = 'current'
              AND lower(trim(pa.barangay)) = lower(trim($8::text))
          ) ELSE false END) AS barangay_match
        FROM ranked hs
        WHERE hs.rn = 1
      )
      SELECT
        hs.household_id AS household_id,
        hs.sim_surname, hs.sim_first, hs.family_score,
        hs.dob_match, hs.phone_match, hs.email_match, hs.philhealth_match, hs.barangay_match,
        hs.person_id, hs.ben_id, hs.role, hs.member_relationship,
        hs.surname, hs.first_name, hs.middle_name, hs.gender,
        (SELECT pa2.raw FROM person_addresses pa2 WHERE pa2.person_id = hs.person_id AND pa2.address_type = 'current' LIMIT 1) AS address,
        (SELECT pc2.value FROM person_contacts pc2 WHERE pc2.person_id = hs.person_id AND pc2.contact_type = 'phone' LIMIT 1) AS phone,
        (SELECT pc2e.value FROM person_contacts pc2e WHERE pc2e.person_id = hs.person_id AND pc2e.contact_type = 'email' LIMIT 1) AS email,
        hs.occupation, hs.estimated_monthly_income,
        hs.civil_status,
        to_char(hs.dob, 'YYYY-MM-DD') AS dob,
        (SELECT jsonb_build_object('barangay', pa3.barangay, 'city', pa3.city, 'province', pa3.province)
         FROM person_addresses pa3 WHERE pa3.person_id = hs.person_id AND pa3.address_type = 'current' LIMIT 1) AS current_address,
        hs.philhealth_number, EXTRACT(YEAR FROM AGE(NOW(), hs.dob))::integer AS age, br.category,
        bp.id AS primary_ben_id, pp.surname AS primary_surname, pp.first_name AS primary_first_name,
        pp.middle_name AS primary_middle_name, pp.gender AS primary_gender,
        EXTRACT(YEAR FROM AGE(NOW(), pp.dob))::integer AS primary_age,
        to_char(pp.dob, 'YYYY-MM-DD') AS primary_dob,
        (SELECT pc2p.value FROM person_contacts pc2p WHERE pc2p.person_id = pp.id AND pc2p.contact_type = 'phone' LIMIT 1) AS primary_phone,
        (SELECT pc2pe.value FROM person_contacts pc2pe WHERE pc2pe.person_id = pp.id AND pc2pe.contact_type = 'email' LIMIT 1) AS primary_email,
        pp.occupation AS primary_occupation, pp.estimated_monthly_income AS primary_income,
        pp.civil_status AS primary_civil_status,
        (SELECT jsonb_build_object('barangay', pa3p.barangay, 'city', pa3p.city, 'province', pa3p.province)
         FROM person_addresses pa3p WHERE pa3p.person_id = pp.id AND pa3p.address_type = 'current' LIMIT 1) AS primary_current_address,
        pp.philhealth_number AS primary_philhealth_number,
        h.barangay AS household_barangay,
        (SELECT json_agg(json_build_object('id', b2.id, 'surname', p2.surname, 'first_name', p2.first_name))
         FROM beneficiaries b2
         JOIN persons p2 ON p2.id = b2.person_id
         WHERE b2.household_id = h.id) AS all_beneficiaries,
        (SELECT json_agg(json_build_object(
          'id', hm.id, 'fullName', TRIM(CONCAT(p3.first_name, ' ', p3.surname)),
          'surname', p3.surname, 'firstName', p3.first_name, 'middleName', p3.middle_name,
          'gender', p3.gender, 'dob', to_char(p3.dob, 'YYYY-MM-DD'),
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
          WHERE b3.household_id = h.id AND c.status = 'active') AS last_case_date,
        (SELECT COALESCE(json_agg(x ORDER BY x."createdAt" DESC), '[]'::json)
         FROM (
           SELECT c.control_no AS "controlNo",
                  TRIM(CONCAT(pc1.first_name, ' ', pc1.surname)) AS "beneficiaryName",
                  c.status, c.created_at AS "createdAt"
           FROM cases c
           JOIN beneficiaries b4 ON b4.id = c.beneficiary_id
           JOIN persons pc1 ON pc1.id = b4.person_id
           WHERE b4.household_id = h.id
           UNION ALL
           SELECT c.control_no,
                  TRIM(CONCAT(pc2.first_name, ' ', pc2.surname)),
                  c.status, c.created_at
           FROM cases c
           JOIN beneficiaries b5 ON b5.id = c.beneficiary_id
           JOIN persons pc2 ON pc2.id = b5.person_id
           WHERE b5.person_id = hs.person_id
         ) x
         LIMIT 6) AS past_cases
      FROM scores hs
      JOIN households h ON h.id = hs.household_id
      JOIN beneficiaries bp ON bp.id = h.primary_beneficiary_id
      JOIN persons pp ON pp.id = bp.person_id
      LEFT JOIN beneficiary_roles br ON br.person_id = hs.person_id
      WHERE hs.sim_surname >= 0.4 OR hs.sim_first >= 0.4 OR hs.family_score >= 0.6
        OR hs.dob_match OR hs.phone_match OR hs.email_match OR hs.philhealth_match OR hs.barangay_match
      ORDER BY (0.6 * ((hs.sim_surname + hs.sim_first) / 2) + 0.4 * hs.family_score) DESC
      LIMIT 50`,
      [data.surname, data.firstName, familyNames.length > 0 ? familyNames : null,
        data.dob ?? null, data.phone ?? null, data.email ?? null, data.philhealthNumber ?? null, data.barangay ?? null],
    );

    const candidates: MatchCandidate[] = (raw as any[])
      .map(r => ({
        row: r,
        assessment: assessMatchCandidate({
          simSurname: parseFloat(r.sim_surname) || 0,
          simFirstName: parseFloat(r.sim_first) || 0,
          familyScore: parseFloat(r.family_score) || 0,
          dobMatch: Boolean(r.dob_match),
          phoneMatch: Boolean(r.phone_match),
          emailMatch: Boolean(r.email_match),
          philhealthMatch: Boolean(r.philhealth_match),
          barangayMatch: Boolean(r.barangay_match),
          surnamePhoneticMatch: soundex(r.surname) === soundex(data.surname),
        }),
      }))
      .filter(({ assessment, row }) => {
        if (!assessment.isMatch) return false;
        if (workerBarangays.length === 0) return true;
        // Permission scope is the household's barangay, not the matched person's.
        return workerBarangays.includes(row.household_barangay || '');
      })
      .sort((a, b) => b.assessment.score - a.assessment.score)
      .slice(0, 10)
      .map(({ row: r, assessment }) => ({
        householdId: r.household_id,
        score: assessment.score,
        matchedOn: assessment.matchedOn,
        caseExistsWithin30Days: Boolean(r.case_exists_30d),
        primaryBeneficiary: {
          id: r.primary_ben_id,
          surname: r.primary_surname,
          firstName: r.primary_first_name,
          middleName: r.primary_middle_name || undefined,
          gender: r.primary_gender,
          age: r.primary_age,
          dob: r.primary_dob || undefined,
          phone: r.primary_phone || '',
          email: r.primary_email || undefined,
          occupation: r.primary_occupation || '',
          estimatedMonthlyIncome: r.primary_income ? parseFloat(r.primary_income) : 0,
          civilStatus: r.primary_civil_status || '',
          currentAddress: r.primary_current_address || null,
          philhealthNumber: r.primary_philhealth_number || undefined,
        },
        matchedPerson: {
          id: r.person_id,
          role: r.role === 'member' ? 'member' : 'beneficiary',
          relationship: r.member_relationship || undefined,
          surname: r.surname,
          firstName: r.first_name,
          middleName: r.middle_name || undefined,
          gender: r.gender,
          age: r.age,
          dob: r.dob || undefined,
          phone: r.phone || '',
          email: r.email || undefined,
          occupation: r.occupation || '',
          estimatedMonthlyIncome: r.estimated_monthly_income ? parseFloat(r.estimated_monthly_income) : 0,
          civilStatus: r.civil_status || '',
          currentAddress: r.current_address || null,
          philhealthNumber: r.philhealth_number || undefined,
          category: r.category || undefined,
        },
        allBeneficiaries: r.all_beneficiaries || [],
        familyMembers: r.family_members || [],
        pastCases: r.past_cases || [],
        lastApprovedCaseDate: r.last_case_date ? r.last_case_date.toISOString() : null,
      }));

    return { candidates };
  }

  async confirmMatch(householdId: string, data: ConfirmMatchInput, workerBarangays: string[], caller: Pick<User, 'id' | 'role'>): Promise<ConfirmMatchResponse> {
    await this.assertReferralNotConverted(data.sourceReferral);

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
      const benPerson = await this.findOrCreatePerson(this.personFromInput(data.beneficiary), queryRunner, true, { currentAddress: data.beneficiary.currentAddress }, this.personExtras(data.beneficiary));

      let savedBeneficiary = await queryRunner.manager.findOne(Beneficiary, {
        where: { personId: benPerson.id },
      });
      // An "exact beneficiary match": the confirmed person already has a
      // Beneficiary record, so their recent household case can be reused. If
      // they were not a beneficiary before (e.g. a household member match), a
      // NEW case must be opened for them even when the household has a recent
      // case belonging to someone else.
      const wasAlreadyBeneficiary = Boolean(savedBeneficiary);
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

      const claimPerson = await this.findOrCreatePerson(this.personFromInput(data.claimant), queryRunner, true, { currentAddress: data.claimant.currentAddress }, this.personExtras(data.claimant));
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

      // Family-relation claimants live in the household: roster them as members too.
      if (isFamilyHouseholdRelationship(data.claimant.relationshipToBeneficiary)) {
        await this.ensureHouseholdMembership(queryRunner.manager, claimPerson.id, householdId, data.claimant.relationshipToBeneficiary);
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

      const controlNo = recentCase && wasAlreadyBeneficiary ? undefined : await this.casesService.generateControlNo();

      let savedCase = null;
      if (!recentCase || !wasAlreadyBeneficiary) {
const caseEntity = this.caseRepo.create({
          controlNo,
          beneficiaryId: savedBeneficiary.id,
          status: CaseStatus.ENROLLED,
          serviceRequested: data.case.serviceRequested,
          assignedWorkerId: caller && isCaseWorker(caller.role) ? caller.id : undefined,
        });
        savedCase = await queryRunner.manager.save(caseEntity);

        // Opening history entry for the confirmed-match intake (see submitIntake).
        await queryRunner.manager.save(CaseHistory, {
          caseId: savedCase.id,
          fromStatus: undefined,
          toStatus: CaseStatus.ENROLLED,
          changedByRole: caller?.role,
          changedById: caller?.id,
          remarks: 'Case created from a confirmed prior-records match',
          transitionType: 'standard',
        });

        if (data.case?.requirementsChecklist) {
          for (const [requirementKey, met] of Object.entries(data.case.requirementsChecklist)) {
            await queryRunner.manager.save(CaseRequirement, {
              caseId: savedCase.id,
              requirementKey,
              met,
            });
          }
        }
      }

      const consent = this.consentRepo.create({
        beneficiaryId: savedBeneficiary.id,
        purpose: 'registration',
        channel: 'web',
        status: 'active',
      });
      await queryRunner.manager.save(consent);

      await this.linkSourceReferral(queryRunner.manager, data.sourceReferral, savedCase?.id ?? undefined);

      await queryRunner.commitTransaction();

      const existingCaseDate = recentCase?.createdAt?.toISOString() || null;

      return {
        updated: true,
        caseCreated: Boolean(savedCase),
        beneficiaryId: savedBeneficiary.id,
        caseId: savedCase?.id || null,
        controlNo: controlNo || null,
        status: savedCase ? CaseStatus.ENROLLED : null,
        existingCaseDate,
        message: savedCase
          ? 'Info updated and new case created.'
          : `Info updated. No new case created — this household already has a case from ${new Date(recentCase!.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof HttpException) {
        this.logger.warn(`confirmMatch rejected: ${error.message}`);
        throw error;
      }
      // Same duplicate-PhilHealth safety net as submitIntake.
      if (
        (error as { code?: string; message?: string })?.code === '23505' &&
        /philhealth/i.test((error as { message?: string })?.message ?? '')
      ) {
        throw new ConflictException('PhilHealth number already registered to another client');
      }
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
