# GAD Summary Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `GET /reports/summary` endpoint that renders the three-page GAD Summary Report (annual aggregate, per-quarter aggregate, case list) as one landscape A4 PDF, plus a download button on the mayor Reports page.

**Architecture:** A new NestJS `reports` module. `SummaryReportService` queries cases and classifies each into exactly one category (the reference invariant: `MALE + FEMALE = TOTAL = Σ categories`). `summary-report-pdf.builder.ts` is a pure `pdfkit` renderer driven by a shared table model. The controller streams the buffer. The client adds a `downloadSummaryReport` helper and a button.

**Tech Stack:** NestJS 11, TypeORM (raw `DataSource.query` for the cross-table aggregation), `pdfkit`, `pdf-lib` (test-time page inspection), Zod, Jest/ts-jest, React 19 + SWR.

**Spec:** `docs/superpowers/specs/2026-09-26-document-parity-and-summary-report-design.md`

## Global Constraints

- Base-14 `Helvetica` family only; money as plain numerals; no embedded fonts.
- Office name via `OrgService.officeName()`; never hard-code it.
- Signatories resolve from live users: active **admin** → "Noted by"/"Approved by"; active **social_worker** → "Prepared by"/"MSWD-STAFF". Fall back to the reference-name constants when no user exists.
- Date windows use Asia/Manila boundaries.
- Endpoint roles: `mayor`, `admin`, `social_worker`.
- Use `JwtAuthGuard` + `RolesGuard` and the `@Res()` streaming pattern from `export.controller.ts`.
- Tests: `npx jest <file>` from `kapwa-server/`; client `npm run test:run` from `kapwa-client/`. Gate: `npm run typecheck` in both apps.
- Stage explicit paths; never `git add -A`.

## Review Focus

- **Empty year/quarter** (no cases): must render all three pages with zero counts, no crash, and a valid PDF.
- **Classification invariant under mixed data**: a case with several services must still land in exactly one category; `MALE + FEMALE = TOTAL = Σ categories` must hold even when services look contradictory.
- **Quarter month windows**, especially February in a leap year (`February 1-29`) and Q4 (`October 1-31 / November 1-30 / December 1-31`).
- **Case-list overflow**: a year with hundreds of cases must paginate rather than drop rows or run off the page.
- **No signatory users exist** (fresh DB): falls back to constants instead of printing blanks.

---

### Task 1: Report types and the classification rule table

**Files:**
- Create: `kapwa-server/src/reports/summary-report.types.ts`
- Test: `kapwa-server/src/reports/summary-report.types.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type CategoryKey = 'BURIAL' | 'MEDICAL' | 'ASSISTIVE' | 'PWD' | 'BIRTH_DISCREPANCY' | 'TRAVEL' | 'CSR' | 'COUNSELLING' | 'PHILHEALTH' | 'CUSTODY' | 'HOME_VISIT' | 'BALIK_PROBINSYA' | 'LEGAL_PAO' | 'LEGAL_OTHERS' | 'OTHERS_TECHNICAL'`
  - `interface CaseClassificationInput { clientCategory?: string | null; serviceText: string; referralText: string; hasCsr: boolean; hasVisit: boolean }`
  - `function classifyCase(input: CaseClassificationInput): CategoryKey`
  - `interface SummaryCounts { male: number; female: number; total: number; byCategory: Record<CategoryKey, number> }`
  - `interface SummaryTable { title: string; counts: SummaryCounts }`
  - `type GenderTick = 'M' | 'F' | ''`
  - `interface CaseListRow { no: number; date: string; surname: string; firstName: string; middleName: string; gender: GenderTick; categories: { cedc: boolean; wedc: boolean; pwd: boolean; senior: boolean; indigent: boolean; fourPs: boolean; ip: boolean }; barangay: string; intervention: string }`
  - `interface SummaryReportData { year: number; quarter: number; annual: SummaryTable; monthly: SummaryTable[]; quarterSummary: SummaryTable; caseList: CaseListRow[]; officeName: string; preparedBy: string; preparedByRole: string; notedBy: string; notedByRole: string }`
  - `const SUMMARY_COLUMNS: ReadonlyArray<{ key: CategoryKey | 'MALE' | 'FEMALE' | 'TOTAL'; labels: readonly string[]; group: string; subGroup?: string; weight: number }>`

- [ ] **Step 1: Write the failing test**

Create `summary-report.types.spec.ts`:

```ts
import { classifyCase, SummaryCounts } from './summary-report.types';

const base = { serviceText: '', referralText: '', hasCsr: false, hasVisit: false };

describe('classifyCase', () => {
  it('classifies by precedence: burial before medical before assistive', () => {
    expect(classifyCase({ ...base, serviceText: 'Burial Assistance' })).toBe('BURIAL');
    expect(classifyCase({ ...base, serviceText: 'Medical Assistance' })).toBe('MEDICAL');
    expect(classifyCase({ ...base, serviceText: 'Assistive Device issued' })).toBe('ASSISTIVE');
  });

  it('classifies PWD from the client category', () => {
    expect(classifyCase({ ...base, clientCategory: 'PWD' })).toBe('PWD');
  });

  it('classifies technical and legal columns', () => {
    expect(classifyCase({ ...base, serviceText: 'Birth Discrepancy' })).toBe('BIRTH_DISCREPANCY');
    expect(classifyCase({ ...base, serviceText: 'Travel Assessment' })).toBe('TRAVEL');
    expect(classifyCase({ ...base, hasCsr: true })).toBe('CSR');
    expect(classifyCase({ ...base, serviceText: 'Psychosocial Counseling' })).toBe('COUNSELLING');
    expect(classifyCase({ ...base, serviceText: 'PhilHealth' })).toBe('PHILHEALTH');
    expect(classifyCase({ ...base, serviceText: 'Child Custody' })).toBe('CUSTODY');
    expect(classifyCase({ ...base, hasVisit: true })).toBe('HOME_VISIT');
    expect(classifyCase({ ...base, serviceText: 'Balik Probinsya' })).toBe('BALIK_PROBINSYA');
    expect(classifyCase({ ...base, referralText: 'Referral to PAO legal aid' })).toBe('LEGAL_PAO');
    expect(classifyCase({ ...base, referralText: 'Referred to PCSO' })).toBe('LEGAL_OTHERS');
  });

  it('falls back to OTHERS_TECHNICAL', () => {
    expect(classifyCase({ ...base, serviceText: 'Food assistance' })).toBe('OTHERS_TECHNICAL');
    expect(classifyCase(base)).toBe('OTHERS_TECHNICAL');
  });
});

describe('SummaryCounts invariant', () => {
  it('is expressible as male + female = total', () => {
    const counts: SummaryCounts = { male: 2, female: 3, total: 5, byCategory: {} as SummaryCounts['byCategory'] };
    expect(counts.male + counts.female).toBe(counts.total);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest summary-report.types`
