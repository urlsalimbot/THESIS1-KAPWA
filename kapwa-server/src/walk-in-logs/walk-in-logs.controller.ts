import {
  Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { WalkInLogsService } from './walk-in-logs.service';
import {
  CreateWalkInLogInput, CreateWalkInLogSchema, UpdateWalkInLogInput, UpdateWalkInLogSchema,
} from './walk-in-logs.zod';

@ApiTags('Walk-in Log')
@Controller('walk-in-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'social_worker')
@ApiBearerAuth()
export class WalkInLogsController {
  constructor(private readonly service: WalkInLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List front-desk visits, optionally filtered by day/status/purpose/search' })
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('purposeCode') purposeCode?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list(page, Math.min(limit, 100), { date, status, purposeCode, q });
  }

  @Post()
  @ApiOperation({ summary: 'Record a walk-in visit at the information desk' })
  create(@Body(new ZodPipe(CreateWalkInLogSchema)) body: CreateWalkInLogInput, @Request() req: AuthenticatedRequest) {
    return this.service.create(body, req.user?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update, link, start service, or close out a visit' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(UpdateWalkInLogSchema)) body: UpdateWalkInLogInput,
  ) {
    return this.service.update(id, body);
  }

  @Get('link-options')
  @ApiOperation({ summary: 'Search persons/cases to link to a visit' })
  linkOptions(@Query('q') q = '') {
    return this.service.linkOptions(q);
  }

  @Get('referrals')
  @ApiOperation({ summary: 'Referral records available for a linked case' })
  referrals(@Query('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.service.referralsForCase(caseId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Daily/monthly counts, GAD breakdown, conversion and service times' })
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.summary(from, to);
  }

  @Get('dashboard')
  @ApiOperation({ summary: "Today's walk-in counts for the dashboard widget" })
  dashboard() {
    return this.service.dashboard();
  }
}
