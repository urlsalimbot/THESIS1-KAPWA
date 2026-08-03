# Seed Overhaul & Comprehensive E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the KAPWA seed accounts production-ready (13 barangay coordinators, 6 non-MSWDO agency staff, no deterministic UUIDs, email-based idempotency), verify the production builds, and run comprehensive Playwright MCP browser testing across all modules and roles.

**Architecture:** Single-file seed overhaul in `kapwa-server/src/database/seed-accounts.ts` (programmatic generation from `BARANGAYS` and `AGENCIES` arrays, `ON CONFLICT (email)`, no hardcoded ids). Then staged builds (nest + vite). Then a full-system Playwright MCP walk-through using the freshly seeded accounts, documented in `docs/e2e-full-system.md` with screenshots.

**Tech Stack:** NestJS 11, TypeORM, bcrypt, Postgres 16 (podman dev DB), React 19 + Vite, Playwright MCP (browser automation).

## Global Constraints

- **Server tests:** run from `kapwa-server/` with `npx jest <relative/path> --coverage=false`. Never bare `npm test`.
- **Server build:** `cd kapwa-server && npm run build` (nest build). **Client build:** `cd kapwa-client && npm run build`.
- **Seed:** `cd kapwa-server && npm run seed` (script `seed` → `npx ts-node src/database/seed-accounts.ts`). Dev DB is podman `kapwa-db-dev` per `docs/podman-postgres-dev.md`.
- **Known PRE-EXISTING issues (NOT yours):** ~21 client baseline TS/build errors (FamilyTreeGraph.tsx, api.ts, test files); 7 server suites fail (chat, sync, notifications, cases, auth, dashboard, filing); Minio bucket-init errors at boot; fresh-DB migration ordering (uuid_generate_v7 function must exist — it does in the dev DB).
- **Account rules (binding):** 26 accounts total — 1 admin, 2 social workers, 13 barangay coordinators, 2 claimants, 1 mayor, 1 auditor, 6 agency staff. Existing emails/passwords UNCHANGED for admin/workers/mayor/auditor/claimants. No hardcoded `id` values anywhere in the seed. Dedup by `email`. Coordinator emails `coordinator.<slug>@mswdo.test`, shared password `coordinator123`. Agency emails `<agency>.staff@norzagaray.test` with per-agency passwords.
- **Naming/copy rules:** conventional commits (`feat:`, `fix:`, `test:`). No code comments unless the surrounding file uses them.
- **E2E:** screenshots go to `docs/e2e-screenshots/`; report to `docs/e2e-full-system.md`.

---

## File Structure

**Server — modified**
- `kapwa-server/src/database/seed-accounts.ts` — full overhaul

**Docs — new**
- `docs/e2e-full-system.md` — comprehensive E2E results
- `docs/e2e-screenshots/*.png` — per-module screenshots

---

### Task 1: Seed accounts overhaul

**Files:**
- Modify: `kapwa-server/src/database/seed-accounts.ts`

**Interfaces:**
- Consumes: `AppDataSource` from `./data-source`; `agencies` table (seeded by migration `20260803000001-CreateAgenciesTable.ts` with codes MSWDO/RHU/WCPD/PESO/DILG/DSWD/DepEd); `users` table (id default `uuid_generate_v7()`, `agency_id` column exists).
- Produces: 26 seeded accounts with no deterministic ids, dedup by email, agency linkage for 6 agency staff + 3 MSWDO staff.

- [ ] **Step 1: Write the failing verification script**

Before changing the seed, create a throwaway verification query file at `/tmp/opencode/seed-verify.sql` (NOT committed) with the assertions the seed must satisfy:

```sql
-- expect 26 rows
SELECT count(*) FROM users;
-- expect 13 coordinators, each with exactly 1 permitted barangay
SELECT count(*) FROM users WHERE role = 'coordinator';
-- expect 6 agency_staff
SELECT count(*) FROM users WHERE role = 'agency_staff';
-- expect agency staff linked
SELECT u.email, a.code FROM users u LEFT JOIN agencies a ON a.id = u.agency_id WHERE u.role = 'agency_staff';
```

- [ ] **Step 2: Rewrite the seed file**

