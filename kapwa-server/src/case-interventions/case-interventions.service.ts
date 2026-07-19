import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';

@Injectable()
export class CaseInterventionsService {
  constructor(
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
  ) {}

  async findByCaseId(caseId: string) {
    return this.interventionRepo.find({
      where: { caseId },
      order: { deliveryDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(caseId: string, data: CreateCaseInterventionInput) {
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? undefined : v]),
    );
    const intervention = this.interventionRepo.create({ caseId, ...cleaned });
    return this.interventionRepo.save(intervention);
  }

  async update(id: string, data: UpdateCaseInterventionInput) {
    const intervention = await this.interventionRepo.findOne({ where: { id } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    Object.assign(intervention, data);
    return this.interventionRepo.save(intervention);
  }

  async delete(id: string) {
    const intervention = await this.interventionRepo.findOne({ where: { id } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    await this.interventionRepo.remove(intervention);
  }
}
