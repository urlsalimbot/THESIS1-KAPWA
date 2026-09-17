import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseComplianceItem, ComplianceType } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';

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
  ) {}

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

  async getComplianceStatus(caseId: string): Promise<{
    total: number;
    complied: number;
    rate: number;
    byType: Record<string, { total: number; complied: number; rate: number }>;
    entries: CaseComplianceItem[];
  }> {
    const entries = await this.complianceRepo.find({
      where: { caseId },
      order: { dueDate: 'ASC' },
    });
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
    return { total, complied, rate: total > 0 ? complied / total : 0, byType, entries };
  }

  async markComplied(id: string, userId: string): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = true;
    entry.metAt = new Date();
    entry.metBy = userId;
    await this.complianceRepo.save(entry);
  }

  async unmarkComplied(id: string): Promise<void> {
    const entry = await this.complianceRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Compliance entry not found');
    entry.met = false;
    entry.metAt = undefined;
    entry.metBy = undefined;
    await this.complianceRepo.save(entry);
  }
}
