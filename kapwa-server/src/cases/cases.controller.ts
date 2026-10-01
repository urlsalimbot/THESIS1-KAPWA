import { Controller, Get, Post, Patch, Delete, HttpCode, BadRequestException, Param, Body, Query, UseGuards, Request, UseInterceptors, SerializeOptions, DefaultValuePipe, ParseIntPipe, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { CaseStepLocksService } from './case-step-locks.service';
import { GisExportService } from '../gis/gis-export.service';
import { CaseStatus } from './case.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/types';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { exportFileName } from '../common/constants';


const STATUS_ALIASES: Record<string, CaseStatus> = {
  'pending_assessment': CaseStatus.ENROLLED,
  'approved': CaseStatus.ACTIVE,
  'disbursed': CaseStatus.TRANSITIONING,
};
function mapStatus(s: string): CaseStatus {
  return STATUS_ALIASES[s] || (s as CaseStatus);
}

// Strict step-index parse for the step-lock routes. `parseInt` is the obvious
// choice and is wrong here: it turns "1.5" into 1, so a request for a step that
// does not exist would seal step 1 instead and return 201. `ParseIntPipe` does
// not help either — it parseInts first and only then checks `isInteger`, by
// which point the truncation has already happened. Only bare decimal digits are
// accepted; the 0..4 range stays with the service, which owns the message.
const STEP_INDEX_PATTERN = /^\d+$/;
function parseStepIndex(raw: string): number {
  if (!STEP_INDEX_PATTERN.test(raw)) {
    throw new BadRequestException(`Step index must be a whole number, got "${raw}"`);
  }
  return Number(raw);
}

import {
  CreateCaseSchema, UpdateStatusSchema, ApproveCaseSchema,
  UpdateDocumentsSchema, OverrideStatusSchema, DisburseSchema, RejectCaseSchema,
  AssessmentV2Schema, TransitionPlanSchema, RequirementsSchema, ClosureSchema,
  ReferralDecisionSchema,
  CreateCaseInput, OverrideStatusInput, DisburseInput, AssessmentV2Input,
  TransitionPlanInput, RequirementsInput, ClosureInput, ReferralDecisionInput,
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
    private stepLocks: CaseStepLocksService,
    private gisExportService: GisExportService,
  ) {}

  @Get()
  @Roles('admin', 'social_worker')
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
    @Query('beneficiaryId') beneficiaryId?: string,
  ) {
    return this.casesService.findAll(page, limit, { status, search, barangay, category, gender, ageRange, sla, dateFrom, dateTo, beneficiaryId: beneficiaryId || undefined });
  }

  @Get('tracker/daily')
  @Roles('admin', 'social_worker', 'coordinator')
  async getTrackerDaily(@Query('date') date?: string, @Query('status') status?: string, @Request() req?: any) {
    const barangay = req?.user?.role === 'coordinator' ? req.user?.assignedBarangay : undefined;
    return this.casesService.getTrackerDaily(date, status, barangay);
  }

  @Get('tracker/range')
  @Roles('admin', 'social_worker', 'coordinator')
  async getTrackerRange(@Query('start') start: string, @Query('end') end: string, @Query('status') status?: string, @Request() req?: any) {
    const barangay = req?.user?.role === 'coordinator' ? req.user?.assignedBarangay : undefined;
    return this.casesService.getTrackerRange(start, end, status, barangay);
  }

  @Get('tracker/stats')
  @Roles('admin', 'social_worker', 'coordinator')
  async getTrackerStats(@Request() req?: any) {
    const barangay = req?.user?.role === 'coordinator' ? req.user?.assignedBarangay : undefined;
    return this.casesService.getTrackerStats(barangay);
  }

  @Get(':id')
  @Roles('admin', 'social_worker')
  async findOne(@Param('id') id: string) {
    return this.casesService.getCaseWithSla(id);
  }

  @Get(':id/history')
  @Roles('admin', 'social_worker')
  async getHistory(@Param('id') id: string) {
    return this.casesService.getHistory(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateCaseSchema)) body: CreateCaseInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.create(body, req.user?.id);
  }

  @Patch(':id/status')
  @Roles('admin', 'social_worker')
  async updateStatus(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }, @Request() req: AuthenticatedRequest) {
    return this.casesService.updateStatus(id, mapStatus(body.status as string), req.user?.role, req.user?.id);
  }

  @Patch(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string, @Body(new ZodPipe(ApproveCaseSchema)) body: { status: CaseStatus; signature?: string }, @Request() req: AuthenticatedRequest) {
    return this.casesService.approve(id, mapStatus(body.status as string), body.signature || '', req.user?.role || '', req.user?.id);
  }

  @Post(':id/issue-coe')
  @Roles('admin')
  async issueCoe(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.issueDocument(id, 'coe', req.user?.id);
  }

  @Post(':id/issue-pcv')
  @Roles('admin')
  async issuePcv(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.issueDocument(id, 'pcv', req.user?.id);
  }

  @Patch(':id/request-review')
  @Roles('social_worker')
  async requestReview(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.requestReview(id, req.user?.role, req.user?.id);
  }

  @Patch(':id/disburse')
  @Roles('admin')
  async disburse(@Param('id') id: string, @Body(new ZodPipe(DisburseSchema)) body: DisburseInput, @Request() req: AuthenticatedRequest) {
    return this.casesService.disburse(id, mapStatus(body.status as string), req.user?.role, req.user?.id);
  }

  @Patch(':id/close')
  @Roles('admin', 'social_worker')
  async close(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.casesService.close(id, CaseStatus.CLOSED, req.user?.role, req.user?.id);
  }

  // Rejecting an intake is a documented triage decision, so both case roles
  // can perform it (unlike the admin-only override).
  @Patch(':id/reject')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Reject a Phase-In case with a reason' })
  async reject(@Param('id') id: string, @Body(new ZodPipe(RejectCaseSchema)) body: { reason: string }, @Request() req: AuthenticatedRequest) {
    return this.casesService.reject(id, body.reason, req.user?.role, req.user?.id);
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
    @Request() req: AuthenticatedRequest,
  ) {
    await this.stepLocks.assertUnsealed(id, 0);
    return this.casesService.updateAssessmentV2(id, body, req.user?.id);
  }

  @Patch(':id/transition-plan')
  @Roles('admin', 'social_worker')
  async updateTransitionPlan(
    @Param('id') id: string,
    @Body(new ZodPipe(TransitionPlanSchema)) body: TransitionPlanInput,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.stepLocks.assertUnsealed(id, 3);
    return this.casesService.updateTransitionPlan(id, body, req.user?.id);
  }

  @Patch(':id/requirements')
  @Roles('admin', 'social_worker')
  async updateRequirements(
    @Param('id') id: string,
    @Body(new ZodPipe(RequirementsSchema)) body: RequirementsInput,
  ) {
    await this.stepLocks.assertUnsealed(id, 1);
    return this.casesService.updateRequirements(id, body);
  }

  @Patch(':id/closure')
  @Roles('admin', 'social_worker')
  async updateClosure(
    @Param('id') id: string,
    @Body(new ZodPipe(ClosureSchema)) body: ClosureInput,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.stepLocks.assertUnsealed(id, 4);
    return this.casesService.updateClosure(id, body, req.user?.role);
  }

  @Patch(':id/referral-decision')
  @Roles('admin', 'social_worker')
  async updateReferralDecision(
    @Param('id') id: string,
    @Body(new ZodPipe(ReferralDecisionSchema)) body: ReferralDecisionInput,
  ) {
    await this.stepLocks.assertUnsealed(id, 2);
    return this.casesService.updateReferralDecision(id, body.notNeeded);
  }

  @Patch(':id/intervention-decision')
  @Roles('admin', 'social_worker')
  async updateInterventionDecision(
    @Param('id') id: string,
    @Body(new ZodPipe(ReferralDecisionSchema)) body: ReferralDecisionInput,
  ) {
    await this.stepLocks.assertUnsealed(id, 1);
    return this.casesService.updateInterventionDecision(id, body.notNeeded);
  }

  // Each step-field write above opens with `assertUnsealed(id, step)`, naming the
  // step whose own data the write changes. The refusal lives here — on the route,
  // the single funnel every write of that field passes through — rather than in
  // each writing service, because only the route knows which step a body belongs
  // to, and because a client-side-only check is bypassable by calling the PATCH
  // directly, which is exactly what the `assessed -> in_review` gate was built to
  // stop relying on. Step 1's two decision routes are named separately from
  // `requirements` because the three are three different bodies that all belong
  // to step 2's data; the mapping is stated once per route so a new step-field
  // write has to state its step rather than inherit a guess.

  // Sealing a step is reversible by the same two roles, so both verbs sit
  // together. The service re-derives whether the step is done; the client is
  // never asked to vouch for it.
  @Post(':id/steps/:stepIndex/lock')
  @Roles('admin', 'social_worker')
  @HttpCode(201)
  @ApiOperation({ summary: 'Seal a completed case step' })
  async lockStep(
    @Param('id') id: string,
    @Param('stepIndex') stepIndex: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.stepLocks.lock(id, parseStepIndex(stepIndex), req.user);
  }

  @Delete(':id/steps/:stepIndex/lock')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Release a sealed case step' })
  async unlockStep(
    @Param('id') id: string,
    @Param('stepIndex') stepIndex: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.stepLocks.unlock(id, parseStepIndex(stepIndex), req.user);
    return { ok: true };
  }

  @Get('csr/:controlNo/pdf')
  @Roles('admin', 'social_worker', 'coordinator')
  async downloadCsrByControlNo(@Param('controlNo') controlNo: string, @Res() res: any) {
    const caseId = await this.casesExportService.findIdByControlNo(controlNo);
    const pdf = await this.casesExportService.generateCsrPdf(caseId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exportFileName('CSR', controlNo)}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get(':id/csr-pdf')
  @Roles('admin', 'social_worker')
  async downloadCsrPdf(@Param('id') id: string, @Res() res: any) {
    const pdf = await this.casesExportService.generateCsrPdf(id);
    const controlNo = await this.casesExportService.controlNo(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exportFileName('CSR', controlNo)}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  @Get(':id/gis-pdf')
  @Roles('admin', 'social_worker')
  async downloadGisPdf(@Param('id') id: string, @Res() res: any) {
    const pdf = await this.gisExportService.generateGisPdf(id);
    const controlNo = await this.gisExportService.controlNo(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exportFileName('GIS', controlNo)}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
