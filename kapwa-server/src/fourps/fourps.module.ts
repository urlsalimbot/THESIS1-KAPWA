import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FourPsController } from './fourps.controller.js';
import { FourPsService } from './fourps.service.js';
import { CaseComplianceItem } from './fourps-compliance.entity.js';
import { CasePayout } from './fourps-payout.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { CaseIntervention } from '../case-interventions/case-intervention.entity.js';
import { AccessCardsModule } from '../access-cards/access-cards.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseComplianceItem, CasePayout, ConsentLedger, CaseIntervention]),
    AccessCardsModule,
    AuthModule,
  ],
  controllers: [FourPsController],
  providers: [FourPsService],
  exports: [FourPsService],
})
export class FourPsModule {}
