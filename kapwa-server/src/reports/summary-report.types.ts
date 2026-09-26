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
