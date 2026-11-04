import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AbacGuard } from '../auth/guards/abac.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TeamAchievementsService } from './team-achievements.service.js';

// Same YYYY-MM-DD parser the schedule controller uses; achievements requires
// explicit bounds (unlike the schedule week view, there is no sensible
// default range for a rollup).
function parseDay(s?: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@ApiTags('Team Achievements')
@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class TeamAchievementsController {
  constructor(private svc: TeamAchievementsService) {}

  @Get('achievements')
  // Read-only for coordinators — same role matrix as GET /team/statuses;
  // claimants get no access (the guard trio rejects before this method).
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Per-staff derived achievements rollup for an inclusive date range' })
  async rollup(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = parseDay(from);
    const toDate = parseDay(to);
    if (!fromDate || !toDate) {
      throw new BadRequestException('Both "from" and "to" dates are required (YYYY-MM-DD).');
    }
    if (toDate.getTime() < fromDate.getTime()) {
      throw new BadRequestException('"to" must not be earlier than "from".');
    }
    return this.svc.rollup(fromDate, toDate);
  }
}