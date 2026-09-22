// Incident Report Form (Blotter) — exact reproduction of the MSWDO Norzagaray
// paper form as a generated PDF.
//
// Data mapping (all values sourced from `irf_cases`):
//   BLOTTER ENTRY NUMBER ....... blotter_entry_number
//   CASE / CATEGORY ............ case_category
//   DATE & TIME REPORTED ....... datetime_reported
//   DATE & TIME OF INCIDENT .... datetime_incident
//   ITEM "A" REPORTING PERSON .. item_a_reporting_person   (JSONB)
//   ITEM "B" PERSON REPORTED ... item_b_person_reported    (JSONB)
//   ITEM "C" NARRATION ......... encrypted_narration       (decrypted upstream)
//   AUTHENTICATION ............. reporting_signature_url / msdw_signature_url
//   CASE DISPOSITION ........... case_disposition (+ dismissal_reason)
//
// The Item A/B JSONB key contract is defined by IrfPersonRecordSchema in
// dto/irf.zod.ts. Legacy records written as `{ name, contact, address, phone,
// relation, alias }` are still accepted and mapped onto the form fields.

import * as path from 'path';
import * as fs from 'fs';

export interface IrfPdfData {
  blotterEntryNumber: string;
  caseCategory: string;
  datetimeReported?: Date | string | null;
  datetimeIncident?: Date | string | null;
  reportingPerson?: Record<string, unknown> | null;
  personReported?: Record<string, unknown> | null;
  narration?: string | null;
  reportingSignatureUrl?: string | null;
  msdwSignatureUrl?: string | null;
  caseDisposition?: string | null;
  dismissalReason?: string | null;
  officeName: string;
  legalBasis?: string;
  generatedAt?: Date;
}

export interface IrfPdfOptions {
  password?: string;
  ownerPassword?: string;
}

// ---------------------------------------------------------------------------
// Value extraction — canonical keys first, then legacy aliases
// ---------------------------------------------------------------------------

function pick(record: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = typeof value === 'object' ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
}

/** Suggested key list for each printed field, canonical name first. */
const KEYS = {
  familyName: ['familyName', 'surname', 'lastName'],
  firstName: ['firstName', 'givenName', 'name'],
  middleName: ['middleName', 'middleInitial'],
  nickname: ['nickname', 'alias'],
  gender: ['gender', 'sex'],
  civilStatus: ['civilStatus', 'maritalStatus'],
  dateOfBirth: ['dateOfBirth', 'birthDate', 'dob'],
  age: ['age'],
  placeOfBirth: ['placeOfBirth', 'birthPlace'],
  contactDetails: ['contactDetails', 'contact', 'phone', 'phoneNumber', 'mobile'],
  currentAddress: ['currentAddress', 'address'],
  otherAddress: ['otherAddress', 'otherAddr'],
  educationalAttainment: ['educationalAttainment', 'education'],
  occupation: ['occupation', 'work'],
  idCardPresented: ['idCardPresented', 'idPresented', 'idCard'],
  relationshipToClient: ['relationshipToClient', 'relation', 'relationship'],
  emailAddress: ['emailAddress', 'email'],
} as const;

function personFullName(record: Record<string, unknown> | null | undefined): string {
  const family = pick(record, [...KEYS.familyName]);
  const given = [pick(record, [...KEYS.firstName]), pick(record, ['middleName', 'middleInitial'])]
    .filter(Boolean)
    .join(' ');
  const ext = pick(record, ['nameExtension', 'extension']);
  let name = '';
  if (family && given) name = `${family}, ${given}`;
  else name = family || given;
  if (!name) return '';
  return ext ? `${name} ${ext}` : name;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

function hline(doc: any, x1: number, x2: number, y: number, lw = 0.7): void {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).strokeColor('#111').stroke();
}

