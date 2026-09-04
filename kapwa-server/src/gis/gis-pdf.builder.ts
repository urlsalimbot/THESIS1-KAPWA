import * as path from 'path';
import * as fs from 'fs';
import { GisPdfData } from './gis-export.types';

const FORM_NUMBER = 'DSWD PMB-FO3-07-011 | REV 01 / 30 SEPT 2022';
const BANNER_TEXT = 'MAARING MAGPATULONG SUMAGOT SA DSWD PERSONNEL';
const ASSESSMENT_TEXT =
  'It is evident that the family is in dire need of financial augmentation since their ' +
  'total income does not meet what is required to attain survival due to the increasing ' +
  'cost of living in the country and the existence of a health crisis. ' +
  'Support from relatives and friends cannot be relied on because they have similar ' +
  'unfortunate situations; therefore financial assistance from the program is hereby ' +
  'recommended by the undersigned.';
const DECLARATION_TEXT =
  'I declare under oath that I personally accomplished the GIS Form and all the ' +
  'information herein stated is TRUE, CORRECT, VALID, and COMPLETE, pursuant to existing ' +
  'laws, rules, and regulations of the Philippines. I authorized the Agency/Head of ' +
  'Local Cooperatives/entities to avail the contents listed in place of my signature in ' +
  'consideration of the said complaint and/or information. Accordingly, the Municipality, ' +
  'which allegedly induced documents, shall cause the filing of appropriate cases against me.';

const PAGE_BOTTOM = 790;
const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT; // 495

function fmtDate(v?: Date | string): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function fmtMoney(v?: number): string {
  if (v == null || Number.isNaN(Number(v))) return '';
  return Number(v).toLocaleString('en-PH');
}

function sectionHeader(doc: any, text: string, subtext: string): void {
  doc.rect(LEFT, doc.y - 4, WIDTH, 14).fillColor('#d9d9d9').fill();
  doc
    .font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text(text, LEFT + 5, doc.y - 2, { continued: true })
    .font('Helvetica').fontSize(7)
    .text(`  ${subtext}`, { align: 'right', width: WIDTH - 10 });
  doc.y += 6;
}

