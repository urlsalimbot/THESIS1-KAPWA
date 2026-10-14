/**
 * The typed intervention catalog — the client half of
 * `docs/superpowers/specs/case-catalog.json` (mirrored here as literals
 * because the client's Docker build context is `kapwa-client/` and cannot
 * import the repo-root file). The server reads the same catalog from
 * `src/common/case-catalog.ts`; `case-fsm-parity.test.ts` ties all three
 * copies to the JSON.
 */
export const INTERVENTION_TYPES: readonly string[] = [
  'financial_grant', 'medical_assistance', 'burial_assistance', 'transport_assistance',
  'food_pack', 'educational_assistance', 'livelihood_seed', 'training_seminar',
  'crisis_counseling', 'psychosocial_support', 'parent_effectiveness', 'youth_engagement',
  'community_service', 'legal_assistance', 'medico_legal_assistance', 'referral_pao',
  'protection_order_issued', 'protective_custody', 'shelter_assistance', 'scsr_generated',
  'home_visit', 'health_checkup',
];
export const PROGRAM_TYPES: readonly string[] = [
  'aics', 'social_pension', 'supplemental_feeding', 'livelihood', 'family_welfare',
  'women_welfare', 'disability_aid', 'cct', 'child_welfare', 'medical', 'shelter',
  'diversion', 'aftercare', 'counseling', 'legal_referral', 'disaster_relief',
];

/** Service codes that carry money or in-kind value — the financial-form half. */
export const FINANCIAL_INTERVENTION_TYPES: readonly string[] = [
  'financial_grant', 'medical_assistance', 'burial_assistance', 'transport_assistance',
  'food_pack', 'educational_assistance', 'livelihood_seed', 'shelter_assistance',
];
export function isFinancialIntervention(code: string | null | undefined): boolean {
  return !!code && FINANCIAL_INTERVENTION_TYPES.includes(code);
}

/**
 * The intervention-type picker's groups, rendered as optgroup-style headers
 * (shadcn's SelectLabel — Radix Select has no native optgroup element).
 * Disjoint by construction: every INTERVENTION_TYPES code appears in exactly
 * one group, so a code added without a group fails the picker visibly.
 * The financial group reuses FINANCIAL_INTERVENTION_TYPES so the
 * "carries money" boundary the intervention forms depend on stays single-source.
 */
export const INTERVENTION_TYPE_GROUPS: ReadonlyArray<{
  key: string;
  fallback: string;
  codes: readonly string[];
}> = [
  { key: 'interventionGroups.financial', fallback: 'Financial & Material Assistance', codes: FINANCIAL_INTERVENTION_TYPES },
  { key: 'interventionGroups.psychosocial', fallback: 'Counseling & Psychosocial', codes: ['crisis_counseling', 'psychosocial_support'] },
  { key: 'interventionGroups.capacity', fallback: 'Capacity Building & Community', codes: ['training_seminar', 'parent_effectiveness', 'youth_engagement', 'community_service'] },
  { key: 'interventionGroups.legal', fallback: 'Legal & Protection', codes: ['legal_assistance', 'medico_legal_assistance', 'referral_pao', 'protection_order_issued', 'protective_custody'] },
  { key: 'interventionGroups.health', fallback: 'Health & Home Visits', codes: ['home_visit', 'health_checkup'] },
  { key: 'interventionGroups.documents', fallback: 'Case Management & Documents', codes: ['scsr_generated'] },
];

/**
 * The form-format vocabulary for per-intervention obligations: an
 * intervention configured with one of these keys must be accomplished using
 * that specific form. Unknown keys render as the raw key (`t` fallback).
 */
export const INTERVENTION_FORM_FORMATS: ReadonlyArray<{ key: string; fallback: string }> = [
  { key: 'social_case_study_report', fallback: 'Social Case Study Report (SCSR)' },
  { key: 'incident_report_form', fallback: 'Incident Report Form (IRF)' },
  { key: 'medical_certificate', fallback: 'Medical Certificate' },
  { key: 'death_certificate', fallback: 'Death Certificate' },
  { key: 'referral_form', fallback: 'Referral Form' },
];
export function interventionFormLabel(key: string, t?: (k: string, fb: string) => string): string {
  const known = INTERVENTION_FORM_FORMATS.find((f) => f.key === key);
  if (known) return t ? t(`interventionForms.${key}`, known.fallback) : known.fallback;
  return key;
}

/**
 * Courts a Norzagaray MSWD worker attends, for the hearing-venue picker.
 *
 * The names and addresses are proper nouns, so they are data, not copy: only
 * the group headings are translated (like program and agency names, which also
 * live untranslated). Nothing outside this list is lost — the hearing form
 * keeps its Notes field for anything else.
 *
 * Sources: Supreme Court court directory (sc.judiciary.gov.ph) and the OCA
 * "Updated Territorial Jurisdiction as of November 27, 2024", which reassigned
 * MTC Norzagaray from the San Jose del Monte RTC to the Malolos City RTC.
 */
