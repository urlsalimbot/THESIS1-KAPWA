import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController, SUMMARY_REPORT_BUILDER } from './reports.controller';
import { SummaryReportService } from './summary-report.service';
import { SummaryReportPdfBuilder } from './summary-report-pdf.service-builder';
import { CommonModule } from '../common/common.module';
import { User } from '../auth/user.entity';

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
