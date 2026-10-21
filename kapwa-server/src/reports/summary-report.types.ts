// Summary report types — FIXED reference column set (the actual GAD form).
//
// Columns are the 18 slots of the printed form. Case data is programme-backed:
// each case resolves to exactly one column (its programme's slot, else a
// fallback slot), so TOTAL = Male + Female = sum of the columns.

export interface ReportColumn {
  key: SpecColumnKey;
  label: string;
  band: string;
  subBand?: string;
}

export type SpecColumnKey =
  | 'MALE' | 'FEMALE'
  | 'BURIAL' | 'MEDICAL' | 'ASSISTIVE' | 'PWD'
  | 'LEGAL_PAO' | 'LEGAL_OTHERS'
  | 'BIRTH_DISCREPANCY' | 'TRAVEL' | 'CSR' | 'COUNSELLING' | 'PHILHEALTH'
  | 'CUSTODY' | 'HOME_VISIT' | 'BALIK' | 'TECH_OTHERS'
  | 'TOTAL';

/** The exact header of the printed form, top to bottom. */
export const SPEC_COLUMNS: ReportColumn[] = [
  { key: 'MALE', label: 'Male', band: 'SEX' },
  { key: 'FEMALE', label: 'Female', band: 'SEX' },
  { key: 'BURIAL', label: 'Burial', band: 'FINANCIAL', subBand: 'Financial Assistance' },
  { key: 'MEDICAL', label: 'Medical', band: 'FINANCIAL', subBand: 'Financial Assistance' },
  { key: 'ASSISTIVE', label: 'Assistive Devices', band: 'FINANCIAL', subBand: 'Financial Assistance' },
  { key: 'PWD', label: 'PWD', band: 'FINANCIAL' },
  { key: 'LEGAL_PAO', label: 'LEGAL/PAO', band: 'LEGAL', subBand: 'Referral' },
  { key: 'LEGAL_OTHERS', label: 'OTHERS', band: 'LEGAL', subBand: 'Referral' },
  { key: 'BIRTH_DISCREPANCY', label: 'Birth Discrepancy', band: 'TECHNICAL' },
  { key: 'TRAVEL', label: 'Travel Assessment', band: 'TECHNICAL' },
  { key: 'CSR', label: 'Case Study Report', band: 'TECHNICAL' },
  { key: 'COUNSELLING', label: 'Counselling', band: 'TECHNICAL' },
  { key: 'PHILHEALTH', label: 'PhilHealth', band: 'TECHNICAL' },
  { key: 'CUSTODY', label: 'Child Custody', band: 'TECHNICAL' },
  { key: 'HOME_VISIT', label: 'Home Visit', band: 'TECHNICAL' },
  { key: 'BALIK', label: 'Balik Probinsya', band: 'TECHNICAL' },
  { key: 'TECH_OTHERS', label: 'Others', band: 'TECHNICAL' },
  { key: 'TOTAL', label: 'TOTAL', band: '' },
];

/** Tier-1 band captions exactly as printed. */
export const BAND_LABELS: Record<string, string> = {
  SEX: 'SEX',
  FINANCIAL: 'Financial',
  LEGAL: 'Legal',
  TECHNICAL: 'Technical',
};

/** Band captions appear in this order. */
export const BAND_ORDER: string[] = ['SEX', 'FINANCIAL', 'LEGAL', 'TECHNICAL'];

export function buildColumns(): ReportColumn[] {
  return SPEC_COLUMNS.map((c) => ({ ...c }));
}

/**
 * Programme → printed column slot. Programmes outside the form's columns
 * (Education, 4Ps, Food, Livelihood, …) fold into the technical OTHERS slot.
 */
export function programColumnKey(name: string | null | undefined): SpecColumnKey {
  const n = (name ?? '').toLowerCase();
  if (/burial/.test(n)) return 'BURIAL';
  if (/assistive/.test(n)) return 'ASSISTIVE';
  if (/medical/.test(n)) return 'MEDICAL';
  if (/^pwd\b/.test(n) || /pwd assistance/.test(n) || /persons with disabilities/.test(n)) return 'PWD';
  if (/legal|\bpao\b/.test(n)) return 'LEGAL_PAO';
  if (/referral|linkage/.test(n)) return 'LEGAL_OTHERS';
  if (/birth discrepancy/.test(n)) return 'BIRTH_DISCREPANCY';
  if (/travel/.test(n)) return 'TRAVEL';
  if (/case study|\bcsr\b/.test(n)) return 'CSR';
  if (/counsel|psychosocial/.test(n)) return 'COUNSELLING';
  if (/philhealth/.test(n)) return 'PHILHEALTH';
  if (/child custody/.test(n)) return 'CUSTODY';
  if (/home visit/.test(n)) return 'HOME_VISIT';
  if (/balik probinsya/.test(n)) return 'BALIK';
  return 'TECH_OTHERS';
}

