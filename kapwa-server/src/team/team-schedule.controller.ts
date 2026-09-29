import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { TeamScheduleService, TeamBlockInput } from './team-schedule.service';

// Dates travel as YYYY-MM-DD query params. Absent bounds default to the
// current ISO week (Monday start) so a bare `GET /team/blocks` still paints
// the week the client navigated to.
function parseDay(s?: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isoWeekStart(d: Date): Date {
  const mondayOffset = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

@ApiTags('Team Schedule')
@Controller('team/blocks')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class TeamScheduleController {
  constructor(private svc: TeamScheduleService) {}

  @Get()
  // GET is open to coordinators (read-only office scope); unsafe verbs are
  // admin + social_worker only — coordinators never receive edit affordances.
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List schedule blocks in a date range' })
  async list(
    @Request() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('staffId') staffId?: string,
  ) {
    const fromDate = parseDay(from) ?? isoWeekStart(new Date());
    const toDate = parseDay(to) ?? addDays(fromDate, 6);
    // Coordinator scoping lives in the service: it resolves the caller's
    // barangay staff via user_barangay_assignments (the relation behind
    // users.assignedBarangay) and returns only their blocks — a coordinator
    // with no assigned barangay gets [], never all staff.
    return this.svc.listBlocks(fromDate, toDate, staffId || undefined, req.user?.role, req.user?.assignedBarangay);
  }

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Create a schedule block (owner only)' })
  create(@Body() dto: TeamBlockInput, @Request() req: AuthenticatedRequest) {
    return this.svc.createBlock(dto, req.user);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Update a schedule block (owner only)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Partial<TeamBlockInput>,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.updateBlock(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Delete a schedule block (owner only, audit-logged)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.deleteBlock(id, req.user, req.user?.id);
  }
}