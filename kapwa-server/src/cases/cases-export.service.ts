import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from './case.entity';
import { CaseHistory } from './case-history.entity';
import { CaseIntervention } from '../case-interventions/case-intervention.entity';

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
  ) {}

  async generateCsrPdf(caseId: string): Promise<Buffer> {
    const c = await this.caseRepo.findOne({
      where: { id: caseId },
      relations: ['beneficiary', 'beneficiary.person', 'beneficiary.household', 'assignedWorker'],
    });
    if (!c) throw new NotFoundException('Case not found');

    const history = await this.historyRepo.find({
      where: { caseId },
      order: { createdAt: 'ASC' },
    });

    const interventions = await this.interventionRepo.find({
      where: { caseId },
      order: { deliveryDate: 'ASC', createdAt: 'ASC' },
    });

    const statusLabels: Record<string, string> = {
      enrolled: 'Enrolled',
      assessed: 'Assessed',
      in_review: 'In Review',
      active: 'Active',
      transitioning: 'Transitioning',
      closed: 'Closed',
    };

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `CSR-${c.controlNo}`,
        Author: 'MSWDO Norzagaray',
        Subject: 'Case Study Report',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const ben = c.beneficiary;
    const person = ben?.person;
    const household = ben?.household;

    const pageWidth = 545;
    const leftMargin = 50;
    const y0 = doc.y;
    const col1X = leftMargin;
    const col2X = leftMargin + 260;

    function header(label: string, value: string, x: number = col1X, y?: number) {
      const pos = y ?? doc.y;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#666').text(label, x, pos, { continued: false });
      doc.fontSize(9).font('Helvetica').fillColor('#111').text(value || '—', x, doc.y + 1);
      doc.moveDown(0.3);
    }

    function sectionTitle(title: string) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a').text(title);
      doc.moveTo(leftMargin, doc.y).lineTo(pageWidth, doc.y).strokeColor('#ccc').stroke();
      doc.moveDown(0.3);
      doc.fillColor('#111');
    }

    // === HEADER ===
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a1a').text('CASE STUDY REPORT', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#555').text('MSWDO Norzagaray, Bulacan', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#888').text(`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });
    doc.moveDown(0.5);

    // === REPORT INFORMATION (two-column) ===
    doc.roundedRect(leftMargin, doc.y, pageWidth - leftMargin, 100, 4).strokeColor('#ddd').stroke();
    const boxTop = doc.y + 5;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a1a').text(`CSR-${c.controlNo}`, leftMargin + 10, boxTop + 5);
    doc.fontSize(8).font('Helvetica').fillColor('#888').text('Case Study Report', leftMargin + 10, doc.y + 1);

    // Two-column data inside the box
    const leftEntries = [
      { label: 'Case No.', value: c.controlNo },
      { label: 'Status', value: statusLabels[c.status] || c.status },
      { label: 'Date Created', value: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-PH') : '—' },
      { label: 'Date Closed', value: c.closureDate ? new Date(c.closureDate).toLocaleDateString('en-PH') : '—' },
    ];
    const rightEntries = [
      { label: 'Beneficiary', value: person ? `${person.firstName || ''} ${person.surname || ''}`.trim() : '—' },
      { label: 'Barangay', value: household?.barangay || person?.address || '—' },
      { label: 'Assigned Worker', value: c.assignedWorker?.fullName || '—' },
      { label: 'Closure Outcome', value: c.closureOutcome ? c.closureOutcome.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '—' },
    ];

    doc.fontSize(8).fillColor('#444');
    leftEntries.forEach((e, i) => {
      doc.font('Helvetica-Bold').text(e.label, leftMargin + 10, boxTop + 28 + i * 16);
      doc.font('Helvetica').text(`: ${e.value}`, leftMargin + 65, boxTop + 28 + i * 16);
    });
    rightEntries.forEach((e, i) => {
      doc.font('Helvetica-Bold').text(e.label, leftMargin + 270, boxTop + 28 + i * 16);
      doc.font('Helvetica').text(`: ${e.value}`, leftMargin + 335, boxTop + 28 + i * 16);
    });

    doc.y = boxTop + 105;

    // === 1. BENEFICIARY INFORMATION ===
    sectionTitle('1. Beneficiary Information');

    doc.fontSize(9).fillColor('#444');
    const benLeft = [
      { label: 'Full Name', value: person ? `${person.firstName || ''} ${person.middleName || ''} ${person.surname || ''}`.trim() : '—' },
      { label: 'Date of Birth', value: person?.dob ? new Date(person.dob).toLocaleDateString('en-PH') : '—' },
      { label: 'Gender', value: person?.gender || '—' },
      { label: 'Civil Status', value: person?.civilStatus || '—' },
      { label: 'Contact No.', value: person?.phone || '—' },
    ];
    const benRight = [
      { label: 'Address', value: person?.address || '—' },
      { label: 'Barangay', value: household?.barangay || person?.address?.split(',').pop()?.trim() || '—' },
      { label: 'Estimated Income', value: household?.estimatedIncome ? `₱${Number(household.estimatedIncome).toLocaleString()}/mo` : '—' },
      { label: 'Access Card', value: ben?.accessCardCode || '—' },
      { label: 'Philsys #', value: person?.philsysNumber || '—' },
    ];

    benLeft.forEach((e) => { header(e.label, e.value, col1X); });
    const maxBenY = doc.y;
    doc.y = y0 + 48;
    benRight.forEach((e) => { header(e.label, e.value, col2X); });
    doc.y = Math.max(maxBenY, doc.y);

    // === 2. ASSESSMENT SUMMARY ===
    sectionTitle('2. Assessment Summary');

    const assessFields = [
      { label: 'Problems Presented', value: c.problemsPresented },
      { label: 'Social Worker Assessment', value: c.socialWorkerAssessment },
      { label: 'Client Category', value: c.clientCategory },
      { label: 'FRVA Score', value: c.frvaScore != null ? String(c.frvaScore) : '—' },
      { label: 'SWDI Score', value: c.swdiScore != null ? String(c.swdiScore) : '—' },
      { label: 'Nature of Service', value: (c.natureOfService as string[])?.join(', ') || '—' },
      { label: 'Amount of Assistance', value: c.amountAssistance != null ? `₱${Number(c.amountAssistance).toLocaleString()}` : '—' },
      { label: 'Mode of Financial Assistance', value: c.modeFinancialAssistance || '—' },
      { label: 'Source of Fund', value: c.sourceOfFund || '—' },
      { label: 'Interviewed By', value: c.interviewedBy || '—' },
      { label: 'Family Dialogue Notes', value: c.familyDialogueNotes },
    ];

    assessFields.forEach((f) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text(f.label, leftMargin, doc.y);
      doc.fontSize(9).font('Helvetica').fillColor('#111').text(f.value || '—', leftMargin + 120, doc.y - 11, { width: pageWidth - leftMargin - 120 });
      doc.moveDown(0.2);
    });

    // === 3. INTERVENTIONS ===
    sectionTitle('3. Interventions Delivered');

    if (interventions.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#888').text('No interventions recorded.', leftMargin, doc.y);
      doc.moveDown(0.5);
    } else {
      const tableTop = doc.y;
      const colWidths = [25, 140, 80, 80, 60, 70];
      const headers3 = ['#', 'Service Name', 'Delivery Date', 'Category', 'Amount', 'Mode'];

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff');
      let hx = leftMargin;
      doc.roundedRect(leftMargin - 2, tableTop, pageWidth - leftMargin + 4, 16, 3).fillColor('#2563eb').fill();
      doc.fillColor('#fff');
      headers3.forEach((h, i) => {
        doc.text(h, hx + 4, tableTop + 3, { width: colWidths[i] });
        hx += colWidths[i];
      });

      doc.fillColor('#111');
      interventions.forEach((iv, i) => {
        const rowY = tableTop + 18 + i * 16;
        if (rowY > 720) {
          doc.addPage();
          doc.y = 50;
        }
        const cy = doc.y > tableTop + 18 ? doc.y : tableTop + 18 + i * 16;
        if (i % 2 === 0) {
          doc.rect(leftMargin - 2, cy - 2, pageWidth - leftMargin + 4, 16).fillColor('#f8fafc').fill();
        }
        doc.fillColor('#111').fontSize(8).font('Helvetica');
        let dx = leftMargin;
        const vals3 = [
          String(i + 1),
          iv.serviceName || '—',
          iv.deliveryDate ? new Date(iv.deliveryDate).toLocaleDateString('en-PH') : '—',
          iv.category || '—',
          iv.amount != null ? `₱${Number(iv.amount).toLocaleString()}` : '—',
          iv.modeOfDelivery || '—',
        ];
        vals3.forEach((v, j) => {
          doc.text(v, dx + 3, cy, { width: colWidths[j] });
          dx += colWidths[j];
        });
        doc.y = cy + 16;
      });
      doc.moveDown(0.5);
    }

    // === 4. TRANSITION PLAN ===
    sectionTitle('4. Transition & Sustainability');

    const transitionFields = [
      { label: 'Self-Reliance Level', value: c.selfRelianceLevel != null ? `Level ${c.selfRelianceLevel}` : '—' },
      { label: 'Sustainability Plan', value: c.sustainabilityPlan },
      { label: 'Transition Date', value: c.transitionDate ? new Date(c.transitionDate).toLocaleDateString('en-PH') : '—' },
      { label: 'Service Requested', value: (c.serviceRequested as string[])?.join(', ') || '—' },
    ];
    transitionFields.forEach((f) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text(f.label, leftMargin, doc.y);
      doc.fontSize(9).font('Helvetica').fillColor('#111').text(f.value || '—', leftMargin + 120, doc.y - 11, { width: pageWidth - leftMargin - 120 });
      doc.moveDown(0.2);
    });

    // === 5. CASE HISTORY TIMELINE ===
    sectionTitle('5. Case History Timeline');

    if (history.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#888').text('No history recorded.', leftMargin, doc.y);
      doc.moveDown(0.5);
    } else {
      history.forEach((h) => {
        const fromLabel = h.fromStatus ? statusLabels[h.fromStatus] || h.fromStatus : '—';
        const toLabel = statusLabels[h.toStatus] || h.toStatus;
        const dateStr = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-PH') : '—';

        if (doc.y > 730) doc.addPage();

        doc.circle(leftMargin + 5, doc.y + 4, 3).fillColor('#2563eb').fill();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#111').text(`${fromLabel} → ${toLabel}`, leftMargin + 14, doc.y - 7);
        doc.fontSize(8).font('Helvetica').fillColor('#888').text(`${dateStr}${h.changedByRole ? ` · ${h.changedByRole.replace(/_/g, ' ')}` : ''}`, leftMargin + 14, doc.y + 2);
        doc.moveDown(0.5);
        if (h.remarks) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666').text(h.remarks, leftMargin + 14, doc.y);
          doc.moveDown(0.2);
        }
      });
      doc.moveDown(0.3);
    }

    // === 6. CLOSURE DETAILS ===
    sectionTitle('6. Closure Details');

    const closureFields = [
      { label: 'Closure Outcome', value: c.closureOutcome ? c.closureOutcome.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '—' },
      { label: 'Closure Date', value: c.closureDate ? new Date(c.closureDate).toLocaleDateString('en-PH') : '—' },
      { label: 'Exit Notes', value: c.exitNotes },
      { label: 'Certificate URL', value: c.certificateUrl || '—' },
      { label: 'Petty Cash Voucher', value: c.pettyCashVoucherUrl || '—' },
    ];
    closureFields.forEach((f) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#555').text(f.label, leftMargin, doc.y);
      doc.fontSize(9).font('Helvetica').fillColor('#111').text(f.value || '—', leftMargin + 120, doc.y - 11, { width: pageWidth - leftMargin - 120 });
      doc.moveDown(0.2);
    });

    // === 7. CERTIFICATION ===
    if (doc.y > 680) doc.addPage();
    sectionTitle('7. Certification');

    doc.fontSize(9).font('Helvetica').fillColor('#444');
    doc.text('This certifies that the above-named beneficiary has been served through the Comprehensive Case Management Program of the MSWDO Norzagaray, Bulacan.', {
      align: 'justify',
    });
    doc.moveDown(1);

    doc.fontSize(9).font('Helvetica');
    doc.text(`Prepared by: ${c.interviewedBy || c.assignedWorkerName || c.assignedWorker?.fullName || '—'}`, leftMargin, doc.y);
    doc.text(`Date: ${c.closureDate ? new Date(c.closureDate).toLocaleDateString('en-PH') : new Date().toLocaleDateString('en-PH')}`, leftMargin, doc.y + 4);
    doc.moveDown(1);

    doc.moveTo(leftMargin, doc.y).lineTo(300, doc.y).strokeColor('#999').stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#888').text('Signature of Social Worker / Case Officer', leftMargin, doc.y + 2);

    doc.moveDown(2.5);

    doc.moveTo(leftMargin, doc.y).lineTo(300, doc.y).strokeColor('#999').stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#888').text('Client / Claimant Signature', leftMargin, doc.y + 2);

    // Footer
    const pgRange = doc.bufferedPageRange();
    const count = pgRange?.count ?? 1;
    const first = pgRange?.start ?? 1;
    for (let i = first; i < first + count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font('Helvetica').fillColor('#aaa');
      doc.text(`CSR-${c.controlNo} | Page ${i} of ${first + count - 1} | MSWDO Norzagaray`, leftMargin, 780, { align: 'center' });
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdf = Buffer.concat(buffers);
        this.logger.log(`CSR PDF generated: ${c.controlNo}, ${pdf.length} bytes`);
        resolve(pdf);
      });
    });
  }
}
