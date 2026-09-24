# KAPWA — User Stories & Acceptance Tests

A complete suite of user stories mocking the system's functionalities, organized by
module. Each story is testable through the acceptance criteria (API-level or UI-level
verification). Roles: **ADM** admin · **SW** social worker · **COORD** barangay
coordinator · **CLM** claimant · **MAY** mayor · **AUD** auditor · **AGY** agency staff
· **PUB** public/unauthenticated.

---

## 1. Authentication & Accounts

### US-001 — Public claimant registration
- **As a** prospective claimant, **I want** to register with my first/last/middle name, extension, email, phone, password, barangay, and date of birth **so that** I can create an account to monitor my case.
- **AC:** `POST /auth/register` with name parts succeeds; account role is **claimant** (never a staff role); response includes `emailDelivered`.
- **Verification:** `/auth/me` after login shows `role: claimant`; a `claimant`-only endpoint (e.g. `/beneficiaries/me/services`) returns 200, not 403.

### US-002 — Walk-in record linking
- **As a** client who already visited the MSWDO, **I want** my registration to match my existing beneficiary record (name + DOB + phone) **so that** my account links to my cases.
- **AC:** Register with matching details → `personMatched: true` + `contactType: sms|email` (OTP sent by SMS first, email fallback; valid 5 minutes); `POST /auth/request-person-link` re-sends the code; `POST /auth/verify-person-link {email, code}` links the account (`personId` returned).
- **Verification:** after linking, the claimant dashboard shows the walk-in case status.

### US-003 — Email verification
- **As a** claimant, **I want** to verify my email via the link in the welcome email **so that** I can log in.
- **AC:** `POST /auth/verify-email {token}` succeeds; the link is built from `APP_URL`.
- **Verification:** login before verification is rejected with "verify your email"; after verification login works.

### US-004 — Login / refresh / logout
- **As a** user of any role, **I want** to log in with email + password **so that** I access my role-appropriate dashboard.
- **AC:** valid credentials → access + refresh tokens; invalid → 401; refresh endpoint rotates tokens; revoked session (password change/wipe) rejects refresh.
- **Verification:** each role logs in and is redirected per `ROLE_REDIRECT_MAP`.

### US-005 — MFA (TOTP or email OTP)
- **As a** staff user, **I want** to enable a TOTP authenticator or email OTP **so that** my account is protected.
- **AC:** TOTP: `POST /auth/mfa/setup` returns a secret + otpauth URI; `POST /auth/mfa/enable` requires a valid 6-digit code; `POST /auth/mfa/verify` completes the challenge; `POST /auth/mfa/disable` requires the current password. Email OTP: `POST /auth/mfa/email/setup|enable|resend|verify` enrolls `mfaMethod: EMAIL`; login with email MFA returns `{ mfaRequired: true, tempToken, emailDelivered }` and `POST /auth/login/otp-verify {code}` exchanges the temp token for session tokens; a fresh email code is reused across login retries instead of re-emailing.

### US-006 — Password recovery
- **As a** user, **I want** to reset my forgotten password via email **so that** I regain access.
- **AC:** `POST /auth/forgot-password` sends a reset link (response includes `emailDelivered`, account existence never revealed); `POST /auth/reset-password {token, newPassword}` works once; expired tokens rejected.

### US-007 — Change email & password
- **As a** user, **I want** to change my email (with confirmation link) and password (with current password) **so that** I keep my credentials current.
- **AC:** change-email requires current password + confirmation token; change-password requires current password and updates `tokenVersion` (revoking old sessions).

### US-008 — Role-based access control
- **As a** system, **I want** to restrict pages and API routes by role **so that** users only reach their authorized features.
- **AC:** protected routes (`/admin`, `/cases/:id`, `/beneficiaries/me/*`, etc.) enforce `@Roles`; claimant cannot reach staff pages; staff cannot impersonate claimants' data.
- **Verification:** cross-role requests return 403; FSM role matrix (`case-fsm.ts`) is enforced on every transition.

---

## 2. Intake (General Intake Form)

