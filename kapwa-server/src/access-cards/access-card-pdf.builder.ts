import * as path from 'path';
import * as fs from 'fs';
import { AccessCardPdfData } from './access-card-pdf.types';
import { MUNICIPAL_MAYOR, ORG_LOCATION } from '../common/constants';

const PAGE_BOTTOM = 790;
const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT; // 495
const HALF = WIDTH / 2; // 247.5

// Pre-printed signature names on the Family Access Card (reference form
// ACCESS-CARD-COVER). The worker is stamped on the card itself; the mayor
// reuses the system-wide MUNICIPAL_MAYOR constant (honorific stripped to match
// the printed form). Mirrors APPROVER_NAME/APPROVER_ROLE in gis-pdf.builder.ts.
const SOCIAL_WORKER_NAME = 'ANNALYN JOY C. SAN PEDRO, RSW';
const SOCIAL_WORKER_ROLE = 'SWO - V (MSWDO)';
const MAYOR_NAME = MUNICIPAL_MAYOR.name.replace(/^HON\.\s*/i, '');
const MAYOR_ROLE = 'Municipal Mayor';

const PAALALA_LINES = [
  '1. Ang FAMILY ACCESS CARD ay para sa 1 pamilya o sambahayan (household) na naninirahan sa Norzagaray',
  '- Ang binata o dalaga ay bukod na bibigyan lamang kung walang kasama sa bahay',
  '2. CLIENT - Pangalan ng pasyente o malimit na nangangailangan ng tulong o pangunahing nakasaad sa Access Card',
  '- Alin man sa miyembro ng pamilyang nakasaad ay maaaring magawaran ng tulong at isaad lamang ang uri ng tulong na naigawad sa sino mang miyembro ng pamilya',
  '3. Pagpapalit ng Access Card - Isang CODE NUMBER lamang ang gagamitin',
  '- Valid kung pumanaw ang CLIENT',
  '- Valid kung nawala ang Access Card dahil sa sakuna',
  '4. Naiwan ang Access Card sa ano mang kadahilanan:',
  '- Sa susunod na buwan na lamang makahihingi ng tulong',
  '- Hanggat hindi nakikita ang card ay hindi magagawan ng financial assistance voucher',
  '',
  'Ito ay bahagi ng disiplina na minumulat sa mga Garayefio upang makasanayan ang pantay na pagtulong sa kapwa, ukol sa pamilyang lumalapit sapagkat ang pamahalaan ay naglalaan sa mga nangangailangan na walang ibang uri ng suporta o pagkakaroon ng malubhang karamdaman o ano mang uri ng krisis sa buhay.',
  '',
  'Obligasyon ng pamahalaan na tumulong sa mga walang kakayahan punan ang pangangailangan, samantalang responsibilidad ng bawat mamamayan na magsikap, hindi isasa sa pamahalaan ang kayang pagsikapan at makatulong sa pag-unlad ng bayan ng Norzagaray.',
  '',
  'Ang pagpapayo ng kawani ay tungkulin sa bayan at ang pagsunod sa panuntunan ay tulong sa pag-unlad ng inyong pamilya.',
  '',
  'Ito ay maaari ring dalhin sa iba pang sangay ng pamahalaan maging sa pribadong sangay upang madagdagan sa monitoring ng pamilya.',
];

const SERVICES_HEADER = ['DATE', 'SERVICES RENDERED\n(Including Cost if any)', 'BY AGENCY', "WORKER'S NAME\n& SIGNATURE"];
const SERVICES_COLS = [44, 89, 66, 48.5]; // sums to WIDTH/2 = 247.5

function fmtDate(v?: Date | string): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function drawServicesHeader(doc: any, x: number, y: number): number {
  let cx = x;
  doc.rect(x, y, SERVICES_COLS.reduce((a, b) => a + b, 0), 18).fillColor('#e6e6e6').fill();
  SERVICES_HEADER.forEach((label, i) => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
      .text(label, cx + 2, y + 3, { width: SERVICES_COLS[i] - 4, height: 15 });
    doc.rect(cx, y, SERVICES_COLS[i], 18).lineWidth(0.5).strokeColor('#999').stroke();
    cx += SERVICES_COLS[i];
  });
  return y + 18;
}

function drawServiceRows(doc: any, x: number, y: number, rows: AccessCardPdfData['services'], minRows: number): number {
  const total = Math.max(minRows, rows.length);
  for (let i = 0; i < total; i++) {
    if (y + 18 > PAGE_BOTTOM) {
      doc.addPage();
      y = 60;
      y = drawServicesHeader(doc, x, y);
    }
    const row = rows[i];
    const vals = [
      row?.date ?? '',
      row?.rendered ?? '',
      row?.agency ?? '',
      row?.worker ?? '',
    ];
    let cx = x;
    SERVICES_COLS.forEach((w, ci) => {
      doc.rect(cx, y, w, 18).lineWidth(0.5).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#111')
        .text(vals[ci] || '', cx + 2, y + 5, { width: w - 4, height: 11, ellipsis: true });
      cx += w;
    });
    y += 18;
  }
  return y;
}

