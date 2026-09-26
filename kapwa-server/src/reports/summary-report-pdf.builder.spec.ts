import * as zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { SummaryReportData, SummaryTable } from './summary-report.types';

// pdfkit stores page content in FlateDecode streams and encodes text as
// hex-encoded TJ arrays, so decode both before asserting on text.
function searchableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try {
      streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
    } catch {
      // stream not FlateDecode; ignore
    }
  }
  const hex = streams.join('\n').match(/<([0-9A-Fa-f]+)>/g) ?? [];
  const decoded = hex.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('');
  return `${raw}\n${decoded}`;
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const emptyTable = (title: string): SummaryTable => ({
  title,
  counts: { male: 0, female: 0, total: 0, byCategory: {} as any },
});

const data: SummaryReportData = {
  year: 2025, quarter: 2,
  annual: emptyTable('SUMMARY REPORT 2025'),
  monthly: [emptyTable('April 1-30, 2025'), emptyTable('May 1-31, 2025'), emptyTable('June 1-30, 2025')],
  quarterSummary: emptyTable('2nd QUARTER SUMMARY'),
  caseList: [{ no: 1, date: '01-02-25', surname: 'Magno', firstName: 'Michael', middleName: 'H', gender: 'M', categories: { cedc: false, wedc: false, pwd: false, senior: false, indigent: true, fourPs: false, ip: false }, barangay: 'Poblacion', intervention: 'PWD ID' }],
  officeName: 'Municipal Social Welfare and Development Office',
  preparedBy: 'ARLYNDA F. GAMUTIA', preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW', notedByRole: 'MSWD-HEAD',
};

describe('buildSummaryReportPdf', () => {
  it('produces three landscape A4 pages', async () => {
    const buf = await buildSummaryReportPdf(data);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it('prints page titles, columns, signatories, and case rows', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of [
      'SUMMARY REPORT 2025', 'GAD DATABASE CASE TRACKER', '2nd QUARTER REPORT',
      'April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025', '2nd QUARTER SUMMARY',
      'GAD DATABASE CASE LIST', 'SR. CITIZEN', 'INDIGENT', 'Intervention/Remarks',
      'Prepared by:', 'Noted by:', 'ARLYNDA F. GAMUTIA', 'ANNALYN JOY C. SAN PEDRO',
      'Magno', 'Poblacion',
    ]) expect(text).toContain(s);
  });

  it('prints page-1 and page-2 signatories', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    expect(countOf(text, 'Prepared by:')).toBeGreaterThanOrEqual(2);
    expect(countOf(text, 'Noted by:')).toBeGreaterThanOrEqual(2);
  });

  it('merges the FINANCIAL ASSISTANCE and REFERRAL header bands once per table', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    // 5 grouped tables: 1 annual + 3 monthly + 1 quarter summary.
    expect(countOf(text, 'FINANCIAL ASSISTANCE')).toBe(5);
    expect(countOf(text, 'REFERRAL')).toBe(5);
  });

  it('draws the page-3 NAME/GENDER super-bands and client-category header labels', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of ['NAME', 'GENDER', 'CEDC', 'SR. CITIZEN']) expect(text).toContain(s);
  });

  it('paginates a long case list without crashing', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...data.caseList[0], no: i + 1 }));
    const doc = await PDFDocument.load(await buildSummaryReportPdf({ ...data, caseList: many }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });

  it('repeats the client-category header once per case-list page, never per row', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...data.caseList[0], no: i + 1 }));
    const doc = await PDFDocument.load(await buildSummaryReportPdf({ ...data, caseList: many }));
    const pages = doc.getPageCount();
    const casePages = pages - 2; // pages 1-2 are the aggregate pages; no case list there
    const text = searchableText(await buildSummaryReportPdf({ ...data, caseList: many }));
    expect(countOf(text, 'SR. CITIZEN')).toBe(casePages);
    expect(countOf(text, 'SR. CITIZEN')).toBeLessThan(120);
  });

  it('renders with zero counts (empty year)', async () => {
    const buf = await buildSummaryReportPdf({ ...data, caseList: [] });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
