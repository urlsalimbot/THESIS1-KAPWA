import { Injectable } from '@nestjs/common';
import { SummaryReportData } from './summary-report.types.js';
import { buildSummaryReportPdf } from './summary-report-pdf.builder.js';

@Injectable()
export class SummaryReportPdfBuilder {
  build(data: SummaryReportData): Promise<Buffer> {
    return buildSummaryReportPdf(data);
  }
}
