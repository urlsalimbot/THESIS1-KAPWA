import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, UseInterceptors, SerializeOptions, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CaseStatus } from './case.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { DEFAULT_LIST_LIMIT } from '../common/constants';
import {
  CreateCaseSchema, UpdateStatusSchema, ApproveCaseSchema,
  UpdateDocumentsSchema, OverrideStatusSchema, DisburseSchema, AssessmentSchema,
  TransitionPlanSchema,
  CreateCaseInput, OverrideStatusInput, DisburseInput, AssessmentInput,
  TransitionPlanInput,
} from './dto/cases.zod';

@Controller('cases')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: CaseStatus,
    @Query('search') search?: string,
    @Query('barangay') barangay?: string,
    @Query('category') category?: string,
    @Query('gender') gender?: string,
    @Query('ageRange') ageRange?: string,
    @Query('sla') sla?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.casesService.findAll(page, limit, { status, search, barangay, category, gender, ageRange, sla, dateFrom, dateTo });
  }

  @Get('disbursed/pending-intervention')
  @Roles('admin', 'social_worker')
  async getPendingDisbursed() {
    return this.casesService.getPendingDisbursed();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findOne(@Param('id') id: string) {
    return this.casesService.getCaseWithSla(id);
  }

  @Get(':id/history')
  @Roles('admin', 'social_worker', 'auditor')
  async getHistory(@Param('id') id: string) {
    return this.casesService.getHistory(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateCaseSchema)) body: CreateCaseInput) {
    return this.casesService.create(body);
  }

  @Patch(':id/status')
  @Roles('admin', 'social_worker', 'coordinator')
  async updateStatus(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest) {
    return this.casesService.updateStatus(id, body.status, req.user?.role);
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
    return this.casesService.approve(id, body.status, body.signature || '', req.user?.role || '');
  }

  @Patch(':id/request-review')
  @Roles('social_worker')
  async requestReview(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.requestReview(id, req.user?.role);
  }

  @Patch(':id/disburse')
  @Roles('admin')
  async disburse(@Param('id') id: string, @Body(new ZodPipe(DisburseSchema)) body: DisburseInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.disburse(id, body.status, req.user?.role);
  }

  @Patch(':id/close')
  @Roles('admin', 'social_worker')
  async close(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.close(id, CaseStatus.CLOSED, req.user?.role);
  }

  @Patch(':id/override-status')
  @Roles('admin')
  async overrideStatus(@Param('id') id: string, @Body(new ZodPipe(OverrideStatusSchema)) body: OverrideStatusInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.overrideStatus(id, body.status, body.reason, req.user?.role);
  }

  @Patch(':id/documents')
  @Roles('admin', 'social_worker')
  async updateDocuments(@Param('id') id: string, @Body(new ZodPipe(UpdateDocumentsSchema)) body: { certificateUrl?: string; pettyCashVoucherUrl?: string }) {
    return this.casesService.updateDocuments(id, body);
  }

  @Patch(':id/assessment')
  @Roles('admin', 'social_worker')
  async updateAssessment(
    @Param('id') id: string,
    @Body(new ZodPipe(AssessmentSchema)) body: AssessmentInput,
  ) {
    return this.casesService.updateAssessment(id, body);
  }

  @Patch(':id/transition-plan')
  @Roles('admin', 'social_worker')
  async updateTransitionPlan(
    @Param('id') id: string,
    @Body(new ZodPipe(TransitionPlanSchema)) body: TransitionPlanInput,
  ) {
    return this.casesService.updateTransitionPlan(id, body);
  }
}
