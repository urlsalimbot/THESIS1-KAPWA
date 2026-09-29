import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { OfficeEvent } from './office-event.entity';
import { TeamStatus } from './team-status.entity';
import { TeamInvite } from './team-invite.entity';
import { TeamScheduleService } from './team-schedule.service';
import { TeamScheduleController } from './team-schedule.controller';
import { OfficeEventsService } from './office-events.service';
import { OfficeEventsController } from './office-events.controller';
import { TeamStatusService } from './team-status.service';
import { TeamStatusController } from './team-status.controller';
import { TeamInvitesService } from './team-invites.service';
import { TeamInvitesController } from './team-invites.controller';
import { TeamAchievementsService } from './team-achievements.service';
import { TeamAchievementsController } from './team-achievements.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';

// Team workspace: schedule blocks, office events, whereabouts status,
// schedule invites. Controller guards resolve through AuthModule
// (JwtAuthGuard/RolesGuard/AbacGuard + AbacService) and the ConsentLedger
// repo the AbacGuard injects — the same wiring every guarded controller
// module uses.
@Module({
  imports: [
    TypeOrmModule.forFeature([TeamScheduleBlock, OfficeEvent, TeamStatus, TeamInvite, ConsentLedger]),
    AuthModule,
    AuditModule,
    // Status upserts broadcast over the notifications gateway (exported from
    // NotificationsModule for this purpose); the TeamStatus repo is local.
    NotificationsModule,
  ],
  controllers: [
    TeamScheduleController,
    OfficeEventsController,
    TeamStatusController,
    TeamInvitesController,
    TeamAchievementsController,
  ],
  providers: [
    TeamScheduleService,
    OfficeEventsService,
    TeamStatusService,
    TeamInvitesService,
    TeamAchievementsService,
  ],
})
export class TeamModule {}
