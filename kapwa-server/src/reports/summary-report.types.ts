// Summary report types — PROGRAM-DRIVEN columns.
//
// The report's columns derive from the `programs` table (plus fixed SEX,
// UNASSIGNED and TOTAL columns). Each case counts once: its first
// program-linked intervention decides the column; referral-only cases map to
// the legal referral programs; CSR/visit-only cases map by name; everything
// else lands in UNASSIGNED. Bands mirror the reference GAD form.

export interface ReportColumn {
  key: string;      // program id, 'MALE', 'FEMALE', 'UNASSIGNED' or 'TOTAL'
  label: string;    // printable header (program name or fixed label)
  band: string;     // SEX | FINANCIAL | LEGAL | TECHNICAL | OTHER PROGRAMS | '' (TOTAL/UNASSIGNED)
  subBand?: string; // e.g. 'FINANCIAL ASSISTANCE' / 'REFERRAL'
}

export interface CaseClassificationInput {
  clientCategory?: string | null;
  serviceText: string;
  referralText: string;
  hasCsr: boolean;
  hasVisit: boolean;
  /** Program of the case's first intervention (id + resolved name). */
  programId?: string | null;
  programName?: string | null;
}

export interface ProgramResolution {
  programs: Array<{ id: string; name: string; category?: string | null }>;
}

/** Selected column + case-list remark code for one case. */
export interface CaseColumn {
  key: string;
  code: string;
}

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
  quarter: number;
  columns: ReportColumn[];
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

// ---------------------------------------------------------------------------
// Band mapping — program name/category → reference band
// ---------------------------------------------------------------------------

export function programBand(name: string, category?: string | null): { band: string; subBand?: string } {
  const n = name.toLowerCase();
  const c = (category ?? '').toLowerCase();

  if (/burial/.test(n)) return { band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' };
  if (/medical|philhealth/.test(n)) return { band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' };
  if (/assistive/.test(n)) return { band: 'FINANCIAL', subBand: 'FINANCIAL ASSISTANCE' };
  if (c.startsWith('pwd welfare') || /^pwd\b/.test(n)) return { band: 'FINANCIAL' };
  if (/legal|referral/.test(n)) return { band: 'LEGAL', subBand: 'REFERRAL' };
  if (/birth discrepancy|travel|case study|csr|home visit|child custody|balik probinsya|counsel|psychosocial/.test(n)) {
    return { band: 'TECHNICAL' };
  }
  return { band: 'OTHER PROGRAMS' };
}

/** Case-list remark code for a selected column. */
export function codeForProgram(name: string, band: string): string {
  const n = name.toLowerCase();
  if (/case study|\bcsr\b/.test(n)) return 'CSR';
  if (/home visit/.test(n)) return 'HV';
  if (band === 'FINANCIAL') return 'FA';
  if (band === 'LEGAL') return 'R';
  if (band === 'TECHNICAL') return 'H';
  if (band === 'OTHER PROGRAMS') return 'C';
  return '';
}

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Find a program column by normalized name (used by referral/CSR/visit fallbacks). */
export function findProgramColumn(
  programs: ProgramResolution['programs'],
  name: string,
): { id: string; name: string; category?: string | null } | undefined {
  const target = norm(name);
  return programs.find((p) => norm(p.name) === target);
}

/**
 * One column per case, precedence:
 *  1. first program-linked intervention,
 *  2. referral → Legal Referral (PAO) when legal, else Referral – Others,
 *  3. CSR report → Case Study Report (CSR),
 *  4. follow-up visit → Home Visit,
 *  5. UNASSIGNED.
 */
export function selectCaseColumn(
  input: CaseClassificationInput,
  programs: ProgramResolution['programs'],
): CaseColumn {
  // 1. Program-linked intervention (by id, else by resolved name).
  const progName = input.programName ?? '';
  if (input.programId || progName) {
    const linked =
      (input.programId ? programs.find((p) => p.id === input.programId) : undefined) ??
      (progName ? programs.find((p) => norm(p.name) === norm(progName)) : undefined);
    if (linked) {
      const band = programBand(linked.name, linked.category).band;
      return { key: linked.id, code: codeForProgram(linked.name, band) };
    }
    return { key: 'UNASSIGNED', code: '' };
  }

  // 2. Referral-only cases.
  if (input.referralText.trim().length > 0) {
    const isLegal = /legal|\bpao\b|public attorney/i.test(input.referralText);
    const ref = findProgramColumn(programs, isLegal ? 'Legal Referral (PAO)' : 'Referral – Others');
    if (ref) return { key: ref.id, code: 'R' };
    return { key: 'UNASSIGNED', code: 'R' };
  }

  // 3. CSR-only.
  if (input.hasCsr) {
    const csr = findProgramColumn(programs, 'Case Study Report (CSR)');
    if (csr) return { key: csr.id, code: 'CSR' };
    return { key: 'UNASSIGNED', code: 'CSR' };
  }

  // 4. Home-visit-only.
  if (input.hasVisit) {
    const hv = findProgramColumn(programs, 'Home Visit');
    if (hv) return { key: hv.id, code: 'HV' };
    return { key: 'UNASSIGNED', code: 'HV' };
  }

  // 5. Nothing recordable.
  return { key: 'UNASSIGNED', code: '' };
}

// Column ordering used by the builder: fixed SEX/TOTAL slots plus every program
// in list order, UNASSIGNED immediately before TOTAL.
export function buildColumns(programs: ProgramResolution['programs']): ReportColumn[] {
  const out: ReportColumn[] = [
    { key: 'MALE', label: 'MALE', band: 'SEX' },
    { key: 'FEMALE', label: 'FEMALE', band: 'SEX' },
  ];
  for (const p of programs) {
    const b = programBand(p.name, p.category);
    out.push({ key: p.id, label: p.name, band: b.band, subBand: b.subBand });
  }
  out.push({ key: 'UNASSIGNED', label: 'UNASSIGNED', band: '' });
  out.push({ key: 'TOTAL', label: 'TOTAL', band: '' });
  return out;
}

export const PLACEHOLDER_UNASSIGNED = 'UNASSIGNED';