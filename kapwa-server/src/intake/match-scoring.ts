// Candidate scoring for intake person matching.
//
// The match-check query returns raw pg_trgm similarities per household; the
// decision lives here so the rule is unit-testable and can never regress into
// "either name part matches" again.
//
// A candidate is a possible match only when BOTH parts of the name are
// plausible (a shared surname or a shared first name alone is not enough), or
// when a family member name already enrolled in the household corroborates a
// weaker name signal.

export interface MatchSignals {
  /** similarity(existing.surname, intake.surname) */
  simSurname: number;
  /** similarity(existing.first_name, intake.first_name) */
  simFirstName: number;
  /** Average best family-member name similarity for the household (0 when none). */
  familyScore: number;
}

export interface MatchAssessment {
  /** Ranking value: 0.6 * average name similarity + 0.4 * family score. */
  score: number;
  isMatch: boolean;
}

export const MATCH_RULES = {
  /** Both name parts must clear these per-field floors to stand on their own. */
  surnameFloor: 0.6,
  firstNameFloor: 0.5,
  /** A strong family-member signal may corroborate a weaker (but non-trivial) name part. */
  familyCorroboration: 0.8,
  familyNameFloor: 0.5,
} as const;

export function assessMatchCandidate({ simSurname, simFirstName, familyScore }: MatchSignals): MatchAssessment {
  const nameScore = (simSurname + simFirstName) / 2;
  const score = 0.6 * nameScore + 0.4 * familyScore;

  const bothNameParts =
    simSurname >= MATCH_RULES.surnameFloor && simFirstName >= MATCH_RULES.firstNameFloor;

  const familyBacked =
    familyScore >= MATCH_RULES.familyCorroboration &&
    Math.max(simSurname, simFirstName) >= MATCH_RULES.familyNameFloor;

  return { score, isMatch: bothNameParts || familyBacked };
}
