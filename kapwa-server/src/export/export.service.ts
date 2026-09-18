import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';
import { OrgService } from '../common/org.service';
import { ORG_LOCATION } from '../common/constants';
import { php, fmtDateLong, fmtDateTime } from '../common/pdf-format';

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
    private readonly org: OrgService,
  ) {}

  // Official letterhead + report title + generated stamp, shared by every
  // plain report export (audit log, service summary, compliance).
  private async letterhead(doc: any, title: string): Promise<void> {
    const officeName = await this.org.officeName();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111')
      .text(ORG_LOCATION.country, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text(officeName, { align: 'center' });
    doc.fontSize(10)
      .text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666')
      .text(`Generated: ${fmtDateTime(new Date())}`, { align: 'right' });
    doc.moveDown();
    doc.fillColor('#111').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
  }

  private tableHeader(doc: any, cols: Array<{ label: string; w: number }>, top: number): number {
    let x = 50;
    const total = cols.reduce((sum, c) => sum + c.w, 0);
    doc.rect(50, top, total, 14).fillColor('#e6e6e6').fill();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111');
    cols.forEach((c) => {
      doc.text(c.label, x + 3, top + 3, { width: c.w - 6, height: 10, ellipsis: true });
      doc.rect(x, top, c.w, 14).lineWidth(0.5).strokeColor('#999').stroke();
      x += c.w;
    });
    return top + 14;
  }

  private tableRow(doc: any, cols: Array<{ label: string; w: number }>, values: string[], top: number): number {
    let x = 50;
    doc.font('Helvetica').fontSize(8).fillColor('#111');
    cols.forEach((c, i) => {
      doc.rect(x, top, c.w, 14).lineWidth(0.5).strokeColor('#ccc').stroke();
      doc.text(values[i] ?? '', x + 3, top + 3, { width: c.w - 6, height: 10, ellipsis: true });
      x += c.w;
    });
    return top + 14;
  }

  async exportAuditLogPdf(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const data = await this.auditService.exportForCoa(startDate as any, endDate as any);
    this.logger.warn(`EXPORT: audit-log PDF, ${data.summary.count} records`);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Audit Log',
        Author: await this.org.officeName(),
        Subject: 'Audit Log Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    await this.letterhead(doc, 'Audit Log');

    const period = startDate || endDate
      ? `Period: ${startDate ? fmtDateLong(startDate) : 'Start'} to ${endDate ? fmtDateLong(endDate) : fmtDateLong(new Date())}`
      : 'Period: All records to date';
    doc.fontSize(10).font('Helvetica-Bold').text(period);
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Total Records: ${data.summary.count}`);
    doc.text(`Total Amount: ${php(data.summary.totalAmount)}`);
    doc.moveDown();

    const cols = [
      { label: 'Date', w: 65 },
      { label: 'Case No.', w: 90 },
      { label: 'Beneficiary', w: 105 },
      { label: 'Service', w: 110 },
      { label: 'Fund Source', w: 75 },
      { label: 'Amount', w: 50 },
    ];
    let y = this.tableHeader(doc, cols, doc.y);
    const rows = data.interventions ?? [];
    if (rows.length === 0) {
      y = this.tableRow(doc, cols, ['—', 'No interventions recorded for this period.', '', '', '', ''], y);
    } else {
      rows.forEach((r: any) => {
        if (y + 14 > 780) {
          doc.addPage();
          y = this.tableHeader(doc, cols, 50);
        }
        const beneficiary = [r.first_name, r.surname].filter(Boolean).join(' ');
        y = this.tableRow(doc, cols, [
          r.delivery_date ? fmtDateLong(r.delivery_date) : '—',
          r.control_no ?? '—',
          beneficiary || '—',
          r.service_name ?? '—',
          r.fund_source ?? '—',
          r.amount != null ? php(r.amount) : '—',
        ], y);
      });
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportAuditLogCsv(startDate?: Date, endDate?: Date): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.auditService.exportForCoa(startDate, endDate);
    const rows = await this.auditService.getAuditLog(undefined, undefined, 10000);
    this.logger.warn(`EXPORT: audit-log CSV, ${data.summary.count} interventions, ${rows.length} log rows`);

    const { stringify } = require('csv-stringify/sync');
    const csv = stringify(
      rows.map((r: any) => ({
        action: r.action ?? '',
        table: (r.action ?? '').split('.')[0],
        entity: r.reference_id ?? '',
        actor: r.user_name || r.user_email || '',
        timestamp: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      })),
      { header: true, columns: ['action', 'table', 'entity', 'actor', 'timestamp'] },
    );
    return {
      buffer: Buffer.from(csv),
      filename: 'audit-logs.csv',
    };
  }

  async exportServiceSummaryPdf(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const rows = (await this.serviceSummaryRows(startDate, endDate)) ?? [];

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Service Summary',
        Author: await this.org.officeName(),
        Subject: 'Service Summary Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    await this.letterhead(doc, 'Service Summary');

    const period = startDate || endDate
      ? `Period: ${startDate ? fmtDateLong(startDate) : 'Start'} to ${endDate ? fmtDateLong(endDate) : fmtDateLong(new Date())}`
      : 'Period: All records to date';
    doc.fontSize(10).font('Helvetica-Bold').text(period);
    doc.moveDown(0.5);

    const cols = [
      { label: 'Program', w: 150 },
      { label: 'Fund Source', w: 120 },
      { label: 'Services', w: 70 },
      { label: 'Total Amount', w: 155 },
    ];
    let y = this.tableHeader(doc, cols, doc.y);
    if (rows.length === 0) {
      y = this.tableRow(doc, cols, ['No intervention data available.', '', '', ''], y);
    } else {
      let services = 0;
      let total = 0;
      rows.forEach((r: any) => {
        if (y + 14 > 780) {
          doc.addPage();
          y = this.tableHeader(doc, cols, 50);
        }
        services += Number(r.services) || 0;
        total += Number(r.amount) || 0;
        y = this.tableRow(doc, cols, [
          r.program || 'Unspecified',
          r.fund_source || 'Unspecified',
          String(r.services ?? 0),
          php(r.amount),
        ], y);
      });
      if (y + 14 > 780) {
        doc.addPage();
        y = this.tableHeader(doc, cols, 50);
      }
      y = this.tableRow(doc, cols, ['Total', '', String(services), php(total)], y);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  private async serviceSummaryRows(startDate?: Date, endDate?: Date): Promise<any[]> {
    const start = startDate ? startDate.toISOString().slice(0, 10) : null;
    const end = endDate ? endDate.toISOString().slice(0, 10) : null;
    return this.caseRepo.query(
      `SELECT COALESCE(p.name, 'Unspecified') AS program,
              COALESCE(ci.fund_source, 'Unspecified') AS fund_source,
              COUNT(*)::int AS services,
              COALESCE(SUM(ci.amount), 0) AS amount
       FROM case_interventions ci
       LEFT JOIN programs p ON p.id = ci.program_id
       WHERE ($1::date IS NULL OR ci.delivery_date >= $1::date)
         AND ($2::date IS NULL OR ci.delivery_date <= $2::date)
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      [start, end],
    );
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
        Title: 'Compliance Report',
        Author: await this.org.officeName(),
        Subject: 'Compliance Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    await this.letterhead(doc, 'Compliance Report');

    doc.fontSize(10).font('Helvetica').text(`Total Cases: ${total}`);
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Case Status Breakdown');
    doc.moveDown(0.5);

    const cols = [
      { label: 'Status', w: 250 },
      { label: 'Cases', w: 245 },
    ];
    let y = this.tableHeader(doc, cols, doc.y);
    if (byStatus.length === 0) {
      y = this.tableRow(doc, cols, ['No cases recorded.', '0'], y);
    } else {
      byStatus.forEach((row: any) => {
        if (y + 14 > 780) {
          doc.addPage();
          y = this.tableHeader(doc, cols, 50);
        }
        const count = Number(row.count) || 0;
        y = this.tableRow(doc, cols, [row.status ?? '—', `${count} ${count === 1 ? 'case' : 'cases'}`], y);
      });
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
    const officeName = await this.org.officeName();
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margin: 60,
      info: {
        Title: `Certificate of ${type}`,
        Author: officeName,
        Subject: 'Certificate Generation',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', resolve));

    doc.fontSize(12).font('Helvetica').fillColor('#111').text(ORG_LOCATION.country, { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').text(officeName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(18).font('Helvetica-Bold').text(`CERTIFICATE OF ${type.toUpperCase()}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(1.5);

    const certification =
      type === 'indigency'
        ? 'is a resident of this municipality and is hereby certified as INDIGENT, unable to provide for the basic needs of their family in a manner consistent with the minimum standards of living.'
        : type === 'eligibility'
          ? 'is hereby certified as ELIGIBLE to receive assistance and social services from this office.'
          : 'is hereby referred to the appropriate agency for the necessary intervention and assistance.';

    doc.fontSize(12).font('Helvetica').text(`This certifies that ${data.fullName}${data.address ? ` of ${data.address}, ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}` : ''} ${certification}`);
    if (data.details) {
      doc.moveDown();
      doc.text(data.details);
    }
    doc.moveDown();
    doc.text(`Issued on ${fmtDateLong(data.date)} at ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}.`);

    doc.moveDown(4);
    doc.fontSize(10).font('Helvetica').text('____________________________', { align: 'center' });
    doc.fontSize(9).fillColor('#555').text('MSWDO Officer', { align: 'center' });
    doc.fillColor('#111');

    doc.end();
    await done;
    this.logger.warn(`EXPORT: certificate of ${type}`);
    return { buffer: Buffer.concat(chunks), filename: `certificate-${type}-${Date.now()}.pdf` };
  }

  async monthlyFundUtilization(month: string, startDate?: string, endDate?: string): Promise<{ buffer: Buffer; filename: string }> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fund Utilization');
    sheet.columns = [
      { header: 'Program', key: 'program', width: 30 },
      { header: 'Fund Source', key: 'fundSource', width: 20 },
      { header: 'Amount', key: 'amount', width: 16 },
    ];
    // Explicit date range wins over the monthly shortcut; end is inclusive.
    const rangeStart = startDate ?? `${month}-01`;
    const rangeEnd = endDate
      ? new Date(new Date(endDate).getTime() + 86_400_000).toISOString().slice(0, 10)
      : nextMonth(month);
    const rows = await this.caseRepo.query(
      `SELECT p.name AS program, ci.fund_source AS "fundSource", COALESCE(SUM(ci.amount), 0) AS amount
       FROM case_interventions ci
       LEFT JOIN cases c ON c.id::text = ci.case_id
       LEFT JOIN programs p ON p.id = ci.program_id
       WHERE ci.delivery_date >= $1 AND ci.delivery_date < $2
       GROUP BY p.name, ci.fund_source ORDER BY p.name`,
      [rangeStart, rangeEnd],
    );
    (rows ?? []).forEach((r: any) => sheet.addRow({ ...r, amount: Number(r.amount) }));
    const buffer = await workbook.xlsx.writeBuffer();
    const label = startDate ? `${startDate}-to-${endDate}` : month;
    this.logger.warn(`EXPORT: fund utilization ${label}, ${(rows ?? []).length} rows`);
    return { buffer: Buffer.from(buffer), filename: `fund-utilization-${label}.xlsx` };
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
