# KAPWA — User Stories & Acceptance Tests

A consolidated suite of user stories for the KAPWA System (MSWDO Norzagaray Social
Welfare), formatted for paper documentation. Each story is stated as **As a … I want
… so that …** and is testable through its acceptance criteria. The content is aligned
with `TEST-PLAN.md` (the current E2E test plan); dead roles and endpoints removed
from the system are not carried forward.

## Role legend

| Code | Role | Redirect after login |
|------|------|----------------------|
| ADM | admin | `/admin` |
| SW | social_worker | `/dashboard` |
| COORD | coordinator (barangay scoped) | `/coordinator` → `/coordinator/dashboard` |
| CLM | claimant | `/my-dashboard` |
| PUB | public / unauthenticated | — |

These are the only roles in the `UserRole` enumeration. The former `mayor`,
`auditor` and `agency_staff` roles, and the `/reports`, `/audit-logs` and
`/agency/*` surfaces, were removed; audit and reporting are administrator-only.

## Verification key

| Mark | Meaning |
|------|---------|
| ✓ | Exercised with **playwright-cli** on the live stack (current session) or the recorded browser run (`test-results/e2e-2026-09-21/`) |
| · | Acceptance criteria defined and API-verifiable; no recorded browser run |

Story IDs are not dense: numbers were retired with the removed functionality rather
than renumbered, to keep references to the original story list stable. Removed
stories: **US-043** (agency card summaries — the agency-staff role was removed) and
**US-133** (cases bulk-export — no such endpoint exists).

---

## 1. Authentication & Accounts

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-001 | PUB | Register as a prospective claimant (name parts, email, phone, password, barangay, DOB) to create an account | `POST /auth/register` succeeds; role is always `claimant`; response includes `emailDelivered`; `/auth/me` shows `role: claimant` | · |
| US-002 | PUB | Register so an existing walk-in record links to my account | `personMatched: true` + contact OTP; `POST /auth/request-person-link` re-sends; `POST /auth/verify-person-link` links `personId`; claimant dashboard then shows the walk-in case | · |
| US-003 | CLM | Verify email via the welcome-email link before logging in | `POST /auth/verify-email {token}`; login before verification is rejected | · |
| US-004 | All | Log in with email + password and land on the role dashboard | Access + refresh tokens; invalid → 401; refresh rotates; each role redirected per `ROLE_REDIRECT_MAP` | ✓ |
| US-005 | ADM, SW, COORD | Enable TOTP or email-OTP MFA to protect the account | `POST /auth/mfa/setup · enable · verify · disable` (TOTP, disable needs password); email OTP path `mfa/email/*` with `login/otp-verify` temp-token exchange; fresh code reused across retries | · |
| US-006 | All | Reset a forgotten password by email, once | `forgot-password` sends a reset link (`emailDelivered`; existence never revealed); `reset-password` works once, expired tokens rejected | · |
| US-007 | All | Change email (confirmation link) and password (current password) | change-email needs current password + token; change-password bumps `tokenVersion` (revokes old sessions) | · |
| US-008 | All | Bear restricted routes and API calls only to authorised roles | `@Roles` on every protected controller; cross-role requests 403; FSM role matrix (`case-fsm.ts`) enforced on transitions | ✓ |

## 2. Intake

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-010 | SW | Submit an intake (beneficiary + claimant + family + consent) to create the record chain | `POST /intake` creates Person → Beneficiary → Household → Case (`enrolled`) + consent ledger; sequential `controlNo`; validation (required fields, claimant age ≥ 18, DOB sanity) | · |
| US-011 | SW | Add Case / Renew Case prefilled from an existing beneficiary | Prefill populates beneficiary + family (editable); renew carries `renewalOfCaseId`; new case shows the renewal source | · |
| US-012 | SW | Check for duplicate persons so records are not doubled | `POST /intake/match-check` returns candidates by surname/first/phone/barangay; existing records reused on the new episode | · |
| US-013 | SW | Attach beneficiary and claimant ID photos separately | Two upload fields tagged `notes: beneficiary\|claimant` under `id_photo`; both stored in the filing vault | · |
| US-014 | SW, COORD | Confirm an intake against an existing household | `POST /intake/confirm/:householdId` creates a new `enrolled` case; case within 30 days → `caseCreated: false` + `existingCaseDate`; a converted referral is refused a second intake | · |
| US-015 | SW | Require explicit privacy consent (RA 10173) before intake commits | Submission blocked without consent; a consent-ledger row is written | · |
| US-016 | System | Auto-assign a household access card for every new intake | `ensureHouseholdCard` assigns `NORZ-AC-YYYY-NNNN`; idempotent across renewals; visible on the beneficiary page and case sidebar | · |

