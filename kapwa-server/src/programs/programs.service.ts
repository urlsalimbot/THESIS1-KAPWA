import { Injectable, NotFoundException } from '@nestjs/common';
import { Program } from './program.entity';

const programs: Map<string, Program> = new Map();

@Injectable()
export class ProgramsService {
  async create(data: Partial<Program>) {
    const id = crypto.randomUUID();
    const prog: Program = {
      id,
      name: data.name || 'Unnamed Program',
      category: data.category,
      waitingPeriodDays: data.waitingPeriodDays,
      requiredDocuments: data.requiredDocuments,
      fundSources: data.fundSources,
      approvalWorkflow: data.approvalWorkflow,
      formTemplate: data.formTemplate,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    programs.set(prog.id, prog);
    return prog;
  }

  async findAll(activeOnly = true) {
    const all = Array.from(programs.values());
    if (activeOnly) return all.filter(p => p.isActive);
    return all;
  }

  async findById(id: string) {
    const prog = programs.get(id);
    if (!prog) throw new NotFoundException('Program not found');
    return prog;
  }
}