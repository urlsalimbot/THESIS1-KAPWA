import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, UseInterceptors, SerializeOptions, DefaultValuePipe, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { CaseStatus } from './case.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { DEFAULT_LIST_LIMIT } from '../common/constants';

const STATUS_ALIASES: Record<string, CaseStatus> = {
  'pending_assessment': CaseStatus.ENROLLED,
  'approved': CaseStatus.ACTIVE,
  'disbursed': CaseStatus.TRANSITIONING,
};
function mapStatus(s: string): CaseStatus {
  return STATUS_ALIASES[s] || (s as CaseStatus);
}

import {
  CreateCaseSchema, UpdateStatusSchema, ApproveCaseSchema,
  UpdateDocumentsSchema, OverrideStatusSchema, DisburseSchema,
  AssessmentV2Schema, TransitionPlanSchema, RequirementsSchema, ClosureSchema,
  CreateCaseInput, OverrideStatusInput, DisburseInput, AssessmentV2Input,
  TransitionPlanInput, RequirementsInput, ClosureInput,
  BulkExportSchema, BulkExportInput,
} from './dto/cases.zod';

@ApiTags('Cases')
@ApiBearerAuth()
@Controller('cases')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
export class CasesController {
  constructor(
    private casesService: CasesService,
    private casesExportService: CasesExportService,
  ) {}

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

  @Get('tracker/daily')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getTrackerDaily(@Query('date') date?: string) {
    return this.casesService.getTrackerDaily(date);
  }

  @Get('tracker/range')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getTrackerRange(@Query('start') start: string, @Query('end') end: string) {
    return this.casesService.getTrackerRange(start, end);
  }

  @Get('tracker/stats')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getTrackerStats() {
    return this.casesService.getTrackerStats();
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

  @Post('bulk-export')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Export selected cases as CSV (masked by default)' })
  async bulkExport(
    @Body(new ZodPipe(BulkExportSchema)) body: BulkExportInput,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const buf = await this.casesExportService.buildBulkCsv(
      body.ids,
      body.masked,
      body.unmaskReason,
      req.user?.id || '',
      req.user?.role || '',
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cases-bulk-export.csv"',
      'Content-Length': buf.length,
    });
    res.send(buf);
  }

  @Patch(':id/status')
  @Roles('admin', 'social_worker', 'coordinator')
  async updateStatus(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest) {
    return this.casesService.updateStatus(id, mapStatus(body.status as string), req.user?.role);
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
    return this.casesService.approve(id, mapStatus(body.status as string), body.signature || '', req.user?.role || '');
  }

  @Patch(':id/request-review')
  @Roles('social_worker')
  async requestReview(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.requestReview(id, req.user?.role);
  }

  @Patch(':id/disburse')
  @Roles('admin')
  async disburse(@Param('id') id: string, @Body(new ZodPipe(DisburseSchema)) body: DisburseInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.disburse(id, mapStatus(body.status as string), req.user?.role);
  }

  @Patch(':id/close')
  @Roles('admin', 'social_worker')
  async close(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.close(id, CaseStatus.CLOSED, req.user?.role);
  }

  @Patch(':id/override-status')
  @Roles('admin')
  async overrideStatus(@Param('id') id: string, @Body(new ZodPipe(OverrideStatusSchema)) body: OverrideStatusInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.overrideStatus(id, mapStatus(body.status as string), body.reason, req.user?.role);
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
    @Body(new ZodPipe(AssessmentV2Schema)) body: AssessmentV2Input,
  ) {
    return this.casesService.updateAssessmentV2(id, body);
  }

  @Patch(':id/transition-plan')
  @Roles('admin', 'social_worker')
  async updateTransitionPlan(
    @Param('id') id: string,
    @Body(new ZodPipe(TransitionPlanSchema)) body: TransitionPlanInput,
  ) {
    return this.casesService.updateTransitionPlan(id, body);
  }

  @Patch(':id/requirements')
  @Roles('admin', 'social_worker')
  async updateRequirements(
    @Param('id') id: string,
    @Body(new ZodPipe(RequirementsSchema)) body: RequirementsInput,
  ) {
    return this.casesService.updateRequirements(id, body);
  }

  @Patch(':id/closure')
  @Roles('admin', 'social_worker', 'coordinator')
  async updateClosure(
    @Param('id') id: string,
    @Body(new ZodPipe(ClosureSchema)) body: ClosureInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.casesService.updateClosure(id, body, req.user?.role);
  }

  @Get(':id/csr-pdf')
  @Roles('admin', 'social_worker', 'coordinator')
  async downloadCsrPdf(@Param('id') id: string, @Res() res: any) {
    const pdf = await this.casesExportService.generateCsrPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CSR-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
