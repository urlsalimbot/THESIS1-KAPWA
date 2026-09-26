import { CaseListRow, SummaryReportData, SummaryTable, SUMMARY_COLUMNS } from './summary-report.types';

const PAGE: [number, number] = [841.89, 595.28]; // A4 landscape
const M = 28;
const LEFT = M;
const RIGHT = PAGE[0] - M;
const WIDTH = RIGHT - LEFT;

interface CaseLeaf {
  key: string;
  label: string;
  w: number;
  group: string;
  vertical?: boolean;
}

// Page-3 case list. Columns are grouped into NAME / GENDER / CLIENT CATEGORY
// super-bands; the client-category labels are rotated and drawn once in the
// header (rows carry only the '/' tick).
const CASE_LEAVES: ReadonlyArray<CaseLeaf> = [
  { key: 'no', label: 'No.', w: 0.030, group: '' },
  { key: 'date', label: 'Date', w: 0.062, group: '' },
  { key: 'surname', label: 'SURNAME', w: 0.100, group: 'NAME' },
  { key: 'firstName', label: 'FIRST NAME', w: 0.100, group: 'NAME' },
  { key: 'middleName', label: 'MIDDLE NAME', w: 0.092, group: 'NAME' },
  { key: 'genderM', label: 'M', w: 0.028, group: 'GENDER' },
  { key: 'genderF', label: 'F', w: 0.028, group: 'GENDER' },
  { key: 'cedc', label: 'CEDC', w: 0.042, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'wedc', label: 'WEDC', w: 0.042, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'pwd', label: 'PWD', w: 0.040, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'senior', label: 'SR. CITIZEN', w: 0.058, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'indigent', label: 'INDIGENT', w: 0.055, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'fourPs', label: '4Ps', w: 0.036, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'ip', label: 'IP', w: 0.032, group: 'CLIENT CATEGORY', vertical: true },
  { key: 'barangay', label: 'Barangay', w: 0.092, group: '' },
  { key: 'intervention', label: 'Intervention/Remarks', w: 0.153, group: '' },
];

// Header tier heights for the grouped summary table. The label tier is tall
// enough to hold the two-line labels without spilling into the data row.
const GROUP_H = 12;
const SUBGROUP_H = 11;
const LABEL_H = 19;
const LABEL_LINE_H = 8;

// Header tier heights for the page-3 case list. Tier 2 is tall enough to hold
// the rotated client-category labels without spilling into the data rows.
const CASE_GROUP_H = 16;
const CASE_LABEL_H = 38;

