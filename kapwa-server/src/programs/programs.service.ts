import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program, ApprovalStep } from './program.entity';
import { ProgramFundSource } from './program-fund-source.entity';
import { ProgramRequiredDocument } from './program-required-document.entity';
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
    const { fundSources, requiredDocuments, ...rest } = data;
    const hasChildren = Array.isArray(fundSources) || Array.isArray(requiredDocuments);
    const prog = this.progRepo.create(
      hasChildren
        ? {
            ...rest,
            fundSourceRows: Array.isArray(fundSources)
              ? fundSources.map(f => this.progRepo.manager.create(ProgramFundSource, { name: f }))
              : undefined,
            requiredDocumentRows: Array.isArray(requiredDocuments)
              ? requiredDocuments.map(d => this.progRepo.manager.create(ProgramRequiredDocument, { documentKey: d, mandatory: true }))
              : undefined,
          }
        : rest,
    );
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
    // Upsert child rows (orphanedRowAction:'delete' removes rows dropped from the array).
    if (Array.isArray(data.fundSources) || Array.isArray(data.requiredDocuments)) {
      if (Array.isArray(data.fundSources)) {
        prog.fundSourceRows = data.fundSources.map(f =>
          this.progRepo.manager.create(ProgramFundSource, { programId: id, name: f }),
        );
      }
      if (Array.isArray(data.requiredDocuments)) {
        prog.requiredDocumentRows = data.requiredDocuments.map(d =>
          this.progRepo.manager.create(ProgramRequiredDocument, { programId: id, documentKey: d, mandatory: true }),
        );
      }
      await this.progRepo.save(prog);
    }
    const { fundSources, requiredDocuments, ...rest } = data;
    const changed = 'formTemplate' in data && JSON.stringify(data.formTemplate) !== JSON.stringify(prog.formTemplate);
    await this.progRepo.update(id, rest as any);
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