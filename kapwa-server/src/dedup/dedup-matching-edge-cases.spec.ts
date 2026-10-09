import { personSignals, dedupScore, rarityWeight, DEDUP_THRESHOLD_DEFAULT } from './dedup-matcher.service';
import { trigramSim } from './dedup-adapter';
import { sweep, RowInput, PersonRepo, HouseholdRepo, InterventionRepo } from './dedup-match-sweep.service';
import { parseImportFile, ColumnMapError, ColumnMap } from './dedup-parse.service';

/**
 * Exhaustive edge-case pass over person matching: similarity, signals, score
 * weights, rarity interplay, sweep orchestration, and the parse boundary that
 * feeds dob/values into the matcher. Values here PIN current behavior — where
 * a case is a known design tension (e.g. identical twins in the DB weakening
 * an exact match below threshold) the test documents it explicitly.
 */

const wUnique = { surname: 0, firstName: 0, middleName: 0, dob: 0, barangay: 0 };

describe('trigramSim — similarity extremes', () => {
  it('is 1 for identical strings regardless of case', () => {
    expect(trigramSim('Reyes', 'reyes')).toBe(1);
    expect(trigramSim('DE LA CRUZ', 'de la cruz')).toBe(1);
  });

  it('is 0 for disjoint strings, empties and nulls', () => {
    expect(trigramSim('Reyes', 'Santos')).toBe(0);
    expect(trigramSim('', 'Reyes')).toBe(0);
    expect(trigramSim('', '')).toBe(0);
    expect(trigramSim(null as unknown as string, 'Reyes')).toBe(0);
    // NOTE: `sim(x, x)` for a non-empty x is always 1, so a single char
    // string is a full self-match.
    expect(trigramSim('a', 'a')).toBe(1);
    expect(trigramSim('a', 'b')).toBe(0);
  });

  it('treats a substring as a partial agreement, not a full one', () => {
    const partial = trigramSim('rey', 'reyes');
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
  });

  it('docs what normalization does NOT do: interior whitespace and diacritics', () => {
    // norm() trims and lowercases only — double spaces stay different words.
    expect(trigramSim('de la cruz', 'de  la cruz')).toBeLessThan(1);
    // No diacritic folding: peña and pena are different trigram sets.
    expect(trigramSim('peña', 'pena')).toBeLessThan(1);
  });
});

