// Official MSWDO Norzagaray case documents, reproduced as generated PDFs:
//   * Certificate of Eligibility  (COE)
//   * Petty Cash Voucher          (PCV)
//
// These are the LGU paper forms the system replaces. Every filled-in value is
// sourced from the database (beneficiary, case, assistance, assigned worker and
// the admin/RSW signatory); the only fixed text is the municipal mayor stamped
// on the voucher and the statutory form wording.
//
// pdfkit's built-in Helvetica family is used so the base-14 fonts stay
// embeddable-free; money therefore renders as "Php"/plain numerals instead of
// the peso glyph (see common/pdf-format.ts).

import * as path from 'path';
import * as fs from 'fs';

const PAGE_H = 841.89;

// ---------------------------------------------------------------------------
// Shared formatting helpers
// ---------------------------------------------------------------------------

/** Plain amount with two decimals, e.g. 4500 -> "4,500.00". */
export function money(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Readable long date, e.g. "September 9, 2026". */
function longDate(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function logoPath(): string {
  // Same DSWD seal used by the GIS letterhead. Copied to dist via nest-cli
  // assets, so ../gis/assets resolves from both src (ts-jest) and dist (runtime).
  return path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
}

function drawLogo(doc: any, cx: number, y: number, size = 48): number {
  const p = logoPath();
  if (!fs.existsSync(p)) return y;
  try {
    doc.image(p, cx - size / 2, y, { fit: [size, size] });
    return y + size + 8;
  } catch {
    return y;
  }
}

// ---------------------------------------------------------------------------
// Rich text with underlined fill-in values
// ---------------------------------------------------------------------------

export interface RichSpan {
  text: string;
  /** Draw a rule under this span (used for DB-sourced fill-in values). */
  underline?: boolean;
  bold?: boolean;
}

/**
 * Lays out a run of plain/underlined spans, wrapping at `maxWidth`, and rules
 * a continuous line under every underlined run. Returns the y below the last
 * line. Underlines are merged per line so a multi-word value gets one rule.
 */
export function drawRichParagraph(
  doc: any,
  spans: RichSpan[],
  x0: number,
  y0: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
): number {
  interface Item { text: string; underline: boolean; bold: boolean; space: boolean; }
  const items: Item[] = [];
  for (const span of spans) {
    const parts = span.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const p of parts) {
      items.push({
        text: p,
        underline: !!span.underline,
        bold: !!span.bold,
        space: /^\s+$/.test(p),
      });
    }
  }

  let cx = x0;
  let cy = y0;
  let lineItems: Array<Item & { x: number; w: number }> = [];

  const flushLine = () => {
    let runStart: number | null = null;
    let runEnd = 0;
    const flushRun = () => {
      if (runStart !== null) {
        doc.moveTo(runStart, cy + fontSize + 2.5)
          .lineTo(runEnd, cy + fontSize + 2.5)
          .lineWidth(0.8).strokeColor('#111').stroke();
        runStart = null;
      }
    };
    for (const it of lineItems) {
      if (it.underline) {
        if (runStart === null) runStart = it.x;
        runEnd = it.x + it.w;
      } else {
        flushRun();
      }
    }
    flushRun();
    lineItems = [];
  };

  for (const it of items) {
    const font = it.bold ? 'Helvetica-Bold' : 'Helvetica';
    const w = doc.font(font).fontSize(fontSize).widthOfString(it.text);
    if (it.space && lineItems.length === 0) continue;
    if (!it.space && lineItems.length > 0 && cx + w > x0 + maxWidth) {
      flushLine();
      cx = x0;
      cy += lineHeight;
    }
    doc.font(font).fontSize(fontSize).fillColor('#111')
      .text(it.text, cx, cy, { lineBreak: false });
    lineItems.push({ ...it, x: cx, w });
    cx += w;
  }
  flushLine();
  return cy + lineHeight;
}

// ---------------------------------------------------------------------------
// Certificate of Eligibility
// ---------------------------------------------------------------------------

export interface CertificateOfEligibilityData {
  controlNo: string;
  officeName: string;
  /** "Dela Cruz, Juan M." — Last Name, First Name and Middle Initial. */
  beneficiaryName: string;
  /** Complete address of the beneficiary. */
  address: string;
  /** Case date created. */
  caseDate: Date | string;
  amount: number | null;
  /** Assigned social worker — printed over the "Interviewer- Designation" line. */
  interviewer: string;
  /** Admin full name; the builder appends ", RSW". */
  signatoryName: string;
}

export async function buildCertificateOfEligibilityPdf(
  data: CertificateOfEligibilityData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    info: {
      Title: `COE-${data.controlNo}`,
      Author: data.officeName,
      Subject: 'Certificate of Eligibility',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (ch: Buffer) => chunks.push(ch));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const LEFT = 60;
  const RIGHT = 535;
  const WIDTH = RIGHT - LEFT;
  const CENTER = LEFT + WIDTH / 2;

  const line = (
    text: string,
    y: number,
    opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; gap?: number } = {},
  ): number => {
    doc
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 11)
      .fillColor('#111')
      .text(text, LEFT, y, { align: opts.align ?? 'center', width: WIDTH, lineGap: opts.gap ?? 2 });
    return doc.y;
  };

  // ---- Letterhead ----
  let y = drawLogo(doc, CENTER, 42, 50);
  y = line('Republic of the Philippines', y, { size: 11 });
  y = line('Province of Bulacan', y, { size: 11 });
  y = line('Municipality of Norzagaray', y, { size: 11 });
  y = line(data.officeName.toUpperCase(), y, { size: 11.5, bold: true });
  y += 6;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(1).strokeColor('#111').stroke();
  y += 30;

  y = line('CERTIFICATE OF ELIGIBILITY', y, { size: 14, bold: true });
  y += 34;

  // ---- Body: underlined values are matched to the database ----
  const spans: RichSpan[] = [
    { text: 'This is to certify that ' },
    { text: data.beneficiaryName, underline: true },
    { text: ', residing at ' },
    { text: data.address, underline: true },
    {
      text:
        ' has been found eligible for FINANCIAL ASSISTANCE after interview and ' +
        'Records of the case dated ',
    },
    { text: longDate(data.caseDate), underline: true },
    {
      text:
        ' are at the confidential file of our MSWDO Norzagaray, Bulacan. Client ' +
        'is recommended for assistance in the amount of P',
    },
    { text: money(data.amount), underline: true },
    { text: '.' },
  ];
  y = drawRichParagraph(doc, spans, LEFT, y, WIDTH, 11, 21);

  // ---- Interviewer- Designation (right) ----
  const iw = 230;
  const ix = RIGHT - iw;
  const iy = y + 46;
  if (data.interviewer) {
    doc.font('Helvetica').fontSize(10).fillColor('#111')
      .text(data.interviewer, ix, iy - 15, { width: iw, align: 'center' });
  }
  doc.moveTo(ix, iy).lineTo(RIGHT, iy).lineWidth(0.8).strokeColor('#111').stroke();
  doc.font('Helvetica').fontSize(10).fillColor('#111')
    .text('Interviewer- Designation', ix, iy + 4, { width: iw, align: 'center' });

  // ---- Recommending Approval (lower left) ----
  const swY = PAGE_H - 150;
  doc.font('Helvetica').fontSize(10).fillColor('#111')
    .text('Recommending Approval', LEFT, swY, { width: WIDTH });
  if (data.signatoryName) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
      .text(`${data.signatoryName}, RSW`, LEFT, swY + 34, { width: WIDTH });
  }
  doc.font('Helvetica').fontSize(10).fillColor('#111')
    .text('MSWDO', LEFT, swY + 50, { width: WIDTH });

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// Petty Cash Voucher
// ---------------------------------------------------------------------------

