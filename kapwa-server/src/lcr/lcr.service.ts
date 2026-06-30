import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

@Injectable()
export class LcrService {
  private readonly logger = new Logger(LcrService.name);

  constructor(
    @InjectRepository(Beneficiary)
    private benRepo: Repository<Beneficiary>,
  ) {}

  async importRecord(data: {
    philsysNumber?: string;
    surname: string;
    firstName: string;
    middleName?: string;
    dob: string;
    gender?: string;
    address?: string;
    birthPlace?: string;
    motherName?: string;
    fatherName?: string;
    recordType: 'birth' | 'marriage' | 'death';
  }): Promise<{ matched: boolean; beneficiaryId?: string; action: 'created' | 'updated' | 'skipped' }> {
    if (data.philsysNumber) {
      const existing = await this.benRepo.findOne({ where: { philsysNumber: data.philsysNumber } });
      if (existing) {
        this.logger.log(`LCR: Matched beneficiary ${existing.id} via Philsys# ${data.philsysNumber}`);
        return { matched: true, beneficiaryId: existing.id, action: 'skipped' };
      }
    }

    const candidates = await this.benRepo
      .createQueryBuilder('b')
      .where('b.surname ILIKE :surname', { surname: data.surname })
      .andWhere('b.first_name ILIKE :firstName', { firstName: data.firstName })
      .getMany();

    const matched = candidates.find(c => {
      const cDob = c.dob instanceof Date ? c.dob.toISOString().split('T')[0] : String(c.dob).split('T')[0];
      return cDob === data.dob.split('T')[0];
    });

    if (matched) {
      if (data.philsysNumber && !matched.philsysNumber) {
        await this.benRepo.update(matched.id, { philsysNumber: data.philsysNumber });
      }
      this.logger.log(`LCR: Fuzzy-matched beneficiary ${matched.id}`);
      return { matched: true, beneficiaryId: matched.id, action: 'updated' };
    }

    const ben = this.benRepo.create({
      philsysNumber: data.philsysNumber,
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      dob: new Date(data.dob),
      gender: data.gender as Beneficiary["gender"],
      address: data.address,
    });
    const saved = await this.benRepo.save(ben);
    this.logger.log(`LCR: Created new beneficiary ${saved.id}`);
    return { matched: false, beneficiaryId: saved.id, action: 'created' };
  }

  async importBatch(records: Record<string, unknown>[]): Promise<{ total: number; created: number; updated: number; skipped: number }> {
    let created = 0, updated = 0, skipped = 0;
    for (const record of records) {
      const result = await this.importRecord(record as any);
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
    }
    return { total: records.length, created, updated, skipped };
  }
}
