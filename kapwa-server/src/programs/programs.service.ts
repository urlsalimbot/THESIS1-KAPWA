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
              ? interventions.map(({ interventionType, requiredForm }) =>
                  this.progRepo.manager.create(ProgramIntervention, { interventionType, requiredForm: requiredForm || null }),
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
    // Upsert child rows (orphanedRowAction:'delete' removes rows dropped from the array).
    if (Array.isArray(data.fundSources) || Array.isArray(data.requiredDocuments) || Array.isArray(data.interventions)) {
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
      // The Program → Services matrix: submitted rows replace the current set
      // (service rows not listed are dropped). requiredForm is upserted for the
      // rows that stay. The rewrite is one transaction: a failed row must not
      // leave a truncated matrix on disk (audit 3.2.5). Duplicates are refused
      // by both the zod refine and this belt-and-braces check (the unique key
      // would otherwise abort mid-loop).
      if (Array.isArray(data.interventions)) {
        // findById loaded the eager rows; the cascade save below would re-insert
        // these STALE rows on top of the fresh ones and die on the unique
        // (program_id, intervention_type) — clear them first.
        prog.interventionRows = [];
        const rows = data.interventions;
        if (new Set(rows.map((r) => r.interventionType)).size !== rows.length) {
          throw new BadRequestException('Each intervention may appear only once in the program matrix');
        }
        await this.interventionRepo.manager.transaction(async (em) => {
          await em.delete(ProgramIntervention, { programId: id });
          for (const { interventionType, requiredForm } of rows) {
            await em.save(
              em.create(ProgramIntervention, {
                programId: id,
                interventionType,
                requiredForm: requiredForm || null,
              }),
            );
          }
        });
      }
      await this.progRepo.save(prog);
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