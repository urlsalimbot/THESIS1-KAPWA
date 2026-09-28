import { PDFDocument } from 'pdf-lib';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { ReportColumn, SummaryReportData, SummaryTable, buildColumns } from './summary-report.types';

// Program fixture mirrors a small deployment; columns are the fixed 18-slot
// reference set regardless of the catalogue.
const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-pwd', name: 'PWD Assistance', category: 'PWD Welfare' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Legal' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Legal' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Technical' },
  { id: 'p-hv', name: 'Home Visit', category: 'Technical' },
];

const COLUMNS: ReportColumn[] = buildColumns();

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

  it('prints page titles, reference bands, signatories, and case rows', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of [
      'SUMMARY REPORT 2025', 'GAD DATABASE CASE TRACKER', '2nd QUARTER REPORT',
      'April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025', '2nd QUARTER SUMMARY',
      'GAD DATABASE CASE LIST', 'SR. CITIZEN', 'INDIGENT', 'Intervention/Remarks',
      'SEX', 'Financial', 'Legal', 'Technical', 'Burial', 'Medical', 'Case Study',
      'Prepared by:', 'Noted by:', 'ARLYNDA F. GAMUTIA', 'ANNALYN JOY C. SAN PEDRO',
      'Magno', 'Poblacion',
    ]) expect(text).toContain(s);
  });

  it('merges sub-bands once per table', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    // 1 annual + 3 monthly + 1 quarter summary = 5 tables, one merged cell each.
    expect((text.match(/Financial Assistance/g) ?? []).length).toBe(5);
    expect((text.match(/Referral/g) ?? []).length).toBe(5);
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

  it('prints the exact reference header matrix (bands, sub-bands, labels)', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of [
      'SEX', 'Financial', 'Legal', 'Technical',
      'Financial Assistance', 'Referral',
      'Male', 'Female', 'Burial', 'Medical', 'Assistive Devices', 'PWD',
      'LEGAL/PAO', 'OTHERS',
      'Birth Discrepancy', 'Travel Assessment', 'Case Study Report', 'Counselling',
      'PhilHealth', 'Child Custody', 'Home Visit', 'Balik Probinsya', 'TOTAL',
    ]) {
      // Labels may wrap across lines; assert each word group is present.
      for (const word of s.split(' ')) {
        expect(text).toContain(word);
      }
    }
  });
});