function boxField(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
): void {
  doc.rect(x, y, w, h).lineWidth(0.5).strokeColor('#999').stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555')
    .text(label, x + 2, y + 1, { width: w - 4, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(value || '', x + 2, y + 8, { width: w - 4, ellipsis: true });
}

function checkbox(doc: any, x: number, y: number, label: string, checked: boolean): void {
  doc.rect(x, y, 7, 7).lineWidth(0.5).strokeColor('#111').stroke();
  if (checked) doc.rect(x + 1, y + 1, 5, 5).fillColor('#111').fill();
  doc.font('Helvetica').fontSize(7.5)
    .text(label, x + 10, y - 0.5, { width: 80 });
}

function lineField(doc: any, x: number, y: number, w: number, label: string, value: string): void {
  doc.moveTo(x, y + 16).lineTo(x + w, y + 16).lineWidth(0.5).strokeColor('#999').stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#555').text(label, x, y + 1, { width: w, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(value || '', x + 1, y - 8, { width: w - 2, ellipsis: true });
}

function ensureSpace(doc: any, needed: number): void {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

export async function buildGisPdf(data: GisPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const keywords = [
    'GENERAL INTAKE SHEET',
    data.controlNo,
    data.assignedWorkerName ?? '',
    data.beneficiary.surname,
    data.beneficiary.firstName,
    data.claimant.surname,
    data.claimant.firstName,
    ...data.familyMembers.map(m => m.fullName),
    ...data.interventions.flatMap(i => [i.provided, i.fundSource ?? '']),
    ASSESSMENT_TEXT,
  ].filter(s => s).join(' | ');

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 38, bottom: 40, left: LEFT - 15, right: RIGHT + 15 },
    info: {
      Title: `GIS-${data.controlNo}`,
      Author: 'MSWDO Norzagaray',
      Subject: 'General Intake Sheet',
      Keywords: keywords,
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  // ---- Header ----
  const logoPath = path.join(__dirname, 'assets', 'DSWD-Logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, LEFT + 8, 40, { fit: [70, 30] });
    } catch {
      doc.font('Helvetica-Bold').fontSize(11).text('DSWD', LEFT, 40);
    }
  }
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111')
    .text('PROTECTIVE SERVICES DIVISION', LEFT + 145, 40, { align: 'right', width: WIDTH - 145 });
  doc.text('FIELD OFFICE III', LEFT + 145, 52, { align: 'right', width: WIDTH - 145 });
  doc.font('Helvetica').fontSize(7).fillColor('#222')
    .text(FORM_NUMBER, LEFT + 145, 63, { align: 'right', width: WIDTH - 145 });

  doc.moveTo(LEFT, 76).lineTo(RIGHT, 76).lineWidth(1).strokeColor('#444').stroke();

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111')
    .text('GENERAL INTAKE SHEET', LEFT, 80, { align: 'center', width: WIDTH });

  doc.rect(LEFT, 96, WIDTH, 12).fillColor('#c0392b').fill();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#fff')
    .text(BANNER_TEXT, LEFT, 99, { align: 'center', width: WIDTH });

  // ---- ID strip ----
  let y = 114;
  boxField(doc, LEFT, y, 95, 22, 'QN', '');
  boxField(doc, LEFT + 100, y, 120, 22, 'PCN', data.controlNo);
  boxField(doc, LEFT + 225, y, 70, 22, 'Time Start', '');
  const dateTxt = fmtDate(data.createdAt);
  boxField(doc, LEFT + 300, y, 105, 22, 'Date', dateTxt);
  boxField(doc, LEFT + 410, y, 85, 22, 'Year', String(data.createdAt.getFullYear()));
  y += 26;

  checkbox(doc, LEFT + 10, y, 'New', !data.hasRenewal);
  checkbox(doc, LEFT + 60, y, 'Returning', data.hasRenewal);
  checkbox(doc, LEFT + 130, y, 'On-Site', data.referrals.length === 0);
  checkbox(doc, LEFT + 190, y, 'Walk-in', false);
  checkbox(doc, LEFT + 250, y, 'Referral', data.referrals.length > 0);
  checkbox(doc, LEFT + 310, y, 'Off-Site', false);
  y += 18;

  doc.moveTo(LEFT, y - 10).lineTo(RIGHT, y - 10).lineWidth(0.5).strokeColor('#999').stroke();

  // ---- Beneficiary identifying info ----
  sectionHeader(doc, 'IMPORMASYON NG BENEPISYARYO', 'Beneficiary\'s Identifying Information');
  const ben = data.beneficiary;
  lineField(doc, LEFT, y, 200, 'Apelyido (Last Name)', ben.surname);
  lineField(doc, LEFT + 205, y, 155, 'Unang Pangalan (First Name)', ben.firstName);
  lineField(doc, LEFT + 365, y, 70, 'Gitnang Pangalan (Middle Name)', ben.middleName ?? '');
  lineField(doc, LEFT + 440, y, 55, 'Ext. (Jr./Sr.)', ben.extension ?? '');

  lineField(doc, LEFT, y + 20, 150, 'House No./Street/Purok', ben.address.street);
  lineField(doc, LEFT + 155, y + 20, 130, 'Barangay', ben.address.barangay);
  lineField(doc, LEFT + 290, y + 20, 135, 'City/Municipality', ben.address.city);
  lineField(doc, LEFT + 430, y + 20, 65, 'Province/District', ben.address.province);
  lineField(doc, LEFT + 440, y + 38, 55, 'Region', ben.address.region || 'III');

  const benRow3: Array<[string, unknown]> = [
    ['Numero ng Telepono', ben.phone],
    ['Kapanganakan (Birthdate)', ben.dob ? fmtDate(ben.dob) : ''],
    ['Edad (Age)', ben.age],
    ['Kasarian (Sex)', ben.sex],
    ['Katayuan sa Buhay (Civil Status)', ben.civilStatus],
    ['Trabaho (Occupation)', ben.occupation],
    ['Buwanang Kita (Monthly Income)', ben.income],
    ['Estado ng Kalusugan (Health Status)', ''],
  ];
  const colW = WIDTH / 8;
  benRow3.forEach(([label, value], i) => {
    lineField(doc, LEFT + i * colW, y + 38, colW - 4, label, value != null ? String(value) : '');
  });
  lineField(doc, LEFT, y + 56, 162, 'Unang Bisita (First Visit)', fmtDate(data.createdAt));
  lineField(doc, LEFT + 170, y + 56, 145, 'PhilHealth No.', ben.philhealthNumber ?? '');
  lineField(doc, LEFT + 325, y + 56, 120, 'Place of Birth', ben.placeOfBirth ?? '');

  doc.moveTo(LEFT, y + 80).lineTo(RIGHT, y + 80).lineWidth(0.5).strokeColor('#999').stroke();

  // ---- Representative info ----
  y += 90;
  sectionHeader(doc, 'IMPORMASYON NG KINATAWAN', 'Representative\'s Identifying Information');
  const clm = data.claimant;
  lineField(doc, LEFT, y, 200, 'Apelyido (Last Name)', clm.surname);
  lineField(doc, LEFT + 205, y, 155, 'Unang Pangalan (First Name)', clm.firstName);
  lineField(doc, LEFT + 365, y, 70, 'Gitnang Pangalan (Middle Name)', clm.middleName ?? '');
  lineField(doc, LEFT + 440, y, 55, 'Ext. (Jr./Sr.)', clm.extension ?? '');

  lineField(doc, LEFT, y + 20, 150, 'House No./Street/Purok', clm.address.street);
  lineField(doc, LEFT + 155, y + 20, 130, 'Barangay', clm.address.barangay);
  lineField(doc, LEFT + 290, y + 20, 135, 'City/Municipality', clm.address.city);
  lineField(doc, LEFT + 430, y + 20, 65, 'Province/District', clm.address.province);
  lineField(doc, LEFT + 440, y + 38, 55, 'Region', clm.address.region || 'III');

  const clmRow3: Array<[string, unknown]> = [
    ['Numero ng Telepono', clm.phone],
    ['Kapanganakan (Birthdate)', clm.dob ? fmtDate(clm.dob) : ''],
    ['Edad (Age)', clm.age],
    ['Kasarian (Sex)', clm.sex],
    ['Katayuan sa Buhay (Civil Status)', clm.civilStatus],
    ['Trabaho (Occupation)', clm.occupation],
    ['Buwanang Kita (Monthly Income)', clm.income],
    ['Relasyon sa Benepisyaryo', clm.relationshipToBeneficiary],
  ];
  clmRow3.forEach(([label, value], i) => {
    lineField(doc, LEFT + i * colW, y + 38, colW - 4, label, value != null ? String(value) : '');
  });
  lineField(doc, LEFT, y + 56, 150, 'Relasyon sa Benepisyaryo', clm.relationshipToBeneficiary ?? '');
  lineField(doc, LEFT + 160, y + 56, 120, 'Time End', '');

  doc.moveTo(LEFT, y + 80).lineTo(RIGHT, y + 80).lineWidth(0.5).strokeColor('#999').stroke();

  // ---- Beneficiary category + assessment ----
  y += 90;
  ensureSpace(doc, 160);
  sectionHeader(doc, 'Beneficiary Category', 'Nakasaad sa / Sama-samang ... ');
  const catBoxTop = y;
  doc.rect(LEFT, catBoxTop, 240, 120).lineWidth(0.5).strokeColor('#111').stroke();
  const catLabel = data.clientCategory || '';
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text('Target Sector:', LEFT + 5, catBoxTop + 4);
  const sectors = ['Solo Parents', 'Indigent People', 'Recovering Person who used drugs', '4PS DSWD Beneficiary', 'Street Dwellers', 'Psychosocial/Mental/Learning Disability', 'Stateless Person/Asylum Seekers/Refugees', 'Others:'];
  sectors.forEach((s, i) => {
    checkbox(doc, LEFT + 5, catBoxTop + 18 + i * 11, s, catLabel === s);
  });
  doc.rect(LEFT + 245, catBoxTop, WIDTH - 245, 120).lineWidth(0.5).strokeColor('#111').stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
    .text("Social worker's Assessment", LEFT + 250, catBoxTop + 4);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#333')
    .text(ASSESSMENT_TEXT, LEFT + 250, catBoxTop + 16, {
      width: WIDTH - 260, height: 92, lineGap: 3, align: 'left', ellipsis: true,
    });
  y = catBoxTop + 126;

  // ---- Family composition ----
  ensureSpace(doc, 60);
  sectionHeader(doc, 'KOMPOSISYON NG PAMILYA', 'Family Composition');
  const famCols = [
    { label: 'Buong Pangalan (Complete Name)', w: 200 },
    { label: 'Relasyon sa Benepisyaryo', w: 95 },
    { label: 'Edad', w: 40 },
    { label: 'Trabaho', w: 90 },
    { label: 'Buwanang kita', w: 70 },
  ];
  const drawFamHeader = () => {
    let x = LEFT;
    doc.rect(LEFT, y, WIDTH, 12).fillColor('#e6e6e6').fill();
    famCols.forEach(c => {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111').text(c.label, x + 2, y + 2.5, { width: c.w - 4, ellipsis: true });
      doc.rect(x, y, c.w, 12).lineWidth(0.5).strokeColor('#999').stroke();
      x += c.w;
    });
    y += 12;
  };
  drawFamHeader();
  if (data.familyMembers.length === 0) {
    doc.rect(LEFT, y, WIDTH, 18).lineWidth(0.5).strokeColor('#999').stroke();
    y += 18;
  }
  data.familyMembers.forEach(m => {
    ensureSpace(doc, 18);
    let x = LEFT;
    const vals = [
      m.fullName, m.relationship ?? '', m.age != null ? String(m.age) : '',
      m.occupation ?? '', m.income != null ? fmtMoney(m.income) : '',
    ];
    famCols.forEach((c, i) => {
      doc.rect(x, y, c.w, 18).lineWidth(0.5).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#111')
        .text(vals[i] || '', x + 2, y + 5, { width: c.w - 4, ellipsis: true });
      x += c.w;
    });
    y += 18;
  });

  doc.moveTo(LEFT, y + 2).lineTo(RIGHT, y + 2).lineWidth(0.5).strokeColor('#999').stroke();

  // ---- Page 2: needs assessment + assistance ----
  doc.addPage();

  sectionHeader(doc, 'Needs Assessment', '');
  const needsCols: Array<[string, string[]]> = [
    ['Financial Assistance', ['Medical', 'Funeral', 'Transportation', 'Educational', 'Cash Assistance for']],
    ['Material Assistance', ['Food Assistance', 'Family Food Packs', 'Other Food Items', 'Hygiene & Sleeping Kits', 'Assistive Device & Technologies']],
    ['Psychosocial Support', ['Psychosocial First Aid (PFA)', 'Social Work Counseling']],
    ['Referral', ['Other Support Services']],
  ];
  const nY = y + 2;
  needsCols.forEach(([title, items], ci) => {
    const x = LEFT + ci * (WIDTH / 4);
    const w = WIDTH / 4 - 4;
    doc.rect(x, nY, w, 14 + items.length * 12).lineWidth(0.5).strokeColor('#111').stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111').text(title, x + 3, nY + 3, { width: w - 6, ellipsis: true });
    items.forEach((it, j) => {
      checkbox(doc, x + 3, nY + 18 + j * 12, it, false);
    });
  });

  // ---- Assistance table ----
  y = nY + 90;
  ensureSpace(doc, 40);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('Assistance Rendered', LEFT, y);
  y += 12;
  const drawAssistHeader = () => {
    const aCols = [
      { label: 'Provided', w: 0.5 * WIDTH },
      { label: 'Amount', w: 0.25 * WIDTH },
      { label: 'Fund Source', w: 0.25 * WIDTH },
    ];
    let x = LEFT;
    doc.rect(LEFT, y, WIDTH, 12).fillColor('#e6e6e6').fill();
    aCols.forEach(c => {
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111').text(c.label, x + 2, y + 2.5, { width: c.w - 4 });
      doc.rect(x, y, c.w, 12).lineWidth(0.5).strokeColor('#999').stroke();
      x += c.w;
    });
    y += 12;
  };
  drawAssistHeader();
  const assistRows = Math.max(3, data.interventions.length);
  for (let i = 0; i < assistRows; i++) {
    ensureSpace(doc, 18);
    let x = LEFT;
    const row = data.interventions[i];
    const vals = [row?.provided ?? '', row?.amount != null ? fmtMoney(row.amount) : '', row?.fundSource ?? ''];
    const aCols = [0.5 * WIDTH, 0.25 * WIDTH, 0.25 * WIDTH];
    aCols.forEach((w, bi) => {
      doc.rect(x, y, w, 18).lineWidth(0.5).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#111')
        .text(vals[bi] || '', x + 2, y + 5, { width: w - 4, ellipsis: true });
      x += w;
    });
    y += 18;
  }

  // ---- Declaration ----
  y += 10;
  ensureSpace(doc, 80);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#222')
    .text(DECLARATION_TEXT, LEFT, y, { width: WIDTH, lineGap: 3, align: 'justify' });
  y = doc.y + 14;

  // ---- Signatures ----
  ensureSpace(doc, 90);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('Interviewed by', LEFT + 100, y);
  doc.moveTo(LEFT, y + 16).lineTo(LEFT + 200, y + 16).lineWidth(0.5).strokeColor('#111').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#555')
    .text(data.assignedWorkerName || '', LEFT + 55, y - 8, { width: 140, align: 'right' })
    .text('Social Worker', LEFT + 55, y + 2, { width: 140, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('Reviewed & Approved by', LEFT + 270, y);
  doc.moveTo(LEFT + 220, y + 16).lineTo(LEFT + 450, y + 16).lineWidth(0.5).strokeColor('#111').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#555')
    .text(data.assignedWorkerName || '', LEFT + 300, y - 8, { width: 140, align: 'right' });

  // ---- Footer ----
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text('Buong Pangalan at Pirma', LEFT + 100, y + 22, { width: 100 })
    .font('Helvetica').fontSize(6.5).fillColor('#555')
    .text('Complete Name & Signature', LEFT + 190, y + 24, { width: 110 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text('Approving Authority', LEFT + 300, y + 22, { width: 120 });
  doc.font('Helvetica').fontSize(6.5).fillColor('#555')
    .text('Signature over Printed Name', LEFT + 300, y + 32, { width: 130 });

  doc.font('Helvetica').fontSize(5.5).fillColor('#888')
    .text(
      'DSWD Field Office III, Municipal Social Welfare and Development Office | Norzagaray, Bulacan | Tel. (044) 963-2141 | www.dswd.gov.ph',
      LEFT, 810, { align: 'center', width: WIDTH },
    );

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
