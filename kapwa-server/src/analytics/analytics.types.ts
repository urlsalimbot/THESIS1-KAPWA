export const FEATURE_KEYS = [
  'household_income',
  'household_size',
  'children_0_5',
  'children_6_17',
  'adults_18_59',
  'seniors_60',
  'has_pwd',
  'has_solo_parent',
  'has_4ps',
  'case_count',
  'intervention_count',
  'total_assistance',
  'days_since_last_case',
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

export interface HouseholdFeatureRow {
  householdId: string;
  barangay: string | null;
  values: Record<FeatureKey, number | null>;
}
