import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { Case } from '../cases/case.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Beneficiary, ConsentLedger])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
