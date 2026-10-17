import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScsrExportService } from './scsr-export.service';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { BeneficiaryClaimant } from '../beneficiaries/beneficiary-claimant.entity';
import { Person } from '../beneficiaries/person.entity';

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
