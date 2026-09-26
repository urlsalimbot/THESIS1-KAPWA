import * as zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';
import { buildIrfPdf, IrfPdfData } from './irf-pdf.builder';

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

const fullData: IrfPdfData = {
  blotterEntryNumber: 'BLT-2026-0001',
  caseCategory: 'Abuse',
  datetimeReported: new Date('2026-09-09T10:30:00+08:00'),
  datetimeIncident: new Date('2026-09-08T20:15:00+08:00'),
  reportingPerson: {
    familyName: 'Santos',
    firstName: 'Maria',
    middleName: 'Lopez',
    nickname: 'Mari',
    gender: 'Female',
    civilStatus: 'Married',
    dateOfBirth: '1985-07-22',
    age: 41,
    placeOfBirth: 'Norzagaray, Bulacan',
    contactDetails: '09171234002',
    currentAddress: 'Purok 3, Bigte, Norzagaray, Bulacan',
    otherAddress: 'Cabanatuan, Nueva Ecija',
    educationalAttainment: 'College Graduate',
    occupation: 'Street Vendor',
    idCardPresented: 'PhilSys ID',
    emailAddress: 'maria.santos@example.com',
  },
  personReported: {
    familyName: 'Dela Cruz',
    firstName: 'Pedro',
    gender: 'Male',
    relationshipToClient: 'Neighbor',
  },
  narration: 'Narrative of the incident.',
  caseDisposition: 'Under Investigation',
  officeName: 'Municipal Social Welfare and Development Office',
  legalBasis: 'RA 9262',
};

describe('buildIrfPdf', () => {
  it('produces a single-page A4 PDF', async () => {
    const buf = await buildIrfPdf(fullData);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('renders a blank form when no party data or narration is present', async () => {
    const buf = await buildIrfPdf({
      blotterEntryNumber: 'BLT-2026-0002',
      caseCategory: 'Neglect',
      officeName: 'MSWDO',
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(1);
  });

  it('maps legacy JSONB keys (name/contact/address/relation/alias)', async () => {
    const buf = await buildIrfPdf({
      blotterEntryNumber: 'BLT-2026-0003',
      caseCategory: 'Criminal',
      reportingPerson: { name: 'Maria L. Santos', contact: '09171234002', address: 'Bigte', relation: 'Self', alias: 'Mari' },
      personReported: { name: 'Unknown Male', alias: 'Kapitbahay', address: 'Bigte' },
      caseDisposition: 'Dismissed',
      dismissalReason: 'Complainant withdrew the case.',
      officeName: 'MSWDO',
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('supports password protection', async () => {
    const buf = await buildIrfPdf(fullData, { password: 'secret', ownerPassword: 'owner' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    expect(doc.getPageCount()).toBe(1);
  });

  it('does not print a generated/legal-basis footer', async () => {
    const buf = await buildIrfPdf({
      blotterEntryNumber: 'BLT-2026-0001',
      caseCategory: 'Abuse',
      officeName: 'Municipal Social Welfare and Development Office',
      generatedAt: new Date('2026-09-23T07:34:00Z'),
      legalBasis: 'RA 9262',
    });
    const text = searchableText(buf);
    expect(text).not.toContain('Legal basis: RA 9262');
    expect(text).not.toContain('generated');
  });
});