// Client's Record of Services Availed table (title + header + fixed rows).
function drawServicesPanel(doc: any, x: number, y: number, services: AccessCardPdfData['services'], minRows: number): void {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text("CLIENT'S RECORD OF SERVICES AVAILED", x + 1, y, { width: HALF - 2 });
  const headerY = drawServicesHeader(doc, x, y + 11);
  drawServiceRows(doc, x, headerY, services, minRows);
}

// PAALALA AT GABAY — boxed heading followed by the numbered reminders.
function drawPaalala(doc: any, x: number, y: number): void {
  doc.rect(x, y, HALF, 18).lineWidth(0.8).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111')
    .text('PAALALA AT GABAY', x, y + 4, { width: HALF, align: 'center' });

  let py = y + 18 + 10;
  PAALALA_LINES.forEach(line => {
    doc.font(line.startsWith('-') ? 'Helvetica' : 'Helvetica-Bold')
      .fontSize(8).fillColor('#111')
      .text(line, x + 4, py, { width: HALF - 14 });
    py = doc.y + 6;
  });
}

// Cover side of the card: photo box, seals, letterhead, client details,
// family composition and the signature block.
function drawClientCover(doc: any, x: number, data: AccessCardPdfData): void {
  const officeName = data.officeName ?? 'Municipal Social Welfare and Development Office';

  // Photo box + label
  doc.rect(x + 10, 40, 66, 66).lineWidth(0.6).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111').text('CLIENT', x + 10, 107, { width: 66 });

  // Municipal seal + DSWD logo to the right of the photo box
  const sealPath = path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png');
  const dswdPath = path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
  if (fs.existsSync(sealPath)) {
    try { doc.image(sealPath, x + 80, 42, { fit: [42, 42] }); } catch { /* header renders without the seal */ }
  }
  if (fs.existsSync(dswdPath)) {
    try { doc.image(dswdPath, x + 124, 42, { fit: [42, 42] }); } catch { /* header renders without the logo */ }
  }

  // Letterhead (right of the seals)
  const lhX = x + 170;
  const lhW = RIGHT - lhX;
  doc.font('Helvetica-Bold').fontSize(5).fillColor('#111').text(ORG_LOCATION.country, lhX, 40, { width: lhW, align: 'right' });
  doc.font('Helvetica').fontSize(5).fillColor('#111')
    .text(`Province of ${ORG_LOCATION.province}`, lhX, 48, { width: lhW, align: 'right' })
    .text(`Municipality of ${ORG_LOCATION.municipality}`, lhX, 56, { width: lhW, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(5).fillColor('#222')
    .text(officeName.toUpperCase(), lhX, 64, { width: lhW, align: 'right' });

  // Code number (below the letterhead, right-aligned)
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text(`Code # ${data.code}`, lhX, 90, { width: lhW, align: 'right', lineBreak: false });

  // Barangay / contact strip
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#111').text('Barangay:', x + 10, 120, { width: 50 });
  doc.font('Helvetica').fontSize(7.5).text(data.barangay, x + 60, 120, { width: 72, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#111').text('Contact #', x + 140, 120, { width: 55 });
  doc.font('Helvetica').fontSize(7.5).text(data.contact, x + 195, 120, { width: 50, lineBreak: false });

  doc.moveTo(x, 134).lineTo(RIGHT, 134).lineWidth(0.8).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text('CLIENT', x + 10, 137);

  const fieldRow = (fx: number, fy: number, w: number, label: string, value: string): void => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
      .text(label, fx + 2, fy + 1, { width: w - 4, ellipsis: true });
    doc.moveTo(fx, fy + 16).lineTo(fx + w, fy + 16).lineWidth(0.5).strokeColor('#999').stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
      .text(value || '', fx + 2, fy - 8, { width: w - 2, ellipsis: true });
  };

  let cy = 156;
  fieldRow(x + 10, cy, 80, 'Surname', data.client.surname);
  fieldRow(x + 95, cy, 90, 'First Name', data.client.firstName);
  fieldRow(x + 190, cy, 55, 'Middle Name', data.client.middleName ?? '');
  cy += 24;

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555').text('Gender:', x + 10, cy, { width: 60 });
  doc.rect(x + 60, cy, 7, 7).lineWidth(0.5).strokeColor('#111').stroke();
  if (data.client.gender === 'Male') doc.rect(x + 61, cy + 1, 5, 5).fillColor('#111').fill();
  doc.font('Helvetica').fontSize(7.5).fillColor('#111').text('MALE', x + 70, cy, { width: 60 });
  doc.rect(x + 115, cy, 7, 7).lineWidth(0.5).strokeColor('#111').stroke();
  if (data.client.gender === 'Female') doc.rect(x + 116, cy + 1, 5, 5).fillColor('#111').fill();
  doc.font('Helvetica').fontSize(7.5).fillColor('#111').text('FEMALE', x + 125, cy, { width: 70 });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('Date of Birth:', x + 10, cy + 14, { width: 70 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(fmtDate(data.client.dob), x + 70, cy + 14, { width: 100 });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('Address:', x + 10, cy + 28, { width: 60 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(data.client.address || '', x + 60, cy + 28, { width: HALF - 70, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('NHTS-PR / Listahanan ID:', x + 10, cy + 40, { width: 95 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(data.nhtsPrId || '', x + 95, cy + 40, { width: HALF - 105, ellipsis: true });

  cy += 64;

  // Family Composition
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('FAMILY COMPOSITION', x + 10, cy);
  cy += 12;
  const famCols = [
    { label: 'Family Members', w: 90 },
    { label: 'Relationship', w: 55 },
    { label: 'Age', w: 20 },
    { label: 'Status / Income', w: 60 },
  ];
  let fx = x + 10;
  doc.rect(x + 10, cy, 225, 12).fillColor('#e6e6e6').fill();
  famCols.forEach(c => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111').text(c.label, fx + 2, cy + 2.5, { width: c.w - 4, ellipsis: true });
    doc.rect(fx, cy, c.w, 12).lineWidth(0.5).strokeColor('#999').stroke();
    fx += c.w;
  });
  cy += 12;
  const totalFam = Math.max(8, data.familyMembers.length);
  for (let i = 0; i < totalFam; i++) {
    const m = data.familyMembers[i];
    const vals = [
      m?.fullName ?? '', m?.relationship ?? '',
      m?.age != null ? String(m.age) : '',
      m?.status ? `${m.status}${m.income != null ? ` (${m.income})` : ''}` : (m?.income != null ? String(m.income) : ''),
    ];
    fx = x + 10;
    famCols.forEach((c, ci) => {
      doc.rect(fx, cy, c.w, 16).lineWidth(0.5).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#111')
        .text(vals[ci] || '', fx + 2, cy + 4, { width: c.w - 4, ellipsis: true });
      fx += c.w;
    });
    cy += 16;
  }

  // Signature block
  const sigY = Math.max(cy + 16, 690);
  const sigLine = (sx: number, sy: number, w: number): void => {
    doc.moveTo(sx, sy).lineTo(sx + w, sy).lineWidth(0.5).strokeColor('#111').stroke();
  };

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Signature of\nApplicant or Thumbmark', x + 8, sigY - 30, { width: 70 });
  sigLine(x + 8, sigY, 70);
  doc.font('Helvetica').fontSize(6.5).fillColor('#555').text('Barangay Captain', x + 8, sigY + 4, { width: 70, align: 'center' });

  doc.rect(x + 115, sigY - 30, 30, 30).lineWidth(0.5).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#111')
    .text(SOCIAL_WORKER_NAME, x + 82, sigY + 4, { width: 96, align: 'center' });
  doc.font('Helvetica').fontSize(5).fillColor('#555')
    .text(SOCIAL_WORKER_ROLE, x + 82, sigY + 12, { width: 96, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Name and Signature\nof Social Worker', x + 182, sigY - 30, { width: 63 });
  sigLine(x + 182, sigY, 63);
  doc.font('Helvetica-Bold').fontSize(4.5).fillColor('#111')
    .text(MAYOR_NAME, x + 182, sigY + 4, { width: 63, align: 'center' });
  doc.font('Helvetica').fontSize(4.5).fillColor('#555')
    .text(MAYOR_ROLE, x + 182, sigY + 11, { width: 63, align: 'center' });
}

export async function buildAccessCardPdf(data: AccessCardPdfData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 38, bottom: 40, left: LEFT - 15, right: RIGHT + 15 },
    info: {
      Title: `Access Card ${data.code}`,
      Author: data.officeName ?? 'Municipal Social Welfare and Development Office',
      Subject: 'Family Access Card — Client Service Record',
      Keywords: [data.code, data.client.surname, data.client.firstName, ...data.familyMembers.map(m => m.fullName)].filter(Boolean).join(' | '),
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // ================= PAGE 1 (cover side): services left, client cover right =================
  drawServicesPanel(doc, LEFT, 48, data.services, 14);
  drawClientCover(doc, LEFT + WIDTH / 2, data);

  // ================= PAGE 2 (inner side): PAALALA left, services right =================
  doc.addPage();
  drawPaalala(doc, LEFT, 48);
  drawServicesPanel(doc, LEFT + WIDTH / 2, 48, data.services, 14);

  const officeName = data.officeName ?? 'Municipal Social Welfare and Development Office';
  doc.font('Helvetica').fontSize(5.5).fillColor('#888')
    .text(
      `${officeName} | ${ORG_LOCATION.municipality}, ${ORG_LOCATION.province}`,
      LEFT, 792, { align: 'center', width: WIDTH },
    );

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
