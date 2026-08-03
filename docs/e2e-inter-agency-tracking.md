# Inter-Agency Tracking — Comprehensive E2E Browser Testing (Playwright MCP)

**Date:** 2026-08-03
**Branch:** main (post-merge of `feat/inter-agency-tracking`)
**Method:** Playwright MCP browser automation against the live dev stack (server :3000, client :3001, podman Postgres :5432)

## Test Environment Setup

- Started both dev servers: `kapwa-server` (NestJS, port 3000) + `kapwa-client` (Vite, port 3001, proxy `/api` → 3000).
- Reset seed account passwords to the documented values (stale bcrypt hashes in dev DB).
- Backfilled 3 households with access-card codes (`NORZ-AC-2026-0042/43/44`).
- Seeded test data via the real API (exercises endpoints):
  - `POST /access-cards/log` — MSWDO "Financial Assistance" + RHU "Medical Consultation" on NORZ-AC-2026-0042.
  - `POST /inter-agency-referrals` — MSWDO→RHU "Needs medical follow-up" (with notes).
- Created an RHU-agency test user (`rhu1@norzagaray.test`) to exercise the receiving-agency side (all seed staff are MSWDO).

## Results by Flow

### 1. Auth & navigation
- ✅ Admin login (`admin@mswdo.test`) → redirected to /admin.
- ✅ "Inter-Agency Referrals" nav item present under Core with correct roles.
- ✅ Breadcrumb renders ("GIS Intake / Inter Agency Referrals").

### 2. Inter-Agency Referrals — inbox & create (admin/MSWDO)
- ✅ Page heading, description, create form with 7-agency select (DepEd/DILG/DSWD/MSWDO/PESO/RHU/WCPD), legal-basis select (public_authority_sec13 / consent_verified / emergency_situation).
- ✅ Seed referral card renders: Juan Santos, "MSWDO → RHU", status Referred, reason, basis + date, notes.
- ✅ Beneficiary search (debounced, `useDebouncedSearch`) returns results; selecting a beneficiary fills the form.
- ✅ Create referral flow: selected PESO + "Mariel E2E-MM-1608" + reason → button enabled → submit → new card appears in inbox (SWR revalidation).
- ✅ Filters: "Sent" shows both referrals (sending agency); "Received" shows empty state (no referrals targeting MSWDO).

### 3. Inter-Agency Referrals — closed loop (receiving agency = RHU)
- ✅ Agency scoping: RHU staff sees ONLY the RHU-targeted referral — the PESO referral is correctly hidden.
- ✅ Receive button → status Received, timeline advances.
- ✅ Mark Actioned → status Actioned, Outcome input appears.
- ✅ Close with outcome → status Closed, outcome displayed ("Outcome: Provided medical assistance and scheduled follow-up").
- ✅ Decline (on a fresh referred referral) → status Declined with reason ("Declined: Unable to accommodate").

### 4. Access card — three-section view (admin)
- ✅ All three sections render on `/beneficiary/:id/access-card` for NORZ-AC-2026-0042:
  - **Services Rendered** — Financial Assistance (₱2,500), Medical Consultation.
  - **Services From Other Agencies** — RHU Medical Consultation + DepEd Educational assistance (added via UI) with the consent-inactive note ("Inter-agency sharing consent is not active — shown to MSWDO only.").
  - **Referrals History** — Declined (Dental screening) + Closed (Needs medical follow-up), agency names resolved via `agencyRef`.
- ✅ Add Entry form now has the agency select (all 7 agencies); saving "Educational assistance" with DepEd → appears in Services Rendered and Services From Other Agencies (resolved name "Department of Education").
- ✅ `GET /access-cards/NORZ-AC-2026-0042/summary` → 200; zero console errors on the page.

### 5. Coordinator access-cards page (regression fix verification)
- ✅ Verify tab: card code → Service History (3 → 4 entries) renders.
- ✅ **Regression fix confirmed:** Log Activity form has the agency select and submits `agencyId`. `POST /access-cards/log` → **201 Created** (previously the XOR DTO would have returned 400 with no agency). Entry persisted with `WCPD` agency (verified in DB).
- ✅ Assign + History tabs render; History table shows all entries with card code, service, category, date.

## Findings

| # | Severity | Finding | Where | Status |
|---|----------|---------|-------|--------|
| 1 | Minor (UX) | Access-card summary sections don't refresh immediately after "Save Entry" (SWR revalidates the card key, not the summary key) — stale until reload. | `AccessCardViewPage.tsx` `handleAddEntry` | Open — consider `mutate(agencySummary)` alongside `cardMutate()` |
| 2 | Minor (pre-existing) | Coordinator Verify flow calls `/access-cards/beneficiary/:code/card` with a card code — server route `beneficiary/:id/card` expects a UUID → 400 (swallowed by `catch {}`, beneficiary block silently omitted). | `CoordinatorAccessCardsPage.tsx:73` | Pre-existing, not part of this feature |
| 3 | Minor (pre-existing) | React hydration warnings on coordinator page: `<p>` wraps a Badge (`<div>`) in Service History rows (invalid HTML nesting). | `CoordinatorAccessCardsPage.tsx:135` | Pre-existing |
| 4 | Minor | Minio bucket-init errors at server boot (pre-existing, unrelated to this feature). | server log | Pre-existing |

## Verification Evidence

- Screenshots: `docs/e2e-screenshots/iar-inbox.png`, `iar-declined.png`, `access-card-three-sections.png`, `coordinator-verify-history.png`.
- DB: WCPD log entry persisted; referral closed/declined statuses persisted.
- All interactive flows exercised through the real browser (no mocked APIs); network requests inspected for status codes.
