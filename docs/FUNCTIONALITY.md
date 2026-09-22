# KAPWA System — Full Functionality

The KAPWA Municipal Social Welfare and Development Office (MSWDO Norzagaray) system: a two-app monorepo for the social-welfare case lifecycle, from public walk-in intake through case closure, with field/mobile support and audit compliance.

- `kapwa-server/` — NestJS 11 + TypeORM + PostgreSQL REST/WebSocket backend (entrypoint `src/main.ts`).
- `kapwa-client/` — React 19 + Vite + Tailwind/Radix UI + SWR (PWA), entrypoint `src/main.tsx`.

---

## 1. Roles & Access Control

Seven roles, each with a distinct surface and scope:

| Role | Scope | Primary surface |
|---|---|---|
| `admin` | Global | Dashboard, Intake, Cases, Admin Panel, Approvals, all exports |
| `social_worker` | Assigned / permitted barangays | Intake, Cases, Beneficiaries, IRFs, Referrals, Approvals (view) |
| `coordinator` | Assigned barangay | Coordinator dashboard, barangay referrals, access cards, messages |
| `agency_staff` | Agency | Agency dashboard, inter-agency referrals, card activities, agency summaries |
| `claimant` | Represented beneficiary (own or linked) | My Dashboard, My Access Card (read-only), document uploads, disbursement receipts, messages, consent |
| `mayor` | Read-only municipality | Mayor reports, tracker, SLA |
| `auditor` | Read-only | Audit logs, tracker, compliance exports |

**Access model** — three layers, applied via guards and an ABAC service:
- **RBAC** — route/controller `@Roles(...)`.
- **ABAC** — barangay scoping: coordinators see only their `assignedBarangay`; social workers their `permittedBarangays`; claim range; agency staff scoped to their `agency_id`.
- **Consent gating** — resource sensitivity (`public` / `internal` / `sensitive` / `restricted`) enforced against the `consent_ledger` (RA 10173).

---

## 2. Authentication & Session

- **Login** — email + password (bcrypt, 12 rounds) → JWT **access (1h)** + **refresh (7d)** + user payload.
- **Refresh** — silent rotation; a session in one tab never revokes another (multi-session stable); revocation still works on password/email change.
- **MFA (optional)** — two methods: TOTP (authenticator app) and email OTP. Setup/enable at `/auth/mfa/setup|enable` and `/auth/mfa/email/setup|enable`; MFA-enabled accounts present a 6-digit challenge at login, verified at `/auth/mfa/verify` (TOTP) or `/auth/mfa/email/verify` (email, with `/auth/mfa/email/resend`). Email codes are SHA-256-hashed, single-use, expire in 5 minutes, and require a verified email (seed demo: `ana.claimant@test.com`). SMS OTP is not offered (no SMS provider configured on the API server).
- **Person-link (claimant)** — registration links an account to an existing beneficiary record via OTP code (`verify-person-link`), which drives the claimant's case visibility.
- **Email verification** — verify-account, forgot/reset password, email-change confirm, OTP (send-only until SMTP is configured; log-only fallback).
- **Session-expiry UX** — when a session dies (expired or network), the login page explains why instead of silently redirecting.
- Logout clears tokens + drafts; a `storage` event syncs logout across tabs.

---

## 3. Public Website & Registration

- Home (hero, announcements, services, about, contact), Programs, Announcements, Terms, Privacy Policy, Accessibility, About — all with a11y-tested static pages.
- **Claimant registration** — name parts, phone, barangay, DOB, password; creates a `claimant` account; checks against existing beneficiary records for person-link.
- **Contact form** → stored in the in-app **contact inbox** and notifies admins/social workers (no mailbox required).

---

## 4. Intake

One intake submission creates the full client record:

