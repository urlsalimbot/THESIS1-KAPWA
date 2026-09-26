import * as zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';
import {
  buildCertificateOfEligibilityPdf,
  buildPettyCashVoucherPdf,
  money,
  CertificateOfEligibilityData,
  PettyCashVoucherData,
} from './case-documents.builder';

function searchableText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const streams: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try { streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')); } catch { /* not FlateDecode */ }
  }
  const hex = streams.join('\n').match(/<([0-9A-Fa-f]+)>/g) ?? [];
  return `${raw}\n${hex.map(h => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('')}`;
}

const coeData: CertificateOfEligibilityData = {
  controlNo: 'KAPWA-2026-0001',
  officeName: 'Municipal Social Welfare and Development Office',
  beneficiaryName: 'Dela Cruz, Juan M.',
  address: 'Poblacion, Norzagaray, Bulacan',
  caseDate: new Date('2026-09-09'),
  amount: 4500,
  interviewer: 'Lorna B. Santos',
  signatoryName: 'Rosario G. Mendoza',
};

const pcvData: PettyCashVoucherData = {
  controlNo: 'KAPWA-2026-0001',
  officeName: 'Municipal Social Welfare and Development Office',
  payee: 'Dela Cruz, Juan M.',
  address: 'Poblacion, Norzagaray, Bulacan',
  date: new Date('2026-09-09'),
  amount: 4500,
  particulars: 'Financial Assistance',
  mayorName: 'HON. MARIA ELENA L. GERMAR',
  mayorTitle: 'MUNICIPAL MAYOR',
};

describe('money', () => {
  it('formats amounts with two decimals and thousands separators', () => {
    expect(money(4500)).toBe('4,500.00');
    expect(money(1234567.5)).toBe('1,234,567.50');
  });

  it('renders a blank string for missing/NaN amounts', () => {
    expect(money(null)).toBe('');
    expect(money(undefined)).toBe('');
    expect(money(Number.NaN)).toBe('');
  });
});

describe('buildCertificateOfEligibilityPdf', () => {
  it('produces a single-page 21cm x 7cm landscape strip', async () => {
    const buf = await buildCertificateOfEligibilityPdf(coeData);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(198);
  });

  it('renders without a signatory or interviewer (blank fallbacks)', async () => {
    const buf = await buildCertificateOfEligibilityPdf({
      ...coeData,
      interviewer: '',
      signatoryName: '',
      address: '',
      amount: null,
      caseDate: '',
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('buildPettyCashVoucherPdf', () => {
  it('produces a single-page 21cm x 14cm landscape strip', async () => {
    const buf = await buildPettyCashVoucherPdf(pcvData);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(397);
  });

  it('falls back to the "Assistance" particular when none is given', async () => {
    const buf = await buildPettyCashVoucherPdf({ ...pcvData, particulars: '' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Petty Cash Voucher structure', () => {
  it('prints the reference section labels', async () => {
    const text = searchableText(await buildPettyCashVoucherPdf(pcvData));
    for (const label of [
      'PETTY CASH VOUCHER', 'Norzagaray, Bulacan', 'LGU',
      'Payee:', 'Address:', 'I. To be filled up upon request',
      'To payment of', 'Particular', 'Amount',
      'Approved by:', 'HON. MARIA ELENA L. GERMAR', 'MUNICIPAL MAYOR',
      'Paid by:', 'Disbursing Officer', 'Cash received by:',
      'Signature Over Printed Name of Payee',
    ]) {
      expect(text).toContain(label);
    }
  });
});

describe('Certificate of Eligibility letterhead parity', () => {
  it('prints the province and municipality lines in reference order', async () => {
    const text = searchableText(await buildCertificateOfEligibilityPdf(coeData));
    const republic = text.indexOf('Republic of the Philippines');
    const province = text.indexOf('Province of Bulacan');
    const municipality = text.indexOf('Municipality of Norzagaray');
    const office = text.indexOf('MUNICIPAL SOCIAL WELFARE AND DEVELOPMENT OFFICE');
    expect(republic).toBeGreaterThanOrEqual(0);
    expect(province).toBeGreaterThan(republic);
    expect(municipality).toBeGreaterThan(province);
    expect(office).toBeGreaterThan(municipality);
  });
});
