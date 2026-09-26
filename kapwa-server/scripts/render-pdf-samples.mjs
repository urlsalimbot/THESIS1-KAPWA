#!/usr/bin/env node
// Committed sample renderer for the document-parity effort.
//
// Renders the six PDF builders changed by the document-parity plan to
// pdf/outputs/ and audits each layout with `pdftotext -bbox`:
//
//   1. overlapping words — any pairwise word-rectangle intersection larger
//      than 25% of the smaller rectangle is a collision;
//   2. off-page words — every word rectangle must sit inside its page box.
//
// The script prints one inventory row per document and exits non-zero if any
// audit check fails or a required poppler tool is missing.
//
// Build first, then run:
//   cd kapwa-server && npm run build && node scripts/render-pdf-samples.mjs
//
// The builders are required from dist/ so the script matches the compiled
// runtime exactly. Fixtures mirror the *_Data objects in the corresponding
// *.builder.spec.ts files.

import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDir, '..');
const repoRoot = resolve(serverRoot, '..');
const outDir = join(repoRoot, 'pdf', 'outputs');

// ---------------------------------------------------------------------------
// Tooling guard
// ---------------------------------------------------------------------------

function requireTool(name) {
  const probe = spawnSync(name, ['-v'], { encoding: 'utf8' });
  if (probe.error && probe.error.code === 'ENOENT') {
    console.error(
      `ERROR: required tool "${name}" was not found on PATH.\n` +
        'Install poppler-utils (provides pdftoppm and pdftotext) and retry.',
    );
    process.exit(2);
  }
}

requireTool('pdftoppm');
requireTool('pdftotext');

// ---------------------------------------------------------------------------
// Builders (compiled) + fixtures
// ---------------------------------------------------------------------------

function loadBuilder(relPath) {
  const abs = join(serverRoot, 'dist', relPath);
  if (!existsSync(abs)) {
    console.error(
      `ERROR: compiled builder missing: ${abs}\n` + 'Run `npm run build` first.',
    );
    process.exit(2);
  }
  return require(abs);
}

const { buildCertificateOfEligibilityPdf, buildPettyCashVoucherPdf } =
  loadBuilder('cases/case-documents.builder.js');
const { buildIrfPdf } = loadBuilder('irf/irf-pdf.builder.js');
const { buildGisPdf } = loadBuilder('gis/gis-pdf.builder.js');
const { buildAccessCardPdf } = loadBuilder('access-cards/access-card-pdf.builder.js');
const { buildSummaryReportPdf } = loadBuilder('reports/summary-report-pdf.builder.js');

// Fixtures mirror the spec files' `fullData` / `coeData` / `pcvData` objects.

const coeData = {
  controlNo: 'KAPWA-2026-0001',
  officeName: 'Municipal Social Welfare and Development Office',
  beneficiaryName: 'Dela Cruz, Juan M.',
  address: 'Poblacion, Norzagaray, Bulacan',
  caseDate: new Date('2026-09-09'),
  amount: 4500,
  interviewer: 'Lorna B. Santos',
  signatoryName: 'Rosario G. Mendoza',
};

const pcvData = {
  controlNo: 'KAPWA-2026-0001',
  officeName: 'Municipal Social Welfare and Development Office',
  payee: 'Dela Cruz, Juan M.',
  address: 'Poblacion, Norzagaray, Bulacan',
  date: new Date('2026-09-09'),
  amount: 4500,
  particulars: 'Financial Assistance',
  mayorName: 'HON. MARIA ELENA L. GERMAR',
  mayorTitle: 'MUNICIPAL MAYOR',
};