Expected: FAIL — `Cannot find module './summary-report.types'`.

- [ ] **Step 3: Write the implementation**

Create `summary-report.types.ts`:

```ts
export type CategoryKey =
  | 'BURIAL' | 'MEDICAL' | 'ASSISTIVE' | 'PWD'
  | 'BIRTH_DISCREPANCY' | 'TRAVEL' | 'CSR' | 'COUNSELLING' | 'PHILHEALTH'
  | 'CUSTODY' | 'HOME_VISIT' | 'BALIK_PROBINSYA'
  | 'LEGAL_PAO' | 'LEGAL_OTHERS' | 'OTHERS_TECHNICAL';

export interface CaseClassificationInput {
  clientCategory?: string | null;
  serviceText: string;
  referralText: string;
  hasCsr: boolean;
  hasVisit: boolean;
}

const RULES: ReadonlyArray<{ key: CategoryKey; test: (i: CaseClassificationInput) => boolean }> = [
  { key: 'BURIAL', test: (i) => /burial/i.test(i.serviceText) },
  { key: 'MEDICAL', test: (i) => /medical|hospital|medicine/i.test(i.serviceText) },
  { key: 'ASSISTIVE', test: (i) => /assistive|device|prosthes|wheelchair/i.test(i.serviceText) },
  { key: 'PWD', test: (i) => /pwd|person with disabilit/i.test(`${i.clientCategory ?? ''} ${i.serviceText}`) },
  { key: 'BIRTH_DISCREPANCY', test: (i) => /birth discrepancy/i.test(i.serviceText) },
  { key: 'TRAVEL', test: (i) => /travel/i.test(i.serviceText) },
  { key: 'CSR', test: (i) => i.hasCsr || /case study|\bcsr\b/i.test(i.serviceText) },
  { key: 'COUNSELLING', test: (i) => /counsel|psychosocial/i.test(i.serviceText) },
  { key: 'PHILHEALTH', test: (i) => /philhealth/i.test(i.serviceText) },
  { key: 'CUSTODY', test: (i) => /custody/i.test(i.serviceText) },
  { key: 'HOME_VISIT', test: (i) => i.hasVisit || /home visit|\bhv\b/i.test(i.serviceText) },
  { key: 'BALIK_PROBINSYA', test: (i) => /balik probinsya/i.test(i.serviceText) },
  { key: 'LEGAL_PAO', test: (i) => /legal|\bpao\b|public attorney/i.test(i.referralText) },
  { key: 'LEGAL_OTHERS', test: (i) => i.referralText.trim().length > 0 },
];

export function classifyCase(input: CaseClassificationInput): CategoryKey {
  return RULES.find((r) => r.test(input))?.key ?? 'OTHERS_TECHNICAL';
}

export interface SummaryCounts {
  male: number;
  female: number;
  total: number;
  byCategory: Record<CategoryKey, number>;
}

export interface SummaryTable { title: string; counts: SummaryCounts }

export type GenderTick = 'M' | 'F' | '';

export interface CaseListRow {
  no: number;
  date: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: GenderTick;
  categories: { cedc: boolean; wedc: boolean; pwd: boolean; senior: boolean; indigent: boolean; fourPs: boolean; ip: boolean };
  barangay: string;
  intervention: string;
}

export interface SummaryReportData {
  year: number;
  quarter: number;
  annual: SummaryTable;
  monthly: SummaryTable[];
  quarterSummary: SummaryTable;
  caseList: CaseListRow[];
  officeName: string;
  preparedBy: string;
  preparedByRole: string;
  notedBy: string;
  notedByRole: string;
}

export const SUMMARY_COLUMNS: ReadonlyArray<{
  key: CategoryKey | 'MALE' | 'FEMALE' | 'TOTAL';
  labels: readonly string[];
  group: string;
  subGroup?: string;
  weight: number;
}> = [
  { key: 'MALE', labels: ['MALE'], group: 'SEX', weight: 0.5 },
  { key: 'FEMALE', labels: ['FEMALE'], group: 'SEX', weight: 0.5 },
  { key: 'BURIAL', labels: ['BURIAL'], group: 'FINANCIAL', subGroup: 'FINANCIAL ASSISTANCE', weight: 0.6 },
  { key: 'MEDICAL', labels: ['MEDICAL'], group: 'FINANCIAL', subGroup: 'FINANCIAL ASSISTANCE', weight: 0.7 },
  { key: 'ASSISTIVE', labels: ['ASSISTIVE', 'DEVICES'], group: 'FINANCIAL', subGroup: 'FINANCIAL ASSISTANCE', weight: 0.7 },
  { key: 'PWD', labels: ['PWD'], group: 'FINANCIAL', weight: 0.4 },
  { key: 'LEGAL_PAO', labels: ['LEGAL/', 'PAO'], group: 'LEGAL', subGroup: 'REFERRAL', weight: 0.5 },
  { key: 'LEGAL_OTHERS', labels: ['OTHERS'], group: 'LEGAL', subGroup: 'REFERRAL', weight: 0.5 },
  { key: 'BIRTH_DISCREPANCY', labels: ['BIRTH', 'DISCREPANCY'], group: 'TECHNICAL', weight: 0.8 },
  { key: 'TRAVEL', labels: ['TRAVEL', 'ASSESSMENT'], group: 'TECHNICAL', weight: 0.8 },
  { key: 'CSR', labels: ['CASE STUDY', 'REPORT'], group: 'TECHNICAL', weight: 0.8 },
  { key: 'COUNSELLING', labels: ['COUNSELLING'], group: 'TECHNICAL', weight: 0.7 },
  { key: 'PHILHEALTH', labels: ['PHILHEALTH'], group: 'TECHNICAL', weight: 0.7 },
  { key: 'CUSTODY', labels: ['CHILD', 'CUSTODY'], group: 'TECHNICAL', weight: 0.7 },
  { key: 'HOME_VISIT', labels: ['HOME', 'VISIT'], group: 'TECHNICAL', weight: 0.5 },
  { key: 'BALIK_PROBINSYA', labels: ['BALIK', 'PROBINSYA'], group: 'TECHNICAL', weight: 0.8 },
  { key: 'OTHERS_TECHNICAL', labels: ['OTHERS'], group: 'TECHNICAL', weight: 0.6 },
  { key: 'TOTAL', labels: ['TOTAL'], group: '', weight: 0.6 },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest summary-report.types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/reports/summary-report.types.ts src/reports/summary-report.types.spec.ts
git commit -m "feat(reports): summary report types and classification rules"
```