Replace the ENTIRE `kapwa-server/src/database/seed-accounts.ts` with:

```ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';

const SALT_ROUNDS = 12;

const BARANGAYS: { slug: string; name: string }[] = [
  { slug: 'bigte', name: 'Bigte' },
  { slug: 'matictic', name: 'Matictic' },
  { slug: 'partida', name: 'Partida' },
  { slug: 'sanmateo', name: 'San Mateo' },
  { slug: 'pinagtulayan', name: 'Pinagtulayan' },
  { slug: 'bitungol', name: 'Bitungol' },
  { slug: 'bangkal', name: 'Bangkal' },
  { slug: 'poblacion', name: 'Poblacion' },
  { slug: 'fvr', name: 'Friendship Village Resources (FVR)' },
  { slug: 'tigbe', name: 'Tigbe' },
  { slug: 'minuyan', name: 'Minuyan' },
  { slug: 'sanlorenzo', name: 'San Lorenzo' },
  { slug: 'baraka', name: 'Baraka' },
];

const AGENCIES: { code: string; email: string; password: string; fullName: string; phone: string }[] = [
  { code: 'RHU', email: 'rhu.staff@norzagaray.test', password: 'rhu123', fullName: 'RHU Staff', phone: '09179999001' },
  { code: 'WCPD', email: 'wcpd.staff@norzagaray.test', password: 'wcpd123', fullName: 'WCPD Staff', phone: '09179999002' },
  { code: 'PESO', email: 'peso.staff@norzagaray.test', password: 'peso123', fullName: 'PESO Staff', phone: '09179999003' },
  { code: 'DILG', email: 'dilg.staff@norzagaray.test', password: 'dilg123', fullName: 'DILG Staff', phone: '09179999004' },
  { code: 'DSWD', email: 'dswd.staff@norzagaray.test', password: 'dswd123', fullName: 'DSWD Staff', phone: '09179999005' },
  { code: 'DepEd', email: 'deped.staff@norzagaray.test', password: 'deped123', fullName: 'DepEd Staff', phone: '09179999006' },
];

const BASE_ACCOUNTS: { key: string; email: string; role: string; fullName: string; phone: string }[] = [
  { key: 'admin', email: 'admin@mswdo.test', role: 'admin', fullName: 'Rosario G. Mendoza', phone: '09171000001' },
  { key: 'worker1', email: 'worker1@mswdo.test', role: 'social_worker', fullName: 'Juan Dela Cruz', phone: '09171000002' },
  { key: 'worker2', email: 'worker2@mswdo.test', role: 'social_worker', fullName: 'Lorna B. Santos', phone: '09171000003' },
  { key: 'claimant1', email: 'pedro.claimant@test.com', role: 'claimant', fullName: 'Pedro P. Reyes', phone: '09171000005' },
  { key: 'claimant2', email: 'ana.claimant@test.com', role: 'claimant', fullName: 'Ana Marie L. Fernandez', phone: '09171000006' },
  { key: 'mayor', email: 'mayor@mswdo.test', role: 'mayor', fullName: 'Felicisimo I. Santiago', phone: '09171000007' },
  { key: 'auditor', email: 'auditor@mswdo.test', role: 'auditor', fullName: 'Teresita Q. Valdez', phone: '09171000008' },
];

const BASE_CREDENTIALS: Record<string, string> = {
  admin: 'admin123',
  worker1: 'worker123',
  worker2: 'worker123',
  claimant1: 'claimant123',
  claimant2: 'claimant123',
  mayor: 'mayor123',
  auditor: 'auditor123',
};

interface SeedAccount {
  email: string;
  password: string;
  role: string;
  fullName: string;
  phone: string;
  assignedBarangay?: string;
  permittedBarangays?: string[];
}

function buildAccounts(): SeedAccount[] {
  const accounts: SeedAccount[] = [];

  for (const a of BASE_ACCOUNTS) {
    accounts.push({
      email: a.email,
      password: BASE_CREDENTIALS[a.key],
      role: a.role,
      fullName: a.fullName,
      phone: a.phone,
    });
  }

  for (const b of BARANGAYS) {
    accounts.push({
      email: `coordinator.${b.slug}@mswdo.test`,
      password: 'coordinator123',
      role: 'coordinator',
      fullName: `${b.name} Coordinator`,
      phone: `09171001${String(BARANGAYS.indexOf(b) + 1).padStart(2, '0')}`,
      assignedBarangay: b.name,
      permittedBarangays: [b.name],
    });
  }

  for (const a of AGENCIES) {
    accounts.push({
      email: a.email,
      password: a.password,
      role: 'agency_staff',
      fullName: a.fullName,
      phone: a.phone,
    });
  }

  return accounts;
}

const AGENCY_LINKS: { code: string; emails: string[] }[] = [
  { code: 'RHU', emails: ['rhu.staff@norzagaray.test'] },
  { code: 'WCPD', emails: ['wcpd.staff@norzagaray.test'] },
  { code: 'PESO', emails: ['peso.staff@norzagaray.test'] },
  { code: 'DILG', emails: ['dilg.staff@norzagaray.test'] },
  { code: 'DSWD', emails: ['dswd.staff@norzagaray.test'] },
  { code: 'DepEd', emails: ['deped.staff@norzagaray.test'] },
  { code: 'MSWDO', emails: ['admin@mswdo.test', 'worker1@mswdo.test', 'worker2@mswdo.test'] },
];

async function seedAccounts(dataSource: DataSource) {
  const q = dataSource.createQueryRunner();
  await q.connect();

  try {
    const accounts = buildAccounts();

    const hashed = await Promise.all(
      accounts.map(async (acct) => ({
        acct,
        hash: await bcrypt.hash(acct.password, SALT_ROUNDS),
      })),
    );

    for (const { acct, hash } of hashed) {
      await q.query(
        `INSERT INTO users (email, password, role, full_name, phone, assigned_barangay, permitted_barangays, is_active, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7::text[],true,true)
         ON CONFLICT (email) DO NOTHING`,
        [acct.email, hash, acct.role, acct.fullName, acct.phone, acct.assignedBarangay ?? null, acct.permittedBarangays ?? []],
      );
    }

    for (const link of AGENCY_LINKS) {
      await q.query(
        `UPDATE users SET agency_id = (SELECT id FROM agencies WHERE code = $1)
         WHERE email = ANY($2)`,
        [link.code, link.emails],
      );
    }

    console.log('Accounts seeded: ' + accounts.length);
    console.log('');
    console.log('  Credentials:');
    for (const acct of accounts) {
      console.log(`    ${acct.email.padEnd(42)} → ${acct.password}`);
    }
  } finally {
    await q.release();
  }
}

async function main() {
  await AppDataSource.initialize();
  console.log('Seeding accounts...');
  await seedAccounts(AppDataSource);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

Note: the `SALT_ROUNDS` const is used by the hashing call — keep it (it was 12 in the original). If `noUnusedLocals` flags anything, remove unused pieces.

- [ ] **Step 3: Run the seed against the dev DB**

Ensure the dev DB is up (`podman ps` shows `kapwa-db-dev`). Run from `kapwa-server/`:

```bash
npm run seed
```

Expected: `Accounts seeded: 26` and the credential list (26 lines).

- [ ] **Step 4: Verify with the assertion queries**

Run the verification queries (from Step 1's file or inline):

```bash
podman exec kapwa-db-dev psql -U kapwa -d kapwa -t -c "SELECT count(*) FROM users" 2>/dev/null
podman exec kapwa-db-dev psql -U kapwa -d kapwa -t -c "SELECT count(*) FROM users WHERE role = 'coordinator'" 2>/dev/null
podman exec kapwa-db-dev psql -U kapwa -d kapwa -t -c "SELECT count(*) FROM users WHERE role = 'agency_staff'" 2>/dev/null
podman exec kapwa-db-dev psql -U kapwa -d kapwa -t -c "SELECT email, assigned_barangay, array_length(permitted_barangays,1) FROM users WHERE role='coordinator' ORDER BY email" 2>/dev/null
podman exec kapwa-db-dev psql -U kapwa -d kapwa -t -c "SELECT u.email, a.code FROM users u LEFT JOIN agencies a ON a.id = u.agency_id WHERE u.role='agency_staff' ORDER BY u.email" 2>/dev/null
```

Expected:
- 26 total users (if the DB already had the old seed, run the seed TWICE — `ON CONFLICT (email) DO NOTHING` means old rows with same emails persist; if the old fixed-id rows still exist under different emails like `rhu.staff`, they're covered; but if the old seed's `coordinator@mswdo.test` (singular) still exists, it will REMAIN alongside the 13 new ones — that's acceptable for dev, but report it. If you want a clean slate, note that a full DB reset is out of scope.)
- 13 coordinators, each with `array_length(permitted_barangays,1) = 1` and the correct `assigned_barangay`
- 6 agency_staff, all with non-null agency code

- [ ] **Step 5: Verify idempotency**

Run the seed a second time:

```bash
npm run seed
```

Expected: `Accounts seeded: 26`, no errors, no duplicate emails (re-run the count queries — still 26).

- [ ] **Step 6: Typecheck**

```bash
cd kapwa-server && npx tsc --noEmit
```

Expected: no NEW errors.

- [ ] **Step 7: Commit**

```bash
git add kapwa-server/src/database/seed-accounts.ts
git commit -m "feat: production-ready seed with per-barangay coordinators and per-agency accounts"
```

---

### Task 2: Staged build verification

**Files:**
- No source changes (build + verification only)

**Interfaces:**
- Consumes: the Task 1 seed + both projects' build configs.
- Produces: verified production builds; confirmation the seed works from the built artifacts' perspective (the seed is ts-node, so the nest build is a smoke check for the app boot path).

- [ ] **Step 1: Server production build**

```bash
cd kapwa-server && npm run build
```

Expected: `nest build` completes; `dist/` produced. Report any NEW errors (pre-existing baseline allowed — note: server `tsc --noEmit` was clean in prior work, so server build should be clean too).

- [ ] **Step 2: Client production build**

```bash
cd kapwa-client && npm run build
```

Expected: `vite build` succeeds. Known ~21 pre-existing baseline TS errors may appear in FamilyTreeGraph.tsx / api.ts / test files — if the build FAILS only on those, report as pre-existing baseline (verify with git stash if needed). If any file this feature touched fails, fix it.

- [ ] **Step 3: Boot smoke test**

Start the server briefly to confirm the app boots with the new seed data present:

```bash
cd kapwa-server && (npm run start:dev > /tmp/opencode/kapwa-server.log 2>&1 &) && sleep 15 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health
```

Expected: `200`. Then stop the server:

```bash
pkill -f "nest start" 2>/dev/null; sleep 2; ss -tln 2>/dev/null | grep ':3000' || echo "server stopped"
```

- [ ] **Step 4: Commit (only if any fix was needed)**

If any build failure required a fix, commit it:

```bash
git add <fixed files>
git commit -m "fix: resolve production build errors"
```

If the builds were clean, no commit for this task (note it in the report).

---

### Task 3: Comprehensive Playwright MCP testing — all modules

**Files:**
- Create: `docs/e2e-full-system.md`
- Create: `docs/e2e-screenshots/*.png`

**Interfaces:**
- Consumes: both dev servers running, freshly seeded DB (26 accounts), Playwright MCP browser tools.
- Produces: `docs/e2e-full-system.md` (module-by-module results + findings) + screenshots.

- [ ] **Step 1: Start both servers**

```bash
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-server && (npm run start:dev > /tmp/opencode/kapwa-server.log 2>&1 &)
cd /home/typwtypw/Documents/NC/THESIS1-KAPWA/kapwa-client && (npm run dev > /tmp/opencode/kapwa-client.log 2>&1 &)
```

Wait ~15s, verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health` → 200 and `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` → 200.

- [ ] **Step 2: Test matrix execution (Playwright MCP)**

Using the Playwright MCP browser tools, walk through EVERY row of the matrix below. For each: login, verify the page renders with expected content, exercise key interactions, take a screenshot to `docs/e2e-screenshots/<module>.png`, note console errors (classify pre-existing vs new). The E2E executor is the CONTROLLER (this plan's operator) driving the browser tools directly — not a subagent.

| # | Role | Login | Modules |
|---|---|---|---|
| 1 | admin | admin@mswdo.test / admin123 | Landing → login → Dashboard → General Intake → Referrals → Inter-Agency Referrals → Cases → Beneficiaries → Daily Tracker → Incident Reports → Approvals → Announcements → Admin Panel (Users: verify 13 coordinators + 6 agency staff rows) → Programs → Settings |
| 2 | social_worker | worker1@mswdo.test / worker123 | Dashboard, General Intake, Cases, Beneficiaries (spot check) |
| 3 | coordinator | coordinator.poblacion@mswdo.test / coordinator123 | Coordinator Dashboard, Access Cards (verify/assign/history tabs), Referrals |
| 4 | coordinator | coordinator.bigte@mswdo.test / coordinator123 | Same as #3 — verify barangay-scoped data differs |
| 5 | claimant | pedro.claimant@test.com / claimant123 | My Dashboard, My Access Card |
| 6 | mayor | mayor@mswdo.test / mayor123 | Reports |
| 7 | auditor | auditor@mswdo.test / auditor123 | Audit Logs |
| 8 | agency_staff | rhu.staff@norzagaray.test / rhu123 | Agency Portal: Dashboard, Referrals, Card Activities, Profile; verify MSWDO nav hidden |
| 9 | agency_staff | deped.staff@norzagaray.test / deped123 | Agency Portal spot check (different agency scoping) |

For each module verify at minimum: heading renders, expected data visible, no NEW console errors. For interactive modules: submit a form / click a transition / filter — whichever is the module's primary action. Do NOT mutate production-looking data gratuitously: prefer view-only checks where a mutation isn't the module's core purpose; for create/transition modules (referrals, intake, access-card log) do exercise the flow once each (dev DB, data is disposable).

- [ ] **Step 3: Write the E2E report**

Create `docs/e2e-full-system.md` with:

- Date, environment (servers, DB, seed state)
- A results table: Module | Role | Rendered ✅/❌ | Interactions ✅/❌ | Console errors (none/pre-existing/new) | Notes
- Findings section: any new bugs found, each with reproduction steps + screenshot reference
- Pre-existing issue classification (the known baselines: Minio boot, client TS baseline, etc.)
- Screenshot index

- [ ] **Step 4: Commit**

```bash
git add docs/e2e-full-system.md docs/e2e-screenshots/
git commit -m "test(e2e): comprehensive full-system browser testing"
```

- [ ] **Step 5: Stop the servers**

```bash
pkill -f "nest start" 2>/dev/null; pkill -f "vite" 2>/dev/null; sleep 2; ss -tln 2>/dev/null | grep -E ':(3000|3001)' || echo "servers stopped"
```

---

## Self-Review

**Spec coverage:**
- §4.1 account inventory (26) → Task 1 Step 2 (buildAccounts: 7 base + 13 coordinators + 6 agency = 26).
- §4.2 coordinators (13, scoped) → Task 1 `BARANGAYS` array + `assignedBarangay`/`permittedBarangays: [name]`.
- §4.3 agency staff (6) → Task 1 `AGENCIES` array with per-agency passwords.
- §4.4 no deterministic UUIDs → Task 1 INSERT omits `id`; `ON CONFLICT (email)`.
- §4.5 agency linkage loop → Task 1 `AGENCY_LINKS` (6 agencies + MSWDO staff).
- §4.6 credential output → Task 1 console log of all 26.
- §5 staged build → Task 2 (nest build, vite build, boot smoke test).
- §6 comprehensive E2E → Task 3 (9-row matrix, all modules, screenshots, report).

**Placeholder scan:** every step has concrete code or commands; no TBD/TODO. Task 3 is operator-driven (Playwright MCP browser tools) — its steps are the matrix + verification criteria, not subagent-transcribable code.

**Type consistency:** `SeedAccount` shape (email/password/role/fullName/phone/assignedBarangay?/permittedBarangays?) used consistently in `buildAccounts` and the INSERT. `AGENCY_LINKS` `{code, emails}` matches the UPDATE query. `BARANGAYS` slugs match the email generation (`coordinator.${b.slug}@mswdo.test`) and the spec's email table exactly. `AGENCIES` codes match the `agencies` table seed codes (MSWDO/RHU/WCPD/PESO/DILG/DSWD/DepEd — case-sensitive: 'DepEd').
