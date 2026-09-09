import { AccessCardPdfData } from './access-card-pdf.types';

const PAGE_BOTTOM = 790;
const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT; // 495

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
const SERVICES_COLS = [37, 94, 67, 49.5]; // sums to WIDTH/2 = 247.5

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
  doc.rect(x, y, SERVICES_COLS.reduce((a, b) => a + b, 0), 14).fillColor('#e6e6e6').fill();
  SERVICES_HEADER.forEach((label, i) => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
      .text(label, cx + 2, y + 2, { width: SERVICES_COLS[i] - 4, ellipsis: true });
    doc.rect(cx, y, SERVICES_COLS[i], 14).lineWidth(0.5).strokeColor('#999').stroke();
    cx += SERVICES_COLS[i];
  });
  return y + 14;
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
      doc.font('Helvetica').fontSize(8).fillColor('#111')
        .text(vals[ci] || '', cx + 2, y + 5, { width: w - 4, ellipsis: true });
      cx += w;
    });
    y += 18;
  }
  return y;
}

export async function buildAccessCardPdf(data: AccessCardPdfData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 38, bottom: 40, left: LEFT - 15, right: RIGHT + 15 },
    info: {
      Title: `Access Card ${data.code}`,
      Author: 'MSWDO Norzagaray',
      Subject: 'Family Access Card — Client Service Record',
      Keywords: [data.code, data.client.surname, data.client.firstName, ...data.familyMembers.map(m => m.fullName)].filter(Boolean).join(' | '),
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // ================= PAGE 1: PAALALA AT GABAY (left) + services table start (right) =================
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
    .text('PAALALA AT GABAY', LEFT + 2, 48);
  doc.moveTo(LEFT, 62).lineTo(LEFT + WIDTH, 62).lineWidth(0.8).strokeColor('#111').stroke();

  let py = 72;
  PAALALA_LINES.forEach(line => {
    doc.font(line.startsWith('-') ? 'Helvetica' : 'Helvetica-Bold')
      .fontSize(8).fillColor('#111')
      .text(line, LEFT + 4, py, { width: WIDTH / 2 - 14 });
    py = doc.y + 6;
  });

  // Right column: services table start
  let sy = 48;
  sy = drawServicesHeader(doc, LEFT + WIDTH / 2, sy);
  drawServiceRows(doc, LEFT + WIDTH / 2, sy, data.services, 8);

  // ================= PAGE 2: services continuation (left) + client info (right) =================
  doc.addPage();

  // Left column: continue services table
  let sy2 = 48;
  sy2 = drawServicesHeader(doc, LEFT, sy2);
  drawServiceRows(doc, LEFT, sy2, data.services, 12);

  // Right column: header + client + family composition + signatures
  const rx = LEFT + WIDTH / 2;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111')
    .text('Republic of the Philippines', rx + 10, 42, { align: 'right', width: WIDTH / 2 - 20 });
  doc.font('Helvetica').fontSize(8)
    .text('Province of Bulacan', rx + 10, 52, { align: 'right', width: WIDTH / 2 - 20 });
  doc.text('Municipality of Norzagaray', rx + 10, 60, { align: 'right', width: WIDTH / 2 - 20 });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#222')
    .text('MUNICIPAL SOCIAL WELFARE & DEVELOPMENT OFFICE', rx + 10, 68, { align: 'right', width: WIDTH / 2 - 20 });

  doc.moveTo(rx, 80).lineTo(RIGHT, 80).lineWidth(0.8).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text('Code #', rx + 10, 84, { width: 60 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.code, rx + 60, 84, { width: WIDTH / 2 - 70 });
  doc.font('Helvetica-Bold').fontSize(7.5)
    .text('Barangay:', rx + 10, 96, { width: 60 });
  doc.font('Helvetica').fontSize(8)
    .text(data.barangay, rx + 60, 96, { width: WIDTH / 2 - 70 });
  doc.font('Helvetica-Bold').fontSize(7.5)
    .text('Contact #', rx + 10, 108, { width: 60 });
  doc.font('Helvetica').fontSize(8)
    .text(data.contact, rx + 60, 108, { width: WIDTH / 2 - 70 });

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('CLIENT', rx + 10, 124);
  doc.moveTo(rx, 134).lineTo(RIGHT, 134).lineWidth(0.8).strokeColor('#111').stroke();

  let cy = 140;
  const fieldRow = (x: number, y: number, w: number, label: string, value: string): void => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
      .text(label, x + 2, y + 1, { width: w - 4, ellipsis: true });
    doc.moveTo(x, y + 16).lineTo(x + w, y + 16).lineWidth(0.5).strokeColor('#999').stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
      .text(value || '', x + 2, y - 8, { width: w - 2, ellipsis: true });
  };

  fieldRow(rx + 10, cy, 80, 'Surname', data.client.surname);
  fieldRow(rx + 95, cy, 90, 'First Name', data.client.firstName);
  fieldRow(rx + 190, cy, 60, 'Middle Name', data.client.middleName ?? '');
  cy += 24;

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555').text('Gender:', rx + 10, cy, { width: 60 });
  doc.rect(rx + 60, cy, 7, 7).lineWidth(0.5).strokeColor('#111').stroke();
  if (data.client.gender === 'Male') doc.rect(rx + 61, cy + 1, 5, 5).fillColor('#111').fill();
  doc.font('Helvetica').fontSize(7.5).fillColor('#111').text('MALE', rx + 70, cy, { width: 60 });
  doc.rect(rx + 115, cy, 7, 7).lineWidth(0.5).strokeColor('#111').stroke();
  if (data.client.gender === 'Female') doc.rect(rx + 116, cy + 1, 5, 5).fillColor('#111').fill();
  doc.font('Helvetica').fontSize(7.5).fillColor('#111').text('FEMALE', rx + 125, cy, { width: 70 });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('Date of Birth:', rx + 10, cy + 14, { width: 70 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(fmtDate(data.client.dob), rx + 70, cy + 14, { width: 100 });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text('Address:', rx + 10, cy + 28, { width: 60 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(data.client.address || '', rx + 60, cy + 28, { width: WIDTH / 2 - 70, ellipsis: true });

  cy += 52;

  // Family Composition
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('FAMILY COMPOSITION', rx + 10, cy);
  cy += 12;
  const famCols = [
    { label: 'Family Members', w: 90 },
    { label: 'Relationship', w: 55 },
    { label: 'Age', w: 20 },
    { label: 'Status / Income', w: 60 },
  ];
  let fx = rx + 10;
  doc.rect(rx + 10, cy, 225, 12).fillColor('#e6e6e6').fill();
  famCols.forEach(c => {
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111').text(c.label, fx + 2, cy + 2.5, { width: c.w - 4, ellipsis: true });
    doc.rect(fx, cy, c.w, 12).lineWidth(0.5).strokeColor('#999').stroke();
    fx += c.w;
  });
  cy += 12;
  const totalFam = Math.max(4, data.familyMembers.length);
  for (let i = 0; i < totalFam; i++) {
    const m = data.familyMembers[i];
    const vals = [
      m?.fullName ?? '', m?.relationship ?? '',
      m?.age != null ? String(m.age) : '',
      m?.status ? `${m.status}${m.income != null ? ` (${m.income})` : ''}` : (m?.income != null ? String(m.income) : ''),
    ];
    fx = rx + 10;
    famCols.forEach((c, ci) => {
      doc.rect(fx, cy, c.w, 16).lineWidth(0.5).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#111')
        .text(vals[ci] || '', fx + 2, cy + 4, { width: c.w - 4, ellipsis: true });
      fx += c.w;
    });
    cy += 16;
  }

  cy += 16;
  const sigY = Math.max(cy, 700);
  // Signature line helper
  const sigLine = (x: number, y: number, w: number, role: string): void => {
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.5).strokeColor('#111').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#555').text(role, x, y + 4, { width: w, align: 'center' });
  };
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text('Signature of Applicant\nor Thumbmark', rx + 10, sigY - 30, { width: 110 });
  sigLine(rx + 10, sigY, 110, 'Barangay Captain');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text('Name and Signature of\nSocial Worker', rx + 200, sigY - 30, { width: 130 });
  sigLine(rx + 200, sigY, 130, 'Municipal Mayor');

  doc.font('Helvetica').fontSize(5.5).fillColor('#888')
    .text(
      'Municipal Social Welfare and Development Office | Norzagaray, Bulacan',
      LEFT, 792, { align: 'center', width: WIDTH },
    );

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
