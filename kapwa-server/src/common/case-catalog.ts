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
];
export const PROGRAM_TYPES: readonly string[] = [
  'aics', 'social_pension', 'supplemental_feeding', 'livelihood', 'family_welfare',
  'women_welfare', 'disability_aid', 'cct', 'child_welfare', 'medical', 'shelter',
  'diversion', 'aftercare', 'counseling', 'legal_referral', 'disaster_relief',
];

/** The 22-code catalog as a zod enum literal tuple. */
export const INTERVENTION_TYPE_VALUES = INTERVENTION_TYPES as unknown as [
  string, ...string[],
];