describe('personSignals — per-attribute edge cases', () => {
  it('ignores case and outer whitespace on names', () => {
    const s = personSignals(
      { lastName: '  REYES ', firstName: ' Pedro ', middleName: ' POBLETE ' },
      { lastName: 'reyes', firstName: 'pedro', middleName: 'poblete' },
      trigramSim,
    );
    expect(s.simSurname).toBe(1);
    expect(s.simFirstName).toBe(1);
    expect(s.middleNameMatch).toBe(true);
    expect(s.surnamePhoneticMatch).toBe(true);
  });

  it('never credits a middle name when either side lacks it', () => {
    const bothMissing = personSignals({ lastName: 'R', firstName: 'P' }, { lastName: 'R', firstName: 'P' }, trigramSim);
    expect(bothMissing.middleNameMatch).toBe(false);
    const oneMissing = personSignals(
      { lastName: 'R', firstName: 'P', middleName: 'Poblete' },
      { lastName: 'R', firstName: 'P' },
      trigramSim,
    );
    expect(oneMissing.middleNameMatch).toBe(false);
  });

  it('matches dob only when both sides have the same date', () => {
    const same = personSignals({ lastName: 'R', firstName: 'P', dob: '1988-03-21' }, { lastName: 'R', firstName: 'P', dob: '1988-03-21' }, trigramSim);
    expect(same.dobMatch).toBe(true);
    expect(same.birthdayMatch).toBe(true); // alias stays in sync
    const missing = personSignals({ lastName: 'R', firstName: 'P', dob: '1988-03-21' }, { lastName: 'R', firstName: 'P' }, trigramSim);
    expect(missing.dobMatch).toBe(false);
    const different = personSignals({ lastName: 'R', firstName: 'P', dob: '1988-03-21' }, { lastName: 'R', firstName: 'P', dob: '1988-03-22' }, trigramSim);
    expect(different.dobMatch).toBe(false);
  });

  it('never matches a barangay when both sides are empty', () => {
    const s = personSignals({ lastName: 'R', firstName: 'P' }, { lastName: 'R', firstName: 'P' }, trigramSim);
    expect(s.barangayMatch).toBe(false);
  });

  it('converges phone forms: dashes, spaces, leading zero and +63 country code', () => {
    const a = personSignals({ lastName: 'R', firstName: 'P', phone: '0917-100-0005' }, { lastName: 'R', firstName: 'P', phone: '+63 917 100 0005' }, trigramSim);
    expect(a.phoneMatch).toBe(true);
    const b = personSignals({ lastName: 'R', firstName: 'P', phone: '044-123-4567' }, { lastName: 'R', firstName: 'P', phone: '+630441234567' }, trigramSim);
    expect(b.phoneMatch).toBe(true);
  });

  it('never matches on junk or genuinely different phones', () => {
    const junk = personSignals({ lastName: 'R', firstName: 'P', phone: 'call me' }, { lastName: 'R', firstName: 'P', phone: '09171000005' }, trigramSim);
    expect(junk.phoneMatch).toBe(false);
    const diff = personSignals({ lastName: 'R', firstName: 'P', phone: '09171000005' }, { lastName: 'R', firstName: 'P', phone: '09179876543' }, trigramSim);
    expect(diff.phoneMatch).toBe(false);
  });

  it('matches email case-insensitively after trimming', () => {
    const s = personSignals({ lastName: 'R', firstName: 'P', email: ' PEDRO@X.COM ' }, { lastName: 'R', firstName: 'P', email: 'pedro@x.com' }, trigramSim);
    expect(s.emailMatch).toBe(true);
  });

  it('philsys matches only on identical strings (no digit normalization)', () => {
    const exact = personSignals({ lastName: 'R', firstName: 'P', philsys: '1234-5678-9012' }, { lastName: 'R', firstName: 'P', philsys: '1234-5678-9012' }, trigramSim);
    expect(exact.philsysMatch).toBe(true);
    // Dashes vs plain digits are DIFFERENT strings today — a pinned edge:
    // the number is normalized nowhere, so this pair does NOT match.
    const dashed = personSignals({ lastName: 'R', firstName: 'P', philsys: '1234-5678-9012' }, { lastName: 'R', firstName: 'P', philsys: '123456789012' }, trigramSim);
    expect(dashed.philsysMatch).toBe(false);
  });

  it('phonetic surname agreement fires on soundex-equal spellings', () => {
    expect(personSignals({ lastName: 'Smith', firstName: 'J' }, { lastName: 'Smyth', firstName: 'J' }, () => 0.3).surnamePhoneticMatch).toBe(true);
    expect(personSignals({ lastName: "O'Brien", firstName: 'M' }, { lastName: 'OBrien', firstName: 'M' }, () => 0.3).surnamePhoneticMatch).toBe(true);
    expect(personSignals({ lastName: 'Reyes', firstName: 'P' }, { lastName: 'Lopez', firstName: 'P' }, () => 0.3).surnamePhoneticMatch).toBe(false);
  });

  it('never claims a phonetic match for non-letter names', () => {
    const s = personSignals({ lastName: '!!!', firstName: 'P' }, { lastName: '!!!', firstName: 'P' }, trigramSim);
    expect(s.surnamePhoneticMatch).toBe(false);
  });
});

