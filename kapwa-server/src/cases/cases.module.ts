import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service.js';
import { CasesExportService } from './cases-export.service.js';
import { CaseStepLocksService } from './case-step-locks.service.js';
import { CasesController } from './cases.controller.js';
import { Case } from './case.entity.js';
import { CaseHistory } from './case-history.entity.js';
import { CaseRequirement } from './case-requirement.entity.js';
import { CaseReferral } from './case-referral.entity.js';
import { CaseAssistance } from './case-assistance.entity.js';
import { CaseFollowUpVisit } from './case-follow-up-visit.entity.js';
import { CaseStepLock } from './case-step-lock.entity.js';
import { CaseIntervention } from '../case-interventions/case-intervention.entity.js';
import { Program } from '../programs/program.entity.js';
import { ProgramEnrollment } from '../case-enrollments/program-enrollment.entity.js';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { HouseholdMembership } from '../beneficiaries/household-membership.entity.js';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { GisModule } from '../gis/gis.module.js';
import { ScsrModule } from '../scsr/scsr.module.js';
import { FilingModule } from '../filing/filing.module.js';
import { IrfModule } from '../irf/irf.module.js';
import { TeamModule } from '../team/team.module.js';
import { CaseEvent } from '../case-events/case-event.entity.js';
import { InterventionRequiredDocument } from './intervention-required-document.entity.js';

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
  imports: [ ScsrModule,TypeOrmModule.forFeature([Case, CaseHistory, CaseRequirement, CaseReferral, CaseAssistance, CaseFollowUpVisit, CaseIntervention, CaseStepLock, Program, ProgramEnrollment, InterAgencyReferral, HouseholdMembership, ConsentLedger, BeneficiaryClaimant, Person, CaseEvent, InterventionRequiredDocument]), NotificationsModule, AuthModule, AuditModule, GisModule, forwardRef(() => FilingModule), IrfModule, TeamModule],
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
