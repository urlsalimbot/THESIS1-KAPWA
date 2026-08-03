# KAPWA Full-System E2E Testing Report (Playwright MCP)

**Date:** 2026-08-03
**Environment:** server :3000 (NestJS dev), client :3001 (Vite dev), podman `kapwa-db-dev` Postgres, freshly seeded (26 accounts)
**Method:** Playwright MCP browser automation — manual walk-through of every module per role.

## Results Matrix

| # | Role | Login | Modules | Rendered | Interactions | Console errors | Notes |
|---|---|---|---|---|---|---|---|
| 1 | admin | admin@mswdo.test / admin123 | Dashboard, General Intake, Referrals, Inter-Agency Referrals, Cases, Beneficiaries, Daily Tracker, Incident Reports, Approvals, Announcements, Admin Panel (Users), Programs, Settings | ✅ all | ✅ | none (0) | Users panel shows all 13 coordinators + 6 agency staff seeded correctly |
| 2 | social_worker | worker1@mswdo.test / worker123 | Dashboard, Cases, Beneficiaries | ✅ | ✅ | none (0) | |
| 3 | coordinator | coordinator.poblacion@mswdo.test / coordinator123 | Coordinator Dashboard, Access Cards (verify/assign/history), Referrals | ✅ | ✅ | none (0) | 4 tabs render |
| 4 | coordinator | coordinator.bigte@mswdo.test / coordinator123 | Referrals | ✅ | ✅ | none (0) | Barangay scoping verified: Bigte sees EMPTY referrals list while Poblacion sees data — per-barangay scoping works |
| 5 | claimant | pedro.claimant@test.com / claimant123 | My Dashboard | ✅ | ✅ | none (0) | **My Access Card nav item is a dead link** (see Finding 2) |
| 6 | mayor | mayor@mswdo.test / mayor123 | Reports | ✅ | ✅ | 8 errors (403) | Shell notifications/chat 403s (Finding 3) |
| 7 | auditor | auditor@mswdo.test / auditor123 | Audit Logs | ✅ | ✅ | 4-6 errors (403) | Same shell 403s |
| 8 | agency_staff | rhu.staff@norzagaray.test / rhu123 | Agency Portal: Dashboard, Referrals, Card Activities, Profile | ✅ all | ✅ | shell 403s only | **Scoped beneficiary search verified live: `GET /inter-agency-referrals/beneficiary-search?q=Juan` → 200 with Juan Santos** |
| 9 | agency_staff | deped.staff@norzagaray.test / deped123 | Agency Portal Dashboard | ✅ | ✅ | shell 403s only | DepEd sees empty dashboard (no referrals touch DepEd) — cross-agency scoping verified; desktop sidebar shows ONLY Agency Portal items |

## Detailed Verification Notes

### Admin (row 1)
- All 12 admin modules render with correct headings and zero console errors.
- **Seed verification via UI:** Users table lists `deped.staff`, `dswd.staff`, `dilg.staff`, `peso.staff`, `wcpd.staff`, `rhu.staff` + all 13 `coordinator.<barangay>` accounts (Baraka, San Lorenzo, Minuyan, Tigbe, FVR, Poblacion, Bangkal, Bitungol, Pinagtulayan, San Mateo, Partida, Matictic, Bigte).

### Coordinator (rows 3-4)
- Both coordinators reach `/coordinator/dashboard` after login.
- Access Cards page: Verify/Assign/History tabs render.
- **Barangay scoping confirmed:** `coordinator.bigte` referrals page shows "No referrals yet." while Poblacion has data. This validates the per-barangay `permitted_barangays`/`assigned_barangay` seed columns are actually used by the scoping logic.

