import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { TeamStatusService, TeamStatusInput } from './team-status.service';

// Three routes under /team: `status` (own read/write) and `statuses` (team
// board). Plan role matrix: admin + social_worker set their own status and
// read the board; coordinators view the board read-only; claimants get no
// access here (the notifications room is role-gated the same way).
@ApiTags('Team Status')
@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class TeamStatusController {
  constructor(private svc: TeamStatusService) {}

  @Get('status')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get the caller\u2019s current whereabouts status' })
  async getMyStatus(@Request() req: AuthenticatedRequest) {
    return this.svc.getMyStatus(req.user.id);
  }

  @Put('status')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Set the caller\u2019s whereabouts status (last write wins; broadcasts over the team socket)' })
  async setStatus(@Body() dto: TeamStatusInput, @Request() req: AuthenticatedRequest) {
    return this.svc.setStatus(req.user.id, dto);
  }

  @Get('statuses')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List all staff whereabouts statuses, most recently updated first' })
  async listStatuses() {
    return this.svc.listStatuses();
  }
}