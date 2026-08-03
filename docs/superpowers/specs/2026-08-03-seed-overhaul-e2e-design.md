# Seed Overhaul & Comprehensive E2E Design

> **Status:** Approved (design reviewed by user)
> **Date:** 2026-08-03
> **Feature:** Production-ready seeding (barangay coordinators + per-agency accounts, no deterministic UUIDs) + staged build verification + comprehensive Playwright MCP testing across all modules.

## 1. Problem Statement

The seed accounts are not production-ready and the app lacks comprehensive E2E coverage:

- **Single barangay coordinator** covers all 13 barangays — the app's model is one coordinator per barangay (permitted_barangays scoping), but the seed doesn't reflect it.
- **Only one agency account** (`rhu_staff`) exists for inter-agency portals; the other 5 non-MSWDO agencies have no login.
- **Deterministic UUIDs** (`10000000-0000-0000-0000-000000000001` etc.) are hardcoded in the seed, and dedup is `ON CONFLICT (id)` — non-production patterns (predictable ids, id-dependent idempotency).
- **No comprehensive E2E** has been run across ALL modules (prior E2E covered only the inter-agency feature).

## 2. Goals

1. Seed 13 barangay coordinators (one per barangay, scoped).
2. Seed 6 non-MSWDO agency_staff accounts (one per agency, agency-linked).
3. Remove all deterministic UUIDs; dedup by email; keep the seed idempotent.
4. Verify the production build (server nest build + client vite build) and run the seed against the dev DB.
5. Run comprehensive Playwright MCP browser testing across every module and role, documented with findings.

## 3. Non-Goals

- No MSWDO agency_staff account (MSWDO uses admin/social_worker roles).
- No migration changes (seeding is a script, not a migration).
- No changes to existing account emails/passwords (admin, workers, mayor, auditor, claimants).
- No new client/server feature code beyond what the seed requires.

## 4. Seed Design

File: `kapwa-server/src/database/seed-accounts.ts`

### 4.1 Account inventory (26 total)

| Group | Count | Emails | Role | Password |
|---|---|---|---|---|
| admin | 1 | `admin@mswdo.test` | admin | `admin123` (unchanged) |
| social workers | 2 | `worker1@mswdo.test`, `worker2@mswdo.test` | social_worker | `worker123` (unchanged) |
| barangay coordinators | 13 | `coordinator.<barangay>@mswdo.test` | coordinator | `coordinator123` |
| claimants | 2 | `pedro.claimant@test.com`, `ana.claimant@test.com` | claimant | `claimant123` (unchanged) |
| mayor | 1 | `mayor@mswdo.test` | mayor | `mayor123` (unchanged) |
| auditor | 1 | `auditor@mswdo.test` | auditor | `auditor123` (unchanged) |
| agency staff | 6 | `<agency>.staff@norzagaray.test` | agency_staff | per-agency (below) |

### 4.2 Barangay coordinators (13)

| Email | assigned_barangay | permitted_barangays |
|---|---|---|
| `coordinator.bigte@mswdo.test` | Bigte | [Bigte] |
| `coordinator.matictic@mswdo.test` | Matictic | [Matictic] |
| `coordinator.partida@mswdo.test` | Partida | [Partida] |
| `coordinator.sanmateo@mswdo.test` | San Mateo | [San Mateo] |
| `coordinator.pinagtulayan@mswdo.test` | Pinagtulayan | [Pinagtulayan] |
| `coordinator.bitungol@mswdo.test` | Bitungol | [Bitungol] |
| `coordinator.bangkal@mswdo.test` | Bangkal | [Bangkal] |
| `coordinator.poblacion@mswdo.test` | Poblacion | [Poblacion] |
| `coordinator.fvr@mswdo.test` | Friendship Village Resources (FVR) | [Friendship Village Resources (FVR)] |
| `coordinator.tigbe@mswdo.test` | Tigbe | [Tigbe] |
| `coordinator.minuyan@mswdo.test` | Minuyan | [Minuyan] |
| `coordinator.sanlorenzo@mswdo.test` | San Lorenzo | [San Lorenzo] |
| `coordinator.baraka@mswdo.test` | Baraka | [Baraka] |

Shared password `coordinator123`. Generated programmatically from a `BARANGAYS` array (slug → barangay name), NOT hand-listed — DRY.

### 4.3 Agency staff (6)

| Email | Agency code | Password |
|---|---|---|
| `rhu.staff@norzagaray.test` | RHU | `rhu123` (unchanged) |
| `wcpd.staff@norzagaray.test` | WCPD | `wcpd123` |
| `peso.staff@norzagaray.test` | PESO | `peso123` |
| `dilg.staff@norzagaray.test` | DILG | `dilg123` |
| `dswd.staff@norzagaray.test` | DSWD | `dswd123` |
| `deped.staff@norzagaray.test` | DepEd | `deped123` |

Generated from an `AGENCIES` array: `{ code, email, password, fullName, phone }`.

### 4.4 No deterministic UUIDs

