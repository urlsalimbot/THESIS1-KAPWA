/**
 * Serving-eligibility rules for a client-import list (2026-10-09):
 *
 * 1. A client who never received an intervention (via batch or via case — both
 *    live in case_interventions now) is automatically ALLOWED, even when a
 *    person match exists.
 * 2. If the client's latest intervention was > 30 days ago they PASS; if it was
 *    within the last 30 days they are DISQUALIFIED (review decides).
 * 3. A household-matched client is disqualified when any OTHER member received
 *    an intervention within the last 30 days.
 * 4. When the same person — or the same household — applies more than once in
 *    ONE list, exactly one row (the earliest) gets through; the rest are
 *    disqualified.
 *
 * The engine is pure (dates + per-person intervention lists in, outcomes out)
 * so the rules are unit-testable without the database.
 */

export const ELIGIBILITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface EligibilityRowInput {
  rowIndex: number;
  /** Matched existing person (target of the best db_person candidate). */
  personId?: string;
  /** Household surfaced by a household candidate (members included). */
  householdId?: string;
  householdPersonIds?: string[];
  /** The EARLIER row this row is paired with inside the same list. */
  pairedRowIndex?: number;
}

export interface PersonIntervention {
  deliveryDate: string; // YYYY-MM-DD
  type?: string | null;
}

export interface EligibilityInput {
  /** Comparison instant for the 30-day window. */
  today: string; // YYYY-MM-DD
  rows: EligibilityRowInput[];
  interventionsByPerson: Record<string, PersonIntervention[]>;
}

export interface EligibilityOutcome {
  eligibility: 'allowed' | 'disqualified';
  reason: string;
}

const daysOld = (todayMs: number, deliveryDate: string): number =>
  todayMs - new Date(`${deliveryDate}T00:00:00Z`).getTime();

export function computeEligibility(input: EligibilityInput): Record<number, EligibilityOutcome> {
  const todayMs = new Date(`${input.today}T00:00:00Z`).getTime();
  const outcome: Record<number, EligibilityOutcome> = {};

  const recent = (personId: string): PersonIntervention | undefined => {
    const list = input.interventionsByPerson[personId] ?? [];
    return list.find((i) => daysOld(todayMs, i.deliveryDate) <= ELIGIBILITY_WINDOW_MS);
  };

  // Group rows that apply for the same person or the same household: the
  // earliest row in a group is the one that gets through.
  const order = (a: number, b: number): number => a - b;
  const personGroup = new Map<string, number>();
  const householdGroup = new Map<string, number>();
  // Intra-list pairs share the same identity ("duplicate, deprioritize"):
  // the later row anchors to whatever the earliest row of the chain anchored
  // to (its person, its household, or the chain's first row itself).
  const pairAnchor = (r: EligibilityRowInput): string | number | undefined => {
    let cur = r;
    const seen = new Set<number>();
    while (cur.pairedRowIndex !== undefined && !seen.has(cur.rowIndex)) {
      seen.add(cur.rowIndex);
      const earlier = input.rows.find((o) => o.rowIndex === cur.pairedRowIndex);
      if (!earlier) break;
      cur = earlier;
    }
    return cur.personId ?? cur.householdId ?? cur.pairedRowIndex ?? cur.rowIndex;
  };

  const sorted = [...input.rows].sort((a, b) => order(a.rowIndex, b.rowIndex));
  for (const r of sorted) {
    let reason = '';
    let disqualified = false;

    const ownRecent = r.personId ? recent(r.personId) : undefined;
    if (ownRecent) {
      disqualified = true;
      reason = `Received ${ownRecent.type ?? 'an intervention'} on ${ownRecent.deliveryDate} — within the last 30 days`;
    }

    if (!disqualified && r.householdId) {
      const memberRecent = (r.householdPersonIds ?? [])
        .filter((mid) => mid !== r.personId)
        .map((mid) => recent(mid))
        .find(Boolean);
      if (memberRecent) {
        disqualified = true;
        reason = `A household member received ${memberRecent.type ?? 'an intervention'} on ${memberRecent.deliveryDate} — within the last 30 days`;
      }
    }

    if (!disqualified) {
      let firstIdx: number | undefined;
      let groupKind: 'person' | 'household' | undefined;
      if (r.personId) {
        firstIdx = personGroup.get(r.personId);
        if (firstIdx !== undefined) groupKind = 'person';
      }
      if (firstIdx === undefined && r.householdId) {
        firstIdx = householdGroup.get(r.householdId);
        if (firstIdx !== undefined) groupKind = 'household';
      }
      // No DB identity: an intra-list duplicate pair still shares one — the
      // later row anchors to whatever the earlier row anchored to.
      if (firstIdx === undefined) {
        const anchor = pairAnchor(r);
        if (anchor !== undefined) {
          const key = String(anchor);
          firstIdx = personGroup.get(key) ?? householdGroup.get(key);
          groupKind = 'person';
        }
      }
      if (firstIdx !== undefined && firstIdx !== r.rowIndex) {
        disqualified = true;
        reason = `Row ${firstIdx} in this list is the same ${groupKind === 'household' ? 'household' : 'person'} — only one gets through`;
      } else {
        if (r.personId && !personGroup.has(r.personId)) personGroup.set(r.personId, r.rowIndex);
        if (r.householdId && !householdGroup.has(r.householdId)) householdGroup.set(r.householdId, r.rowIndex);
        const anchor = pairAnchor(r);
        const anchorKey = String(anchor !== undefined ? anchor : r.rowIndex);
        if (!personGroup.has(anchorKey)) personGroup.set(anchorKey, r.rowIndex);
        if (!householdGroup.has(anchorKey)) householdGroup.set(anchorKey, r.rowIndex);
      }
    }

    outcome[r.rowIndex] = disqualified
      ? { eligibility: 'disqualified', reason }
      : { eligibility: 'allowed', reason: '' };
  }
  return outcome;
}