const irfData = {
  blotterEntryNumber: 'BLT-2026-0001',
  caseCategory: 'Abuse',
  datetimeReported: new Date('2026-09-09T10:30:00+08:00'),
  datetimeIncident: new Date('2026-09-08T20:15:00+08:00'),
  reportingPerson: {
    familyName: 'Santos',
    firstName: 'Maria',
    middleName: 'Lopez',
    nickname: 'Mari',
    gender: 'Female',
    civilStatus: 'Married',
    dateOfBirth: '1985-07-22',
    age: 41,
    placeOfBirth: 'Norzagaray, Bulacan',
    contactDetails: '09171234002',
    currentAddress: 'Purok 3, Bigte, Norzagaray, Bulacan',
    otherAddress: 'Cabanatuan, Nueva Ecija',
    educationalAttainment: 'College Graduate',
    occupation: 'Street Vendor',
    idCardPresented: 'PhilSys ID',
    emailAddress: 'maria.santos@example.com',
  },
  personReported: {
    familyName: 'Dela Cruz',
    firstName: 'Pedro',
    gender: 'Male',
    relationshipToClient: 'Neighbor',
  },
  narration: 'Narrative of the incident.',
  caseDisposition: 'Under Investigation',
  officeName: 'Municipal Social Welfare and Development Office',
  legalBasis: 'RA 9262',
};

const gisData = {
  controlNo: 'KAPWA-2026-0001',
  caseId: 'c1',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  hasRenewal: false,
  clientCategory: 'Indigent People',
  referrals: [{ reason: 'Medical' }],
  assignedWorkerName: 'Maria Santos',
  approvedByRole: 'social_worker',
  beneficiary: {
    surname: 'Dela Cruz',
    firstName: 'Juan',
    middleName: 'M',
    extension: 'Jr.',
    sex: 'Male',
    dob: new Date('1990-05-15'),
    placeOfBirth: 'Norzagaray',
    civilStatus: 'Married',
    occupation: 'Fisherman',
    income: 5000,
    phone: '09171234567',
    address: {
      street: 'Purok 1',
      barangay: 'Bigte',
      city: 'Norzagaray',
      province: 'Bulacan',
      region: '',
    },
  },
  claimant: {
    surname: 'Dela Cruz',
    firstName: 'Pedro',
    middleName: 'P',
    sex: 'Male',
    dob: new Date('2000-01-01'),
    civilStatus: 'Single',
    occupation: 'Student',
    income: 0,
    phone: '09201234567',
    address: { street: '', barangay: 'Bigte', city: 'Norzagaray', province: 'Bulacan', region: '' },
    relationshipToBeneficiary: 'Son',
  },
  familyMembers: [
    { fullName: 'Dela Cruz, Juan M', relationship: 'Self', age: 36, occupation: 'Fisherman', income: 5000 },
    { fullName: 'Dela Cruz, Maria L', relationship: 'Wife', age: 33, occupation: 'Tindera', income: 2500 },
  ],
  interventions: [{ provided: 'FOOD ASSISTANCE', amount: 3000, fundSource: '4Ps' }],
};

const accessCardData = {
  code: 'NORZ-AC-2026-0001',
  barangay: 'Poblacion',
  contact: '09171234567',
  nhtsPrId: 'NHTS-2024-000123',
  client: {
    surname: 'Dela Cruz',
    firstName: 'Juan',
    middleName: 'M',
    gender: 'Male',
    dob: new Date('1990-05-15'),
    address: 'Purok 1, Poblacion, Norzagaray, Bulacan',
  },
  familyMembers: [
    { fullName: 'Dela Cruz, Juan M', relationship: 'Self', age: 36, status: 'Employed', income: 5000 },
    { fullName: 'Dela Cruz, Maria L', relationship: 'Wife', age: 33, status: '', income: 2500 },
  ],
  services: [
    {
      date: '07/01/2026',
      rendered: 'Financial Assistance (Php 5,000)',
      agency: 'MSWDO',
      worker: 'Anna Joy C. San Pedro, RSW',
    },
    { date: '07/15/2026', rendered: 'Medical', agency: 'RHU', worker: 'R. Santos' },
  ],
};

// Mirrors the `data` object in summary-report-pdf.builder.spec.ts.
const summaryEmptyTable = (title) => ({
  title,
  counts: { male: 0, female: 0, total: 0, byCategory: {} },
});

