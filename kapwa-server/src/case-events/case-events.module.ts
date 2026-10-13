import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEvent } from './case-event.entity';
import { CaseEventReminder } from './case-event-reminder.entity';
import { ReminderSetting } from './reminder-setting.entity';
import { Case } from '../cases/case.entity';
import { CaseFollowUpVisit } from '../cases/case-follow-up-visit.entity';
import { User } from '../auth/user.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { TeamModule } from '../team/team.module';
// The seal guard: a sealed Court Hearings step refuses hearing mutations.
import { CasesModule } from '../cases/cases.module';
import { CaseEventsService } from './case-events.service';
import { CaseEventsController } from './case-events.controller';
import { CaseEventReminderService } from './case-event-reminder.service';
import { ReminderSettingsService } from './reminder-settings.service';
import { ReminderSettingsController } from './reminder-settings.controller';

@Module({
  imports: [
    // ConsentLedger is registered here for the AbacGuard every guarded
    // controller module must satisfy (same wiring as TeamModule/CasesModule).
    // Beneficiary/BeneficiaryClaimant/CaseFollowUpVisit serve the reminder
    // dispatcher's client-recipient resolution and its visit pass.
    TypeOrmModule.forFeature([
      CaseEvent, CaseEventReminder, ReminderSetting, Case, CaseFollowUpVisit,
      User, Beneficiary, BeneficiaryClaimant, ConsentLedger,
    ]),
    AuthModule, NotificationsModule, AuditModule, TeamModule, CasesModule,
  ],
  providers: [CaseEventsService, CaseEventReminderService, ReminderSettingsService],
  controllers: [CaseEventsController, ReminderSettingsController],
  exports: [CaseEventsService, ReminderSettingsService],
})
export class CaseEventsModule {}