export interface PettyCashVoucherData {
  controlNo: string;
  officeName: string;
  /** Payee — beneficiary's name. */
  payee: string;
  /** Payee address — beneficiary's complete address. */
  address: string;
  date: Date | string;
  amount: number | null;
  /** Particulars billed (service requested); falls back to "Assistance". */
  particulars: string;
  /** Fixed municipal mayor stamped as approver. */
  mayorName: string;
  mayorTitle: string;
}

export async function buildPettyCashVoucherPdf(
  data: PettyCashVoucherData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 30, left: 36, right: 36 },
    info: {
      Title: `PCV-${data.controlNo}`,
      Author: data.officeName,
      Subject: 'Petty Cash Voucher',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (ch: Buffer) => chunks.push(ch));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const LEFT = 36;
  const RIGHT = 559;
  const WIDTH = RIGHT - LEFT; // 523
  const MID = LEFT + 300; // left | right divider
  const TOP = 36;
  const LW = MID - LEFT; // 300
  const RW = RIGHT - MID; // 223

  const hline = (x1: number, x2: number, yy: number, lw = 0.8) =>
    doc.moveTo(x1, yy).lineTo(x2, yy).lineWidth(lw).strokeColor('#111').stroke();
  const vline = (x: number, y1: number, y2: number) =>
    doc.moveTo(x, y1).lineTo(x, y2).lineWidth(0.8).strokeColor('#111').stroke();
  const text = (
    value: string,
    x: number,
    yy: number,
    w: number,
    opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; gap?: number } = {},
  ) => {
    doc
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 10)
      .fillColor('#111')
      .text(value, x, yy, { width: w, align: opts.align ?? 'left', lineGap: opts.gap ?? 1 });
  };

  // Column heights (pt). Left stack defines the form height; the right stack is
  // ruled independently so its subsections keep their paper proportions.
  const H = { header: 70, payee: 24, address: 24, req: 22, thead: 20, tbody: 150, approved: 150, paid: 110, cash: 130 };
  const leftRows: number[] = [];
  let ly = TOP;
  for (const key of ['header', 'payee', 'address', 'req', 'thead', 'tbody', 'approved', 'paid'] as const) {
    ly += H[key];
    leftRows.push(ly);
  }
  const BOTTOM = ly + H.cash;

  // Outer frame + column divider.
  doc.rect(LEFT, TOP, WIDTH, BOTTOM - TOP).lineWidth(0.9).strokeColor('#111').stroke();
  vline(MID, TOP, BOTTOM);
  leftRows.forEach((yy) => hline(LEFT, MID, yy));

  // ---- Left: letterhead ----
  const lc = LEFT + LW / 2;
  text('PETTY CASH VOUCHER', LEFT, TOP + 12, LW, { size: 13, bold: true, align: 'center' });
  text('Norzagaray, Bulacan', LEFT, TOP + 34, LW, { size: 10, align: 'center' });
  text('LGU', LEFT, TOP + 48, LW, { size: 10, align: 'center' });

  // ---- Right: control block ----
  text(`No: ${data.controlNo}`, MID + 7, TOP + 8, RW - 14, { size: 9.5 });
  text(`Date: ${longDate(data.date)}`, MID + 7, TOP + 24, RW - 14, { size: 9.5 });
  text('Responsibility Center:', MID + 7, TOP + 40, RW - 14, { size: 9 });
  text(data.officeName, MID + 7, TOP + 51, RW - 14, { size: 8.5, bold: true });

  // ---- Left: payee / request ----
  const payeeY = leftRows[0];
  text(`Payee:  ${data.payee}`, LEFT + 5, payeeY + 6, LW - 10, { size: 10.5 });
  const addrY = leftRows[1];
  text(`Address:  ${data.address}`, LEFT + 5, addrY + 6, LW - 10, { size: 10.5 });
  const reqY = leftRows[2];
  text('I. To be filled up upon request', LEFT + 5, reqY + 5, LW - 10, { size: 10 });

  // ---- Left: particulars table ----
  const theadY = leftRows[3];
  const tbodyY = leftRows[4];
  const tbodyEnd = leftRows[5];
  const col1 = 115;
  const col2 = 112;
  // Column rules stop below the first data row so the trailing supporting-papers
  // note sits in open space, as on the printed form.
  vline(LEFT + col1, theadY, tbodyY + 24);
  vline(LEFT + col1 + col2, theadY, tbodyY + 24);
  text('To payment of', LEFT + 5, theadY + 5, col1 - 10, { size: 10, bold: true });
  text('Particular', LEFT + col1 + 5, theadY + 5, col2 - 10, { size: 10, bold: true });
  text('Amount', LEFT + col1 + col2 + 5, theadY + 5, LW - col1 - col2 - 10, { size: 10, bold: true, align: 'right' });
  text(data.payee, LEFT + 5, tbodyY + 6, col1 - 10, { size: 10 });
  text(data.particulars, LEFT + col1 + 5, tbodyY + 6, col2 - 10, { size: 9.5 });
  text(money(data.amount), LEFT + col1 + col2 + 5, tbodyY + 6, LW - col1 - col2 - 10, { size: 10, align: 'right' });
  text('(as per attached supporting papers...)', LEFT + 5, tbodyEnd - 18, LW - 10, { size: 9 });

  // ---- Left: approved / paid / received ----
  const apprY = leftRows[5];
  text('Approved by:', LEFT + 5, apprY + 6, LW - 10, { size: 10.5 });
  text(data.mayorName, LEFT, apprY + H.approved - 56, LW, { size: 12.5, bold: true, align: 'center' });
  text(data.mayorTitle, LEFT, apprY + H.approved - 38, LW, { size: 11, bold: true, align: 'center' });

  const paidY = leftRows[6];
  text('Paid by:', LEFT + 5, paidY + 6, LW - 10, { size: 10.5 });
  hline(lc - 95, lc + 95, paidY + 72);
  text('Disbursing Officer', lc - 95, paidY + 76, 190, { size: 10, align: 'center' });

  const cashY = leftRows[7];
  text('Cash received by:', LEFT + 5, cashY + 6, LW - 10, { size: 10.5 });
  hline(lc - 115, lc + 115, cashY + 88);
  text('Signature Over Printed Name of Payee', lc - 130, cashY + 92, 260, { size: 10, align: 'center' });

  // ---- Right: liquidation block ----
  let ry = TOP + H.header;
  const rSep = (delta: number) => {
    ry += delta;
    hline(MID, RIGHT, ry);
    return ry;
  };
  text('II. to be filled up upon liquidation', MID + 7, ry + 6, RW - 14, { size: 10 });

  const grantedY = rSep(26);
  text('Total Amount Granted', MID + 7, grantedY + 8, RW - 14, { size: 10 });
  text(money(data.amount), MID + 7, grantedY + 8, RW - 14, { size: 10, bold: true, align: 'right' });

  const paidPerY = rSep(30);
  text('Total Amount Paid per', MID + 7, paidPerY + 8, RW - 14, { size: 10 });

  const orY = rSep(30);
  text('OR No. ______________________', MID + 7, orY + 8, RW - 14, { size: 10 });

  const refY = rSep(30);
  text('Amount Refunded/', MID + 7, refY + 4, RW - 14, { size: 9.5 });

  const reimbY = rSep(22);
  text('(Reimbursed)', MID + 7, reimbY + 4, RW - 14, { size: 9.5 });

  const checksY = rSep(22);
  text('______  Received Refund', MID + 10, checksY + 8, RW - 20, { size: 9.5 });
  text('______  Reimbursement Paid', MID + 10, checksY + 30, RW - 20, { size: 9.5 });
  text('______  Disbursing Officer', MID + 10, checksY + 52, RW - 20, { size: 9.5 });

  const liqY = rSep(86);
  text('______  Liquidation Submitted:', MID + 10, liqY + 8, RW - 20, { size: 9.5 });
  text('______  Reimbursement received by:', MID + 10, liqY + 34, RW - 20, { size: 9.5 });

  // Bottom signature over printed name of payee (right column).
  const sigY = BOTTOM - 70;
  hline(MID + 30, RIGHT - 30, sigY);
  text('Signature Over Printed Name of Payee', MID + 10, sigY + 5, RW - 20, { size: 10, align: 'center' });

  doc.end();
  return done;
}
