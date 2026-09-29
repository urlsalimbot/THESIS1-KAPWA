import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamScheduleBlock } from './team-schedule-block.entity';
import { OfficeEvent } from './office-event.entity';
import { TeamStatus } from './team-status.entity';
import { TeamScheduleService } from './team-schedule.service';
import { TeamScheduleController } from './team-schedule.controller';
import { OfficeEventsService } from './office-events.service';
import { OfficeEventsController } from './office-events.controller';
import { TeamStatusService } from './team-status.service';
import { TeamStatusController } from './team-status.controller';
import { TeamAchievementsService } from './team-achievements.service';
import { TeamAchievementsController } from './team-achievements.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';

// Team workspace: schedule blocks, office events, whereabouts status.
// Controller guards resolve through AuthModule (JwtAuthGuard/RolesGuard/
// AbacGuard + AbacService) and the ConsentLedger repo the AbacGuard injects —
// the same wiring every guarded controller module uses.
@Module({
  imports: [
    TypeOrmModule.forFeature([TeamScheduleBlock, OfficeEvent, TeamStatus, ConsentLedger]),
    AuthModule,
    AuditModule,
    // Status upserts broadcast over the notifications gateway (exported from
    // NotificationsModule for this purpose); the TeamStatus repo is local.
    NotificationsModule,
  ],
  controllers: [TeamScheduleController, OfficeEventsController, TeamStatusController, TeamAchievementsController],
  providers: [TeamScheduleService, OfficeEventsService, TeamStatusService, TeamAchievementsService],
})
export class TeamModule {}