import { ValueTransformer } from 'typeorm';

/**
 * A `decimal` column as a real number.
 *
 * node-postgres returns `numeric`/`decimal` as a **string** — `"5000.00"` — so
 * the value never has to round-trip through a JS float and lose precision.
 * TypeORM then hands that string to code whose type says `number`, and every
 * consumer is left to remember the coercion. The ones that forget compile
 * cleanly and misbehave at runtime: `"5000.00".toLocaleString()` returns
 * `"5000.00"` (String's own `toLocaleString` ignores its arguments, it is not
 * Number's), so a printed access card read `₱5000.00` instead of `₱5,000`.
 *
 * Attaching this to the column moves the conversion to the one place that
 * knows the column is a decimal, and makes the declared type true.
 */
export const DECIMAL_AS_NUMBER: ValueTransformer = {
  from(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    // `Number('')` is 0 and `Number('  ')` is 0. An empty value means the
    // column was NULL-ish; a zero cost is a different statement.
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  },

  // Write a fixed-scale string so the exact decimal reaches Postgres rather
  // than a float's shortest representation of it.
  to(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed.toFixed(2);
  },
};
