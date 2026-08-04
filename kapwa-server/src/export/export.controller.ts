import { Controller, Get, Post, Body, Query, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { ExportService } from './export.service';

const GenerateCertificateSchema = z.object({
  type: z.enum(['indigency', 'eligibility', 'referral']),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(255, 'Full name must be 255 characters or fewer'),
  address: z.string().trim().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be in YYYY-MM-DD format'),
  details: z.string().trim().optional(),
});

@ApiTags('Export')
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('audit-logs')
  @Roles('admin', 'auditor')
  @ApiOperation({ summary: 'Export audit logs as PDF or CSV' })
  @ApiQuery({ name: 'format', required: true, enum: ['pdf', 'csv'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportAuditLogs(
    @Query('format') format: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    if (!res) return;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    if (format === 'pdf') {
      const buf = await this.exportService.exportAuditLogPdf(start, end);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="audit-logs.pdf"',
        'Content-Length': buf.length,
      });
      res.send(buf);
    } else if (format === 'csv') {
      const { buffer, filename } = await this.exportService.exportAuditLogCsv(start, end);
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } else {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid format. Use pdf or csv.' });
    }
  }

  @Get('service-summary')
  @Roles('admin', 'mayor', 'auditor')
  @ApiOperation({ summary: 'Export service summary as PDF, CSV, or XLSX' })
  @ApiQuery({ name: 'format', required: true, enum: ['pdf', 'csv', 'xlsx'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportServiceSummary(
    @Query('format') format: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() res?: Response,
  ) {
    if (!res) return;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    if (format === 'pdf') {
      const buf = await this.exportService.exportServiceSummaryPdf(start, end);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="service-summary.pdf"',
        'Content-Length': buf.length,
      });
      res.send(buf);
    } else if (format === 'csv') {
      const { buffer, filename } = await this.exportService.exportServiceSummaryCsv(start, end);
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } else if (format === 'xlsx') {
      const buf = await this.exportService.exportServiceSummaryXlsx(start, end);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="service-summary.xlsx"',
        'Content-Length': buf.length,
      });
      res.send(buf);
    } else {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid format. Use pdf, csv, or xlsx.' });
    }
  }

  @Get('monthly-funds')
  @Roles('admin', 'mayor', 'auditor')
  @ApiOperation({ summary: 'Export monthly fund utilization as an Excel workbook' })
  @ApiQuery({ name: 'month', required: true, example: '2026-08', description: 'Month in YYYY-MM format' })
  async exportMonthlyFunds(
    @Query('month') month: string,
    @Res() res?: Response,
  ) {
    if (!res) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid month. Use YYYY-MM format.' });
      return;
    }
    const { buffer, filename } = await this.exportService.monthlyFundUtilization(month);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('compliance')
  @Roles('admin', 'auditor', 'mayor')
  @ApiOperation({ summary: 'Export compliance report as PDF or CSV' })
  @ApiQuery({ name: 'format', required: true, enum: ['pdf', 'csv'] })
  async exportCompliance(
    @Query('format') format: string,
    @Res() res?: Response,
  ) {
    if (!res) return;
    if (format === 'pdf') {
      const buf = await this.exportService.exportCompliancePdf();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compliance.pdf"',
        'Content-Length': buf.length,
      });
      res.send(buf);
    } else if (format === 'csv') {
      const { buffer, filename } = await this.exportService.exportComplianceCsv();
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } else {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Invalid format. Use pdf or csv.' });
    }
  }

  @Post('certificate')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Generate a certificate of indigency, eligibility, or referral as a PDF' })
  async generateCertificate(
    @Body(new ZodPipe(GenerateCertificateSchema)) body: z.infer<typeof GenerateCertificateSchema>,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exportService.generateCertificate(body.type, {
      fullName: body.fullName,
      address: body.address,
      date: body.date,
      details: body.details,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}
