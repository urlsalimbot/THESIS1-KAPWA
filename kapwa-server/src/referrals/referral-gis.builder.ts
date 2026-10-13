/**
 * GIS-style intake sheet for a coordinator referral — the "imitate the GIS"
 * half of the referral expansion. Same letterhead conventions as the case GIS
 * sheets (gis-pdf.builder), boxed client + referral sections, scaled to what a
 * referral carries: control number, barangay, person identity, category, reason.
 */

export interface ReferralGisPersonData {
  surname: string;
  firstName: string;
  middleName?: string;
  extension?: string;
  sex: string;
  dob?: string;
  phone?: string;
  addressLine?: string;
}

export interface ReferralGisData {
  controlNo: string;
  dateLabel: string;
  barangay: string;
  status: string;
  caseCategory?: string | null;
  reason: string;
  referredBy: string;
  person: ReferralGisPersonData;
}

const ORG_LOCATION = { province: 'Bulacan', municipality: 'Norzagaray' };

export async function buildReferralGisPdf(data: ReferralGisData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 56, right: 56 },
    info: {
      Title: `RFRL-${data.controlNo}`,
      Author: 'MSWDO Norzagaray',
      Subject: 'Referral — General Intake Sheet',
    },
  });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));

  const W = doc.page.width - 56 * 2;
  const center = (text: string, y: number, size: number, bold = true) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(text, 56, y, { width: W, align: 'center' });
  };
  const box = (y: number, label: string, value: string, h = 26) => {
    doc.font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), 62, y + 4);
    doc.font('Helvetica').fontSize(10).text(value || '—', 62, y + 15, { width: W - 12 });
    doc.rect(56, y, W, h).lineWidth(0.5).stroke();
  };

  // ---- Letterhead (same voice as the case GIS) ----
  center('Republic of the Philippines', 48, 11, false);
  center(`Province of ${ORG_LOCATION.province}`, 61, 11, false);
  center(`Municipality of ${ORG_LOCATION.municipality}`, 74, 11, false);
  doc.moveTo(56, 94).lineTo(56 + W, 94).lineWidth(2).stroke();
  doc.moveTo(56, 96).lineTo(56 + W, 96).lineWidth(0.5).stroke();
  center('Municipal Social Welfare and Development Office', 104, 13, true);
  center('GENERAL INTAKE SHEET — REFERRAL', 122, 12, true);

  // ---- Reference row ----
  doc.font('Helvetica').fontSize(10);
  doc.text(`Control No.: ${data.controlNo}`, 56, 140);
  doc.text(data.dateLabel, 56 + W - 110, 140, { width: 110, align: 'right' });
  doc.text(`Barangay: ${data.barangay}`, 56, 154);
  doc.text(`Status: ${data.status.toUpperCase()}`, 56 + W - 110, 154, { width: 110, align: 'right' });

  // ---- Client section ----
  doc.font('Helvetica-Bold').fontSize(9).text('I. CLIENT INFORMATION', 56, 176);
  let y = 188;
  box(y, 'Surname', data.person.surname);
  y += 30;
  box(y, 'First Name', data.person.firstName);
  y += 30;
  box(y, 'Middle Name', data.person.middleName || '');
  y += 30;
  // Sex + birthdate share one row.
  doc.font('Helvetica-Bold').fontSize(8).text('SEX', 62, y + 4);
  doc.font('Helvetica').fontSize(10).text(data.person.sex || '—', 70, y + 15);
  doc.font('Helvetica-Bold').fontSize(8).text('DATE OF BIRTH', 130, y + 4);
  doc.font('Helvetica').fontSize(10).text(data.person.dob || '—', 200, y + 15);
  doc.rect(56, y, W, 26).lineWidth(0.5).stroke();
  y += 30;
  box(y, 'Contact Number', data.person.phone || '', 26);
  y += 30;
  box(y, 'Address', data.person.addressLine || '', 26);

  // ---- Referral section ----
  y += 10;
  doc.font('Helvetica-Bold').fontSize(9).text('II. REFERRAL DETAILS', 56, y);
  y += 12;
  box(y, 'Case Category', data.caseCategory || '', 26);
  y += 30;
  box(y, 'Reason for Referral', data.reason, 60);
  y += 64;
  box(y, 'Referred By', `${data.referredBy} (Barangay ${data.barangay})`, 26);

  // ---- Footer ----
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(10).text('Prepared by:', 56);
  doc.moveDown(2.6);
  doc.font('Helvetica').fontSize(10).text('MSWDO Norzagaray', 56);

  doc.end();
  return done;
}