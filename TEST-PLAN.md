# E2E Test Plan — Playwright (playwright-cli)

Verifies the system as of the current HEAD of `main`. Client dev server: `http://localhost:3001` (proxies `/api` → `http://localhost:3000/api/v1`, which carries the global `api` prefix + URI version `v1`). Drive the browser with the **`playwright-cli`** CLI (see the reference at the foot of this file), not the retired Playwright-MCP tool names this plan previously quoted.

## Coverage as of this revision

What `playwright-cli` has exercised most recently, and what the plan below covers:

- **Roles are four**: `admin`, `social_worker`, `coordinator`, `claimant`. The `mayor`, `auditor` and `agency_staff` roles, the `/reports`, `/audit-logs` and `/agency/*` pages, and the agency portal were removed — audit and reporting are administrator-only now. Sections referencing them have been deleted or folded into the admin roles.
- **Verified by `playwright-cli` (live stack)**: login admin/social_worker (redirects `/admin`, `/dashboard`), the case list with search + status columns, case detail for a Solo Parent case (seven-step stepper — the category step injected — plus the sealed-then-unlocked path), Intervention & Requirements step with the program-linked requirement checklist, the admin dashboard, and the production build (nginx + hardened headers) serving login → `/admin` with zero console errors.
- **Verified by an earlier Playwright run (`test-results/e2e-2026-09-21/`)**: cases list, request-review (social_worker), closed-case view, IRF list + detail, access-card view + printed PNG/PDF, approvals pipeline, `in_review` step 3, add-intervention form and the logged entry, and the CSR / GIS / IRF PDF exports.
- **The case stepper is 6 or 7–8 steps, not 5**: the common template is `assessment, enrollments, interventions, referrals, evaluate, closure`; statutory categories inject a category step (`protection_order`, `solo_parent`, `discernment`, `adoption`) and/or `court_hearings` — see §3.6.
- **Analytics is feature-flagged off by default** (`VITE_ENABLE_ANALYTICS`); its route only exists in preview builds.



## Roles & Credentials

Seeded by `npm run seed` (run from `kapwa-server/`) — 21 accounts: 8 `social_worker`, 3 `admin`, 3 `coordinator` (one per barangay: `coordinator.<slug>@mswdo.test`), 7 `claimant`. `ana.claimant@test.com` has TOTP MFA pre-enabled with the documented demo secret `JBSWY3DPEHPK3PXP` (base32 of "Hello!"); enroll it in any authenticator app.

| Role | Seed account | Password | Redirect after login | Key nav items |
|------|--------------|----------|----------------------|---------------|
| admin | admin@mswdo.test | admin123 | `/admin` (Admin Panel) | Dashboard, Intake, Referrals, Cases, Beneficiaries, Tracker, Approvals, Announcements, Admin Panel, Programs |
| social_worker | worker1@mswdo.test … worker5@mswdo.test, worker.<name>@mswdo.test | worker123 | `/dashboard` | Dashboard, Intake, Referrals, Cases, Beneficiaries, Tracker, Approvals, Announcements |
| coordinator | coordinator.bigte@mswdo.test (one per barangay: `coordinator.<slug>@mswdo.test`) | coordinator123 | `/coordinator` (dashboard) | Barangay Coordinator, Referrals, Access Cards, Announcements |
| claimant | pedro.claimant@test.com | claimant123 | `/my-dashboard` | My Dashboard, My Access Card |
| claimant (MFA) | ana.claimant@test.com | claimant123 | `/my-dashboard` after TOTP code | same as claimant |

Redirects follow `ROLE_REDIRECT_MAP` in `client/src/lib/role-access.ts` — only these four roles exist in `UserRole`, and the `/reports`, `/audit-logs` and `/agency/*` destinations are gone.

---

