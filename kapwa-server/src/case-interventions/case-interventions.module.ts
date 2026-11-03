import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseIntervention } from './case-intervention.entity.js';
import { ProgramIntervention } from '../programs/program-intervention.entity.js';
import { CaseInterventionsService } from './case-interventions.service.js';
import { CaseInterventionsController } from './case-interventions.controller.js';
import { InterventionCatalogEntry } from './intervention-catalog.entity.js';
import { InterventionCatalogService } from './intervention-catalog.service.js';
import { InterventionCatalogController } from './intervention-catalog.controller.js';
import { AccessCardsModule } from '../access-cards/access-cards.module.js';
import { CasesModule } from '../cases/cases.module.js';
import { InterAgencyReferralsModule } from '../inter-agency-referrals/inter-agency-referrals.module.js';

@Module({
  // `CasesModule` for the step-1 seal assertion, and `forwardRef` because the
  // edge runs both ways: `cases.module.ts` registers the `CaseIntervention`
  // *entity* in its `forFeature` (a registration, not an import), while this
  // module now requires the cases module to reach the locks service. Only
  // `CasesService` is exported from there, so the exposure is narrow — the
  // done-predicate behind `CaseStepLocksService` is still not reachable from out
  // here, which is what that export boundary was for. `ProgramIntervention` feeds
  // the matrix-membership validation + the required-form obligation.
  imports: [TypeOrmModule.forFeature([CaseIntervention, ProgramIntervention, InterventionCatalogEntry]), forwardRef(() => AccessCardsModule), forwardRef(() => CasesModule), InterAgencyReferralsModule],
  controllers: [CaseInterventionsController, InterventionCatalogController],
  providers: [CaseInterventionsService, InterventionCatalogService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