### US-010 — Full intake submission
- **As a** social worker, **I want** to submit an intake (beneficiary + claimant + family composition + consent) **so that** a beneficiary, household, and case are created.
- **AC:** `POST /intake` creates Person → Beneficiary → Household → Case (`enrolled`) → consent ledger; a sequential `controlNo` is generated (`generateControlNo`); input validation (required fields, age ≥ 18 for claimant, DOB sanity) blocks invalid submissions.
- **Verification:** DB rows exist for all entities; `/cases` lists the new case.

### US-011 — Beneficiary prefill from Add Case / Renew Case
- **As a** worker, **I want** "Add Case" (beneficiary page) and "Renew Case" (case page) to prefill the intake with the beneficiary's data + family composition, all editable **so that** I avoid re-typing.
- **AC:** navigating to `/intake` with the prefill state populates beneficiary fields and family members (`done: false`, editable); Renew Case carries `renewalOfCaseId`.
- **Verification:** `POST /intake` with `renewalOfCaseId` stores it on the new case; the new case shows "Renewal of case ‹link›".

### US-012 — Person dedup / match-check
- **As a** worker, **I want** the intake to check for duplicate persons **so that** I don't create duplicate beneficiary records.
- **AC:** `POST /intake/match-check` returns candidates by surname/first name/phone/barangay; existing records are reused (beneficiary + household) on a new episode.

### US-013 — ID photos (beneficiary + claimant)
- **As a** worker, **I want** to attach ID photos for the beneficiary and the claimant separately **so that** both IDs are on record.
- **AC:** two upload fields; both upload on submit tagged `notes: beneficiary|claimant` under `category: id_photo`; previews restore from pending holders; failures surface a warning.
- **Verification:** both files exist in the filing vault for the case.

### US-014 — Confirm intake on an existing household
- **As a** worker, **I want** to confirm an intake against an already-existing household **so that** I create a new episode without duplicate households.
- **AC:** `POST /intake/confirm/:householdId` (admin/social_worker/coordinator) updates person/claimant/family data and creates a new `enrolled` case with a fresh `controlNo`; if the household already has a case from the last 30 days, no new case is created (`caseCreated: false` + `existingCaseDate` returned); the same intake is refused a second time for a referral that was already converted.

### US-015 — Data privacy consent
- **As a** worker, **I want** the intake to require explicit consent (RA 10173) **so that** processing is lawful.
- **AC:** submission is blocked without consent; a consent-ledger row is created.

### US-016 — Household access-card auto-assignment
- **As a** system, **I want** every new intake to auto-assign a household access card **so that** card-based accounting exists from day one.
- **AC:** after intake commit, `ensureHouseholdCard` assigns `NORZ-AC-YYYY-NNNN` (idempotent — reuse on renewals); visible on the beneficiary page and case sidebar.

---

## 3. Cases & Lifecycle (FSM)

### US-020 — Case lifecycle: enrolled → assessed
- **As a** social worker, **I want** to complete the assessment (problems presented, SW assessment, client category) and move the case to `assessed` **so that** review can begin.
- **AC:** `PATCH /cases/:id/request-review` (social_worker ONLY) moves `enrolled → assessed`; blocked (400) until `problemsPresented` + `socialWorkerAssessment` + `clientCategory` exist (set via `PATCH /cases/:id/assessment`); other roles get 403; history + `case.request_review` audit rows written.

### US-021 — Case lifecycle: assessed → in_review
- **As a** worker, **I want** to submit the case for review with FRVA/SWDI scores **so that** the head/admin reviews it.
- **AC:** `PATCH /cases/:id/status {status: 'in_review'}` (admin/social_worker) requires ≥ 1 of `frvaScore`/`swdiScore`; only `social_worker` may act from `assessed` (admin always allowed).