/** Case-list remark code derived from the resolved column. */
export function codeForColumn(key: SpecColumnKey): string {
  switch (key) {
    case 'BURIAL': case 'MEDICAL': case 'ASSISTIVE': case 'PWD': return 'FA';
    case 'CSR': return 'CSR';
    case 'HOME_VISIT': return 'HV';
    case 'LEGAL_PAO': case 'LEGAL_OTHERS': return 'R';
    case 'TECH_OTHERS': return 'C';
    case 'TOTAL': case 'MALE': case 'FEMALE': return '';
    default: return 'H';
  }
}

/**
 * Printed GAD column for a typed service. This is the primary signal: the
 * assistance type the worker records is what the form counts, not the name of
 * the programme it sits under. Services that are not a printed channel
 * (financial_grant, food_pack, livelihood_seed, …) return null.
 */
export function serviceColumnKey(type: string | null | undefined): SpecColumnKey | null {
  switch (type) {
    case 'burial_assistance': return 'BURIAL';
    case 'medical_assistance': return 'MEDICAL';
    case 'assistive_device': return 'ASSISTIVE';
    case 'pwd_assistance': return 'PWD';
    case 'birth_discrepancy': return 'BIRTH_DISCREPANCY';
    case 'philhealth_assistance': return 'PHILHEALTH';
    case 'child_custody': return 'CUSTODY';
    case 'referral_pao': return 'LEGAL_PAO';
    case 'legal_assistance': case 'medico_legal_assistance': return 'LEGAL_OTHERS';
    case 'balik_probinsya': return 'BALIK';
    case 'transport_assistance': return 'TRAVEL';
    case 'scsr_generated': return 'CSR';
    case 'crisis_counseling': case 'psychosocial_support': return 'COUNSELLING';
    case 'home_visit': return 'HOME_VISIT';
    default: return null;
  }
}

/** Precedence when one case carries several typed services (printed form order). */
export const SERVICE_COLUMN_PRIORITY: SpecColumnKey[] = [
  'BURIAL', 'MEDICAL', 'ASSISTIVE', 'PWD', 'BIRTH_DISCREPANCY', 'PHILHEALTH', 'CUSTODY',
  'LEGAL_PAO', 'LEGAL_OTHERS', 'BALIK', 'TRAVEL', 'CSR', 'COUNSELLING', 'HOME_VISIT',
];

export function columnFromServiceTypes(types: readonly string[] | null | undefined): SpecColumnKey | null {
  if (!types || types.length === 0) return null;
  const mapped = types.map(serviceColumnKey).filter((k): k is SpecColumnKey => k !== null);
  if (mapped.length === 0) return null;
  return SERVICE_COLUMN_PRIORITY.find((k) => mapped.includes(k)) ?? null;
}

/**
 * Legacy/untyped interventions: the service name still names the assistance
 * (the pre-cleanup rows carry no type that maps to a printed channel).
 */
export function serviceTextColumnKey(text: string): SpecColumnKey | null {
  const n = (text || '').toLowerCase();
  if (/funeral|burial/.test(n)) return 'BURIAL';
  if (/assistive|prosthe|wheelchair|hearing aid/.test(n)) return 'ASSISTIVE';
  if (/birth discrepancy|birth certificate correction/.test(n)) return 'BIRTH_DISCREPANCY';
  if (/philhealth/.test(n)) return 'PHILHEALTH';
  if (/custody/.test(n)) return 'CUSTODY';
  if (/balik probinsya/.test(n)) return 'BALIK';
  if (/medical|hospital|medicine|check.?up|health/.test(n)) return 'MEDICAL';
  if (/travel|transport/.test(n)) return 'TRAVEL';
  if (/counsel|psychosocial/.test(n)) return 'COUNSELLING';
  if (/home visit|follow.?up visit/.test(n)) return 'HOME_VISIT';
  if (/case study|\bcsr\b/.test(n)) return 'CSR';
  if (/legal|\bpao\b|attorney/.test(n)) return 'LEGAL_PAO';
  return null;
}

