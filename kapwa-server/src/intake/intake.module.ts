import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { Person } from '../beneficiaries/person.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Household } from '../beneficiaries/household.entity';
import { Case } from '../cases/case.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { CasesModule } from '../cases/cases.module';
import { AuthModule } from '../auth/auth.module';
import { AccessCardsModule } from '../access-cards/access-cards.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AccountProvisioningService } from '../accounts/account-provisioning.service';

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
