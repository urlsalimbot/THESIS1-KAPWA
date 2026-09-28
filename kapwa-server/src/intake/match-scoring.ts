// Candidate scoring for intake person matching.
//
// The match-check query returns raw pg_trgm similarities and cheap exact-PII
// flags per household; the decision lives here so the rule is unit-testable.
//
// Design (probabilistic record linkage in miniature): high-entropy identifiers
// (email, phone, PhilHealth number) may trigger a candidate on their own; weak,
// widely-shared attributes (DOB, barangay, phonetics) only corroborate a name
// signal. This keeps recall for clients recorded under a different spelling or
// nickname without flooding the review screen with false positives.

export interface MatchSignals {
  /** similarity(existing.surname, intake.surname) */
  simSurname: number;
  /** similarity(existing.first_name, intake.first_name) */
  simFirstName: number;
  /** Average best family-member name similarity for the household (0 when none). */
  familyScore: number;
  /** Exact DOB agreement. */
  dobMatch: boolean;
  /** Normalized phone agreement (digits-only, trailing 10). */
  phoneMatch: boolean;
  /** Case/whitespace-insensitive email agreement. */
  emailMatch: boolean;
  /** Digits-only PhilHealth number agreement. */
  philhealthMatch: boolean;
  /** Current-address barangay agreement. */
  barangayMatch: boolean;
  /** Soundex agreement on the surname (sound-alike spelling variants). */
  surnamePhoneticMatch: boolean;
}

export interface MatchAssessment {
  /** Ranking value in [0, 1]: 0.35 * name + 0.2 * family + 0.2 * unique PII + 0.15 * DOB + 0.10 * barangay. */
  score: number;
  isMatch: boolean;
  /** Tokens explaining why (see MATCH_REASON_TOKENS); client-localized. */
  matchedOn: string[];
}

export const MATCH_RULES = {
  /** Both name parts must clear these per-field floors to stand on their own. */
  surnameFloor: 0.6,
  firstNameFloor: 0.5,
  /** A strong family-member signal may corroborate a weaker (but non-trivial) name part. */
  familyCorroboration: 0.8,
  familyNameFloor: 0.5,
  /** An exact DOB corroborates any name part at or above this floor. */
  dobNameFloor: 0.5,
  /** A sound-alike surname corroborates a first name at or above this floor. */
  phoneticFirstNameFloor: 0.5,
} as const;

export const MATCH_REASON_TOKENS = {
  phone: 'phone',
  email: 'email',
  philhealth: 'philhealth',
  bothNames: 'both_names',
  dobName: 'dob_name',
  phoneticSurname: 'phonetic_surname',
  familyMember: 'family_member',
} as const;

export function assessMatchCandidate(s: MatchSignals): MatchAssessment {
  const nameAvg = (s.simSurname + s.simFirstName) / 2;
  const strongPii = s.phoneMatch || s.emailMatch || s.philhealthMatch;
  const score =
    0.35 * nameAvg +
    0.2 * s.familyScore +
    0.2 * (strongPii ? 1 : 0) +
    0.15 * (s.dobMatch ? 1 : 0) +
    0.10 * (s.barangayMatch ? 1 : 0);

  const matchedOn: string[] = [];
  const mark = (token: string) => { if (!matchedOn.includes(token)) matchedOn.push(token); };

  const uniquePii = strongPii;
  if (uniquePii) {
    if (s.phoneMatch) mark(MATCH_REASON_TOKENS.phone);
    if (s.emailMatch) mark(MATCH_REASON_TOKENS.email);
    if (s.philhealthMatch) mark(MATCH_REASON_TOKENS.philhealth);
  }

  const bothNameParts =
    s.simSurname >= MATCH_RULES.surnameFloor && s.simFirstName >= MATCH_RULES.firstNameFloor;
  if (bothNameParts) mark(MATCH_REASON_TOKENS.bothNames);

  const bestNamePart = Math.max(s.simSurname, s.simFirstName);
  const dobCorroborated = s.dobMatch && bestNamePart >= MATCH_RULES.dobNameFloor;
  if (dobCorroborated) mark(MATCH_REASON_TOKENS.dobName);

  const phoneticCorroborated =
    s.surnamePhoneticMatch && s.simFirstName >= MATCH_RULES.phoneticFirstNameFloor;
  if (phoneticCorroborated) mark(MATCH_REASON_TOKENS.phoneticSurname);

  const familyBacked =
    s.familyScore >= MATCH_RULES.familyCorroboration && bestNamePart >= MATCH_RULES.familyNameFloor;
  if (familyBacked) mark(MATCH_REASON_TOKENS.familyMember);

  return { score, isMatch: uniquePii || bothNameParts || dobCorroborated || phoneticCorroborated || familyBacked, matchedOn };
}

/**
 * Classic US Soundex (simplified, case-insensitive): the first letter plus
 * three consonant-code digits, vowels ignored, H/W not coded without reset.
 * Used only as a surname corroborator — agreement is broad, never a trigger.
 */
export function soundex(input: string | null | undefined): string {
  const clean = (input ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '';
  const codes: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };
  let out = clean[0];
  let prev = codes[clean[0]] ?? '';
  for (let i = 1; i < clean.length && out.length < 4; i++) {
    const ch = clean[i];
    if (ch === 'H' || ch === 'W') continue;
    const code = codes[ch] ?? '';
    if (code && code !== prev) out += code;
    prev = code || prev;
  }
  while (out.length < 4) out += '0';
  return out;
}