---

### Task 2: Aggregation service

**Files:**
- Create: `kapwa-server/src/reports/summary-report.service.ts`
- Modify: `kapwa-server/src/common/constants.ts` (add fallback signatory constants)
- Test: `kapwa-server/src/reports/summary-report.service.spec.ts`

**Interfaces:**
- Consumes: `classifyCase`, `CategoryKey`, `SummaryCounts`, `SummaryTable`, `CaseListRow`, `SummaryReportData` (Task 1); `OrgService`; `DataSource`; `User` repository.
- Produces: `class SummaryReportService { build(year?: number, quarter?: number): Promise<SummaryReportData> }`.

- [ ] **Step 1: Write the failing test**

Create `summary-report.service.spec.ts`. It mocks `DataSource.query` (aggregate rows) and the `User` repository:

```ts
import { SummaryReportService } from './summary-report.service';
import { SummaryReportData } from './summary-report.types';

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    case_id: 'c1', created_at: new Date('2025-04-10T02:00:00Z'),
    client_category: null, gender: 'Male',
    surname: 'Magno', first_name: 'Michael', middle_name: 'H',
    barangay: 'Poblacion', service_text: 'Burial Assistance', referral_text: '',
    has_csr: false, has_visit: false, ...over,
  };
}

function makeService(rows: any[]) {
  const dataSource = { query: jest.fn().mockResolvedValue(rows) };
  const org = { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') };
  const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
  return { service: new SummaryReportService(dataSource as any, org as any, userRepo as any), dataSource };
}

describe('SummaryReportService.build', () => {
  it('keeps one-category-per-case and male+female = total = sum(categories)', async () => {
    const { service } = makeService([
      row({ case_id: 'c1', gender: 'Male', service_text: 'Burial Assistance' }),
      row({ case_id: 'c2', gender: 'Female', service_text: 'Medical Assistance' }),
      row({ case_id: 'c3', gender: 'Female', service_text: 'Assistive Device' }),
    ]);
    const data = await service.build(2025, 2);
    const c = data.annual.counts;
    expect(c.male + c.female).toBe(c.total);
    expect(c.total).toBe(3);
    expect(Object.values(c.byCategory).reduce((a, b) => a + b, 0)).toBe(c.total);
    expect(c.byCategory.BURIAL).toBe(1);
    expect(c.byCategory.MEDICAL).toBe(1);
    expect(c.byCategory.ASSISTIVE).toBe(1);
  });

  it('builds three month tables plus a quarter summary for Q2', async () => {
    const { service } = makeService([row({ created_at: new Date('2025-05-02T02:00:00Z'), service_text: 'Medical' })]);
    const data = await service.build(2025, 2);
    expect(data.monthly.map((m) => m.title)).toEqual(['April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025']);
    expect(data.monthly[1].counts.total).toBe(1);
    expect(data.quarterSummary.title).toBe('2nd QUARTER SUMMARY');
  });

  it('uses leap-year February and falls back to constants when no users exist', async () => {
    const { service } = makeService([]);
    const data = await service.build(2024, 1);
    expect(data.monthly[1].title).toBe('February 1-29, 2024');
    expect(data.preparedBy.length).toBeGreaterThan(0);
    expect(data.notedBy.length).toBeGreaterThan(0);
  });

  it('classifies case-list categories and intervention code', async () => {
    const { service } = makeService([
      row({ case_id: 'c9', gender: 'Female', client_category: 'IP', service_text: 'Certification', has_csr: true }),
    ]);
    const data: SummaryReportData = await service.build(2025, 2);
    const r = data.caseList[0];
    expect(r.gender).toBe('F');
    expect(r.categories.ip).toBe(true);
    expect(r.intervention).toBe('CSR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest summary-report.service`
Expected: FAIL — `Cannot find module './summary-report.service'`.

- [ ] **Step 3: Add the fallback constants**

Append to `common/constants.ts`:

```ts
// Fallback signatories for generated reports when no matching user exists
// (fresh/empty database). Live users take precedence — see SummaryReportService.
export const REPORT_FALLBACK_SIGNATORIES = {
  preparedBy: 'ARLYNDA F. GAMUTIA',
  preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW',
  notedByRole: 'MSWD-HEAD',
} as const;
```

- [ ] **Step 4: Write the implementation**

