/**
 * Read-only drift check for the Norzagaray barangay vocabulary.
 *
 * The 13 names in `common/constants.ts` are enforced at the DTO boundary, so
 * no *new* misspelled assignment can be written. This script covers what that
 * cannot: rows that already exist. Enforcing the enum protects the write path;
 * this reports the residue so a legacy typo surfaces before a coordinator
 * silently concludes their service history is empty.
 *
 * Deliberately read-only. Rewriting production data on the strength of a
 * hardcoded list is not something a check script should decide to do.
 *
 * Usage: npm run check:barangay-drift
 * Exits 0 when every stored value is in the list, 1 when any is not.
 */
import { DataSource } from 'typeorm';
import { BARANGAY_NAMES } from '../src/common/constants';
// Where to look lives there, not here: `barangay-columns.spec.ts` pins it
// against the entities' metadata, so a normalization that moves a barangay
// column fails a test instead of quietly leaving this script nothing to read.
import { BARANGAY_COLUMNS } from '../src/common/barangay-columns';
import { AppDataSource } from '../src/database/data-source';

const KNOWN = new Set<string>(BARANGAY_NAMES);

async function hasColumn(
  qs: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows: { n: number }[] = await qs.query(
    `SELECT count(*)::int AS n
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function readColumn(
  qs: DataSource,
  table: string,
  column: string,
): Promise<string[]> {
  // Guard both the table and the column. A table that does not exist yet, or a
  // schema that has not been migrated, must be *reported* as such rather than
  // aborting the whole check — otherwise one missing table hides the drift in
  // every other table.
  if (!(await hasColumn(qs, table, column))) {
    return [];
  }

  const rows: Record<string, unknown>[] = await qs.query(
    `SELECT ${column} AS v FROM ${table} WHERE ${column} IS NOT NULL`,
  );

  const out: string[] = [];
  for (const r of rows) {
    const v = r.v;
    // A non-string value (e.g. a Postgres array literal arriving as an object)
    // is itself drift — surface it verbatim rather than skipping the row.
    if (typeof v === 'string' && v.length > 0) out.push(v);
    else if (v != null && typeof v !== 'string') out.push(JSON.stringify(v));
  }
  return out;
}

async function main(): Promise<number> {
  const ds = AppDataSource;
  const findings: { target: string; value: string; count: number }[] = [];

  const missing: string[] = [];

  try {
    await ds.initialize();
    for (const { table, column } of BARANGAY_COLUMNS) {
      if (!(await hasColumn(ds, table, column))) {
        missing.push(`${table}.${column}`);
        continue;
      }
      const values = await readColumn(ds, table, column);
      const offenders = values.filter(v => !KNOWN.has(v));
      for (const value of offenders) {
        const count = values.filter(v => v === value).length;
        const found = findings.find(f => f.target === `${table}.${column}` && f.value === value);
        if (found) found.count = count;
        else findings.push({ target: `${table}.${column}`, value, count });
      }
    }
  } catch (err) {
    console.error('Could not run the drift check:', (err as Error).message);
    console.error('Is the database reachable? See src/database/data-source.ts for the config source.');
    return 1;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }

  for (const m of missing) {
    console.warn(`  skipped ${m} — table or column not present in this database`);
  }

  if (findings.length === 0) {
    console.log(`No drift: every stored barangay is one of the ${KNOWN.size} in common/constants.ts.`);
    return 0;
  }

  console.error(`Barangay drift found — ${findings.length} distinct value(s) outside the list:\n`);
  for (const f of findings) {
    console.error(`  ${f.target}  ${JSON.stringify(f.value)}  (${f.count} row${f.count === 1 ? '' : 's'})`);
  }
  console.error('\nRows carrying these values match no list query that filters on that column.');
  console.error('Reassign the affected users/records to a valid barangay by hand; this script');
  console.error('deliberately does not rewrite data.');
  return 1;
}

main().then(code => process.exit(code));
