import { MatchSignals, soundex } from '../intake/match-scoring';

/**
 * Person-level matcher for client deduplication (spec §4).
 *
 * Extends the intake's probabilistic matcher: the same signal families, plus
 * frequency-based attribute weighting — how rare an agreeing attribute is in
 * the database decides how strongly it moves the score. Rarity is measured as
 * `rarityWeight(count) = 1 / (1 + count)` per attribute VALUE observed in the
 * candidate set; the sweep computes the counts, the score consumes them.
 */

export interface PersonSignals extends MatchSignals {
  middleNameMatch: boolean;
  birthdayMatch: boolean;
}

export const DEDUP_THRESHOLD_DEFAULT = 0.75;

export interface PersonLike {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  dob?: string | null;
  barangay?: string | null;
  phone?: string | null;
  email?: string | null;
  philsys?: string | null;
}

const norm = (s?: string | null): string => (s ?? '').trim().toLowerCase();
const digits = (s?: string | null): string => {
  // Digits only, normalized to the trailing 10 (handles leading-zero and
  // +63 country-code forms of the same number).
  const d = (s ?? '').replace(/[^\d]/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/**
 * Baseline + declared-identifier signals between an import row and a person.
 * `sim` is injected (pg_trgm similarity in production) so the rules are
 * unit-testable without the database.
 */
export function personSignals(
  a: PersonLike,
  b: PersonLike,
  sim: (x: string, y: string) => number,
): PersonSignals {
  const normA = norm(a.lastName);
  const normB = norm(b.lastName);
  const normFirstA = norm(a.firstName);
  const normFirstB = norm(b.firstName);
  const phoneA = digits(a.phone);
  const phoneB = digits(b.phone);
  const emailA = norm(a.email);
  const emailB = norm(b.email);
  const philsysA = norm(a.philsys);
  const philsysB = norm(b.philsys);
  const barangayA = norm(a.barangay);
  const barangayB = norm(b.barangay);
  const middleA = norm(a.middleName);
  const middleB = norm(b.middleName);
  const dobA = norm(a.dob);
  const dobB = norm(b.dob);
  const dobMatch = !!dobA && !!dobB && dobA === dobB;
  const surnamePhoneticMatch =
    !!normA && !!normB && soundex(normA) !== '' && soundex(normA) === soundex(normB);

  return {
    simSurname: sim(normA, normB),
    simFirstName: sim(normFirstA, normFirstB),
    familyScore: 0,
    dobMatch,
    phoneMatch: phoneA !== '' && phoneA === phoneB,
    emailMatch: emailA !== '' && emailA === emailB,
    philsysMatch: philsysA !== '' && philsysA === philsysB,
    barangayMatch: barangayA !== '' && barangayA === barangayB,
    surnamePhoneticMatch,
    middleNameMatch: middleA !== '' && middleA === middleB,
    birthdayMatch: dobMatch,
  };
}

/**
 * Fellegi-Sunter-flavoured score in [0,1] with PLAIN weights — frequency does
 * not enter the score. Rarity-based attenuation was retired: it counted
 * occurrences across the whole import (hundreds of rows), so duplicate-heavy
 * lists ballooned the counts and even exact duplicates fell below threshold —
 * "person matching doesn't work, 400-row lists say no matches". Identity
 * agreement must be frequency-independent: a duplicate name is still a
 * duplicate. `householdServed` stays a corroborator (+0.10).
 */
export function dedupScore(s: PersonSignals, householdServed: boolean): number {
  const nameScore = (s.simSurname + s.simFirstName) / 2;
  // Baseline reality drives the weights: import rows usually declare no phone/
  // email/philsys and only sometimes a middle name, so name + dob + barangay
  // must be able to clear the default threshold on their own (0.5+0.25+0.1 =
  // 0.85); the optional signals stay meaningful but secondary.
  let score =
    0.5 * nameScore +
    0.25 * (s.dobMatch ? 1 : 0) +
    0.1 * (s.barangayMatch ? 1 : 0) +
    0.05 * (s.middleNameMatch ? 1 : 0) +
    0.1 * (s.phoneMatch || s.emailMatch || s.philsysMatch ? 1 : 0);
  if (householdServed) score += 0.1;
  return Math.min(1, Math.max(0, score));
}