## 1. Authentication

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 1.1 | Login admin | Navigate `/login`, enter email + password, click Sign In | Redirect to `/admin`; sidebar shows Admin Panel + Programs |
| 1.2 | Login worker | Same form, worker1 credentials | Redirect to `/dashboard`; no Admin/Programs nav |
| 1.3 | Login coordinator | coordinator.bigte@mswdo.test | Redirect to `/coordinator/dashboard`; Barangay Coordinator nav |
| 1.4 | Login claimant | pedro.claimant@test.com | Redirect to `/my-dashboard` |
| 1.5 | Login MFA claimant | ana.claimant@test.com → MFA challenge → enter current TOTP code | Redirect to `/my-dashboard`; a wrong code stays on the challenge |
| 1.6 | Invalid credentials | Wrong password | Stays on `/login`, 401, error toast |
| 1.7 | Logout | Click avatar → Logout | Returned to landing page; a protected route now redirects to `/login` |
| 1.8 | Register claimant | Navigate `/register`, fill the form, submit | Success with email-verification prompt (`emailDelivered`); login is rejected until `POST /auth/verify-email` |
| 1.9 | Forgot password | Navigate `/forgot-password`, enter email | Success message (`emailDelivered`; account existence never revealed); reset link works once via `/reset-password` |

## 2. Dashboard

Staff (admin/social_worker) only — roles: `GET /dashboard`.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 2.1 | Metric cards | Login admin → `/dashboard` | Cards: Served Today, Pending Review, Disbursed This Month |
| 2.2 | Case Status Chart | Scroll to chart section | Bar chart renders per-status counts |
| 2.3 | Trends chart | Scroll to trends section | Monthly case trend chart |
| 2.4 | Needs Attention | Check the section | Lists cases that need attention |
| 2.5 | Recent Cases table | Check table rows | Columns: Date, Surname, First, Middle, Gender, Category, Barangay, Status, View; SLA timer per row |
| 2.6 | New Intake button | Click New Intake | Navigates to `/intake` |
| 2.7 | Review Referrals button | Click Review Referrals | Navigates to `/referrals` |
| 2.8 | Export Fund Utilization | Click Export Fund Utilization | Downloads the monthly-funds workbook (`/export/monthly-funds`) |
| 2.9 | Open Tracker | Click Open Tracker | Navigates to `/tracker` |

## 3. Cases & Lifecycle

Roles: admin/social_worker. Statuses: `enrolled → assessed → in_review → active → transitioning → closed` (FSM in `case-fsm.ts`).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 3.1 | List loads | Login → `/cases` | Server-side table with search, filters, pagination |
| 3.2 | Search | Type in search box, press Enter | Table filters via `search` param |
| 3.3 | Filters | Select Status / Barangay / Category / Gender / Age Range / SLA | Table filters per param |
| 3.4 | Date range | Pick Date From / Date To | Table filters by date range |
| 3.5 | View case | Click a row | Navigates to `/cases/:id`; sidebar shows beneficiary, household, access card, renewal link |
| 3.6 | Stepper | View the case stepper | `COMMON_STEP_KEYS` = 6 steps: 1 Assess & Interview, 2 Program Enrollments, 3 Intervention & Requirements, 4 Inter-agency Referrals, 5 Evaluate Help Given, 6 Case Study & Closure. Statutory categories inject more: VAWC adds 2 court-hearings + 2 protection-order; CICL adds court-hearings + discernment; Solo Parent adds solo-parent; Adoption adds court-hearings + adoption — up to 8 steps. Locked steps are not clickable and a sealed step reads-only its card |
| 3.7 | Save assessment | Assessment step → fill → save | `PATCH /cases/:id/assessment` persists |
| 3.8 | Add intervention | Interventions step → add | `POST /cases/:id/interventions` lists the entry and auto-logs it to the household access card |
| 3.9 | Request review | Click Request Review | `PATCH /cases/:id/request-review` (social_worker only): `enrolled → assessed`; blocked 400 until assessment fields exist; other roles 403 |
| 3.10 | Submit for review | Move to `in_review` | `PATCH /cases/:id/status` requires ≥ 1 of `frvaScore` / `swdiScore` |
| 3.11 | Approve case | Admin → Approve with signature | `PATCH /cases/:id/approve` (admin only): `in_review → active`; blocked until ≥ 1 intervention and every required program document is met; then `POST /cases/:id/issue-coe` / `issue-pcv` generate the approval PDFs |
| 3.12 | Disburse | Click Disburse | `PATCH /cases/:id/disburse`: `active → transitioning` (admin) |
| 3.13 | Close case | Fill closure form (client signature + outcome), click Close | `PATCH /cases/:id/close`: `transitioning → closed`; direct close from earlier statuses is rejected |
| 3.14 | Override status | Admin → Override dialog with reason | `PATCH /cases/:id/override-status` forces the transition and writes an `override` history row |
| 3.15 | History | Open history | `GET /cases/:id/history` timeline; audit rows exist for transitions/review/override |
| 3.16 | Renew case | Click Renew Case | Prefilled intake links `renewalOfCaseId`; new case shows "Renewal of case ‹link›" |
| 3.17 | Requirements & transition plan | Mark required documents met / set referral decision | `PATCH /cases/:id/requirements`, `/transition-plan`, `/referral-decision` unblock approval and phase-out paths |