export async function buildSummaryReportPdf(data: SummaryReportData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: PAGE, margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Summary Report ${data.year} Q${data.quarter}`, Author: data.officeName, Subject: 'GAD Database Case Tracker' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, data, true);
  drawTitle(doc, data.annual.title, `GAD DATABASE CASE TRACKER`);
  drawGroupedTable(doc, data.annual);
  drawSignatories(doc, data);

  doc.addPage();
  drawLetterhead(doc, data, false);
  drawTitle(doc, `${data.year}`, `${ordinal(data.quarter)} QUARTER REPORT`);
  data.monthly.forEach((m) => { drawSectionTitle(doc, m.title); drawGroupedTable(doc, m); });
  drawSectionTitle(doc, data.quarterSummary.title);
  drawGroupedTable(doc, data.quarterSummary);
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
  doc.y += 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(title, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y += 13;
}

// The reference form renders OTHERS outside the TECHNICAL group band (it has
// its own empty top cell), even though SUMMARY_COLUMNS tags it as TECHNICAL.
function effectiveGroup(key: string, group: string): string {
  return key === 'OTHERS_TECHNICAL' ? '' : group;
}

function drawGroupedTable(doc: any, table: SummaryTable) {
  const topOfTable = doc.y;
  const weights = SUMMARY_COLUMNS.map((c) => c.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  const groupTop = topOfTable;
  const subTop = topOfTable + GROUP_H;
  const labelTop = subTop + SUBGROUP_H;
  const headerBottom = labelTop + LABEL_H;

  // Tier 1: one spanning cell per group.
  const groups = [...new Set(SUMMARY_COLUMNS.map((c) => effectiveGroup(c.key, c.group)).filter(Boolean))];
  const groupStart: Record<string, number> = {};
  const groupEnd: Record<string, number> = {};
  SUMMARY_COLUMNS.forEach((c, i) => {
    const g = effectiveGroup(c.key, c.group);
    if (!g) return;
    groupStart[g] = groupStart[g] ?? i;
    groupEnd[g] = i;
  });
  groups.forEach((g) => {
    const x1 = colX[groupStart[g]];
    const x2 = colX[groupEnd[g] + 1];
    doc.rect(x1, groupTop, x2 - x1, GROUP_H).lineWidth(0.6).strokeColor('#111').stroke();
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#111')
      .text(g, x1 + 2, groupTop + 3, { width: x2 - x1 - 4, align: 'center', lineBreak: false });
  });
  // Ungrouped columns (OTHERS, TOTAL) get an empty top cell.
  SUMMARY_COLUMNS.forEach((c, i) => {
    if (effectiveGroup(c.key, c.group)) return;
    doc.rect(colX[i], groupTop, colX[i + 1] - colX[i], GROUP_H).lineWidth(0.6).strokeColor('#111').stroke();
  });

  // Tier 2: a single merged cell per distinct sub-group (FINANCIAL ASSISTANCE,
  // REFERRAL), never one cell per sub-column.
  const subGroups = [...new Set(SUMMARY_COLUMNS.map((c) => c.subGroup).filter(Boolean))] as string[];
  const subStart: Record<string, number> = {};
  const subEnd: Record<string, number> = {};
  SUMMARY_COLUMNS.forEach((c, i) => {
    if (!c.subGroup) return;
    subStart[c.subGroup] = subStart[c.subGroup] ?? i;
    subEnd[c.subGroup] = i;
  });
  subGroups.forEach((s) => {
    const x1 = colX[subStart[s]];
    const x2 = colX[subEnd[s] + 1];
    doc.rect(x1, subTop, x2 - x1, SUBGROUP_H).lineWidth(0.6).strokeColor('#111').stroke();
    doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#111')
      .text(s, x1 + 1, subTop + 3, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
  });

  // Tier 3: leaf labels. Columns with a sub-group occupy tier 3 only; columns
  // without one span tiers 2-3 so their label lands on the bottom tier.
  SUMMARY_COLUMNS.forEach((c, i) => {
    const x1 = colX[i];
    const x2 = colX[i + 1];
    const spanTop = c.subGroup ? labelTop : subTop;
    doc.rect(x1, spanTop, x2 - x1, headerBottom - spanTop).lineWidth(0.6).strokeColor('#111').stroke();
    const size = c.labels.some((l) => l.length > 9) ? 5.2 : 6;
    const lines = c.labels.length;
    let base: number;
    if (lines === 1) base = labelTop + 6; // single labels sit on the bottom tier
    else if (c.subGroup) base = labelTop + 2;
    else base = subTop + (SUBGROUP_H + LABEL_H - lines * LABEL_LINE_H) / 2 - 1;
    c.labels.forEach((label, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(label, x1 + 1, base + li * LABEL_LINE_H, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
    });
  });

  // Single data row.
  const rowH = 18;
  const rowY = headerBottom;
  doc.rect(LEFT, rowY, WIDTH, rowH).lineWidth(0.6).strokeColor('#111').stroke();
  SUMMARY_COLUMNS.forEach((c, i) => {
    let value = '';
    if (c.key === 'MALE') value = String(table.counts.male);
    else if (c.key === 'FEMALE') value = String(table.counts.female);
    else if (c.key === 'TOTAL') value = String(table.counts.total);
    else value = String(table.counts.byCategory[c.key as keyof typeof table.counts.byCategory] ?? 0);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
      .text(value, colX[i] + 1, rowY + 4, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
  });
  doc.y = rowY + rowH + 4;
}

function drawSignatories(doc: any, data: SummaryReportData) {
  const base = doc.y + 12;
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Prepared by:', LEFT + 10, base, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.preparedBy, LEFT + 10, base + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.preparedByRole, LEFT + 10, base + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Noted by:', LEFT + WIDTH / 2, base, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.notedBy, LEFT + WIDTH / 2, base + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.notedByRole, LEFT + WIDTH / 2, base + 38, { lineBreak: false });
  doc.y = base + 50;
}

function caseCellValue(r: CaseListRow, key: string): string {
  switch (key) {
    case 'no': return String(r.no);
    case 'date': return r.date;
    case 'surname': return r.surname;
    case 'firstName': return r.firstName;
    case 'middleName': return r.middleName;
    case 'genderM': return r.gender === 'M' ? '/' : '';
    case 'genderF': return r.gender === 'F' ? '/' : '';
    case 'cedc': return r.categories.cedc ? '/' : '';
    case 'wedc': return r.categories.wedc ? '/' : '';
    case 'pwd': return r.categories.pwd ? '/' : '';
    case 'senior': return r.categories.senior ? '/' : '';
    case 'indigent': return r.categories.indigent ? '/' : '';
    case 'fourPs': return r.categories.fourPs ? '/' : '';
    case 'ip': return r.categories.ip ? '/' : '';
    case 'barangay': return r.barangay;
    case 'intervention': return r.intervention;
    default: return '';
  }
}

function drawCaseList(doc: any, rows: CaseListRow[]) {
  const weights = CASE_LEAVES.map((c) => c.w);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  const headerH = CASE_GROUP_H + CASE_LABEL_H;
  const rowH = 15;

  const drawHeader = (top: number) => {
    const labelTop = top + CASE_GROUP_H;
    // Super-bands (NAME / GENDER / CLIENT CATEGORY) in tier 1.
    const grouped = [...new Set(CASE_LEAVES.map((c) => c.group).filter(Boolean))];
    grouped.forEach((g) => {
      const first = CASE_LEAVES.findIndex((c) => c.group === g);
      let last = first;
      CASE_LEAVES.forEach((c, i) => { if (c.group === g) last = i; });
      const x1 = colX[first];
      const x2 = colX[last + 1];
      doc.rect(x1, top, x2 - x1, CASE_GROUP_H).lineWidth(0.6).strokeColor('#111').stroke();
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#111')
        .text(g, x1 + 1, top + 4, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
    });

    CASE_LEAVES.forEach((c, i) => {
      const x1 = colX[i];
      const x2 = colX[i + 1];
      if (!c.group) {
        // Ungrouped columns span the full header height.
        doc.rect(x1, top, x2 - x1, headerH).lineWidth(0.6).strokeColor('#111').stroke();
        doc.font('Helvetica-Bold').fontSize(c.key === 'intervention' ? 6.2 : 6.8).fillColor('#111')
          .text(c.label, x1 + 2, top + headerH / 2 - 4, { width: x2 - x1 - 4, align: 'center', lineBreak: false });
        return;
      }
      // Grouped leaf cells live in tier 2.
      doc.rect(x1, labelTop, x2 - x1, CASE_LABEL_H).lineWidth(0.6).strokeColor('#111').stroke();
      if (c.vertical) {
        const cx = x1 + (x2 - x1) / 2 + 2;
        const baseY = labelTop + CASE_LABEL_H - 4;
        doc.save();
        doc.rotate(-90, { origin: [cx, baseY] });
        doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#111')
          .text(c.label, cx, baseY, { lineBreak: false });
        doc.restore();
      } else {
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#111')
          .text(c.label, x1 + 1, labelTop + CASE_LABEL_H / 2 - 4, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
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
    CASE_LEAVES.forEach((c, i) => {
      const value = caseCellValue(r, c.key);
      if (!value) return;
      if (c.vertical || c.key === 'genderM' || c.key === 'genderF') {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#111')
          .text(value, colX[i] + 1, y + 4, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
        return;
      }
      doc.font('Helvetica').fontSize(6.4).fillColor('#111')
        .text(value, colX[i] + 2, y + 4, { width: colX[i + 1] - colX[i] - 4, lineBreak: false, ellipsis: true });
    });
    y += rowH;
  }
  doc.y = y;
}
