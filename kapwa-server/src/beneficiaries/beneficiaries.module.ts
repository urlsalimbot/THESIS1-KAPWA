import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';
import { Beneficiary } from './beneficiary.entity';
import { Person } from './person.entity';
import { BeneficiaryRole } from './beneficiary-role.entity';
import { HouseholdMembership } from './household-membership.entity';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity';
import { ConsentLedger } from './consent-ledger.entity';
import { PersonContact } from './person-contact.entity';
import { PersonAddress } from './person-address.entity';
import { Case } from '../cases/case.entity';
import { ConsentGuard } from '../auth/guards/consent.guard';
import { PiiMaskingInterceptor } from './pii.interceptor';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Person, BeneficiaryRole, HouseholdMembership, BeneficiaryClaimant, Beneficiary, ConsentLedger, Case, PersonContact, PersonAddress]), AuthModule, AuditModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, ConsentGuard, PiiMaskingInterceptor],
  exports: [BeneficiariesService, PiiMaskingInterceptor, TypeOrmModule.forFeature([ConsentLedger, Person])],
})
export class BeneficiariesModule {}
