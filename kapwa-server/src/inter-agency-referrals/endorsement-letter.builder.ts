import { ORG_LOCATION } from '../common/constants';

// Endorsement Letter — the formal document by which MSWDO hands a beneficiary
// to a partner agency. It is the referral: issuing it records the inter-agency
// referral and the printed letter is the paper the owning agency carries.
//
// Text-only letterhead (office name + location block + rule) rather than the
// seal images used by the summary report: it keeps the built artefact
// self-contained and avoids wiring image assets into the build for one page.
// Everything else follows the official layout conventions from the other
// builders (A4, 24pt margins, ORG_LOCATION from common/constants).

export interface EndorsementLetterData {
  officeName: string;
  letterNo: string;
  dateLabel: string;
  toAgencyName: string;
  beneficiaryName: string;
  caseCategory?: string;
  reason: string;
  legalBasis?: string;
  notes?: string;
  preparedBy: string;
  preparedByRole?: string;
}

export async function buildEndorsementLetterPdf(data: EndorsementLetterData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 56, right: 56 },
    info: {
      Title: `ENDORSEMENT-${data.letterNo}`,
      Author: data.officeName,
      Subject: 'Endorsement Letter',
    },
  });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));

  const W = doc.page.width - 56 * 2;
  const center = (text: string, y: number, size: number, bold = true) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).text(text, 56, y, { width: W, align: 'center' });
  };

  // ---- Letterhead ----
  center('Republic of the Philippines', 48, 11, false);
  center(`Province of ${ORG_LOCATION.province}`, 61, 11, false);
  center(`Municipality of ${ORG_LOCATION.municipality}`, 74, 11, false);
  doc.moveTo(56, 94).lineTo(56 + W, 94).lineWidth(2).stroke();
  doc.moveTo(56, 96).lineTo(56 + W, 96).lineWidth(0.5).stroke();
  center(data.officeName, 104, 16, true);
  center('ENDORSEMENT LETTER', 130, 13, true);

  // ---- Reference / date ----
  doc.font('Helvetica').fontSize(10);
  doc.text(`Ref. No.: ${data.letterNo}`, 56, 156);
  doc.text(data.dateLabel, 56 + W - 100, 156, { width: 100, align: 'right' });

  // ---- Recipient + subject ----
  doc.font('Helvetica-Bold').fontSize(11).text('To:', 56, 186);
  doc.font('Helvetica-Bold').fontSize(11).text(data.toAgencyName, 92, 186);
  doc.font('Helvetica').fontSize(11).text(`Subject: ${data.reason}`, 56, 208);

  // ---- Body ----
  const body = doc.y + 24;
  const greet = 'Sir/Madam:';
  const para1 =
    `In connection with the case of ${data.beneficiaryName}` +
    (data.caseCategory ? ` (${data.caseCategory})` : '') +
    `, this Office endorses the above-named client to your agency for the reason stated above.`;
  const para2 =
    `Please extend the necessary assistance. Rest assured that this Office will continue to provide the appropriate `
    + 'social welfare services to the client and will gladly coordinate with your agency towards this end.';
  const para3 = 'Thank you for your usual support and kind consideration of this endorsement.';
  doc.font('Helvetica').fontSize(11).text(`${greet}\n\n${para1}\n\n${para2}\n\n${para3}`, 56, body, { width: W, align: 'left' });

  // ---- Notes ----
  if (data.notes) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(10).text('Notes:');
    doc.font('Helvetica').fontSize(10).text(data.notes, { width: W });
  }

  // ---- Signature block ----
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(10).text('Very truly yours,', { align: 'right', width: W });
  doc.moveDown(3.4);
  doc.text(data.preparedBy.toUpperCase(), { align: 'right', width: W });
  if (data.preparedByRole) {
    doc.font('Helvetica').fontSize(10).text(data.preparedByRole, { align: 'right', width: W });
  }

  // ---- Footer ----
  doc.font('Helvetica').fontSize(9).fillColor('#555555');
  doc.text(
    `${data.officeName} · ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`,
    doc.page.width / 2 - 130,
    doc.page.height - 32,
    { width: 260, align: 'center' },
  );

  doc.end();
  return done;
}