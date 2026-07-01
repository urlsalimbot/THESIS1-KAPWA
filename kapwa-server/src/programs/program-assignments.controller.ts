import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProgramAssignmentsService } from './program-assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import {
  CreateAssignmentSchema,
  ApproveStepSchema,
  RejectStepSchema,
  OverrideStepSchema,
  CreateAssignmentInput,
  ApproveStepInput,
  RejectStepInput,
  OverrideStepInput,
} from './dto/assignment.zod';

@ApiTags('Program Assignments')
@ApiBearerAuth()
@Controller('program-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramAssignmentsController {
  constructor(private assignService: ProgramAssignmentsService) {}

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Create a program assignment' })
  async create(@Body(new ZodPipe(CreateAssignmentSchema)) body: CreateAssignmentInput) {
    return this.assignService.create(body);
  }

  @Get()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List program assignments, optionally filtered by caseId' })
  async findByCaseId(@Query('caseId') caseId?: string) {
    if (caseId) return this.assignService.findByCaseId(caseId);
    return this.assignService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get program assignment by ID' })
  async findById(@Param('id') id: string) {
    const assignment = await this.assignService.findById(id);
    const steps = await this.assignService.getSteps(id);
    return { ...assignment, steps };
  }

  @Post(':id/steps/:stepOrder/approve')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Approve a step in the program assignment workflow' })
  async approveStep(
    @Param('id') id: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Body(new ZodPipe(ApproveStepSchema)) body: ApproveStepInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assignService.approveStep(id, stepOrder, req.user!.id, req.user!.role);
  }

  @Post(':id/steps/:stepOrder/reject')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Reject a step in the program assignment workflow' })
  async rejectStep(
    @Param('id') id: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Body(new ZodPipe(RejectStepSchema)) body: RejectStepInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assignService.rejectStep(id, stepOrder, body.remarks, req.user!.id, req.user!.role);
  }

  @Post(':id/steps/:stepOrder/override')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin override a step status' })
  async overrideStep(
    @Param('id') id: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Body(new ZodPipe(OverrideStepSchema)) body: OverrideStepInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.assignService.overrideStep(id, stepOrder, body.overrideStatus, body.remarks, req.user!.id);
  }
}
