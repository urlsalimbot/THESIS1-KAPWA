// The only case categories on which court hearings may be recorded. Mirrored
// in the client (StepCourtHearings visibility). Home visits know no gate.
export const LEGAL_CATEGORIES: ReadonlySet<string> = new Set([
  'Children in Conflict with the Law (CICL)',
  'Violence Against Women and Their Children (VAWC)',
  'Children in Need of Special Protection (CNSP)',
  'Adoption & Foster Care Case',
  'Indigency / Court-Ordered Social Case Study',
]);