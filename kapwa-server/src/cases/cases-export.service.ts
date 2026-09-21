import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';
import { FilingService } from '../filing/filing.service';
import { GisExportService } from '../gis/gis-export.service';
import { IrfExportService } from '../irf/irf-export.service';
import { OrgService } from '../common/org.service';
import { ORG_LOCATION } from '../common/constants';
import { php, fmtDateLong, flowArrow } from '../common/pdf-format';
import { PDFDocument as PdfLib } from 'pdf-lib';

@Injectable()
export class CasesExportService {
  private readonly logger = new Logger(CasesExportService.name);

  constructor(
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
    @InjectRepository(CaseHistory)
    private historyRepo: Repository<CaseHistory>,
    @InjectRepository(CaseIntervention)
    private interventionRepo: Repository<CaseIntervention>,
    private filing: FilingService,
    private readonly org: OrgService,
    private readonly gis: GisExportService,
    private readonly irfExport: IrfExportService,
  ) {}

  async generateCsrPdf(caseId: string): Promise<Buffer> {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');

    const parts: Buffer[] = [
      await this.buildCsrCover(c),
      await this.buildPettyCashVoucher(c),
      await this.buildCertificateOfEligibility(c),
    ];

    const irfRows: Array<{ id: string }> = await this.caseRepo.manager.query(
      'SELECT id FROM irf_cases WHERE case_id = $1 LIMIT 1',
      [caseId],
    );
    if (irfRows[0]?.id) {
      parts.push(await this.irfExport.buildIrfPdfBuffer(irfRows[0].id, {}));
    }

    parts.push(await this.gis.generateGisPdf(caseId));

    const pdf = await this.mergePdfs(parts);
    this.logger.log(`CSR bundle generated: ${c.controlNo}, ${pdf.length} bytes`);
    return pdf;
  }

