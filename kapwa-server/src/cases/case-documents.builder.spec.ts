import { PDFDocument } from 'pdf-lib';
import {
  buildCertificateOfEligibilityPdf,
  buildPettyCashVoucherPdf,
  money,
  CertificateOfEligibilityData,
  PettyCashVoucherData,
} from './case-documents.builder';

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
  it('produces a single-page A4 PDF', async () => {
    const buf = await buildCertificateOfEligibilityPdf(coeData);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
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
  it('produces a single-page A4 PDF', async () => {
    const buf = await buildPettyCashVoucherPdf(pcvData);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('falls back to the "Assistance" particular when none is given', async () => {
    const buf = await buildPettyCashVoucherPdf({ ...pcvData, particulars: '' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
