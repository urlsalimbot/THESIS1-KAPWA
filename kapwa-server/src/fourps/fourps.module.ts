import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FourPsController } from './fourps.controller';
import { FourPsService } from './fourps.service';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseComplianceItem, CasePayout, ConsentLedger]), AuthModule],
  controllers: [FourPsController],
  providers: [FourPsService],
  exports: [FourPsService],
})
export class FourPsModule {}
