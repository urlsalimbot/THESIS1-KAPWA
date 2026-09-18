import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IrfCase } from './irf-case.entity';
import { IrfService } from './irf.service';
import { IrfAuditService } from './irf-audit.service';
import { AgenciesService } from '../agencies/agencies.service';
import { ORG_LOCATION } from '../common/constants';
import { fmtDateLong, fmtDateTime } from '../common/pdf-format';

@Injectable()
export class IrfExportService {
  private readonly logger = new Logger(IrfExportService.name);

  constructor(
    @InjectRepository(IrfCase) private irfRepo: Repository<IrfCase>,
    private irfService: IrfService,
    private irfAuditService: IrfAuditService,
    private agenciesService: AgenciesService,
  ) {}

  private async agencyLabel(): Promise<string> {
    const mswdo = await this.agenciesService.findByCode('MSWDO');
    return mswdo?.name || 'Municipal Social Welfare and Development Office';
  }

  async exportPdf(id: string, legalBasis: string, password: string, userId: string): Promise<Buffer> {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    const agencyName = await this.agencyLabel();

    const irfData = await this.irfService.exportWcpd(id, legalBasis);
    if (!irfData) throw new NotFoundException('IRF case not found');

    // Audit before export (audit-first pattern)
    await this.irfAuditService.logAccess({
      irfId: id,
      userId,
      action: 'EXPORT_PDF',
      legalBasis,
      format: 'pdf',
    });

    // Build PDF via pdfkit with password protection
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `IRF-${irfData.case?.blotterEntryNumber || id}`,
        Author: agencyName,
        Subject: 'Incident Report Form — WCPD Export',
      },
      userPassword: password,
      ownerPassword: process.env.PDF_OWNER_PW || 'kapwa-admin-2026',
      permissions: { printing: 'lowResolution', modifying: false, copying: false },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => {
      this.logger.log(`PDF export complete: IRF ${id}, size ${Buffer.concat(buffers).length} bytes`);
    });

    // Build PDF content
    // Header
    doc.fontSize(14).font('Helvetica-Bold').text(ORG_LOCATION.country, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`${agencyName}`, { align: 'center' });
    doc.fontSize(10).text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text('INCIDENT REPORT FORM', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666').text(`Generated: ${fmtDateTime(new Date())} | Format: WCPD-EXPORT-v1`, { align: 'right' });
    doc.moveDown();
    doc.fillColor('#111');

    // Horizontal rule
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Case Information section
    doc.fontSize(12).font('Helvetica-Bold').text('Case Information');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Blotter Entry Number: ${irfData.case?.blotterEntryNumber || 'N/A'}`);
    doc.text(`Case Category: ${irfData.case?.caseCategory || 'N/A'}`);
    doc.text(`Date Reported: ${irfData.case?.datetimeReported ? fmtDateLong(irfData.case.datetimeReported) : 'N/A'}`);
    doc.text(`Date of Incident: ${irfData.case?.datetimeIncident ? fmtDateLong(irfData.case.datetimeIncident) : 'N/A'}`);
    doc.text(`Case Disposition: ${irfData.case?.caseDisposition || 'N/A'}`);
    doc.moveDown();

    // Parties section
    doc.fontSize(12).font('Helvetica-Bold').text('Parties');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const renderRecord = (label: string, record: Record<string, any>) => {
      doc.font('Helvetica-Bold').fontSize(10).text(label);
      doc.font('Helvetica').fontSize(9);
      Object.entries(record ?? {}).forEach(([key, value]) => {
        const fieldLabel = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (ch) => ch.toUpperCase());
        const text = value == null || value === '' ? 'N/A'
          : typeof value === 'object' ? JSON.stringify(value) : String(value);
        doc.font('Helvetica-Bold').text(`${fieldLabel}: `, { continued: true });
        doc.font('Helvetica').text(text);
      });
      doc.moveDown(0.5);
    };

    if (irfData.parties?.reportingPerson) {
      renderRecord('Item A — Reporting Person', irfData.parties.reportingPerson);
    }

    if (irfData.parties?.personReported) {
      renderRecord('Item B — Person Reported', irfData.parties.personReported);
    }

    // Narration section (only if decrypted)
    if (irfData.narration) {
      doc.fontSize(12).font('Helvetica-Bold').text('Victim Narration');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(irfData.narration);
      doc.moveDown();
    }

    // Signatures
    doc.fontSize(12).font('Helvetica-Bold').text('Signatures');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`MSWDO Signature: ${irfData.signatures?.msdwSignatureUrl ? 'Signed (on file)' : 'Not provided'}`);
    doc.text(`Reporting Party Signature: ${irfData.signatures?.reportingSignatureUrl ? 'Signed (on file)' : 'Not provided'}`);

    // Footer with legal basis info
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica-Oblique')
      .text(`Exported under legal basis code: ${legalBasis}`, { align: 'center' })
      .text(`Agency: ${agencyName}`, { align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  async exportJson(id: string, legalBasis: string, userId: string): Promise<object> {
    if (!legalBasis) throw new ForbiddenException('Legal basis code is required');

    const irfData = await this.irfService.exportWcpd(id, legalBasis);
    if (!irfData) throw new NotFoundException('IRF case not found');

    // Audit before returning data
    await this.irfAuditService.logAccess({
      irfId: id,
      userId,
      action: 'EXPORT_JSON',
      legalBasis,
      format: 'json',
    });

    const agencyName = await this.agencyLabel();

    return {
      exportMetadata: {
        format: 'WCPD-EXPORT-v1',
        generatedAt: new Date().toISOString(),
        legalBasis,
        agency: agencyName,
        encrypted: false,
      },
      case: irfData.case,
      parties: irfData.parties,
      narration: irfData.narration,
      signatures: irfData.signatures,
    };
  }

  // IRF case number for export filenames (`IRF ${blotterEntryNumber}-${date}.pdf`).
  async controlNo(irfId: string): Promise<string> {
    const irf = await this.irfRepo.findOne({ where: { id: irfId } });
    if (!irf) throw new NotFoundException('IRF not found');
    return irf.blotterEntryNumber || irfId;
  }
}