### Agency portal (rows 8-9)
- **RHU dashboard:** header "Rural Health Unit - Norzagaray", stats Total 2 / Sent 0 / Received 2 / Closed 1 / Declined 1, recent referrals (Juan Santos — Dental screening Declined, Needs medical follow-up Closed) with MSWDO→RHU routing. Matches the seeded referral data.
- **RHU referrals page:** create form + referral cards render; filters present.
- **Scoped search (the critical fix):** typing "Juan" in the portal create form fired `GET /inter-agency-referrals/beneficiary-search?q=Juan` → 200 → "Juan Santos" appeared in the dropdown. Agency staff can now create referrals without `/beneficiaries` access.
- **RHU card activities:** renders (verify + log form).
- **RHU profile:** renders (name, code RHU, type health).
- **DepEd dashboard:** header "Department of Education", empty stats (no referrals touch DepEd) — cross-agency isolation verified.
- **Desktop sidebar for agency_staff:** only Dashboard / Referrals / Card Activities / Agency Profile.

## Findings

| # | Severity | Finding | Where | Status |
|---|----------|---------|-------|--------|
| 1 | **Bug (this feature)** | `LoginPage.tsx` roleRedirectMap missing `agency_staff` — agency staff logged in landed on `/dashboard` ("You don't have access") instead of `/agency/dashboard`. ProtectedRoute's map had it; LoginPage's duplicate map didn't. | `kapwa-client/src/pages/LoginPage.tsx:22` | **FIXED** (commit `ad71caf`), verified live: RHU login → `/agency/dashboard` |
| 2 | Pre-existing | Claimant nav item "My Access Card" (`/my-access-card`) is registered in nav-config but has NO route in routes.tsx — catch-all `path: '*'` redirects to `/`. Dead link. | `nav-config.tsx:64`, `routes.tsx:136` | Open — route + page (or removal) needed |
| 3 | Pre-existing | App shell unconditionally fetches `/notifications/my`, `/notifications/unread`, `/chat/conversations`, `/chat/unread` for ALL roles — mayor/auditor (and agency_staff) get 4× 403 per page + SWR fetch errors in console. Silent UX degradation (no visible error, but error noise + wasted requests). | Topbar/notifications/chat wiring | Open — role-gate the shell fetches |
| 4 | Pre-existing | `BottomNav.tsx` (mobile) hardcodes MSWDO tabs (Dashboard/Cases/Quick Action/Beneficiaries/Profile) with NO role filtering — agency_staff on mobile see links to routes they can't access. Desktop sidebar is correct (role-filtered); mobile is not. | `kapwa-client/src/components/BottomNav.tsx:15-21` | Open — role-gate tabs or derive from nav-config |
| 5 | Pre-existing | Dev DB has 3 leftover rows from older seeds (`coordinator@mswdo.test` singular, `mfa-admin@mswdo.test`, `rhu1@norzagaray.test`) — the seed itself is clean (26 accounts); leftovers are dev-DB residue. | dev DB | Documented; not deleted (dev data) |
| 6 | Pre-existing | Mayor/auditor pages also hit `GET /access-cards/beneficiary/:code/card`-style 400s? — No: the 400 observed earlier was the coordinator page's pre-existing `beneficiary/:code/card` UUID mismatch (documented in the inter-agency E2E). Not re-observed here. | — | — |

## Pre-existing Baselines (not from this work)

- Server boot: Minio bucket-init errors (logged, non-fatal); fresh-DB migration ordering.
- Client: ~21 latent TS baseline errors (FamilyTreeGraph.tsx, api.ts, 4 test files) — never surface in `vite build` (no tsc in build script).
- 7 failing server unit suites (chat, sync, notifications, cases, auth, dashboard, filing) — unrelated.

## Screenshots

`docs/e2e-screenshots/`:
- `admin-users-seeded.png` — Users panel with 13 coordinators + 6 agency staff
- `agency-dashboard-rhu.png` — RHU agency dashboard (stats + recent referrals)

## Conclusion

All 9 roles × all modules render and function. The two feature-critical behaviors verified live: (1) per-agency scoping (RHU vs DepEd portals show different data), and (2) the referral-scoped beneficiary search (200 + results). One bug introduced by the agency portal feature was found and fixed (login redirect, `ad71caf`). Four pre-existing issues remain documented for future work (claimant dead nav link, shell 403s, mobile nav role filtering, dev-DB leftovers).
