import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { BARANGAY_COLUMNS } from './barangay-columns';

// `check-barangay-drift.ts` reads the columns in BARANGAY_COLUMNS and then asks
// the database for the values in them. It reports a column that no longer
// exists as "skipped" and moves on, which is right for a half-migrated database
// and wrong for a current one: it means a normalization can move a barangay
// column and the check goes on printing "No drift" from then on.
//
// That is not hypothetical. Both bootstraps drop `users.assigned_barangay` and
// `users.permitted_barangays` — migration DropUserLegacyColumns0000000000046
// and migrate.ts:991 — after backfilling them into `user_barangay_assignments`,
// so the list used to watch two columns that cannot exist and miss the one that
// does.
//
// The entities are loaded by walking the source tree exactly as
// `database/data-source.ts` globs them, rather than from a hand-written import
// list: a second list would go stale in precisely the way this guards against.

const ENTITIES_DIR = join(__dirname, '..');

function entityFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...entityFiles(full));
    } else if (entry.endsWith('.entity.ts') && entry !== 'base.entity.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('BARANGAY_COLUMNS', () => {
  // Loading every entity registers its columns with TypeORM's metadata storage.
  beforeAll(() => {
    for (const file of entityFiles(ENTITIES_DIR)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(file);
    }
  });

  // Column names that *are* a barangay, as opposed to `barangay_id` or a join.
  const IS_A_BARANGAY_NAME = /(^|_)barangays?$/;

  const tableOf = (target: unknown): string | undefined =>
    getMetadataArgsStorage().tables.find(t => t.target === target)?.name;

  const declaredColumns = (): string[] =>
    getMetadataArgsStorage()
      .columns.map(c => ({
        table: tableOf(c.target),
        column: (c.options.name as string) ?? c.propertyName,
      }))
      .filter(p => p.table && IS_A_BARANGAY_NAME.test(p.column))
      .map(p => `${p.table}.${p.column}`);

  it('finds the barangay columns the entities declare', () => {
    // Guards the two tests below from passing vacuously. It also fails if the
    // entity walk stops finding files at all.
    const declared = declaredColumns();
    expect(declared.length).toBeGreaterThanOrEqual(4);
    // Spot-check the one this whole check exists for: the user's own scope,
    // which reaches `access_card_services.source_barangay` on every logged
    // service.
    expect(declared).toContain('user_barangay_assignments.barangay');
  });

  it('lists every column an entity says stores a barangay', () => {
    // The load-bearing direction: a new or moved column must be added here, or
    // the drift check silently stops covering it.
    const listed = new Set(BARANGAY_COLUMNS.map(c => `${c.table}.${c.column}`));

    expect(declaredColumns().filter(key => !listed.has(key))).toEqual([]);
  });

  it('lists nothing that no entity declares', () => {
    // The other direction: a stale entry is a column the check reports as
    // "skipped" forever, which reads as "nothing to worry about here".
    const declared = new Set(declaredColumns());
    const stale = BARANGAY_COLUMNS
      .map(c => `${c.table}.${c.column}`)
      .filter(key => !declared.has(key));

    expect(stale).toEqual([]);
  });
});
