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

