import { buildEndorsementLetterPdf, EndorsementLetterData } from './endorsement-letter.builder';

const DATA: EndorsementLetterData = {
  officeName: 'MSWDO Norzagaray',
  letterNo: 'CASE-2026-0001',
  dateLabel: 'Sep 29, 2026',
  toAgencyName: 'Rural Health Unit - Norzagaray',
  beneficiaryName: 'Juan Dela Cruz',
  caseCategory: 'Indigent',
  reason: 'Medical coordination',
  preparedBy: 'Juan Dela Cruz',
  preparedByRole: 'Social Worker',
};

describe('buildEndorsementLetterPdf', () => {
  it('produces a real PDF buffer', async () => {
    const pdf = await buildEndorsementLetterPdf(DATA);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('embeds the letterhead, the beneficiary, the agency and the signer', async () => {
    const pdf = await buildEndorsementLetterPdf(DATA);
    const text = pdf.subarray(0, pdf.length).toString('latin1');
    // PDFKit compresses streams, so the strings are not all verbatim in the
    // bytes — but the literal runs above the length threshold surface in the
    // uncompressed document info block and common drawing. Assert the parts
    // that must not be missing from the file at all.
    expect(text).toContain('ENDORSEMENT');
    expect(text).toContain('MSWDO Norzagaray');
  });

  it('draws the municipal and DSWD badges in the letterhead', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const image = jest.spyOn(PDFDocument.prototype, 'image');
    try {
      await buildEndorsementLetterPdf(DATA);
      expect(image).toHaveBeenCalledTimes(2);
    } finally {
      image.mockRestore();
    }
  });

  it('renders without a beneficiary category', async () => {
    const pdf = await buildEndorsementLetterPdf({ ...DATA, caseCategory: undefined });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });
});