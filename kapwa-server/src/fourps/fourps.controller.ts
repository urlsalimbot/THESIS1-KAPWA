import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
  UseInterceptors, ParseUUIDPipe, Request,
} from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Sensitivity } from '../auth/decorators/resource-sensitivity.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { FourPsService } from './fourps.service';
import { SchedulePayoutSchema, SchedulePayoutInput, PayoutStatusSchema, PayoutStatusInput } from './dto/fourps.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('4Ps')
@Controller('fourps')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class FourPsController {
  constructor(private svc: FourPsService) {}

  @Post(':caseId/generate-compliance')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Generate 12 months of 4Ps conditionality items for a case' })
  async generateCompliance(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    const generated = await this.svc.generateComplianceItems(caseId);
    return { generated };
  }

  @Get(':caseId/compliance')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  @Sensitivity('public')
  @ApiOperation({ summary: 'Get 4Ps compliance status for a case' })
  async getCompliance(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.getComplianceStatus(caseId);
  }

  @Patch('compliance/:id/meet')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Mark a compliance item as complied' })
  async markComplied(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.svc.markComplied(id, req.user!.id);
    return { met: true };
  }

  @Delete('compliance/:id/meet')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Unmark a compliance item' })
  async unmarkComplied(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.unmarkComplied(id);
    return { met: false };
  }

  @Post(':caseId/payouts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Schedule a 4Ps payout' })
  async schedulePayout(
    @Param('caseId', new ParseUUIDPipe()) caseId: string,
    @Body(new ZodPipe(SchedulePayoutSchema)) body: SchedulePayoutInput,
  ) {
    return this.svc.schedulePayout(caseId, body);
  }

  @Get(':caseId/payouts')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List payout schedules for a case' })
  async listPayouts(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.listByCase(caseId);
  }

  @Patch('payouts/:id/status')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Update payout status' })
  async setPayoutStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(PayoutStatusSchema)) body: PayoutStatusInput,
  ) {
    return this.svc.setPayoutStatus(id, body.status, body.remarks);
  }

  @Post('payouts/:id/notify')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Record a beneficiary payout notification' })
  async notifyPayout(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.markNotified(id, req.user!.id);
  }
}
