import * as zlib from 'zlib';
import { buildAccessCardPdf } from './access-card-pdf.builder';
import { AccessCardPdfData } from './access-card-pdf.types';

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

const fullData: AccessCardPdfData = {
  code: 'NORZ-AC-2026-0001',
  barangay: 'Poblacion',
  contact: '09171234567',
  client: {
    surname: 'Dela Cruz', firstName: 'Juan', middleName: 'M',
    gender: 'Male', dob: new Date('1990-05-15'),
    address: 'Purok 1, Poblacion, Norzagaray, Bulacan',
  },
  familyMembers: [
    { fullName: 'Dela Cruz, Juan M', relationship: 'Self', age: 36, status: 'Employed', income: 5000 },
    { fullName: 'Dela Cruz, Maria L', relationship: 'Wife', age: 33, status: '', income: 2500 },
  ],
  services: [
    { date: '07/01/2026', rendered: 'Financial Assistance (₱5,000)', agency: 'MSWDO', worker: 'Anna Joy C. San Pedro, RSW' },
    { date: '07/15/2026', rendered: 'Medical', agency: 'RHU', worker: 'R. Santos' },
  ],
};

describe('buildAccessCardPdf', () => {
  it('produces a 2-page A4 PDF with populated fields', async () => {
    const buf = await buildAccessCardPdf(fullData);
    expect(buf[0]).toBe(0x25); // '%'
    const text = searchableText(buf);
    expect(text).toContain('%PDF');
    expect(text).toContain('NORZ-AC-2026-0001');
    expect(text).toContain('PAALALA AT GABAY');
    expect(text).toContain('CLIENT');
    expect(text).toContain('Dela Cruz');
    expect(text).toContain('FAMILY COMPOSITION');
    expect(text).toContain('Financial Assistance');
    expect(text).toContain('MSWDO');
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBe(2);
  });

  it('never crashes on minimal data (blanks)', async () => {
    const bare: AccessCardPdfData = {
      code: 'NORZ-AC-X', barangay: '', contact: '',
      client: { surname: '', firstName: '', gender: '', address: '' },
      familyMembers: [],
      services: [],
    };
    const buf = await buildAccessCardPdf(bare);
    expect(searchableText(buf)).toContain('%PDF');
  });
});
