import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterAgencyReferralsController } from './inter-agency-referrals.controller';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { User } from '../auth/user.entity';
import { CasesModule } from '../cases/cases.module';

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
