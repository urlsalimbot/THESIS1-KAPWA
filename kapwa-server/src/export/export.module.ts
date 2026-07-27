import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { Case } from '../cases/case.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Case]),
    AuditModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