const summaryReportData = {
  year: 2025,
  quarter: 2,
  annual: summaryEmptyTable('SUMMARY REPORT 2025'),
  monthly: [
    summaryEmptyTable('April 1-30, 2025'),
    summaryEmptyTable('May 1-31, 2025'),
    summaryEmptyTable('June 1-30, 2025'),
  ],
  quarterSummary: summaryEmptyTable('2nd QUARTER SUMMARY'),
  caseList: [
    {
      no: 1,
      date: '01-02-25',
      surname: 'Magno',
      firstName: 'Michael',
      middleName: 'H',
      gender: 'M',
      categories: {
        cedc: false,
        wedc: false,
        pwd: false,
        senior: false,
        indigent: true,
        fourPs: false,
        ip: false,
      },
      barangay: 'Poblacion',
      intervention: 'PWD ID',
    },
  ],
  officeName: 'Municipal Social Welfare and Development Office',
  preparedBy: 'ARLYNDA F. GAMUTIA',
  preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW',
  notedByRole: 'MSWD-HEAD',
};

const documents = [
  {
    n: '01',
    slug: '01-certificate-of-eligibility',
    label: 'Certificate of Eligibility',
    source: 'cases/case-documents.builder.ts',
    paper: '21 × 7 cm strip',
    build: () => buildCertificateOfEligibilityPdf(coeData),
  },
  {
    n: '02',
    slug: '02-petty-cash-voucher',
    label: 'Petty Cash Voucher',
    source: 'cases/case-documents.builder.ts',
    paper: '21 × 14 cm strip',
    build: () => buildPettyCashVoucherPdf(pcvData),
  },
  {
    n: '03',
    slug: '03-incident-report-form',
    label: 'Incident Report Form (Blotter)',
    source: 'irf/irf-pdf.builder.ts',
    paper: 'A4',
    build: () => buildIrfPdf(irfData),
  },
  {
    n: '04',
    slug: '04-general-intake-sheet',
    label: 'General Intake Sheet (GIS)',
    source: 'gis/gis-pdf.builder.ts',
    paper: 'A4',
    build: () => buildGisPdf(gisData),
  },
  {
    n: '05',
    slug: '05-access-card',
    label: 'Family Access Card',
    source: 'access-cards/access-card-pdf.builder.ts',
    paper: 'A4',
    build: () => buildAccessCardPdf(accessCardData),
  },
  {
    n: '14',
    slug: '14-summary-report',
    label: 'GAD Summary Report (annual/quarter/case list)',
    source: 'reports/summary-report-pdf.builder.ts',
    paper: 'A4 landscape',
    build: () => buildSummaryReportPdf(summaryReportData),
  },
];

// ---------------------------------------------------------------------------
// bbox audit
// ---------------------------------------------------------------------------

/** Parse a `pdftotext -bbox` XHTML file into pages of word rectangles. */
function parseBbox(xhtml) {
  const pages = [];
  let page = null;
  const tokens = /<page\b[^>]*>|<word\b[^>]*>/g;
  let match;
  while ((match = tokens.exec(xhtml)) !== null) {
    const tag = match[0];
    if (tag.startsWith('<page')) {
      const m = /width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(tag);
      page = { width: parseFloat(m[1]), height: parseFloat(m[2]), words: [] };
      pages.push(page);
    } else if (page) {
      const m =
        /xMin="(-?[\d.]+)"[^>]*yMin="(-?[\d.]+)"[^>]*xMax="(-?[\d.]+)"[^>]*yMax="(-?[\d.]+)"/.exec(
          tag,
        );
      page.words.push({
        xMin: parseFloat(m[1]),
        yMin: parseFloat(m[2]),
        xMax: parseFloat(m[3]),
        yMax: parseFloat(m[4]),
      });
    }
  }
  return pages;
}

/** Intersection area as a fraction of the smaller rectangle, or 0. */
function overlapRatio(a, b) {
  const ix = Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin);
  if (ix <= 0) return 0;
  const iy = Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin);
  if (iy <= 0) return 0;
  const inter = ix * iy;
  const smaller = Math.min(
    (a.xMax - a.xMin) * (a.yMax - a.yMin),
    (b.xMax - b.xMin) * (b.yMax - b.yMin),
  );
  return smaller > 0 ? inter / smaller : 0;
}

const OFF_PAGE_EPS = 0.5; // points; absorbs glyph metric rounding at the edge

