import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service.js';
import { AuditLogService } from './audit-log.service.js';
import { Case } from '../cases/case.entity.js';
import { Beneficiary } from '../beneficiaries/beneficiary.entity.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { AuditController } from './audit.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Beneficiary, ConsentLedger])],
  controllers: [AuditController],
  providers: [AuditService, AuditLogService],
  exports: [AuditService, AuditLogService]
})
export class AuditModule {}
