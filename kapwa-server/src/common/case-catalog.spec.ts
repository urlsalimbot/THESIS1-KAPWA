import { readFileSync } from 'fs';
import { join } from 'path';
import { INTERVENTION_TYPES, PROGRAM_TYPES, FINANCIAL_INTERVENTION_TYPES, PROGRAM_TYPES_BY_CASE_CATEGORY } from './case-catalog';

// The canonical catalog JSON (repo-root; readable in test runs even though it
// is not in the Docker image — `case-catalog.ts` mirrors it as literals for
// that exact reason). A catalog change must land in the JSON first; this ties
// the server copy to it.
const CATALOG = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'superpowers', 'specs', 'case-catalog.json'),
    'utf8',
  ),
) as {
  interventionTypes: string[];
  programTypes: string[];
  financialInterventionTypes: string[];
  programTypesByCaseCategory: Record<string, string[]>;
};

describe('case catalog parity', () => {
  it('INTERVENTION_TYPES equals the canonical JSON', () => {
    expect(CATALOG.interventionTypes.length).toBeGreaterThan(0);
    expect([...INTERVENTION_TYPES].sort()).toEqual([...CATALOG.interventionTypes].sort());
    // Length is the part toEqual would forgive: an extra trailing code would
    // otherwise pass with the catalog carrying a code the server never accepts.
    expect(INTERVENTION_TYPES.length).toBe(CATALOG.interventionTypes.length);
  });

  it('PROGRAM_TYPES equals the canonical JSON', () => {
    expect(CATALOG.programTypes.length).toBeGreaterThan(0);
    expect([...PROGRAM_TYPES].sort()).toEqual([...CATALOG.programTypes].sort());
    expect(PROGRAM_TYPES.length).toBe(CATALOG.programTypes.length);
  });

  it('FINANCIAL_INTERVENTION_TYPES is a subset of the catalog and equals the JSON', () => {
    expect(FINANCIAL_INTERVENTION_TYPES.length).toBeGreaterThan(0);
    expect(FINANCIAL_INTERVENTION_TYPES.every((c) => INTERVENTION_TYPES.includes(c))).toBe(true);
    expect([...FINANCIAL_INTERVENTION_TYPES].sort()).toEqual([...CATALOG.financialInterventionTypes].sort());
  });

  it('PROGRAM_TYPES_BY_CASE_CATEGORY equals the JSON mapping', () => {
    expect(Object.keys(CATALOG.programTypesByCaseCategory).length).toBeGreaterThan(0);
    expect(Object.keys(PROGRAM_TYPES_BY_CASE_CATEGORY).sort()).toEqual(
      Object.keys(CATALOG.programTypesByCaseCategory).sort(),
    );
    for (const [category, types] of Object.entries(PROGRAM_TYPES_BY_CASE_CATEGORY)) {
      expect([...types].sort()).toEqual([...CATALOG.programTypesByCaseCategory[category]].sort());
      types.forEach((t) => expect(PROGRAM_TYPES).toContain(t));
    }
  });
});