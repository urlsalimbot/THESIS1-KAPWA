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
- **AC:** Register with matching details → `personMatched: true` + OTP delivered (SMS/email); `POST /auth/verify-person-link {email, code}` links the account (`personId` returned).
- **Verification:** after linking, the claimant dashboard shows the walk-in case status.

### US-003 — Email verification
- **As a** claimant, **I want** to verify my email via the link in the welcome email **so that** I can log in.
- **AC:** `POST /auth/verify-email {token}` succeeds; the link is built from `APP_URL`.
- **Verification:** login before verification is rejected with "verify your email"; after verification login works.

### US-004 — Login / refresh / logout
- **As a** user of any role, **I want** to log in with email + password **so that** I access my role-appropriate dashboard.
- **AC:** valid credentials → access + refresh tokens; invalid → 401; refresh endpoint rotates tokens; revoked session (password change/wipe) rejects refresh.
- **Verification:** each role logs in and is redirected per `ROLE_REDIRECT_MAP`.

### US-005 — MFA (TOTP)
- **As a** staff user, **I want** to enable a TOTP authenticator **so that** my account is protected.
- **AC:** setup returns a secret + URI; enable requires a valid 6-digit code; login with MFA issues a temp token then verifies the code; disable requires the current password.

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
- **AC:** `POST /intake` creates Person → Beneficiary → Household → Case (`enrolled`) → consent ledger; a new `controlNo` is generated; input validation (required fields, age ≥ 18 for claimant, DOB sanity) blocks invalid submissions.
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

### US-014 — Batch family submit
- **As a** worker, **I want** to add additional family members in a batch **so that** the household composition is complete.
- **AC:** `POST /intake/batch-family` links members to the existing case's household (no duplicate households).

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
- **AC:** `PATCH /cases/:id/status` to `assessed` blocked until the three fields exist; allowed for `social_worker`/`coordinator`; history + audit rows written.

### US-021 — Case lifecycle: assessed → in_review
- **As a** worker, **I want** to submit the case for review with FRVA/SWDI scores **so that** the head/admin reviews it.
- **AC:** transition requires at least one of `frvaScore`/`swdiScore`; only `social_worker` may request review.

### US-022 — Case lifecycle: in_review → active
- **As an** admin, **I want** to approve an in-review case **so that** services are implemented.
- **AC:** transition requires ≥ 1 logged intervention; admin/coordinator only; signature captured (`approvedBySignature`/`approvedByRole`).

### US-023 — Case lifecycle: active → transitioning
- **As an** admin, **I want** to move an active case toward phase-out **so that** graduation readiness is assessed.
- **AC:** requires `selfRelianceLevel` + `sustainabilityPlan`; admin only (FSM role matrix).

### US-024 — Case lifecycle: transitioning → closed
- **As a** worker/admin, **I want** to formally close a case **so that** the episode is documented.
- **AC:** requires `clientSignature` + `closureOutcome`; sets `closureDate`; CSR PDF available after closure.

### US-025 — Interventions
- **As a** worker, **I want** to log interventions against a case **so that** service delivery is tracked.
- **AC:** `POST /cases/:id/interventions` (service, amount, fund source, date); interventions auto-log to the household access card (`autoLogFromIntervention`); totals feed reports.

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

---

## 5. Access Cards

### US-040 — Household card lifecycle
- **As a** worker, **I want** every household to have one access card (auto-assigned) with manual assign/reprint fallback **so that** card-based accounting is consistent.
- **AC:** `ensureHouseholdCard` idempotent; `POST /access-cards/assign/:beneficiaryId` generates + syncs `households.access_card_code` and the person role; reprint keeps the same code.

### US-041 — Service logging & accounting (incl. 4Ps payouts/compliance)
- **As a** worker/agency staff, **I want** to log services (case services, referrals, community, seminars, **payouts**, **compliance**) against a card **so that** the card is the accounting ledger.
- **AC:** `POST /access-cards/log` accepts the six categories; entries carry date/cost/worker sign; card view tabs filter by category; the case page's Access Card Ledger shows counts + recent entries with quick-log dialogs.

### US-042 — QuickScan verification
- **As a** worker/agency, **I want** to scan a card code **so that** I verify the beneficiary and log a service instantly.
- **AC:** `GET /access-cards/:code` returns the person + card; summary aggregates `byCategory`.

### US-043 — Agency card summaries
- **As an** agency staff, **I want** to see services rendered by my agency and by others **so that** I coordinate assistance.
- **AC:** agency summary endpoint returns services split by origin; consent gating respected.

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
- **AC:** FSM-enforced transitions; referral to PNP/WCPD logged; dismissal requires a reason; override requires a reason + audit.

