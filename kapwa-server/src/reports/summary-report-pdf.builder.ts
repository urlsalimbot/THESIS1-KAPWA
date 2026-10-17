import * as path from 'path';
import * as fs from 'fs';
import { BAND_LABELS, CaseListRow, ReportColumn, SummaryReportData, SummaryTable } from './summary-report.types';

const PAGE: [number, number] = [936, 612]; // US Legal landscape (8.5in x 13in)
const M = 28;
// Reference density: three monthly tables per page. A semester (six months)
// therefore renders as two aggregate pages.
const MONTHS_PER_PAGE = 3;
const LEFT = M;
const RIGHT = PAGE[0] - M;
const WIDTH = RIGHT - LEFT;

interface CaseListColumn {
  key: string;
  label: string;
  w: number;
  /** The span this column sits under in tier 1 (NAME, GENDER, CLIENT CATEGORY). */
  span?: string;
  /** Drawn as a tick, not as a value — the reference form marks gender and the
   * client categories with a slash in the right column. */
  tick?: boolean;
  /** A second header line, drawn under the label (Intervention/Remarks). */
  hint?: string;
}

// The case list mirrors the office's own form (pdf-samples/SummaryReportP3…):
// a two-tier header — No. | Date | NAME | GENDER | CLIENT CATEGORY | Barangay |
// Intervention — with gender as two tick columns (M, F) and the client
// categories as seven more. `w` sums to 1 so the table spans the full width.
const CASE_COLS: CaseListColumn[] = [
  { key: 'no', label: 'No.', w: 0.03 },
  { key: 'date', label: 'Date', w: 0.07 },
  { key: 'surname', label: 'SURNAME', w: 0.12, span: 'NAME' },
  { key: 'firstName', label: 'FIRST NAME', w: 0.12, span: 'NAME' },
  { key: 'middleName', label: 'MIDDLE NAME', w: 0.11, span: 'NAME' },
  { key: 'genderM', label: 'M', w: 0.03, span: 'GENDER', tick: true },
  { key: 'genderF', label: 'F', w: 0.03, span: 'GENDER', tick: true },
  { key: 'cedc', label: 'CEDC', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'wedc', label: 'WEDC', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'pwd', label: 'PWD', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'senior', label: 'SR. CITIZEN', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'indigent', label: 'INDIGENT', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'fourPs', label: '4Ps', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'ip', label: 'IP', w: 0.0385, span: 'CLIENT CATEGORY', tick: true },
  { key: 'barangay', label: 'Barangay', w: 0.10 },
  { key: 'intervention', label: 'Intervention/Remarks', w: 0.12, hint: '(FA/C/CSR/R/H/HV/ etc.)' },
];

