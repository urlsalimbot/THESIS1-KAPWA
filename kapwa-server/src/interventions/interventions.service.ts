import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention, InterventionType, FundSource } from './intervention.entity';
import { Case, CaseStatus } from '../cases/case.entity';

@Injectable()
export class InterventionsService {
  constructor(
    @InjectRepository(Intervention)
    private interventionRepo: Repository<Intervention>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}

  async create(data: Partial<Intervention>, userId: string) {
    const caseId = data.caseId;
    if (!caseId) throw new NotFoundException('Case required');

    const caseEntity = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!caseEntity) throw new NotFoundException('Case not found');
    if (caseEntity.status !== CaseStatus.DISBURSED) {
      throw new BadRequestException('Case must be disbursed first');
    }

    if (!data.workerSignatureUrl) {
      throw new BadRequestException('Worker signature required');
    }

    const int = this.interventionRepo.create({
      interventionType: data.interventionType || InterventionType.FA,
      amount: data.amount || 0,
      fundSource: data.fundSource || FundSource.REGULAR,
      serviceDate: data.serviceDate || new Date(),
      workerSignatureUrl: data.workerSignatureUrl,
      loggedById: userId,
      caseId,
    });
    await this.interventionRepo.save(int);
    return int;
  }

  async findByCase(caseId: string) {
    return this.interventionRepo.find({ where: { caseId } });
  }

  async findAll() {
    return this.interventionRepo.find();
  }

  async findById(id: string) {
    const int = await this.interventionRepo.findOne({ where: { id } });
    if (!int) throw new NotFoundException('Intervention not found');
    return int;
  }
}