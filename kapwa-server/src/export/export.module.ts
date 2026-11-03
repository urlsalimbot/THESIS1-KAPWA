import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';
import { Case } from '../cases/case.entity.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Case]),
    AuditModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
