import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseHistory, ConsentLedger]), NotificationsModule, AuthModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService]
})
export class CasesModule {}