### US-022 — Case lifecycle: in_review → active
- **As an** admin, **I want** to approve an in-review case **so that** services are implemented.
- **AC:** `PATCH /cases/:id/approve {status: 'active', signature}` (admin ONLY; coordinator removed) requires ≥ 1 logged intervention AND every required program document met (`missingRequiredDocuments` — all `program_required_documents` across the case's interventions are mandatory; satisfied via `PATCH /cases/:id/requirements`); the admin's `approvedBySignature`/`approvedByRole` are captured.
- **Related:** `PATCH /cases/:id/disburse {status: 'transitioning'}` (admin) records the disbursement step; `GET /cases/disbursed/pending-intervention` lists active cases awaiting intervention.

### US-023 — Case lifecycle: active → transitioning
- **As an** admin, **I want** to move an active case toward phase-out **so that** graduation readiness is assessed.
- **AC:** admin only (FSM role matrix); requires `selfRelianceLevel` + `sustainabilityPlan` AND either inter-agency referrals recorded (`PATCH /cases/:id/transition-plan`) or `referralNotNeeded` (`PATCH /cases/:id/referral-decision {notNeeded: true}`). The client "Disburse" action issues `PATCH /cases/:id/disburse` with `status: 'transitioning'`. `PATCH /cases/:id/override-status` (admin) forces any status change with a mandatory reason, written as `override` history.

### US-024 — Case lifecycle: transitioning → closed
- **As a** worker/admin, **I want** to formally close a case **so that** the episode is documented.
- **AC:** `PATCH /cases/:id/close` (admin/social_worker) requires `clientSignature` + `closureOutcome` (set via `PATCH /cases/:id/closure`); sets `closureDate`; closure is only reachable from `transitioning` — direct closure from `enrolled`/`assessed`/`in_review`/`active` is rejected (admins use the audited override); CSR PDF available after closure.

### US-025 — Interventions
- **As a** worker, **I want** to log interventions against a case **so that** service delivery is tracked.
- **AC:** `POST /cases/:id/interventions` (admin/social_worker: program, service, amount, fund source, date); `PATCH`/`DELETE /cases/:id/interventions/:id` edit and remove entries; every program required document is mandatory for case approval (the legacy `mandatory` flag is ignored); interventions auto-log to the household access card (`autoLogFromIntervention`); totals feed reports; `GET /cases/:id/history` is readable by admin/social_worker/auditor.

### US-025b — Issue Certificate of Eligibility / Petty Cash Voucher (admin)
- **As an** admin, **I want** to issue the COE and PCV documents for an active case **so that** approval documents match the paper strips.
- **AC:** `POST /cases/:id/issue-coe` and `POST /cases/:id/issue-pcv` (admin only) generate PDFs filed under `approval_document`; allowed once the case is active (active/transitioning/closed); idempotent — re-issuing returns the existing URL; each issuance writes a `case.issue_coe`/`case.issue_pcv` audit row.

### US-026 — Case renewal (recurring programs)
- **As a** worker, **I want** to renew a case for the next cycle (e.g., 4Ps) **so that** recurring assistance is tracked per cycle.
- **AC:** Renew Case button prefills intake and links `renewalOfCaseId`; the new case displays the renewal source; both cases share the beneficiary/household/card.

### US-027 — SLA escalation (program-based after active)
- **As an** admin, **I want** SLA warnings/escalations for cases stuck in a phase **so that** I act on stale cases.
- **AC:** `enrolled`/`in_review` warn at 2 / escalate at 3 working days (global); `active` cases use the program's `waiting_period_days` (escalate at wpd, warn at wpd−1) with global fallback; every escalation creates an admin notification linking to the case.

### US-028 — Case notifications to worker and claimant
- **As a** claimant and worker, **I want** both of us notified on every case transition **so that** we monitor status.
- **AC:** every transition emits `case_update` to the assigned worker AND the beneficiary's linked claimant account; claimants are routed to `/my-dashboard`.

---

## 4. Beneficiaries

### US-030 — Beneficiary list & search
- **As a** worker, **I want** to search/filter beneficiaries (barangay, category, search vector) **so that** I find records fast.
- **AC:** `GET /beneficiaries` supports search (≥3 chars ranks by relevance), barangay, category, pagination.

### US-031 — Beneficiary detail + family graph
- **As a** worker, **I want** the beneficiary page to show profile, household members (name/relationship/age), access card, cases, and interventions **so that** I have full context.
- **AC:** family-graph endpoint returns members with detailed person fields (surname/first/middle/extension/gender/dob).

### US-032 — Add case from beneficiary
- **As a** worker, **I want** a one-click "Add Case" from the beneficiary page **so that** a new assistance episode starts with prefilled data.
- **AC:** navigates to intake with beneficiary + family prefill (editable); new case linked to the same beneficiary/household.

### US-033 — Claimant self-service
- **As a** claimant, **I want** personal endpoints for my case, services, card, consent, requirements, and disbursements **so that** I monitor everything without staff help.
- **AC:** `GET /beneficiaries/dashboard`, `/beneficiaries/me/services`, `/beneficiaries/me/access-card`, `/beneficiaries/me/consent`, `/beneficiaries/me/requirements`, `/beneficiaries/me/disbursements` (claimant only); `POST /beneficiaries/me/consent/grant` records consent; all responses are ownership-scoped to the claimant's linked beneficiary.

---

## 5. Access Cards

### US-040 — Household card lifecycle
- **As a** worker, **I want** every household to have one access card (auto-assigned) with manual assign/reprint fallback **so that** card-based accounting is consistent.
- **AC:** `ensureHouseholdCard` idempotent; `POST /access-cards/assign/:beneficiaryId` generates + syncs `households.access_card_code` and the person role; reprint keeps the same code. **Cards are household-tied and persist across case life cycles:** the code lives on the household/person role, not the case — opening, renewing, or reopening a case reuses the same card and ledger (new cases never mint a new card); closing a case does not remove the card or its service log.

### US-041 — Service logging & accounting (incl. 4Ps payouts/compliance)
- **As a** worker/agency staff, **I want** to log services (case services, referrals, community, seminars, **payouts**, **compliance**) against a card **so that** the card is the accounting ledger.
- **AC:** `POST /access-cards/log` accepts the six categories; entries carry date/cost/worker sign; card view tabs filter by category; the case page's Access Card Ledger shows counts + recent entries with quick-log dialogs. 4Ps actions auto-log to the card (`4ps_compliance` on check-off, `4ps_payout` on schedule/release — see §17).

### US-042 — QuickScan verification
- **As a** worker/agency, **I want** to scan a card code **so that** I verify the beneficiary and log a service instantly.
- **AC:** `GET /access-cards/:code` returns the person + card; summary aggregates `byCategory`.

### US-043 — Agency card summaries
- **As an** agency staff, **I want** to see services rendered by my agency and by others **so that** I coordinate assistance.
- **AC:** agency summary endpoint returns services split by origin; consent gating respected.

### US-044 — Access Card PDF export
- **As a** worker/admin/coordinator, **I want** to export the Family Access Card form as a PDF with the live client record **so that** I have an official, printable card for filing.
- **AC:** `GET /access-cards/beneficiary/:id/access-card-pdf` (admin/social_worker/coordinator) returns an `application/pdf` attachment named `ACCESS CARD <code>-<YYYY>-<MM>-<DD>.pdf`; the card is resolved by beneficiary/household (not case), so printing works for any case status across the household's case history (persists through intake → renewal → closure); the PDF is 2 pages A4 — page 1 PAALALA AT GABAY (left) + Client's Record of Services Avaited table start (right); page 2 services continuation (left) + Republic header/Code#/Barangay/Contact# including the Listahanan NHTS-PR ID (`nhts_pr_id`, recorded via `PATCH /beneficiaries/:id/household/nhts-pr`) + Client (surname/first/middle, gender checkbox, DOB, address) + FAMILY COMPOSITION + signature blocks (right); services rows come from the access card service log (date, rendered + cost, agency, worker); a beneficiary with no card returns 404; blank client/family/services data still renders (blanks, never crashes); button (claimant hidden) on `/beneficiary/:id/access-card` downloads the PDF.

---

## 6. IRF (Incident Report Forms)

### US-050 — IRF creation within a case
- **As a** worker, **I want** to file an IRF only from within a case **so that** it is bound to the case.
- **AC:** `/irf/new` without `caseId` redirects to `/cases`; `POST /irf` requires `caseId`; the case view lists linked IRFs.

### US-051 — Encrypted narration
- **As a** worker, **I want** the IRF narration AES-256 encrypted at rest (pgcrypto) **so that** VAWC details are protected.
- **AC:** narration stored encrypted; default responses show `[REDACTED]`; decryption requires a legal-basis code + authorized role; audit records every decrypt/unmask.

### US-052 — IRF disposition workflow
- **As a** worker/admin, **I want** to move an IRF through dispositions (under investigation → referred → closed/dismissed) **so that** the case outcome is tracked.
- **AC:** FSM-enforced via dedicated endpoints (admin/social_worker): `PATCH /irf/:id/refer-pnp` / `refer-wcpd` (referred), `PATCH /irf/:id/dismiss {reason}` (dismissed, reason required), `PATCH /irf/:id/close` (closed, from referred/dismissed), `PATCH /irf/:id/override-disposition {targetDisposition, reason}` (reason required + audit).

### US-053 — IRF exports
- **As a** worker, **I want** to export an IRF (PDF/JSON/WCPD format) **so that** records can be shared/printed.
- **AC:** `POST /irf/:id/decrypt {legalBasis}` returns the narration; `GET /irf/:id/unmask-names?legalBasis` unmasks names; `GET /irf/:id/export-wcpd?legalBasis` (WCPD/PNP format); `POST /irf/:id/export-pdf {legalBasis, password?}` (password-protected, filename `IRF <controlNo>-<YYYY>-<MM>-<DD>.pdf`); `GET /irf/:id/export-json` (structured bundle). The PDF matches the official Blotter form (control no `BLT-…`); names are masked by default until legally unmasked.

### US-054 — IRF evidence photos
- **As a** social worker/admin, **I want** to attach evidence photos to an IRF **so that** the case file is complete.
- **AC:** `social_worker` sees the upload control; `admin` sees the photo list (view is admin-only); photos are category-gated.

---

## 7. Programs

### US-060 — Program CRUD + metadata
- **As an** admin, **I want** to create/edit programs with full metadata (category, legal basis, waiting period, fund sources, required documents, approval workflow, form template) **so that** programs drive eligibility and SLA.
- **AC:** `POST/PATCH /programs` validates the workflow (unique orders); form-version bumps on template change with history rows.

### US-061 — Public program listing
- **As a** public visitor, **I want** to see active programs on the website **so that** I know what assistance exists.
- **AC:** `GET /programs/public` returns active programs only, internal fields excluded; the public `/programs` page and the homepage/About services carousel (`ProgramsCarousel`) render cards with fund sources, legal basis, and required documents from the DB; unknown public URLs show the branded 404 page.

---

## 8. Notifications

### US-070 — In-app notifications
- **As a** user, **I want** notifications (case updates, approvals, disbursements, chat, sync conflicts, SLA escalations) **so that** I stay informed.
- **AC:** `GET /notifications/my` (latest 20), `GET /notifications/unread`, mark-one-read is ownership-scoped (404 on another user's id), read-all, realtime via the `/notifications` WebSocket; `POST /notifications` + `POST /notifications/:id/send` (admin/social_worker) create and re-send; `GET /notifications/recipient/:recipientId` (admin) reads another user's notifications.

### US-071 — Claimant case-update notifications
- **As a** claimant, **I want** push-style in-app case update notifications **so that** I monitor my case without checking manually.
- **AC:** a case transition creates a `case_update` notification for the claimant account; clicking navigates to `/my-dashboard`.

### US-072 — Notification preferences (channels)
- **As a** user, **I want** to opt in/out of email/SMS per category **so that** I control delivery.
- **AC:** `GET/PUT /notifications/preferences`; `PUT /notifications/preferences/bulk` updates many recipients at once; `send-with-consent` (admin/social_worker/agency_staff) skips delivery when opted out (`consentSkipped`).

### US-073 — Email/SMS delivery
- **As a** system, **I want** transactional emails (verify/reset/OTP/notification) with delivery status **so that** delivery failures are visible.
- **AC:** send methods return booleans; `emailDelivered` surfaced on register/forgot-password and email-MFA login; boot verifies SMTP (`transporter.verify`) and warns loudly in production when `EMAIL_HOST`/`APP_URL` are missing.

---

## 9. Referrals

### US-080 — Coordinator referral to MSWDO
- **As a** coordinator, **I want** to send a referral (name, barangay, reason) **so that** the MSWDO acts on it.
- **AC:** `GET /referrals/mine` + `POST` from `/coordinator/referrals/new`; status tracks pending/accepted/declined with decline reason; accepting hands off to a pre-filled intake (`/intake` with `sourceReferral` attached).

### US-081 — Worker acceptance/decline
- **As a** worker, **I want** to accept or decline pending referrals **so that** the queue is managed.
- **AC:** `PATCH /referrals/:id/accept|decline` (admin/social_worker); declines require a reason; rows leave the pending list; accept opens the pre-filled intake and an intake for a referral that already has a case is refused (`assertReferralNotConverted`).

### US-082 — Inter-agency referrals
- **As an** agency staff/worker, **I want** to send and receive inter-agency referrals tied to access cards **so that** services are coordinated across agencies.
- **AC:** referral create/list/detail by card code; incoming inbox respects consent; referral status labels render.

---

## 10. Announcements

### US-090 — Announcement management
- **As a** worker/admin/coordinator, **I want** to create, edit, publish/unpublish, pin, and delete announcements with photos **so that** the public website stays current.
- **AC:** manage list is read-only (actions live on the detail page); publish/pin/delete only on `/announcements/manage/:id`.

### US-091 — Public announcements
- **As a** public visitor, **I want** the announcements list and article pages **so that** I read MSWDO updates.
- **AC:** `/announcements` lists published items (pinned first); `/announcements/:slug` renders the article + photos; unpublished items never appear publicly.

---

## 11. Chat / Messages

### US-100 — Claimant ↔ worker messaging
- **As a** claimant, **I want** to message the workers assigned to my case **so that** I can follow up directly.
- **AC:** claimants may only message/view conversations with assigned workers (forbidden otherwise); workers see conversations with their clients; unread counts work; chat notifications route to `/messages/:userId`.

---

## 12. Offline Sync (mobile)

### US-110 — Offline queue + sync
- **As a** field worker, **I want** my offline changes queued and synced with integrity **so that** I work without connectivity.
- **AC:** `queueChange` records offline ops; `POST /sync/v1` deltas are Ed25519-signed, idempotent (24h TTL), conflict-resolved; version vectors track per-table versions; unknown meta fields rejected.

### US-111 — Conflict handling
- **As a** system, **I want** sync conflicts surfaced to the admin Sync Queue monitor **so that** they are resolved.
- **AC:** `GET /sync/conflicts/:deviceId` (admin/coordinator) lists conflicts in `/admin` sync tab; `POST /sync/conflicts/:id/resolve` (admin/coordinator) writes `conflict_reason`/`resolved_at`.

### US-112 — Offline FSM transition queueing
- **As a** field worker, **I want** to trigger case transitions (e.g. Request Review) while offline **so that** the change syncs when connectivity returns.
- **AC:** offline `Request Review` queues a `cases` UPDATE targeting `assessed` with the `_fsmTransition` flag; the toast confirms "queued — will sync when online"; the offline banner shows "You are offline — N change(s) pending sync"; the queue entry carries the correct target state (regression: queued `in_review` from `enrolled` would be FSM-rejected on sync — fixed to `assessed`).

### US-113 — Transient failure retry
- **As a** field worker on a flaky connection, **I want** sync failures not to permanently lose queued changes **so that** the queue self-heals.
- **AC:** a transport failure (`TypeError`) or server 5xx during `POST /sync/v1` leaves entries **pending** (not `failed`); a 30s auto-retry watcher re-syncs while online with pending changes; only definitive 4xx errors mark entries `failed` (manually retryable in the queue panel). Verified live: aborting the first sync POST kept all entries pending and retries flowed through.

### US-114 — Sync endpoint accessibility (ABAC)
- **As a** social worker, **I want** the delta-sync endpoints reachable with a normal worker session **so that** offline changes upload without a legal-basis code.
- **AC:** `POST /sync/v1` and `POST /sync/pull` (admin/coordinator/social_worker) are `internal` sensitivity (regression: they were `restricted`, 403-ing every sync for non-admins); syncs succeed with a worker JWT; queued changes apply through the server FSM pre-check with conflict detection.

---

## 13. Audit & Compliance

### US-120 — Audit log (RA 10173 / COA)
- **As an** admin/auditor, **I want** a queryable audit log with user, action, record, details **so that** I can demonstrate compliance.
- **AC:** `/audit/logs` supports table/recordId filters + limit; admin Audit tab renders the real fields with action filter + refresh; `GET /audit/coa-export?startDate&endDate` (admin/auditor) exports a COA-ready CSV.

### US-121 — Hash-chain verification
- **As an** auditor, **I want** to verify audit hash chains **so that** records are tamper-evident.
- **AC:** `/audit/verify-all` validates chains; the auditor page shows valid/invalid per chain.

### US-122 — Consent ledger
- **As an** auditor, **I want** to read the consent ledger **so that** consent history is auditable.
- **AC:** `/audit/consent-ledger` lists grants/revocations with channel/purpose/status.

---

## 14. Role Dashboards & Reports

### US-130 — Role home pages
- **As a** user of any role, **I want** a role-appropriate dashboard **so that** I see what matters to me.
- **AC:** `GET /dashboard` (admin/social_worker/coordinator — coordinator scoped to the assigned barangay) returns metrics, SLA, served today, and recent cases; `GET /dashboard/reports/mayor` (mayor, zero-PII aggregates); claimant dashboard `GET /beneficiaries/dashboard`; agency dashboard `GET /agency-portal/dashboard` (agency_staff/admin); auditor page; each role is redirected per `ROLE_REDIRECT_MAP`.

### US-131 — Case Tracker (SLA view)
- **As a** worker/mayor/auditor, **I want** a daily tracker with SLA status **so that** stale cases are visible.
- **AC:** `/tracker` lists cases with SLA state; `GET /cases/tracker/daily|range|stats` + SLA endpoint expose per-case status.

### US-132 — CSR export (case study report PDF)
- **As a** worker, **I want** to export a closed case as a Case Study Report (CSR) PDF **so that** the case is documented for records.
- **AC:** `GET /csr/:controlNo/pdf` (admin/social_worker/coordinator) returns `application/pdf` named `CSR <controlNo>-<YYYY>-<MM>-<DD>.pdf`; `GET /cases/:id/csr-pdf` (admin/social_worker) streams the same document; unknown case returns 404. Verified live: case page Case Study Report button (closed cases) downloads a valid `%PDF`.

### US-133 — Cases bulk export (CSV)
- **As a** worker/admin, **I want** to bulk-export a set of cases as CSV **so that** I can process reports offline.
- **AC:** `POST /cases/bulk-export` (admin/social_worker) with selected case ids returns `text/csv` attachment `cases-bulk-export.csv` with a header row + one row per case (controlNo, status, beneficiary, dates); exports are masked by default — pass `masked: false` with an `unmaskReason` for the unmasked variant; empty selection is handled client-side (button disabled).

### US-134 — Audit logs export
- **As an** admin/auditor, **I want** to export the audit log as CSV **so that** I can submit compliance attachments.
- **AC:** `GET /export/audit-logs?format=csv&startDate&endDate` (admin/auditor) returns `text/csv` with `Content-Disposition` attachment; rows include action, table, entity, actor, timestamp. CSV is the only format (the PDF variant was dropped).

### US-135 — Service summary export
- **As a** mayor/admin/auditor, **I want** to export the service summary as CSV or XLSX **so that** I can present utilization figures.
- **AC:** `GET /export/service-summary?format=csv|xlsx` (admin/mayor/auditor) returns the matching `Content-Type` (`text/csv` / spreadsheetml) attachment `service-summary.<ext>`; range filters `startDate`/`endDate` respected. PDF was dropped.

### US-136 — Monthly funds export
- **As a** mayor/admin/auditor, **I want** to export fund utilization as an Excel workbook **so that** I can review spending per month/range.
- **AC:** `GET /export/monthly-funds?month=YYYY-MM` or `?startDate&endDate` (admin/mayor/auditor) returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` attachment; bad or missing date params return 400 with a descriptive message.

### US-137 — Compliance report export
- **As a** mayor/admin/auditor, **I want** to export the compliance report as CSV **so that** I can verify statutory compliance.
- **AC:** `GET /export/compliance?format=csv` (admin/auditor/mayor) returns `text/csv` attachment; CSV is the only format.

### US-138 — Certificate of eligibility/referral
- **As a** worker/admin/coordinator, **I want** to generate a certificate (eligibility or referral) as a PDF **so that** the client gets an official certification.
- **AC:** `POST /export/certificate {type, fullName, address, date, details}` (admin/social_worker/coordinator) with `type: 'eligibility' | 'referral'` returns `application/pdf` attachment with a client-named filename; invalid type/body rejected 400 (the old `indigency` type was removed).

---

## 15. Admin Panel

### US-140 — User management
- **As an** admin, **I want** to create (dedicated page with 3NF name parts + agency), edit, role-change, and disable/enable users **so that** staff accounts are governed.
- **AC:** `/admin/users/new` posts camelCase name parts (`firstName`/`middleName`/`lastName`/`nameExtension`) + agency; provisioning issues a **one-time set-password link** (no temp password); accounts are disabled instead of deleted — `PATCH /users/:id/disable|enable` (admin) and there is **no delete endpoint**; the users table paginates server-side; status filter (`active|inactive`) wired end-to-end; edits send name parts; a disabled account is rejected at login and token issuance.

### US-141 — Sync Queue monitor
- **As an** admin, **I want** to monitor the sync queue (applied/pending/conflict/failed) **so that** offline data flows are healthy.
- **AC:** `GET /sync/conflicts/:deviceId` + `POST /sync/conflicts/:id/resolve` (admin/coordinator) drive the tab.

---

### US-152 — GIS export (case document PDF)
- **As a** worker/admin, **I want** to export a case as a GIS document PDF **so that** I have an official case document for filing and records.
- **AC:** `GET /cases/:id/gis-pdf` (admin/social_worker) returns an `application/pdf` attachment (`GIS <controlNo>-<YYYY>-<MM>-<DD>.pdf`); the PDF is populated from case + beneficiary data (control no, client fields, services) and matches the one-page DSWD form; renewal cases flag the renewal source; a missing case returns 404; blank beneficiary/person data still renders (blanks, never crashes). Verified live: case page GIS (PDF) button downloads a valid `%PDF` (93 KB) on the running stack.

## 16. Public Website

### US-150 — Public pages
- **As a** public visitor, **I want** Home, About, Contact, Announcements, Programs, Terms, Accessibility, and Privacy Policy pages **so that** the site is complete and compliant.
- **AC:** all routes render; footer links route to real pages; bounded 404 page covers unknown URLs; static pages have no a11y violations.

### US-151 — Public registration flow (full journey)
- **As a** walk-in client, **I want** to register, link my record, verify my email, and monitor my case with notifications **so that** I am served digitally end-to-end.
- **AC:** US-001 → US-002 → US-003 → US-028 pass in sequence (verified live on the stack).

## 17. 4Ps & LCR

### US-160 — 4Ps compliance schedule
- **As a** social worker, **I want** to generate the 12-month compliance schedule per household member **so that** conditionalities are trackable.
- **AC:** `POST /fourps/:caseId/generate-compliance` (admin/social_worker/coordinator) creates `case_compliance_items` per member per month (school_attendance for ages 3–18, health_checkup for under-3/Female spouse, fds for primary/spouse) and is idempotent (`ON CONFLICT DO NOTHING`); `GET /fourps/:caseId/compliance` returns totals/rate/byType/entries — claimant callers are ownership-scoped (404 for another household); `PATCH`/`DELETE /fourps/compliance/:id/meet` marks/unmarks an item met; marking met auto-logs a `4ps_compliance` access-card entry.

### US-161 — 4Ps payout schedules
- **As a** worker/admin, **I want** to schedule payouts and record their release **so that** 4Ps disbursement is tracked.
- **AC:** `POST|GET /fourps/:caseId/payouts` schedules/lists (cycleNo, scheduledAt, amount, status: scheduled); `PATCH /fourps/payouts/:id/status` sets completed|missed|cancelled — completing creates a `4Ps` case intervention and auto-logs `4ps_payout` to the access card; `POST /fourps/payouts/:id/notify` records `notifiedAt`/`notifiedBy`. Client pages `/cases/:caseId/4ps-compliance` and `/cases/:caseId/payouts` render the schedules (admin/social_worker/coordinator).

### US-162 — LCR record import (admin)
- **As an** admin, **I want** to import Local Civil Registrar records (birth/marriage/death) singly or in batch **so that** person records are seeded from official sources.
- **AC:** `POST /lcr/import` (admin) imports a single record; `POST /lcr/import-batch {records}` imports many at once.