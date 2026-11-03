import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController, SUMMARY_REPORT_BUILDER } from './reports.controller.js';
import { SummaryReportService } from './summary-report.service.js';
import { SummaryReportPdfBuilder } from './summary-report-pdf.service-builder.js';
import { CommonModule } from '../common/common.module.js';
import { User } from '../auth/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CommonModule],
  controllers: [ReportsController],
  providers: [
    SummaryReportService,
    SummaryReportPdfBuilder,
    { provide: SUMMARY_REPORT_BUILDER, useExisting: SummaryReportPdfBuilder },
  ],
})
export class ReportsModule {}
