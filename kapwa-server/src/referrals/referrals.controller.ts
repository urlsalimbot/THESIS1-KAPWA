import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request, UseInterceptors, SerializeOptions } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateReferralSchema, DeclineReferralSchema, CreateReferralInput, DeclineReferralInput } from './dto/referrals.zod';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReferralsService } from './referrals.service';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Referrals')
@Controller('referrals')
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private svc: ReferralsService) {}

  @Post()
  @Roles('coordinator')
  @ApiOperation({ summary: 'Create a referral as barangay coordinator' })
  async create(
    @Body(new ZodPipe(CreateReferralSchema)) body: CreateReferralInput,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user!.id;
    const barangay = req.user!.assignedBarangay || '';
    const referral = await this.svc.create(body, userId, barangay);
    return { id: referral.id, status: referral.status };
  }

  @Get()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List all referrals (MSWDO view)' })
  async findAll(
    @Query('barangay') barangay?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll({ barangay, status });
  }

  @Get('mine')
  @Roles('coordinator')
  @ApiOperation({ summary: 'List my referrals (coordinator view)' })
  async findMine(@Request() req: AuthenticatedRequest) {
    return this.svc.findMine(req.user!.id);
  }

  @Get('counts')
  @Roles('coordinator')
  @ApiOperation({ summary: 'Get referral counts for coordinator dashboard' })
  async counts(@Request() req: AuthenticatedRequest) {
    return this.svc.countMine(req.user!.id);
  }

  @Get('pending-count')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get pending referral count for MSWDO dashboard' })
  async pendingCount(@Query('barangay') barangay?: string) {
    const count = await this.svc.countPending(barangay);
    return { count };
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get referral details' })
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id/accept')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Accept referral' })
  async accept(@Param('id') id: string) {
    return this.svc.accept(id);
  }

  @Patch(':id/decline')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Decline referral with reason' })
  async decline(
    @Param('id') id: string,
    @Body(new ZodPipe(DeclineReferralSchema)) body: DeclineReferralInput,
  ) {
    return this.svc.decline(id, body);
  }
}
