import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program, ApprovalStep } from './program.entity';
import { FormVersionHistory } from './form-version-history.entity';
import { UpdateProgramInput } from './dto/programs.zod';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program) private progRepo: Repository<Program>,
    @InjectRepository(FormVersionHistory) private versionRepo: Repository<FormVersionHistory>,
  ) {}

  async create(data: Partial<Program>) {
    if (data.approvalWorkflow) {
      this.validateWorkflow(data.approvalWorkflow);
    }
    const prog = this.progRepo.create(data);
    return this.progRepo.save(prog);
  }

  async findAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    return this.progRepo.find({ where });
  }

  async findById(id: string) {
    const prog = await this.progRepo.findOne({ where: { id } });
    if (!prog) throw new NotFoundException('Program not found');
    return prog;
  }

  async update(id: string, data: UpdateProgramInput) {
    const prog = await this.findById(id);
    if (data.approvalWorkflow) {
      this.validateWorkflow(data.approvalWorkflow);
    }
    const changed = 'formTemplate' in data && JSON.stringify(data.formTemplate) !== JSON.stringify(prog.formTemplate);
    await this.progRepo.update(id, data as any);
    if (changed) {
      await this.progRepo.query(
        'UPDATE programs SET form_version = form_version + 1 WHERE id = $1',
        [id],
      );
      await this.versionRepo.save({
        programId: id,
        formTemplate: data.formTemplate!,
        version: prog.formVersion + 1,
      });
    }
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.progRepo.delete(id);
  }

  private validateWorkflow(workflow: ApprovalStep[]): void {
    const orders = workflow.map(s => s.order);
    const unique = new Set(orders);
    if (orders.length !== unique.size) {
      throw new BadRequestException('Duplicate step orders in approval workflow');
    }
  }
}