## 4. Intake

Roles: admin/social_worker.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 4.1 | Form renders | Login → `/intake` | Sections: beneficiary, claimant, family composition, consent, ID photo uploads |
| 4.2 | Validation | Submit empty form | Zod errors per field; claimant age ≥ 18 and DOB sanity enforced |
| 4.3 | Submit intake | Fill required fields, confirm consent, submit | `POST /intake` creates person → beneficiary → household → case (`enrolled`) with a sequential control number and auto-assigns the household access card (`NORZ-AC-YYYY-NNNN`); consent ledger row written |
| 4.4 | Match check | Enter an existing name/phone | `POST /intake/match-check` returns candidates by surname/first/phone/barangay; existing records are reused on the new episode |
| 4.5 | Confirm on existing household | Submit against an existing household | `POST /intake/confirm/:householdId` creates a new `enrolled` case; a case from the last 30 days returns `caseCreated: false` + `existingCaseDate` |
| 4.6 | ID photos | Attach beneficiary + claimant ID photos, submit | Both files stored in the filing vault with `notes: beneficiary\|claimant` |
| 4.7 | Consent gate | Try to submit without consent | Submission blocked (RA 10173) |
| 4.8 | Add Case prefill | Beneficiary page → Add Case | `/intake` opens prefilled with beneficiary data + family composition, all editable |

## 5. Beneficiaries

Roles: admin/social_worker.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 5.1 | List loads | Login → `/beneficiaries` | Table with search (≥ 3 chars), barangay/category filters, pagination |
| 5.2 | View beneficiary | Click a row | `/beneficiaries/:id`: profile + IDs, Family Composition, Family Tree, Cases, Interventions, Consent & Privacy |
| 5.3 | Family tree graph | Check the Family Tree section | Graph renders nodes + edges |
| 5.4 | Add Case | Click Add Case | `/intake` prefilled (see 4.8) |
| 5.5 | Log intervention | Use the quick form (service type, amount, fund source) | `POST /cases/:id/interventions`; service types FA/C/CSR/R/H/HV, fund sources Regular/PDAF/Legislative/Donation |
| 5.6 | Consent manager | Grant/revoke consent | Status updates; ledger rows surface in `/audit/consent-ledger` |
| 5.7 | Access card | Navigate `/beneficiary/:id/access-card` | Card details + service history grouped by category; Download PDF button (hidden for claimant) |
| 5.8 | NHTS-PR ID | Record the Listahanan ID | `PATCH /beneficiaries/:id/household/nhts-pr`; the ID renders on the printed card |

## 6. Programs (Admin)

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 6.1 | List loads | Login admin → `/admin/programs` | Program cards/table |
| 6.2 | Create program | `/admin/programs/new` — name, category, legal basis, waiting period, fund sources, required documents, approval workflow, form template | `POST /programs` 201; form-version bumps on template change |
| 6.3 | View / edit program | Click a card → edit | `/admin/programs/:id` shows workflow steps; `PATCH /programs/:id` succeeds |
| 6.4 | Delete program | Delete → confirm | `DELETE /programs/:id` (admin); removed from list |
| 6.5 | Public listing | Visit `/programs` (logged out) | Active programs only; internal fields not exposed (`GET /programs/public`) |
| 6.6 | Non-admin blocked | Login worker → navigate `/admin/programs` | Redirected (role-guarded) |

