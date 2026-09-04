import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../cases/case.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { GisExportService } from './gis-export.service';

@Module({
  imports: [TypeOrmModule.forFeature([Case, BeneficiaryClaimant, CaseIntervention])],
  providers: [GisExportService],
  exports: [GisExportService],
})
export class GisModule {}
