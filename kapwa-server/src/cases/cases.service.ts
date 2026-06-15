import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseStatus } from './case.entity';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {}

  private async generateControlNo(): Promise<string> {
    const year = new Date().getFullYear();
    const queryRunner = this.caseRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const last = await queryRunner.manager
        .createQueryBuilder(Case, 'c')
        .where(`c.control_no LIKE :pattern`, { pattern: `KAPWA-${year}-%` })
        .orderBy('c.control_no', 'DESC')
        .getOne();
      const lastSeq = last
        ? parseInt(last.controlNo.split('-')[2] || '0', 10)
        : 0;
      await queryRunner.commitTransaction();
      return `KAPWA-${year}-${String(lastSeq + 1).padStart(5, '0')}`;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async create(data: Partial<Case>) {
    const controlNo = await this.generateControlNo();
    const c = this.caseRepo.create({
      controlNo,
      status: CaseStatus.PENDING,
      serviceRequested: data.serviceRequested,
      requirementsChecklist: data.requirementsChecklist,
      beneficiaryId: data.beneficiaryId,
      assignedWorkerId: data.assignedWorkerId,
    });
    await this.caseRepo.save(c);
    return c;
  }

  async findAll(status?: CaseStatus) {
    if (status) {
      return this.caseRepo.find({ where: { status } });
    }
    return this.caseRepo.find();
  }

  async findById(id: string) {
    const c = await this.caseRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  async updateStatus(id: string, newStatus: CaseStatus) {
    const c = await this.findById(id);
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      [CaseStatus.PENDING]: [CaseStatus.IN_REVIEW],
      [CaseStatus.IN_REVIEW]: [CaseStatus.APPROVED],
      [CaseStatus.APPROVED]: [CaseStatus.DISBURSED],
      [CaseStatus.DISBURSED]: [CaseStatus.CLOSED],
      [CaseStatus.CLOSED]: [],
    };
    if (!transitions[c.status]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition from ${c.status} to ${newStatus}`);
    }
    c.status = newStatus;
    c.updatedAt = new Date();
    await this.caseRepo.save(c);
    return c;
  }

  async getPendingDisbursed() {
    return this.caseRepo.find({ where: { status: CaseStatus.DISBURSED } });
  }
}