## 3. Cases & Lifecycle (FSM)

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-020 | SW | Complete the assessment and move the case to `assessed` | `PATCH /cases/:id/request-review` (SW only) from `enrolled`; blocked 400 until assessment fields exist; others 403; history + audit rows | ✓ |
| US-021 | SW | Submit the case for review with FRVA/SWDI scores | `PATCH /cases/:id/status → in_review` requires ≥ 1 of `frvaScore`/`swdiScore`; SW may act from `assessed` | · |
| US-022 | ADM | Approve an in-review case so services are implemented | `PATCH /cases/:id/approve → active` (ADM only) requires ≥ 1 logged intervention and every program required document met; the authenticated caller is the approver (no typed signature) | ✓ |
| US-023 | ADM | Move an active case toward phase-out | Requires `selfRelianceLevel` + `sustainabilityPlan` and either recorded referrals or `referralNotNeeded`; `disburse → transitioning` (ADM); `override-status` with a mandatory reason for forced moves | · |
| US-024 | SW, ADM | Formally close a documented case | `PATCH /cases/:id/close → closed` from `transitioning` only; closure data set via `/closure`; direct close from earlier statuses rejected (ADM uses override) | · |
| US-025 | SW, ADM | Log, edit and remove interventions so delivery is tracked | `POST · PATCH · DELETE /cases/:id/interventions`; program required docs gate approval; interventions auto-log to the household access card; history readable by ADM/SW | ✓ |
| US-025b | ADM | Issue the Certificate of Eligibility and Petty Cash Voucher | `POST /cases/:id/issue-coe` / `POST /cases/:id/issue-pcv` (ADM) once active; idempotent; each issuance audited | · |
| US-026 | SW | Renew a case for the next cycle (e.g. 4Ps) | Renew prefills intake with `renewalOfCaseId`; both cases share beneficiary/household/card | · |
| US-027 | ADM | See SLA warnings/escalations for stale phases | `enrolled`/`in_review` warn at 2 / escalate at 3 working days; `active` uses the program's `waiting_period_days`; escalations create an admin notification | · |
| US-028 | CLM, SW | Be notified by both parties on every case transition | Each transition emits `case_update` to the assigned worker and the linked claimant; claimant click routes to `/my-dashboard` | · |
| US-029 | SW, ADM | Follow the stepped case workflow, with statutory category steps | Stepper is `assessment, enrollments, interventions, referrals, evaluate, closure` (common) or up to 8 with the category step injected (`protection_order`, `solo_parent`, `discernment`, `adoption`) and/or `court_hearings`; locked steps not clickable; sealed steps read-only | ✓ |

## 4. Beneficiaries

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-030 | SW, ADM | Search and filter beneficiaries by barangay, category, relevance | `GET /beneficiaries` (≥ 3 chars ranks by relevance), barangay, category, pagination | ✓ |
| US-031 | SW, ADM | See the full beneficiary context incl. the family graph | Profile, household members, access card, cases, interventions; family-graph returns full person detail | ✓ |
| US-032 | SW, ADM | Start a new episode from the beneficiary page | One-click Add Case → prefilled intake, linked to the same beneficiary/household | · |
| US-033 | CLM | Self-serve my case, services, card, consent, requirements, disbursements | `GET /beneficiaries/me/*` + `POST /beneficiaries/me/consent/grant`; ownership-scoped to the linked beneficiary | · |

## 5. Access Cards

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-040 | SW, ADM | Keep one stable access card per household across the case lifecycle | `ensureHouseholdCard` idempotent; `POST /access-cards/assign/:beneficiaryId` + reprint keep the code; card is household-tied and survives intake → renewal → closure | ✓ |
| US-041 | SW, ADM, COORD | Log services against the card as the accounting ledger | `POST /access-cards/log` accepts case services, referrals, community, seminar, payout, compliance; card view filters by category; 4Ps actions auto-log (`4ps_compliance`, `4ps_payout`) | · |
| US-042 | SW, ADM, COORD | Verify a beneficiary by scanning a card code | `GET /access-cards/:code` returns person + card; summary aggregates `byCategory` | · |
| US-044 | SW, ADM, COORD | Export the Family Access Card as an official printable PDF | `GET /access-cards/beneficiary/:id/access-card-pdf` — 2-page A4 with NHTS-PR id, client record, family composition, signature blocks; persistent across case statuses; claimant's own card hides the button | ✓ |

