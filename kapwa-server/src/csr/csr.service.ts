import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsrRecord } from './csr.entity';
import { Intervention } from '../interventions/intervention.entity';
import * as PDFDocument from 'pdfkit';

const CSR_PAD_WIDTH = 4;
@Injectable()
export class CsrService {
  constructor(
    @InjectRepository(CsrRecord)
    private readonly csrRepo: Repository<CsrRecord>,
    @InjectRepository(Intervention)
    private readonly interventionRepo: Repository<Intervention>,
  ) {}

  async create(data: Partial<CsrRecord>, userId: string): Promise<CsrRecord> {
    const year = new Date().getFullYear();
    const seqName = `csr_seq_${year}`;
    const result = await this.csrRepo.query(`SELECT nextval('${seqName}') AS seq`);
    const nextSeq = parseInt(result[0].seq, 10);
    const controlNo = `CSR-${year}-${String(nextSeq).padStart(CSR_PAD_WIDTH, '0')}`;
    const record = this.csrRepo.create({
      ...data,
      controlNo,
      createdBy: userId,
    });
    return this.csrRepo.save(record);
  }

  async findAll(): Promise<CsrRecord[]> {
    return this.csrRepo.find({ order: { createdAt: 'DESC' }, take: DEFAULT_LIST_LIMIT });
  }

  async findById(id: string): Promise<CsrRecord> {
    const record = await this.csrRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('CSR record not found');
    return record;
  }

  async findByControlNo(controlNo: string): Promise<CsrRecord> {
    const record = await this.csrRepo.findOne({ where: { controlNo } });
    if (!record) throw new NotFoundException('CSR record not found');
    return record;
  }

  async update(id: string, data: Partial<CsrRecord>): Promise<CsrRecord> {
    const record = await this.findById(id);
    Object.assign(record, data);
    return this.csrRepo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findById(id);
    await this.csrRepo.remove(record);
  }

  async findInterventions(caseId: string) {
    return this.interventionRepo.find({ where: { caseId }, order: { loggedAt: 'DESC' } });
  }

  async generatePdf(controlNo: string): Promise<Buffer> {
    const record = await this.findByControlNo(controlNo);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LEGAL',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: `CSR-${record.controlNo}`,
          Author: record.socialWorkerName,
          Subject: 'Family Case Study Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = '#2E5C8A';
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fontSize(8).fillColor('#666').text('Republic of the Philippines', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold').text('MUNICIPAL SOCIAL WELFARE AND DEVELOPMENT OFFICE', { align: 'center' });
      doc.fontSize(9).fillColor('#555').font('Helvetica').text('Norzagaray, Bulacan', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor(primaryColor).text('═'.repeat(70), { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor('#1a1a1a').font('Helvetica-Bold').text('FAMILY CASE STUDY REPORT', { align: 'center' });
      doc.fontSize(9).fillColor('#666').font('Helvetica').text(`CSR No. ${record.controlNo}`, { align: 'center' });
      doc.moveDown(1);

      const section = (num: string, title: string) => {
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor(primaryColor).font('Helvetica-Bold').text(`${num}. ${title}`, { underline: false });
        doc.moveDown(0.2);
      };

      const field = (label: string, value: string) => {
        doc.fontSize(8).fillColor('#666').font('Helvetica').text(label, { continued: true });
        doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica').text(`  ${value || '\u2014'}`);
      };

      const body = (text: string) => {
        doc.fontSize(9).fillColor('#333').font('Helvetica').text(text || 'No entry.', { lineGap: 2 });
        doc.moveDown(0.3);
      };

      section('I', 'CASE REFERENCE');
      field('Control No.', record.controlNo);
      field('Date Filed', new Date(record.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }));
      field('Social Worker', record.socialWorkerName);
      field("Position", record.socialWorkerPosition ?? "");
      field("Referral Origin", record.referralOrigin ?? "");
      doc.moveDown(0.5);

      section('II', 'REASON FOR REFERRAL');
      body(record.reasonForReferral ?? "");

      section('III', 'PROBLEM PRESENTED');
      body(record.problemPresented ?? "");

      section('IV', 'FAMILY BACKGROUND');
      body(record.familyBackground ?? "");

      section('V', 'SOCIO-ECONOMIC PROFILE');
      body(record.socioEconomicProfile ?? "");

      section('VI', 'ASSESSMENT AND ANALYSIS');
      body(record.assessmentAnalysis ?? "");

      section('VII', 'RECOMMENDATION');
      body(record.recommendation ?? "");

      section('VIII', 'INTERVENTION PLAN');
      body(record.interventionPlan ?? "");

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(250, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#666').font('Helvetica').text('Prepared by:', { continued: true });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica-Bold').text(record.socialWorkerName);
      doc.fontSize(8).fillColor('#666').font('Helvetica').text(record.socialWorkerPosition ?? 'Social Worker');
      doc.moveDown(1);
      doc.moveTo(300, doc.y).lineTo(500, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#666').font('Helvetica').text('Noted by:');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#1a1a1a').font('Helvetica-Bold').text('___________________________');
      doc.fontSize(8).fillColor('#666').font('Helvetica').text('MSWDO Head / OIC');

      doc.end();
    });
  }
}
