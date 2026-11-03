import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity.js';
import { OfficeEvent } from './office-event.entity.js';
import { TeamStatus } from './team-status.entity.js';
import { TeamInvite } from './team-invite.entity.js';
import { TeamScheduleService } from './team-schedule.service.js';
import { TeamScheduleController } from './team-schedule.controller.js';
import { TeamScheduleSyncService } from './team-schedule-sync.service.js';
import { OfficeEventsService } from './office-events.service.js';
import { OfficeEventsController } from './office-events.controller.js';
import { TeamStatusService } from './team-status.service.js';
import { TeamStatusController } from './team-status.controller.js';
import { TeamInvitesService } from './team-invites.service.js';
import { TeamInvitesController } from './team-invites.controller.js';
import { TeamAchievementsService } from './team-achievements.service.js';
import { TeamAchievementsController } from './team-achievements.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { Case } from '../cases/case.entity.js';
import { CaseEvent } from '../case-events/case-event.entity.js';

// Team workspace: schedule blocks, office events, whereabouts status,
// schedule invites. Controller guards resolve through AuthModule
// (JwtAuthGuard/RolesGuard/AbacGuard + AbacService) and the ConsentLedger
// repo the AbacGuard injects — the same wiring every guarded controller
// module uses.
@Module({
  imports: [
    TypeOrmModule.forFeature([TeamScheduleBlock, OfficeEvent, TeamStatus, TeamInvite, ConsentLedger, Case, CaseEvent]),
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
    TeamScheduleSyncService,
    OfficeEventsService,
    TeamStatusService,
    TeamInvitesService,
    TeamAchievementsService,
  ],
  exports: [TeamScheduleSyncService],
})
export class TeamModule {}
