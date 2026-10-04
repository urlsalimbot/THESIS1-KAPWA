import { assessMatchCandidate, MatchSignals, soundex } from './match-scoring';

// Similarity values are the pg_trgm scores the match-check SQL returns per
// household (see the matchCheck query). Cases mirror live values probed in
// development, e.g. similarity('Santos','Santos') = 1, similarity('Josh','Lorna') = 0.
function signals(
  simSurname: number,
  simFirstName: number,
  familyScore = 0,
  pii: Partial<Pick<MatchSignals, 'dobMatch' | 'phoneMatch' | 'emailMatch' | 'philsysMatch' | 'barangayMatch' | 'surnamePhoneticMatch'>> = {},
): MatchSignals {
  return {
    simSurname, simFirstName, familyScore,
    dobMatch: false, phoneMatch: false, emailMatch: false,
    philsysMatch: false, barangayMatch: false, surnamePhoneticMatch: false,
    ...pii,
  };
}

describe('assessMatchCandidate', () => {
  it('rejects a household that only shares the surname (Josh Santos vs Lorna Santos)', () => {
    const r = assessMatchCandidate(signals(1, 0));
    expect(r.isMatch).toBe(false);
    expect(r.matchedOn).toEqual([]);
  });

  it('rejects a household that only shares the first name (Josh Santos vs Josh Reyes)', () => {
    expect(assessMatchCandidate(signals(0, 1)).isMatch).toBe(false);
  });

  it('keeps a genuine duplicate (identical names)', () => {
    const r = assessMatchCandidate(signals(1, 1));
    expect(r.isMatch).toBe(true);
    expect(r.matchedOn).toContain('both_names');
    expect(r.score).toBeCloseTo(0.35, 5);
  });

  it('keeps a near first name that clears the per-field floor (Josh vs Joshua)', () => {
    expect(assessMatchCandidate(signals(1, 0.5)).isMatch).toBe(true);
  });

  it("flags on a unique PII match alone (renamed/typo'd client still found)", () => {
    const phone = assessMatchCandidate(signals(0, 0, 0, { phoneMatch: true }));
    expect(phone.isMatch).toBe(true);
    expect(phone.matchedOn).toEqual(['phone']);
    expect(phone.score).toBeCloseTo(0.2, 5);

    expect(assessMatchCandidate(signals(0, 0, 0, { emailMatch: true })).matchedOn).toEqual(['email']);
    expect(assessMatchCandidate(signals(0, 0, 0, { philsysMatch: true })).matchedOn).toEqual(['philsys']);
  });

  it('never flags on DOB or barangay alone (weak shared attributes)', () => {
    expect(assessMatchCandidate(signals(0, 0, 0, { dobMatch: true })).isMatch).toBe(false);
    expect(assessMatchCandidate(signals(0, 0, 0, { barangayMatch: true })).isMatch).toBe(false);
  });

  it('corroborates a weak name part with an exact DOB', () => {
    const r = assessMatchCandidate(signals(0, 0.5, 0, { dobMatch: true }));
    expect(r.isMatch).toBe(true);
    expect(r.matchedOn).toContain('dob_name');
    expect(r.score).toBeCloseTo(0.35 * 0.25 + 0.15, 5);
  });

  it('corroborates a solid first name with a sound-alike surname, and only then', () => {
    expect(assessMatchCandidate(signals(0, 0.5, 0, { surnamePhoneticMatch: true })).isMatch).toBe(true);
    expect(assessMatchCandidate(signals(0, 0.4, 0, { surnamePhoneticMatch: true })).isMatch).toBe(false);
  });

  it('keeps a household corroborated by a matching family member', () => {
    const r = assessMatchCandidate(signals(0.7, 0.2, 1));
    expect(r.isMatch).toBe(true);
    expect(r.matchedOn).toContain('family_member');
    expect(r.score).toBeCloseTo(0.35 * 0.45 + 0.2, 5);
  });

  it('does not let a weak family score rescue a single-name-part match', () => {
    expect(assessMatchCandidate(signals(1, 0, 0.79)).isMatch).toBe(false);
    expect(assessMatchCandidate(signals(0.4, 0.2, 1)).isMatch).toBe(false);
  });

  it('ranks by name + PII evidence compactly', () => {
    expect(assessMatchCandidate(signals(1, 1, 1, { phoneMatch: true })).score).toBeCloseTo(0.75, 5);
    expect(assessMatchCandidate(signals(1, 1, 0, { dobMatch: true, barangayMatch: true })).score).toBeCloseTo(0.6, 5);
    expect(assessMatchCandidate(signals(1, 1, 0)).score).toBeCloseTo(0.35, 5);
  });
});

describe('soundex', () => {
  it('codes sound-alike surnames the same (Smith/Smyth, Johnson/Jonson)', () => {
    expect(soundex('Smith')).toBe(soundex('Smyth'));
    expect(soundex('Johnson')).toBe(soundex('Jonson'));
    expect(soundex('Smith')).toBe('S530');
    expect(soundex('Johnson')).toBe('J525');
  });

  it('distinguishes clearly different names and handles empties', () => {
    expect(soundex('Reyes')).not.toBe(soundex('Santos'));
    expect(soundex(null)).toBe('');
    expect(soundex('   ')).toBe('');
  });
});