import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../cases/case.entity.js';
import { CaseIntervention } from '../case-interventions/case-intervention.entity.js';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity.js';
import { GisExportService } from './gis-export.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Case, BeneficiaryClaimant, CaseIntervention])],
  providers: [GisExportService],
  exports: [GisExportService],
})
export class GisModule {}
