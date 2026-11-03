import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';
import { Referral } from './referral.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { Person } from '../beneficiaries/person.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { CasesModule } from '../cases/cases.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, ConsentLedger, Person, Beneficiary]), CasesModule, AuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
