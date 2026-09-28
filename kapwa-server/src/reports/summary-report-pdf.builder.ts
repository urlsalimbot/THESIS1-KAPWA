import * as path from 'path';
import * as fs from 'fs';
import { CaseListRow, ReportColumn, SummaryReportData, SummaryTable } from './summary-report.types';

const PAGE: [number, number] = [841.89, 595.28]; // A4 landscape
const M = 28;
const LEFT = M;
const RIGHT = PAGE[0] - M;
const WIDTH = RIGHT - LEFT;

const CASE_COLS = [
  { key: 'no', label: 'No.', w: 0.03 },
  { key: 'date', label: 'Date', w: 0.07 },
  { key: 'surname', label: 'SURNAME', w: 0.12 },
  { key: 'firstName', label: 'FIRST NAME', w: 0.12 },
  { key: 'middleName', label: 'MIDDLE NAME', w: 0.11 },
  { key: 'gender', label: 'GENDER', w: 0.06 },
  { key: 'clientCategory', label: 'CLIENT CATEGORY', w: 0.27 },
  { key: 'barangay', label: 'Barangay', w: 0.10 },
  { key: 'intervention', label: 'Intervention/Remarks', w: 0.12 },
] as const;

const CLIENTS = ['CEDC', 'WEDC', 'PWD', 'SR. CITIZEN', 'INDIGENT', '4Ps', 'IP'] as const;

