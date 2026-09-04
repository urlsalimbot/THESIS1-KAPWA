# Wave 3 — Migration Chain Break: RESEARCH

**Phase:** Wave 3 (user-chosen scope: "fix pre-existing July migration chain break")
**Date:** 2026-08-30
**Investigator:** main thread (caveman mode, artifacting to files)

## TL;DR

The documented from-scratch break at `20260720000001-UnifiedPersonModel.ts`
(`column "place_of_birth" does not exist`) is a **symptom**. The root cause is
TypeORM's migration ordering: it sorts by `parseInt(className.substr(-13))`,
and the migration class names carry **inconsistent suffix widths (13 vs 14
digits)**, scrambling 48 of 50 executions into a non-chronological order. Two
changes make a fresh-DB `migration:run` replay all 50 migrations cleanly —
verified against the real TypeORM CLI on a disposable Postgres.

## Evidence

### 1. Ordering scramble (root cause)

TypeORM 0.4.0-alpha.1 `MigrationExecutor.js`:

```js
const migrationTimestamp = parseInt(migrationClassName.substr(-13), 10);
```

Computed order vs intended (filename) order — **48/50 misordered**:

- `UnifiedPersonModel20260720000001` → last 13 = `260720000001` → runs at position **6**
- `ZAddIntakeFields2026071400003` → last 13 = `2026071400003` → runs at position **40**
- AddIntakeFields (Jul 14, creates `beneficiaries.place_of_birth` etc.) hence runs
  **after** UnifiedPersonModel (Jul 20), whose guarded `INSERT INTO persons SELECT
  ... place_of_birth ... FROM beneficiaries` therefore hits `42703`.

The 14-digit-suffix classes collapse into the `2607…`–`2608…` range (dropping the
leading `2`), while 13-digit-suffix classes keep their `2026…`/`174…`/`178…` keys,
splitting the chain into blocks that execute far outside their intended date order.

### 2. Intended-order replay succeeds

Custom sequential runner (fresh `public` schema, per-migration transactions, driven
by **filename numeric** order — the author-intended order):

- Positions 1–44 **OK** (including the previously-documented "break" at #22
  UnifiedPersonModel).
- Position 45 `DropPersonLegacyColumns` **FAIL**: `cannot drop column address of
  table persons because other objects depend on it`. Dependents =
  `idx_persons_address` (index on persons.address) + `idx_persons_email`
  (targets persons.email for the email drop) + RLS policies
  `ben_barangay_scope` / `cases_barangay_scope` (created by UnifiedPersonModel,
  quals reference `persons.address`) + `rls_barangay_persons_select`.

### 3. Full fix proven end-to-end (REAL typeorm CLI)

Applied to an isolated copy:

1. **Renamed all 50 migration classes** (and files) to sequential zero-padded
   13-digit keys preserving intended order: `…0000000000001` … `…0000000000050`
   (e.g. `UnifiedPersonModel20260720000001` → `UnifiedPersonModel0000000000022`).
2. **Patched `DropPersonLegacyColumns.up`**: dropped the RLS policies
   `ben_barangay_scope` / `cases_barangay_scope` **before** the
   `ALTER TABLE persons DROP COLUMN address` (the migration already re-creates
   them after, scoped to `person_addresses`).

Then ran the actual `typeorm-ts-node-commonjs migration:run -d <temp-ds>` against a
fresh DB loading the renamed set:

- **All 50 migrations executed successfully**, in exact intended order (verified
  via `migrations` table: `AaUuidV7Function0000000000001` → `AgencyProgramDrop0000000000050`).
- End state: 43 tables in `public` + sequences/extensions — healthy schema.

## Design constraints & compatibility

- `data-source.ts` loads migrations by **glob** (`migrations/*{.ts,.js}`); typeorm
  uses the **class name** (not filename) for both ordering and the `migrations`
  table identity.
- `migrate.ts` (canonical fresh-boot path, run from `main.ts` at startup) inserts
  each migration's **runtime class name** `m.name` into `migrations` using
  `INSERT ... WHERE NOT EXISTS` — so renaming classes is transparent to fresh boots.
- Prod DB bootstrap is `migrate.ts` (marks applied dynamically); `migration:run`
  (dev) and `migration:run:prod` (`run-migrations.ts`) are the TypeORM-chain paths.
- **Compatibility watch:** on an EXISTING DB previously bootstrapped by `migrate.ts`
  (or an older chain run), the `migrations` table already records the OLD class
  names. Renaming classes would make TypeORM see them as **new/unapplied**, so a
  fresh `migration:run` would attempt to re-run all 50 against a schema that
  already has the shapes → high risk. Because prod runs `migrate.ts` (which uses
  `WHERE NOT EXISTS` and would record new names if old ones mismatch), the chain
  re-run on existing DBs must be treated as unsupported — OR the fix must keep old
  names as aliases. This is the key plan decision (see PLAN).

## Recommended approach

1. Rename migration files + classes to sequential 13-digit keys (intended order).
2. Fix `DropPersonLegacyColumns.up` policy-drop ordering (and audit the remaining
   dependent-object drops similarly).
3. Make fresh-DB `migration:run` the canonical verification (add a CI-safe scratch
   check); keep `migrate.ts` as the prod bootstrap.
4. Decide & document the existing-DB migration-table compatibility contract
   (options: unsupported, migration-rebuild, or alias-name reconciliation).

## Environment notes

- Disposable Postgres: `/tmp/opencode/kapwa-pg` (port 5433, user/db `kapwa`, trust),
  PG18. `uuid-ossp` does NOT provide `uuid_generate_v7()`; the chain's migration
  #1 defines a plpgsql shim.
- Replay command: `DB_PORT=5433 DB_HOST=/tmp/opencode/kapwa-pg npx
  typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`.