  // Merges already-built PDF buffers into a single document. Encrypted sources
  // are ignored (the bundle is an internal, gated export).
  async mergePdfs(parts: Buffer[]): Promise<Buffer> {
    const merged = await PdfLib.create();
    for (const buf of parts) {
      const src = await PdfLib.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    return Buffer.from(await merged.save());
  }

  // Cover page for the Case Study Report bundle (spec §5). The long-form CSR
  // narrative is intentionally replaced by the bundle.
  private async buildCsrCover(c: Case): Promise<Buffer> {
    const officeName = await this.org.officeName();
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: { Title: `CSR-${c.controlNo}`, Author: officeName, Subject: 'Case Study Report' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(12).font('Helvetica-Bold').text(officeName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold').text('CASE STUDY REPORT', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Case No.: ${c.controlNo}`);
    doc.text(`Beneficiary: ${this.beneficiaryName(c)}`);
    doc.text(`Service Requested: ${(c.serviceRequested || []).join(', ') || '—'}`);
    doc.text(`Status: ${c.status}`);
    if (c.closureOutcome) doc.text(`Closure Outcome: ${c.closureOutcome}`);
    doc.moveDown();
    doc.fontSize(9).fillColor('#444').text(
      'This report bundles the case documents: Certificate of Eligibility, Petty Cash Voucher, Incident Report (if any), and the General Intake Sheet.',
    );
    doc.end();
    return done;
  }

  /**
   * Bulk CSV export of selected cases. PII (phone, PhilSys, DOB, address)
   * is masked by default; unmasked exports require a justification which is
   * written to each case's history trail (hash-chained audit).
   */
  async buildBulkCsv(
    ids: string[],
    masked: boolean,
    unmaskReason: string | undefined,
    callerId: string,
    callerRole: string,
  ): Promise<Buffer> {
    const cases = await this.caseRepo.find({
      where: { id: In(ids) },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household'],
    });
    if (cases.length === 0) throw new NotFoundException('No cases found for the selected ids');

    if (!masked) {
      const reason = unmaskReason?.trim();
      if (!reason) {
        throw new BadRequestException('A justification is required for an unmasked export');
      }
      await this.historyRepo.save(
        cases.map(c =>
          this.historyRepo.create({
            caseId: c.id,
            fromStatus: c.status,
            toStatus: c.status,
            transitionType: 'bulk_export_unmasked',
            changedByRole: callerRole,
            changedById: callerId,
            remarks: `Unmasked bulk export — ${reason}`,
          }),
        ),
      );
    }

    const esc = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const MASK = { phone: '***-***-****', philsys: '****-***-****', dob: '**/**/****', address: '*******' };
    const mask = (field: keyof typeof MASK, v: unknown): string =>
      masked ? MASK[field] : String(v ?? '');

    const headers = [
      'Control No', 'Surname', 'First Name', 'Middle Name', 'Gender', 'Age', 'Barangay',
      'Category', 'Status', 'Amount Assistance',
      'Phone', 'PhilSys No', 'DOB', 'Address', 'Updated At',
    ];
    const statusLabels: Record<string, string> = {
      enrolled: 'Enrolled', assessed: 'Assessed', in_review: 'In Review',
      active: 'Active', transitioning: 'Transitioning', closed: 'Closed',
    };

    const lines: string[] = [headers.map(h => `"${h}"`).join(',')];
    for (const c of cases) {
      const p = c.beneficiary?.person;
      const h = c.beneficiary?.household;
      const age = p?.dob
        ? Math.max(0, Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)))
        : '';
      const values = [
        c.controlNo,
        p?.surname, p?.firstName, p?.middleName, p?.gender, age,
        (h as { barangay?: string } | null)?.barangay,
        c.clientCategory || ((c.serviceRequested as string[]) || []).join(', '),
        statusLabels[c.status] || c.status,
        c.amountAssistance != null ? `₱${Number(c.amountAssistance).toLocaleString()}` : '',
        mask('phone', p?.phone),
        mask('philsys', p?.philsysNumber),
        mask('dob', p?.dob),
        mask('address', p?.currentAddress ? JSON.stringify(p.currentAddress) : p?.address),
        c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
      ];
      lines.push(values.map(esc).join(','));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf8');
  }

  // Case number for export filenames (`${CaseType} ${controlNo}-${date}.pdf`).
  async controlNo(caseId: string): Promise<string> {
    const c = await this.caseRepo.findOne({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found');
    return c.controlNo || caseId;
  }

  // Resolve a case id from its human-readable control number (for `/csr/:controlNo/pdf`).
  async findIdByControlNo(controlNo: string): Promise<string> {
    const c = await this.caseRepo.findOne({ where: { controlNo } });
    if (!c) throw new NotFoundException('Case not found');
    return c.id;
  }

  // ---------------------------------------------------------------- approval
  // Certificate of Eligibility + Petty Cash Voucher are PRODUCED by the system
  // when the disbursement is approved (in_review -> active) — they are outputs
  // of the approval, not pre-uploaded prerequisites.

  private beneficiaryName(c: Case): string {
    const p = (c.beneficiary as any)?.person;
    return [p?.firstName, p?.middleName, p?.surname].filter(Boolean).join(' ') || 'N/A';
  }

  private async buildCertificateOfEligibility(c: Case): Promise<Buffer> {
    const officeName = await this.org.officeName();
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: `COE-${c.controlNo}`, Author: officeName, Subject: 'Certificate of Eligibility' } });
    const chunks: Buffer[] = [];
    doc.on('data', (ch: Buffer) => chunks.push(ch));
    const done = new Promise<void>((resolve) => doc.on('end', resolve));

    const services = Array.isArray(c.serviceRequested) ? c.serviceRequested.join(', ') : '';
    const barangay = ((c.beneficiary as any)?.person?.address || '').split(',').pop()?.trim() || '';
    const localeSuffix = barangay && barangay.toLowerCase() === ORG_LOCATION.municipality.toLowerCase()
      ? `, ${ORG_LOCATION.province}`
      : `, ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`;
    const dateStr = fmtDateLong(new Date());
    const preparedBy = c.interviewedBy || c.assignedWorkerName || (c.assignedWorker as any)?.fullName || '';

    doc.fontSize(14).font('Helvetica-Bold').text(ORG_LOCATION.country, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(officeName, { align: 'center' });
    doc.fontSize(10).text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICATE OF ELIGIBILITY', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).font('Helvetica').text(`This certifies that ${this.beneficiaryName(c)} of ${barangay}${localeSuffix} has been assessed and found ELIGIBLE for the following assistance under Case No. ${c.controlNo}:`);
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').text(`Services: ${services || 'N/A'}`, { align: 'center' });
    if (c.amountAssistance != null) {
      doc.fontSize(11).text(`Assistance Amount: ${php(c.amountAssistance)}`, { align: 'center' });
    }
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`This certification is issued upon the recommendation of the Social Worker and approval of the Municipal Social Welfare and Development Officer, in accordance with prevailing DSWD and LGU guidelines.`);
    doc.moveDown(3);
    doc.fontSize(10).font('Helvetica').text(preparedBy || ' ', { align: 'center' });
    doc.fontSize(10).text('____________________________', { align: 'center' });
    doc.fontSize(10).text('Social Worker / Case Officer', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text(`Issued on ${dateStr}`, { align: 'right' });

    doc.end();
    return done.then(() => Buffer.concat(chunks));
  }

  private async buildPettyCashVoucher(c: Case): Promise<Buffer> {
    const officeName = await this.org.officeName();
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: `PCV-${c.controlNo}`, Author: officeName, Subject: 'Petty Cash Voucher' } });
    const chunks: Buffer[] = [];
    doc.on('data', (ch: Buffer) => chunks.push(ch));
    const done = new Promise<void>((resolve) => doc.on('end', resolve));