## 7. IRF

Roles: admin/social_worker. Narration is AES-256 encrypted at rest; masked by default.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 7.1 | Create from a case | Navigate `/irf/new` without a case → redirected; from the case view, click IRF | `POST /irf` requires `caseId`; control no `BLT-…`; case view lists linked IRFs |
| 7.2 | Detail view | Open `/irf/:id` | Person info + narration shown as `[REDACTED]` by default |
| 7.3 | Decrypt narration | Provide a legal-basis code | `POST /irf/:id/decrypt` returns the narration for authorized roles; every decrypt/unmask is audited |
| 7.4 | Refer to PNP | Click Refer to PNP | `PATCH /irf/:id/refer-pnp` → `referred` |
| 7.5 | Refer to WCPD | Click Refer to WCPD | `PATCH /irf/:id/refer-wcpd` → `referred` |
| 7.6 | Dismiss | Click Dismiss → enter reason | `PATCH /irf/:id/dismiss` → `dismissed`; reason required |
| 7.7 | Close | Click Close | `PATCH /irf/:id/close` from referred/dismissed → `closed` |
| 7.8 | Override disposition | Admin → override with reason | `PATCH /irf/:id/override-disposition {targetDisposition, reason}` + audit |
| 7.9 | Export PDF | Click Export PDF, supply legal basis + optional password | `POST /irf/:id/export-pdf` → `IRF <controlNo>-<YYYY>-<MM>-<DD>.pdf` |
| 7.10 | Export WCPD | Click Export WCPD | `GET /irf/:id/export-wcpd?legalBasis` → WCPD/PNP format |
| 7.11 | Export JSON | Click Export JSON | `GET /irf/:id/export-json` returns the structured bundle |
| 7.12 | Evidence photos | Worker uploads photos; admin views them | `GET /filing/irf/:irfId/photos` (admin only) lists them |

## 8. Access Cards

Household-tied; persist across intake → renewal → closure. No `/access-cards` list page — cards live on the beneficiary, coordinator, and agency pages.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 8.1 | Auto-assign / reprint | Open a case or click Assign | `POST /access-cards/assign/:beneficiaryId` generates the code; reprint keeps the same code |
| 8.2 | Look up by code | Enter/scan a card code | `GET /access-cards/:cardCode` returns the person + card; summary aggregates `byCategory` |
| 8.3 | Log service | Log against the card | `POST /access-cards/log` accepts the six categories (case services, referrals, community, seminar, payout, compliance) |
| 8.4 | Staff card view | Navigate `/beneficiary/:id/access-card` | Card + ledger filtered by category |
| 8.5 | Print / PDF | Navigate `/beneficiary/:id/card/print` or click Download PDF | `GET /access-cards/beneficiary/:id/access-card-pdf` — 2-page A4 with NHTS-PR id; claimant's own card hides the button |
| 8.6 | Coordinator cards | Login coordinator → `/coordinator/access-cards` | Barangay-scoped card management |
| 8.7 | Claimant card | Login claimant → `/my-access-card` | Own card summary + service history |

## 9. Admin Panel

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 9.1 | Page loads | Login admin → `/admin` | Tabs: Users, Sync Queue, Audit Log, Contact Messages |
| 9.2 | Users tab | Open Users tab | Table with roles, role change, server-side pagination, `active\|inactive` status filter |
| 9.3 | Create user | `/admin/users/new` — camelCase name parts + agency | Provisions a one-time set-password link (no temp password); no delete endpoint exists |
| 9.4 | Disable / enable user | Toggle a user | `PATCH /users/:id/disable\|enable`; a disabled account is rejected at login |
| 9.5 | Sync Queue tab | Open Sync Queue tab | Applied/pending/conflict/failed entries (`GET /sync/conflicts/:deviceId`); Resolve writes `conflict_reason`/`resolved_at` |
| 9.6 | Audit Log tab | Open Audit Log tab | Real fields, action filter, refresh, pagination (`GET /audit/logs`); this is the only surface — audit was administrator-only once the `auditor` role was removed (`/audit/verify-all`, `/audit/consent-ledger` are also admin-only) |
| 9.7 | Contact Messages tab | Open Contact Messages tab | Contact-form submissions listed |

