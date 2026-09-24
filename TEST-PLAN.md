# E2E Test Plan — Playwright MCP

Verifies the system as of the current HEAD of `main`. Client dev server: `http://localhost:3001` (proxies `/api` → `http://localhost:3000/api/v1`, which carries the global `api` prefix + URI version `v1`).

## Roles & Credentials

Seeded by `npm run seed` (run from `kapwa-server/`) — 26 accounts. `ana.claimant@test.com` has TOTP MFA pre-enabled with the documented demo secret `JBSWY3DPEHPK3PXP` (base32 of "Hello!"); enroll it in any authenticator app.

| Role | Seed account | Password | Redirect after login | Key nav items |
|------|--------------|----------|----------------------|---------------|
| admin | admin@mswdo.test | admin123 | `/admin` | Dashboard, Intake, Referrals, Cases, Beneficiaries, Tracker, Approvals, Announcements, Admin Panel, Programs |
| social_worker | worker1@mswdo.test, worker2@mswdo.test | worker123 | `/dashboard` | Dashboard, Intake, Referrals, Cases, Beneficiaries, Tracker, Approvals, Announcements |
| coordinator | coordinator.bigte@mswdo.test (one per barangay: `coordinator.<slug>@mswdo.test`) | coordinator123 | `/coordinator/dashboard` | Barangay Coordinator, Referrals, Access Cards, Announcements |
| claimant | pedro.claimant@test.com | claimant123 | `/my-dashboard` | My Dashboard, My Access Card |
| claimant (MFA) | ana.claimant@test.com | claimant123 | `/my-dashboard` after TOTP code | same as claimant |
| mayor | mayor@mswdo.test | mayor123 | `/reports` | Reports |
| auditor | auditor@mswdo.test | auditor123 | `/audit-logs` | Audit Logs |
| agency_staff | rhu.staff@norzagaray.test (also wcpd/peso/dilg/dswd/deped `.staff@norzagaray.test`) | rhu123 (etc.) | `/agency/dashboard` | Dashboard, Inter-Agency Referrals, Card Activities, Agency Profile |

---

## 1. Authentication

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 1.1 | Login admin | Navigate `/login`, enter email + password, click Sign In | Redirect to `/admin`; sidebar shows Admin Panel + Programs |
| 1.2 | Login worker | Same form, worker1 credentials | Redirect to `/dashboard`; no Admin/Programs nav |
| 1.3 | Login coordinator | coordinator.bigte@mswdo.test | Redirect to `/coordinator/dashboard`; Barangay Coordinator nav |
| 1.4 | Login claimant | pedro.claimant@test.com | Redirect to `/my-dashboard` |
| 1.5 | Login MFA claimant | ana.claimant@test.com → MFA challenge → enter current TOTP code | Redirect to `/my-dashboard`; a wrong code stays on the challenge |
| 1.6 | Login mayor | mayor@mswdo.test | Redirect to `/reports` |
| 1.7 | Login auditor | auditor@mswdo.test | Redirect to `/audit-logs` |
| 1.8 | Login agency staff | rhu.staff@norzagaray.test | Redirect to `/agency/dashboard`; Agency Portal nav |
| 1.9 | Invalid credentials | Wrong password | Stays on `/login`, 401, error toast |
| 1.10 | Logout | Click avatar → Logout | Returned to landing page; a protected route now redirects to `/login` |
| 1.11 | Register claimant | Navigate `/register`, fill the form, submit | Success with email-verification prompt (`emailDelivered`); login is rejected until `POST /auth/verify-email` |
| 1.12 | Forgot password | Navigate `/forgot-password`, enter email | Success message (`emailDelivered`; account existence never revealed); reset link works once via `/reset-password` |

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
| 3.6 | Stepper | View the case stepper | 5 steps across 3 phases: Phase-In (Assess & Interview), Implementation (Intervention & Requirements, Inter-agency Referrals), Phase-Out (Evaluate Help Given, Case Study & Closure); locked steps are not clickable |
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
| 8.7 | Agency activities | Login agency staff → `/agency/card-activities` | Services rendered by the agency |
| 8.8 | Claimant card | Login claimant → `/my-access-card` | Own card summary + service history |

## 9. Admin Panel

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 9.1 | Page loads | Login admin → `/admin` | Tabs: Users, Sync Queue, Audit Log, Contact Messages |
| 9.2 | Users tab | Open Users tab | Table with roles, role change, server-side pagination, `active\|inactive` status filter |
| 9.3 | Create user | `/admin/users/new` — camelCase name parts + agency | Provisions a one-time set-password link (no temp password); no delete endpoint exists |
| 9.4 | Disable / enable user | Toggle a user | `PATCH /users/:id/disable\|enable`; a disabled account is rejected at login |
| 9.5 | Sync Queue tab | Open Sync Queue tab | Applied/pending/conflict/failed entries (`GET /sync/conflicts/:deviceId`); Resolve writes `conflict_reason`/`resolved_at` |
| 9.6 | Audit Log tab | Open Audit Log tab | Real fields, action filter, refresh, pagination (`GET /audit/logs`) |
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
| 15.2 | Approve | Select a case → sign the signature pad → Approve | `PATCH /cases/:id/approve` (admin) moves the case to `active` |
| 15.3 | Disburse | Select a case → Disburse | `PATCH /cases/:id/disburse` moves it to `transitioning` |
| 15.4 | Bulk approve | Select multiple → Bulk Approve | Bulk dialog processes the selection |
| 15.5 | Bulk export | Select cases → Bulk Export | `POST /cases/bulk-export` downloads `cases-bulk-export.csv` (masked by default) |

