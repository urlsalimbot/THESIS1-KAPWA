import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiariesService } from './beneficiaries.service.js';
import { BeneficiariesController } from './beneficiaries.controller.js';
import { Beneficiary } from './beneficiary.entity.js';
import { Person } from './person.entity.js';
import { BeneficiaryRole } from './beneficiary-role.entity.js';
import { HouseholdMembership } from './household-membership.entity.js';
import { BeneficiaryClaimant } from './beneficiary-claimant.entity.js';
import { ConsentLedger } from './consent-ledger.entity.js';
import { PersonContact } from './person-contact.entity.js';
import { PersonAddress } from './person-address.entity.js';
import { Case } from '../cases/case.entity.js';
import { User } from '../auth/user.entity.js';
import { ConsentGuard } from '../auth/guards/consent.guard.js';
import { PiiMaskingInterceptor } from './pii.interceptor.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Person, BeneficiaryRole, HouseholdMembership, BeneficiaryClaimant, Beneficiary, ConsentLedger, Case, PersonContact, PersonAddress, User]), AuthModule, AuditModule],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, ConsentGuard, PiiMaskingInterceptor],
  exports: [BeneficiariesService, PiiMaskingInterceptor, TypeOrmModule.forFeature([ConsentLedger, Person])],
})
export class BeneficiariesModule {}