function auditPages(pages) {
  let collisions = 0;
  let offPage = 0;
  const collisionSamples = [];
  const offPageSamples = [];

  for (let p = 0; p < pages.length; p += 1) {
    const { width, height, words } = pages[p];

    for (const w of words) {
      const over =
        Math.max(0, -w.xMin, -w.yMin, w.xMax - width, w.yMax - height);
      if (over > OFF_PAGE_EPS) {
        offPage += 1;
        if (offPageSamples.length < 5) {
          offPageSamples.push(`p${p + 1} (${w.xMin.toFixed(1)},${w.yMin.toFixed(1)})-(${w.xMax.toFixed(1)},${w.yMax.toFixed(1)})`);
        }
      }
    }

    // Sweep by xMin; only neighbours whose x-ranges can intersect are tested.
    const sorted = [...words].sort((a, b) => a.xMin - b.xMin);
    for (let i = 0; i < sorted.length; i += 1) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j += 1) {
        const b = sorted[j];
        if (b.xMin >= a.xMax) break;
        const ratio = overlapRatio(a, b);
        if (ratio > 0.25) {
          collisions += 1;
          if (collisionSamples.length < 5) {
            collisionSamples.push(`p${p + 1} ${(ratio * 100).toFixed(0)}%`);
          }
        }
      }
    }
  }
  return { collisions, offPage, collisionSamples, offPageSamples };
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function removeStalePngs(slug) {
  for (const file of readdirSync(outDir)) {
    if (!file.startsWith(slug) || !file.endsWith('.png')) continue;
    const suffix = file.slice(slug.length, -'.png'.length);
    if (suffix === '' || /^-p?\d+$/.test(suffix) || /^-\d+$/.test(suffix)) {
      rmSync(join(outDir, file));
    }
  }
}

async function renderDocument(doc) {
  const pdfPath = join(outDir, `${doc.slug}.pdf`);
  const bboxPath = join(outDir, `.${doc.slug}.bbox.xhtml`);
  const buffer = await doc.build();
  writeFileSync(pdfPath, buffer);

  execFileSync('pdftotext', ['-bbox', pdfPath, bboxPath]);
  const xhtml = readFileSync(bboxPath, 'utf8');
  rmSync(bboxPath);
  const pages = parseBbox(xhtml);

  removeStalePngs(doc.slug);
  execFileSync('pdftoppm', ['-r', '110', '-png', pdfPath, join(outDir, doc.slug)]);
  // poppler writes <slug>-<n>.png; rename to the inventory convention.
  for (let page = 1; page <= pages.length; page += 1) {
    const from = join(outDir, `${doc.slug}-${page}.png`);
    if (!existsSync(from)) continue;
    const to =
      pages.length === 1
        ? join(outDir, `${doc.slug}.png`)
        : join(outDir, `${doc.slug}-p${page}.png`);
    renameSync(from, to);
  }

  const audit = auditPages(pages);
  return {
    pdfPath,
    pages: pages.length,
    size: statSync(pdfPath).size,
    ...audit,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(outDir, { recursive: true });

  console.log('| # | Export | Source | Paper | Pages | Size | Collisions | Off-page |');
  console.log('|---|---|---|---|---|---|---|---|');

  let failed = false;
  for (const doc of documents) {
    const r = await renderDocument(doc);
    const collisions = r.collisions;
    const offPage = r.offPage;
    if (collisions > 0 || offPage > 0) failed = true;
    console.log(
      `| ${doc.n} | ${doc.label} | \`${doc.source}\` | ${doc.paper} | ${r.pages} | ${r.size.toLocaleString('en-US')} B | ${collisions} | ${offPage} |`,
    );
    if (collisions > 0) console.log(`    collisions: ${r.collisionSamples.join(', ')}`);
    if (offPage > 0) console.log(`    off-page: ${r.offPageSamples.join(', ')}`);
  }

  if (failed) {
    console.error('\nAUDIT FAILED: overlap (>25%) or off-page words found.');
    process.exit(1);
  }
  console.log('\nAUDIT PASSED: no overlapping (>25%) or off-page words in any rendered PDF.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
