import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { CasesController } from './cases.controller';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { Person } from '../beneficiaries/person.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseHistory, CaseRequirement, CaseReferral, CaseAssistance, CaseIntervention, HouseholdMembership, ConsentLedger, BeneficiaryClaimant, Person]), NotificationsModule, AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CasesExportService],
  exports: [CasesService]
})
export class CasesModule {}