export interface CaseClassificationInput {
  clientCategory?: string | null;
  serviceText: string;
  referralText: string;
  hasCsr: boolean;
  hasVisit: boolean;
  programId?: string | null;
  programName?: string | null;
  /** Recorded intervention types for the case (the primary GAD signal). */
  serviceTypes?: string[];
}

export interface ProgramResolution {
  programs: Array<{ id: string; name: string; category?: string | null }>;
}

export interface CaseColumn {
  key: SpecColumnKey;
  code: string;
}

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tokenize(s: string): Set<string> {
  return new Set((s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
}

/** "Most relevant column": closest programme by shared significant tokens. */
export function mostRelevantProgram(
  text: string,
  programs: ProgramResolution['programs'],
): { id: string; name: string; category?: string | null } | undefined {
  const words = tokenize(text);
  if (words.size === 0) return undefined;
  let best: { id: string; name: string; category?: string | null } | undefined;
  let bestScore = 0;
  for (const p of programs) {
    const tokens = tokenize(p.name);
    let shared = 0;
    for (const w of words) if (tokens.has(w)) shared += 1;
    if (shared === 0) continue;
    const score = shared / tokens.size;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/**
 * One printed column per case. The recorded service type is the primary signal
 * (DSWD assistance categories are services, not programmes); the genuine
 * programme is the fallback for slots that are programme-shaped (PWD, Balik
 * Probinsya); then referral, CSR/visit and legacy free text.
 */
export function selectCaseColumn(
  input: CaseClassificationInput,
  programs: ProgramResolution['programs'],
): CaseColumn {
  // 1. Typed services first.
  const typed = columnFromServiceTypes(input.serviceTypes);
  if (typed) return { key: typed, code: codeForColumn(typed) };

  // 2. Programme-linked case (a genuine programme that owns a printed slot).
  const progName = input.programName ?? '';
  if (input.programId || progName) {
    const linked =
      (input.programId ? programs.find((p) => p.id === input.programId) : undefined) ??
      (progName ? programs.find((p) => norm(p.name) === norm(progName)) : undefined);
    const key = programColumnKey(linked?.name ?? progName);
    return { key, code: codeForColumn(key) };
  }

  // 2. Referral-only cases: legal → LEGAL/PAO; otherwise the most relevant
  //    programme, else the referral OTHERS column.
  if (input.referralText.trim().length > 0) {
    if (/legal|\bpao\b|public attorney/i.test(input.referralText)) {
      return { key: 'LEGAL_PAO', code: 'R' };
    }
    const rel = mostRelevantProgram(input.referralText, programs);
    if (rel) {
      const key = programColumnKey(rel.name);
      return { key, code: 'R' };
    }
    return { key: 'LEGAL_OTHERS', code: 'R' };
  }

  // 3. CSR-only.
  if (input.hasCsr) return { key: 'CSR', code: 'CSR' };

  // 4. Home-visit-only.
  if (input.hasVisit) return { key: 'HOME_VISIT', code: 'HV' };

  // 5. Ad-hoc service text. The text names the assistance directly; fall back
  //    to token-matching a genuine programme only when it does not.
  if (input.serviceText.trim().length > 0) {
    const byText = serviceTextColumnKey(input.serviceText);
    if (byText) return { key: byText, code: codeForColumn(byText) };
    const match = mostRelevantProgram(input.serviceText, programs);
    if (match) {
      const key = programColumnKey(match.name);
      return { key, code: codeForColumn(key) };
    }
  }

  // 6. Nothing matches the form → technical OTHERS.
  return { key: 'TECH_OTHERS', code: 'C' };
}

// ---------------------------------------------------------------------------
// Value shapes
// ---------------------------------------------------------------------------

export interface SummaryCounts {
  male: number;
  female: number;
  total: number;
  byColumn: Record<string, number>;
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
  /** 1 = Q1+Q2 (Jan–Jun), 2 = Q3+Q4 (Jul–Dec). */
  semester: number;
  columns: ReportColumn[];
  annual: SummaryTable;
  monthly: SummaryTable[];
  semesterSummary: SummaryTable;
  caseList: CaseListRow[];
  officeName: string;
  preparedBy: string;
  preparedByRole: string;
  notedBy: string;
  notedByRole: string;
}