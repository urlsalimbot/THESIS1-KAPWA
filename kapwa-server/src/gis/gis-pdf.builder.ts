import * as path from 'path';
import * as fs from 'fs';
import { GisPdfData } from './gis-export.types';
import { ORG_LOCATION } from '../common/constants';

// General Intake Sheet — single-page reproduction of DSWD FO3 form
// DSWD-PMB-FO3-07-011 | REV 01 / 30 SEPT 2022.
//
// The printed form is a dense one-page grid: every field lives in a fixed cell
// whose label sits at the top and whose value sits beneath it. Labels are
// shrink-fitted to their cell and never wrap; values wrap and clip inside their
// own cell. Every cell owns a fixed height, so no two blocks can collide no
// matter how long the loaded data is.

const FORM_NUMBER = 'DSWD PMB-FO3-07-011 | REV 01 / 30 SEPT 2022';
const BANNER_TEXT = 'MAARING MAGPATULONG SUMAGOT SA DSWD PERSONNEL';
const RED_BANNER_TEXT =
  'Huwag susulatan ang DSWD lamang ang pwede gumamit! (Do not write below this part - for DSWD’s use only)';
const ASSESSMENT_TEXT =
  'It is evident that the family is in dire need of financial augmentation since their ' +
  'total income does not meet what is required to attain survival due to the increasing ' +
  'cost of living in the country and the existence of a health crisis. ' +
  'Support from relatives and friends cannot be relied on because they have similar ' +
  'unfortunate situations; therefore financial assistance from the program is hereby ' +
  'recommended by the undersigned.';
const DECLARATION_TEXT =
  'I declare under oath that I personally accomplished the GIS Form and all the ' +
  'information herein stated is TRUE, CORRECT, VALID, and COMPLETE pursuant to ' +
  'existing laws, rules, and regulations of the Philippines. I authorized the ' +
  'Agency/Head of Local Cooperatives/entities to avail the contents listed in place ' +
  'of my signature in consideration of the said complaint and/or information. I also ' +
  'agree that any MISINTERPRETATION and/or information/s of GEFRAUD the government, ' +
  'including attached documents, shall cause the filing of appropriate cases against me.';
const FOOTER_TEXT =
  'DSWD Field Office III, Diosdado Macapagal Government Center, Maimpis, City of San Fernando, Pampanga, Philippines 2000  |  ' +
  'Website: http://www.dswd.gov.ph Tel No. (045) 961-2143';

// Signing authority printed on the form.
const APPROVER_NAME = 'MARLON A. MALLARI,RSW';
const APPROVER_ROLE = 'SWO II / PTL';
const APPROVER_LIC = 'LIC. No. 0020647';

const LEFT = 24;
const RIGHT = 571.28;
const WIDTH = RIGHT - LEFT;

export function fmtDate(v?: Date | string): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

interface CellSpec {
  frac: number;
  label: string;
  value: string;
  size?: number;
}

