import { PDFDocument } from 'pdf-lib';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { ReportColumn, SummaryReportData, SummaryTable, buildColumns } from './summary-report.types';

// Program fixture mirrors a small deployment of the seeded catalogue.
const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-pwd', name: 'PWD Assistance', category: 'PWD Welfare' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Social Services' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Social Services' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Social Services' },
  { id: 'p-hv', name: 'Home Visit', category: 'Family Welfare' },
];

const COLUMNS: ReportColumn[] = buildColumns(PROGRAMS);

function emptyTable(title: string): SummaryTable {
  const byColumn: Record<string, number> = {};
  for (const c of COLUMNS) {
    if (c.key === 'MALE' || c.key === 'FEMALE' || c.key === 'TOTAL') continue;
    byColumn[c.key] = 0;
  }
  return { title, counts: { male: 0, female: 0, total: 0, byColumn } };
}

const data: SummaryReportData = {
  year: 2025, quarter: 2,
  columns: COLUMNS,
  annual: emptyTable('SUMMARY REPORT 2025'),
  monthly: [emptyTable('April 1-30, 2025'), emptyTable('May 1-31, 2025'), emptyTable('June 1-30, 2025')],
  quarterSummary: emptyTable('2nd QUARTER SUMMARY'),
  caseList: [{ no: 1, date: '01-02-25', surname: 'Magno', firstName: 'Michael', middleName: 'H', gender: 'M', categories: { cedc: false, wedc: false, pwd: false, senior: false, indigent: true, fourPs: false, ip: false }, barangay: 'Poblacion', intervention: 'FA' }],
  officeName: 'Municipal Social Welfare and Development Office',
  preparedBy: 'ARLYNDA F. GAMUTIA', preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW', notedByRole: 'MSWD-HEAD',
};

// pdfkit stores page content in FlateDecode streams and encodes text as
// hex-encoded TJ arrays, so decode both before asserting on text.
function searchableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try {
      streams.push(require('zlib').inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
    } catch { /* not FlateDecode */ }
  }
  const hex = streams.join('\n').match(/<([0-9A-Fa-f]+)>/g) ?? [];
  return `${raw}\n${hex.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('')}`;
}

describe('buildSummaryReportPdf', () => {
  it('produces three US Legal landscape pages', async () => {
    const doc = await PDFDocument.load(await buildSummaryReportPdf(data));
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(936);
    expect(Math.round(height)).toBe(612);
  });

  it('prints page titles, program-driven bands, signatories, and case rows', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of [
      'SUMMARY REPORT 2025', 'GAD DATABASE CASE TRACKER', '2nd QUARTER REPORT',
      'April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025', '2nd QUARTER SUMMARY',
      'GAD DATABASE CASE LIST', 'SR. CITIZEN', 'INDIGENT', 'Intervention/Remarks',
      'FINANCIAL', 'LEGAL', 'TECHNICAL', 'BURIAL', 'MEDICAL', 'CASE STUDY REPORT',
      'UNASSIGNED', 'Prepared by:', 'Noted by:', 'ARLYNDA F. GAMUTIA', 'ANNALYN JOY C. SAN PEDRO',
      'Magno', 'Poblacion',
    ]) expect(text).toContain(s);
  });

  it('merges sub-bands once per table', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    // 1 annual + 3 monthly + 1 quarter summary = 5 tables, one merged cell each.
    expect((text.match(/FINANCIAL ASSISTANCE/g) ?? []).length).toBe(5);
    expect((text.match(/REFERRAL/g) ?? []).length).toBe(5);
  });

  it('paginates a long case list without crashing', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...data.caseList[0], no: i + 1 }));
    const doc = await PDFDocument.load(await buildSummaryReportPdf({ ...data, caseList: many }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });

  it('renders with zero counts (empty year)', async () => {
    const buf = await buildSummaryReportPdf({ ...data, caseList: [] });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('stays collision-free with a production-sized programme catalogue', async () => {
    // 30+ long-named programs mimic prod: labels wrap/ellipsise in narrow
    // columns and special columns (UNASSIGNED/TOTAL) keep their full labels.
    const widePrograms = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      name: `${i % 2 ? '4Ps — Pantawid Pamilyang Pilipino Program' : 'Comprehensive Family Development Intervention Program'} ${i}`,
      category: i % 3 === 0 ? 'CCT' : 'Other',
    }));
    const wideCols = buildColumns(widePrograms);
    const bc: Record<string, number> = {};
    for (const c of wideCols) { if (!['MALE', 'FEMALE', 'TOTAL'].includes(c.key)) bc[c.key] = 0; }
    const emptyT = (title: string): SummaryTable => ({ title, counts: { male: 0, female: 0, total: 0, byColumn: bc } });
    const text = searchableText(await buildSummaryReportPdf({
      ...data,
      columns: wideCols,
      annual: emptyT('SUMMARY REPORT 2025'),
      monthly: [emptyT('April 1-30, 2025'), emptyT('May 1-31, 2025'), emptyT('June 1-30, 2025')],
      quarterSummary: emptyT('2nd QUARTER SUMMARY'),
    }));
    expect(text).toContain('UNASSIGNED');
    expect(text).toContain('TOTAL');
    expect(text).toContain('OTHER PROGRAMS');
  });
});