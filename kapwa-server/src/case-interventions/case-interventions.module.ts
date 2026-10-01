import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseInterventionsController } from './case-interventions.controller';
import { AccessCardsModule } from '../access-cards/access-cards.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  // `CasesModule` for the step-1 seal assertion, and `forwardRef` because the
  // edge runs both ways: `cases.module.ts` registers the `CaseIntervention`
  // *entity* in its `forFeature` (a registration, not an import), while this
  // module now requires the cases module to reach the locks service. Only
  // `CasesService` is exported from there, so the exposure is narrow — the
  // done-predicate behind `CaseStepLocksService` is still not reachable from out
  // here, which is what that export boundary was for.
  imports: [TypeOrmModule.forFeature([CaseIntervention]), forwardRef(() => AccessCardsModule), forwardRef(() => CasesModule)],
  controllers: [CaseInterventionsController],
  providers: [CaseInterventionsService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
