import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseIntervention } from './case-intervention.entity';
import { CaseInterventionsService } from './case-interventions.service';
import { CaseInterventionsController } from './case-interventions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CaseIntervention])],
  controllers: [CaseInterventionsController],
  providers: [CaseInterventionsService],
  exports: [CaseInterventionsService],
})
export class CaseInterventionsModule {}
