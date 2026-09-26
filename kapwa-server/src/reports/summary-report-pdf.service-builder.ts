import { Injectable } from '@nestjs/common';
import { SummaryReportData } from './summary-report.types';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';

@Injectable()
export class SummaryReportPdfBuilder {
  build(data: SummaryReportData): Promise<Buffer> {
    return buildSummaryReportPdf(data);
  }
}
