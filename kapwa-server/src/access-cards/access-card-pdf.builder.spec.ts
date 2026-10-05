import * as zlib from 'zlib';
import { buildAccessCardPdf } from './access-card-pdf.builder';
import { AccessCardPdfData } from './access-card-pdf.types';
import { isLandscape, searchableText } from '../gis/gis-pdf-test.util';

const fullData: AccessCardPdfData = {
  code: 'NORZ-AC-2026-0001',
  barangay: 'Poblacion',
  contact: '09171234567',
  nhtsPrId: 'NHTS-2024-000123',
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
    expect(text).toContain('NHTS-PR');
    expect(text).toContain('NHTS-2024-000123');
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBe(2);
  });

  it('orders the cover side before the PAALALA side and prints cover furniture', async () => {
    const text = searchableText(await buildAccessCardPdf(fullData));
    const coverIdx = text.indexOf('FAMILY COMPOSITION');
    const paalalaIdx = text.indexOf('PAALALA AT GABAY');
    expect(coverIdx).toBeGreaterThanOrEqual(0);
    expect(paalalaIdx).toBeGreaterThanOrEqual(0);
    expect(coverIdx).toBeLessThan(paalalaIdx);
    expect(text).toContain('Municipality of Norzagaray');
    expect(text).toContain('Barangay Captain');
    expect(text).toContain('Municipal Mayor');
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

  it('lays the card out landscape, one continuous table per face', async () => {
    const buf = await buildAccessCardPdf(fullData);
    expect(isLandscape(buf)).toBe(true);
    // Both card faces carry the table header; the rows are what continues.
    const text = searchableText(buf);
    expect(text).toContain('SERVICES RENDERED');
    expect(text).toContain('Including Cost if any');
  });

  it('continues service rows across the two faces instead of repeating them', async () => {
    // 30 rows: face 1 holds the first 25, face 2 continues with 26–30.
    const many = Array.from({ length: 30 }, (_, i) => ({
      date: `01/${String(i + 1).padStart(2, '0')}/2026`,
      rendered: `SVC-${String(i + 1).padStart(2, '0')}`,
      agency: 'MSWDO',
      worker: 'W',
    }));
    const buf = await buildAccessCardPdf({ ...fullData, services: many });
    const text = searchableText(buf);
    const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBe(2);
    // Every service appears exactly once — the table runs on, never restarts.
    for (const n of ['SVC-01', 'SVC-25', 'SVC-26', 'SVC-30']) {
      expect(text.split(n).length - 1).toBe(1);
    }
    expect(text).not.toContain('SVC-31');
  });
});
