import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Fresh boots build the whole schema from `migrate.ts` (then mark every
// TypeORM migration as applied), so a new table must land in BOTH places. This
// test is the check that convention never had: a migration that creates a live
// table which `migrate.ts` does not know about fails here, instead of failing
// on some fresh deployment six months later.

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const MIGRATE_SRC = readFileSync(join(__dirname, 'migrate.ts'), 'utf8');

const CREATE_RE = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g;
const DROP_RE = /DROP TABLE\s+(?:IF EXISTS\s+)?([a-z_]+)/g;
// Words that regex noise mistakes for table names (e.g. `IN (…)`).
const RESERVED = new Set(['in', 'as', 'on', 'or', 'and', 'is', 'of', 'to', 'by', 'at', 'not']);

function tables(src: string, re: RegExp): string[] {
  return [...src.matchAll(re)].map((m) => m[1]).filter((t) => !RESERVED.has(t));
}

describe('migrate.ts covers every live migration table', () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.ts'));
  const created = new Set<string>();
  const dropped = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    for (const t of tables(src, CREATE_RE)) created.add(t);
    for (const t of tables(src, DROP_RE)) dropped.add(t);
  }
  const live = [...created].filter((t) => !dropped.has(t));

  it('finds live tables in the migration chain', () => {
    expect(live.length).toBeGreaterThan(10);
  });

  it('fresh-boot schema contains every live table', () => {
    const missing = live.filter(
      (t) => !MIGRATE_SRC.includes(`CREATE TABLE IF NOT EXISTS ${t} (`),
    );
    expect(missing).toEqual([]);
  });
});