# Access Card PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live-data PDF export of the Family Access Card form (services record + client info + family composition + Paalala at Gabay) downloadable from the Access Card view page.

**Architecture:** Server-side pdfkit builder mirroring `src/gis/gis-pdf.builder.ts` + new endpoint `GET /access-cards/beneficiary/:id/gis-pdf` in `AccessCardsController` composing data from beneficiary person, family graph (household memberships), and `access_card_services` log. Client adds `downloadAccessCardPdf()` helper and a "GIS (PDF)" button on `AccessCardViewPage`.

**Tech Stack:** NestJS 11, TypeORM, pdfkit (already in server deps), React 19 + SWR + Vitest (client), Jest (server).

## Global Constraints

- Server tests: `npx jest --silent` (NOT `npm test`). Single spec: `npx jest <file>`.
- Server typecheck: `npm run typecheck`. Client typecheck: `npm run typecheck` from `kapwa-client/`.
- Client tests: `npm run test:run` from `kapwa-client/`.
- Layout order is USER-CORRECTED and authoritative: **Page 1 = PAALALA AT GABAY (left) + services table start (right); Page 2 = services continuation (left) + header/Code#/Client info/Family Composition/signatures (right)**.
- Builder must render `%PDF` header, A4, and never crash on minimal/blank data.
- API shape preservation trio not needed here (no entity decomposition).
- Endpoint roles: `admin`, `social_worker`, `coordinator` (client button hidden from claimant/agency_staff).
- Filename pattern: `<accessCardCode>-access-card.pdf` (e.g. `NORZ-AC-2026-0001-access-card.pdf`).
- No comments unless existing file style requires; mirror `gis-pdf.builder.ts` conventions exactly.

---

### Task 1: Access card PDF data types + builder

**Files:**
- Create: `kapwa-server/src/access-cards/access-card-pdf.types.ts`
- Create: `kapwa-server/src/access-cards/access-card-pdf.builder.ts`
- Test: `kapwa-server/src/access-cards/access-card-pdf.builder.spec.ts`

**Interfaces:**
- Consumes: nothing external (pure function).
- Produces:
  - `interface AccessCardPdfData` with:
    - `code: string` — access card code (e.g. `NORZ-AC-2026-0001`)
    - `barangay: string`
    - `contact: string`
    - `client: { surname: string; firstName: string; middleName?: string; gender: 'Male' | 'Female' | ''; dob?: Date | string; address: string }`
    - `familyMembers: Array<{ fullName: string; relationship: string; age?: number; status?: string; income?: number }>`
    - `services: Array<{ date: string; rendered: string; agency: string; worker: string }>`
  - `export function buildAccessCardPdf(data: AccessCardPdfData): Promise<Buffer>`

- [ ] **Step 1: Write the failing test**

Create `kapwa-server/src/access-cards/access-card-pdf.builder.spec.ts`:

```ts
import { buildAccessCardPdf } from './access-card-pdf.builder';
import { AccessCardPdfData } from './access-card-pdf.types';

const fullData: AccessCardPdfData = {
  code: 'NORZ-AC-2026-0001',
  barangay: 'Poblacion',
  contact: '09171234567',
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
    const text = buf.toString('latin1');
    expect(text).toContain('%PDF');
    expect(text).toContain('NORZ-AC-2026-0001');
    expect(text).toContain('PAALALA AT GABAY');
    expect(text).toContain('CLIENT');
    expect(text).toContain('Dela Cruz');
    expect(text).toContain('FAMILY COMPOSITION');
    expect(text).toContain('Financial Assistance');
    expect(text).toContain('MSWDO');
    const pageCount = (text.match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBe(2);
  });

  it('never crashes on minimal data (blanks)', async () => {
    const bare: AccessCardPdfData = {
      code: 'NORZ-AC-X', barangay: '', contact: '',
      client: { surname: '', firstName: '', gender: '', address: '' },
      familyMembers: [],
      services: [],
    };
    const buf = await buildAccessCardPdf(bare);
    expect(buf.toString('latin1')).toContain('%PDF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest access-card-pdf.builder`
Expected: FAIL — "Cannot find module './access-card-pdf.builder'"

- [ ] **Step 3: Write the types file**

Create `kapwa-server/src/access-cards/access-card-pdf.types.ts`:

