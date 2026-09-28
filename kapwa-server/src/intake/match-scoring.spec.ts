import { assessMatchCandidate, MatchSignals } from './match-scoring';

// Similarity values are the pg_trgm scores the match-check SQL now returns per
// household (see the matchCheck query). Cases mirror the live values probed in
// development, e.g. similarity('Santos','Santos') = 1, similarity('Josh','Lorna') = 0.
function signals(simSurname: number, simFirstName: number, familyScore = 0): MatchSignals {
  return { simSurname, simFirstName, familyScore };
}

describe('assessMatchCandidate', () => {
  it('rejects a household that only shares the surname (Josh Santos vs Lorna Santos)', () => {
    expect(assessMatchCandidate(signals(1, 0))).toMatchObject({ isMatch: false });
    expect(assessMatchCandidate(signals(1, 0)).score).toBeLessThan(0.6);
  });

  it('rejects a household that only shares the first name (Josh Santos vs Josh Reyes)', () => {
    expect(assessMatchCandidate(signals(0, 1))).toMatchObject({ isMatch: false });
  });

  it('keeps a genuine duplicate (identical names)', () => {
    expect(assessMatchCandidate(signals(1, 1))).toMatchObject({ isMatch: true });
    expect(assessMatchCandidate(signals(1, 1)).score).toBeCloseTo(0.6, 5);
  });

  it('keeps a near first name that still clears the per-field floor (Josh vs Joshua)', () => {
    expect(assessMatchCandidate(signals(1, 0.5))).toMatchObject({ isMatch: true });
  });

  it('keeps a household corroborated by a matching family member even when one name part is weak', () => {
    expect(assessMatchCandidate(signals(0.7, 0.2, 1))).toMatchObject({ isMatch: true });
  });

  it('does not let a weak family score rescue a single-name-part match', () => {
    expect(assessMatchCandidate(signals(1, 0, 0.79))).toMatchObject({ isMatch: false });
    expect(assessMatchCandidate(signals(0.4, 0.2, 1))).toMatchObject({ isMatch: false });
  });

  it('ranks by 0.6 * average name similarity + 0.4 * family score', () => {
    expect(assessMatchCandidate(signals(1, 1, 1)).score).toBeCloseTo(1, 5);
    expect(assessMatchCandidate(signals(1, 0.5, 0)).score).toBeCloseTo(0.45, 5);
    expect(assessMatchCandidate(signals(0.7, 0.2, 1)).score).toBeCloseTo(0.67, 5);
  });
});
