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
  const wide = columns.length > 24; // production-sized catalogues: skip the
  // sub-band row — per-column 'FINANCIAL ASSISTANCE' labels would repeat into
  // narrow non-adjacent cells and overflow onto neighbours.
  const weights = columns.map(colWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  const tierH = [13, 13, 15];
  const headerH = tierH[0] + tierH[1] + tierH[2];

  // Tier 1: bands (merged per distinct band; empty band = no cell).
  const bandOrder: string[] = [];
  for (const c of columns) { if (c.band && !bandOrder.includes(c.band)) bandOrder.push(c.band); }
  const bandStart: Record<string, number> = {};
  const bandEnd: Record<string, number> = {};
  columns.forEach((c, i) => {
    if (!c.band) return;
    if (bandStart[c.band] === undefined) bandStart[c.band] = i;
    bandEnd[c.band] = i;
  });
  for (const b of bandOrder) {
    const x1 = colX[bandStart[b]];
    const x2 = colX[bandEnd[b] + 1];
    doc.rect(x1, topOfTable, x2 - x1, tierH[0]).lineWidth(0.6).strokeColor('#111').stroke();
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#111')
      .text(b, x1 + 2, topOfTable + 3, { width: x2 - x1 - 4, align: 'center', lineBreak: false });
  }

  // Tier 2: sub-bands (merged per consecutive same-subBand run) — skipped on
  // wide tables where narrow cells cannot hold the band caption.
  if (!wide) {
    let runStart = -1;
    const flushSub = (end: number) => {
      if (runStart < 0) return;
      const sub = columns[runStart].subBand!;
      const x1 = colX[runStart];
      const x2 = colX[end + 1];
      doc.rect(x1, topOfTable + tierH[0], x2 - x1, tierH[1]).lineWidth(0.6).strokeColor('#111').stroke();
      doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#111')
        .text(sub, x1 + 1, topOfTable + tierH[0] + 2, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
      runStart = -1;
    };
    columns.forEach((c, i) => {
      if (c.subBand) { if (runStart < 0) runStart = i; }
      else flushSub(i - 1);
    });
    flushSub(columns.length - 1);
  }

  // Tier 3: column labels. Only band-less columns (UNASSIGNED/TOTAL) span
  // tiers 1-3; SEX gets its own band cell with MALE/FEMALE at the label row.
  const labelTop = topOfTable + tierH[0] + tierH[1];
  columns.forEach((c, i) => {
    const spanTop = c.band === '' ? topOfTable : labelTop;
    const x1 = colX[i];
    const x2 = colX[i + 1];
    doc.rect(x1, spanTop, x2 - x1, (topOfTable + headerH) - spanTop).lineWidth(0.6).strokeColor('#111').stroke();
    const cellW = x2 - x1 - 2;
    // Wide catalogues put long program names in narrow columns; wrap each
    // label to at most two fitted lines (ellipsised floor) so the header
    // never overlaps its neighbours.
    const size = c.label.length > 12 ? 4.6 : c.label.length > 9 ? 5.2 : 6;
    const lines = wrapLabelLines(doc, c.label, cellW, size, 2);
    lines.forEach((ln, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(ln, x1 + 1, spanTop + 3 + li * (size + 1.2), { width: cellW, align: 'center', lineBreak: false });
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
  doc.y += 18;
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Prepared by:', LEFT + 10, doc.y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.preparedBy, LEFT + 10, doc.y + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.preparedByRole, LEFT + 10, doc.y + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Noted by:', LEFT + WIDTH / 2, doc.y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.notedBy, LEFT + WIDTH / 2, doc.y + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.notedByRole, LEFT + WIDTH / 2, doc.y + 38, { lineBreak: false });
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