```ts
export interface AccessCardPdfData {
  code: string;
  barangay: string;
  contact: string;
  client: {
    surname: string;
    firstName: string;
    middleName?: string;
    gender: 'Male' | 'Female' | '';
    dob?: Date | string;
    address: string;
  };
  familyMembers: Array<{
    fullName: string;
    relationship: string;
    age?: number;
    status?: string;
    income?: number;
  }>;
  services: Array<{
    date: string;
    rendered: string;
    agency: string;
    worker: string;
  }>;
}
```

- [ ] **Step 4: Write the builder**

Create `kapwa-server/src/access-cards/access-card-pdf.builder.ts`:

```ts
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
const SERVICES_COLS = [70, 180, 125, 120]; // sums to 495

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
  doc.rect(x, y, WIDTH, 14).fillColor('#e6e6e6').fill();
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
      y = drawServicesHeader(doc, LEFT, y);
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
  sy = drawServiceRows(doc, LEFT + WIDTH / 2, sy, data.services, 8);

  // ================= PAGE 2: services continuation (left) + client info (right) =================
  doc.addPage();

  // Left column: continue services table
  let sy2 = 48;
  sy2 = drawServicesHeader(doc, LEFT, sy2);
  sy2 = drawServiceRows(doc, LEFT, sy2, data.services, 12);

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

  fieldRow(rx + 10, cy, 100, 'Surname', data.client.surname);
  fieldRow(rx + 115, cy, 120, 'First Name', data.client.firstName);
  fieldRow(rx + 240, cy, 90, 'Middle Name', data.client.middleName ?? '');
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
    { label: 'Family Members', w: 110 },
    { label: 'Relationship', w: 70 },
    { label: 'Age', w: 30 },
    { label: 'Status / Income', w: 90 },
  ];
  let fx = rx + 10;
  doc.rect(rx + 10, cy, 300, 12).fillColor('#e6e6e6').fill();
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest access-card-pdf.builder`
Expected: PASS (2 tests)

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/access-cards/access-card-pdf.types.ts src/access-cards/access-card-pdf.builder.ts src/access-cards/access-card-pdf.builder.spec.ts
git commit -m "feat(access-cards): family access card pdf builder"
```

---

### Task 2: Service method `generateAccessCardPdf`

**Files:**
- Modify: `kapwa-server/src/access-cards/access-cards.service.ts`
- Test: `kapwa-server/src/access-cards/access-cards.service.spec.ts` (append)

**Interfaces:**
- Consumes: `buildAccessCardPdf` + `AccessCardPdfData` from Task 1; `findBeneficiaryCard` (existing, same file).
- Produces: `async generateAccessCardPdf(beneficiaryId: string): Promise<Buffer>` and `async accessCardCodeFor(beneficiaryId: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

Append to `kapwa-server/src/access-cards/access-cards.service.spec.ts`:

```ts
describe('AccessCardsService.generateAccessCardPdf', () => {
  it('builds a PDF for a beneficiary with a card', async () => {
    const service = new AccessCardsService(repoMock as any, consentRepoMock as any, referralRepoMock as any, agencyRepoMock as any);
    repoMock.query.mockResolvedValueOnce([
      { id: 'b1', access_card_code: 'NORZ-AC-2026-0001', surname: 'Dela Cruz', first_name: 'Juan' },
    ]);
    repoMock.find.mockResolvedValueOnce([
      { accessCardCode: 'NORZ-AC-2026-0001', serviceDate: new Date('2026-07-01'), serviceRendered: 'Financial Assistance', cost: 5000, agencyId: 'ag-1', workerNameSign: 'R. Santos' },
    ]);
    repoMock.manager.mockResolvedValueOnce({ query: vi.fn().mockResolvedValue([]) });
    const pdf = await service.generateAccessCardPdf('b1');
    expect(pdf.toString('latin1')).toContain('%PDF');
  });
});
```

(Adjust repoMock/consentRepoMock/referralRepoMock/agencyRepoMock to the existing mocks in that spec file — inspect the top of `access-cards.service.spec.ts` and reuse the same mock objects.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest access-cards.service`
Expected: FAIL — "generateAccessCardPdf is not a function"

- [ ] **Step 3: Implement the method**

In `kapwa-server/src/access-cards/access-cards.service.ts`, add imports and method:

```ts
import { buildAccessCardPdf } from './access-card-pdf.builder';
import { AccessCardPdfData } from './access-card-pdf.types';

// inside class AccessCardsService:

  async accessCardCodeFor(beneficiaryId: string): Promise<string> {
    const ben = await this.repo.query(
      'SELECT COALESCE(h.access_card_code, br.access_card_code) AS access_card_code FROM beneficiaries b LEFT JOIN households h ON h.id = b.household_id LEFT JOIN beneficiary_roles br ON br.person_id = b.person_id WHERE b.id = $1 LIMIT 1',
      [beneficiaryId],
    );
    const code = ben?.[0]?.access_card_code as string | undefined;
    if (!code) throw new NotFoundException('Beneficiary has no Access Card');
    return code;
  }

  async generateAccessCardPdf(beneficiaryId: string): Promise<Buffer> {
    const code = await this.accessCardCodeFor(beneficiaryId);
    const person = await this.repo.query(
      `SELECT p.surname, p.first_name, p.middle_name, p.gender,
              p.dob::date AS dob,
              (SELECT raw FROM person_addresses pa WHERE pa.person_id = p.id AND pa.address_type = 'current' LIMIT 1) AS address_raw,
              (SELECT value FROM person_contacts pc WHERE pc.person_id = p.id AND pc.contact_type = 'phone' LIMIT 1) AS phone
       FROM beneficiaries b
       JOIN persons p ON p.id = b.person_id
       WHERE b.id = $1
       LIMIT 1`,
      [beneficiaryId],
    );
    const p = person?.[0];
    if (!p) throw new NotFoundException('Beneficiary not found');

    const fam = await this.repo.query(
      `SELECT TRIM(CONCAT(pm.first_name, ' ', COALESCE(pm.middle_name || ' ', ''), pm.surname)) AS full_name,
              hm.relationship,
              EXTRACT(YEAR FROM AGE(NOW(), pm.dob))::integer AS age,
              pm.estimated_monthly_income AS income,
              hm.status
       FROM household_memberships hm
       JOIN persons pm ON pm.id = hm.person_id
       WHERE hm.household_id = (SELECT household_id FROM beneficiaries WHERE id = $1)
       ORDER BY hm.is_primary DESC, pm.surname, pm.first_name`,
      [beneficiaryId],
    );

    const services = await this.repo.find({
      where: { accessCardCode: code },
      order: { serviceDate: 'ASC' },
      relations: ['agencyRef'],
    });

    const barangay = p.address_raw?.includes(',') ? (p.address_raw as string).split(',').slice(0, 2).join(',').trim() : (p.address_raw ?? '');

    const data: AccessCardPdfData = {
      code,
      barangay,
      contact: p.phone ?? '',
      client: {
        surname: p.surname ?? '',
        firstName: p.first_name ?? '',
        middleName: p.middle_name ?? undefined,
        gender: p.gender ?? '',
        dob: p.dob ?? undefined,
        address: p.address_raw ?? '',
      },
      familyMembers: (fam ?? []).map((m: any) => ({
        fullName: m.full_name ?? '',
        relationship: m.relationship ?? '',
        age: m.age ?? undefined,
        status: m.status ?? '',
        income: m.income != null ? Number(m.income) : undefined,
      })),
      services: (services ?? []).map((s: any) => ({
        date: s.serviceDate ? new Date(s.serviceDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
        rendered: [s.serviceRendered, s.cost != null ? `(${Number(s.cost).toLocaleString('en-PH')})` : ''].filter(Boolean).join(' '),
        agency: s.agencyRef?.name ?? s.agency ?? '',
        worker: s.workerNameSign ?? '',
      })),
    };
    return buildAccessCardPdf(data);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest access-cards.service`
Expected: PASS (all tests, existing + new)

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/access-cards/access-cards.service.ts src/access-cards/access-cards.service.spec.ts
git commit -m "feat(access-cards): generate family access card pdf in service"
```

---

### Task 3: Controller endpoint `GET /access-cards/beneficiary/:id/gis-pdf`

**Files:**
- Modify: `kapwa-server/src/access-cards/access-cards.controller.ts`
- Test: `kapwa-server/src/access-cards/access-cards.controller.spec.ts` (create if missing; check if one exists first)

**Interfaces:**
- Consumes: `generateAccessCardPdf` (Task 2).
- Produces: HTTP `GET /api/v1/access-cards/beneficiary/:id/gis-pdf` → `200 application/pdf`, `Content-Disposition: attachment; filename="<code>-access-card.pdf"`.

- [ ] **Step 1: Check for existing controller spec**

Run: `ls kapwa-server/src/access-cards/access-cards.controller.spec.ts`
If none exists, create a minimal one (mock `AccessCardsService` with `generateAccessCardPdf` + `accessCardCodeFor`, call handler with fake `@Res`). If one exists, append.

```ts
import { Test } from '@nestjs/testing';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardsService } from './access-cards.service';

describe('AccessCardsController', () => {
  let controller: AccessCardsController;
  const svc = {
    generateAccessCardPdf: jest.fn(),
    accessCardCodeFor: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccessCardsController],
      providers: [{ provide: AccessCardsService, useValue: svc }],
    }).compile();
    controller = module.get(AccessCardsController);
    svc.generateAccessCardPdf.mockReset();
    svc.accessCardCodeFor.mockReset();
  });

  it('streams the access card PDF with attachment headers', async () => {
    svc.generateAccessCardPdf.mockResolvedValue(Buffer.from('%PDF-1.3'));
    svc.accessCardCodeFor.mockResolvedValue('NORZ-AC-2026-0001');
    const res = {
      set: jest.fn(),
      end: jest.fn(),
    };
    await controller.downloadAccessCardPdf('b1', res);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="NORZ-AC-2026-0001-access-card.pdf"',
    }));
    expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest access-cards.controller`
Expected: FAIL — "downloadAccessCardPdf is not a function"

- [ ] **Step 3: Add the endpoint**

In `kapwa-server/src/access-cards/access-cards.controller.ts`, add:

```ts
  @Get('beneficiary/:id/gis-pdf')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Download family access card PDF' })
  async downloadAccessCardPdf(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: any) {
    const pdf = await this.svc.generateAccessCardPdf(id);
    const code = await this.svc.accessCardCodeFor(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${code}-access-card.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
```

Route-order note: place before `@Get(':code/summary')`? No — `beneficiary/:id/gis-pdf` is distinct from `:code`; but `@Get(':cardCode')` would match `beneficiary` as cardCode only for single-segment. `beneficiary/:id/gis-pdf` is 3 segments, `:cardCode` is 1 — no collision. Still, place near other `beneficiary/:id` routes for clarity.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest access-cards.controller`
Expected: PASS

- [ ] **Step 5: Typecheck + lint + full server suite**

Run: `npm run typecheck && npm run lint && npx jest --silent`
Expected: all pass (58+ suites)

- [ ] **Step 6: Commit**

```bash
git add src/access-cards/access-cards.controller.ts src/access-cards/access-cards.controller.spec.ts
git commit -m "feat(access-cards): gis-pdf endpoint for family access card export"
```

---

### Task 4: Client helper `downloadAccessCardPdf` + locale keys

**Files:**
- Modify: `kapwa-client/src/lib/api.ts` (after `downloadGisPdf`, ~line 301)
- Modify: `kapwa-client/src/i18n/locales/en/index.ts` (`accessCard` section)
- Modify: `kapwa-client/src/i18n/locales/fil/index.ts` (`accessCard` section)

**Interfaces:**
- Consumes: existing `dispositionFilename` helper.
- Produces: `export async function downloadAccessCardPdf(beneficiaryId: string): Promise<void>`

- [ ] **Step 1: Add the helper**

In `kapwa-client/src/lib/api.ts`, after `downloadGisPdf`:

```ts
export async function downloadAccessCardPdf(beneficiaryId: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(
    `${API_BASE}/access-cards/beneficiary/${beneficiaryId}/gis-pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new Error(`Access Card export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = dispositionFilename(res, `access-card-${beneficiaryId}.pdf`);
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add locale keys**

In `kapwa-client/src/i18n/locales/en/index.ts` under `accessCard` (alphabetical-ish, near `assignCard`):

```json
    "exportGisPdf": "GIS (PDF)",
```

In `kapwa-client/src/i18n/locales/fil/index.ts` under `accessCard`:

```json
    "exportGisPdf": "GIS (PDF)",
```

- [ ] **Step 3: Typecheck client**

Run: `npm run typecheck` (from `kapwa-client/`)
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts src/i18n/locales/en/index.ts src/i18n/locales/fil/index.ts
git commit -m "feat(client): downloadAccessCardPdf helper and locale key"
```

---

### Task 5: GIS (PDF) button on AccessCardViewPage + test

**Files:**
- Modify: `kapwa-client/src/pages/AccessCardViewPage.tsx`
- Modify: `kapwa-client/src/pages/AccessCardViewPage.test.tsx`

**Interfaces:**
- Consumes: `downloadAccessCardPdf` (Task 4).
- Produces: "GIS (PDF)" button in the header card area of AccessCardViewPage; click calls `downloadAccessCardPdf(id!)`.

- [ ] **Step 1: Write the failing test**

In `kapwa-client/src/pages/AccessCardViewPage.test.tsx`, add `mockDownloadAccessCardPdf` to the hoisted mock object, add to the `vi.mock('../lib/api')` exports, and add a test:

```ts
const { mockApiGet, mockDownloadAccessCardPdf } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockDownloadAccessCardPdf: vi.fn(),
}));

// in vi.mock('../lib/api'):
  downloadAccessCardPdf: (...args: unknown[]) => mockDownloadAccessCardPdf(...args),

// new test:
describe('AccessCardViewPage — GIS PDF export', () => {
  it('downloads the access card PDF when the button is clicked', async () => {
    renderWithSWR(<AccessCardViewPage />);
    const btn = await screen.findByRole('button', { name: /gis \(pdf\)/i });
    btn.click();
    expect(mockDownloadAccessCardPdf).toHaveBeenCalledWith('ben1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- AccessCardViewPage` (from `kapwa-client/`)
Expected: FAIL — button not found

- [ ] **Step 3: Add the button**

In `kapwa-client/src/pages/AccessCardViewPage.tsx`:
- Import: `import { api, downloadAccessCardPdf } from '../lib/api';` (update existing `import { api } from '../lib/api';`)
- Add `Download` to lucide-react imports: `import { ..., Download } from 'lucide-react';`
- In the header card, next to the name/code block (e.g. after the `<p className="font-mono text-sm text-primary">{cardData.code}</p>` area, inside the same flex container or below), add:

```tsx
<Button
  variant="outline"
  size="sm"
  className="gap-1.5"
  onClick={() => downloadAccessCardPdf(id!)}
>
  <Download size={14} /> {t('accessCard.exportGisPdf', 'GIS (PDF)')}
</Button>
```

Place it in the `<div className="flex items-start justify-between gap-2">` row, e.g. after the Badge, or as a small actions row under the code. Simplest: replace the single `<Badge ...>` with a flex container:

```tsx
<div className="flex items-center gap-2">
  <Badge variant="default" className="text-[10px]">{t('accessCard.totalCount', '{{count}} total', { count: cardData.services.length })}</Badge>
  <Button
    variant="outline"
    size="sm"
    className="gap-1.5"
    onClick={() => downloadAccessCardPdf(id!)}
  >
    <Download size={14} /> {t('accessCard.exportGisPdf', 'GIS (PDF)')}
  </Button>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- AccessCardViewPage` (from `kapwa-client/`)
Expected: PASS

- [ ] **Step 5: Typecheck + full client suite**

Run: `npm run typecheck && npm run test:run` (from `kapwa-client/`)
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/pages/AccessCardViewPage.tsx src/pages/AccessCardViewPage.test.tsx
git commit -m "feat(client): gis pdf export button on access card view page"
```

---

### Task 6: End-to-end verification against rebuilt stack

**Files:** none (verification only)

**Interfaces:** consumes all previous tasks.

- [ ] **Step 1: Rebuild the running stack (api + client)**

Run from `kapwa-server/`:

```bash
podman-compose -f docker-compose.yml -f docker-compose.override.yml build --no-cache api client
podman-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

- [ ] **Step 2: Verify endpoint via API**

Use the demo admin token (login `admin@mswdo.test`/`admin123` via `/api/v1/auth/login`, or localStorage `kapwa_token`) and fetch:

```bash
curl -s -D - -o /tmp/opencode/ac-pdf.pdf -H "Authorization: Bearer <token>" http://localhost:8090/api/v1/access-cards/beneficiary/<beneficiaryId>/gis-pdf
```

Expected: `200`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="NORZ-AC-2026-0001-access-card.pdf"`, `%PDF`.

Then `pdfinfo /tmp/opencode/ac-pdf.pdf` → Pages: 2, A4. `pdftotext -layout` → contains PAALALA, services rows, family names, code.

- [ ] **Step 3: Verify client button via Playwright**

Navigate to `/beneficiary/<id>/access-card` at `http://localhost:8090`, click "GIS (PDF)" → download event fires → file named `<code>-access-card.pdf` → validate with pdfinfo/pdftotext.

- [ ] **Step 4: Report results**

Summarize: endpoint 200/pdf/2-page/A4, content populated, button download works.
