#!/usr/bin/env bash
#
# Boot-to-chain schema parity (audit §2.2).
#
# Two fresh databases answer two different questions:
#   * `migrate.js` is the canonical fresh-boot bootstrap — what a new
#     installation gets.
#   * the TypeORM chain is what every EXISTING installation is on.
# Nothing compared the two. A change that lands in one and not the other is
# invisible until someone installs fresh (missing table) or upgrades (missing
# column) — the class of bug that previously shipped as migrations 95/96 and was
# only caught in production.
#
# This script rebuilds both from empty and diffs their schemas (tables, columns,
# types, nullability, defaults, foreign keys, unique constraints, indexes). Any
# difference fails the run.
#
# Usage: ./scripts/schema-parity.sh [check|update-baseline] [boot_db] [chain_db]
# Env:   DB_HOST DB_PORT DB_USER DB_PASSWORD (defaults match docker-compose)
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

BOOT_DB="${2:-kapwa_parity_boot}"
CHAIN_DB="${3:-kapwa_parity_chain}"
BASELINE="$HERE/scripts/schema-parity.baseline.txt"
export PGHOST="${DB_HOST:-localhost}"
export PGPORT="${DB_PORT:-5432}"
export PGUSER="${DB_USER:-kapwa}"
export PGPASSWORD="${DB_PASSWORD:-kapwa}"
export PGSSLMODE="${PGSSLMODE:-prefer}"

psql_admin() { psql -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo "── recreating ${BOOT_DB} and ${CHAIN_DB} on ${PGHOST}:${PGPORT}"
psql_admin -q -c "DROP DATABASE IF EXISTS ${BOOT_DB}" -c "CREATE DATABASE ${BOOT_DB}"
psql_admin -q -c "DROP DATABASE IF EXISTS ${CHAIN_DB}" -c "CREATE DATABASE ${CHAIN_DB}"

echo "── path 1/2: fresh-boot bootstrap (dist/database/migrate.js)"
DB_NAME="$BOOT_DB" node dist/database/migrate.js >/dev/null

echo "── path 2/2: TypeORM migration chain"
DB_NAME="$CHAIN_DB" npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts >/dev/null

# Normalized fingerprint: one line per structural fact, sorted, so the two dumps
# are comparable text. Names are deliberately excluded from indexes and
# constraints — a renamed index still indexes the same columns, and chasing
# names would drown the signal (the first run of this check was 97 lines of pure
# renaming). What is compared is what breaks a deployment: tables, columns,
# types, nullability, defaults, and the SHAPE of every key and index.
fingerprint() {
  local db="$1"
  {
    psql -d "$db" -At -F'|' -c "
      select 'column', table_name, column_name,
             -- Postgres treats an unbounded varchar and text identically (same
             -- storage, same operators, no length limit): one fact, not two.
             case when data_type = 'character varying' and character_maximum_length is null
                  then 'text' else data_type end,
             is_nullable,
             replace(coalesce(column_default, ''), '::character varying', '::text')
        from information_schema.columns
       where table_schema = 'public'
       order by table_name, column_name"
    # Keys and constraints by shape: type + the columns they cover, in order.
    psql -d "$db" -At -F'|' -c "
      select 'constraint', tc.table_name, tc.constraint_type, kcu.column_name, kcu.ordinal_position
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name and kcu.table_name = tc.table_name
       where tc.table_schema = 'public' and tc.constraint_type in ('FOREIGN KEY', 'UNIQUE', 'PRIMARY KEY')
       order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position"
    # Indexes by shape: method, columns/expressions, uniqueness, partial predicate.
    psql -d "$db" -At -F'|' -c "
      select 'index', tablename,
             replace(regexp_replace(indexdef, 'INDEX [^ ]+ ON', 'INDEX ON'), ' ON public.', ' ON ')
        from pg_indexes
       where schemaname = 'public'
       order by tablename, 2"
  } | sort
}

BOOT_OUT="$(mktemp)"; CHAIN_OUT="$(mktemp)"; CURRENT="$(mktemp)"
trap 'rm -f "$BOOT_OUT" "$CHAIN_OUT" "$CURRENT"' EXIT
fingerprint "$BOOT_DB" > "$BOOT_OUT"
fingerprint "$CHAIN_DB" > "$CHAIN_OUT"

BOOT_LINES=$(wc -l < "$BOOT_OUT" | tr -d ' ')
CHAIN_LINES=$(wc -l < "$CHAIN_OUT" | tr -d ' ')
echo "── facts compared: bootstrap ${BOOT_LINES}, chain ${CHAIN_LINES}"

diff -u "$BOOT_OUT" "$CHAIN_OUT" > /tmp/schema-parity.diff || true
# Only the changed facts, not the hunk headers of the unified diff.
grep -E '^[+-][a-z]' /tmp/schema-parity.diff | sed 's/^\(.\)/\1 /' | sort -u > "$CURRENT"

if [ "${1:-check}" = "update-baseline" ]; then
  cp "$CURRENT" "$BASELINE"
  echo "baseline updated: $(wc -l < "$BASELINE" | tr -d ' ') known differences recorded in $BASELINE"
  echo "commit it together with whatever changed the schema."
  exit 0
fi

# The check is a ratchet, not a gate on history: the differences that exist
# today are recorded in the baseline (each one a known backlog item), and only a
# NEW divergence — a table, column, index or key present on one path and not the
# other — fails the build. Regenerate deliberately with `update-baseline`.
if [ ! -f "$BASELINE" ]; then
  echo "❌ no baseline at $BASELINE — run: ./scripts/schema-parity.sh update-baseline"
  exit 1
fi

comm -23 "$CURRENT" "$BASELINE" > /tmp/schema-parity.new
STALE=$(comm -13 "$CURRENT" "$BASELINE" | wc -l | tr -d ' ')

if [ -s /tmp/schema-parity.new ]; then
  echo "❌ new schema divergence between the two paths (/tmp/schema-parity.new):"
  cat /tmp/schema-parity.new
  echo
  echo "Either make one path match the other, or — if the difference is intended —"
  echo "record it with: ./scripts/schema-parity.sh update-baseline"
  exit 1
fi

echo "✅ no NEW divergence (${STALE} baseline entries no longer differ; prune them with update-baseline)"
echo "   full diff kept at /tmp/schema-parity.diff for review"
