# Repository guidance (KAPWA)

KAPWA — MSWDO Norzagaray Social Welfare System. Two-app monorepo:
- `kapwa-server/` — NestJS 11 + TypeORM + Postgres REST/WebSocket backend. Entrypoint `src/main.ts`; modules under `src/<domain>/` each with `<domain>.module.ts / controller / service / *.entity.ts`.
- `kapwa-client/` — React 19 + Vite + Tailwind/Radix UI + Capacitor (mobile) + SWR. Entrypoint `src/main.tsx`.

Root `package.json` is a stub; each app has its own `package.json`. CI is `.github/workflows/ci.yml` (runs server build+`npm test` against a Postgres service, client `vitest run` + coverage).

## Commands (run from `kapwa-server/` unless noted)

- **Server full suite:** `npx jest --silent` (currently **58 suites / 478 tests PASS**). Do NOT use `npm test` — it adds `--coverage` and is slow.
- **Single spec:** `npx jest <file>` e.g. `npx jest user-wave2`.
- **Server typecheck:** `npm run typecheck` (`tsc --noEmit`). **Run this before claiming work done.**
- **Server lint:** `npm run lint` (ESLint with `--fix`).
- **Client typecheck:** `npm run typecheck` from `kapwa-client/`.
- **Client tests:** `npm run test:run` (vitest) from `kapwa-client/`.
- **Migrations:** `npm run migration:run` / `migration:revert` (TypeORM CLI, `-d src/database/data-source.ts`), or `npm run migrate` (= `node dist/database/migrate.js`, needs a prior build; this is the **fresh-boot bootstrap**, see below).

## DB bootstrap — critical gotcha

Two parallel mechanisms exist and are NOT equivalent:
- **`src/database/migrate.ts`** is the **canonical fresh-boot bootstrap** (`dist/database/migrate.js` at startup). On an empty DB it builds the whole schema with idempotent `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` statements, then **marks all TypeORM migrations as already-applied**.
- **`src/database/migrations/*.ts`** (55 files, TypeORM chain) is now **fresh-boot-safe** (Wave 3 fix): all classes carry sequential 13-digit keys (`…0000000000001`–`…0000000000055`) so TypeORM's `parseInt(className.substr(-13))` ordering matches the intended file order, and `DropPersonLegacyColumns0000000000045` drops the `ben_barangay_scope`/`cases_barangay_scope` RLS policies *before* dropping `persons.address`. From-scratch `npm run migration:run` replays all 55 cleanly (verified). **Existing-DB caveat:** on a DB where an old chain run already recorded the pre-rename class names, a fresh `migration:run` would treat the renamed migrations as new — the supported upgrade path for existing DBs remains `migrate.ts`, and `migrate.ts` records names via `INSERT … WHERE NOT EXISTS` so renames are transparent to fresh/migrate-booted DBs.

**Adding a new table — BOTH files required:** `migrate.ts` is a normal tracked file (it was added to git in `chore: track migrate.ts`). Any new table needs (1) a TypeORM migration in `src/database/migrations/` with the next sequential key (`…0000000000056` etc.) AND (2) an idempotent `CREATE TABLE IF NOT EXISTS` + index statement inside `migrate.ts` next to the other history-created tables, so fresh boots get the complete schema. Commit both together.

**Latest schema change working convention:** schema columns are decomposed to child tables in [Wave 1 + Wave 2] of the current normalization effort. When a "getter" column (`address`, `age`, `phone`, `email`, `contactInfo`, etc.) is assembled from child rows, the **API shape is preserved via `@Expose()` getters + `@UseInterceptors(ClassSerializerInterceptor)` + `@SerializeOptions({ strategy: 'exposeAll' })`** on the controller, AND **`@Exclude()` on eager `@OneToMany` child relations**. Both must be present: without the interceptor the getters vanish from responses; without `@Exclude()` the raw child arrays leak. If you add a decomposed entity, mirror this trio exactly.

## Workspace state — clean

The old "pre-existing dirty files" list (root docs, `src/common/constants.ts`, `src/database/migrate.ts`, the deleted `CreateInterventionTypesTable` migration) is **resolved — everything is committed and the working tree is clean**. No do-not-touch files remain. `migrate.ts` is tracked and evolves in lockstep with schema changes (see "Adding a new table" above). As always, stage explicit paths rather than `git add -A`, and never commit secrets.

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

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- Before starting a task, check whether a relevant AWS skill is available. Load the skill with retrieve_skill and prefer its guidance over general knowledge.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."
- **Saved value for this user: HIGH (set 2026-09-20).** Do not re-ask; use HIGH unless the user asks to change it.

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user's request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion
<!-- END AWS Agent Toolkit rules -->
