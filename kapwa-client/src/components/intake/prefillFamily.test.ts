import { describe, it, expect } from 'vitest';
import { buildPrefilledFamily } from './prefillFamily';
import type { MatchCandidate } from './MatchProbeDialog';

function candidate(over: Partial<MatchCandidate>): MatchCandidate {
  return {
    householdId: 'hh-1',
    score: 0.9,
    matchedOn: ['both_names'],
    caseExistsWithin30Days: false,
    primaryBeneficiary: {
      id: 'ben-1', surname: 'Querubin', firstName: 'Pablo', gender: 'Male', age: 48,
      dob: '1978-12-01', phone: '09179996001', occupation: 'Farmer',
      estimatedMonthlyIncome: 8000, civilStatus: 'Married',
      currentAddress: { barangay: 'Partida' },
    },
    matchedPerson: {
      id: 'person-liza', role: 'member', relationship: 'Child',
      surname: 'Querubin', firstName: 'Liza', gender: 'Female', age: 11, dob: '2015-03-30',
      phone: '', occupation: 'Student', estimatedMonthlyIncome: 0,
      civilStatus: 'Single', currentAddress: { barangay: 'Partida' },
    },
    allBeneficiaries: [{ id: 'ben-1', surname: 'Querubin', firstName: 'Pablo' }],
    familyMembers: [
      { id: 'fm-liza', fullName: 'Liza Querubin', surname: 'Querubin', firstName: 'Liza', gender: 'Female', dob: '2015-03-30', relationship: 'Child', age: 11, occupation: 'Student', income: 0, status: 'Active' },
      { id: 'fm-consuelo', fullName: 'Consuelo Querubin', surname: 'Querubin', firstName: 'Consuelo', gender: 'Female', dob: '1985-05-05', relationship: 'Spouse', age: 41, occupation: 'Housewife', income: 0, status: 'Active' },
    ],
    pastCases: [],
    lastApprovedCaseDate: null,
    ...over,
  };
}

describe('buildPrefilledFamily', () => {
  it('inverts relationships for a member match: head and spouse become Parent, matched person is removed', () => {
    const rows = buildPrefilledFamily(candidate({}));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ firstName: 'Pablo', relationship: 'Parent' });
    expect(rows[1]).toMatchObject({ firstName: 'Consuelo', relationship: 'Parent' });
    expect(rows.some(r => r.firstName === 'Liza')).toBe(false);
  });

  it('keeps the roster as-is (original relationships) for a beneficiary match, with no head entry', () => {
    const c = candidate({ matchedPerson: { ...candidate({}).matchedPerson, role: 'beneficiary' } as MatchCandidate['matchedPerson'] });
    const rows = buildPrefilledFamily(c);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ firstName: 'Liza', relationship: 'Child' });
    expect(rows[1]).toMatchObject({ firstName: 'Consuelo', relationship: 'Spouse' });
    expect(rows.some(r => r.firstName === 'Pablo')).toBe(false);
  });

  it('maps siblings for a child match', () => {
    const c = candidate({
      familyMembers: [
        { id: 'fm-liza', fullName: 'Liza Querubin', surname: 'Querubin', firstName: 'Liza', gender: 'Female', dob: '2015-03-30', relationship: 'Child', age: 11, occupation: 'Student', income: 0, status: 'Active' },
        { id: 'fm-ken', fullName: 'Ken Querubin', surname: 'Querubin', firstName: 'Ken', gender: 'Male', dob: '2018-07-01', relationship: 'Child', age: 8, occupation: 'Student', income: 0, status: 'Active' },
      ],
    });
    const rows = buildPrefilledFamily(c);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ firstName: 'Pablo', relationship: 'Parent' });
    expect(rows[1]).toMatchObject({ firstName: 'Ken', relationship: 'Sibling' });
  });

  it('maps the head’s parent to Grandparent and falls back to Relative for unknown combos', () => {
    const c = candidate({
      familyMembers: [
        { id: 'fm-liza', fullName: 'Liza Querubin', surname: 'Querubin', firstName: 'Liza', gender: 'Female', dob: '2015-03-30', relationship: 'Child', age: 11, occupation: 'Student', income: 0, status: 'Active' },
        { id: 'fm-sol', fullName: 'Sol Querubin', surname: 'Querubin', firstName: 'Sol', gender: 'Female', dob: '1955-01-01', relationship: 'Parent', age: 71, occupation: '', income: 0, status: 'Active' },
        { id: 'fm-z', fullName: 'Zed Querubin', surname: 'Querubin', firstName: 'Zed', gender: 'Male', dob: '1960-02-02', relationship: 'Cousin', age: 66, occupation: '', income: 0, status: 'Active' },
      ],
    });
    const rows = buildPrefilledFamily(c);

    expect(rows[0]).toMatchObject({ firstName: 'Pablo', relationship: 'Parent' });
    expect(rows[1]).toMatchObject({ firstName: 'Sol', relationship: 'Grandparent' });
    expect(rows[2]).toMatchObject({ firstName: 'Zed', relationship: 'Relative' });
  });

  it('keeps original relationships and drops the head when the matched relationship is unmapped', () => {
    const c = candidate({
      matchedPerson: { ...candidate({}).matchedPerson, relationship: 'Unrelated Caretaker' } as MatchCandidate['matchedPerson'],
    });
    const rows = buildPrefilledFamily(c);

    expect(rows).toHaveLength(1); // Liza excluded, Consuelo kept with original relation; head not added
    expect(rows[0]).toMatchObject({ firstName: 'Consuelo', relationship: 'Spouse' });
  });
});