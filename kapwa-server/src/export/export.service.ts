import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    private readonly auditService: AuditService,
  ) {}

  async exportAuditLogPdf(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const data = await this.auditService.exportForCoa(startDate as any, endDate as any);
    this.logger.warn(`EXPORT: audit-log PDF, ${data.summary.count} records`);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Audit Log — MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Audit Log Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Audit Log — MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text(`Period: ${startDate?.toISOString().slice(0, 10) || 'N/A'} — ${endDate?.toISOString().slice(0, 10) || 'N/A'}`);
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Total Records: ${data.summary.count}`);
    doc.text(`Total Amount: ₱${Number(data.summary.totalAmount).toLocaleString()}`);
    doc.moveDown();

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportAuditLogCsv(startDate?: Date, endDate?: Date): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.auditService.exportForCoa(startDate as any, endDate as any);
    this.logger.warn(`EXPORT: audit-log CSV, ${data.summary.count} records`);

    const { stringify } = require('csv-stringify/sync');
    const csv = stringify([], { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      buffer: Buffer.from(csv),
      filename: `audit-logs-${dateStr}.csv`,
    };
  }

  async exportServiceSummaryPdf(_startDate?: Date, _endDate?: Date): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Service Summary — MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Service Summary Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Service Summary — MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text('No intervention data available.');
    doc.moveDown();

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportServiceSummaryCsv(_startDate?: Date, _endDate?: Date): Promise<{ buffer: Buffer; filename: string }> {
    const { stringify } = require('csv-stringify/sync');
    const csv = stringify([], { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(csv), filename: `service-summary-${dateStr}.csv` };
  }

  async exportServiceSummaryXlsx(_startDate?: Date, _endDate?: Date): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Service Summary');
    ws.columns = [
      { header: 'Program', key: 'program', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Services Rendered', key: 'services', width: 20 },
      { header: 'Total Amount', key: 'amount', width: 15 },
      { header: 'Unique Households', key: 'households', width: 20 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportCompliancePdf(): Promise<Buffer> {
    const total = await this.caseRepo.count();
    const byStatus = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany();

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Compliance Report — MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Compliance Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Compliance Report — MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').text(`Total Cases: ${total}`);
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Case Status Breakdown');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');
    for (const row of byStatus) {
      doc.text(`${row.status}: ${row.count} cases`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async generateCertificate(
    type: 'indigency' | 'eligibility' | 'referral',
    data: { fullName: string; address?: string; date: string; details?: string },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margin: 60,
      info: {
        Title: `Certificate of ${type}`,
        Author: 'MSWDO Norzagaray',
        Subject: 'Certificate Generation',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', resolve));

    doc.fontSize(18).font('Helvetica-Bold').text(`CERTIFICATE OF ${type.toUpperCase()}`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown();

    const certification =
      type === 'indigency'
        ? 'is a resident of this municipality and is hereby certified as INDIGENT, unable to provide for the basic needs of their family in a manner consistent with the minimum standards of living.'
        : type === 'eligibility'
          ? 'is hereby certified as ELIGIBLE to receive assistance and social services from this office.'
          : 'is hereby referred to the appropriate agency for the necessary intervention and assistance.';

    doc.fontSize(12).font('Helvetica').text(`This certifies that ${data.fullName}${data.address ? ` of ${data.address}` : ''} ${certification}`);
    doc.moveDown();
    doc.text(`Issued on ${data.date}.`);
    if (data.details) {
      doc.moveDown();
      doc.text(data.details);
    }

    doc.end();
    await done;
    this.logger.warn(`EXPORT: certificate of ${type}`);
    return { buffer: Buffer.concat(chunks), filename: `certificate-${type}-${Date.now()}.pdf` };
  }

  async monthlyFundUtilization(month: string): Promise<{ buffer: Buffer; filename: string }> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fund Utilization');
    sheet.columns = [
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Fund Source', key: 'fundSource', width: 20 },
      { header: 'Amount', key: 'amount', width: 16 },
    ];
    const rows = await this.caseRepo.query(
      `SELECT p.name AS program, ci.fund_source AS "fundSource", COALESCE(SUM(ci.amount), 0) AS amount
       FROM case_interventions ci
       JOIN cases c ON c.id::text = ci.case_id AND c.status = 'transitioning'
       LEFT JOIN programs p ON p.id = ci.program_id
       WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2
       GROUP BY p.name, ci.fund_source ORDER BY p.name`,
      [`${month}-01`, nextMonth(month)],
    );
    (rows ?? []).forEach((r: any) => sheet.addRow({ ...r, amount: Number(r.amount) }));
    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.warn(`EXPORT: monthly fund utilization ${month}, ${(rows ?? []).length} rows`);
    return { buffer: Buffer.from(buffer), filename: `fund-utilization-${month}.xlsx` };
  }

  async exportComplianceCsv(): Promise<{ buffer: Buffer; filename: string }> {
    const byStatus = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany();

    const { stringify } = require('csv-stringify/sync');
    const records = byStatus.map(r => ({
      Status: r.status,
      Count: r.count,
    }));
    const csv = stringify(records, { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(csv), filename: `compliance-${dateStr}.csv` };
  }
}
