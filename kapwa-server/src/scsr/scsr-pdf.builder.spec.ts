import { searchableText } from '../gis/gis-pdf-test.util';
import { buildScsrPdf, ScsrPdfInput } from './scsr-pdf.builder';

const base: Omit<ScsrPdfInput, 'kind'> = {
  officeName: 'Municipal Social Welfare and Development Office',
  controlNo: 'MSWD-2026-00006',
  petsa: 'OKTUBRE 17, 2026',
  client: {
    pangalan: 'LAUDES BAUTISTA RAMOS',
    edad: '78 TAONG GULANG',
    kaarawan: 'MARSO 2, 1948',
    lugar: 'NORZAGARAY, BULACAN',
    natapos: '',
    tirahan: 'PUROK 3, POBLACION, NORZAGARAY, BULACAN',
    estado: 'WIDOWED',
    kasarian: 'BABAE',
    hanapbuhay: 'NONE',
    relihiyon: '',
    pinagkunan: 'ELENA BAUTISTA CRUZ',
    contact: '09171234567',
  },
  family: [
    { name: 'ELENA BAUTISTA CRUZ', age: '50', relationship: 'ANAK', occupation: 'HOUSEKEEPER', income: '12,000' },
  ],
  narrative: {
    mainProblem: 'NAGKAROON NG SAKIT ANG KLIYENTE AT KAILANGAN NG tulong medical.',
    additionalInfo: 'NAMUMUHAY ANG PAMILYA SA POBLACION AT NAGTATRABAHO SA KONSTRUKSYON.',
    recommendation: 'IREREKOMENDA ANG MEDICAL ASSISTANCE PARA SA PAGGAMOT.',
  },
  preparedByName: 'JUAN DELA CRUZ',
  preparedByRole: 'SOCIAL WORKER',
  notedByName: 'ROSARIO MENDOZA',
  notedByRole: 'MSWDO HEAD',
};

describe('buildScsrPdf', () => {
  it('renders the finished burial report with its narrative sections', async () => {
    const text = searchableText(await buildScsrPdf({ ...base, kind: 'burial' }));

    for (const s of [
      'SOCIAL CASE STUDY REPORT', '(BURYAL)', 'Petsa: OKTUBRE 17, 2026',
      'I.    DATOS NG KLIYENTE', 'II.    BUMUBUO NG PAMILYA',
      'III.    PANGUNAHING SULIRANIN',
      'IV.    KARAGDAGANG IMPORMASYON TUNGKOL SA KLIYENTE AT SA KANIYANG PAMILYA',
      'V.    REKOMENDASYON',
      // Filled from the case:
      'LAUDES BAUTISTA RAMOS', '78 TAONG GULANG', 'MARSO 2, 1948',
      'WIDOWED', 'BABAE', 'ELENA BAUTISTA CRUZ', '09171234567',
      'ELENA BAUTISTA CRUZ', 'HOUSEKEEPER',
      // The assessment becomes the report narrative, not an interview form:
      'NAGKAROON NG SAKIT ANG KLIYENTE',
      'NAMUMUHAY ANG PAMILYA SA POBLACION',
      'IREREKOMENDA ANG MEDICAL ASSISTANCE',
      // Signatories:
      'Inihanda ni:', 'JUAN DELA CRUZ', 'Sa Kaalaman ni:', 'ROSARIO MENDOZA',
    ]) expect(text).toContain(s);
    expect(text).not.toContain('Magkano ang bayarin sa punenarya?');
  });

  it('renders the same finished-report narrative for the medical form', async () => {
    const text = searchableText(await buildScsrPdf({ ...base, kind: 'medical' }));

    expect(text).toContain('(MEDIKAL)');
    expect(text).toContain('III.    PANGUNAHING SULIRANIN');
    expect(text).toContain('NAGKAROON NG SAKIT ANG KLIYENTE');
    expect(text).not.toContain('Ano ang gamutan na kailangan gawin sa kliyente?');
    // The medical form's family table has its own column order.
    expect(text).toContain('RELASYON SA KLIYENTE');
  });

  it('keeps the family table columns per form', async () => {
    const burial = searchableText(await buildScsrPdf({ ...base, kind: 'burial', family: [] }));
    expect(burial).toContain('KATAYUAN/HANAPBUHAY');

    const medical = searchableText(await buildScsrPdf({ ...base, kind: 'medical', family: [] }));
    expect(medical).toContain('STATUS SA BUHAY/AT HANAPBUHAY');
  });

  it('renders a blank rule for what the database does not know', async () => {
    // Education and religion are not stored on the person: the social worker
    // writes them in, exactly like on the paper form.
    const buf = await buildScsrPdf({ ...base, kind: 'burial' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // The labels are still there so the line has a place to be written under.
    const text = searchableText(buf);
    expect(text).toContain('Natapos sa Pag-aaral');
    expect(text).toContain('Realiyon');
  });

  it('lists the household it was given', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      name: `MEMBER ${i + 1}`, age: String(20 + i), relationship: 'ANAK', occupation: '', income: '',
    }));
    const text = searchableText(await buildScsrPdf({ ...base, kind: 'burial', family: many }));
    for (let i = 1; i <= 8; i++) expect(text).toContain(`MEMBER ${i}`);
  });
});
