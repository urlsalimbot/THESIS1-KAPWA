import * as path from 'path';
import * as fs from 'fs';

/**
 * Social Case Study Report — the office's burial and medical forms, digitized.
 *
 * The two paper forms (pdf-samples/SCSR-Buryal, SCSR-Medikal) share a skeleton:
 * client data, a family table, and a list of interview questions. What the
 * database already knows is filled in; what only the social worker can answer
 * (education, religion, the interview answers) is left as a rule to write on —
 * the same way the paper form does it.
 *
 * The rendered style follows the office's own Word template
 * (pdf-samples/SCSR-output1/2): letterhead with both seals, a centred title,
 * Petsa, the numbered sections, a bordered family table, and the two signature
 * blocks at the end.
 */

export type ScsrKind = 'burial' | 'medical';

export interface ScsrFamilyRow {
  name: string;
  age: string;
  relationship: string;
  occupation: string;
  income: string;
}

export interface ScsrPdfInput {
  kind: ScsrKind;
  officeName: string;
  controlNo: string;
  /** "SETYEMBRE 17, 2026" — already localised. */
  petsa: string;
  client: {
    pangalan: string;
    edad: string;
    kaarawan: string;
    lugar: string;
    /** Empty means "write it in": rendered as a rule, like the paper form. */
    natapos: string;
    tirahan: string;
    estado: string;
    kasarian: string;
    hanapbuhay: string;
    relihiyon: string;
    pinagkunan: string;
    contact: string;
  };
  family: ScsrFamilyRow[];
  preparedByName: string;
  preparedByRole: string;
  notedByName: string;
  notedByRole: string;
}

const TITLE: Record<ScsrKind, string> = { burial: '(BURYAL)', medical: '(MEDIKAL)' };

const A4: [number, number] = [595.28, 841.89];
const M = 54;
const LEFT = M;
const RIGHT = A4[0] - M;
const WIDTH = RIGHT - LEFT;

/** Interview questions, in the order they appear on the paper form. */
const QUESTIONS: Record<ScsrKind, { family: string[]; specific: string[] }> = {
  burial: {
    family: [
      'Saan isinilang silang mag-asawa?',
      'Kung walang asawa, saan isinilang ang mga magulang?',
      'Kailan ikinasal?',
      'Kung hiwalay, kailan nagkahiwalay?',
      'Kung nagsasama, ilang taon na nagsasama?',
      'Saan nagkakilala? Anong okasyon o pangyayari?',
      'Ilang taon nang nakatira dito sa Norzagaray?',
      'Ilan ang anak?',
      'Ano ang kanilang pinagkukunan ng ikinabubuhay ng pamilya?',
      'Sino kasama sa bahay?',
      'May sariling linya ba ng kuryente at tubig?',
      'Kung wala, saan o kanino nakatira?',
      'Sino ang naghahanap buhay sa pamilya at ano ang hanapbuhay nito?',
    ],
    specific: [
      'Ano ang inilalapit na tulong?',
      'Kailan namatay?',
      'Magkano ang bayarin sa punenarya?',
      'Kanino dadalhin ang case study?',
    ],
  },
  medical: {
    family: [
      'Saan isinilang silang mag-asawa?',
      'Kung walang asawa, saan isinilang ang mga magulang?',
      'Kailan ikinasal?',
      'Kung hiwalay, kailan nagkahiwalay?',
      'Kung nagsasama, ilang taon na nagsasama?',
      'Saan nagkakilala? Anong okasyon o pangyayari?',
      'Ilang taon nang nakatira dito sa Norzagaray?',
      'Ilan ang anak?',
      'Kung walang asawa, ilan magkakapatid?',
      'Ano ang kanilang pinagkukunan ng ikinabubuhay ng pamilya?',
      'Sino kasama sa bahay?',
      'May sarili bang bahay? Saan ito yari?',
      'Kung wala sariling bahay, saan o kanino nakatira?',
      'May sariling linya ba ng kuryente at tubig?',
      'Sino ang naghahanap buhay sa pamilya at ano ang hanapbuhay nito?',
      'Ano ang karadaman at kailan nagsimula ito?',
    ],
    specific: [
      'Kung naka-confine, saan at kailan pa?',
      'Kung hindi, outpatient na ba?',
      'Ano ang inilalapit ng tulong?',
      'Ano ang gamutan na kailangan gawin sa kliyente?',
      'Ano ang kalagayan ng kliyente sa kasalukuyan?',
      'Saan siya nanapu ng tulong?',
    ],
  },
};

