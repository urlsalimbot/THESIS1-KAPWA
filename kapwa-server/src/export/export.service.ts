import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intervention } from '../interventions/intervention.entity';
import { Case } from '../cases/case.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(Intervention)
    private readonly intRepo: Repository<Intervention>,
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
        Title: 'Audit Log \u2014 MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Audit Log Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Audit Log \u2014 MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text(`Period: ${startDate?.toISOString().slice(0, 10) || 'N/A'} \u2014 ${endDate?.toISOString().slice(0, 10) || 'N/A'}`);
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Total Records: ${data.summary.count}`);
    doc.text(`Total Amount: \u20B1${Number(data.summary.totalAmount).toLocaleString()}`);
    doc.moveDown();

    if (data.interventions.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Interventions');
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica');
      for (const int of data.interventions.slice(0, 500)) {
        doc.text(`${int.date}: ${int.type} \u2014 \u20B1${Number(int.amount || 0).toLocaleString()} (Voucher: ${int.voucherNo || 'N/A'})`);
      }
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportAuditLogCsv(startDate?: Date, endDate?: Date): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.auditService.exportForCoa(startDate as any, endDate as any);
    this.logger.warn(`EXPORT: audit-log CSV, ${data.summary.count} records`);

    const { stringify } = require('csv-stringify/sync');
    const records = data.interventions.map(i => ({
      Date: i.date,
      Type: i.type,
      Amount: i.amount ? Number(i.amount).toFixed(2) : '',
      VoucherNo: i.voucherNo || '',
    }));
    const csv = stringify(records, { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return {
      buffer: Buffer.from(csv),
      filename: `audit-logs-${dateStr}.csv`,
    };
  }

  private async getServiceSummaryData(startDate?: Date, endDate?: Date) {
    const qb = this.intRepo
      .createQueryBuilder('i')
      .select("i.intervention_type", "interventionType")
      .addSelect("COUNT(*)", "serviceCount")
      .addSelect("COALESCE(SUM(i.amount), 0)", "totalAmount")
      .addSelect("COUNT(DISTINCT i.household_id)", "uniqueHouseholds")
      .groupBy("i.intervention_type");
    if (startDate) qb.andWhere('i.service_date >= :startDate', { startDate });
    if (endDate) qb.andWhere('i.service_date <= :endDate', { endDate });
    return qb.getRawMany();
  }

  async exportServiceSummaryPdf(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const data = await this.getServiceSummaryData(startDate, endDate);
    this.logger.warn(`EXPORT: service-summary PDF, ${data.length} categories`);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Service Summary \u2014 MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Service Summary Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Service Summary \u2014 MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    const totalAmt = data.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    const totalHh = data.reduce((s, r) => s + Number(r.uniqueHouseholds || 0), 0);
    doc.fontSize(10).font('Helvetica').text(`Total Disbursed: \u20B1${totalAmt.toLocaleString()}`);
    doc.text(`Total Unique Households: ${totalHh}`);
    doc.moveDown();

    if (data.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Service Categories');
      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica');
      for (const row of data) {
        doc.text(`${row.interventionType}: ${row.serviceCount} services, \u20B1${Number(row.totalAmount || 0).toLocaleString()}, ${row.uniqueHouseholds} households`);
      }
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportServiceSummaryCsv(startDate?: Date, endDate?: Date): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.getServiceSummaryData(startDate, endDate);

    const { stringify } = require('csv-stringify/sync');
    const records = data.map(r => ({
      Program: r.interventionType,
      Category: '',
      ServicesRendered: r.serviceCount,
      TotalAmount: Number(r.totalAmount || 0).toFixed(2),
      UniqueHouseholds: r.uniqueHouseholds,
    }));
    const csv = stringify(records, { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(csv), filename: `service-summary-${dateStr}.csv` };
  }

  async exportServiceSummaryXlsx(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const data = await this.getServiceSummaryData(startDate, endDate);

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
    for (const r of data) {
      ws.addRow({
        program: r.interventionType,
        category: '',
        services: Number(r.serviceCount),
        amount: Number(r.totalAmount || 0).toFixed(2),
        households: Number(r.uniqueHouseholds),
      });
    }
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async getComplianceData() {
    const total = await this.caseRepo.count();
    const byStatus = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany();
    return { total, byStatus };
  }

  async exportCompliancePdf(): Promise<Buffer> {
    const data = await this.getComplianceData();
    this.logger.warn(`EXPORT: compliance PDF, ${data.total} total cases`);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Compliance Report \u2014 MSWDO Norzagaray',
        Author: 'MSWDO Norzagaray',
        Subject: 'Compliance Export',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(16).font('Helvetica-Bold').text('Compliance Report \u2014 MSWDO Norzagaray', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Municipal Social Welfare and Development Office', { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica').text(`Total Cases: ${data.total}`);
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Case Status Breakdown');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');
    for (const row of data.byStatus) {
      doc.text(`${row.status}: ${row.count} cases`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportComplianceCsv(): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.getComplianceData();

    const { stringify } = require('csv-stringify/sync');
    const records = data.byStatus.map(r => ({
      Status: r.status,
      Count: r.count,
    }));
    const csv = stringify(records, { header: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(csv), filename: `compliance-${dateStr}.csv` };
  }
}
