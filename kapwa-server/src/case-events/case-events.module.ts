import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { TeamModule } from '../team/team.module';
import { CaseEventsService } from './case-events.service';
import { CaseEventsController } from './case-events.controller';
import { CaseEventReminderService } from './case-event-reminder.service';
import { ReminderSettingsService } from './reminder-settings.service';
import { ReminderSettingsController } from './reminder-settings.controller';

@Module({
  imports: [
    // ConsentLedger is registered here for the AbacGuard every guarded
    // controller module must satisfy (same wiring as TeamModule/CasesModule).
    TypeOrmModule.forFeature([CaseEvent, CaseEventReminder, ReminderSetting, Case, User, ConsentLedger]),
    AuthModule, NotificationsModule, AuditModule, TeamModule,
  ],
  providers: [CaseEventsService, CaseEventReminderService, ReminderSettingsService],
  controllers: [CaseEventsController, ReminderSettingsController],
  exports: [CaseEventsService, ReminderSettingsService],
})
export class CaseEventsModule {}