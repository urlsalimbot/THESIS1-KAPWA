import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { TeamModule } from '../team/team.module';
import { CaseEventsService } from './case-events.service';
import { CaseEventsController } from './case-events.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseEvent, CaseEventReminder, ReminderSetting, Case, User]),
    AuthModule, NotificationsModule, AuditModule, TeamModule,
  ],
  providers: [CaseEventsService],
  controllers: [CaseEventsController],
  exports: [CaseEventsService],
})
export class CaseEventsModule {}