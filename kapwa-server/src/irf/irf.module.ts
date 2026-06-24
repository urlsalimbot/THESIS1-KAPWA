import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IrfController } from './irf.controller';
import { IrfService } from './irf.service';
import { IrfKeyService } from './irf-key.service';
import { IrfAuditService } from './irf-audit.service';
import { IrfExportService } from './irf-export.service';
import { IrfCase } from './irf-case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IrfCase])],
  controllers: [IrfController],
  providers: [IrfService, IrfKeyService, IrfAuditService, IrfExportService],
  exports: [IrfService, IrfExportService],
})
export class IrfModule {}