/** Family table columns differ slightly per form; `w` sums to 1. */
const FAMILY_COLS: Record<ScsrKind, Array<{ label: string; w: number; key: keyof ScsrFamilyRow }>> = {
  burial: [
    { label: 'PANGALAN', w: 0.32, key: 'name' },
    { label: 'RELASYON', w: 0.14, key: 'relationship' },
    { label: 'EDAD', w: 0.08, key: 'age' },
    { label: 'KATAYUAN/HANAPBUHAY', w: 0.28, key: 'occupation' },
    { label: 'HALAGA NG KINIKITA', w: 0.18, key: 'income' },
  ],
  medical: [
    { label: 'PANGALAN', w: 0.30, key: 'name' },
    { label: 'EDAD', w: 0.08, key: 'age' },
    { label: 'RELASYON SA KLIYENTE', w: 0.18, key: 'relationship' },
    { label: 'STATUS SA BUHAY/AT HANAPBUHAY', w: 0.26, key: 'occupation' },
    { label: 'HALAGA NG KINIKITA', w: 0.18, key: 'income' },
  ],
};

export async function buildScsrPdf(input: ScsrPdfInput): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: A4,
    margins: { top: M, bottom: M, left: M, right: M },
    info: {
      Title: `SCSR ${TITLE[input.kind]} ${input.controlNo}`,
      Author: input.officeName,
      Subject: 'Social Case Study Report',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, input);
  drawTitle(doc, input);
  drawClientData(doc, input);
  drawFamilyTable(doc, input);
  drawQuestions(doc, input);
  drawSignatures(doc, input);

  doc.end();
  return done;
}

// A rule to write on. Used for everything the database does not know — the same
// blanks the paper form has.
function blankRule(doc: any, x: number, y: number, w: number) {
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).strokeColor('#555').stroke();
}

function drawLetterhead(doc: any, input: ScsrPdfInput) {
  const sealPath = path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png');
  const dswdPath = path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
  const BADGE = 52;

  if (fs.existsSync(sealPath)) { try { doc.image(sealPath, LEFT, M, { fit: [BADGE, BADGE] }); } catch { /* seal omitted */ } }
  if (fs.existsSync(dswdPath)) { try { doc.image(dswdPath, RIGHT - BADGE, M, { fit: [BADGE, BADGE] }); } catch { /* seal omitted */ } }

  doc.font('Helvetica').fontSize(9.5).fillColor('#111');
  doc.text('Republic of the Philippines', LEFT, M + 2, { width: WIDTH, align: 'center' });
  doc.text('Province of Bulacan', { align: 'center' });
  doc.text('Municipality of Norzagaray', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11.5)
    .text(input.officeName.toUpperCase(), { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).lineWidth(0.8).strokeColor('#111').stroke();
  doc.y += 6;
}

function drawTitle(doc: any, input: ScsrPdfInput) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111')
    .text('SOCIAL CASE STUDY REPORT', LEFT, doc.y, { width: WIDTH, align: 'center' });
  doc.y += 18;
  doc.font('Helvetica-Bold').fontSize(11)
    .text(TITLE[input.kind], { width: WIDTH, align: 'center' });
  doc.y += 18;
  doc.font('Helvetica').fontSize(10)
    .text(`Petsa: ${input.petsa}`, { width: WIDTH, align: 'center' });
  doc.y += 16;
}

function drawClientData(doc: any, input: ScsrPdfInput) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('I.    DATOS NG KLIYENTE', LEFT, doc.y);
  doc.y += 6;

  const LABEL_W = 172;
  const rows: Array<[string, string]> = [
    ['Pangalan', input.client.pangalan],
    ['Edad', input.client.edad],
    ['Kaarawan', input.client.kaarawan],
    ['Lugar ng kapanganakan', input.client.lugar],
    ['Natapos sa Pag-aaral', input.client.natapos],
    ['Tirahan', input.client.tirahan],
    ['Estado/katayuan', input.client.estado],
    ['Kasarian', input.client.kasarian],
    ['Hanapbuhay', input.client.hanapbuhay],
    ['Realiyon', input.client.relihiyon],
    ['Pinagkunan ng Impormasyon', input.client.pinagkunan],
    ['Contact Number', input.client.contact],
  ];

  rows.forEach(([label, value]) => {
    if (doc.y > A4[1] - M - 40) doc.addPage();
    const y = doc.y + 2;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111')
      .text(label, LEFT, y, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9.5)
      .text(':', LEFT + LABEL_W - 8, y, { lineBreak: false });
    if (value) {
      doc.font('Helvetica-Bold').fontSize(9.5)
        .text(value, LEFT + LABEL_W, y, { width: WIDTH - LABEL_W, lineBreak: false });
      doc.y = y + 14;
    } else {
      // Nothing in the database for this one: leave the paper form's blank.
      blankRule(doc, LEFT + LABEL_W, y + 10, WIDTH - LABEL_W);
      doc.y = y + 14;
    }
  });
  doc.y += 8;
}

