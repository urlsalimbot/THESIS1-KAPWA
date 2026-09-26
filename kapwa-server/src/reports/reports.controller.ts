import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SummaryReportService } from './summary-report.service';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { SummaryReportQuerySchema } from './dto/summary-report.query';

export const SUMMARY_REPORT_BUILDER = 'SUMMARY_REPORT_BUILDER';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly summaryReport: SummaryReportService,
    @Inject(SUMMARY_REPORT_BUILDER) private readonly builder: { build: typeof buildSummaryReportPdf },
  ) {}

  @Get('summary')
  @Roles('mayor', 'admin', 'social_worker')
  @ApiOperation({ summary: 'GAD Summary Report (annual, quarterly, case list) as PDF' })
  @ApiQuery({ name: 'year', required: false, example: 2025 })
  @ApiQuery({ name: 'quarter', required: false, example: 2 })
  async summary(@Query('year') year: string, @Query('quarter') quarter: string, @Res() res: Response) {
    const { year: y, quarter: q } = SummaryReportQuerySchema.parse({ year, quarter });
    const data = await this.summaryReport.build(y, q);
    const buffer = await this.builder.build(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="summary-report-${y}-Q${q}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
