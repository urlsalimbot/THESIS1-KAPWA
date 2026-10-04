import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { CaseEnrollmentsService } from './case-enrollments.service';
import { CaseStepLocksService } from '../cases/case-step-locks.service';
import { CreateProgramEnrollmentSchema, UpdateProgramEnrollmentSchema, CreateProgramEnrollmentInput, UpdateProgramEnrollmentInput } from './dto/case-enrollments.zod';

@Controller('cases/:caseId/enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseEnrollmentsController {
  constructor(
    private service: CaseEnrollmentsService,
    // The enrollments step's seal. The enrollments *are* this step's own data,
    // so writing one while the step is sealed is the same defect as editing a
    // sealed assessment — a claim standing on data nobody agreed to. Asserted
    // here, on the route, rather than in the service: the service cannot know a
    // seal exists, and a client-only check is bypassable by calling the route
    // directly.
    private stepLocks: CaseStepLocksService,
  ) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  findAll(@Param('caseId') caseId: string) {
    return this.service.findByCaseId(caseId);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(
    @Param('caseId') caseId: string,
    @Body(new ZodPipe(CreateProgramEnrollmentSchema)) body: CreateProgramEnrollmentInput,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.stepLocks.assertUnsealed(caseId, 'enrollments');
    return this.service.create(caseId, body, req.user?.id);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  async update(
    @Param('caseId') caseId: string,
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateProgramEnrollmentSchema)) body: UpdateProgramEnrollmentInput,
  ) {
    await this.stepLocks.assertUnsealed(caseId, 'enrollments');
    return this.service.update(caseId, id, body);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker')
  async delete(@Param('caseId') caseId: string, @Param('id') id: string) {
    await this.stepLocks.assertUnsealed(caseId, 'enrollments');
    return this.service.delete(caseId, id);
  }
}