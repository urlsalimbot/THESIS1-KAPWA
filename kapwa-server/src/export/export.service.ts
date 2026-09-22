import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';
import { OrgService } from '../common/org.service';
import { ORG_LOCATION } from '../common/constants';
import { fmtDateLong } from '../common/pdf-format';

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

  async generateCertificate(
    type: 'eligibility' | 'referral',
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
      type === 'eligibility'
        ? 'is hereby certified as ELIGIBLE to receive assistance and social services from this office.'
        : 'is hereby referred to the appropriate agency for the necessary intervention and assistance.';

    const address = data.address?.trim();
    const addressSuffix = address && !address.toLowerCase().includes(ORG_LOCATION.municipality.toLowerCase())
      ? `, ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`
      : '';

    doc.fontSize(12).font('Helvetica').text(`This certifies that ${data.fullName}${address ? ` of ${address}${addressSuffix}` : ''} ${certification}`);
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
}
