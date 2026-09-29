import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { TeamInvitesService, TeamInviteInput } from './team-invites.service';

// Schedule suggestions ("invites"): any staff member (incl. admin) may
// suggest a block for a colleague on a date; only the invitee may accept
// (materializes the block as the invitee's own, team-visible) or decline.
// Role matrix: coordinator is read-only on the workspace and claimant has no
// access — both are excluded here, so every handler is admin + social_worker.
@ApiTags('Team Invites')
@Controller('team/invites')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class TeamInvitesController {
  constructor(private svc: TeamInvitesService) {}

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({
    summary:
      'Invite a staff member to have a schedule block on a date (duplicate pending invites return the existing one)',
  })
  create(@Body() dto: TeamInviteInput, @Request() req: AuthenticatedRequest) {
    return this.svc.createInvite(dto, req.user);
  }

  @Get('incoming')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List pending invites sent to me, with the sender\u2019s name' })
  incoming(@Request() req: AuthenticatedRequest) {
    return this.svc.incoming(req.user.id);
  }

  @Get('outgoing')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List invites I sent, with the recipient\u2019s name' })
  outgoing(@Request() req: AuthenticatedRequest) {
    return this.svc.outgoing(req.user.id);
  }

  @Patch(':id/accept')
  @Roles('admin', 'social_worker')
  @ApiOperation({
    summary: 'Accept an invite: creates the suggested block owned by the invitee and marks the invite accepted',
  })
  accept(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.accept(id, req.user);
  }

  @Patch(':id/decline')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Decline an invite: records the refusal' })
  decline(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.svc.decline(id, req.user);
  }
}