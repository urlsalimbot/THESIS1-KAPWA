import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeController } from './intake.controller.js';
import { IntakeService } from './intake.service.js';
import { Person } from '../beneficiaries/person.entity.js';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { Household } from '../beneficiaries/household.entity.js';
import { Case } from '../cases/case.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { CasesModule } from '../cases/cases.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccessCardsModule } from '../access-cards/access-cards.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, HouseholdMembership, Beneficiary, Household, Case, ConsentLedger]),
    CasesModule,
    AuthModule,
    AccessCardsModule,
    AccountsModule,
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
