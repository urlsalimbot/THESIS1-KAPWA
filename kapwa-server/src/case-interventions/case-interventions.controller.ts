import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CaseInterventionsService } from './case-interventions.service';
import { CreateCaseInterventionSchema, UpdateCaseInterventionSchema, CreateCaseInterventionInput, UpdateCaseInterventionInput } from './dto/case-interventions.zod';

@Controller('cases/:caseId/interventions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseInterventionsController {
  constructor(private service: CaseInterventionsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  findAll(@Param('caseId') caseId: string) {
    return this.service.findByCaseId(caseId);
  }

  @Post()
  @Roles('admin', 'social_worker')
  create(@Param('caseId') caseId: string, @Body(new ZodPipe(CreateCaseInterventionSchema)) body: CreateCaseInterventionInput) {
    return this.service.create(caseId, body);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdateCaseInterventionSchema)) body: UpdateCaseInterventionInput) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
