import { sweep, RowInput, MatchCandidate, PersonRepo, HouseholdRepo, InterventionRepo } from './dedup-match-sweep.service';

const exactSim = (x: string, y: string): number => (x === y ? 1 : 0.2);

const row = (id: string, r: Partial<RowInput>): RowInput => ({
  id, rowIndex: Number(id.slice(1)), lastName: '', firstName: '', ...r,
});

function makeRepos(over: {
  persons?: (row: { lastName: string; firstName: string }) => Array<{ id: string; lastName: string; firstName: string; dob?: string | null; barangay?: string | null; householdId?: string | null }>;
  households?: (personIds: string[]) => Array<{ id: string; memberPersonIds: string[] }>;
  interventions?: (personIds: string[]) => Record<string, number>;
}): { persons: PersonRepo; households: HouseholdRepo; interventions: InterventionRepo } {
  return {
    persons: { searchSimilar: (p) => Promise.resolve((over.persons ? over.persons(p) : []) as any) },
    households: { byMemberPersonIds: (ids) => Promise.resolve((over.households ? over.households(ids) : []) as any) },
    interventions: { countsByPerson: (ids) => Promise.resolve(over.interventions ? over.interventions(ids) : {}) },
  };
}

describe('sweep', () => {
  it('flags a row matching an existing person by name and dob as a db_person candidate', async () => {
    const rows = [row('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' })];
    const repos = makeRepos({
      persons: () => [{ id: 'p9', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }],
    });
    const out = await sweep({ rows, threshold: 0.75, sim: exactSim, ...repos });
    const db = out.candidates.filter((c) => c.targetType === 'db_person');
    expect(db).toHaveLength(1);
    expect(db[0].targetPersonId).toBe('p9');
    expect(db[0].score).toBeGreaterThanOrEqual(0.75);
    expect(out.rowStatus.r1).toBe('pending');
  });

  it('turns a strong household-member match into a household candidate with householdServed', async () => {
    const rows = [row('r1', { lastName: 'Dimagiba', firstName: 'Carla', dob: '1993-04-19', barangay: 'San Mateo' })];
    const repos = makeRepos({
      persons: () => [{ id: 'p7', lastName: 'Dimagiba', firstName: 'Carla', dob: '1993-04-19', barangay: 'San Mateo', householdId: 'h1' }],
      households: () => [{ id: 'h1', memberPersonIds: ['p7', 'p8'] }],
      interventions: () => ({ p8: 2 }),
    });
    const out = await sweep({ rows, threshold: 0.75, sim: exactSim, ...repos });
    const hh = out.candidates.filter((c) => c.targetType === 'household');
    expect(hh).toHaveLength(1);
    expect(hh[0].targetHouseholdId).toBe('h1');
    expect(hh[0].memberPersonIds).toEqual(['p7', 'p8']);
    expect(hh[0].signals.householdServed).toBe(true);
  });

  it('pairs identical rows within the import (second row points at the first)', async () => {
    const rows = [
      row('r1', { lastName: 'Garcia', firstName: 'Nena', dob: '1975-06-14' }),
      row('r2', { lastName: 'Garcia', firstName: 'Nena', dob: '1975-06-14' }),
    ];
    const out = await sweep({ rows, threshold: 0.75, sim: exactSim, persons: { searchSimilar: () => Promise.resolve([]) }, households: { byMemberPersonIds: () => Promise.resolve([]) }, interventions: { countsByPerson: () => Promise.resolve({}) } });
    expect(out.rowStatus.r1).toBe('no_match');
    const intra = out.candidates.filter((c) => c.targetType === 'import_row');
    expect(intra).toHaveLength(1);
    expect(intra[0].rowId).toBe('r2');
    expect(intra[0].targetImportRowId).toBe('r1');
    expect(out.rowStatus.r2).toBe('pending');
  });

  it('leaves a weak no-barangay row unmatched', async () => {
    const rows = [row('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' })];
    const repos = makeRepos({
      persons: () => [{ id: 'p9', lastName: 'Dela Cruz', firstName: 'Juan', dob: '1988-03-21' }],
    });
    const out = await sweep({ rows, threshold: 0.75, sim: exactSim, ...repos });
    expect(out.candidates).toHaveLength(0);
    expect(out.rowStatus.r1).toBe('no_match');
  });
});