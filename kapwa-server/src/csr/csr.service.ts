import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsrRecord } from './csr.entity';
import { OrgService } from '../common/org.service';

const CSR_PAD_WIDTH = 4;
@Injectable()
export class CsrService {
  constructor(
    @InjectRepository(CsrRecord)
    private readonly csrRepo: Repository<CsrRecord>,
    private readonly org: OrgService,
  ) {}

  async create(data: Partial<CsrRecord>, userId: string): Promise<CsrRecord> {
    const year = new Date().getFullYear();
    const seqName = `csr_seq_${year}`;
    const result = await this.csrRepo.query(`SELECT nextval('${seqName}') AS seq`);
    const nextSeq = parseInt(result[0].seq, 10);
    const controlNo = `CSR-${year}-${String(nextSeq).padStart(CSR_PAD_WIDTH, '0')}`;
    const record = this.csrRepo.create({
      ...data,
      controlNo,
      createdBy: userId,
    });
    return this.csrRepo.save(record);
  }

  async findAll(): Promise<CsrRecord[]> {
    return this.csrRepo.find({ order: { createdAt: 'DESC' }, take: DEFAULT_LIST_LIMIT });
  }

  async findById(id: string): Promise<CsrRecord> {
    const record = await this.csrRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('CSR record not found');
    return record;
  }

  async findByControlNo(controlNo: string): Promise<CsrRecord> {
    const record = await this.csrRepo.findOne({ where: { controlNo } });
    if (!record) throw new NotFoundException('CSR record not found');
    return record;
  }

  async update(id: string, data: Partial<CsrRecord>): Promise<CsrRecord> {
    const record = await this.findById(id);
    Object.assign(record, data);
    return this.csrRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findById(id);
    await this.csrRepo.remove(record);
  }

  async findInterventions(_caseId: string) {
    return [];
  }
}
