import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service';
import { CasesExportService } from './cases-export.service';
import { CaseStepLocksService } from './case-step-locks.service';
import { CasesController } from './cases.controller';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseRequirement } from './case-requirement.entity';
import { CaseReferral } from './case-referral.entity';
import { CaseAssistance } from './case-assistance.entity';
import { CaseFollowUpVisit } from './case-follow-up-visit.entity';
import { CaseStepLock } from './case-step-lock.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { Program } from '../programs/program.entity';
import { ProgramEnrollment } from '../case-enrollments/program-enrollment.entity';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { Person } from '../beneficiaries/person.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { GisModule } from '../gis/gis.module';
import { FilingModule } from '../filing/filing.module';
import { IrfModule } from '../irf/irf.module';
import { TeamModule } from '../team/team.module';
import { CaseEvent } from '../case-events/case-event.entity';

@Module({
  // `CaseIntervention` and `Program` are registered here rather than reached
  // through `ProgramsModule`, which already lists several entities owned by
  // other domains: forFeature is a repository registration and adds no import
  // edge, so the step-done predicate can read a case's programs without this
  // module and ProgramsModule requiring each other.
  // `InterAgencyReferral` is registered here for the same reason as
  // `CaseIntervention` and `Program`: step 2's done-predicate counts the
  // referrals the endorsement letter wrote, and forFeature keeps that a
  // repository registration rather than a require edge to the referrals module.
  // `forwardRef(() => FilingModule)`: the filing module now imports this one for
  // the step-1 seal assertion, and this one imports it for `CasesExportService`'s
  // `FilingService`. Both sides forward-ref the other so Nest resolves the cycle.
  imports: [TypeOrmModule.forFeature([Case, CaseHistory, CaseRequirement, CaseReferral, CaseAssistance, CaseFollowUpVisit, CaseIntervention, CaseStepLock, Program, ProgramEnrollment, InterAgencyReferral, HouseholdMembership, ConsentLedger, BeneficiaryClaimant, Person, CaseEvent]), NotificationsModule, AuthModule, AuditModule, GisModule, forwardRef(() => FilingModule), IrfModule, TeamModule],
  controllers: [CasesController],
  providers: [CasesService, CasesExportService, CaseStepLocksService],
  // `CaseStepLocksService` is exported for one caller: the interventions module
  // asserts the step-1 seal on its own routes, because the interventions are
  // step 1's data and a sealed step must not be edited through a second route
  // that happens to live elsewhere. What is exported is the service, so that
  // module can *ask* whether a step is sealed — not the done-predicate, which
  // stays private here, as it must: it is re-derived per surface and the shared
  // fixture is what holds the copies equal, so a second consumer outside the two
  // audited ones would be a copy nothing tests.
  exports: [CasesService, CaseStepLocksService]
})
export class CasesModule {}
