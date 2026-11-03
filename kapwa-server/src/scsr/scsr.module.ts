import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScsrExportService } from './scsr-export.service.js';
import { Case } from '../cases/case.entity.js';
import { User } from '../auth/user.entity.js';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity.js';
import { Person } from '../beneficiaries/person.entity.js';

/**
 * Social Case Study Report export (burial + medical). OrgService comes from the
 * global CommonModule, so nothing else has to be imported here — the same way
 * the GIS module gets it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Case, User, BeneficiaryClaimant, Person])],
  providers: [ScsrExportService],
  exports: [ScsrExportService],
})
export class ScsrModule {}
