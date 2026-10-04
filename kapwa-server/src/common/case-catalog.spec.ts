import { readFileSync } from 'fs';
import { join } from 'path';
import { INTERVENTION_TYPES, PROGRAM_TYPES } from './case-catalog';

// The canonical catalog JSON (repo-root; readable in test runs even though it
// is not in the Docker image — `case-catalog.ts` mirrors it as literals for
// that exact reason). A catalog change must land in the JSON first; this ties
// the server copy to it.
const CATALOG = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'superpowers', 'specs', 'case-catalog.json'),
    'utf8',
  ),
) as { interventionTypes: string[]; programTypes: string[] };

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
});