    const amount = c.amountAssistance != null ? Number(c.amountAssistance) : 0;
    const fundSource = c.sourceOfFund || 'LGU - Municipal';
    const dateStr = fmtDateLong(new Date());

    doc.fontSize(14).font('Helvetica-Bold').text(ORG_LOCATION.country, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(officeName, { align: 'center' });
    doc.fontSize(10).text(`${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text('PETTY CASH VOUCHER', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).font('Helvetica').text(`PAYEE: ${this.beneficiaryName(c)}`);
    doc.text(`Case No.: ${c.controlNo}`);
    doc.text(`Date: ${dateStr}`);
    doc.moveDown();
    doc.fontSize(11).text(`AMOUNT: ${php(amount)}`, { align: 'center' });
    doc.moveDown();
    doc.text(`Fund Source: ${fundSource}`);
    doc.moveDown(2);
    doc.fontSize(9).text('Approved for payment:');
    doc.moveDown(2);
    doc.fontSize(10).text('____________________________', { align: 'left' });
    doc.fontSize(9).text('MSWDO Officer', { align: 'left' });
    doc.moveDown(2);
    doc.fontSize(9).text('Received the above amount in full.');
    doc.moveDown(2);
    doc.fontSize(10).text('____________________________', { align: 'left' });
    doc.fontSize(9).text('Signature of Payee', { align: 'left' });

    doc.end();
    return done.then(() => Buffer.concat(chunks));
  }

  // Required document keys (mandatory) contributed by the programs behind this
  // case's interventions, minus the keys already filed against the case.
  // A program with no required documents contributes nothing.
  async missingRequiredDocuments(caseId: string): Promise<string[]> {
    const required: Array<{ document_key: string }> = await this.caseRepo.manager.query(
      `SELECT DISTINCT prd.document_key
         FROM case_interventions ci
         JOIN program_required_documents prd ON prd.program_id = ci.program_id
        WHERE ci.case_id = $1 AND prd.mandatory = TRUE`,
      [caseId],
    );
    const requiredKeys = required.map((r) => r.document_key).filter(Boolean);
    if (requiredKeys.length === 0) return [];

    const filed: Array<{ requirement_key: string }> = await this.caseRepo.manager.query(
      `SELECT DISTINCT requirement_key FROM document_vault
        WHERE case_id = $1 AND requirement_key IS NOT NULL AND category = 'requirement'`,
      [caseId],
    );
    const filedKeys = new Set(filed.map((r) => r.requirement_key));
    return requiredKeys.filter((k) => !filedKeys.has(k));
  }

  private async requireCase(caseId: string) {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['beneficiary', 'beneficiary.person', 'assistances', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');
    return c;
  }

  // Manual issuance (spec §2). Idempotent: an already-issued document is
  // returned as-is without filing a duplicate.
  async issueCoe(caseId: string, actorId?: string): Promise<string> {
    const c = await this.requireCase(caseId);
    if (c.certificateUrl) return c.certificateUrl;
    const pdf = await this.buildCertificateOfEligibility(c);
    const doc = await this.filing.upload(
      { originalname: `COE-${c.controlNo}.pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
      { caseId: c.id, category: 'approval_document', notes: `Certificate of Eligibility — issued for ${c.controlNo}`, uploadedBy: actorId },
    );
    c.certificateUrl = `/filing/${doc.id}/download`;
    await this.caseRepo.save(c);
    return c.certificateUrl;
  }

  async issuePcv(caseId: string, actorId?: string): Promise<string> {
    const c = await this.requireCase(caseId);
    if (c.pettyCashVoucherUrl) return c.pettyCashVoucherUrl;
    const pdf = await this.buildPettyCashVoucher(c);
    const doc = await this.filing.upload(
      { originalname: `PCV-${c.controlNo}.pdf`, mimetype: 'application/pdf', size: pdf.length, buffer: pdf },
      { caseId: c.id, category: 'approval_document', notes: `Petty Cash Voucher — issued for ${c.controlNo}`, uploadedBy: actorId },
    );
    c.pettyCashVoucherUrl = `/filing/${doc.id}/download`;
    await this.caseRepo.save(c);
    return c.pettyCashVoucherUrl;
  }
}