export async function buildSummaryReportPdf(data: SummaryReportData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: PAGE, margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Summary Report ${data.year} Semester ${data.semester}`, Author: data.officeName, Subject: 'GAD Database Case Tracker' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, data);
  drawTitle(doc, data.annual.title, `GAD DATABASE CASE TRACKER`);
  drawGroupedTable(doc, data.annual, data.columns, data);

  // Month tables are chunked three per page (the reference density), so a
  // six-month semester spans two pages instead of overflowing one.
  const monthChunks: SummaryTable[][] = [];
  for (let i = 0; i < data.monthly.length; i += MONTHS_PER_PAGE) {
    monthChunks.push(data.monthly.slice(i, i + MONTHS_PER_PAGE));
  }
  if (monthChunks.length === 0) monthChunks.push([]);
  monthChunks.forEach((chunk, i) => {
    doc.addPage();
    drawLetterhead(doc, data);
    drawTitle(doc, `${data.year}`, `${ordinal(data.semester)} SEMESTER REPORT`);
    chunk.forEach((m) => { drawSectionTitle(doc, m.title); drawGroupedTable(doc, m, data.columns, data); });
    if (i === monthChunks.length - 1) {
      drawSectionTitle(doc, data.semesterSummary.title);
      drawGroupedTable(doc, data.semesterSummary, data.columns, data);
      drawSignatories(doc, data);
    }
  });

  doc.addPage();
  drawLetterhead(doc, data);
  drawTitle(doc, 'GAD DATABASE CASE LIST', '');
  drawCaseList(doc, data.caseList);

  doc.end();
  return done;
}

function ordinal(q: number): string { return ['1st', '2nd', '3rd', '4th'][q - 1] ?? `${q}th`; }

function drawLetterhead(doc: any, data: SummaryReportData) {
  const sealPath = path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png');
  const dswdPath = path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
  const BADGE = 46;
  const GAP = 20; // keep the seals 20pt from the letterhead text

  // Every page carries the same full letterhead.
  const lines: Array<{ text: string; size: number; bold: boolean }> = [
    { text: 'Republic of the Philippines', size: 9, bold: true },
    { text: 'Province of Bulacan', size: 8, bold: false },
    { text: 'Municipality of Norzagaray', size: 8, bold: false },
    { text: data.officeName.toUpperCase(), size: 8.5, bold: true },
    { text: `ACCOMPLISHMENT REPORT (Services) ${data.year}`, size: 7.5, bold: false },
  ];

  const widest = lines.reduce((w, l) => {
    doc.font(l.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(l.size);
    return Math.max(w, doc.widthOfString(l.text));
  }, 0);
  const textLeft = (LEFT + RIGHT) / 2 - widest / 2;
  const textRight = (LEFT + RIGHT) / 2 + widest / 2;
  const textTop = M;
  const textBottom = M + 42;
  const badgeY = Math.max(M - BADGE / 2 + 8, (textTop + textBottom) / 2 - BADGE / 2);

  const sealX = Math.max(LEFT, textLeft - GAP - BADGE);
  const dswdX = Math.min(RIGHT - BADGE, textRight + GAP);
  if (fs.existsSync(sealPath)) { try { doc.image(sealPath, sealX, badgeY, { fit: [BADGE, BADGE] }); } catch { /* seal omitted */ } }
  if (fs.existsSync(dswdPath)) { try { doc.image(dswdPath, dswdX, badgeY, { fit: [BADGE, BADGE] }); } catch { /* seal omitted */ } }

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(lines[0].text, LEFT, M, { width: WIDTH, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(8)
    .text(lines[1].text, LEFT, M + 11, { width: WIDTH, align: 'center', lineBreak: false })
    .text(lines[2].text, LEFT, M + 21, { width: WIDTH, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.5)
    .text(lines[3].text, LEFT, M + 32, { width: WIDTH, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(7.5)
    .text(lines[4].text, LEFT, M + 42, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y = M + 56;
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
  if (c.key === 'TOTAL') return 14;
  if (c.band === 'SEX') return 9;
  return 11;
}

function drawGroupedTable(doc: any, table: SummaryTable, columns: ReportColumn[], data?: SummaryReportData) {
  const tierH = [13, 14, 12];
  const headerH = tierH[0] + tierH[1] + tierH[2];
  const needed = headerH + 20 + 6;
  let topOfTable = doc.y;
  // Overflow guard: a table that cannot fit starts a fresh page instead of
  // letting pdfkit cascade a new page for every subsequent text draw.
  if (data && topOfTable + needed > PAGE[1] - M) {
    doc.addPage();
    drawLetterhead(doc, data);
    topOfTable = doc.y;
  }
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
  // Vertical rules are drawn per TIER, not full height. A merged header — SEX
  // over Male/Female, FINANCIAL over Burial/Medical/Assistive — must not be cut
  // by a rule, which is both what the reference GAD matrix does and what made
  // the labels read as struck-through. Each tier splits only the cells that
  // actually differ on that tier.
  const r1Cell = (c: ReportColumn) => c.band ?? c.key;
  const r2Cell = (c: ReportColumn) => c.subBand ?? (row3(c) ? c.band ?? c.key : c.key);
  const rule = (x: number, y0: number, y1: number) =>
    doc.moveTo(x, y0).lineTo(x, y1).lineWidth(0.6).strokeColor('#111').stroke();
  for (let k = 1; k < columns.length; k++) {
    if (r1Cell(columns[k]) !== r1Cell(columns[k - 1])) rule(colX[k], R1top, R2top);
    if (r2Cell(columns[k]) !== r2Cell(columns[k - 1])) rule(colX[k], R2top, R3top);
    rule(colX[k], R3top, headerBottom);
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
      .text(BAND_LABELS[b] ?? b, colX[s] + 2, R1top + 3, { width: colX[e + 1] - colX[s] - 4, align: 'center', lineBreak: false });
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
    const size = labelSize(doc, c.label, cellW, c.label.length > 12 ? 4.6 : c.label.length > 9 ? 5.2 : 6);
    // The R2 tier spans two rows, so three short lines fit comfortably.
    wrapLabelLines(doc, c.label, cellW, size, 3).forEach((ln, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(ln, colX[i] + 1, R2top + 3 + li * (size + 1.2), { width: cellW, align: 'center', lineBreak: false });
    });
  });

  // R3: row-3-anchored column labels.
  columns.forEach((c, i) => {
    if (!row3(c)) return;
    const cellW = colX[i + 1] - colX[i] - 2;
    const size = labelSize(doc, c.label, cellW, c.label.length > 12 ? 4.6 : c.label.length > 9 ? 5.2 : 6);
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

// Choose a label size that fits the cell's longest word, then wrap to at most
// two lines. Guarantees the word is never ellipsised away in narrow columns
// (production catalogue puts ~33 columns across landscape A4).
function labelSize(doc: any, text: string, cellW: number, preferred: number): number {
  const longest = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  let size = preferred;
  while (size > 3.0 && doc.font('Helvetica-Bold').fontSize(size).widthOfString(longest) > cellW) {
    size -= 0.2;
  }
  return size;
}

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

  const TIER1 = 11;
  const TIER2 = 21;
  const headerH = TIER1 + TIER2;
  const rowH = 15;

  // Span centres, measured the same way the column X positions are: a span is
  // the run of consecutive columns that share its name.
  const spanRange = (name: string) => {
    const idx = CASE_COLS.map((c, i) => (c.span === name ? i : -1)).filter((i) => i >= 0);
    return [colX[idx[0]], colX[idx[idx.length - 1] + 1]] as const;
  };

  const drawHeader = (top: number) => {
    doc.rect(LEFT, top, WIDTH, headerH).lineWidth(0.6).strokeColor('#111').stroke();
    // Tier 1: the span captions, then the columns that have no sub-labels.
    doc.moveTo(LEFT, top + TIER1).lineTo(RIGHT, top + TIER1).lineWidth(0.6).strokeColor('#111').stroke();
    for (const span of ['NAME', 'GENDER', 'CLIENT CATEGORY']) {
      const [x0, x1] = spanRange(span);
      doc.font('Helvetica-Bold').fontSize(6.4).fillColor('#111')
        .text(span, x0, top + 3.5, { width: x1 - x0, align: 'center' });
      // Span columns have no vertical rule between them at tier 1, matching the
      // merged cell on the office's form.
    }
    for (const span of ['NAME', 'GENDER', 'CLIENT CATEGORY']) {
      const [x0, x1] = spanRange(span);
      CASE_COLS.forEach((c, i) => {
        if (c.span !== span || colX[i] === x0) return;
        doc.moveTo(colX[i], top + TIER1).lineTo(colX[i], top + headerH).lineWidth(0.4).strokeColor('#444').stroke();
      });
      void x1;
    }
    // Tier 2: sub-labels, centred inside their own column so a long one
    // ("SR. CITIZEN") wraps instead of sliding into the neighbour.
    CASE_COLS.forEach((c, i) => {
      if (!c.span && i >= 14) return; // Barangay / Intervention sit in tier 1
      if (!c.span) return;
      doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#111')
        .text(c.label, colX[i] + 1, top + TIER1 + 3, { width: colX[i + 1] - colX[i] - 2, align: 'center' });
    });
    // Unspanned headers in tier 1, plus the reference's code hint under the
    // last one.
    CASE_COLS.forEach((c, i) => {
      if (c.span) return;
      // Unspanned headers read across the whole header, as on the form, rather
      // than sitting in tier 1 with an empty band beneath them.
      doc.font('Helvetica-Bold').fontSize(6).fillColor('#111')
        .text(c.label, colX[i], top + headerH / 2 - 3, { width: colX[i + 1] - colX[i], align: 'center' });
      if (c.hint) {
        doc.font('Helvetica').fontSize(4.6).fillColor('#333')
          .text(c.hint, colX[i] + 1, top + headerH - 7, { width: colX[i + 1] - colX[i] - 2, align: 'center' });
      }
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
    const values: Record<string, string> = {
      no: String(r.no),
      date: r.date,
      surname: r.surname,
      firstName: r.firstName,
      middleName: r.middleName,
      barangay: r.barangay,
      intervention: r.intervention,
    };
    // Gender and the client categories are marked with a tick in their own
    // column, as on the office's form.
    const ticks = new Set<string>();
    if (r.gender === 'M') ticks.add('genderM');
    if (r.gender === 'F') ticks.add('genderF');
    const flags: Record<string, boolean> = {
      cedc: r.categories.cedc, wedc: r.categories.wedc, pwd: r.categories.pwd,
      senior: r.categories.senior, indigent: r.categories.indigent,
      fourPs: r.categories.fourPs, ip: r.categories.ip,
    };
    for (const [k, on] of Object.entries(flags)) if (on) ticks.add(k);

    CASE_COLS.forEach((c, i) => {
      const cellW = colX[i + 1] - colX[i];
      if (c.tick) {
        if (!ticks.has(c.key)) return;
        doc.font('Helvetica').fontSize(8).fillColor('#111')
          .text('/', colX[i], y + 4, { width: cellW, align: 'center', lineBreak: false });
        return;
      }
      doc.font('Helvetica').fontSize(6.4).fillColor('#111')
        .text(values[c.key] ?? '', colX[i] + 2, y + 4, { width: cellW - 4, lineBreak: false, ellipsis: true });
    });
    y += rowH;
  }
  doc.y = y;
}