export const COURT_GROUPS: ReadonlyArray<{
  key: string;
  fallback: string;
  courts: ReadonlyArray<{ name: string; detail: string }>;
}> = [
  {
    key: 'caseView.hearings.courtGroup.local',
    fallback: 'Norzagaray',
    courts: [
      { name: 'MTC Norzagaray', detail: 'Municipal Compound (back of the Municipal Hall), Poblacion, Norzagaray' },
    ],
  },
  {
    key: 'caseView.hearings.courtGroup.nearby',
    fallback: 'Nearby municipal trial courts',
    courts: [
      { name: 'MTC Angat', detail: 'Angat, Bulacan' },
      { name: 'MTC Bustos', detail: 'Bustos, Bulacan' },
      { name: 'MTC Doña Remedios Trinidad', detail: 'Doña Remedios Trinidad, Bulacan' },
      { name: 'MTC Pandi', detail: 'Pandi, Bulacan' },
      { name: 'MTC Sta. Maria', detail: 'M. De Leon St., Poblacion, Sta. Maria, Bulacan' },
      { name: 'MTCC Malolos City', detail: 'Malolos City, Bulacan' },
      { name: 'MTCC San Jose del Monte City', detail: 'San Jose del Monte City, Bulacan' },
    ],
  },
  {
    key: 'caseView.hearings.courtGroup.rtc',
    fallback: 'Regional trial courts',
    courts: [
      { name: 'RTC Malolos City', detail: 'Malolos City, Bulacan (the station for this municipality)' },
      { name: 'RTC San Jose del Monte City', detail: 'San Jose del Monte City, Bulacan' },
    ],
  },
  {
    key: 'caseView.hearings.courtGroup.family',
    fallback: 'Family courts',
    courts: [
      { name: 'Family Court, Branch 4-FC', detail: 'Malolos City, Bulacan' },
      { name: 'Family Court, Branch 5-FC', detail: 'San Jose del Monte City, Bulacan' },
      { name: 'Family Court, Branch 6', detail: 'Gov. Fortunato Halili Ave., Sta. Maria, Bulacan' },
    ],
  },
];

/** Typed programs applicable per statutory case category (catalog Appendix B). */
export const PROGRAM_TYPES_BY_CASE_CATEGORY: Record<string, readonly string[]> = {
  'Children in Conflict with the Law (CICL)': [
    'diversion', 'aftercare', 'counseling', 'family_welfare', 'child_welfare', 'medical', 'legal_referral', 'aics',
  ],
  'Violence Against Women and Their Children (VAWC)': [
    'women_welfare', 'shelter', 'counseling', 'legal_referral', 'medical', 'aics',
  ],
  'Children in Need of Special Protection (CNSP)': [
    'child_welfare', 'counseling', 'shelter', 'legal_referral', 'medical', 'family_welfare', 'aics', 'aftercare', 'disability_aid',
  ],
  'Indigency / Court-Ordered Social Case Study': [
    'aics', 'medical', 'shelter', 'disaster_relief', 'supplemental_feeding',
    'social_pension', 'livelihood', 'counseling', 'legal_referral', 'aftercare', 'disability_aid',
  ],
  'Solo Parent': [
    'family_welfare', 'aics', 'counseling', 'legal_referral', 'livelihood', 'cct', 'medical', 'disability_aid',
  ],
  'Adoption & Foster Care Case': [
    'child_welfare', 'family_welfare', 'counseling', 'legal_referral', 'medical', 'disability_aid', 'aics',
  ],
};
export function programTypeAllowedForCaseCategory(
  programType: string | null | undefined,
  caseCategory: string | null | undefined,
): boolean {
  if (!caseCategory) return true;
  const allowed = PROGRAM_TYPES_BY_CASE_CATEGORY[caseCategory];
  if (!allowed) return true;
  if (!programType) return true;
  return allowed.includes(programType);
}

/**
 * The case lifecycle vocabulary, in FSM order (mirrors the server's CASE_FSM).
 * One list behind every status filter — the cases table and the tracker used
 * private maps that had already drifted (no `aftercare`, no `closed`), so an
 * aftercare case rendered but could not be filtered to (audit 3.3.9).
 */
export const CASE_STATUSES = ['enrolled', 'assessed', 'in_review', 'active', 'transitioning', 'closed', 'aftercare'] as const;

export const BARANGAYS = [
  'Bangkal', 'Baraka', 'Bigte', 'Bitungol', 'Friendship Village Resources (FVR)',
  'Matictic', 'Minuyan', 'Partida', 'Pinagtulayan', 'Poblacion',
  'San Lorenzo', 'San Mateo', 'Tigbe',
] as const;
export const AGE_RANGES = ['0-7', '8-17', '18-59', '60+'] as const;
export const CLIENT_CATEGORIES = ['Children', 'Youth', 'Women', 'PWD', 'Senior', 'Indigent', '4Ps', 'IP', 'Family'] as const;

