import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseInterventionsController } from './case-interventions.controller';
import { AccessCardsModule } from '../access-cards/access-cards.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseIntervention]), forwardRef(() => AccessCardsModule)],
  controllers: [CaseInterventionsController],
  providers: [CaseInterventionsService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