- **Beneficiary + claimant + family composition** (spouse/children, relationships, DOB, income) in a structured 3NF schema (persons, addresses, contacts).
- **Household** creation and beneficiary↔household linkage.
- **Auto access card** — `ensureHouseholdCard` generates and assigns a unique household card code at enrollment (idempotent; reprints keep the code).
- **Case** created `enrolled` with a generated `control_no` (e.g. `KAPWA-2026-00007`), requested services, assigned worker, consent ledger row, and renewal support (`renewalOfCaseId` links a new cycle to a prior case).
- Offline-capable intake with autosave drafts.

---

## 5. Case Lifecycle (FSM + Stepper)

```
enrolled → assessed → in_review → active → transitioning → closed
```

| Step | Requirement to complete |
|---|---|
| **Assess & Interview** | problems presented, social-worker assessment, client category (FRVA/SWDI) |
| **Intervention & Requirements** | ≥ 1 intervention logged **and** every required document of the linked program(s) filed; admin approval, then manual **Issue COE** / **Issue PCV** |
| **Inter-agency Referrals** | a referral is issued, or "no referral needed" is recorded |
| **Evaluate Help Given** | self-reliance level + sustainability plan; level ≥ 3 guides closure, below guides renewal |
| **Case Study & Closure** | client signature + closure outcome; the merged CSR bundle is available |

- Transitions are role-checked by the FSM (`canTransition`); approvals capture `approvedBySignature` / `approvedByRole`.
- **Approval documents are issued manually** — an admin generates the Certificate of Eligibility and Petty Cash Voucher from the case view (`POST /cases/:id/issue-coe`, `issue-pcv`) once the case is active; both are idempotent and viewable by admin + social workers in the case view.
- **Case stepper** visualizes the five steps across three phases (Phase-In / Implementation / Phase-Out) with shared completion logic.
- History + audit rows are written per transition; case updates notify the assigned worker **and** the linked claimant account.
- Renewal reuses the beneficiary/household/card for the next cycle.
- Case documents (certificate, petty cash voucher) are stored via the filing vault.

---

## 6. Interventions & Access Cards

- **Interventions** — logged against a case with program link, service name, category, delivery date, amount, mode, fund source, notes, delivered-by; required before activation; auto-logged to the household access card.
- **Access cards** — household-tied and persistent across case life cycles (new/renewed/reopened cases reuse the same card). Unique codes (unique-index enforced).
- **Service ledger** — six categories: `case_service`, `referral`, `community_service`, `seminar`, `payout`, `compliance`; auto-fed by interventions, with manual logging.
- **QuickScan** — `GET /access-cards/:code` resolves the beneficiary + card with category summary.
- **Agency summaries** — services split by originating agency, consent-gated.
- **Printable card** — 2-page A4 Family Access Card PDF (`ACCESS CARD <code>-<date>.pdf`) from the beneficiary's card page.

---

## 7. IRF (Incident Report Forms)

- Create within a case (category: Abuse / Neglect / Exploitation / Criminal); **narration encrypted** via key-wrap/pgcrypto; blotter entry number per IRF.
- **Decrypt / unmask** gated by role + legal-basis code; WCPD/PNP export; **password-protected PDF** export; JSON export; IRF audit of accesses.
- Exported filenames follow the shared convention (`IRF <blotter>-<date>.pdf`).

---

## 8. Programs, Announcements, Referrals

- **Programs** — categories, waiting periods, legal basis, fund sources, required documents, approval workflow steps, and a JSON-schema form template; public read-only listing; program-linked interventions.
- **Announcements** — published/draft management (admin/social-worker/coordinator), public display, photo attachments.
- **Referrals** — **barangay referrals** (coordinator → MSWDO, with review) and **inter-agency referrals** (to RHU/WCPD/PESO/DILG/DSWD/DepEd, with `promote-to-case`).

---

## 9. Chat & Notifications

- **Messages** between workers, coordinators, and claimants (role-gated), popover + page surfaces, WebSocket real-time.
- **Notifications** — categories (case update, approval, disbursement, sync conflict, system), channels (in-app; SMS when an SMS provider is configured), per-category user preferences, consent-aware delivery; alerts feed dashboards (e.g. SLA escalations).