## 10. Settings

All roles. `/settings/mfa` redirects to `/settings`.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 10.1 | Tabs load | Login → `/settings` | Tabs: Profile, Security, Notifications; language preference (English / Filipino) |
| 10.2 | Update phone | Change the phone number, save | `POST /auth/update-phone`; toast success |
| 10.3 | Change email | Enter new email + current password | `POST /auth/change-email` sends a verification link; profile updates after confirmation |
| 10.4 | Change password | Current + new password | `POST /auth/change-password`; old sessions revoked (`tokenVersion`) |
| 10.5 | MFA setup | Security tab → Set Up MFA → scan QR (or manual key) → enter 6-digit code | `POST /auth/mfa/setup` + `POST /auth/mfa/enable`; MFA now enabled; Disable requires the current password |
| 10.6 | Notification prefs | Notifications tab → toggle categories × channels | `PUT /notifications/preferences` persists per category/channel |

## 11. Case Study Report (CSR)

No dedicated CSR page — the report is a PDF export from a closed case. The CSR CRUD API exists but has no client UI.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 11.1 | Export from case view | Open a `closed` case → click Case Study Report | `GET /cases/:id/csr-pdf` downloads `CSR <controlNo>-<YYYY>-<MM>-<DD>.pdf` (valid `%PDF`) |
| 11.2 | Export from closure step | Closure step → Download CSR | Same PDF via `GET /csr/:controlNo/pdf` |
| 11.3 | API CRUD | `POST` / `GET` / `PATCH` / `DELETE` `/csr` (admin/social_worker) | 201 / list / 200 / 200; delete is admin-only |

## 12. Chat / Messages

Roles: admin, social_worker, coordinator, claimant.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 12.1 | Conversation list | Login → `/messages` | List via `GET /chat/conversations` |
| 12.2 | Open conversation | Click a conversation | Thread loads (`GET /chat/conversation/:otherUserId`); URL becomes `/messages/:userId` |
| 12.3 | Send message | Type + send | `POST /chat/send`; message appears in the thread |
| 12.4 | Unread count | Check the badge | `GET /chat/unread` count reflects unread conversations |
| 12.5 | Mark read | Open a conversation | `POST /chat/conversation/:otherUserId/read` returns `{ status: 'read' }` |
| 12.6 | Claimant scope | Login claimant, open a conversation with a non-assigned worker | 403 (claimants may only message assigned workers) |

## 13. Notifications

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 13.1 | List | Navigate `/notifications` | `GET /notifications/my` (latest 20) |
| 13.2 | Mark one read | Click a notification | Owner-scoped; another user's id returns 404 |
| 13.3 | Mark all read | Click Mark all read | read-all endpoint clears the unread badge (`GET /notifications/unread` → 0) |
| 13.4 | Bell dropdown | Click the bell icon | Recent + unread notifications |
| 13.5 | Case-update notification | Trigger a case transition | A `case_update` notification fires; claimant click routes to `/my-dashboard` |
| 13.6 | Preferences | Settings → Notifications tab | Per category × channel toggles persist (see 10.6) |

## 14. Documents (Filing)

Filing has no dedicated page — documents live inside the case view (and intake/IRF/announcement surfaces).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 14.1 | List case documents | Open a case → documents area | `GET /filing?caseId=` returns the case's uploads |
| 14.2 | Upload | Click Upload → pick a file | `POST /filing/upload` (multipart; case/beneficiary/irf/requirement metadata) |
| 14.3 | Download | Click download | `GET /filing/:id/download` streams an attachment |
| 14.4 | Verify documentary need | Mark a document verified | `PATCH /filing/:id/verify` toggles on-site verification |
| 14.5 | Delete | Delete → confirm | `DELETE /filing/:id` (photo categories gated) |
| 14.6 | IRF / announcement photos | View IRF detail or `/announcements/manage/:id` photos | Admin-only IRF photos (`GET /filing/irf/:irfId/photos`); manage-role announcement photos |
| 14.7 | Intake ID photos | Check a case's ID photo | `GET /filing/case/:caseId/id-photo` returns the intake ID photo (null when none) |

