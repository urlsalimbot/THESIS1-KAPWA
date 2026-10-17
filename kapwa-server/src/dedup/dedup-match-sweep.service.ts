import { personSignals, dedupScore, PersonSignals, PersonLike } from './dedup-matcher.service';

/**
 * Candidate generation for one import (spec §4):
 *   1. intra-import sweep — rows vs earlier rows in the same file; a duplicate
 *      is resolved before anything else is asked about it
 *   2. db sweep — the surviving rows vs every similar person in the database
 *   3. household sweep — strong member matches become household candidates
 *      carrying `householdServed` (any member already received an intervention)
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

  // --- 1. Intra-import sweep FIRST. A row that duplicates an earlier row of
  // the same file is not a client yet — the earlier row carries the identity.
  // Deciding which of the two survives comes before asking whether it exists in
  // KAPWA: otherwise the duplicate gathers DB candidates of its own, shows up
  // in phase 2, and can be decided twice (once as a pair, once against the
  // database) — which is how a duplicate pair ended up as two records.
  const intraByRow = new Map<string, MatchCandidate[]>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const intra: MatchCandidate[] = [];
    for (let j = 0; j < i; j++) {
      const earlier = rows[j];
      const s = personSignals(r, earlier, sim);
      const score = dedupScore(s, false);
      if (score >= threshold) {
        intra.push({ rowId: r.id, targetType: 'import_row', targetImportRowId: earlier.id, score, signals: s });
      }
    }
    intraByRow.set(r.id, intra);
  }

  for (const r of rows) {
    const rowCands: MatchCandidate[] = [...(intraByRow.get(r.id) ?? [])];

    // --- 2. DB sweep + household sweep: valid rows only ---
    if (rowCands.length === 0) {
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

      // Household sweep over the matched members.
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
    }

    rowCands.sort((a, b) => b.score - a.score);
    candidates.push(...rowCands.slice(0, 3));
    rowStatus[r.id] = rowCands.length > 0 ? 'pending' : 'no_match';
  }

  return { candidates, rowStatus };
}
