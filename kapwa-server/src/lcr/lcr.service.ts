import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../beneficiaries/person.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';

@Injectable()
export class LcrService {
  private readonly logger = new Logger(LcrService.name);

  constructor(
    @InjectRepository(Person)
    private personRepo: Repository<Person>,
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
      const existingPerson = await this.personRepo.findOne({ where: { philsysNumber: data.philsysNumber } });
      if (existingPerson) {
        const ben = await this.benRepo.findOne({ where: { personId: existingPerson.id } });
        if (ben) {
          this.logger.log(`LCR: Matched beneficiary ${ben.id} via Philsys# ${data.philsysNumber}`);
          return { matched: true, beneficiaryId: ben.id, action: 'skipped' };
        }
      }
    }

    const candidates = await this.personRepo
      .createQueryBuilder('p')
      .where('p.surname ILIKE :surname', { surname: data.surname })
      .andWhere('p.first_name ILIKE :firstName', { firstName: data.firstName })
      .getMany();

    const matched = candidates.find(p => {
      const pDob = p.dob instanceof Date ? p.dob.toISOString().split('T')[0] : String(p.dob).split('T')[0];
      return pDob === data.dob.split('T')[0];
    });

    if (matched) {
      if (data.philsysNumber && !matched.philsysNumber) {
        await this.personRepo.update(matched.id, { philsysNumber: data.philsysNumber });
      }
      const ben = await this.benRepo.findOne({ where: { personId: matched.id } });
      this.logger.log(`LCR: Fuzzy-matched beneficiary ${ben?.id || matched.id}`);
      return { matched: true, beneficiaryId: ben?.id || matched.id, action: 'updated' };
    }

    const person = this.personRepo.create({
      philsysNumber: data.philsysNumber,
      surname: data.surname,
      firstName: data.firstName,
      middleName: data.middleName,
      dob: new Date(data.dob),
      gender: data.gender as 'Male' | 'Female',
      address: data.address,
    });
    const savedPerson = await this.personRepo.save(person);

    const ben = this.benRepo.create({
      personId: savedPerson.id,
      consentStatus: 'active',
    });
    const savedBen = await this.benRepo.save(ben);
    this.logger.log(`LCR: Created new beneficiary ${savedBen.id} from person ${savedPerson.id}`);
    return { matched: false, beneficiaryId: savedBen.id, action: 'created' };
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