### US-053 — IRF exports
- **As a** worker, **I want** to export an IRF (PDF/JSON/WCPD format) **so that** records can be shared/printed.
- **AC:** each export endpoint produces the expected document; PDF includes masked-by-default names.

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
- **AC:** `GET /programs/public` returns active programs only, internal fields excluded; `/programs` page renders cards with fund sources + legal basis.

---

## 8. Notifications

### US-070 — In-app notifications
- **As a** user, **I want** notifications (case updates, approvals, disbursements, chat, sync conflicts, SLA escalations) **so that** I stay informed.
- **AC:** `GET /notifications/my` (latest 20), `GET /notifications/unread`, mark-one-read is ownership-scoped (404 on another user's id), read-all, realtime via the `/notifications` WebSocket.

### US-071 — Claimant case-update notifications
- **As a** claimant, **I want** push-style in-app case update notifications **so that** I monitor my case without checking manually.
- **AC:** a case transition creates a `case_update` notification for the claimant account; clicking navigates to `/my-dashboard`.

### US-072 — Notification preferences (channels)
- **As a** user, **I want** to opt in/out of email/SMS per category **so that** I control delivery.
- **AC:** `GET/PUT /notifications/preferences`; `send-with-consent` skips delivery when opted out (`consentSkipped`).

### US-073 — Email/SMS delivery
- **As a** system, **I want** transactional emails (verify/reset/OTP/notification) with delivery status **so that** delivery failures are visible.
- **AC:** send methods return booleans; `emailDelivered` surfaced on register/forgot-password; boot verifies SMTP (`transporter.verify`) and warns loudly in production when `EMAIL_HOST`/`APP_URL` are missing.

---

## 9. Referrals

### US-080 — Coordinator referral to MSWDO
- **As a** coordinator, **I want** to send a referral (name, barangay, reason) **so that** the MSWDO acts on it.
- **AC:** `GET /referrals/mine` + `POST` from `/coordinator/referrals/new`; status tracks pending/accepted/declined with decline reason.

### US-081 — Worker acceptance/decline
- **As a** worker, **I want** to accept or decline pending referrals **so that** the queue is managed.
- **AC:** `PATCH /referrals/:id/accept|decline`; declines require a reason; rows leave the pending list.

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
- **AC:** `queueChange` records offline ops; `POST /sync` deltas are Ed25519-signed, idempotent (24h TTL), conflict-resolved; version vectors track per-table versions; unknown meta fields rejected.

### US-111 — Conflict handling
- **As a** system, **I want** sync conflicts surfaced to the admin Sync Queue monitor **so that** they are resolved.
- **AC:** conflicts appear in `/admin` sync tab; resolution writes `conflict_reason`/`resolved_at`.

---

## 13. Audit & Compliance

### US-120 — Audit log (RA 10173 / COA)
- **As an** admin/auditor, **I want** a queryable audit log with user, action, record, details **so that** I can demonstrate compliance.
- **AC:** `/audit/logs` supports table/recordId filters + limit; admin Audit tab renders the real fields with action filter + refresh.

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
- **AC:** worker dashboard (cases, SLA), coordinator dashboard (referrals, access cards), agency dashboard (referrals, card activities), mayor reports, auditor page, claimant dashboard (case status, services, consent).

### US-131 — Case Tracker (SLA view)
- **As a** worker/mayor/auditor, **I want** a daily tracker with SLA status **so that** stale cases are visible.
- **AC:** `/tracker` lists cases with SLA state; SLA endpoint exposes per-case status.

---

## 15. Admin Panel

### US-140 — User management
- **As an** admin, **I want** to create (dedicated page with 3NF name parts + agency), edit, role-change, activate/deactivate, and delete users **so that** staff accounts are governed.
- **AC:** `/admin/users/new` posts snake_case parts matching the schema; the users table paginates server-side; status filter (`active|inactive`) wired end-to-end; edits send name parts.

### US-141 — Sync Queue monitor
- **As an** admin, **I want** to monitor the sync queue (applied/pending/conflict/failed) **so that** offline data flows are healthy.

---

## 16. Public Website

### US-150 — Public pages
- **As a** public visitor, **I want** Home, About, Contact, Announcements, Programs, Terms, Accessibility, and Privacy Policy pages **so that** the site is complete and compliant.
- **AC:** all routes render; footer links route to real pages; static pages have no a11y violations.

### US-151 — Public registration flow (full journey)
- **As a** walk-in client, **I want** to register, link my record, verify my email, and monitor my case with notifications **so that** I am served digitally end-to-end.
- **AC:** US-001 → US-002 → US-003 → US-028 pass in sequence (verified live on the stack).