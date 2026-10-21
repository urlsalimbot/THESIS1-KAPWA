/**
 * The intervention and program-type catalogs — the indexed vocabulary shared by
 * the server (zod schemas, seeds) and the client (intervention logging UIs).
 *
 * The canonical list lives in `docs/superpowers/specs/case-catalog.json` and is
 * mirrored here as literals — deliberately NOT read at module load, because the
 * Docker build context is `kapwa-server/` and the repo-root `docs/` directory
 * is not in the image (a runtime `readFileSync` of it crashes every container
 * boot with ENOENT). `case-catalog.spec.ts` ties this copy to the JSON, the
 * client mirrors it in `src/lib/constants.ts`, and the client's
 * `case-fsm-parity.test.ts` ties its copy to the same JSON — so a catalog
 * change lands in both surfaces or fails loudly.
 *
 * Sources (research-verified 2026-10-04): DSWD AO 10 s. 2007 intervention and
 * diversion program examples; Quezon MSWDO Operation Manual 2025 helping
 * strategies; see design spec Appendix B/C.
 */

export const INTERVENTION_TYPES: readonly string[] = [
  'financial_grant', 'medical_assistance', 'burial_assistance', 'transport_assistance',
  'food_pack', 'educational_assistance', 'livelihood_seed', 'training_seminar',
  'crisis_counseling', 'psychosocial_support', 'parent_effectiveness', 'youth_engagement',
  'community_service', 'legal_assistance', 'medico_legal_assistance', 'referral_pao',
  'protection_order_issued', 'protective_custody', 'shelter_assistance', 'scsr_generated',
  'home_visit', 'health_checkup',
  // DSWD assistance categories the GAD form prints separately.
  'assistive_device', 'pwd_assistance', 'birth_discrepancy', 'philhealth_assistance',
  'child_custody', 'balik_probinsya',
];
export const PROGRAM_TYPES: readonly string[] = [
  'aics', 'social_pension', 'supplemental_feeding', 'livelihood', 'family_welfare',
  'women_welfare', 'disability_aid', 'cct', 'child_welfare', 'medical', 'shelter',
  'diversion', 'aftercare', 'counseling', 'legal_referral', 'disaster_relief',
];

/**
 * The service codes that carry money or in-kind value: they need amount, mode
 * of delivery and fund source. Everything else is a rendered service — those
 * three fields do not apply and are neither shown nor persisted.
 */
export const FINANCIAL_INTERVENTION_TYPES: readonly string[] = [
  'financial_grant', 'medical_assistance', 'burial_assistance', 'transport_assistance',
  'food_pack', 'educational_assistance', 'livelihood_seed', 'shelter_assistance',
  'assistive_device', 'balik_probinsya',
];
export function isFinancialIntervention(code: string | null | undefined): boolean {
  return !!code && FINANCIAL_INTERVENTION_TYPES.includes(code);
}

/** The form formats an intervention row may oblige (mirrors the client's INTERVENTION_FORM_FORMATS). */
export const INTERVENTION_FORM_FORMATS = [
  'social_case_study_report',
  'incident_report_form',
  'medical_certificate',
  'death_certificate',
  'referral_form',
] as const;

/**
 * Which typed programs apply to which statutory case category (spec Appendix B:
 * a CICL case enrolls in diversion, a VAWC case in women's welfare — never a
 * CICL case in Social Pension). Restrictive only: a category without an entry
 * allows every program, and untyped/custom programs (no `program_type`) stay
 * offerable everywhere, since nothing classifies them.
 */
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

/** The 22-code catalog as a zod enum literal tuple. */
export const INTERVENTION_TYPE_VALUES = INTERVENTION_TYPES as unknown as [
  string, ...string[],
];