## 6. IRF (Incident Report Forms)

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-050 | SW | File an IRF bound to a case | `/irf/new` without `caseId` redirects; `POST /irf` requires `caseId`; case view lists linked IRFs | ✓ |
| US-051 | SW | Keep IRF narration AES-256 encrypted at rest | Narration stored encrypted; default responses `[REDACTED]`; decryption needs a legal-basis code + authorised role; every decrypt/unmask audited | ✓ |
| US-052 | SW, ADM | Move an IRF through its disposition workflow | `refer-pnp`/`refer-wcpd` → referred; `dismiss {reason}`; `close` from referred/dismissed; `override-disposition {target, reason}` + audit | ✓ |
| US-053 | SW, ADM | Export an IRF in PDF / WCPD / JSON form | `POST /irf/:id/decrypt`; `GET /irf/:id/export-wcpd`; `POST /irf/:id/export-pdf {legalBasis, password?}` (`IRF BLT-…pdf`); `GET /irf/:id/export-json` | ✓ |
| US-054 | SW, ADM | Attach evidence photos to an IRF | SW uploads; ADM-only photo list; category-gated | · |

## 7. Programs

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-060 | ADM | Create/edit programs with full metadata | `POST/PATCH /programs` validates the approval workflow (unique orders); form-version bumps on template change with history | · |
| US-061 | PUB | See active programs and their details on the website | `GET /programs/public` returns active programs only, internal fields excluded; carousels render cards from the DB; unknown URLs show the branded 404 | ✓ |

## 8. Notifications

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-070 | All | Get in-app notifications (case, approval, chat, sync, SLA) | `GET /notifications/my` (latest 20), unread count, ownership-scoped mark-read (404 on foreign id), read-all, realtime over `/notifications` WS | · |
| US-071 | CLM | Get push-style case-update notifications | A transition creates a `case_update` notification; click routes to `/my-dashboard` | · |
| US-072 | All | Opt in/out of email/SMS per category | `GET/PUT /notifications/preferences`; `preferences/bulk` for many recipients; delivery skips when opted out (`consentSkipped`) | · |
| US-073 | System | Deliver transactional email with visible delivery status | Send methods return booleans; `emailDelivered` surfaced on register/forgot/email-MFA login; boot verifies SMTP and warns in production when `EMAIL_HOST`/`APP_URL` are missing | · |

## 9. Referrals

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-080 | COORD | Send a barangay referral to the MSWDO | `GET /referrals/mine` + `POST` from `/coordinator/referrals/new`; status pending/accepted/declined with reason | · |
| US-081 | SW, ADM | Accept or decline pending referrals | `PATCH /referrals/:id/accept` / `PATCH /referrals/:id/decline`; declines need a reason; accept opens a prefilled intake with `sourceReferral`; a converted referral is refused a second intake | · |
| US-082 | SW, ADM | Issue and view inter-agency endorsements tied to a case | `POST /inter-agency-referrals/case/:caseId/endorsement-letter` and `GET /inter-agency-referrals/case/:caseId`; admin/social_worker only (the agency-staff portal was removed) | · |

## 10. Announcements

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-090 | SW, ADM, COORD | Create, edit, publish/pin/delete announcements with photos | Manage list read-only; publish/pin/delete only on the detail page | · |
| US-091 | PUB | Read published announcements on the public site | `/announcements` lists published (pinned first); `/announcements/:slug` renders article + photos; unpublished never appear | ✓ |

## 11. Chat / Messages

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-100 | CLM, SW, ADM, COORD | Message the workers assigned to my case | Claimants may only message/view assigned workers (else 403); unread counts; chat notifications route to `/messages/:userId` | · |

## 12. Offline Sync (mobile)

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-110 | SW | Queue offline changes and sync with integrity | `POST /sync/v1` deltas Ed25519-signed, idempotent (24 h TTL), conflict-resolved; version vectors per table; unknown meta fields rejected | · |
| US-111 | ADM, COORD | Surface sync conflicts in the Admin Sync Queue | `GET /sync/conflicts/:deviceId`; `POST /sync/conflicts/:id/resolve` writes `conflict_reason`/`resolved_at` | · |
| US-112 | SW | Queue case transitions offline (e.g. Request Review) | Queue entry carries `_fsmTransition` targeting `assessed`; offline banner shows pending count; server FSM pre-check applies on sync | · |
| US-113 | SW | Keep queued changes safe through transient failures | Transport/5xx failures leave entries `pending`; 30 s auto-retry; only definitive 4xx marks `failed` — verified live by aborting the first sync POST | ✓ |
| US-114 | SW | Reach delta-sync endpoints with a normal worker session | `POST /sync/v1` and `/sync/pull` are `internal` sensitivity, not `restricted`; worker JWT syncs succeed | · |

