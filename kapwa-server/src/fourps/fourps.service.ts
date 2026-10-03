import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseComplianceItem, ComplianceType } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { AccessCardsService, AccessCardCategory } from '../access-cards/access-cards.service';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';

/**
 * Whoever caused an access-card row to exist. Structurally satisfied by the
 * authenticated `User`, so controllers can pass `req.user` straight through.
 */
export interface CardLoggingActor {
  id: string;
  assignedBarangay?: string;
}

export function ageFromDob(dob: string | Date | null | undefined, now: Date = new Date()): number {
  if (!dob) return 0;
  const d = new Date(dob);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - d.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

@Injectable()
export class FourPsService {
  constructor(
    @InjectRepository(CaseComplianceItem)
    private complianceRepo: Repository<CaseComplianceItem>,
    @InjectRepository(CasePayout)
    private payoutRepo: Repository<CasePayout>,
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
    private readonly accessCards: AccessCardsService,
  ) {}

  private readonly logger = new Logger(FourPsService.name);

  // 4Ps activity is logged against the household access card (payouts and
  // compliance check-offs) so the ledger and the printed card stay complete
  // without a second manual entry. Best-effort: a logging failure must never
  // fail the 4Ps action itself — but it must not vanish silently either, since
  // a dropped row is a gap in the beneficiary's service ledger.
  private async logToCard(
    caseId: string,
    entry: { serviceRendered: string; serviceDate: Date; cost?: number; category: AccessCardCategory },
    actor: CardLoggingActor,
  ) {
    try {
      const rows = await this.payoutRepo.query(
        'SELECT beneficiary_id FROM cases WHERE id = $1 LIMIT 1',
        [caseId],
      );
      const beneficiaryId = rows?.[0]?.beneficiary_id;
      if (!beneficiaryId) return;
      const code = await this.accessCards.accessCardCodeFor(beneficiaryId);
      await this.accessCards.logService({
        accessCardCode: code,
        serviceRendered: entry.serviceRendered,
        serviceDate: entry.serviceDate,
        cost: entry.cost,
        category: entry.category,
        // Same audit columns the manual logging route writes, so a coordinator's
        // barangay-scoped list actually shows the 4Ps rows and every row names
        // the staff member who caused it.
        loggedBy: actor.id,
        sourceBarangay: actor.assignedBarangay,
      });
    } catch (err) {
      // Card may not exist yet — the 4Ps record is still authoritative.
      this.logger.warn(
        `4Ps card logging skipped for case ${caseId}: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  async generateComplianceItems(caseId: string): Promise<number> {
    const caseRows = await this.complianceRepo.query(
      `SELECT b.household_id
       FROM cases c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.id = $1`,
      [caseId],
    );
    const householdId = caseRows?.[0]?.household_id;
    if (!householdId) throw new NotFoundException('Household has no access card');

    const cardRows = await this.complianceRepo.query(
      `SELECT access_card_code FROM households WHERE id = $1`,
      [householdId],
    );
    if (!cardRows?.[0]?.access_card_code) {
      throw new NotFoundException('Household has no access card');
    }

    const members = await this.complianceRepo.query(
      `SELECT hm.person_id, p.gender, p.dob, hm.relationship, hm.is_primary
       FROM household_memberships hm
       JOIN persons p ON p.id = hm.person_id
       WHERE hm.household_id = $1`,
      [householdId],
    );

    const now = new Date();
    let count = 0;

    for (const member of members ?? []) {
      const age = ageFromDob(member.dob, now);
      const isSpouse = String(member.relationship ?? '').toLowerCase() === 'spouse';
      const types: ComplianceType[] = [];
      if (age >= 3 && age <= 18) types.push('school_attendance');
      if (age < 3 || (member.gender === 'Female' && isSpouse)) types.push('health_checkup');
      if (member.is_primary || isSpouse) types.push('fds');

      for (let i = 0; i < 12; i++) {
        const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
        const dueDate = due.toISOString().slice(0, 10);
        const monthLabel = due.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        for (const complianceType of types) {
          const inserted = await this.complianceRepo.query(
            `INSERT INTO case_compliance_items
               (id, case_id, household_member_id, compliance_type, due_date, month_label)
             VALUES (uuid_generate_v7(), $1, $2, $3, $4, $5)
             ON CONFLICT (case_id, household_member_id, compliance_type, due_date) DO NOTHING
             RETURNING id`,
            [caseId, member.person_id, complianceType, dueDate, monthLabel],
          );
          count += inserted.length;
        }
      }
    }

    return count;
  }

  /**
   * Household context for the 4Ps page: the control number for the breadcrumb,
   * the access-card link, and the members the conditions apply to. Served from
   * the 4Ps module so a coordinator — who may use the 4Ps endpoints but not the
   * case-detail endpoint — still gets the whole page.
   */
  async getCaseContext(caseId: string): Promise<{
    controlNo: string | null;
    beneficiaryId: string | null;
    accessCardCode: string | null;
    members: Array<{
      id: string; fullName: string; relationship: string; age: number | null;
      occupation: string | null; income: number | null; status: string | null; isPrimary: boolean;
    }>;
  }> {
    const rows = await this.complianceRepo.query(
      `SELECT c.control_no, b.id AS beneficiary_id, b.household_id
       FROM cases c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.id = $1
       LIMIT 1`,
      [caseId],
    );
    const row = rows?.[0];
    if (!row) throw new NotFoundException('Case not found');

    let accessCardCode: string | null = null;
    let members: Array<{
      id: string; fullName: string; relationship: string; age: number | null;
      occupation: string | null; income: number | null; status: string | null; isPrimary: boolean;
    }> = [];

    if (row.household_id) {
      const cardRows = await this.complianceRepo.query(
        `SELECT access_card_code FROM households WHERE id = $1`,
        [row.household_id],
      );
      accessCardCode = cardRows?.[0]?.access_card_code ?? null;

      const memberRows = await this.complianceRepo.query(
        `SELECT hm.id,
                TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name || ' ', ''), p.surname)) AS full_name,
                hm.relationship,
                EXTRACT(YEAR FROM AGE(NOW(), p.dob))::integer AS age,
                p.occupation,
                p.estimated_monthly_income AS income,
                hm.status,
                hm.is_primary
         FROM household_memberships hm
         JOIN persons p ON p.id = hm.person_id
         WHERE hm.household_id = $1
         ORDER BY hm.is_primary DESC, p.surname, p.first_name`,
        [row.household_id],
      );
      members = memberRows.map((m: any) => ({
        id: m.id,
        fullName: m.full_name,
        relationship: m.relationship,
        age: m.age,
        occupation: m.occupation,
        income: m.income != null ? Number(m.income) : null,
        status: m.status || null,
        isPrimary: m.is_primary,
      }));
    }

    return {
      controlNo: row.control_no ?? null,
      beneficiaryId: row.beneficiary_id ?? null,
      accessCardCode,
      members,
    };
  }

  async getComplianceStatus(
    caseId: string,
    caller?: { id: string; role: string },
  ): Promise<{
    total: number;
    complied: number;
    rate: number;
    byType: Record<string, { total: number; complied: number; rate: number }>;
    // Plain shape (not the entity class): the rows are enriched with the member
    // they belong to, and spreading an entity drops its methods.
    entries: Array<{
      id: string;
      complianceType?: ComplianceType;
      dueDate: string;
      monthLabel?: string;
      met: boolean;
      metAt?: Date | null;
      metBy?: string | null;
      householdMemberId?: string;
      memberName?: string;
      memberRelationship?: string;
    }>;
  }> {
    if (caller?.role === 'claimant') {
      const owned = await this.complianceRepo.query(
        `SELECT 1
         FROM cases c
         JOIN beneficiaries b ON b.id = c.beneficiary_id
         LEFT JOIN beneficiary_claimants bcl ON bcl.beneficiary_id = b.person_id
         WHERE c.id = $1
           AND (
             b.user_id = $2
             OR bcl.claimant_id IN (SELECT person_id FROM beneficiaries WHERE user_id = $2)
           )
         LIMIT 1`,
        [caseId, caller.id],
      );
      if (!owned?.[0]) throw new NotFoundException('Compliance status not found');
    }
    const entries = await this.complianceRepo.find({
      where: { caseId },
      order: { dueDate: 'ASC' },
    });

    // Attribute each item to the household member it belongs to. The UI needs
    // this to show whose condition an item is; `household_member_id` stores a
    // person id, which is not the id the case payload exposes for members.
    const memberIds = [...new Set(entries.map(e => e.householdMemberId).filter(Boolean))] as string[];
    const memberRows: Array<{ id: string; full_name: string; relationship: string | null }> = memberIds.length
      ? await this.complianceRepo.query(
          `SELECT p.id,
                  TRIM(CONCAT(p.first_name, ' ', COALESCE(p.middle_name || ' ', ''), p.surname)) AS full_name,
                  hm.relationship
             FROM persons p
             LEFT JOIN household_memberships hm ON hm.person_id = p.id
            WHERE p.id = ANY($1::uuid[])`,
          [memberIds],
        )
      : [];
    const memberById = new Map(memberRows.map(r => [r.id, r]));
    const enriched = entries.map(e => ({
      ...e,
      memberName: e.householdMemberId ? memberById.get(e.householdMemberId)?.full_name : undefined,
      memberRelationship: e.householdMemberId ? memberById.get(e.householdMemberId)?.relationship ?? undefined : undefined,
    }));

    const total = entries.length;
    const complied = entries.filter(e => e.met).length;
    const byType: Record<string, { total: number; complied: number; rate: number }> = {};
    for (const entry of entries) {
      const type = entry.complianceType || 'other';
      if (!byType[type]) byType[type] = { total: 0, complied: 0, rate: 0 };
      byType[type].total++;
      if (entry.met) byType[type].complied++;
    }
    for (const value of Object.values(byType)) {
      value.rate = value.total > 0 ? value.complied / value.total : 0;
    }
    return { total, complied, rate: total > 0 ? complied / total : 0, byType, entries: enriched };
  }

  async markComplied(id: string, actor: CardLoggingActor): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = true;
    entry.metAt = new Date();
    entry.metBy = actor.id;
    await this.complianceRepo.save(entry);
    await this.logToCard(entry.caseId, {
      serviceRendered: `4Ps compliance — ${entry.complianceType || 'condition'}${entry.monthLabel ? ` (${entry.monthLabel})` : ''}`,
      serviceDate: new Date(),
      // 'compliance', not a 4Ps-specific value: the card's category tabs filter on
      // the shared vocabulary, and a private value would match no tab at all. The
      // "4Ps" attribution lives in serviceRendered.
      category: 'compliance',
    }, actor);
  }

  async unmarkComplied(id: string): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = false;
    entry.metAt = null;
    entry.metBy = null;
    await this.complianceRepo.save(entry);
  }

  async schedulePayout(
    caseId: string,
    input: { cycleNo?: string; scheduledAt: string; amount?: number },
    actor: CardLoggingActor,
  ): Promise<CasePayout> {
    const payout = await this.payoutRepo.save(this.payoutRepo.create({
      caseId,
      cycleNo: input.cycleNo,
      scheduledAt: input.scheduledAt,
      amount: input.amount,
      status: 'scheduled',
    }));
    await this.logToCard(caseId, {
      serviceRendered: `4Ps payout scheduled${input.cycleNo ? ` — ${input.cycleNo}` : ''}`,
      serviceDate: new Date(input.scheduledAt),
      cost: input.amount,
      category: 'payout',
    }, actor);
    return payout;
  }

  async setPayoutStatus(
    id: string,
    status: 'completed' | 'missed' | 'cancelled',
    remarks: string | undefined,
    actor: CardLoggingActor,
  ): Promise<CasePayout> {
    const payout = await this.payoutRepo.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    const wasCompleted = payout.status === 'completed';
    payout.status = status;
    if (remarks) payout.remarks = remarks;
    const saved = await this.payoutRepo.save(payout);

    // A completed 4Ps payout is assistance delivered: record it as a case
    // intervention so the case view's Intervention Record reflects it (and the
    // case counts it as a delivered service).
    if (status === 'completed' && !wasCompleted) {
      try {
        await this.interventionRepo.save(this.interventionRepo.create({
          caseId: payout.caseId,
          serviceName: `4Ps Payout${payout.cycleNo ? ` ${payout.cycleNo}` : ''}`,
          category: '4Ps',
          deliveryDate: payout.scheduledAt,
          amount: payout.amount,
          modeOfDelivery: 'Cash',
          fundSource: 'DSWD',
          notes: 'Pantawid Pamilyang Pilipino Program payout',
        }));
        await this.logToCard(payout.caseId, {
          serviceRendered: `4Ps payout released${payout.cycleNo ? ` — ${payout.cycleNo}` : ''}`,
          serviceDate: payout.scheduledAt ? new Date(payout.scheduledAt) : new Date(),
          cost: payout.amount,
          category: 'payout',
        }, actor);
      } catch {
        // Intervention/card logging is best-effort; the payout status stands.
      }
    }
    return saved;
  }

  async markNotified(id: string, userId: string): Promise<CasePayout> {
    const payout = await this.payoutRepo.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    payout.notifiedAt = new Date();
    payout.notifiedBy = userId;
    return this.payoutRepo.save(payout);
  }

  async listByCase(caseId: string): Promise<CasePayout[]> {
    return this.payoutRepo.find({ where: { caseId }, order: { scheduledAt: 'ASC' } });
  }
}
