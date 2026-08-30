# Repository guidance (KAPWA)

KAPWA — MSWDO Norzagaray Social Welfare System. Two-app monorepo:
- `kapwa-server/` — NestJS 11 + TypeORM + Postgres REST/WebSocket backend. Entrypoint `src/main.ts`; modules under `src/<domain>/` each with `<domain>.module.ts / controller / service / *.entity.ts`.
- `kapwa-client/` — React 19 + Vite + Tailwind/Radix UI + Capacitor (mobile) + SWR. Entrypoint `src/main.tsx`.

Root `package.json` is a stub; each app has its own `package.json`. CI is `.github/workflows/ci.yml` (runs server build+`npm test` against a Postgres service, client `vitest run` + coverage).

## Commands (run from `kapwa-server/` unless noted)

- **Server full suite:** `npx jest --silent` (currently **51 suites / 411 tests PASS**). Do NOT use `npm test` — it adds `--coverage` and is slow.
- **Single spec:** `npx jest <file>` e.g. `npx jest user-wave2`.
- **Server typecheck:** `npm run typecheck` (`tsc --noEmit`). **Run this before claiming work done.**
- **Server lint:** `npm run lint` (ESLint with `--fix`).
- **Client typecheck:** `npm run typecheck` from `kapwa-client/`.
- **Client tests:** `npm run test:run` (vitest) from `kapwa-client/`.
- **Migrations:** `npm run migration:run` / `migration:revert` (TypeORM CLI, `-d src/database/data-source.ts`), or `npm run migrate` (= `node dist/database/migrate.js`, needs a prior build; this is the **fresh-boot bootstrap**, see below).

## DB bootstrap — critical gotcha

Two parallel mechanisms exist and are NOT equivalent:
- **`src/database/migrate.ts`** is the **canonical fresh-boot bootstrap** (`dist/database/migrate.js` at startup). On an empty DB it builds the whole schema with idempotent `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` statements, then **marks all TypeORM migrations as already-applied**.
- **`src/database/migrations/*.ts`** (50 files, TypeORM chain) is now **fresh-boot-safe** (Wave 3 fix): all classes carry sequential 13-digit keys (`…0000000000001`–`…0000000000050`) so TypeORM's `parseInt(className.substr(-13))` ordering matches the intended file order, and `DropPersonLegacyColumns0000000000045` drops the `ben_barangay_scope`/`cases_barangay_scope` RLS policies *before* dropping `persons.address`. From-scratch `npm run migration:run` replays all 50 cleanly (verified). **Existing-DB caveat:** on a DB where an old chain run already recorded the pre-rename class names, a fresh `migration:run` would treat the renamed migrations as new — the supported upgrade path for existing DBs remains `migrate.ts`, and `migrate.ts` records names via `INSERT … WHERE NOT EXISTS` so renames are transparent to fresh/migrate-booted DBs.

**Latest schema change working convention:** schema columns are decomposed to child tables in [Wave 1 + Wave 2] of the current normalization effort. When a "getter" column (`address`, `age`, `phone`, `email`, `contactInfo`, etc.) is assembled from child rows, the **API shape is preserved via `@Expose()` getters + `@UseInterceptors(ClassSerializerInterceptor)` + `@SerializeOptions({ strategy: 'exposeAll' })`** on the controller, AND **`@Exclude()` on eager `@OneToMany` child relations**. Both must be present: without the interceptor the getters vanish from responses; without `@Exclude()` the raw child arrays leak. If you add a decomposed entity, mirror this trio exactly.

## Workspace state — do NOT touch these

The following are **uncommitted, pre-existing dirty files**. Never stage or commit them (do not use `git add -A`; stage explicit paths only):
- Root docs: `DB-SCHEMA.md`, `EVALUATION.MD`, `SPEC-GAP.md`, `docs/diagrams/06-erd.md`, `docs/diagrams/07-data-dictionary.md`, `docs/inter-agency-beneficiary-tracking.md`, `docs/superpowers/plans/2026-08-05-system-diagrams-docs.md`
- `kapwa-server/src/common/constants.ts`, `kapwa-server/src/database/migrate.ts`
- Deleted: `kapwa-server/src/database/migrations/20260712000001-CreateInterventionTypesTable.ts`

Branch is `main`. Commit style: conventional commits, e.g. `feat(schema): wave2 ...`, `fix(schema): ...`.

## GSD planning (schema-normalization workflow)

