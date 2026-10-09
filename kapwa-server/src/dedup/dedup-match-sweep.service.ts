import { personSignals, dedupScore, PersonSignals, PersonLike } from './dedup-matcher.service';

/**
 * Three-sweep candidate generation for one import (spec §4):
 *   1. db sweep — rows vs every similar person in the database
 *   2. household sweep — strong member matches become household candidates
 *      carrying `householdServed` (any member already received an intervention)
 *   3. intra-import sweep — each row vs rows already scanned in the same file
 *
 * Frequency weights are derived per row from the observed attribute values in
 * its own candidate set (db search results + the import), so rarity weighting
 * needs no extra query.
 */

export interface RowInput extends PersonLike {
  id: string;
  rowIndex: number;
}

export interface PersonRecord extends PersonLike {
  id: string;
  householdId?: string | null;
}

export interface PersonRepo {
  searchSimilar(input: { lastName: string; firstName: string }): Promise<PersonRecord[]>;
}

export interface HouseholdRepo {
  byMemberPersonIds(personIds: string[]): Promise<Array<{ id: string; memberPersonIds: string[] }>>;
}

export interface InterventionRepo {
  countsByPerson(personIds: string[]): Promise<Record<string, number>>;
}

export interface MatchCandidate {
  rowId: string;
  targetType: 'db_person' | 'import_row' | 'household';
  targetPersonId?: string;
  targetImportRowId?: string;
  targetHouseholdId?: string;
  memberPersonIds?: string[];
  score: number;
  signals: PersonSignals & { householdServed?: boolean };
}

export interface SweepInput {
  rows: RowInput[];
  threshold: number;
  sim: (x: string, y: string) => number;
  persons: PersonRepo;
  households: HouseholdRepo;
  interventions: InterventionRepo;
}

export interface SweepOutput {
  candidates: MatchCandidate[];
  rowStatus: Record<string, 'pending' | 'no_match'>;
}

const norm = (s?: string | null): string => (s ?? '').trim().toLowerCase();

type NameField = 'lastName' | 'firstName' | 'middleName' | 'dob' | 'barangay';

function countsFor(r: RowInput, db: PersonRecord[], rows: RowInput[]) {
  // Occurrences across the candidate set — the pair itself contributes one, so
  // a value appearing nowhere else counts 0 and gets full rarity weight.
  const count = (field: NameField, value: string, excludePersonId: string | undefined, excludeRowIds: Set<string>): number => {
    let n = 1; // the row itself
    for (const p of db) if (p.id !== excludePersonId && norm(p[field] as string | null | undefined) === value) n++;
    // Exclude the row itself AND the paired candidate from the occurrence
    // count, so a pair with no other competitors gets full rarity weight.
    for (const o of rows) if (!excludeRowIds.has(o.id) && norm(o[field] as string | null | undefined) === value) n++;
    return n;
  };
  const weightsFor = (excludePersonId: string | undefined, excludeRowIds: Set<string>) => ({
    surname: Math.max(0, count('lastName', norm(r.lastName), excludePersonId, excludeRowIds) - 1),
    firstName: Math.max(0, count('firstName', norm(r.firstName), excludePersonId, excludeRowIds) - 1),
    middleName: r.middleName ? Math.max(0, count('middleName', norm(r.middleName), excludePersonId, excludeRowIds) - 1) : 1,
    dob: r.dob ? Math.max(0, count('dob', r.dob, excludePersonId, excludeRowIds) - 1) : 1,
    barangay: r.barangay ? Math.max(0, count('barangay', norm(r.barangay), excludePersonId, excludeRowIds) - 1) : 1,
  });
  return { weightsFor };
}

export async function sweep(input: SweepInput): Promise<SweepOutput> {
  const { rows, threshold, sim, persons, households, interventions } = input;
  const candidates: MatchCandidate[] = [];
  const rowStatus: Record<string, 'pending' | 'no_match'> = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowCands: MatchCandidate[] = [];

    // --- 1. DB sweep ---
    const db = await persons.searchSimilar({ lastName: r.lastName, firstName: r.firstName });
    const weightsBase = countsFor(r, db, rows); const weightsFor = weightsBase.weightsFor;
    const personCandById = new Map<string, { signals: PersonSignals; score: number }>();
    for (const p of db) {
      const s = personSignals(r, p, sim);
      const score = dedupScore(s, weightsFor(p.id, new Set([r.id])), false);
      if (score >= threshold) {
        personCandById.set(p.id, { signals: s, score });
        rowCands.push({ rowId: r.id, targetType: 'db_person', targetPersonId: p.id, score, signals: s });
      }
    }

    // --- 2. Household sweep over the matched members ---
    const matchedPersonIds = [...personCandById.keys()];
    if (matchedPersonIds.length > 0) {
      const householdsFound = await households.byMemberPersonIds(matchedPersonIds);
      const interventionCounts = await interventions.countsByPerson(
        [...new Set(householdsFound.flatMap((h) => h.memberPersonIds))],
      );
      for (const hh of householdsFound) {
        const served = hh.memberPersonIds.some((mid) => (interventionCounts[mid] ?? 0) > 0);
        const best = hh.memberPersonIds
          .filter((mid) => personCandById.has(mid))
          .map((mid) => ({ id: mid, ...personCandById.get(mid)! }))
          .reduce<{ id: string; signals: PersonSignals; score: number } | null>((acc, cur) =>
            !acc || cur.score > acc.score ? cur : acc, null);
        if (!best) continue;
        // Rarity counts exclude the pair itself: the member and the row.
        const score = dedupScore(best.signals, weightsFor(best.id, new Set([r.id])), served);
        if (score >= threshold) {
          rowCands.push({
            rowId: r.id,
            targetType: 'household',
            targetHouseholdId: hh.id,
            memberPersonIds: hh.memberPersonIds,
            score,
            signals: { ...best.signals, householdServed: served },
          });
        }
      }
    }

    // --- 3. Intra-import sweep against earlier rows ---
    for (let j = 0; j < i; j++) {
      const earlier = rows[j];
      const s = personSignals(r, earlier, sim);
      const score = dedupScore(s, weightsFor(r.id, new Set([r.id, earlier.id])), false);
      if (score >= threshold) {
        rowCands.push({ rowId: r.id, targetType: 'import_row', targetImportRowId: earlier.id, score, signals: s });
      }
    }

    rowCands.sort((a, b) => b.score - a.score);
    candidates.push(...rowCands.slice(0, 3));
    rowStatus[r.id] = rowCands.length > 0 ? 'pending' : 'no_match';
  }

  return { candidates, rowStatus };
}