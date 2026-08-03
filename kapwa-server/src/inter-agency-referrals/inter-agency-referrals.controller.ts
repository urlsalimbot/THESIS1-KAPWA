import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import {
  CloseReferralSchema,
  CreateInterAgencyReferralSchema,
  DeclineReferralSchema,
} from './dto/inter-agency-referrals.zod';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Inter-Agency Referrals')
@Controller('inter-agency-referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InterAgencyReferralsController {
  constructor(private readonly svc: InterAgencyReferralsService) {}

  @Get('inbox')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'List referrals for the caller agency' })
  async inbox(@Request() req: AuthenticatedRequest) {
    return this.svc.findInbox(req.user);
  }

  @Get('person/:personId')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'List referrals for a person' })
  async byPerson(
    @Param('personId', new ParseUUIDPipe()) personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.findByPerson(personId, req.user);
  }

  @Get('beneficiary-search')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Search referral-derived beneficiaries by name for the caller agency' })
  async beneficiarySearch(@Query('q') q: string, @Request() req: AuthenticatedRequest) {
    return this.svc.searchBeneficiaries(q || '', req.user);
  }

  @Post()
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Create an inter-agency referral' })
  async create(
    @Body(new ZodPipe(CreateInterAgencyReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.create(dto, req.user);
  }

  @Patch(':id/receive')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Mark referral as received' })
  async receive(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.receive(id, req.user);
  }

  @Patch(':id/action')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Mark referral as actioned' })
  async action(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.action(id, req.user);
  }

  @Patch(':id/close')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Close referral with outcome' })
  async close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(CloseReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.close(id, req.user, dto);
  }

  @Patch(':id/decline')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Decline a referred referral' })
  async decline(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(DeclineReferralSchema)) dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.decline(id, req.user, dto);
  }

  @Post(':id/promote-to-case')
  @Roles('admin', 'social_worker', 'agency_staff')
  @ApiOperation({ summary: 'Promote a referral into a case' })
  async promoteToCase(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.promoteToCase(id, req.user);
  }
}