## 15. Approvals Pipeline

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 15.1 | List loads | Login → `/approvals` (admin/social_worker) | Cases pending a decision |
| 15.2 | Approve | Select a case → Approve | `PATCH /cases/:id/approve` (admin) moves the case to `active`; the approval carries no typed signature — the authenticated caller *is* the approver (see `ApproveCaseSchema`: `{ status }` only) |
| 15.3 | Disburse | Select a case → Disburse | `PATCH /cases/:id/disburse` moves it to `transitioning` |
## 16. Daily Tracker

Roles: admin, social_worker (route guard on `/tracker`; the `mayor`/`auditor` readers are gone).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 16.1 | Tracker loads | Login → `/tracker` | Table with SLA status per case |
| 16.2 | Date navigation | Change Date From / Date To (default today) | Daily mode when equal, range mode otherwise (`GET /cases/tracker/daily`, `/range`) |
| 16.3 | Status filter | Pick a status | Table filters |
| 16.4 | Stats | Check the stats cards | This Week Cases + Today Entries (`GET /cases/tracker/stats`) |

## 17. Referrals & Inter-Agency (the agency portal is gone)

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 17.1 | Coordinator referral | `/coordinator/referrals/new` → fill → submit | `POST /referrals`; appears in `GET /referrals/mine` with status `pending` |
| 17.2 | Worker accept | `/referrals` → Accept | `PATCH /referrals/:id/accept` hands off to a pre-filled intake with `sourceReferral`; a second intake for an already-converted referral is refused |
| 17.3 | Worker decline | Decline → enter reason | `PATCH /referrals/:id/decline`; reason required; leaves the pending list |
| 17.4 | Inter-agency endorsement | On a case, issue or view the endorsement letter | `POST /inter-agency-referrals/case/:caseId/endorsement-letter` and `GET /inter-agency-referrals/case/:caseId` — admin/social_worker only; there is no agency-staff portal for them (the `agency_staff` role was removed) |

## 18. 4Ps Compliance & Payouts

Roles: admin/social_worker/coordinator (client pages `/cases/:caseId/4ps-compliance`, `/cases/:caseId/payouts`; claimants get ownership-scoped 404s on foreign data).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 18.1 | Generate compliance | Open a 4Ps case → generate the schedule | `POST /fourps/:caseId/generate-compliance` creates per-member, per-month items (school_attendance, health_checkup, fds); idempotent |
| 18.2 | Toggle item met | Check/uncheck an item | `PATCH` / `DELETE /fourps/compliance/:id/meet`; marking met auto-logs `4ps_compliance` to the access card |
| 18.3 | Schedule payout | Payouts page → schedule | `POST /fourps/:caseId/payouts` (cycleNo, scheduledAt, amount, status `scheduled`) |
| 18.4 | Record release | Mark a payout completed/missed/cancelled | `PATCH /fourps/payouts/:id/status`; completed creates a `4Ps` intervention and auto-logs `4ps_payout` |
| 18.5 | Notify beneficiary | Click Notify | `POST /fourps/payouts/:id/notify` records `notifiedAt`/`notifiedBy` |
| 18.6 | LCR import | Admin → import birth/marriage/death records | `POST /lcr/import` (single), `POST /lcr/import-batch` (many) |

## 19. Role-Based Access Control

Redirect targets follow `ROLE_REDIRECT_MAP` (admin→`/admin`, social_worker→`/dashboard`, coordinator→`/coordinator`, claimant→`/my-dashboard`).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 19.1 | Worker blocked from Admin | Login worker → navigate `/admin`, `/admin/programs`, `/admin/users/new` | Redirect away (role-guarded) |
| 19.2 | Claimant dashboard | Login claimant → `/my-dashboard` | Claimant-specific view; claimant tokens get 403 on staff endpoints |
| 19.3 | Claimant access card | Navigate `/my-access-card` | Own card data; print/download button hidden |
| 19.4 | Coordinator portal | Login coordinator → `/coordinator*` | Dashboard (barangay-scoped), referrals, access cards |
| 19.5 | FSM role matrix | Trigger transitions as non-allowed roles | `request-review` social_worker-only; `approve`/`override-status` admin-only; everyone else 403 |
| 19.6 | Analytics gated | Build with `VITE_ENABLE_ANALYTICS=true`, visit `/analytics` | Route exists only in preview builds and is admin/social_worker-only; it is off in ordinary builds |