export async function buildSummaryReportPdf(data: SummaryReportData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: PAGE, margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Summary Report ${data.year} Q${data.quarter}`, Author: data.officeName, Subject: 'GAD Database Case Tracker' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, data, true);
  drawTitle(doc, data.annual.title, `GAD DATABASE CASE TRACKER`);
  drawGroupedTable(doc, data.annual, data.columns);

  doc.addPage();
  drawLetterhead(doc, data, false);
  drawTitle(doc, `${data.year}`, `${ordinal(data.quarter)} QUARTER REPORT`);
  data.monthly.forEach((m) => { drawSectionTitle(doc, m.title); drawGroupedTable(doc, m, data.columns); });
  drawSectionTitle(doc, data.quarterSummary.title);
  drawGroupedTable(doc, data.quarterSummary, data.columns);
  drawSignatories(doc, data);

  doc.addPage();
  drawLetterhead(doc, data, false);
  drawTitle(doc, 'GAD DATABASE CASE LIST', '');
  drawCaseList(doc, data.caseList);

  doc.end();
  return done;
}

function ordinal(q: number): string { return ['1st', '2nd', '3rd', '4th'][q - 1] ?? `${q}th`; }

function drawLetterhead(doc: any, data: SummaryReportData, full: boolean) {
  // Municipal seal (left) + DSWD seal (right) framing the letterhead, guarded
  // so a missing asset never breaks the report.
  const sealPath = path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png');
  const dswdPath = path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
  if (fs.existsSync(sealPath)) { try { doc.image(sealPath, LEFT, 20, { fit: [46, 46] }); } catch { /* seal omitted */ } }
  if (fs.existsSync(dswdPath)) { try { doc.image(dswdPath, RIGHT - 46, 20, { fit: [46, 46] }); } catch { /* seal omitted */ } }

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111');
  if (full) {
    doc.text('Republic of the Philippines', LEFT, M, { width: WIDTH, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text('Province of Bulacan', LEFT, M + 11, { width: WIDTH, align: 'center', lineBreak: false });
    doc.text('Municipality of Norzagaray', LEFT, M + 21, { width: WIDTH, align: 'center', lineBreak: false });
  } else {
    doc.text('Municipality of Norzagaray', LEFT, M, { width: WIDTH, align: 'center', lineBreak: false });
  }
  const officeY = full ? M + 32 : M + 12;
  doc.font('Helvetica-Bold').fontSize(8.5)
    .text(data.officeName.toUpperCase(), LEFT, officeY, { width: WIDTH, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(7.5)
    .text(`ACCOMPLISHMENT REPORT (Services) ${data.year}`, LEFT, officeY + 10, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y = officeY + 24;
}

function drawTitle(doc: any, line1: string, line2: string) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111')
    .text(line1, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y += 20;
  if (line2) {
    doc.font('Helvetica-Bold').fontSize(11)
      .text(line2, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
    doc.y += 20;
  }
}

function drawSectionTitle(doc: any, title: string) {
  doc.y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(title, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y += 14;
}

// ---------------------------------------------------------------------------
// Program-driven grouped table (pages 1–2)
// ---------------------------------------------------------------------------

function colWeight(c: ReportColumn): number {
  if (c.key === 'TOTAL' || c.key === 'UNASSIGNED') return 18;
  if (c.band === 'SEX') return 9;
  // Cap program columns so name-length never starves UNASSIGNED/TOTAL into
  // unreadable slivers (labels wrap/ellipsise within their cell instead).
  return Math.min(5 + c.label.length, 10);
}

function drawGroupedTable(doc: any, table: SummaryTable, columns: ReportColumn[]) {
  const topOfTable = doc.y;
  const weights = columns.map(colWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  // Reference GAD header matrix:
  //   R1  SEX | FINANCIAL | (blank) | LEGAL | TECHNICAL
  //   R2  (blank) | FINANCIAL ASSISTANCE | PWD | REFERRAL | Birth Discrepancy ...
  //   R3  Male | Female | BURIAL | MEDICAL | ASSISTIVE DEVICES | (PWD blank) |
  //       LEGAL/PAO | OTHERS | (technical blanks) | TOTAL
  const tierH = [13, 14, 12];
  const headerH = tierH[0] + tierH[1] + tierH[2];
  const headerBottom = topOfTable + headerH;
  const R1top = topOfTable;
  const R2top = topOfTable + tierH[0];
  const R3top = topOfTable + tierH[0] + tierH[1];

  // R3-anchored columns: MALE/FEMALE and the sub-band columns (BURIAL,
  // MEDICAL, ASSISTIVE DEVICES, LEGAL/PAO, OTHERS). Everything else — PWD,
  // TECHNICAL columns, UNASSIGNED, TOTAL — anchors at R2 spanning two rows.
  const row3 = (c: ReportColumn) => c.key === 'MALE' || c.key === 'FEMALE' || !!c.subBand;

  // Grid: outer frame, horizontal tier rules, full-height column rules.
  doc.rect(LEFT, topOfTable, WIDTH, headerH).lineWidth(0.6).strokeColor('#111').stroke();
  doc.moveTo(LEFT, topOfTable + tierH[0]).lineTo(RIGHT, topOfTable + tierH[0]).lineWidth(0.6).strokeColor('#111').stroke();
  doc.moveTo(LEFT, topOfTable + tierH[0] + tierH[1]).lineTo(RIGHT, topOfTable + tierH[0] + tierH[1]).lineWidth(0.6).strokeColor('#111').stroke();
  for (let k = 1; k < columns.length; k++) {
    doc.moveTo(colX[k], topOfTable).lineTo(colX[k], headerBottom).lineWidth(0.6).strokeColor('#111').stroke();
  }

  // R1: band captions, centred over the band's sub-band group when one exists
  // (FINANCIAL over BURIAL..ASSISTIVE, LEGAL over PAO/OTHERS).
  const bands: string[] = [];
  for (const c of columns) { if (c.band && !bands.includes(c.band)) bands.push(c.band); }
  for (const b of bands) {
    const idx = columns.map((c, i) => (c.band === b ? i : -1)).filter((i) => i >= 0);
    const subIdx = columns.map((c, i) => (c.band === b && c.subBand ? i : -1)).filter((i) => i >= 0);
    const [s, e] = subIdx.length ? [subIdx[0], subIdx[subIdx.length - 1]] : [idx[0], idx[idx.length - 1]];
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#111')
      .text(b, colX[s] + 2, R1top + 3, { width: colX[e + 1] - colX[s] - 4, align: 'center', lineBreak: false });
  }

  // R2: sub-band captions (once per sub-band) + R2-anchored column labels.
  const subs: string[] = [];
  for (const c of columns) { if (c.subBand && !subs.includes(c.subBand)) subs.push(c.subBand); }
  for (const sb of subs) {
    const idx = columns.map((c, i) => (c.subBand === sb ? i : -1)).filter((i) => i >= 0);
    doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#111')
      .text(sb, colX[idx[0]] + 1, R2top + 3, { width: colX[idx[idx.length - 1] + 1] - colX[idx[0]] - 2, align: 'center', lineBreak: false });
  }
  columns.forEach((c, i) => {
    if (row3(c)) return;
    const cellW = colX[i + 1] - colX[i] - 2;
    const size = c.label.length > 12 ? 4.6 : c.label.length > 9 ? 5.2 : 6;
    wrapLabelLines(doc, c.label, cellW, size, 2).forEach((ln, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(ln, colX[i] + 1, R2top + 3 + li * (size + 1.2), { width: cellW, align: 'center', lineBreak: false });
    });
  });

  // R3: row-3-anchored column labels.
  columns.forEach((c, i) => {
    if (!row3(c)) return;
    const cellW = colX[i + 1] - colX[i] - 2;
    const size = c.label.length > 12 ? 4.6 : c.label.length > 9 ? 5.2 : 6;
    wrapLabelLines(doc, c.label, cellW, size, 2).forEach((ln, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(ln, colX[i] + 1, R3top + 3 + li * (size + 1.2), { width: cellW, align: 'center', lineBreak: false });
    });
  });

  // Single data row.
  const rowH = 20;
  const rowY = topOfTable + headerH;
  doc.rect(LEFT, rowY, WIDTH, rowH).lineWidth(0.6).strokeColor('#111').stroke();
  columns.forEach((c, i) => {
    let value = '';
    if (c.key === 'MALE') value = String(table.counts.male);
    else if (c.key === 'FEMALE') value = String(table.counts.female);
    else if (c.key === 'TOTAL') value = String(table.counts.total);
    else value = String(table.counts.byColumn[c.key] ?? 0);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
      .text(value, colX[i] + 1, rowY + 5, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
  });
  doc.y = rowY + rowH + 6;
}

function drawSignatories(doc: any, data: SummaryReportData) {
  // Anchor the block once — every line is positioned relative to this, never
  // to the mutating doc.y (which pushed the right half off the page).
  const top = doc.y + 18;
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Prepared by:', LEFT + 10, top, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.preparedBy, LEFT + 10, top + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.preparedByRole, LEFT + 10, top + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Noted by:', LEFT + WIDTH / 2, top, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.notedBy, LEFT + WIDTH / 2, top + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.notedByRole, LEFT + WIDTH / 2, top + 38, { lineBreak: false });
  doc.y = top + 50;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Word-wrap `text` into at most `maxLines` lines at `size`. Lines that still
// exceed `maxWidth` after wrapping are truncated with an ellipsis so narrow
// columns never overflow into their neighbours.
function wrapLabelLines(doc: any, text: string, maxWidth: number, size: number, maxLines: number): string[] {
  doc.font('Helvetica-Bold').fontSize(size);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (cur && doc.widthOfString(candidate) > maxWidth && lines.length < maxLines) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  // No silent word drops: if the cap was reached mid-wrap, tail-join the
  // remaining words onto the last line (the ellipsis floor below trims it).
  else if (cur && lines.length > 0) lines[lines.length - 1] += ` ${cur}`;
  // Ellipsis floor: keep every emitted line inside the column.
  return lines.map((ln) => {
    if (doc.widthOfString(ln) <= maxWidth) return ln;
    let out = ln;
    while (out.length > 1 && doc.widthOfString(out + '…') > maxWidth) out = out.slice(0, -1);
    return out.slice(0, Math.max(0, out.length)) + '…';
  });
}

// ---------------------------------------------------------------------------
// Case list (page 3+)
// ---------------------------------------------------------------------------

function drawCaseList(doc: any, rows: CaseListRow[]) {
  const weights = CASE_COLS.map((c) => c.w);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  const headerH = 26;
  const rowH = 15;

  const drawHeader = (top: number) => {
    doc.rect(LEFT, top, WIDTH, headerH).lineWidth(0.6).strokeColor('#111').stroke();
    CASE_COLS.forEach((c, i) => {
      doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#111')
        .text(c.label, colX[i] + 1, top + 4, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
    });
  };

  let top = doc.y;
  drawHeader(top);
  let y = top + headerH;

  for (const r of rows) {
    if (y + rowH > PAGE[1] - M - 20) {
      doc.addPage();
      top = M + 20;
      drawHeader(top);
      y = top + headerH;
    }
    doc.rect(LEFT, y, WIDTH, rowH).lineWidth(0.4).strokeColor('#444').stroke();
    const cells = [
      String(r.no), r.date, r.surname, r.firstName, r.middleName,
      r.gender, '', r.barangay, r.intervention,
    ];
    cells.forEach((v, i) => {
      if (i === 6) return; // client category drawn as ticks
      doc.font('Helvetica').fontSize(6.4).fillColor('#111')
        .text(v, colX[i] + 2, y + 4, { width: colX[i + 1] - colX[i] - 4, lineBreak: false, ellipsis: true });
    });
    const flags = [r.categories.cedc, r.categories.wedc, r.categories.pwd, r.categories.senior, r.categories.indigent, r.categories.fourPs, r.categories.ip];
    const catX = colX[6];
    const catW = colX[7] - colX[6];
    const step = catW / CLIENTS.length;
    CLIENTS.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#111')
        .text(label, catX + i * step + 1, y + 2, { width: step - 2, align: 'center', lineBreak: false });
      if (flags[i]) {
        doc.font('Helvetica').fontSize(7).fillColor('#111')
          .text('/', catX + i * step + step / 2 - 2, y + 7, { lineBreak: false });
      }
    });
    y += rowH;
  }
  doc.y = y;
}