export async function buildGisPdf(data: GisPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 18, bottom: 18, left: LEFT, right: 595.28 - RIGHT },
    info: {
      Title: `GIS-${data.controlNo}`,
      Author: data.officeName ?? 'Municipal Social Welfare and Development Office',
      Subject: 'General Intake Sheet',
    },
  });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));

  // ---- primitives -------------------------------------------------------

  const hline = (y: number, x1 = LEFT, x2 = RIGHT, lw = 0.5) =>
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).strokeColor('#333').stroke();
  const vline = (x: number, y1: number, y2: number, lw = 0.5) =>
    doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor('#333').stroke();

  // Shrink-to-fit: returns a font size at which `text` fits `maxWidth` on a
  // single line. Labels are never allowed to wrap, so they can never reach a
  // neighbouring cell.
  const fit = (text: string, font: string, maxWidth: number, size: number, min = 3.4): number => {
    doc.font(font).fontSize(size);
    while (size > min && doc.widthOfString(text) > maxWidth) {
      size -= 0.2;
      doc.font(font).fontSize(size);
    }
    return size;
  };

  // Field cell: tiny label on top, value below, both clipped to the cell.
  const cells = (y: number, h: number, specs: CellSpec[]) => {
    let x = LEFT;
    specs.forEach((s, i) => {
      const w = i === specs.length - 1 ? RIGHT - x : s.frac * WIDTH;
      const labelSize = fit(s.label, 'Helvetica', w - 4, 4.6);
      doc.font('Helvetica').fontSize(labelSize).fillColor('#666')
        .text(s.label, x + 2, y + 1.5, { lineBreak: false });
      doc.font('Helvetica').fontSize(s.size ?? 7).fillColor('#111')
        .text(s.value, x + 2, y + 8, { width: w - 4, height: h - 9, ellipsis: true });
      if (i > 0) vline(x, y, y + h);
      x += w;
    });
    hline(y);
    hline(y + h);
    vline(LEFT, y, y + h);
    vline(RIGHT, y, y + h);
  };

  const banner = (y: number, h: number, text: string, kind: 'gray' | 'red', size = 6) => {
    doc.rect(LEFT, y, WIDTH, h).fillColor(kind === 'red' ? '#b3202c' : '#d9d9d9').fill();
    const used = fit(text, 'Helvetica-Bold', WIDTH - 8, size);
    doc.font('Helvetica-Bold').fontSize(used).fillColor(kind === 'red' ? '#fff' : '#222')
      .text(text, LEFT + 3, y + (h - used) / 2 - 1, { width: WIDTH - 6, align: 'center', lineBreak: false });
    hline(y);
    hline(y + h);
  };

  const checkbox = (x: number, y: number, label: string, checked: boolean, labelSize = 5.4, maxWidth = 130) => {
    doc.rect(x, y, 6, 6).lineWidth(0.5).strokeColor('#111').stroke();
    if (checked) doc.rect(x + 1, y + 1, 4, 4).fillColor('#111').fill();
    const used = fit(label, 'Helvetica', maxWidth, labelSize);
    doc.font('Helvetica').fontSize(used).fillColor('#111')
      .text(label, x + 8, y + 0.5, { lineBreak: false });
  };

  // ---- header -----------------------------------------------------------

  const logoPath = path.join(__dirname, 'assets', 'DSWD-Logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, LEFT + 4, 16, { fit: [62, 36] });
    } catch { /* header renders without the seal */ }
  }
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
    .text('PROTECTIVE SERVICES DIVISION', RIGHT - 240, 18, { width: 240, align: 'right', lineBreak: false })
    .text('FIELD OFFICE III', RIGHT - 240, 27, { width: 240, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(5.5).fillColor('#333')
    .text(FORM_NUMBER, RIGHT - 240, 36, { width: 240, align: 'right', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111')
    .text('GENERAL INTAKE SHEET', LEFT, 44, { width: WIDTH, align: 'center' });
  banner(62, 11, BANNER_TEXT, 'red', 6.5);

  // ---- case identification strip ----------------------------------------

  let y = 73;
  const box = (x: number, w: number) =>
    doc.rect(x, y + 1, w, 13).lineWidth(0.5).strokeColor('#333').stroke();
  doc.font('Helvetica').fontSize(6).fillColor('#111');
  doc.text('QN', LEFT + 2, y + 5, { lineBreak: false });
  box(LEFT + 16, 46);
  doc.text('PCN', LEFT + 68, y + 5, { lineBreak: false });
  box(LEFT + 84, 150);
  doc.font('Helvetica').fontSize(6).fillColor('#111').text(data.controlNo, LEFT + 87, y + 5, { width: 144, lineBreak: false, ellipsis: true });
  doc.text('Time Start:', LEFT + 240, y + 5, { lineBreak: false });
  box(LEFT + 284, 46);
  doc.text('Date:', LEFT + 336, y + 5, { lineBreak: false });
  box(LEFT + 356, 84);
  doc.font('Helvetica').fontSize(6).fillColor('#111').text(fmtDate(data.createdAt), LEFT + 359, y + 5, { width: 78, lineBreak: false });
  box(LEFT + 446, 44);
  doc.font('Helvetica').fontSize(6).fillColor('#111')
    .text(String(data.createdAt.getFullYear()), LEFT + 449, y + 5, { width: 38, lineBreak: false });
  hline(y + 15);
  y += 15;

  // ---- walk-in checkboxes ------------------------------------------------

  checkbox(LEFT + 20, y + 3, 'New', !data.hasRenewal);
  checkbox(LEFT + 70, y + 3, 'Returning', data.hasRenewal);
  checkbox(LEFT + 190, y + 3, 'On-Site', data.referrals.length === 0);
  checkbox(LEFT + 250, y + 3, 'Walk-in', false);
  checkbox(LEFT + 320, y + 3, 'Referral', data.referrals.length > 0);
  checkbox(LEFT + 440, y + 3, 'Off-Site', false);
  hline(y + 14);
  y += 14;

  // ---- beneficiary / representative blocks -------------------------------

  const personBlock = (heading: string, p: GisPdfData['beneficiary'], relationship?: string) => {
    banner(y, 11, heading, 'gray', 6.5);
    y += 11;
    cells(y, 19, [
      { frac: 0.30, label: 'Apelyido (Last Name)', value: p.surname },
      { frac: 0.30, label: 'Unang Pangalan (First Name)', value: p.firstName },
      { frac: 0.28, label: 'Gitnang Pangalan (Middle Name)', value: p.middleName ?? '' },
      { frac: 0.12, label: 'Ext. (Jr./Sr.)', value: p.extension ?? '' },
    ]);
    y += 19;
    cells(y, 19, [
      { frac: 0.24, label: 'House No./Street/Purok (Blg No./Kalye)', value: p.address.street },
      { frac: 0.20, label: 'Barangay (Brgy)', value: p.address.barangay },
      { frac: 0.20, label: 'City/Municipality (Bayan)', value: p.address.city },
      { frac: 0.20, label: 'Province/District (Distrito)', value: p.address.province },
      { frac: 0.16, label: 'Region (Rehiyon)', value: p.address.region || ORG_LOCATION.region },
    ]);
    y += 19;
    cells(y, 19, [
      { frac: 0.16, label: 'Numero ng Telepono (Mobile No.)', value: p.phone ?? '' },
      { frac: 0.16, label: 'Kapanganakan (Birthdate)', value: p.dob ? fmtDate(p.dob) : '' },
      { frac: 0.08, label: 'Edad (Age)', value: p.age != null ? String(p.age) : '' },
      { frac: 0.10, label: 'Kasarian (Sex)', value: p.sex },
      { frac: 0.13, label: 'Civil Status (Katayuan)', value: p.civilStatus ?? '' },
      { frac: 0.18, label: 'Trabaho (Occupation)', value: p.occupation ?? '' },
      { frac: 0.19, label: 'Buwanang Kita (Monthly Salary)', value: p.income != null ? String(p.income) : '' },
    ]);
    y += 19;
    if (relationship !== undefined) {
      cells(y, 17, [
        { frac: 0.6, label: 'Relasyon sa Benepisyaryo (Relationship to the Beneficiary)', value: relationship },
        { frac: 0.4, label: 'Time End', value: '' },
      ]);
      y += 17;
    }
  };

  personBlock('IMPORMASYON NG BENEPISYARYO (Beneficiary’s Identifying Information)', data.beneficiary);
  personBlock('IMPORMASYON NG KINATAWAN (Representative’s Identifying Information)', data.claimant,
    data.claimant.relationshipToBeneficiary ?? '');

  banner(y, 11, RED_BANNER_TEXT, 'red', 6);
  y += 11;

  // ---- beneficiary category + social worker's assessment -----------------

  const catTop = y;
  const catH = 128;
  const catW = 236;
  doc.rect(LEFT, catTop, catW, catH).lineWidth(0.5).strokeColor('#333').stroke();
  doc.rect(LEFT + catW, catTop, WIDTH - catW, catH).lineWidth(0.5).strokeColor('#333').stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Beneficiary Category', LEFT + 3, catTop + 3, { width: catW - 6, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text("Social worker's Assessment", LEFT + catW + 4, catTop + 3, { lineBreak: false });
  vline(LEFT + 78, catTop, catTop + catH);
  hline(catTop + 12, LEFT, LEFT + catW);
  doc.font('Helvetica-Bold').fontSize(5).fillColor('#333')
    .text('Target Sector', LEFT + 3, catTop + 14, { lineBreak: false })
    .text('Specify Sub-Category', LEFT + 81, catTop + 14, { lineBreak: false });

  const sectors = ['FHONA', 'SC', 'WEDC', 'YNSP', 'PWD', 'PLHIV', 'CNSP'];
  sectors.forEach((s, i) => checkbox(LEFT + 4, catTop + 24 + i * 11, s, data.clientCategory === s, 5.2, 62));

  const subCategories = [
    'Solo Parents', 'Indigent People', 'Recovering Person who used drugs', '4PS DSWD Beneficiary',
    'Street Dwellers', 'Psychosocial/Mental/Learning Disability', 'Stateless Person/Asylum Seekers/Refugees', 'Others:',
  ];
  subCategories.forEach((s, i) => checkbox(LEFT + 84, catTop + 24 + i * 11, s, data.clientCategory === s, 5.2, 142));

  doc.font('Helvetica-Oblique').fontSize(5.6).fillColor('#333')
    .text(ASSESSMENT_TEXT, LEFT + catW + 4, catTop + 13, {
      width: WIDTH - catW - 8, height: catH - 16, lineGap: 1, align: 'left', ellipsis: true,
    });
  y = catTop + catH;

  // ---- family composition ------------------------------------------------

  banner(y, 11, 'KOMPOSISYON NG PAMILYA (Family Composition)', 'gray', 6.5);
  y += 11;
  const famCols: CellSpec[] = [
    { frac: 0.34, label: 'Buong Pangalan (Complete Name)', value: '' },
    { frac: 0.24, label: 'Relasyon sa Benepisyaryo (Relationship to the Beneficiary)', value: '' },
    { frac: 0.08, label: 'Edad (Age)', value: '' },
    { frac: 0.17, label: 'Trabaho (Occupation)', value: '' },
    { frac: 0.17, label: 'Buwanang Kita (Monthly Salary)', value: '' },
  ];
  // Header labels only (label row).
  {
    let x = LEFT;
    famCols.forEach((s, i) => {
      const w = i === famCols.length - 1 ? RIGHT - x : s.frac * WIDTH;
      doc.font('Helvetica-Bold').fontSize(fit(s.label, 'Helvetica-Bold', w - 4, 5)).fillColor('#222')
        .text(s.label, x + 2, y + 4, { lineBreak: false });
      if (i > 0) vline(x, y, y + 13);
      x += w;
    });
    hline(y);
    hline(y + 13);
    vline(LEFT, y, y + 13);
    vline(RIGHT, y, y + 13);
  }
  y += 13;
  const members = (data.familyMembers ?? []).slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const m = members[i];
    cells(y, 14, [
      { frac: 0.34, label: '', value: m?.fullName ?? '' },
      { frac: 0.24, label: '', value: m?.relationship ?? '' },
      { frac: 0.08, label: '', value: m?.age != null ? String(m.age) : '' },
      { frac: 0.17, label: '', value: m?.occupation ?? '' },
      { frac: 0.17, label: '', value: m?.income != null ? String(m.income) : '' },
    ]);
    y += 14;
  }

  // ---- needs assessment ---------------------------------------------------

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Needs Assessment', LEFT, y + 3, { lineBreak: false });
  y += 11;
  const needsH = 78;
  const needsCols: Array<{ title: string; items: string[] }> = [
    { title: 'Financial Assistance', items: ['Medical', 'Funeral', 'Transportation', 'Educational', 'Cash Assistance for'] },
    { title: 'Material Assistance', items: ['Food Assistance', 'Family Food Packs', 'Cash Assistance for', 'Other Food Items', 'Hygiene & Sleeping Kits', 'Assistive Device & Technologies'] },
    { title: 'Psychosocial Support', items: ['Psychosocial First Aid (PFA)', 'Social Work Counseling'] },
    { title: 'Referral', items: ['Other Support Services'] },
  ];
  const needsW = WIDTH / needsCols.length;
  needsCols.forEach((c, ci) => {
    const x = LEFT + ci * needsW;
    doc.rect(x, y, needsW, needsH).lineWidth(0.5).strokeColor('#333').stroke();
    doc.font('Helvetica-Bold').fontSize(6).fillColor('#111')
      .text(c.title, x + 3, y + 3, { width: needsW - 6, lineBreak: false, ellipsis: true });
    c.items.forEach((it, ii) => checkbox(x + 3, y + 14 + ii * 11, it, false, 5.2, needsW - 15));
  });
  y += needsH;

  // ---- assistance rendered ------------------------------------------------

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#111')
    .text('Assistance Rendered', LEFT, y + 3, { lineBreak: false });
  y += 11;
  const renderCols: CellSpec[] = [
    { frac: 0.08, label: 'No.', value: '' },
    { frac: 0.44, label: 'Provided', value: '' },
    { frac: 0.24, label: 'Amount', value: '' },
    { frac: 0.24, label: 'Fund Source', value: '' },
  ];
  {
    let x = LEFT;
    renderCols.forEach((s, i) => {
      const w = i === renderCols.length - 1 ? RIGHT - x : s.frac * WIDTH;
      doc.font('Helvetica-Bold').fontSize(fit(s.label, 'Helvetica-Bold', w - 4, 5)).fillColor('#222')
        .text(s.label, x + 2, y + 4, { lineBreak: false });
      if (i > 0) vline(x, y, y + 13);
      x += w;
    });
    hline(y);
    hline(y + 13);
    vline(LEFT, y, y + 13);
    vline(RIGHT, y, y + 13);
  }
  y += 13;
  const rows = (data.interventions ?? []).slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const r = rows[i];
    cells(y, 14, [
      { frac: 0.08, label: '', value: String(i + 1) },
      { frac: 0.44, label: '', value: r?.provided ?? '' },
      { frac: 0.24, label: '', value: r?.amount != null ? Number(r.amount).toLocaleString('en-PH') : '' },
      { frac: 0.24, label: '', value: r?.fundSource ?? '' },
    ]);
    y += 14;
  }

  // ---- declaration + signatures -------------------------------------------
  // Three signature slots line the bottom edge (claimant, social worker,
  // approving authority). The slots are disjoint and every caption is
  // shrink-fitted to its slot, so nothing can collide or run off the page.

  y += 4;
  const blockH = 80;
  const slotA = { x: LEFT, w: 286 };
  const slotB = { x: LEFT + 292, w: 126 };
  const slotC = { x: LEFT + 424, w: RIGHT - (LEFT + 424) };

  // Declaration + thumbmark box (claimant slot).
  doc.rect(slotA.x, y, slotA.w, blockH).lineWidth(0.5).strokeColor('#333').stroke();
  doc.font('Helvetica').fontSize(5.2).fillColor('#333')
    .text(DECLARATION_TEXT, slotA.x + 3, y + 3, { width: slotA.w - 46, height: blockH - 6, lineGap: 1, ellipsis: true });
  doc.rect(slotA.x + slotA.w - 38, y + 6, 34, blockH - 12).lineWidth(0.5).strokeColor('#999').stroke();

  // Interviewed by / Reviewed & Approved by.
  doc.font('Helvetica').fontSize(fit('Interviewed by', 'Helvetica', slotB.w - 8, 6))
    .fillColor('#111').text('Interviewed by', slotB.x + 4, y + 6, { lineBreak: false });
  doc.font('Helvetica').fontSize(7).fillColor('#111')
    .text(data.assignedWorkerName ?? '', slotB.x + 4, y + 30, { width: slotB.w - 8, height: 10, ellipsis: true });

  doc.font('Helvetica').fontSize(fit('Reviewed & Approved by', 'Helvetica', slotC.w - 8, 6))
    .fillColor('#111').text('Reviewed & Approved by', slotC.x + 4, y + 6, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(fit(APPROVER_NAME, 'Helvetica-Bold', slotC.w - 8, 7))
    .fillColor('#111').text(APPROVER_NAME, slotC.x + 4, y + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(fit(APPROVER_ROLE, 'Helvetica', slotC.w - 8, 5.5))
    .fillColor('#333').text(APPROVER_ROLE, slotC.x + 4, y + 35, { lineBreak: false });
  doc.font('Helvetica').fontSize(fit(APPROVER_LIC, 'Helvetica', slotC.w - 8, 5.5))
    .fillColor('#333').text(APPROVER_LIC, slotC.x + 4, y + 42, { lineBreak: false });

  // Signature rules + captions along the bottom edge.
  const ruleY = y + blockH + 8;
  const cap = (slot: { x: number; w: number }, top: string) => {
    hline(ruleY, slot.x + 4, slot.x + slot.w - 4);
    doc.font('Helvetica-Bold').fontSize(fit(top, 'Helvetica-Bold', slot.w - 8, 5.6))
      .fillColor('#111').text(top, slot.x + 4, ruleY + 2, { lineBreak: false });
    doc.font('Helvetica')
      .fontSize(fit('(Signature over Printed Name)', 'Helvetica', slot.w - 8, 4.6))
      .fillColor('#666').text('(Signature over Printed Name)', slot.x + 4, ruleY + 9, { lineBreak: false });
  };
  cap(slotA, 'Buong Pangalan at Pirma');
  cap(slotB, 'Social Worker');
  cap(slotC, 'Approving Authority');

  y += blockH + 20;
  hline(y);
  doc.font('Helvetica').fontSize(5).fillColor('#555')
    .text(FOOTER_TEXT, LEFT, y + 3, { width: WIDTH, align: 'center', lineBreak: false, ellipsis: true });

  doc.end();
  return done;
}
