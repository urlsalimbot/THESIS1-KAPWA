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

export async function sweep(input: SweepInput): Promise<SweepOutput> {
  const { rows, threshold, sim, persons, households, interventions } = input;
  const candidates: MatchCandidate[] = [];
  const rowStatus: Record<string, 'pending' | 'no_match'> = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowCands: MatchCandidate[] = [];

    // --- 1. DB sweep ---
    const db = await persons.searchSimilar({ lastName: r.lastName, firstName: r.firstName });
    const personCandById = new Map<string, { signals: PersonSignals; score: number }>();
    for (const p of db) {
      const s = personSignals(r, p, sim);
      const score = dedupScore(s, false);
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
        const score = dedupScore(best.signals, served);
        // A household candidate only surfaces when someone in the household has
        // serving evidence — that is its only review purpose (disqualification
        // signal). Without it, the card would parade unrelated co-residents
        // next to the person match.
        if (score >= threshold && served) {
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
      const score = dedupScore(s, false);
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