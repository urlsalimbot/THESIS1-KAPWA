import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterAgencyReferralsController } from './inter-agency-referrals.controller';
import { InterAgencyReferralsService } from './inter-agency-referrals.service';
import { InterAgencyReferral } from './inter-agency-referral.entity';
import { Agency } from '../agencies/agency.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';
import { CasesModule } from '../cases/cases.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterAgencyReferral, Agency, Beneficiary, Case, User]),
    CasesModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [InterAgencyReferralsController],
  providers: [InterAgencyReferralsService],
  exports: [InterAgencyReferralsService],
})
export class InterAgencyReferralsModule {}
