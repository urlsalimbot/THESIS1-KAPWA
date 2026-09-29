import { BadRequestException, Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
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
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'GAD Summary Report (annual, semestral, case list) as PDF' })
  @ApiQuery({ name: 'year', required: false, example: 2025 })
  @ApiQuery({ name: 'semester', required: false, example: 2, description: '1 = Q1+Q2 (Jan–Jun), 2 = Q3+Q4 (Jul–Dec)' })
  async summary(@Query('year') year: string, @Query('semester') semester: string, @Res() res: Response) {
    let parsed: { year: number; semester: number };
    try {
      parsed = SummaryReportQuerySchema.parse({ year, semester });
    } catch {
      throw new BadRequestException('year must be 2000-2100 and semester must be 1-2');
    }
    const { year: y, semester: s } = parsed;
    const data = await this.summaryReport.build(y, s);
    const buffer = await this.builder.build(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="summary-report-${y}-S${s}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