function vline(doc: any, x: number, y1: number, y2: number, lw = 0.7): void {
  doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor('#111').stroke();
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric',
  });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const time = d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  });
  return `${date} ${time}`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildIrfPdf(data: IrfPdfData, opts: IrfPdfOptions = {}): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit');
  const docOptions: Record<string, unknown> = {
    size: 'A4',
    margins: { top: 24, bottom: 24, left: 24, right: 24 },
    info: {
      Title: `IRF-${data.blotterEntryNumber || 'incident-report'}`,
      Author: data.officeName,
      Subject: 'Incident Report Form — Blotter',
    },
  };
  if (opts.password) {
    docOptions.userPassword = opts.password;
    docOptions.ownerPassword = opts.ownerPassword || process.env.PDF_OWNER_PW || 'kapwa-admin-2026';
    docOptions.permissions = { printing: 'lowResolution', modifying: false, copying: false };
  }
  const doc = new PDFDocument(docOptions);
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));

  const LEFT = 24;
  const RIGHT = 571.28;
  const WIDTH = RIGHT - LEFT;
  const TOP = 24;

  // Row heights. Every row is separated by a full-width horizontal rule.
  const R = {
    header: 64,
    reported: 20,
    nameA: 22,
    sixA: 26,
    addrA: 24,
    addrOtherA: 24,
    fourA: 24,
    itemB: 20,
    nameB: 22,
    sixB: 26,
    addrB: 24,
    addrOtherB: 24,
    fourB: 24,
    itemC: 30,
    narration: 252,
    authHeader: 20,
    auth: 46,
    dispHeader: 20,
    dispValue: 56,
  };
  const order: Array<keyof typeof R> = [
    'header', 'reported', 'nameA', 'sixA', 'addrA', 'addrOtherA', 'fourA',
    'itemB', 'nameB', 'sixB', 'addrB', 'addrOtherB', 'fourB',
    'itemC', 'narration', 'authHeader', 'auth', 'dispHeader', 'dispValue',
  ];
  const yOf: Record<string, number> = {};
  let cursor = TOP;
  for (const key of order) {
    yOf[key] = cursor;
    cursor += R[key];
    yOf[`${key}End`] = cursor;
  }
  const y = (key: keyof typeof R): number => yOf[key];
  const yEnd = (key: keyof typeof R): number => yOf[`${key}End`];
  const BOTTOM = cursor;

  const cell = (
    x: number,
    top: number,
    w: number,
    h: number,
    label: string,
    value: string,
    size = 8,
  ): void => {
    doc.rect(x, top, w, h).lineWidth(0.7).strokeColor('#111').stroke();
    if (label) {
      doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#333')
        .text(label, x + 3, top + 2.5, { width: w - 6, lineBreak: false, ellipsis: true });
    }
    if (value) {
      doc.font('Helvetica').fontSize(size).fillColor('#111')
        .text(value, x + 3, top + 10, { width: w - 6, height: h - 11, ellipsis: true, lineGap: 0 });
    }
  };

  // Row of cells with independent column widths (fractions of the full width).
  const cellRow = (
    key: keyof typeof R,
    columns: Array<{ frac: number; label: string; value: string; size?: number }>,
  ): void => {
    const top = y(key);
    const h = R[key];
    let x = LEFT;
    columns.forEach((c, i) => {
      const w = i === columns.length - 1 ? RIGHT - x : c.frac * WIDTH;
      cell(x, top, w, h, c.label, c.value, c.size);
      x += w;
    });
  };

  // ---- Outer frame + row separators ----
  doc.rect(LEFT, TOP, WIDTH, BOTTOM - TOP).lineWidth(1).strokeColor('#111').stroke();
  for (const key of order) hline(doc, LEFT, RIGHT, yEnd(key));

  // ---- Header ----
  const leftW = 0.28 * WIDTH;
  const titleX = LEFT + leftW;
  const blotterSplit = TOP + 34;
  vline(doc, titleX, TOP, yEnd('header'));
  hline(doc, LEFT, titleX, blotterSplit);
  cell(LEFT, TOP, leftW, 34, 'BLOTTER ENTRY NUMBER', data.blotterEntryNumber || '', 9);
  cell(LEFT, blotterSplit, leftW, R.header - 34, 'CASE / CATEGORY', data.caseCategory || '', 9);

  // Title block: municipality badge (left), centred title, DSWD logo (right)
  const sealCx = titleX + 38;
  const sealSize = 48;
  const sealPath = path.join(__dirname, '..', 'gis', 'assets', 'norzagaray-bulacan-official-logo.png');
  if (fs.existsSync(sealPath)) {
    try {
      doc.image(sealPath, sealCx - sealSize / 2, TOP + (R.header - sealSize) / 2, { fit: [sealSize, sealSize] });
    } catch { /* header renders without the badge */ }
  }

  const logoPath = path.join(__dirname, '..', 'gis', 'assets', 'DSWD-Logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, RIGHT - 62, TOP + 6, { fit: [54, 54] });
    } catch { /* header renders without the seal */ }
  }
  const tLeft = titleX + 78;
  const tRight = RIGHT - 66;
  const tWidth = tRight - tLeft;
  doc.font('Helvetica-Oblique').fontSize(11).fillColor('#111')
    .text('Norzagaray,Bulacan', tLeft, TOP + 7, { width: tWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111')
    .text('INCIDENT REPORT FORM', tLeft, TOP + 23, { width: tWidth, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#111')
    .text('(Blotter)', tLeft, TOP + 46, { width: tWidth, align: 'center' });

  // ---- Dates + Item A heading ----
  cellRow('reported', [
    { frac: 0.32, label: 'DATE & TIME REPORTED', value: formatDateTime(data.datetimeReported) },
    { frac: 0.26, label: 'DATE & TIME OF INCIDENT', value: formatDateTime(data.datetimeIncident) },
    { frac: 1, label: '', value: '' },
  ]);
  // Item A heading is a section title spanning the third cell, not a value field.
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111')
    .text('ITEM "A" - REPORTING PERSON', LEFT + 0.58 * WIDTH + 4, y('reported') + 5, {
      width: RIGHT - (LEFT + 0.58 * WIDTH) - 8, align: 'center', lineBreak: false,
    });

  const a = data.reportingPerson ?? {};
  cellRow('nameA', [
    { frac: 0.28, label: 'FAMILY NAME', value: pick(a, [...KEYS.familyName]) },
    { frac: 0.25, label: 'FIRST NAME', value: pick(a, [...KEYS.firstName]) },
    { frac: 0.28, label: 'MIDDLE NAME', value: pick(a, [...KEYS.middleName]) },
    { frac: 1, label: 'NICKNAME', value: pick(a, [...KEYS.nickname]) },
  ]);
  cellRow('sixA', [
    { frac: 0.09, label: 'GENDER', value: pick(a, [...KEYS.gender]) },
    { frac: 0.19, label: 'CIVIL STATUS', value: pick(a, [...KEYS.civilStatus]) },
    { frac: 0.12, label: 'DATE OF BIRTH', value: pick(a, [...KEYS.dateOfBirth]) },
    { frac: 0.10, label: 'AGE', value: pick(a, [...KEYS.age]) },
    { frac: 0.28, label: 'PLACE OF BIRTH', value: pick(a, [...KEYS.placeOfBirth]) },
    { frac: 1, label: 'CONTACT DETAILS', value: pick(a, [...KEYS.contactDetails]) },
  ]);
  cellRow('addrA', [{ frac: 1, label: 'CURRENT ADDRESS', value: pick(a, [...KEYS.currentAddress]) }]);
  cellRow('addrOtherA', [{ frac: 1, label: 'OTHER ADDRESS', value: pick(a, [...KEYS.otherAddress]) }]);
  cellRow('fourA', [
    { frac: 0.28, label: 'EDUCATIONAL ATTAINMENT', value: pick(a, [...KEYS.educationalAttainment]) },
    { frac: 0.22, label: 'OCCUPATION', value: pick(a, [...KEYS.occupation]) },
    { frac: 0.28, label: 'ID CARD PRESENTED', value: pick(a, [...KEYS.idCardPresented]) },
    { frac: 1, label: 'EMAIL ADDRESS', value: pick(a, [...KEYS.emailAddress]) },
  ]);

  // ---- Item B ----
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
    .text('ITEM "B" - PERSON REPORTED', LEFT, y('itemB') + 5, {
      width: WIDTH, align: 'center', lineBreak: false,
    });

  const b = data.personReported ?? {};
  cellRow('nameB', [
    { frac: 0.28, label: 'FAMILY NAME', value: pick(b, [...KEYS.familyName]) },
    { frac: 0.25, label: 'FIRST NAME', value: pick(b, [...KEYS.firstName]) },
    { frac: 0.28, label: 'MIDDLE NAME', value: pick(b, [...KEYS.middleName]) },
    { frac: 1, label: 'NICKNAME', value: pick(b, [...KEYS.nickname]) },
  ]);
  cellRow('sixB', [
    { frac: 0.09, label: 'GENDER', value: pick(b, [...KEYS.gender]) },
    { frac: 0.19, label: 'CIVIL STATUS', value: pick(b, [...KEYS.civilStatus]) },
    { frac: 0.12, label: 'DATE OF BIRTH', value: pick(b, [...KEYS.dateOfBirth]) },
    { frac: 0.10, label: 'AGE', value: pick(b, [...KEYS.age]) },
    { frac: 0.28, label: 'PLACE OF BIRTH', value: pick(b, [...KEYS.placeOfBirth]) },
    { frac: 1, label: 'CONTACT DETAILS', value: pick(b, [...KEYS.contactDetails]) },
  ]);
  cellRow('addrB', [{ frac: 1, label: 'CURRENT ADDRESS', value: pick(b, [...KEYS.currentAddress]) }]);
  cellRow('addrOtherB', [{ frac: 1, label: 'OTHER ADDRESS', value: pick(b, [...KEYS.otherAddress]) }]);
  cellRow('fourB', [
    { frac: 0.28, label: 'EDUCATIONAL ATTAINMENT', value: pick(b, [...KEYS.educationalAttainment]) },
    { frac: 0.22, label: 'OCCUPATION', value: pick(b, [...KEYS.occupation]) },
    { frac: 0.28, label: 'RELATIONSHIP TO CLIENT', value: pick(b, [...KEYS.relationshipToClient]) },
    { frac: 1, label: 'EMAIL ADDRESS', value: pick(b, [...KEYS.emailAddress]) },
  ]);

  // ---- Item C: narration ----
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('ITEM "C" - NARRATION OF CASE', LEFT, y('itemC') + 5, {
      width: WIDTH, align: 'center', lineBreak: false,
    });
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#111')
    .text('ENTER IN DETAIL THE CASE ANSWERING THE WHO,WHAT,WHEN,WHERE,WHY & HOW OF REPORTING', LEFT + 4, y('itemC') + 18, {
      width: WIDTH - 8, align: 'left', lineBreak: false, ellipsis: true,
    });
  if (data.narration) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(data.narration, LEFT + 6, y('narration') + 5, {
        width: WIDTH - 12, height: R.narration - 9, align: 'left', lineGap: 2,
      });
  }

  // ---- Authentication ----
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('AUTHENTICATION', LEFT, y('authHeader') + 5, { width: WIDTH, align: 'center', lineBreak: false });

  const authTop = y('auth');
  const authH = R.auth;
  vline(doc, LEFT + 0.45 * WIDTH, authTop, yEnd('auth'));
  vline(doc, LEFT + 0.72 * WIDTH, authTop, yEnd('auth'));
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333')
    .text('I HEREBY CERTIFY TO THE CORRECTNESS OF THE FOREGOING TO THE BEST OF MY KNOWLEDGE AND BELIEF', LEFT + 3, authTop + 6, {
      width: 0.45 * WIDTH - 6, lineGap: 1,
    });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333')
    .text('NAME/SIGNATURE\nREPORTING PERSON', LEFT + 0.45 * WIDTH + 3, authTop + 5, { width: 0.27 * WIDTH - 6, lineGap: 1 });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333')
    .text('NAME/SIGNATURE OF\nMSWD PERSONNEL', LEFT + 0.72 * WIDTH + 3, authTop + 5, { width: 0.28 * WIDTH - 6, lineGap: 1 });
  if (personFullName(a)) {
    doc.font('Helvetica').fontSize(8).fillColor('#111')
      .text(personFullName(a), LEFT + 0.45 * WIDTH + 3, authTop + authH - 16, {
        width: 0.27 * WIDTH - 6, align: 'center', lineBreak: false, ellipsis: true,
      });
  }

  // ---- Case disposition ----
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text('CASE DISPOSITION', LEFT, y('dispHeader') + 5, { width: WIDTH, align: 'center', lineBreak: false });
  const dispTop = y('dispValue');
  cell(LEFT, dispTop, WIDTH, R.dispValue, '', data.caseDisposition || '', 10);
  if (data.dismissalReason) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#333')
      .text(`Reason: ${data.dismissalReason}`, LEFT + 4, dispTop + 22, {
        width: WIDTH - 8, height: R.dispValue - 26, lineGap: 1, ellipsis: true,
      });
  }

  // ---- Footer: legal basis / audit trail ----
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#666')
    .text(
      `${data.officeName} — generated ${formatDateTime(data.generatedAt ?? new Date())}` +
        (data.legalBasis ? ` | Legal basis: ${data.legalBasis}` : ''),
      LEFT, BOTTOM + 8, { width: WIDTH, align: 'center', lineBreak: false },
    );

  doc.end();
  return done;
}
