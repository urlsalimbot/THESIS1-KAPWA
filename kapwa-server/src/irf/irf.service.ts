import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IrfCase } from './irf-case.entity';

@Injectable()
export class IrfService {
  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
    private dataSource: DataSource
  ) {}

  async create(data: Partial<IrfCase>) {
    const blotterNo = await this.generateBlotterNumber();
    const irf = this.irfRepo.create({
      blotterEntryNumber: blotterNo,
      caseCategory: data.caseCategory,
      itemAReportingPerson: data.itemAReportingPerson
    });
    return this.irfRepo.save(irf);
  }

  async findAll() {
    return this.irfRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string) {
    const irf = await this.irfRepo.findOne({ where: { id } });
    if (!irf) throw new NotFoundException('IRF case not found');
    return irf;
  }

  async getDecryptedNarr(id: string, legalBasis?: string) {
    if (!legalBasis) throw new Error('Legal basis required');
    const irf = await this.findById(id);
    return { ...irf };
  }

  async updateStatus(id: string, disposition: string) {
    await this.irfRepo.update(id, { caseDisposition: disposition });
    return this.findById(id);
  }

  private async generateBlotterNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.irfRepo.count();
    return `BLT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}