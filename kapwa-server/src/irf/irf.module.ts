import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrfController } from './irf.controller.js';
import { IrfService } from './irf.service.js';
import { IrfKeyService } from './irf-key.service.js';
import { IrfAuditService } from './irf-audit.service.js';
import { IrfExportService } from './irf-export.service.js';
import { IrfCase } from './irf-case.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { ConsentLedger } from '../beneficiaries/consent-ledger.entity.js';
import { AgenciesModule } from '../agencies/agencies.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([IrfCase, ConsentLedger]), AuthModule, AgenciesModule],
  controllers: [IrfController],
  providers: [IrfService, IrfKeyService, IrfAuditService, IrfExportService],
  exports: [IrfService, IrfExportService],
})
export class IrfModule {}