## 13. Audit & Compliance

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-120 | ADM | Query the audit log for RA 10173 / COA compliance | `/audit/logs` with table/recordId filters + limit; Admin Audit tab renders real fields; `GET /export/audit-logs` (admin) exports CSV (PDF dropped) | · |
| US-121 | ADM | Verify audit hash chains are tamper-evident | `/audit/verify-all` validates chains; valid/invalid per chain | · |
| US-122 | ADM | Read the consent ledger | `/audit/consent-ledger` lists grants/revocations with channel/purpose/status | · |

## 14. Role Dashboards & Reports

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-130 | All | Land on a role-appropriate home dashboard | `GET /dashboard` for ADM/SW (COORD scoped to barangay); claimant `/my-dashboard`; each role redirected per `ROLE_REDIRECT_MAP` (mayor/auditor/agency dashboards do not exist) | ✓ |
| US-131 | SW, ADM | See SLA status per case in the daily tracker | `/tracker` (route guard ADM/SW); `GET /cases/tracker/daily · range · stats` | · |
| US-132 | SW, ADM | Export a closed case as a CSR PDF | `GET /cases/:id/csr-pdf` or `/csr/:controlNo/pdf` → `CSR <controlNo>-…pdf` (valid `%PDF`) — verified live | ✓ |
| US-134 | ADM | Export the audit log as CSV for compliance submissions | `GET /export/audit-logs?format=csv` → `text/csv` attachment (admin only) | · |
| US-135 | ADM | Export the service summary as CSV or XLSX | `GET /export/service-summary?format=csv · xlsx` (admin); range filters respected | · |
| US-136 | ADM | Export fund utilisation as an Excel workbook | `GET /export/monthly-funds?month=…` (admin); bad/missing dates → 400 | · |
| US-137 | ADM | Export the compliance report as CSV | `GET /export/compliance?format=csv` (admin) | · |
| US-138 | SW, ADM, COORD | Generate an eligibility or referral certificate PDF | `POST /export/certificate {type, fullName, address, date, details}` (eligibility/referral); invalid type/body → 400 | · |

## 15. Admin Panel

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-140 | ADM | Create, edit, role-change, disable/enable users | `/admin/users/new` posts 3NF name parts + agency; provisioning issues a one-time set-password link (no temp password); `PATCH /users/:id/disable · enable`; no delete endpoint; disabled accounts rejected at login; server-side pagination + status filter | · |
| US-141 | ADM | Monitor the sync queue (applied/pending/conflict/failed) | `GET /sync/conflicts/:deviceId` + `POST /sync/conflicts/:id/resolve` drive the Admin tab | · |
| US-152 | SW, ADM | Export a case as a GIS document PDF | `GET /cases/:id/gis-pdf` → `GIS <controlNo>-…pdf`, one-page DSWD form; renewal flagged; blanks render, never crash — verified live | ✓ |

## 16. Public Website

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-150 | PUB | Browse the complete public website | Home, About, Contact, Announcements, Programs, Terms, Accessibility, Privacy Policy all render; bounded 404; no a11y violations | ✓ |
| US-151 | PUB | Register, verify, and monitor end-to-end as a walk-in client | US-001 → US-002 → US-003 → US-028 pass in sequence — verified live on the stack | ✓ |

## 17. 4Ps & LCR

| ID | Actor | User story | Acceptance criteria | Ver |
|----|-------|-----------|---------------------|-----|
| US-160 | SW, ADM, COORD | Generate the 12-month compliance schedule per household member | `POST /fourps/:caseId/generate-compliance` (idempotent); `PATCH/DELETE /fourps/compliance/:id/meet` marks met and auto-logs `4ps_compliance`; claimant calls ownership-scoped | · |
| US-161 | SW, ADM | Schedule payouts and record their release | `POST · GET /fourps/:caseId/payouts`; `PATCH /fourps/payouts/:id/status` (completing creates a `4Ps` intervention and auto-logs `4ps_payout`); `POST /fourps/payouts/:id/notify` | · |
| US-162 | ADM | Import Local Civil Registrar records singly or in batch | `POST /lcr/import` (single) and `/lcr/import-batch` (many); admin only | · |