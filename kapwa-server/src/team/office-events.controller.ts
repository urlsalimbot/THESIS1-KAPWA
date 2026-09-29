import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { OfficeEventsService, OfficeEventInput } from './office-events.service';

// Dates travel as YYYY-MM-DD query params. Absent bounds default to the
// current ISO week (Monday start) so a bare `GET /team/events` still paints
// the week the client navigated to — same convention as team/blocks.
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

@ApiTags('Team Office Events')
@Controller('team/events')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class OfficeEventsController {
  constructor(private svc: OfficeEventsService) {}

  @Get()
  // GET is open to coordinators (read-only office scope); unsafe verbs are
  // admin + social_worker only — coordinators never receive edit affordances.
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List office events in a date range (coordinators see coordinator-scoped events only)' })
  async list(@Request() req: AuthenticatedRequest, @Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = parseDay(from) ?? isoWeekStart(new Date());
    const toDate = parseDay(to) ?? addDays(fromDate, 6);
    // Coordinator visibility filtering lives in the service: `visible_to =
    // 'staff_coordinators'` only, mirroring how blocks scope to the caller's
    // barangay — a coordinator never sees the staff-default payload.
    return this.svc.listEvents(fromDate, toDate, req.user?.role, req.user?.assignedBarangay);
  }

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Create an office event (owned by the creator)' })
  create(@Body() dto: OfficeEventInput, @Request() req: AuthenticatedRequest) {
    return this.svc.createEvent(dto, req.user);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Update an office event (admin or owner)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Partial<OfficeEventInput>,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.updateEvent(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Delete an office event (admin or owner, audit-logged)' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.deleteEvent(id, req.user, req.user?.id);
  }
}