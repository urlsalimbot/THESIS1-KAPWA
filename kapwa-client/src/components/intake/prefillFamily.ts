import type { MatchCandidate } from './MatchCardSections';

export interface PrefillMember {
  surname: string;
  firstName: string;
  middleName: string;
  gender: string;
  dob: string;
  age?: number;
  relationship: string;
  occupation: string;
  income?: number;
  status: string;
}

// Roster members are stored with their relationship to the household head
// (the primary beneficiary — pseudo-role 'Self'). When the matched person is
// NOT a beneficiary (a household member being registered), each remaining
// member's relationship must be re-expressed relative to the matched person.
// INVERT[matchedRel][memberRel] = the member's relationship to the matched
// person. Unknown combinations fall back to 'Relative'.
const INVERT: Record<string, Record<string, string>> = {
  child: {
    Self: 'Parent', Spouse: 'Parent', Child: 'Sibling', Parent: 'Grandparent',
    Sibling: 'Uncle/Aunt', Grandparent: 'Great-Grandparent', Grandchild: 'Nephew/Niece',
    'Uncle/Aunt': 'Relative', 'Nephew/Niece': 'Relative', Relative: 'Relative', Other: 'Relative',
  },
  spouse: {
    Self: 'Spouse', Child: 'Child', Spouse: 'Relative', Parent: 'Parent-in-law',
    Sibling: 'Sibling-in-law', Grandparent: 'Relative', Grandchild: 'Grandchild',
    'Uncle/Aunt': 'Relative', 'Nephew/Niece': 'Relative', Relative: 'Relative', Other: 'Relative',
  },
  parent: {
    Self: 'Child', Spouse: 'Child', Child: 'Grandchild', Parent: 'Sibling',
    Sibling: 'Relative', Grandparent: 'Relative', Grandchild: 'Grandchild',
    'Uncle/Aunt': 'Relative', 'Nephew/Niece': 'Relative', Relative: 'Relative', Other: 'Relative',
  },
  sibling: {
    Self: 'Sibling', Spouse: 'Relative', Child: 'Nephew/Niece', Parent: 'Parent',
    Sibling: 'Sibling', Grandparent: 'Grandparent', Grandchild: 'Nephew/Niece',
    'Uncle/Aunt': 'Relative', 'Nephew/Niece': 'Relative', Relative: 'Relative', Other: 'Relative',
  },
  grandchild: {
    Self: 'Grandparent', Spouse: 'Grandparent', Parent: 'Grandparent', Child: 'Nephew/Niece',
    Sibling: 'Relative', Grandparent: 'Great-Grandparent', 'Nephew/Niece': 'Relative',
    Relative: 'Relative', Other: 'Relative',
  },
};

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

/** Case-insensitive lookup into a relationship table (keys are Title-case). */
function apply(table: Record<string, string> | undefined, rel: string): string | undefined {
  if (!table) return undefined;
  const target = norm(rel);
  for (const [k, v] of Object.entries(table)) {
    if (norm(k) === target) return v;
  }
  return undefined;
}

function identity(m: { surname: string; firstName: string; dob?: string; gender: string }) {
  return `${norm(m.surname)}|${norm(m.firstName)}|${m.dob || ''}|${m.gender || ''}`;
}

/**
 * Family-composition rows prefilled from a confirmed match.
 *
 * Beneficiary matches: the household roster is copied as-is (relationships are
 * already relative to the household).
 *
 * Member matches (the matched person is not a beneficiary — they are the one
 * being registered): the matched person is removed from the family list and
 * every other member's relationship is inverted relative to them. e.g. Liza
 * Querubin matched as Pablo Querubin's Child produces Pablo (Parent) and his
 * spouse Consuelo (Parent); siblings become 'Sibling', the head's parents
 * 'Grandparent', and so on.
 */
export function buildPrefilledFamily(candidate: MatchCandidate): PrefillMember[] {
  const matched = candidate.matchedPerson;
  const memberRows = candidate.familyMembers;

  if (matched.role !== 'member') {
    return memberRows.filter(m => m.surname && m.firstName).map(toPrefill);
  }

  const matchedKey = identity(matched);
  const matchedRel = norm(matched.relationship);
  const table = INVERT[matchedRel];

  const rows: PrefillMember[] = [];
  if (table) {
    // The household head has no membership row of their own; add them with
    // their relationship inverted relative to the matched person.
    rows.push({
      surname: candidate.primaryBeneficiary.surname,
      firstName: candidate.primaryBeneficiary.firstName,
      middleName: candidate.primaryBeneficiary.middleName || '',
      gender: candidate.primaryBeneficiary.gender,
      dob: candidate.primaryBeneficiary.dob || '',
      age: candidate.primaryBeneficiary.age,
      relationship: apply(table, 'Self') ?? 'Relative',
      occupation: candidate.primaryBeneficiary.occupation,
      income: candidate.primaryBeneficiary.estimatedMonthlyIncome,
      status: '',
    });
  }

  for (const m of memberRows) {
    if (!m.surname || !m.firstName) continue;
    if (identity(m) === matchedKey) continue; // the matched person is the beneficiary now
    rows.push(toPrefill({ ...m, relationship: table ? (apply(table, m.relationship) ?? 'Relative') : m.relationship }));
  }
  return rows;
}

function toPrefill(m: { surname: string; firstName: string; middleName?: string; gender: string; dob?: string; age?: number; relationship: string; occupation?: string; income?: number; status?: string }): PrefillMember {
  return {
    surname: m.surname,
    firstName: m.firstName,
    middleName: m.middleName || '',
    gender: m.gender,
    dob: m.dob || '',
    age: m.age,
    relationship: m.relationship,
    occupation: m.occupation || '',
    income: m.income != null ? Number(m.income) : undefined,
    status: m.status || '',
  };
}