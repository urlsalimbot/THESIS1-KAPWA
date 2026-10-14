import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program, ApprovalStep } from './program.entity';
import { ProgramFundSource } from './program-fund-source.entity';
import { ProgramRequiredDocument } from './program-required-document.entity';
import { ProgramIntervention } from './program-intervention.entity';
import { FormVersionHistory } from './form-version-history.entity';
import { UpdateProgramInput } from './dto/programs.zod';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program) private progRepo: Repository<Program>,
    @InjectRepository(FormVersionHistory) private versionRepo: Repository<FormVersionHistory>,
    @InjectRepository(ProgramIntervention) private interventionRepo: Repository<ProgramIntervention>,
  ) {}

  async create(data: Omit<Partial<Program>, 'interventions'> & { interventions?: Array<{ interventionType: string; requiredForm?: string | null }> }) {
    if (data.approvalWorkflow) {
      this.validateWorkflow(data.approvalWorkflow);
    }
    const { fundSources, requiredDocuments, interventions, ...rest } = data;
    const hasChildren = Array.isArray(fundSources) || Array.isArray(requiredDocuments) || Array.isArray(interventions);
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
            interventionRows: Array.isArray(interventions)
              ? interventions.map(({ interventionType, requiredForm }, index) =>
                  this.progRepo.manager.create(ProgramIntervention, {
                    interventionType,
                    requiredForm: requiredForm || null,
                    sortOrder: index,
                  }),
                )
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
    // Child collections are replaced with explicit writes inside one
    // transaction. The parent cascade save this used to ride on is gone: with
    // the collection cleared for orphan handling, `save(prog)` reloaded the
    // relation from the database, saw the rows the transaction had just
    // inserted as orphans, and tried to null their `program_id` — a NOT NULL
    // violation that aborted the whole write (found live while replacing a
    // matrix). Explicit delete + insert has no graph state to get wrong.
    if (Array.isArray(data.fundSources) || Array.isArray(data.requiredDocuments) || Array.isArray(data.interventions)) {
      const rows = data.interventions ?? [];
      if (Array.isArray(data.interventions)
        && new Set(rows.map((r) => r.interventionType)).size !== rows.length) {
        throw new BadRequestException('Each intervention may appear only once in the program matrix');
      }
      await this.progRepo.manager.transaction(async (em) => {
        if (Array.isArray(data.fundSources)) {
          await em.delete(ProgramFundSource, { programId: id });
          for (const name of data.fundSources) {
            await em.insert(ProgramFundSource, { programId: id, name });
          }
        }
        if (Array.isArray(data.requiredDocuments)) {
          await em.delete(ProgramRequiredDocument, { programId: id });
          for (const documentKey of data.requiredDocuments) {
            await em.insert(ProgramRequiredDocument, { programId: id, documentKey, mandatory: true });
          }
        }
        if (Array.isArray(data.interventions)) {
          await em.delete(ProgramIntervention, { programId: id });
          // The submitted row order IS the display order (audit 3.2.13).
          for (const [index, row] of rows.entries()) {
            await em.insert(ProgramIntervention, {
              programId: id,
              interventionType: row.interventionType,
              requiredForm: row.requiredForm || null,
              sortOrder: index,
            });
          }
        }
      });
    }
    const { fundSources, requiredDocuments, interventions, ...rest } = data;
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