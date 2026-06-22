import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProgramAssignmentsService } from './program-assignments.service';
import { ProgramAssignment, AssignmentStatus } from './program-assignment.entity';
import { ProgramAssignmentStep } from './program-assignment-step.entity';
import { Program } from './program.entity';
import { InterventionsService } from '../interventions/interventions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProgramAssignmentsService', () => {
  let service: ProgramAssignmentsService;
  let assignRepoMock: any;
  let stepRepoMock: any;
  let progRepoMock: any;
  let interventionsMock: any;
  let notifMock: any;

  beforeEach(async () => {
    assignRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };
    stepRepoMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };
    progRepoMock = { findOne: jest.fn() };
    interventionsMock = { create: jest.fn().mockResolvedValue({ intervention: { id: 'int-1' } }) };
    notifMock = { notifyCaseUpdate: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramAssignmentsService,
        { provide: getRepositoryToken(ProgramAssignment), useValue: assignRepoMock },
        { provide: getRepositoryToken(ProgramAssignmentStep), useValue: stepRepoMock },
        { provide: getRepositoryToken(Program), useValue: progRepoMock },
        { provide: InterventionsService, useValue: interventionsMock },
        { provide: NotificationsService, useValue: notifMock },
      ],
    }).compile();
    service = module.get<ProgramAssignmentsService>(ProgramAssignmentsService);
  });

  describe('create', () => {
    it('should create a ProgramAssignment with PENDING status and materialize steps from program.approvalWorkflow', async () => {
      const program = {
        id: 'prog-1',
        name: 'AICS',
        approvalWorkflow: [
          { stepName: 'Intake Review', approverRole: 'social_worker', slaDays: 3, order: 0 },
          { stepName: 'Supervisor Approval', approverRole: 'admin', slaDays: 5, order: 1 },
        ],
      };
      progRepoMock.findOne.mockResolvedValue(program);
      const savedAssignment = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.PENDING,
        currentStepOrder: 0,
        assignedWorkerId: 'worker-1',
      };
      assignRepoMock.create.mockReturnValue(savedAssignment);
      assignRepoMock.save.mockResolvedValue(savedAssignment);

      const step1 = { assignmentId: 'assign-1', stepOrder: 0, stepName: 'Intake Review', approverRole: 'social_worker' };
      const step2 = { assignmentId: 'assign-1', stepOrder: 1, stepName: 'Supervisor Approval', approverRole: 'admin' };
      stepRepoMock.create.mockReturnValueOnce(step1).mockReturnValueOnce(step2);
      stepRepoMock.save.mockResolvedValue([step1, step2]);

      const result = await service.create({
        caseId: 'case-1',
        programId: 'prog-1',
        assignedWorkerId: 'worker-1',
      });

      expect(progRepoMock.findOne).toHaveBeenCalledWith({ where: { id: 'prog-1' } });
      expect(assignRepoMock.create).toHaveBeenCalledWith({
        caseId: 'case-1',
        programId: 'prog-1',
        assignedWorkerId: 'worker-1',
        status: AssignmentStatus.PENDING,
      });
      expect(assignRepoMock.save).toHaveBeenCalledWith(savedAssignment);
      expect(stepRepoMock.create).toHaveBeenCalledTimes(2);
      expect(stepRepoMock.save).toHaveBeenCalled();
      expect(result.status).toBe(AssignmentStatus.PENDING);
    });
  });

  describe('approveStep', () => {
    it('should approve a step and advance currentStepOrder', async () => {
      const assignment: any = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.PENDING,
        currentStepOrder: 0,
        assignedWorkerId: 'worker-1',
      };
      const step: any = {
        id: 'step-1',
        assignmentId: 'assign-1',
        stepOrder: 0,
        stepName: 'Intake Review',
        approverRole: 'social_worker',
        status: 'pending',
      };
      assignRepoMock.findOne.mockResolvedValue(assignment);
      assignRepoMock.save.mockImplementation(async (a: any) => a);
      stepRepoMock.findOne.mockResolvedValue(step);
      stepRepoMock.save.mockImplementation(async (s: any) => s);
      stepRepoMock.count.mockResolvedValue(1); // one step still pending

      const result = await service.approveStep('assign-1', 0, 'user-1', 'social_worker');
      expect(result.status).toBe(AssignmentStatus.IN_REVIEW);
      expect(result.currentStepOrder).toBe(1);
    });

    it('should approve the last step, set assignment to APPROVED and call interventionsService.create()', async () => {
      const assignment: any = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.IN_REVIEW,
        currentStepOrder: 1,
        assignedWorkerId: 'worker-1',
      };
      const step: any = {
        id: 'step-2',
        assignmentId: 'assign-1',
        stepOrder: 1,
        stepName: 'Supervisor Approval',
        approverRole: 'admin',
        status: 'pending',
      };
      assignRepoMock.findOne.mockResolvedValue(assignment);
      assignRepoMock.save.mockImplementation(async (a: any) => a);
      stepRepoMock.findOne.mockResolvedValue(step);
      stepRepoMock.save.mockImplementation(async (s: any) => s);
      stepRepoMock.count.mockResolvedValue(0); // no steps remaining
      progRepoMock.findOne.mockResolvedValue({
        id: 'prog-1',
        name: 'AICS',
        category: 'Medical Assistance',
        fundSources: ['DSWD'],
      });

      const result = await service.approveStep('assign-1', 1, 'admin-user', 'admin');
      expect(interventionsMock.create).toHaveBeenCalled();
      expect(result.status).toBe(AssignmentStatus.APPROVED);
    });

    it('should throw NotFoundException for non-existent step', async () => {
      const assignment: any = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.PENDING,
        currentStepOrder: 0,
        assignedWorkerId: 'worker-1',
      };
      assignRepoMock.findOne.mockResolvedValue(assignment);
      stepRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.approveStep('assign-1', 99, 'user-1', 'social_worker'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when wrong role tries to approve', async () => {
      const assignment: any = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.PENDING,
        currentStepOrder: 0,
        assignedWorkerId: 'worker-1',
      };
      const step: any = {
        id: 'step-1',
        assignmentId: 'assign-1',
        stepOrder: 0,
        stepName: 'Intake Review',
        approverRole: 'social_worker',
        status: 'pending',
      };
      assignRepoMock.findOne.mockResolvedValue(assignment);
      stepRepoMock.findOne.mockResolvedValue(step);

      await expect(
        service.approveStep('assign-1', 0, 'user-1', 'admin'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectStep', () => {
    it('should reject a step and set assignment to REJECTED', async () => {
      const assignment: any = {
        id: 'assign-1',
        caseId: 'case-1',
        programId: 'prog-1',
        status: AssignmentStatus.PENDING,
        currentStepOrder: 0,
        assignedWorkerId: 'worker-1',
      };
      const step: any = {
        id: 'step-1',
        assignmentId: 'assign-1',
        stepOrder: 0,
        stepName: 'Intake Review',
        approverRole: 'social_worker',
        status: 'pending',
      };
      assignRepoMock.findOne.mockResolvedValue(assignment);
      assignRepoMock.save.mockImplementation(async (a: any) => a);
      stepRepoMock.findOne.mockResolvedValue(step);
      stepRepoMock.save.mockImplementation(async (s: any) => s);

      const result = await service.rejectStep('assign-1', 0, 'Incomplete documents', 'user-1', 'social_worker');
      expect(result.status).toBe(AssignmentStatus.REJECTED);
    });

    it('should throw BadRequestException when rejecting without remarks', async () => {
      await expect(
        service.rejectStep('assign-1', 0, '', 'user-1', 'social_worker'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