function drawFamilyTable(doc: any, input: ScsrPdfInput) {
  if (doc.y > A4[1] - M - 120) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('II.    BUMUBUO NG PAMILYA', LEFT, doc.y);
  doc.y += 8;

  const cols = FAMILY_COLS[input.kind];
  const xs: number[] = [];
  let x = LEFT;
  for (const c of cols) { xs.push(x); x += c.w * WIDTH; }
  xs.push(RIGHT);

  const HEADER_H = 26;
  const ROW_H = 20;
  // Five rows, as on the paper form: the office keeps writing by hand when the
  // household is larger, and an empty table looks like a missing section.
  const rows = [...input.family];
  while (rows.length < 5) rows.push({ name: '', age: '', relationship: '', occupation: '', income: '' });

  const top = doc.y;
  doc.rect(LEFT, top, WIDTH, HEADER_H + rows.length * ROW_H).lineWidth(0.6).strokeColor('#111').stroke();
  cols.forEach((c, i) => {
    doc.moveTo(xs[i], top).lineTo(xs[i], top + HEADER_H + rows.length * ROW_H).lineWidth(0.6).strokeColor('#111').stroke();
  });
  doc.moveTo(LEFT, top + HEADER_H).lineTo(RIGHT, top + HEADER_H).lineWidth(0.6).strokeColor('#111').stroke();
  for (let i = 1; i <= rows.length; i++) {
    doc.moveTo(LEFT, top + HEADER_H + i * ROW_H).lineTo(RIGHT, top + HEADER_H + i * ROW_H).lineWidth(0.6).strokeColor('#111').stroke();
  }

  cols.forEach((c, i) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
      .text(c.label, xs[i] + 3, top + 6, { width: xs[i + 1] - xs[i] - 6, align: 'center' });
  });
  rows.forEach((r, ri) => {
    cols.forEach((c, i) => {
      const value = String(r[c.key] ?? '');
      if (!value) return;
      doc.font('Helvetica').fontSize(8.5).fillColor('#111')
        .text(value, xs[i] + 4, top + HEADER_H + ri * ROW_H + 5, {
          width: xs[i + 1] - xs[i] - 8, lineBreak: false, ellipsis: true,
        });
    });
  });
  doc.y = top + HEADER_H + rows.length * ROW_H + 14;
}

function drawQuestions(doc: any, input: ScsrPdfInput) {
  const section = (title: string, questions: string[]) => {
    if (doc.y > A4[1] - M - 60) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
      .text(title, LEFT, doc.y);
    doc.y += 8;
    questions.forEach((q) => {
      if (doc.y > A4[1] - M - 34) doc.addPage();
      doc.font('Helvetica').fontSize(9.5).fillColor('#111')
        .text(q, LEFT, doc.y, { lineBreak: false });
      doc.y += 13;
      blankRule(doc, LEFT, doc.y, WIDTH);
      doc.y += 12;
    });
    doc.y += 4;
  };

  section('TUNGKOL SA PAMILYA', QUESTIONS[input.kind].family);
  section('TUNGKOL SA PANGANGAILANGAN', QUESTIONS[input.kind].specific);
}

function drawSignatures(doc: any, input: ScsrPdfInput) {
  if (doc.y > A4[1] - M - 120) doc.addPage();
  const top = doc.y + 16;
  const half = WIDTH / 2;

  doc.font('Helvetica').fontSize(9.5).fillColor('#111')
    .text('Inihanda ni:', LEFT, top, { lineBreak: false })
    .text('Sa Kaalaman ni:', LEFT + half, top, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(10)
    .text(input.preparedByName, LEFT, top + 42, { lineBreak: false })
    .text(input.notedByName, LEFT + half, top + 42, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(input.preparedByRole, LEFT, top + 55, { lineBreak: false })
    .text(input.notedByRole, LEFT + half, top + 55, { lineBreak: false });
  doc.y = top + 66;
}