export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'] as const;

export const CLIENT_CATEGORIES_V2 = [
  'Children in Need of Special Protection',
  'Youth in Need of Special Protection',
  'Women in Especially Difficult Circumstances',
  'Person with Disability',
  'Senior Citizen',
  'Indigent',
  '4Ps',
  'Indigenous Person',
  'Family Head and Other Needy Adult',
] as const;

/**
 * The MSWDO case categories, grouped as the MSWDO operation manual groups
 * them. The stored value on `cases.case_category` is the item label itself, so
 * it renders as-is in the Case Category column; the groups are only the
 * `<optgroup>` structure of the step-1 select.
 */
export interface CaseCategoryGroup {
  /** i18n key for the group's optgroup label. */
  key: string;
  /** English optgroup label. */
  fallback: string;
  /** The stored subtype values, in display order. */
  items: string[];
}

export const CASE_CATEGORY_GROUPS: CaseCategoryGroup[] = [
  {
    key: 'caseView.assessment.caseCategoryGroup.childProtection',
    fallback: 'Child Protection & Youth Welfare',
    items: [
      'Children in Conflict with the Law (CICL)',
      'Children at Risk (CAR)',
      'Children in Need of Special Protection (CNSP)',
      'Abandoned or Neglected Child',
      'Adoption & Foster Care Case',
    ],
  },
  {
    key: 'caseView.assessment.caseCategoryGroup.womensWelfare',
    fallback: "Women's Welfare & Gender-Based Violence",
    items: [
      'Violence Against Women and Their Children (VAWC)',
      'Women in Especially Difficult Circumstances (WEDC)',
      'Unwed or Disadvantaged Pregnant Woman',
    ],
  },
  {
    key: 'caseView.assessment.caseCategoryGroup.familyCrisis',
    fallback: 'Family Crisis & Economic Indigency',
    items: [
      'Individual in Crisis Situation (AICS)',
      'Solo Parent',
      'Indigency / Court-Ordered Social Case Study',
      'Marital Discord / Family Intervention',
    ],
  },
  {
    key: 'caseView.assessment.caseCategoryGroup.sectorSpecific',
    fallback: 'Sector-Specific Welfare & Development',
    items: [
      'Elderly / Senior Citizen Welfare',
      'Person with Disability (PWD)',
      'Person Who Used Drugs (PWUD) — Aftercare',
    ],
  },
  {
    key: 'caseView.assessment.caseCategoryGroup.disaster',
    fallback: 'Disaster-Induced & Displacement',
    items: [
      'Internally Displaced / Calamity Victim',
      'Emergency Shelter Assistance (ESA)',
    ],
  },
];

export const FINANCIAL_SUBSIDIES = [
  'Food Subsidy', 'Livelihood', 'Education', 'Medical',
  'Guarantee Letter', 'Burial', 'Transportation',
] as const;

export const SOURCE_OF_FUND = [
  'Regular Funds', 'Donation', 'Priority Development Assistance Fund', 'Others',
] as const;

export const OTHER_ASSISTANCE = [
  'Food Pack', 'Used Clothing', 'Hot Meal', 'Assistive Devices', 'Other',
] as const;

export const FAMILY_MEMBER_STATUSES = ['Employed', 'Self-Employed', 'Unemployed', 'Student', 'Retired', 'Dependent', 'OFW'] as const;

export const NAME_EXTENSIONS = ['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV'] as const;

/**
 * The categories `POST /access-cards/log` accepts, mirroring the server's
 * `ACCESS_CARD_CATEGORIES`. `payout` and `compliance` cover recurring-program
 * events (4Ps disbursements and conditionality check-offs), which the 4Ps module
 * also writes to the same table.
 *
 * Every service-logging dropdown renders from this list, so a form cannot offer a
 * value the endpoint would reject. Do not add a value here without adding it to
 * the server's list first — the form and the endpoint have to agree.
 */
export const ACCESS_CARD_CATEGORIES = [
  'case_service',
  'referral',
  'community_service',
  'seminar',
  'payout',
  'compliance',
] as const;

export type AccessCardCategory = (typeof ACCESS_CARD_CATEGORIES)[number];

/**
 * The filter tabs on a resident's card: the empty string means "All" and
 * selects every row, otherwise the tab matches `service.category` by exact
 * string equality.
 *
 * Derived from ACCESS_CARD_CATEGORIES rather than listed by hand, because the
 * two lists had already drifted once (this was a fourth copy of the
 * vocabulary). A category with no tab is writable but invisible — the row
 * inserts cleanly, then matches nothing but "All", which is exactly how the
 * 4Ps module's `4ps_compliance` rows went unnoticed. Deriving makes that
 * unrepresentable rather than merely unlikely.
 */
export const ACCESS_CARD_CATEGORY_TABS: readonly (AccessCardCategory | '')[] = [
  '',
  ...ACCESS_CARD_CATEGORIES,
];