describe('dedupScore — exact weights and bounds', () => {
  const signs = (a: Record<string, string>, b: Record<string, string>) =>
    personSignals(
      { lastName: 'Reyes', firstName: 'Pedro', ...a } as any,
      { lastName: 'Lopez', firstName: 'Anna', ...b } as any,
      trigramSim,
    );

  it('is 0 when nothing agrees', () => {
    const s = personSignals({ lastName: 'Reyes', firstName: 'Pedro' }, { lastName: 'Lopez', firstName: 'Anna' }, trigramSim);
    expect(dedupScore(s, wUnique, false)).toBe(0);
  });

  it('gives each single signal its bare weight (dob .25, barangay .1, middle .05, pii .1)', () => {
    expect(dedupScore(signs({ dob: '1988-03-21' }, { dob: '1988-03-21' }), wUnique, false)).toBeCloseTo(0.25);
    expect(dedupScore(signs({ barangay: 'Bigte' }, { barangay: 'Bigte' }), wUnique, false)).toBeCloseTo(0.1);
    expect(dedupScore(signs({ middleName: 'Poblete' }, { middleName: 'Poblete' }), wUnique, false)).toBeCloseTo(0.05);
    expect(dedupScore(signs({ philsys: '123456789012' }, { philsys: '123456789012' }), wUnique, false)).toBeCloseTo(0.1);
  });

  it('name+dob alone reaches threshold exactly (0.75); nothing else is needed', () => {
    const s = personSignals({ lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21' }, { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21' }, trigramSim);
    expect(dedupScore(s, wUnique, false)).toBeCloseTo(0.75);
    expect(dedupScore(s, wUnique, false)).toBeGreaterThanOrEqual(DEDUP_THRESHOLD_DEFAULT);
  });

  it('caps at 1 when pii/household bonuses overflow the full agreement', () => {
    const full = personSignals(
      { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', phone: '09171000005' },
      { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte', phone: '09171000005' },
      trigramSim,
    );
    expect(dedupScore(full, wUnique, false)).toBeCloseTo(1);
    expect(dedupScore(full, wUnique, true)).toBeCloseTo(1); // 1.1 → clamped
  });

  it('attenuates an exact match when values are common (count 1 → rareMul 0.75)', () => {
    const common = { surname: 1, firstName: 1, middleName: 1, dob: 1, barangay: 1 };
    const s = personSignals(
      { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte' },
      { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte' },
      trigramSim,
    );
    const score = dedupScore(s, common, false);
    expect(score).toBeCloseTo(0.675); // 0.9 × 0.75
    expect(score).toBeLessThan(DEDUP_THRESHOLD_DEFAULT); // the twin-identity hole
  });

  it('rarityWeight floors toward 0 for huge counts and rareMul approaches 0.5', () => {
    expect(rarityWeight(0)).toBe(1);
    expect(rarityWeight(1)).toBe(0.5);
    expect(rarityWeight(9)).toBe(0.1);
    expect(rarityWeight(1_000_000)).toBeLessThan(1e-5);
  });
});

const exactRow = (id: string, r: Partial<RowInput>): RowInput => ({
  id, rowIndex: Number(id.slice(1)), lastName: '', firstName: '', ...r,
});

function makeRepos(over: {
  persons?: (row: { lastName: string; firstName: string }) => Array<Record<string, unknown> & { id: string }>;
  households?: (personIds: string[]) => Array<{ id: string; memberPersonIds: string[] }>;
  interventions?: (personIds: string[]) => Record<string, number>;
}): { persons: PersonRepo; households: HouseholdRepo; interventions: InterventionRepo } {
  return {
    persons: { searchSimilar: (p) => Promise.resolve((over.persons ? over.persons(p) : []) as any) },
    households: { byMemberPersonIds: (ids) => Promise.resolve((over.households ? over.households(ids) : []) as any) },
    interventions: { countsByPerson: (ids) => Promise.resolve(over.interventions ? over.interventions(ids) : {}) },
  };
}

describe('sweep — orchestration edge cases', () => {
  it('accepts a name+dob match at exactly the threshold (0.75)', async () => {
    const repos = makeRepos({
      persons: () => [{ id: 'p9', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21' }],
    });
    const out = await sweep({
      rows: [exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21' })],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    expect(out.candidates).toHaveLength(1);
    expect(out.rowStatus.r1).toBe('pending');
  });

  it('marks a row with no similar person as no_match with no candidates', async () => {
    const repos = makeRepos({
      persons: () => [{ id: 'p9', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }],
    });
    const out = await sweep({
      rows: [exactRow('r1', { lastName: 'Garcia', firstName: 'Lourdes', dob: '1995-12-01', barangay: 'Minuyan' })],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    expect(out.candidates).toEqual([]);
    expect(out.rowStatus.r1).toBe('no_match');
  });

  it('caps candidates at 3 per row, best score first', async () => {
    const repos = makeRepos({
      // Four identical twins in the DB — all cross the low threshold, the
      // cap still binds.
      persons: () => [
        { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
        { id: 'p2', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
        { id: 'p3', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
        { id: 'p4', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
      ],
    });
    const out = await sweep({
      rows: [exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' })],
      threshold: 0.5,
      sim: trigramSim,
      ...repos,
    });
    expect(out.candidates).toHaveLength(3);
    const scores = out.candidates.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('identical twin persons in the DB attenuate an exact match below threshold', async () => {
    // The E2E surfaced this: two identical Reyes/Pedro rows in the person
    // table make the name+dob agreement "common", pushing a true exact match
    // below 0.75 — no candidate is raised and the row would be created as a
    // third duplicate. PINNED behavior, known tension (see ledger ruling).
    const repos = makeRepos({
      persons: () => [
        { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
        { id: 'p2', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' },
      ],
    });
    const out = await sweep({
      rows: [exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' })],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    expect(out.candidates).toEqual([]);
    expect(out.rowStatus.r1).toBe('no_match');
  });

  it('an identical twin INSIDE the file and one in the DB leaves NO candidate at all', async () => {
    // r1 and r2 are the same person, and the DB has an identical person p9.
    // Every rarity count sees the attribute three times, so BOTH the
    // db_person match (0.6375) and the intra-file pair (0.6375) fall below
    // 0.75 — the row reaches the review grid with no decision surface and is
    // created as a THIRD duplicate at finalize. PINNED behavior; the known
    // tension from the E2E seed-twins, now also inside the file.
    const repos = makeRepos({
      persons: () => [{ id: 'p9', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }],
    });
    const out = await sweep({
      rows: [
        exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }),
        exactRow('r2', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }),
      ],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    expect(out.candidates).toEqual([]);
    expect(out.rowStatus.r1).toBe('no_match');
    expect(out.rowStatus.r2).toBe('no_match');
  });

  it('the intra-file pair alone (no DB twin) still surfaces as an import_row candidate', async () => {
    const repos = makeRepos({ persons: () => [] });
    const out = await sweep({
      rows: [
        exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }),
        exactRow('r2', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }),
      ],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    const types = out.candidates.map((c) => c.targetType);
    expect(types).toEqual(['import_row']);
    expect(out.candidates[0].targetImportRowId).toBe('r1');
    expect(out.rowStatus.r2).toBe('pending');
  });

  it('only flags the household as served when a member has interventions', async () => {
    const repos = makeRepos({
      persons: (q) => {
        if (q.firstName === 'Pedro') return [{ id: 'p1', lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte', householdId: 'h1' }];
        return [{ id: 'p2', lastName: 'Reyes', firstName: 'Ana', dob: '1990-01-01', barangay: 'Bigte', householdId: 'h2' }];
      },
      // p1's household is untouched; p3 in p2's household received help.
      households: (personIds) =>
        personIds.includes('p2')
          ? [{ id: 'h2', memberPersonIds: ['p2', 'p3'] }]
          : [{ id: 'h1', memberPersonIds: ['p1'] }],
      interventions: () => ({ p3: 1 }),
    });
    const out = await sweep({
      rows: [
        exactRow('r1', { lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Bigte' }),
        exactRow('r2', { lastName: 'Reyes', firstName: 'Ana', dob: '1990-01-01', barangay: 'Bigte' }),
      ],
      threshold: 0.75,
      sim: trigramSim,
      ...repos,
    });
    const hh = out.candidates.filter((c) => c.targetType === 'household');
    // Only the household with serving evidence surfaces a candidate; r1's
    // untouched household shows nothing (no co-residents to parade).
    expect(hh).toHaveLength(1);
    expect(hh[0].signals.householdServed).toBe(true);
    expect(hh[0].targetHouseholdId).toBe('h2');
  });
});

describe('parse boundary — dob formats feeding the matcher', () => {
  const makeMap = (): ColumnMap => ({
    baseline: {
      lastName: 'Last Name', firstName: 'First Name', middleName: 'Middle Name',
      birthDate: 'Birthday', barangay: 'Barangay', remarks: 'Remarks',
    },
    extras: [],
  });

  async function parseDob(csv: string): Promise<string | undefined> {
    const out = await parseImportFile(Buffer.from(csv), 'edge.csv', makeMap());
    return out.rows[0].dob;
  }

  const header = 'Last Name,First Name,Middle Name,Birthday,Barangay,Remarks\n';

  it('passes ISO dates through unchanged and normalizes other spellings', async () => {
    expect(await parseDob(`${header}Reyes,Pedro,,1988-03-21,Bigte,AICS`)).toBe('1988-03-21');
    expect(await parseDob(`${header}Reyes,Pedro,,03/21/1988,Bigte,AICS`)).toBe('1988-03-21');
    expect(await parseDob(`${header}Reyes,Pedro,,21-Mar-1988,Bigte,AICS`)).toBe('1988-03-21');
    expect(await parseDob(`${header}Reyes,Pedro,,1988/03/21,Bigte,AICS`)).toBe('1988-03-21');
  });

  it('rejects unparseable and blank birthdays at the upload boundary', async () => {
    await expect(parseDob(`${header}Reyes,Pedro,,not-a-date,Bigte,AICS`)).rejects.toThrow(ColumnMapError);
    await expect(parseDob(`${header}Reyes,Pedro,,   ,Bigte,AICS`)).rejects.toThrow(ColumnMapError);
  });
});