`.planning/` and `.superpowers/` hold the GSD planning artifacts (gitignored, on disk). The active effort is the schema normalization to 3NF:
- Specs under `docs/superpowers/specs/` (e.g. `2026-08-29-schema-normalization-3nf-wave2-design.md`) — the design source of truth.
- Ledger/log of every task + review fix under `.superpowers/sdd/progress.md` (search it before asking "what did we do so far?").
- Wave 2 is **closed out** at commit `966026e`. Next work is **Wave 3** (use `/gsd-plan-phase` or the gsd-plan-phase skill to plan it).

If you touch a Wave 1/2 migration use the disposable Postgres pattern: `pg_ctl -D /tmp/opencode/kapwa-pg/data` (port 5433, user/db `kapwa`, trust auth) — spin up, validate SQL in isolation, stop it. (`uuid_generate_v7()` is NOT provided by `uuid-ossp` on PG18 — use explicit UUIDs in test SQL.)

---

# context-mode — MANDATORY routing rules

context-mode MCP tools available. Rules protect context window from flooding. One unrouted command dumps 56 KB into context.

## Think in Code — MANDATORY

Analyze/count/filter/compare/search/parse/transform data: **write code** via `context-mode_ctx_execute(language, code)`, `console.log()` only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. Pure JavaScript — Node.js built-ins only (`fs`, `path`, `child_process`). `try/catch`, handle `null`/`undefined`. One script replaces ten tool calls.

## BLOCKED — do NOT attempt

### curl / wget — BLOCKED
Shell `curl`/`wget` intercepted and blocked. Do NOT retry.
Use: `context-mode_ctx_fetch_and_index(url, source)` or `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")`

### Inline HTTP — BLOCKED
`fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, `http.request(` — intercepted. Do NOT retry.
Use: `context-mode_ctx_execute(language, code)` — only stdout enters context

### Direct web fetching — BLOCKED
Use: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)`

## REDIRECTED — use sandbox

### Shell (>20 lines output)
Shell ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`.
Otherwise: `context-mode_ctx_batch_execute(commands, queries)` or `context-mode_ctx_execute(language: "shell", code: "...")`

### File reading (for analysis)
Reading to **edit** → reading correct. Reading to **analyze/explore/summarize** → `context-mode_ctx_execute_file(path, language, code)`.

### grep / search (large results)
Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` in sandbox.

## Tool selection

0. **MEMORY**: `context-mode_ctx_search(sort: "timeline")` — after resume, check prior context before asking user.
1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — runs all commands, auto-indexes, returns search. ONE call replaces 30+. Each command: `{label: "header", command: "..."}`.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — all questions as array, ONE call (default relevance mode).
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — sandbox, only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — store in FTS5 for later search.

## Parallel I/O batches

For multi-URL fetches or multi-API calls, **always** include `concurrency: N` (1-8):

- `context-mode_ctx_batch_execute(commands: [3+ network commands], concurrency: 5)` — gh, curl, dig, docker inspect, multi-region cloud queries
- `context-mode_ctx_fetch_and_index(requests: [{url, source}, ...], concurrency: 5)` — multi-URL batch fetch

**Use concurrency 4-8** for I/O-bound work (network calls, API queries). **Keep concurrency 1** for CPU-bound (npm test, build, lint) or commands sharing state (ports, lock files, same-repo writes).

GitHub API rate-limit: cap at 4 for `gh` calls.

## Output

Write artifacts to FILES — never inline. Return: file path + 1-line description.
Descriptive source labels for `search(source: "label")`.

## Session Continuity

Skills, roles, and decisions persist for the entire session. Do not abandon them as the conversation grows.

## Memory

Session history is persistent and searchable. On resume, search BEFORE asking the user:

| Need | Command |
|------|---------|
| What did we decide? | `context-mode_ctx_search(queries: ["decision"], source: "decision", sort: "timeline")` |
| What constraints exist? | `context-mode_ctx_search(queries: ["constraint"], source: "constraint")` |

DO NOT ask "what were we working on?" — SEARCH FIRST.
If search returns 0 results, proceed as a fresh session.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call `stats` MCP tool, display full output verbatim |
| `ctx doctor` | Call `doctor` MCP tool, run returned shell command, display as checklist |
| `ctx upgrade` | Call `upgrade` MCP tool, run returned shell command, display as checklist |
| `ctx purge` | Call `purge` MCP tool with confirm: true. Warns before wiping knowledge base. |

After /clear or /compact: knowledge base and session stats preserved. Use `ctx purge` to start fresh.
