import { Module } from '@nestjs/common';
import { AgencyPortalController } from './agency-portal.controller';
import { AgencyPortalService } from './agency-portal.service';
import { InterAgencyReferralsModule } from '../inter-agency-referrals/inter-agency-referrals.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InterAgencyReferralsModule, AgenciesModule, AuthModule],
  controllers: [AgencyPortalController],
  providers: [AgencyPortalService],
})
export class AgencyPortalModule {}