---

## 10. Offline Sync (mobile)

- **Sync queue** + version vectors + idempotency keys for offline mutations (intake, case updates).
- **Conflict resolution** UI; pending-sync indicators and offline banner; device-aware sync; sync admin panel (queue, conflicts).

---

## 11. Audit & Compliance

- **Audit log** — every action (case transitions, IRF decrypts, unmasked exports, user management) with a **hash-chain** integrity check (`verifyAllChains`), pgAudit at the DB layer.
- **Exports**: audit-log PDF/CSV (action, table, entity, actor, timestamp), service summary (pdf/csv/xlsx), monthly fund utilization (xlsx), compliance (pdf/csv), certificates (indigency/eligibility/referral).
- **Consent ledger** for RA 10173; PII masking on bulk/list surfaces; data-privacy notices in UI.

---

## 12. Case-Document Exports

All case-document PDFs use one naming convention — **`<CaseType> <caseNo>-<YYYY>-<MM>-<DD>.pdf`** (export date, Asia/Manila):

- **GIS** — `GET /cases/:id/gis-pdf` → `GIS KAPWA-2026-00008-2026-09-09.pdf`
- **CSR (Case Study Report)** — `GET /cases/:id/csr-pdf` and `GET /cases/csr/:controlNo/pdf` (admin/social-worker/coordinator) → `CSR …`. The export is a **merged PDF bundle**: cover page + Petty Cash Voucher + Certificate of Eligibility + IRF (when the case has one) + GIS.
- **COE / PCV** — issued manually by an admin from the case view (`POST /cases/:id/issue-coe`, `POST /cases/:id/issue-pcv`) once the case is active; not generated automatically at approval.
- **IRF** — `POST /irf/:id/export-pdf` (password in the JSON body, never the URL) → `IRF <blotter>-…`
- **Access card** — `ACCESS CARD <code>-…`
- **Cases bulk CSV** — `POST /cases/bulk-export` (masked by default; unmasked requires a justification + audit).

---

## 13. Dashboards & Reporting

- **Admin / worker** — stat cards (served today, pending review, overdue SLA, disbursed month, households served), **Trends** (two split charts: cases + disbursed, with a **1 Week / 1 Month / 3 Months / 6 Months** selector — 1w Monday-anchored, 1m whole calendar month, 3m/6m whole months), case-status chart, activity calendar, barangay breakdown, SLA widget, needs-attention, recent cases (client category, formatted dates, ≤10 rows, Open Tracker button).
- **Coordinator** — barangay-scoped dashboard, referrals, access cards.
- **Mayor** — reports + tracker + SLA.
- **Auditor** — audit logs + tracker.
- **Claimant** — My Dashboard (case status, case details: control no, worker, amount, services requested, service history, required-document uploads, disbursement records/receipts, consent handling) + My Access Card (read-only ledger).

---

## 14. Admin Panel

- **Users** — list (10/page), create, roles, barangay assignments, agency links, activate/deactivate.
- **Sync Queue**, **Audit Log** (filterable, hash-chain verified).
- **Contact Messages** — inbox with unread badge, mark-read, staff notifications.

---

## 15. Demo & Seed Data

A full demo dataset seeds the system (idempotent, re-runnable): all role accounts (+ MFA demo), 8 cases across every lifecycle stage, household access cards with six-category ledgers, an IRF, a renewal case, inter-agency + barangay referrals, announcements, claimant person-links, and current-month activity so every dashboard surface is populated.

---

## Deployment

Podman/Docker Compose: `postgres` (pgcrypto, pg_trgm, pgaudit), `minio` (object storage), `api` (NestJS), `client` (nginx-served SPA), `caddy` (reverse proxy, rate-limited, security headers). The API exposes Swagger at `/api/docs` and runs the idempotent fresh-boot schema bootstrap at startup.