- Remove every `id:` field from `ACCOUNT`.
- INSERT columns drop `id` → `DEFAULT uuid_generate_v7()` assigns.
- `ON CONFLICT (id) DO NOTHING` → `ON CONFLICT (email) DO NOTHING`.
- Verified: no code/spec references the fixed UUIDs (grep clean).

### 4.5 Agency linkage

Replace the two hardcoded UPDATE statements with a loop:

```ts
const agencyLinks = [
  { code: 'RHU', email: 'rhu.staff@norzagaray.test' },
  { code: 'WCPD', email: 'wcpd.staff@norzagaray.test' },
  { code: 'PESO', email: 'peso.staff@norzagaray.test' },
  { code: 'DILG', email: 'dilg.staff@norzagaray.test' },
  { code: 'DSWD', email: 'dswd.staff@norzagaray.test' },
  { code: 'DepEd', email: 'deped.staff@norzagaray.test' },
  { code: 'MSWDO', emails: ['admin@mswdo.test', 'worker1@mswdo.test', 'worker2@mswdo.test'] },
];
```

Each row: `UPDATE users SET agency_id = (SELECT id FROM agencies WHERE code = $1) WHERE email = ANY($2)`.

### 4.6 Credential output

The console log lists all 26 accounts with credentials (existing pattern, extended).

## 5. Staged Build

1. `cd kapwa-server && npm run build` → dist output clean (no NEW type errors; pre-existing baseline only).
2. `cd kapwa-client && npm run build` → vite build succeeds (pre-existing baseline errors only, none in touched files).
3. `cd kapwa-server && npm run seed` against dev DB (podman `kapwa-db-dev`) → verify: 26 accounts; coordinators have assigned_barangay + single-element permitted_barangays; agency staff have agency_id set; no NULL agency_id for MSWDO staff.
4. Re-run `npm run seed` → idempotent (no duplicates, no errors).

## 6. Comprehensive Playwright MCP Testing — All Modules

Start both dev servers (server :3000, client :3001) with the freshly seeded DB, then walk every module in the browser via Playwright MCP. Login per role; for each module verify: renders, key interactions, expected data, no console errors beyond known baselines.

### 6.1 Role/module matrix

| Role | Login | Modules to verify |
|---|---|---|
| admin | `admin@mswdo.test/admin123` | Dashboard, General Intake, Referrals, Inter-Agency Referrals, Cases, Beneficiaries, Daily Tracker, Incident Reports, Approvals, Announcements, Admin Panel (Users — verify 13 coordinators + 6 agency staff rows), Programs, Settings |
| social_worker | `worker1@mswdo.test/worker123` | Dashboard, Intake, Cases, Beneficiaries (spot-check) |
| coordinator | `coordinator.poblacion@mswdo.test/coordinator123` | Coordinator dashboard, Access Cards (verify/assign/history), Referrals |
| coordinator (second) | `coordinator.bigte@mswdo.test/coordinator123` | Same — verify barangay-scoped data differs from Poblacion's |
| claimant | `pedro.claimant@test.com/claimant123` | My Dashboard, My Access Card |
| mayor | `mayor@mswdo.test/mayor123` | Reports |
| auditor | `auditor@mswdo.test/auditor123` | Audit Logs |
| agency_staff | `rhu.staff@norzagaray.test/rhu123` | Agency Portal: Dashboard, Referrals, Card Activities, Profile; verify MSWDO-only nav items hidden |
| agency_staff | `deped.staff@norzagaray.test/deped123` | Agency Portal spot-check (different agency scoping) |

### 6.2 What to verify per module

- Page renders with expected heading/data
- Key interactions work (create/submit/filter/transition where applicable)
- Role-appropriate nav visibility (agency_staff sees ONLY Agency Portal; coordinator sees coordinator pages; etc.)
- Console errors noted (classify pre-existing vs new)
- Screenshots saved to `docs/e2e-screenshots/`

### 6.3 Deliverable

`docs/e2e-full-system.md` — module-by-module results table + findings + screenshots. Committed.

## 7. Testing Strategy

- Seed logic: verified via the staged-build step (run seed, query DB counts/columns).
- No new unit tests required for the seed script itself (it's a dev/prod bootstrap script); the DB verification queries ARE the test.
- E2E: Playwright MCP manual browser walk-through (same methodology as the previous inter-agency E2E pass).

## 8. File Summary

**Server — modified**
- `kapwa-server/src/database/seed-accounts.ts` — full overhaul (26 accounts, programmatic coordinators/agencies, no UUIDs, email dedup, agency-link loop, credential output)

**Docs — new**
- `docs/e2e-full-system.md` — comprehensive E2E results
- `docs/e2e-screenshots/*.png` — per-module screenshots

## 9. Open Questions (resolved)

- Barangay list: the 13 from the existing seed's coordinator permitted_barangays (Bigte, Matictic, Partida, San Mateo, Pinagtulayan, Bitungol, Bangkal, Poblacion, FVR, Tigbe, Minuyan, San Lorenzo, Baraka).
- Agency set: 6 non-MSWDO (RHU, WCPD, PESO, DILG, DSWD, DepEd) per user decision.
- Coordinator emails: `coordinator.<barangay>@mswdo.test`; shared password `coordinator123`.
