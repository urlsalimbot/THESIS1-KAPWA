import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterAgencyReferralsController } from './inter-agency-referrals.controller.js';
import { InterAgencyReferralsService } from './inter-agency-referrals.service.js';
import { InterAgencyReferral } from './inter-agency-referral.entity.js';
import { Agency } from '../agencies/agency.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { Case } from '../cases/case.entity.js';
import { User } from '../auth/user.entity.js';
import { CasesModule } from '../cases/cases.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterAgencyReferral, Agency, Beneficiary, Case, User]),
    // The revocation route guards the referrals step's seal.
    CasesModule,
  ],
  controllers: [InterAgencyReferralsController],
  providers: [InterAgencyReferralsService],
  exports: [InterAgencyReferralsService],
})
export class InterAgencyReferralsModule {}