## 20. Edge Cases

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 20.1 | Token refresh | Let the access token expire, then act | Silent refresh (401 interceptor) retries the request; session persists |
| 20.2 | CSRF | POST/PATCH without a matching `X-CSRF-Token` (vs `csrf-token` cookie) | 403; exempt paths are exactly the bootstrapping ones in `csrf.guard.ts`: `/auth/login`, `/auth/login/otp-verify`, `/auth/register`, `/auth/refresh`, `/auth/mfa/verify`, `/auth/mfa/email/verify`, `/auth/mfa/email/resend`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/confirm-email-change`, `/contact-messages` |
| 20.3 | Rate limiting | Rapid repeated requests | 429 after the configured limit (default 60 requests / 60 s) |
| 20.4 | Empty state | View a module with no data | Empty-state message renders (no crash) |
| 20.5 | Offline queue | Go offline → log an intake/transition → reconnect | Change queues ("You are offline — N change(s) pending sync") and uploads via `POST /sync/v1`; a transport failure leaves entries `pending` for the 30 s retry; definitive 4xx marks them `failed` (manually retryable) |
| 20.6 | Pagination | Create 25+ items | Users/audit/cases/beneficiaries/tracker paginate server-side (`page`/`limit`) |
| 20.7 | Sync conflicts | Two devices edit the same row offline | Conflict surfaces in Admin → Sync Queue; Resolve writes `conflict_reason`/`resolved_at` |
| 20.8 | Unknown URL | Navigate to a random path | Branded 404 page |

---

## Test Data Setup

Run from `kapwa-server/`:

```bash
npm run seed          # 21 accounts (four roles, credentials above); enables TOTP on ana.claimant@test.com
npm run seed:programs # program metadata (categories, waiting periods, required documents, workflows)
npm run seed:demo     # demo beneficiaries / cases / entities for populated screens
```

Start the stack: server `npm run start:dev` (port 3000), client `npm run dev` (port 3001, proxies `/api` → 3000). Swagger: `http://localhost:3000/api/docs`.

## Playwright Commands Reference

Drive the browser with **`playwright-cli`** (the `@playwright/cli` package). Base URL: `http://localhost:3001`. After every command the tool prints a snapshot with element refs — use those refs for the next click/type.

| Action | Command |
|--------|---------|
| Open a browser session | `playwright-cli open http://localhost:3001/login` |
| Navigate | `playwright-cli goto http://localhost:3001/cases` |
| Snapshot (get refs) | `playwright-cli snapshot` |
| Search snapshot for text | `playwright-cli find "Sign In"` / `playwright-cli find --regex "/Sign (in|up)/i"` |
| Fill a field | `playwright-cli fill e5 "admin@mswdo.test" --submit` |
| Click | `playwright-cli click e9` |
| Type, then press Enter | `playwright-cli type "query"` ; `playwright-cli press Enter` |
| Select an option | `playwright-cli select e12 "active"` |
| Evaluate JS in the page | `playwright-cli eval "location.pathname"` |
| Console messages (errors) | `playwright-cli console error` |
| Screenshot | `playwright-cli screenshot --filename=page.png` |
| Element attribute | `playwright-cli eval "el => el.getAttribute('href')" e5` |
| Resize window | `playwright-cli resize 1920 1080` |
| Save / load auth state | `playwright-cli state-save auth.json` / `playwright-cli state-load auth.json` |
| Generate a locator | `playwright-cli generate-locator e9 --raw` |

Notes that save debugging time:

- Prefer `goto` over `open` mid-flow; `open` starts a fresh page each time.
- `playwright-cli console error` is the fast check that a step did not throw.
- For a step that navigates, `eval "location.pathname"` is the cheapest redirect assertion.
- Snapshots land in `.playwright-cli/`; `--filename` pins a path when you want to diff two states.