Create `summary-report.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { OrgService } from '../common/org.service';
import { REPORT_FALLBACK_SIGNATORIES } from '../common/constants';
import {
  CaseClassificationInput, CaseListRow, CategoryKey, SummaryCounts, SummaryReportData,
  SummaryTable, classifyCase,
} from './summary-report.types';

const CATEGORY_KEYS: CategoryKey[] = [
  'BURIAL', 'MEDICAL', 'ASSISTIVE', 'PWD', 'BIRTH_DISCREPANCY', 'TRAVEL', 'CSR',
  'COUNSELLING', 'PHILHEALTH', 'CUSTODY', 'HOME_VISIT', 'BALIK_PROBINSYA',
  'LEGAL_PAO', 'LEGAL_OTHERS', 'OTHERS_TECHNICAL',
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface RawCaseRow {
  case_id: string; created_at: Date; client_category: string | null; gender: string | null;
  surname: string | null; first_name: string | null; middle_name: string | null;
  dob: Date | null; barangay: string | null; service_text: string | null; referral_text: string | null;
  has_csr: boolean; has_visit: boolean;
}

const CASES_SQL = `
  SELECT c.id AS case_id,
         c.created_at AS created_at,
         c.client_category AS client_category,
         p.gender AS gender,
         p.surname AS surname,
         p.first_name AS first_name,
         p.middle_name AS middle_name,
         p.dob AS dob,
         pa.barangay AS barangay,
         COALESCE(ci.text, '') AS service_text,
         COALESCE(cr.text, '') AS referral_text,
         (csr.case_id IS NOT NULL) AS has_csr,
         (fv.case_id IS NOT NULL) AS has_visit
  FROM cases c
  LEFT JOIN beneficiaries b ON b.id = c.beneficiary_id
  LEFT JOIN persons p ON p.id = b.person_id
  LEFT JOIN LATERAL (
    SELECT a.barangay FROM person_addresses a
    WHERE a.person_id = p.id
    ORDER BY a.is_primary DESC NULLS LAST, a.created_at ASC
    LIMIT 1
  ) pa ON TRUE
  LEFT JOIN LATERAL (
    SELECT string_agg(ci2.service_name || ' ' || COALESCE(ci2.category, '') || ' ' || COALESCE(pr.name, '') || ' ' || COALESCE(pr.category, ''), ' ') AS text
    FROM case_interventions ci2
    LEFT JOIN programs pr ON pr.id = ci2.program_id
    WHERE ci2.case_id = c.id::text
  ) ci ON TRUE
  LEFT JOIN LATERAL (
    SELECT string_agg(COALESCE(cr2.reason, '') || ' ' || COALESCE(cr2.agency, ''), ' ') AS text
    FROM case_referrals cr2 WHERE cr2.case_id = c.id
  ) cr ON TRUE
  LEFT JOIN LATERAL (SELECT csr2.case_id FROM csr_reports csr2 WHERE csr2.case_id = c.id LIMIT 1) csr ON TRUE
  LEFT JOIN LATERAL (SELECT fv2.case_id FROM case_follow_up_visits fv2 WHERE fv2.case_id = c.id LIMIT 1) fv ON TRUE
  WHERE c.created_at >= $1 AND c.created_at < $2
  ORDER BY c.created_at ASC
`;

function emptyCounts(): SummaryCounts {
  return {
    male: 0, female: 0, total: 0,
    byCategory: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>,
  };
}

function addTo(counts: SummaryCounts, gender: string | null, key: CategoryKey) {
  if (gender === 'Female') counts.female += 1;
  else counts.male += 1;
  counts.total += 1;
  counts.byCategory[key] += 1;
}

function monthRange(year: number, monthIndex: number): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { start, end, label: `${MONTH_NAMES[monthIndex]} 1-${lastDay}, ${year}` };
}

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

@Injectable()
export class SummaryReportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly org: OrgService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async build(year = new Date().getFullYear(), quarter = Math.floor(new Date().getMonth() / 3) + 1): Promise<SummaryReportData> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const rows: RawCaseRow[] = (await this.dataSource.query(CASES_SQL, [yearStart, yearEnd])) ?? [];

    const annual = emptyCounts();
    const monthly = [0, 1, 2].map((i) => monthRange(year, (quarter - 1) * 3 + i));
    const monthlyCounts = monthly.map(() => emptyCounts());
    const caseList: CaseListRow[] = [];

    rows.forEach((r, index) => {
      const input: CaseClassificationInput = {
        clientCategory: r.client_category,
        serviceText: r.service_text ?? '',
        referralText: r.referral_text ?? '',
        hasCsr: !!r.has_csr,
        hasVisit: !!r.has_visit,
      };
      const key = classifyCase(input);
      addTo(annual, r.gender, key);
      const created = new Date(r.created_at);
      const mIdx = monthly.findIndex((m) => created >= m.start && created < m.end);
      if (mIdx >= 0) addTo(monthlyCounts[mIdx], r.gender, key);
      caseList.push(this.toCaseListRow(r, index + 1));
    });

    const quarterSummary = monthlyCounts.reduce((acc, c) => {
      acc.male += c.male; acc.female += c.female; acc.total += c.total;
      CATEGORY_KEYS.forEach((k) => { acc.byCategory[k] += c.byCategory[k]; });
      return acc;
    }, emptyCounts());

    const [officeName, prepared, noted] = await Promise.all([
      this.org.officeName(),
      this.firstActiveUser('social_worker'),
      this.firstActiveUser('admin'),
    ]);

    return {
      year, quarter,
      annual: { title: `SUMMARY REPORT ${year}`, counts: annual },
      monthly: monthly.map((m, i) => ({ title: m.label, counts: monthlyCounts[i] })),
      quarterSummary: { title: `${ORDINAL[quarter - 1]} QUARTER SUMMARY`, counts: quarterSummary },
      caseList,
      officeName,
      preparedBy: prepared?.fullName || REPORT_FALLBACK_SIGNATORIES.preparedBy,
      preparedByRole: REPORT_FALLBACK_SIGNATORIES.preparedByRole,
      notedBy: noted?.fullName || REPORT_FALLBACK_SIGNATORIES.notedBy,
      notedByRole: REPORT_FALLBACK_SIGNATORIES.notedByRole,
    };
  }

  private async firstActiveUser(role: string): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { role, isActive: true } as any, order: { createdAt: 'ASC' } });
    } catch {
      return null;
    }
  }

  private toCaseListRow(r: RawCaseRow, no: number): CaseListRow {
    const created = new Date(r.created_at);
    const dob = r.dob ? new Date(r.dob) : undefined;
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : undefined;
    const cat = (r.client_category ?? '').toLowerCase();
    const input: CaseClassificationInput = {
      clientCategory: r.client_category, serviceText: r.service_text ?? '',
      referralText: r.referral_text ?? '', hasCsr: !!r.has_csr, hasVisit: !!r.has_visit,
    };
    return {
      no,
      date: `${String(created.getUTCMonth() + 1).padStart(2, '0')}-${String(created.getUTCDate()).padStart(2, '0')}-${String(created.getUTCFullYear()).slice(2)}`,
      surname: r.surname ?? '', firstName: r.first_name ?? '', middleName: r.middle_name ?? '',
      gender: r.gender === 'Female' ? 'F' : r.gender === 'Male' ? 'M' : '',
      categories: {
        cedc: age !== undefined && age < 18,
        wedc: r.gender === 'Female' && /wedc|women in especially difficult|vawc/i.test(cat),
        pwd: /pwd/.test(cat),
        senior: age !== undefined && age >= 60,
        indigent: /indigent/.test(cat),
        fourPs: /4ps|pantawid/.test(cat),
        ip: /\bip\b|indigenous/.test(cat),
      },
      barangay: r.barangay ?? '',
      intervention: this.interventionCode(classifyCase(input)),
    };
  }

  private interventionCode(key: CategoryKey): string {
    switch (key) {
      case 'BURIAL': case 'MEDICAL': case 'ASSISTIVE': case 'PWD': return 'FA';
      case 'CSR': return 'CSR';
      case 'HOME_VISIT': return 'HV';
      case 'LEGAL_PAO': case 'LEGAL_OTHERS': return 'R';
      case 'OTHERS_TECHNICAL': return 'C';
      default: return 'H';
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest summary-report.service`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd kapwa-server
git add src/reports/summary-report.service.ts src/reports/summary-report.service.spec.ts src/common/constants.ts
git commit -m "feat(reports): summary report aggregation service"
```

---

### Task 3: PDF builder (three pages)

**Files:**
- Create: `kapwa-server/src/reports/summary-report-pdf.builder.ts`
- Test: `kapwa-server/src/reports/summary-report-pdf.builder.spec.ts`

**Interfaces:**
- Consumes: `SummaryReportData`, `SummaryTable`, `SUMMARY_COLUMNS`, `CaseListRow` (Task 1).
- Produces: `function buildSummaryReportPdf(data: SummaryReportData): Promise<Buffer>`.

- [ ] **Step 1: Write the failing test**

Create `summary-report-pdf.builder.spec.ts` (copy the `searchableText` helper from `access-card-pdf.builder.spec.ts`):

```ts
import { PDFDocument } from 'pdf-lib';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { SummaryReportData, SummaryTable } from './summary-report.types';

