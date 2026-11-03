import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCardsService } from './access-cards.service.js';
import { AccessCardsController } from './access-cards.controller.js';
import { AccessCardService } from './access-card-service.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { Agency } from '../agencies/agency.entity.js';
import { InterAgencyReferral } from '../inter-agency-referrals/inter-agency-referral.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessCardService, ConsentLedger, Agency, InterAgencyReferral]),
    AuthModule,
  ],
  controllers: [AccessCardsController],
  providers: [AccessCardsService],
  exports: [AccessCardsService],
})
export class AccessCardsModule {}
