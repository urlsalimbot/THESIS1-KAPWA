// Official MSWDO Norzagaray case documents, reproduced as generated PDFs:
//   * Certificate of Eligibility  (COE) — 21cm x 7cm landscape paper strip
//   * Petty Cash Voucher          (PCV) — 21cm x 14cm landscape paper strip
//
// Both are printed on cut strips of bond paper, so they use custom page sizes
// rather than A4. Every filled-in value is sourced from the database
// (beneficiary, case, assistance, assigned worker and the admin/RSW signatory);
// the only fixed text is the municipal mayor stamped on the voucher and the
// statutory form wording.
//
// pdfkit's built-in Helvetica family is used so the base-14 fonts stay
// embeddable-free; money therefore renders as "Php"/plain numerals instead of
// the peso glyph (see common/pdf-format.ts).

import * as path from 'path';
import * as fs from 'fs';

const CM = 28.3465; // points per centimetre
export const COE_PAGE: [number, number] = [21 * CM, 7 * CM]; // 595.28 x 198.43
export const PCV_PAGE: [number, number] = [21 * CM, 14 * CM]; // 595.28 x 396.85

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

function drawLogo(doc: any, cx: number, y: number, size = 20): number {
  const p = logoPath();
  if (!fs.existsSync(p)) return y;
  try {
    doc.image(p, cx - size / 2, y, { fit: [size, size] });
    return y + size;
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
        doc.moveTo(runStart, cy + fontSize + 1.5)
          .lineTo(runEnd, cy + fontSize + 1.5)
          .lineWidth(0.6).strokeColor('#111').stroke();
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
// Certificate of Eligibility — 21cm x 7cm landscape strip
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
    size: COE_PAGE,
    margins: { top: 8, bottom: 6, left: 22, right: 22 },
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

  const [PAGE_W, PAGE_H] = COE_PAGE;
  const LEFT = 22;
  const RIGHT = PAGE_W - 22;
  const WIDTH = RIGHT - LEFT;
  const CENTER = PAGE_W / 2;

  // ---- Letterhead ----
  drawLogo(doc, CENTER, 6, 20);
  const y = 28;
  const line = (
    text: string,
    ly: number,
    opts: { size?: number; bold?: boolean } = {},
  ): void => {
    doc
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 7)
      .fillColor('#111')
      .text(text, LEFT, ly, { align: 'center', width: WIDTH, lineBreak: false });
  };
  line('Republic of the Philippines', y, { size: 7 });
  line(data.officeName.toUpperCase(), y + 8, { size: 8.5, bold: true });
  line('Norzagaray, Bulacan', y + 17, { size: 7 });
  doc.moveTo(LEFT, y + 27).lineTo(RIGHT, y + 27).lineWidth(0.8).strokeColor('#111').stroke();

  // ---- Title ----
  line('CERTIFICATE OF ELIGIBILITY', y + 32, { size: 11, bold: true });

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
  drawRichParagraph(doc, spans, LEFT, y + 54, WIDTH, 7.5, 10.5);

  // ---- Interviewer- Designation (right) ----
  const iw = 190;
  const ix = RIGHT - iw;
  const iy = PAGE_H - 52;
  if (data.interviewer) {
    doc.font('Helvetica').fontSize(7).fillColor('#111')
      .text(data.interviewer, ix, iy - 10, { width: iw, align: 'center', lineBreak: false });
  }
  doc.moveTo(ix, iy).lineTo(RIGHT, iy).lineWidth(0.7).strokeColor('#111').stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor('#111')
    .text('Interviewer- Designation', ix, iy + 2, { width: iw, align: 'center', lineBreak: false });

  // ---- Recommending Approval (lower left) ----
  doc.font('Helvetica').fontSize(7).fillColor('#111')
    .text('Recommending Approval', LEFT, PAGE_H - 60, { lineBreak: false });
  if (data.signatoryName) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
      .text(`${data.signatoryName}, RSW`, LEFT, PAGE_H - 42, { lineBreak: false });
  }
  doc.font('Helvetica').fontSize(7).fillColor('#111')
    .text('MSWDO', LEFT, PAGE_H - 31, { lineBreak: false });

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// Petty Cash Voucher — 21cm x 14cm landscape strip
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
    size: PCV_PAGE,
    margins: { top: 10, bottom: 8, left: 14, right: 14 },
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

  const PAGE_W = PCV_PAGE[0];
  const LEFT = 14;
  const RIGHT = PAGE_W - 14;
  const WIDTH = RIGHT - LEFT;
  const MID = LEFT + 0.55 * WIDTH;
  const TOP = 10;
  const LW = MID - LEFT;
  const RW = RIGHT - MID;

  const hline = (x1: number, x2: number, yy: number, lw = 0.7) =>
    doc.moveTo(x1, yy).lineTo(x2, yy).lineWidth(lw).strokeColor('#111').stroke();
  const vline = (x: number, y1: number, y2: number) =>
    doc.moveTo(x, y1).lineTo(x, y2).lineWidth(0.7).strokeColor('#111').stroke();
  const text = (
    value: string,
    x: number,
    yy: number,
    w: number,
    opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; gap?: number } = {},
  ) => {
    doc
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opts.size ?? 7)
      .fillColor('#111')
      .text(value, x, yy, { width: w, align: opts.align ?? 'left', lineGap: opts.gap ?? 0 });
  };

  // Column heights (pt). Left stack defines the form height; the right stack is
  // ruled independently so its subsections keep their paper proportions.
  const H = { header: 46, payee: 20, address: 20, req: 16, thead: 15, tbody: 96, approved: 76, paid: 38, cash: 50 };
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
  text('PETTY CASH VOUCHER', LEFT, TOP + 7, LW, { size: 11, bold: true, align: 'center' });
  text('Norzagaray, Bulacan', LEFT, TOP + 23, LW, { size: 8, align: 'center' });
  text('LGU', LEFT, TOP + 33, LW, { size: 8, align: 'center' });

  // ---- Right: control block ----
  text(`No: ${data.controlNo}`, MID + 6, TOP + 6, RW - 12, { size: 7 });
  text(`Date: ${longDate(data.date)}`, MID + 6, TOP + 17, RW - 12, { size: 7 });
  text('Responsibility Center:', MID + 6, TOP + 28, RW - 12, { size: 6.5 });
  text(data.officeName, MID + 6, TOP + 35, RW - 12, { size: 6, bold: true });

  // ---- Left: payee / request ----
  const payeeY = leftRows[0];
  text(`Payee:  ${data.payee}`, LEFT + 5, payeeY + 5, LW - 10, { size: 8 });
  const addrY = leftRows[1];
  text(`Address:  ${data.address}`, LEFT + 5, addrY + 5, LW - 10, { size: 8 });
  const reqY = leftRows[2];
  text('I. To be filled up upon request', LEFT + 5, reqY + 4, LW - 10, { size: 7.5 });

  // ---- Left: particulars table ----
  const theadY = leftRows[3];
  const tbodyY = leftRows[4];
  const tbodyEnd = leftRows[5];
  const col1 = 120;
  const col2 = 118;
  // Column rules stop below the first data row so the trailing supporting-papers
  // note sits in open space, as on the printed form.
  vline(LEFT + col1, theadY, tbodyY + 16);
  vline(LEFT + col1 + col2, theadY, tbodyY + 16);
  text('To payment of', LEFT + 4, theadY + 4, col1 - 8, { size: 7.5, bold: true });
  text('Particular', LEFT + col1 + 4, theadY + 4, col2 - 8, { size: 7.5, bold: true });
  text('Amount', LEFT + col1 + col2 + 4, theadY + 4, LW - col1 - col2 - 8, { size: 7.5, bold: true, align: 'right' });
  text(data.payee, LEFT + 4, tbodyY + 4, col1 - 8, { size: 7 });
  text(data.particulars, LEFT + col1 + 4, tbodyY + 4, col2 - 8, { size: 6.5 });
  text(money(data.amount), LEFT + col1 + col2 + 4, tbodyY + 4, LW - col1 - col2 - 8, { size: 7, align: 'right' });
  text('(as per attached supporting papers...)', LEFT + 4, tbodyEnd - 13, LW - 8, { size: 6.5 });

  // ---- Left: approved / paid / received ----
  const apprY = leftRows[5];
  text('Approved by:', LEFT + 5, apprY + 5, LW - 10, { size: 8 });
  text(data.mayorName, LEFT, apprY + H.approved - 30, LW, { size: 9.5, bold: true, align: 'center' });
  text(data.mayorTitle, LEFT, apprY + H.approved - 19, LW, { size: 8, bold: true, align: 'center' });

  const paidY = leftRows[6];
  text('Paid by:', LEFT + 5, paidY + 5, LW - 10, { size: 8 });
  hline(lc - 80, lc + 80, paidY + 26);
  text('Disbursing Officer', lc - 80, paidY + 28, 160, { size: 7, align: 'center' });

  const cashY = leftRows[7];
  text('Cash received by:', LEFT + 5, cashY + 5, LW - 10, { size: 8 });
  hline(lc - 100, lc + 100, cashY + 34);
  text('Signature Over Printed Name of Payee', lc - 115, cashY + 36, 230, { size: 7, align: 'center' });

  // ---- Right: liquidation block (PART II) — left blank for liquidation ----
  let ry = TOP + H.header;
  const rSep = (delta: number) => {
    ry += delta;
    hline(MID, RIGHT, ry);
    return ry;
  };
  text('II. to be filled up upon liquidation', MID + 6, ry + 4, RW - 12, { size: 7.5 });

  const grantedY = rSep(14);
  text('Total Amount Granted', MID + 6, grantedY + 5, RW - 12, { size: 7.5 });

  const paidPerY = rSep(17);
  text('Total Amount Paid per', MID + 6, paidPerY + 5, RW - 12, { size: 7.5 });

  const orY = rSep(17);
  text('OR No. ______________________', MID + 6, orY + 5, RW - 12, { size: 7.5 });

  const refY = rSep(17);
  text('Amount Refunded/', MID + 6, refY + 3, RW - 12, { size: 7 });

  const reimbY = rSep(12);
  text('(Reimbursed)', MID + 6, reimbY + 3, RW - 12, { size: 7 });

  const checksY = rSep(12);
  text('______  Received Refund', MID + 8, checksY + 5, RW - 16, { size: 7 });
  text('______  Reimbursement Paid', MID + 8, checksY + 17, RW - 16, { size: 7 });
  text('______  Disbursing Officer', MID + 8, checksY + 29, RW - 16, { size: 7 });

  const liqY = rSep(47);
  text('______  Liquidation Submitted:', MID + 8, liqY + 5, RW - 16, { size: 7 });
  text('______  Reimbursement received by:', MID + 8, liqY + 17, RW - 16, { size: 7 });

  // Bottom signature over printed name of payee (right column).
  const sigY = BOTTOM - 34;
  hline(MID + 24, RIGHT - 24, sigY);
  text('Signature Over Printed Name of Payee', MID + 8, sigY + 3, RW - 16, { size: 7, align: 'center' });

  doc.end();
  return done;
}