## 16. Daily Tracker

Roles: admin, social_worker, mayor, auditor.

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 16.1 | Tracker loads | Login → `/tracker` | Table with SLA status per case |
| 16.2 | Date navigation | Change Date From / Date To (default today) | Daily mode when equal, range mode otherwise (`GET /cases/tracker/daily`, `/range`) |
| 16.3 | Status filter | Pick a status | Table filters |
| 16.4 | Stats | Check the stats cards | This Week Cases + Today Entries (`GET /cases/tracker/stats`) |

## 17. Referrals & Agency Portal

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 17.1 | Coordinator referral | `/coordinator/referrals/new` → fill → submit | `POST /referrals`; appears in `GET /referrals/mine` with status `pending` |
| 17.2 | Worker accept | `/referrals` → Accept | `PATCH /referrals/:id/accept` hands off to a pre-filled intake with `sourceReferral`; a second intake for an already-converted referral is refused |
| 17.3 | Worker decline | Decline → enter reason | `PATCH /referrals/:id/decline`; reason required; leaves the pending list |
| 17.4 | Agency dashboard | Login agency staff → `/agency/dashboard` | Agency portal loads (`GET /agency-portal/dashboard`) |
| 17.5 | Inter-agency referrals | `/agency/referrals` + detail | Referrals tied to access cards; incoming inbox respects consent; detail also readable by admin/social_worker |
| 17.6 | Agency profile | `/agency/profile` | Agency details + settings |

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

Redirect targets follow `ROLE_REDIRECT_MAP` (admin→`/admin`, social_worker→`/dashboard`, coordinator→`/coordinator`, claimant→`/my-dashboard`, mayor→`/reports`, auditor→`/audit-logs`, agency_staff→`/agency/dashboard`).

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 19.1 | Worker blocked from Admin | Login worker → navigate `/admin`, `/admin/programs`, `/admin/users/new` | Redirect away (role-guarded) |
| 19.2 | Claimant dashboard | Login claimant → `/my-dashboard` | Claimant-specific view; claimant tokens get 403 on staff endpoints |
| 19.3 | Claimant access card | Navigate `/my-access-card` | Own card data; print/download button hidden |
| 19.4 | Mayor reports | Login mayor → `/reports` | Reports dashboard (zero-PII aggregates) |
| 19.5 | Auditor logs | Login auditor → `/audit-logs` | Audit viewer (`/audit/logs`, `/audit/verify-all`, `/audit/consent-ledger`) |
| 19.6 | Coordinator portal | Login coordinator → `/coordinator*` | Dashboard (barangay-scoped), referrals, access cards |
| 19.7 | Agency portal | Login agency staff → `/agency/*` | Dashboard, referrals, card activities, profile; referral detail also admin/social_worker |
| 19.8 | FSM role matrix | Trigger transitions as non-allowed roles | `request-review` social_worker-only; `approve`/`override-status` admin-only; everyone else 403 |

## 20. Edge Cases

| # | Test | Steps | Assert |
|---|------|-------|--------|
| 20.1 | Token refresh | Let the access token expire, then act | Silent refresh (401 interceptor) retries the request; session persists |
| 20.2 | CSRF | POST/PATCH without a matching `X-CSRF-Token` (vs `csrf-token` cookie) | 403; login/register/refresh/forgot/reset/verify-email/contact-messages are exempt |
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
npm run seed          # 26 accounts (roles & credentials above); enables TOTP on ana.claimant@test.com
npm run seed:programs # program metadata (categories, waiting periods, required documents, workflows)
npm run seed:demo     # demo beneficiaries / cases / entities for populated screens
```

Start the stack: server `npm run start:dev` (port 3000), client `npm run dev` (port 3001, proxies `/api` → 3000). Swagger: `http://localhost:3000/api/docs`.

## Playwright Commands Reference

Base URL: `http://localhost:3001`. Prefer the agent-browser skill / Playwright MCP for scripting.

| Action | Command |
|--------|---------|
| Navigate | `playwright_navigate url: "http://localhost:3001/login"` |
| Snapshot | `playwright_snapshot` → find element refs |
| Type | `playwright_type ref: ..., text: "..."` |
| Click | `playwright_click ref: ...` |
| Fill form | `playwright_fill selector: "[name=email]", value: "..."` |
| Select | `playwright_select_option ref: ..., values: [...]` |
| Screenshot | `playwright_take_screenshot filename: "page.png"` |
| Console | `playwright_console_messages` (filter `level: "error"`) |
| Wait | `playwright_wait_for_selector ref: ...` |
| Hover | `playwright_hover ref: ...` |
| Assert text | `playwright_assert_text ref: ..., text: "..."` |