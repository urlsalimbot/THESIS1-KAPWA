import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramAssignment, AssignmentStatus } from './program-assignment.entity';
import { ProgramAssignmentStep } from './program-assignment-step.entity';
import { Program } from './program.entity';
import { InterventionsService } from '../interventions/interventions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InterventionType, FundSource } from '../interventions/intervention.entity';
import { CreateAssignmentInput } from './dto/assignment.zod';

@Injectable()
export class ProgramAssignmentsService {
  constructor(
    @InjectRepository(ProgramAssignment) private assignRepo: Repository<ProgramAssignment>,
    @InjectRepository(ProgramAssignmentStep) private stepRepo: Repository<ProgramAssignmentStep>,
    @InjectRepository(Program) private progRepo: Repository<Program>,
    private interventionsService: InterventionsService,
    private notifService: NotificationsService,
  ) {}

  async create(data: CreateAssignmentInput) {
    const program = await this.progRepo.findOne({ where: { id: data.programId } });
    if (!program) throw new NotFoundException('Program not found');

    const assignment = this.assignRepo.create({
      caseId: data.caseId,
      programId: data.programId,
      assignedWorkerId: data.assignedWorkerId,
      status: AssignmentStatus.PENDING,
    });
    const saved = await this.assignRepo.save(assignment);

    if (program.approvalWorkflow?.length) {
      const steps = program.approvalWorkflow
        .sort((a, b) => a.order - b.order)
        .map(step => this.stepRepo.create({
          assignmentId: saved.id,
          stepOrder: step.order,
          stepName: step.stepName,
          approverRole: step.approverRole,
        }));
      await this.stepRepo.save(steps);
    }

    return saved;
  }

  async approveStep(assignmentId: string, stepOrder: number, userId: string, role: string) {
    const assignment = await this.findById(assignmentId);
    const step = await this.stepRepo.findOne({
      where: { assignmentId, stepOrder },
    });
    if (!step) throw new NotFoundException('Step not found');
    if (step.status !== 'pending') {
      throw new BadRequestException(`Step ${stepOrder} is already ${step.status}`);
    }
    if (step.approverRole !== role) {
      throw new ForbiddenException(`Step requires role: ${step.approverRole}`);
    }

    step.status = 'approved';
    step.approvedBy = userId;
    step.approvedAt = new Date();
    await this.stepRepo.save(step);

    // Check if all steps are now approved
    const remaining = await this.stepRepo.count({
      where: { assignmentId, status: 'pending' },
    });

    if (remaining === 0) {
      assignment.status = AssignmentStatus.APPROVED;
      await this.materializeIntervention(assignment);
    } else {
      assignment.currentStepOrder = stepOrder + 1;
      assignment.status = AssignmentStatus.IN_REVIEW;
    }

    await this.assignRepo.save(assignment);
    return assignment;
  }

  async rejectStep(assignmentId: string, stepOrder: number, remarks: string, userId: string, role: string) {
    if (!remarks || remarks.trim().length === 0) {
      throw new BadRequestException('Rejection reason required');
    }

    const assignment = await this.findById(assignmentId);
    const step = await this.stepRepo.findOne({
      where: { assignmentId, stepOrder },
    });
    if (!step) throw new NotFoundException('Step not found');
    if (step.status !== 'pending') {
      throw new BadRequestException(`Step ${stepOrder} is already ${step.status}`);
    }

    step.status = 'rejected';
    step.remarks = remarks;
    step.approvedBy = userId;
    step.approvedAt = new Date();
    await this.stepRepo.save(step);

    assignment.status = AssignmentStatus.REJECTED;
    await this.assignRepo.save(assignment);

    return assignment;
  }

  async overrideStep(assignmentId: string, stepOrder: number, overrideStatus: 'approved' | 'rejected', remarks: string, userId: string) {
    const assignment = await this.findById(assignmentId);
    const step = await this.stepRepo.findOne({
      where: { assignmentId, stepOrder },
    });
    if (!step) throw new NotFoundException('Step not found');

    step.status = overrideStatus;
    step.remarks = remarks;
    step.approvedBy = userId;
    step.approvedAt = new Date();
    await this.stepRepo.save(step);

    if (overrideStatus === 'rejected') {
      assignment.status = AssignmentStatus.REJECTED;
    } else {
      // Check if all steps approved
      const remaining = await this.stepRepo.count({
        where: { assignmentId, status: 'pending' },
      });
      if (remaining === 0) {
        assignment.status = AssignmentStatus.APPROVED;
        try {
          await this.materializeIntervention(assignment);
        } catch (e) {
          // Intervention materialization is best-effort for overrides
        }
      }
    }

    await this.assignRepo.save(assignment);
    return assignment;
  }

  async findByCaseId(caseId: string) {
    return this.assignRepo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const assignment = await this.assignRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Program assignment not found');
    return assignment;
  }

  async findAll() {
    return this.assignRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getSteps(assignmentId: string) {
    return this.stepRepo.find({
      where: { assignmentId },
      order: { stepOrder: 'ASC' },
    });
  }

  private async materializeIntervention(assignment: ProgramAssignment) {
    const program = await this.progRepo.findOne({ where: { id: assignment.programId } });
    if (!program) return;

    // Map program category to intervention type
    const category = program.category || '';
    let interventionType = InterventionType.FA;
    if (category.toLowerCase().includes('medical')) interventionType = InterventionType.FA;
    else if (category.toLowerCase().includes('cash')) interventionType = InterventionType.C;
    else if (category.toLowerCase().includes('burial')) interventionType = InterventionType.C;
    else if (category.toLowerCase().includes('food')) interventionType = InterventionType.FA;

    // Map fund source
    const fundSourceStr = program.fundSources?.[0] || 'Regular';
    let fundSource = FundSource.REGULAR;
    if (fundSourceStr === 'PDAF') fundSource = FundSource.PDAF;
    else if (fundSourceStr === 'Legislative') fundSource = FundSource.LEGISLATIVE;
    else if (fundSourceStr === 'Donation') fundSource = FundSource.DONATION;

    try {
      await this.interventionsService.create({
        caseId: assignment.caseId,
        interventionType,
        fundSource,
        serviceDate: new Date(),
      }, assignment.assignedWorkerId);
    } catch (e) {
      // Intervention creation may fail if case is not disbursed yet
      // This is best-effort — log and continue
      this.notifService.create({
        recipientId: assignment.assignedWorkerId,
        title: 'Program Assignment Approved',
        message: `Program assignment approved but intervention creation deferred — case needs disbursement first.`,
        category: 'approval' as any,
        referenceId: assignment.id,
      });
    }
  }
}
