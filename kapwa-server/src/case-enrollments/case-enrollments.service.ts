import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramEnrollment } from './program-enrollment.entity';
import { Program } from '../programs/program.entity';
import { CreateProgramEnrollmentInput, UpdateProgramEnrollmentInput } from './dto/case-enrollments.zod';

export interface ProgramEnrollmentView {
  id: string;
  caseId: string;
  programId: string;
  programName: string;
  programType?: string;
  services?: string[];
  enrolledAt: string;
  status: string;
  createdAt: Date;
}

/**
 * Per-case program enrollment (the case plan's treatment-plan step). One row
 * per (case, program); the enrollment a service is delivered under is recorded
 * on the intervention (`case_interventions.program_enrollment_id`).
 */
@Injectable()
export class CaseEnrollmentsService {
  constructor(
    @InjectRepository(ProgramEnrollment)
    private readonly repo: Repository<ProgramEnrollment>,
    @InjectRepository(Program)
    private readonly programs: Repository<Program>,
  ) {}

  async findByCaseId(caseId: string): Promise<ProgramEnrollmentView[]> {
    const rows = await this.repo.find({ where: { caseId }, order: { enrolledAt: 'ASC' } });
    return this.toViews(rows);
  }

  async create(caseId: string, body: CreateProgramEnrollmentInput, actorId?: string): Promise<ProgramEnrollmentView> {
    const program = await this.programs.findOne({ where: { id: body.programId } });
    if (!program) {
      throw new BadRequestException('Unknown program');
    }
    const existing = await this.repo.findOne({ where: { caseId, programId: body.programId } });
    if (existing) {
      throw new BadRequestException('The case is already enrolled in this program');
    }
    const row = await this.repo.save(
      this.repo.create({
        caseId,
        programId: body.programId,
        enrolledAt: body.enrolledAt,
        status: body.status ?? 'active',
        createdBy: actorId,
      }),
    );
    const [view] = await this.toViews([row]);
    return view;
  }

  async update(caseId: string, id: string, body: UpdateProgramEnrollmentInput): Promise<ProgramEnrollmentView> {
    const row = await this.repo.findOne({ where: { id, caseId } });
    if (!row) throw new NotFoundException('Enrollment not found');
    if (body.status !== undefined) row.status = body.status;
    if (body.enrolledAt !== undefined) row.enrolledAt = body.enrolledAt;
    const saved = await this.repo.save(row);
    const [view] = await this.toViews([saved]);
    return view;
  }

  async delete(caseId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id, caseId } });
    if (!row) throw new NotFoundException('Enrollment not found');
    await this.repo.remove(row);
  }

  private async toViews(rows: ProgramEnrollment[]): Promise<ProgramEnrollmentView[]> {
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((r) => r.programId))];
    const programs = await this.programs.find({ where: ids.map((id) => ({ id })) });
    const programById = new Map(programs.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = programById.get(r.programId);
      return {
        id: r.id,
        caseId: r.caseId,
        programId: r.programId,
        programName: p?.name ?? '(unknown program)',
        programType: p?.programType,
        services: p?.services,
        enrolledAt: r.enrolledAt,
        status: r.status,
        createdAt: r.createdAt,
      };
    });
  }
}