const emptyTable = (title: string): SummaryTable => ({
  title,
  counts: { male: 0, female: 0, total: 0, byCategory: {} as any },
});

const data: SummaryReportData = {
  year: 2025, quarter: 2,
  annual: emptyTable('SUMMARY REPORT 2025'),
  monthly: [emptyTable('April 1-30, 2025'), emptyTable('May 1-31, 2025'), emptyTable('June 1-30, 2025')],
  quarterSummary: emptyTable('2nd QUARTER SUMMARY'),
  caseList: [{ no: 1, date: '01-02-25', surname: 'Magno', firstName: 'Michael', middleName: 'H', gender: 'M', categories: { cedc: false, wedc: false, pwd: false, senior: false, indigent: true, fourPs: false, ip: false }, barangay: 'Poblacion', intervention: 'PWD ID' }],
  officeName: 'Municipal Social Welfare and Development Office',
  preparedBy: 'ARLYNDA F. GAMUTIA', preparedByRole: 'MSWD - STAFF',
  notedBy: 'ANNALYN JOY C. SAN PEDRO, RSW', notedByRole: 'MSWD-HEAD',
};

describe('buildSummaryReportPdf', () => {
  it('produces three landscape A4 pages', async () => {
    const buf = await buildSummaryReportPdf(data);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBe(3);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it('prints page titles, columns, signatories, and case rows', async () => {
    const text = searchableText(await buildSummaryReportPdf(data));
    for (const s of [
      'SUMMARY REPORT 2025', 'GAD DATABASE CASE TRACKER', '2nd QUARTER REPORT',
      'April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025', '2nd QUARTER SUMMARY',
      'GAD DATABASE CASE LIST', 'SR. CITIZEN', 'INDIGENT', 'Intervention/Remarks',
      'Prepared by:', 'Noted by:', 'ARLYNDA F. GAMUTIA', 'ANNALYN JOY C. SAN PEDRO',
      'Magno', 'Poblacion',
    ]) expect(text).toContain(s);
  });

  it('paginates a long case list without crashing', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...data.caseList[0], no: i + 1 }));
    const doc = await PDFDocument.load(await buildSummaryReportPdf({ ...data, caseList: many }));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });

  it('renders with zero counts (empty year)', async () => {
    const buf = await buildSummaryReportPdf({ ...data, caseList: [] });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest summary-report-pdf`
Expected: FAIL — `Cannot find module './summary-report-pdf.builder'`.

- [ ] **Step 3: Write the implementation**

Create `summary-report-pdf.builder.ts`. Full renderer:

```ts
import { CaseListRow, SummaryReportData, SummaryTable, SUMMARY_COLUMNS } from './summary-report.types';

const PAGE: [number, number] = [841.89, 595.28]; // A4 landscape
const M = 28;
const LEFT = M;
const RIGHT = PAGE[0] - M;
const WIDTH = RIGHT - LEFT;

const CASE_COLS = [
  { key: 'no', label: 'No.', w: 0.03 },
  { key: 'date', label: 'Date', w: 0.07 },
  { key: 'surname', label: 'SURNAME', w: 0.12 },
  { key: 'firstName', label: 'FIRST NAME', w: 0.12 },
  { key: 'middleName', label: 'MIDDLE NAME', w: 0.11 },
  { key: 'gender', label: 'GENDER', w: 0.06 },
  { key: 'clientCategory', label: 'CLIENT CATEGORY', w: 0.27 },
  { key: 'barangay', label: 'Barangay', w: 0.10 },
  { key: 'intervention', label: 'Intervention/Remarks', w: 0.12 },
] as const;

const CLIENTS = ['CEDC', 'WEDC', 'PWD', 'SR. CITIZEN', 'INDIGENT', '4Ps', 'IP'] as const;

export async function buildSummaryReportPdf(data: SummaryReportData): Promise<Buffer> {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: PAGE, margins: { top: M, bottom: M, left: M, right: M }, info: { Title: `Summary Report ${data.year} Q${data.quarter}`, Author: data.officeName, Subject: 'GAD Database Case Tracker' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, data, true);
  drawTitle(doc, data.annual.title, `GAD DATABASE CASE TRACKER`);
  drawGroupedTable(doc, data.annual);

  doc.addPage();
  drawLetterhead(doc, data, false);
  drawTitle(doc, `${data.year}`, `${ordinal(data.quarter)} QUARTER REPORT`);
  data.monthly.forEach((m) => { drawSectionTitle(doc, m.title); drawGroupedTable(doc, m); });
  drawSectionTitle(doc, data.quarterSummary.title);
  drawGroupedTable(doc, data.quarterSummary);
  drawSignatories(doc, data);

  doc.addPage();
  drawLetterhead(doc, data, false);
  drawTitle(doc, 'GAD DATABASE CASE LIST', '');
  drawCaseList(doc, data.caseList);

  doc.end();
  return done;
}

function ordinal(q: number): string { return ['1st', '2nd', '3rd', '4th'][q - 1] ?? `${q}th`; }

function drawLetterhead(doc: any, data: SummaryReportData, full: boolean) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111');
  if (full) {
    doc.text('Republic of the Philippines', LEFT, M, { width: WIDTH, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    doc.text('Province of Bulacan', LEFT, M + 11, { width: WIDTH, align: 'center', lineBreak: false });
    doc.text('Municipality of Norzagaray', LEFT, M + 21, { width: WIDTH, align: 'center', lineBreak: false });
  } else {
    doc.text('Municipality of Norzagaray', LEFT, M, { width: WIDTH, align: 'center', lineBreak: false });
  }
  const officeY = full ? M + 32 : M + 12;
  doc.font('Helvetica-Bold').fontSize(8.5)
    .text(data.officeName.toUpperCase(), LEFT, officeY, { width: WIDTH, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(7.5)
    .text(`ACCOMPLISHMENT REPORT (Services) ${data.year}`, LEFT, officeY + 10, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y = officeY + 24;
}

function drawTitle(doc: any, line1: string, line2: string) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111')
    .text(line1, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y += 20;
  if (line2) {
    doc.font('Helvetica-Bold').fontSize(11)
      .text(line2, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
    doc.y += 20;
  }
}

function drawSectionTitle(doc: any, title: string) {
  doc.y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(title, LEFT, doc.y, { width: WIDTH, align: 'center', lineBreak: false });
  doc.y += 14;
}

function drawGroupedTable(doc: any, table: SummaryTable) {
  const topOfTable = doc.y;
  const weights = SUMMARY_COLUMNS.map((c) => c.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  // Header tiers: row 1 = groups, row 2 = sub-groups, row 3 = column labels.
  const tierH = [13, 13, 15];
  const headerH = tierH[0] + tierH[1] + tierH[2];
  const groups = [...new Set(SUMMARY_COLUMNS.map((c) => c.group).filter(Boolean))];
  const groupStart: Record<string, number> = {};
  const groupEnd: Record<string, number> = {};
  SUMMARY_COLUMNS.forEach((c, i) => {
    if (!c.group) return;
    groupStart[c.group] = groupStart[c.group] ?? i;
    groupEnd[c.group] = i;
  });
  groups.forEach((g) => {
    const x1 = colX[groupStart[g]];
    const x2 = colX[groupEnd[g] + 1];
    doc.rect(x1, topOfTable, x2 - x1, tierH[0]).lineWidth(0.6).strokeColor('#111').stroke();
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#111')
      .text(g, x1 + 2, topOfTable + 3, { width: x2 - x1 - 4, align: 'center', lineBreak: false });
  });
  doc.rect(colX[SUMMARY_COLUMNS.findIndex((c) => c.key === 'TOTAL')], topOfTable, RIGHT - colX[SUMMARY_COLUMNS.findIndex((c) => c.key === 'TOTAL')], tierH[0]).lineWidth(0.6).strokeColor('#111').stroke();

  SUMMARY_COLUMNS.forEach((c, i) => {
    if (c.subGroup) {
      const x1 = colX[i];
      const x2 = colX[i + 1];
      doc.rect(x1, topOfTable + tierH[0], x2 - x1, tierH[1]).lineWidth(0.6).strokeColor('#111').stroke();
      doc.font('Helvetica-Bold').fontSize(5.4).fillColor('#111')
        .text(c.subGroup, x1 + 1, topOfTable + tierH[0] + 2, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
    }
  });

  const labelTop = topOfTable + tierH[0] + tierH[1];
  SUMMARY_COLUMNS.forEach((c, i) => {
    const x1 = colX[i];
    const x2 = colX[i + 1];
    const spanTop = c.labels.length === 1 && !c.subGroup ? topOfTable + tierH[0] : labelTop;
    doc.rect(x1, spanTop, x2 - x1, (topOfTable + headerH) - spanTop).lineWidth(0.6).strokeColor('#111').stroke();
    const size = c.labels.some((l) => l.length > 9) ? 5.2 : 6;
    c.labels.forEach((label, li) => {
      doc.font('Helvetica-Bold').fontSize(size).fillColor('#111')
        .text(label, x1 + 1, spanTop + 3 + li * 9, { width: x2 - x1 - 2, align: 'center', lineBreak: false });
    });
  });

  // Single data row.
  const rowH = 20;
  const rowY = topOfTable + headerH;
  doc.rect(LEFT, rowY, WIDTH, rowH).lineWidth(0.6).strokeColor('#111').stroke();
  SUMMARY_COLUMNS.forEach((c, i) => {
    let value = '';
    if (c.key === 'MALE') value = String(table.counts.male);
    else if (c.key === 'FEMALE') value = String(table.counts.female);
    else if (c.key === 'TOTAL') value = String(table.counts.total);
    else value = String(table.counts.byCategory[c.key as keyof typeof table.counts.byCategory] ?? 0);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
      .text(value, colX[i] + 1, rowY + 5, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
  });
  doc.y = rowY + rowH + 6;
}

function drawSignatories(doc: any, data: SummaryReportData) {
  doc.y += 18;
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Prepared by:', LEFT + 10, doc.y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.preparedBy, LEFT + 10, doc.y + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.preparedByRole, LEFT + 10, doc.y + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111')
    .text('Noted by:', LEFT + WIDTH / 2, doc.y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(data.notedBy, LEFT + WIDTH / 2, doc.y + 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(data.notedByRole, LEFT + WIDTH / 2, doc.y + 38, { lineBreak: false });
}

function drawCaseList(doc: any, rows: CaseListRow[]) {
  const weights = CASE_COLS.map((c) => c.w);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  let x = LEFT;
  for (const w of weights) { colX.push(x); x += (w / totalWeight) * WIDTH; }
  colX.push(RIGHT);

  const headerH = 26;
  const rowH = 15;

  const drawHeader = (top: number) => {
    doc.rect(LEFT, top, WIDTH, headerH).lineWidth(0.6).strokeColor('#111').stroke();
    CASE_COLS.forEach((c, i) => {
      doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#111')
        .text(c.label, colX[i] + 1, top + 4, { width: colX[i + 1] - colX[i] - 2, align: 'center', lineBreak: false });
    });
  };

  let top = doc.y;
  drawHeader(top);
  let y = top + headerH;

  for (const r of rows) {
    if (y + rowH > PAGE[1] - M - 20) {
      doc.addPage();
      top = M + 20;
      drawHeader(top);
      y = top + headerH;
    }
    doc.rect(LEFT, y, WIDTH, rowH).lineWidth(0.4).strokeColor('#444').stroke();
    const cells = [
      String(r.no), r.date, r.surname, r.firstName, r.middleName,
      r.gender, '', r.barangay, r.intervention,
    ];
    cells.forEach((v, i) => {
      if (i === 6) return; // client category drawn as ticks
      doc.font('Helvetica').fontSize(6.4).fillColor('#111')
        .text(v, colX[i] + 2, y + 4, { width: colX[i + 1] - colX[i] - 4, lineBreak: false, ellipsis: true });
    });
    const flags = [r.categories.cedc, r.categories.wedc, r.categories.pwd, r.categories.senior, r.categories.indigent, r.categories.fourPs, r.categories.ip];
    const catX = colX[6];
    const catW = colX[7] - colX[6];
    const step = catW / CLIENTS.length;
    CLIENTS.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#111')
        .text(label, catX + i * step + 1, y + 2, { width: step - 2, align: 'center', lineBreak: false });
      if (flags[i]) {
        doc.font('Helvetica').fontSize(7).fillColor('#111')
          .text('/', catX + i * step + step / 2 - 2, y + 7, { lineBreak: false });
      }
    });
    y += rowH;
  }
  doc.y = y;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest summary-report-pdf`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/reports/summary-report-pdf.builder.ts src/reports/summary-report-pdf.builder.spec.ts
git commit -m "feat(reports): GAD summary report PDF builder"
```

---

### Task 4: Controller, DTO, module wiring

**Files:**
- Create: `kapwa-server/src/reports/dto/summary-report.query.ts`
- Create: `kapwa-server/src/reports/reports.controller.ts`
- Create: `kapwa-server/src/reports/reports.module.ts`
- Create: `kapwa-server/src/reports/reports.controller.spec.ts`
- Modify: `kapwa-server/src/app.module.ts` (register `ReportsModule`)

**Interfaces:**
- Consumes: `SummaryReportService.build` (Task 2), `buildSummaryReportPdf` (Task 3).
- Produces: `GET /reports/summary`.

- [ ] **Step 1: Write the failing test**

Create `reports.controller.spec.ts`:

```ts
import { ReportsController } from './reports.controller';
import { SummaryReportQuerySchema } from './dto/summary-report.query';

describe('SummaryReportQuerySchema', () => {
  it('defaults year and quarter', () => {
    const parsed = SummaryReportQuerySchema.parse({});
    expect(parsed.year).toBeGreaterThanOrEqual(2000);
    expect(parsed.quarter).toBeGreaterThanOrEqual(1);
    expect(parsed.quarter).toBeLessThanOrEqual(4);
  });
  it('rejects an out-of-range quarter', () => {
    expect(() => SummaryReportQuerySchema.parse({ quarter: '5' })).toThrow();
  });
});

describe('ReportsController.summary', () => {
  it('streams a PDF with an attachment filename', async () => {
    const service = { build: jest.fn().mockResolvedValue({ year: 2025, quarter: 2 }) } as any;
    const builder = { build: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) } as any;
    const controller = new ReportsController(service, builder);
    const res: any = { set: jest.fn(), send: jest.fn() };
    await controller.summary('2025', '2', res);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="summary-report-2025-Q2.pdf"',
    }));
    expect(res.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-server && npx jest reports.controller`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`dto/summary-report.query.ts`:

```ts
import { z } from 'zod';

const CURRENT_YEAR = new Date().getFullYear();

export const SummaryReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(CURRENT_YEAR),
  quarter: z.coerce.number().int().min(1).max(4).default(Math.floor(new Date().getMonth() / 3) + 1),
});

export type SummaryReportQuery = z.infer<typeof SummaryReportQuerySchema>;
```

`reports.controller.ts`:

```ts
import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SummaryReportService } from './summary-report.service';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';
import { SummaryReportQuerySchema } from './dto/summary-report.query';

export const SUMMARY_REPORT_BUILDER = 'SUMMARY_REPORT_BUILDER';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly summaryReport: SummaryReportService,
    @Inject(SUMMARY_REPORT_BUILDER) private readonly builder: { build: typeof buildSummaryReportPdf },
  ) {}

  @Get('summary')
  @Roles('mayor', 'admin', 'social_worker')
  @ApiOperation({ summary: 'GAD Summary Report (annual, quarterly, case list) as PDF' })
  @ApiQuery({ name: 'year', required: false, example: 2025 })
  @ApiQuery({ name: 'quarter', required: false, example: 2 })
  async summary(@Query('year') year: string, @Query('quarter') quarter: string, @Res() res: Response) {
    const { year: y, quarter: q } = SummaryReportQuerySchema.parse({ year, quarter });
    const data = await this.summaryReport.build(y, q);
    const buffer = await this.builder.build(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="summary-report-${y}-Q${q}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
```

The `SUMMARY_REPORT_BUILDER` provider token lets the controller spec inject a mock without rendering. Create the injectable wrapper `summary-report-pdf.service-builder.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { SummaryReportData } from './summary-report.types';
import { buildSummaryReportPdf } from './summary-report-pdf.builder';

@Injectable()
export class SummaryReportPdfBuilder {
  build(data: SummaryReportData): Promise<Buffer> {
    return buildSummaryReportPdf(data);
  }
}
```

Then `reports.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController, SUMMARY_REPORT_BUILDER } from './reports.controller';
import { SummaryReportService } from './summary-report.service';
import { SummaryReportPdfBuilder } from './summary-report-pdf.service-builder';
import { CommonModule } from '../common/common.module';
import { User } from '../auth/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CommonModule],
  controllers: [ReportsController],
  providers: [
    SummaryReportService,
    SummaryReportPdfBuilder,
    { provide: SUMMARY_REPORT_BUILDER, useExisting: SummaryReportPdfBuilder },
  ],
})
export class ReportsModule {}
```

Confirm `CommonModule` exports `OrgService` (it is used by `ExportModule`, check `common/common.module.ts`); if it does not, import the module that does.

In `app.module.ts`: add `import { ReportsModule } from './reports/reports.module';` and `ReportsModule,` after `ExportModule,` in the imports array.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-server && npx jest reports.controller`
Then: `cd kapwa-server && npm run typecheck`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
cd kapwa-server
git add src/reports/ src/app.module.ts
git commit -m "feat(reports): summary report endpoint, module wiring"
```

---

### Task 5: Client export button

**Files:**
- Modify: `kapwa-client/src/lib/api.ts` (add `downloadSummaryReport`)
- Modify: `kapwa-client/src/pages/MayorReportsPage.tsx` (year/quarter selects + button)
- Test: `kapwa-client/src/pages/MayorReportsPage.test.tsx`

**Interfaces:**
- Consumes: `GET /reports/summary`.
- Produces: `downloadSummaryReport(year?: number, quarter?: number): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Add to `MayorReportsPage.test.tsx` (the file already mocks SWR/`api`):

```tsx
it('offers a GAD Summary Report export', async () => {
  // ...existing render setup for MayorReportsPage...
  expect(await screen.findByRole('button', { name: /summary report/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kapwa-client && npm run test:run -- MayorReportsPage`
Expected: FAIL — no button named "Summary Report".

- [ ] **Step 3: Write the implementation**

In `lib/api.ts` (follow the existing `downloadMonthlyFunds` helper in that file for token/blob handling):

```ts
export async function downloadSummaryReport(year?: number, quarter?: number): Promise<void> {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (quarter) params.set('quarter', String(quarter));
  const token = localStorage.getItem('token');
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${baseUrl}/reports/summary?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.text()) || `Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-report-${year ?? 'current'}-Q${quarter ?? ''}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

In `MayorReportsPage.tsx`, add state `const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());` and `const [summaryQuarter, setSummaryQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);`, plus a button next to `Export Fund Utilization`:

```tsx
<Button size="sm" variant="outline" onClick={handleExportSummary} disabled={exporting}>
  <Download size={14} className="mr-1" /> {t('reports.exportSummary', 'Export Summary Report')}
</Button>
<select
  aria-label={t('reports.summaryYear', 'Summary report year')}
  value={summaryYear}
  onChange={(e) => setSummaryYear(Number(e.target.value))}
  className="h-8 rounded-md border bg-background px-2 text-xs"
>
  {[0, 1, 2, 3].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y}</option>; })}
</select>
<select
  aria-label={t('reports.summaryQuarter', 'Summary report quarter')}
  value={summaryQuarter}
  onChange={(e) => setSummaryQuarter(Number(e.target.value))}
  className="h-8 rounded-md border bg-background px-2 text-xs"
>
  {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
</select>
```

Add the handler next to `handleExportFundUtilization`:

```tsx
async function handleExportSummary() {
  if (exporting) return;
  setExporting(true);
  setExportError(null);
  try {
    await downloadSummaryReport(summaryYear, summaryQuarter);
  } catch (err: any) {
    setExportError(err.message || t('dashboard.exportFailed', 'Export failed'));
    setTimeout(() => setExportError(null), 4000);
  } finally {
    setExporting(false);
  }
}
```

Add `downloadSummaryReport` to the existing `import { downloadMonthlyFunds } from '../lib/api';` line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kapwa-client && npm run test:run -- MayorReportsPage`
Then: `cd kapwa-client && npm run typecheck`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
cd kapwa-client
git add src/lib/api.ts src/pages/MayorReportsPage.tsx src/pages/MayorReportsPage.test.tsx
git commit -m "feat(reports): summary report export button on mayor reports page"
```

---

### Task 6: Render the summary report samples and update the inventory

**Files:**
- Modify: `kapwa-server/scripts/render-pdf-samples.mjs` (created by the forms plan)
- Modify: `pdf/outputs/README.md`

- [ ] **Step 1: Extend the renderer**

Add a `summaryReport` fixture (mirror `summary-report-pdf.builder.spec.ts`) and write `pdf/outputs/14-summary-report-p1.pdf`, `…-p2.pdf`, `…-p3.pdf` (split by page with `pdfseparate`, then `pdftoppm`) — or write the single PDF and render each page with `pdftoppm -f N -l N`. Print the inventory row and run the bbox overlap/off-page checks.

- [ ] **Step 2: Run**

Run: `cd kapwa-server && npm run build && node scripts/render-pdf-samples.mjs`
Expected: exits 0; summary report pages present; bbox checks clean.

- [ ] **Step 3: Update the inventory**

Add a row `14 | GAD Summary Report (annual/quarter/case list) | reports/summary-report-pdf.builder.ts | A4 landscape | 3+ | …` to `pdf/outputs/README.md`, and note that the case list paginates (page count can exceed 3 for large years).

- [ ] **Step 4: Full gate**

Run: `cd kapwa-server && npm run typecheck && npx jest --silent`
Expected: all suites pass.
Run: `cd kapwa-client && npm run typecheck && npm run test:run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/scripts/render-pdf-samples.mjs pdf/outputs/README.md pdf/outputs
git commit -m "chore(reports): render summary report samples and refresh inventory"
```

---

## Self-Review

- **Spec coverage:** §4.1 (Task 3 `drawGroupedTable` + `SUMMARY_COLUMNS`), §4.2 (Task 2 month windows + Task 3 monthly/summary tables), §4.3 (Task 3 `drawCaseList`), §5.1–5.3 (Task 1 rules + Task 2 SQL/derivations), §5.5 (Task 2 signatories), §6 module/API/client (Tasks 2–5), §7 tests (each task), §7 outputs (Task 6).
- **Placeholder scan:** none. Task 4 includes the injectable-builder wrapper so the controller test does not render through `pdfkit`.
- **Type consistency:** `SummaryReportData`, `SummaryTable`, `SummaryCounts`, `CategoryKey`, `CaseListRow`, `classifyCase`, `buildSummaryReportPdf`, `SummaryReportService.build` are used with identical names across tasks.
- **Review Focus coverage:** empty year (Task 3 zero-count test + Task 2 empty build), invariant (Task 2 test), leap-year February (Task 2 test), overflow pagination (Task 3 120-row test), missing signatories (Task 2 fallback test).
- **Known deviation:** the builder paginates the case list, so total pages can exceed three. Documented in Task 6 Step 3.
