import type { ObjectLiteral, Repository } from 'typeorm';

/**
 * Per-year sequence plumbing (CSR control numbers).
 *
 * This lives under `database/` on purpose: it is the one place allowed to build
 * SQL identifiers by interpolation, and the ESLint rule that keeps `${`
 * out of `query(` everywhere else exempts this directory. The names it accepts
 * are built from a four-digit year, never from input.
 *
 * The sequence is created on demand. The schema seeds only the year it was
 * written (2026), so before this the first CSR of a new year threw
 * `relation "csr_seq_2027" does not exist` — a year-rollover failure with no
 * warning until 1 January (found while auditing the interpolated query).
 */

/** Sequence names are `csr_seq_<4-digit year>`; anything else is a bug. */
const SEQUENCE_NAME = /^[a-z_]+_[0-9]{4}$/;

function assertSequenceName(name: string): string {
  if (!SEQUENCE_NAME.test(name)) {
    throw new Error(`Refusing to build a sequence identifier from "${name}"`);
  }
  return name;
}

/** `CREATE SEQUENCE IF NOT EXISTS` for the given name — safe to call every time. */
export async function ensureSequence(repo: Repository<ObjectLiteral>, name: string): Promise<void> {
  await repo.query(`CREATE SEQUENCE IF NOT EXISTS ${assertSequenceName(name)} START WITH 1 INCREMENT BY 1`);
}

/**
 * Create the sequence when missing and take its next value.
 * The name is passed to `nextval` as a parameter; only the DDL above needs the
 * identifier inline, and it is validated against {@link SEQUENCE_NAME} first.
 */
export async function nextSequenceValue(repo: Repository<ObjectLiteral>, name: string): Promise<number> {
  await ensureSequence(repo, name);
  const rows = await repo.query('SELECT nextval($1::regclass) AS seq', [assertSequenceName(name)]);
  return parseInt(rows[0].seq, 10);
}
