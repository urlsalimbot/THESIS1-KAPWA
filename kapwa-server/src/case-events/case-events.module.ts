import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseEvent } from './case-event.entity.js';
import { CaseEventReminder } from './case-event-reminder.entity.js';
import { ReminderSetting } from './reminder-setting.entity.js';
import { Case } from '../cases/case.entity.js';
import { CaseFollowUpVisit } from '../cases/case-follow-up-visit.entity.js';
import { User } from '../auth/user.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { TeamModule } from '../team/team.module.js';
// The seal guard: a sealed Court Hearings step refuses hearing mutations.
import { CasesModule } from '../cases/cases.module.js';
import { CaseEventsService } from './case-events.service.js';
import { CaseEventsController } from './case-events.controller.js';
import { CaseEventReminderService } from './case-event-reminder.service.js';
import { ReminderSettingsService } from './reminder-settings.service.js';
import { ReminderSettingsController } from './reminder-settings.controller.js';

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