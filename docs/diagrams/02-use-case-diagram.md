# Use Case Diagram

This document maps every actor of the KAPWA social welfare information system (MSWDO Norzagaray) to the use cases they can perform, expressed as a functional specification (FR-01..FR-20), eight Mermaid use case diagrams (one per role, each sized to fit a letter page), a per-actor narrative, and cross-references to the implementation.

## 1. Purpose

Maps every actor — guest, claimant, social_worker, coordinator, admin, mayor, auditor, agency_staff — to the use cases they can perform across all modules (auth, intake, cases, beneficiaries, referrals, inter-agency, programs, access cards, reports & audit, admin, messaging & notifications, sync), and ties each use case to its enforcing `@Roles` decorator and client route.

## 2. Functional Specification

| ID | Requirement |
|----|-------------|
| FR-01 | Guest/public user views the landing page and public announcements (routes `about`, `contact`, `announcements/:slug`). |
| FR-02 | Guest registers, verifies email (`POST /auth/verify-email`), logs in, and completes MFA challenge when MFA is enabled on the account. |
| FR-03 | Claimant views their own access card and service history via `GET /beneficiaries/me/access-card`, `GET /beneficiaries/me/services`, `GET /beneficiaries/me/consent` (all `@Roles('claimant')`). |
| FR-04 | Social worker creates intakes, assesses cases, logs interventions, manages beneficiary records, generates certificates/CSR/IRF, chats, and views notifications. |
| FR-05 | Coordinator files referrals (`POST /referrals`, `@Roles('coordinator')`), participates in intake match-check and confirmation (`POST /intake/match-check` and `POST /intake/confirm/:householdId` include coordinator), and manages access cards for their barangay (`POST /access-cards/assign/:beneficiaryId` includes coordinator). |
| FR-06 | Admin manages users (`users.controller`), programs (`/programs` routes admin-only), agencies (`agencies.controller`), announcements (`announcements.controller`), and wipe/reset (`admin/wipe` controller). |
| FR-07 | Mayor views reports/dashboard (`/reports`, dashboard `@Roles('mayor')` endpoint) and exports fund utilization (`GET /export/monthly-funds`, `@Roles('admin','mayor','auditor')`). |
| FR-08 | Auditor views audit logs (`audit.controller` `@Roles('admin','auditor')`) and exports data (`GET /export/audit-logs`, `@Roles('admin','auditor')`). |
| FR-09 | Agency staff views the agency dashboard and profile (`agency-portal.controller` is `@Roles('agency_staff','admin')`), inter-agency referrals (`inter-agency-referrals.controller` is `@Roles('admin','social_worker','agency_staff')`), and access-card activities (`access-cards.controller` includes agency_staff). |
| FR-10 | Role-appropriate notifications for admin, social_worker, coordinator, claimant, auditor, agency_staff (`NOTIFICATION_ROLES`); chat restricted to admin, social_worker, coordinator, claimant (`CHAT_ROLES`). |
| FR-11 | Offline sync for field workers: `sync.controller` `@Roles('admin','coordinator','social_worker')` endpoints queue and flush deltas when connectivity is lost. |
| FR-12 | Claimant dashboard (`/my-dashboard`, `@Roles('claimant')`) shows the claimant's card, service history, and notifications. |
| FR-13 | Announcements management for admin, social_worker, and coordinator (`announcements.controller` + `/announcements/manage` routes). |
| FR-14 | Referral review and approval: MSWDO staff accept/decline referrals (`PATCH /referrals/:id/accept|decline`, `@Roles('admin','social_worker')`); coordinators file and track them (`GET /referrals/mine`). |
| FR-15 | Physical files management for admin, social_worker, and coordinator (`physical-files.controller`). |
| FR-16 | Program management for admin only (`/programs/new`, `/programs/:id`, `/programs` routes; `programs` module). |
| FR-17 | IRF/CSR/certificate generation and management (`irf.controller`, `csr.controller`, `POST /export/certificate`; admin + social_worker, plus coordinator on certificate export and CSR detail/PDF, and auditor on IRF `:id` detail). |
| FR-18 | Settings and MFA setup/enable/disable/verify (`/settings`, `POST /auth/mfa/*`); available to every authenticated role. |
| FR-19 | Notification preferences: read and update per-role preferences (`GET|PUT /notifications/preferences`, `PUT /notifications/preferences/bulk`). |
| FR-20 | Admin wipe/reset: remote wipe a device or user session and list registered devices (`admin/wipe` controller, `@Roles('admin')`). |

## 3. Use Case Diagrams (Mermaid)

**Printing:** every diagram below is rendered to its own US-Letter-size PDF by `docs/diagrams/print-diagrams.mjs` (output in `docs/diagrams/print/`, one file per diagram) — run `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs` after editing.

One diagram per actor, so each fits a letter-size page together with its description in Section 4.

### R1 — guest

```mermaid
flowchart LR
    G["guest"]
    G --> UC1["View landing page and public announcements"]
    G --> UC2["Register and verify email"]
    G --> UC3["Login with MFA when enabled"]
```

### R2 — claimant

```mermaid
flowchart LR
    C["claimant"]
    C --> UC1["Claimant dashboard and self-service"]
    C --> UC2["View own access card and service history"]
    C --> UC3["View own consent records"]
    C --> UC4["Chat, notifications and preferences"]
    C --> UC5["MFA setup and account settings"]
```

### R3 — social_worker

```mermaid
flowchart LR
    SW["social_worker"]
    SW --> UC1["Create and review intakes"]
    SW --> UC2["Assess cases and log interventions"]
    SW --> UC3["Manage beneficiary records and physical files"]
    SW --> UC4["Generate certificates, CSR, IRF"]
    SW --> UC5["Review, accept or decline referrals"]
    SW --> UC6["Assign access cards and log activity"]
    SW --> UC7["Manage announcements"]
    SW --> UC8["Offline sync for field work"]
    SW --> UC9["Chat, notifications and preferences"]
```

### R4 — coordinator

```mermaid
flowchart LR
    CO["coordinator"]
    CO --> UC1["File and track barangay referrals"]
    CO --> UC2["Intake match-check and confirmation"]
    CO --> UC3["Manage access cards for barangay"]
    CO --> UC4["Manage physical files"]
    CO --> UC5["Offline sync for field work"]
    CO --> UC6["Chat, notifications and preferences"]
    CO --> UC7["MFA setup and account settings"]
```

### R5 — admin

```mermaid
flowchart LR
    AD["admin"]
    AD --> UC1["Manage users, programs, agencies"]
    AD --> UC2["Manage announcements"]
    AD --> UC3["Wipe or reset device sessions"]
    AD --> UC4["Intake, cases, referrals, access cards"]
    AD --> UC5["Certificates, CSR, IRF"]
    AD --> UC6["Audit logs and exports"]
    AD --> UC7["Notifications broadcast"]
    AD --> UC8["Offline sync"]
```

### R6 — mayor

```mermaid
flowchart LR
    MA["mayor"]
    MA --> UC1["View reports and dashboard"]
    MA --> UC2["Export fund utilization"]
    MA --> UC3["Read-only case tracking"]
```

### R7 — auditor

```mermaid
flowchart LR
    AU["auditor"]
    AU --> UC1["View audit logs"]
    AU --> UC2["Export audit data"]
    AU --> UC3["Read-only CSR, IRF, case tracker"]
    AU --> UC4["Notifications and preferences"]
```

### R8 — agency_staff

```mermaid
flowchart LR
    AS["agency_staff"]
    AS --> UC1["View agency dashboard and profile"]
    AS --> UC2["Inter-agency referrals"]
    AS --> UC3["Log access-card activity and read summaries"]
    AS --> UC4["Notifications and preferences"]
```

## 4. Diagram Narrative

**guest (A1).** Unauthenticated users reach the public shell: landing page, about/contact, and public announcements (FR-01). They register, verify email, log in, and complete an MFA challenge when enabled (FR-02). `auth.controller.ts` exposes `register`, `login`, `verify-email`, and the `mfa/verify` challenge without role restrictions.

**claimant (A2).** Claimants are redirected to `/my-dashboard` (`ROLE_REDIRECT_MAP['claimant']` in `kapwa-client/src/lib/role-access.ts`). They view their own access card, service history, and consent records via the claimant-only self endpoints `GET /beneficiaries/me/access-card`, `/me/services`, `/me/consent` (`@Roles('claimant')`), and their card at `/my-access-card` (FR-03, FR-12). Claimants chat (`CHAT_ROLES` includes claimant), receive notifications, and set notification preferences (FR-10, FR-19).

**social_worker (A3).** The primary caseworker role: creates intakes, reviews intakes, assesses cases, logs interventions, manages beneficiary records and physical files, and generates certificates/CSR/IRF (FR-04, FR-15, FR-17). They review and accept/decline coordinator referrals (FR-14), assign access cards and log card activity (FR-05), use offline sync in the field (FR-11), and participate in chat/notifications (FR-10).

**coordinator (A4).** Barangay coordinators are redirected to `/coordinator/dashboard`. They file referrals (`POST /referrals` is `@Roles('coordinator')` only), track their referral status via `/referrals/mine`, participate in intake match-check and confirmation (`POST /intake/match-check`, `POST /intake/confirm/:householdId` include coordinator), and manage access cards for their barangay (FR-05, FR-14). They manage physical files and sync offline data (FR-11, FR-15). Referral *approval* (accept/decline) is deliberately role-restricted to `admin` and `social_worker` — coordinators see status but cannot approve their own referrals.

**admin (A5).** Redirected to `/admin`. Admin is the only role on the user, agency (write), program, and wipe controllers: manages users, programs, agencies, announcements (FR-06), and remote wipes/resets (FR-20). Admin also has broad read/write access across intake, cases, referrals, access cards, and exports, plus audit-log access (`@Roles('admin','auditor')`), certificates/CSR/IRF, and notifications broadcast (`POST /notifications` is `@Roles('admin','social_worker')`).

**mayor (A6).** Redirected to `/reports`. Mayor-only dashboard/report endpoint (`dashboard.controller` `@Roles('mayor')`) and fund-utilization export (`GET /export/monthly-funds`) (FR-07). Also read-only case tracking (`/tracker` includes mayor).

**auditor (A7).** Redirected to `/audit-logs`. Reads audit logs and exports them as PDF/CSV (`export.controller` `GET /export/audit-logs`) (FR-08); also read-only access to CSR compliance, IRF details, and case tracker. Receives notifications and manages preferences (FR-10, FR-19).

**agency_staff (A8).** Redirected to `/agency/dashboard`. Views the agency dashboard and profile (`agency-portal.controller` is `@Roles('agency_staff','admin')`), logs access-card activity and reads card summaries (`access-cards.controller` includes agency_staff), and participates in inter-agency referrals (`inter-agency-referrals.controller` is `@Roles('admin','social_worker','agency_staff')`) (FR-09).

**Role restriction enforcement.** The client redirect map `ROLE_REDIRECT_MAP` (social_worker→`/dashboard`, admin→`/admin`, coordinator→`/coordinator`, claimant→`/my-dashboard`, mayor→`/reports`, auditor→`/audit-logs`, agency_staff→`/agency/dashboard`) mirrors the server-side `@Roles` decorators, which are the authoritative gate: role-scoped endpoints are protected by `JwtAuthGuard` + `RolesGuard` (plus `AbacGuard` on referrals), some endpoints are `JwtAuthGuard`-only (e.g. profile and MFA routes in `auth.controller.ts`), and the public landing/announcements routes (`announcements-public.controller.ts`) are completely unguarded. `NOTIFICATION_ROLES` and `CHAT_ROLES` in `role-access.ts` are documented to mirror the `notifications.controller` and `chat.controller` decorators. Settings/MFA (FR-18) is the only use case open to every authenticated role (no role restriction on `/settings`).

## 5. Cross-References

| Item | Location |
|------|----------|
| Route table (52 routes) | `kapwa-client/src/routes.tsx` |
| Role redirect map, notification roles, chat roles | `kapwa-client/src/lib/role-access.ts` (`ROLE_REDIRECT_MAP`, `NOTIFICATION_ROLES`, `CHAT_ROLES`) |
| Auth (register, login, MFA, verify-email) | `kapwa-server/src/auth/auth.controller.ts` |
| Intake (create, review) | `kapwa-server/src/intake/intake.controller.ts` |
| Cases + interventions | `kapwa-server/src/cases/cases.controller.ts`, `kapwa-server/src/case-interventions/case-interventions.controller.ts` |
| Beneficiaries (claimant self endpoints) | `kapwa-server/src/beneficiaries/beneficiaries.controller.ts` |
| Referrals (coordinator file, MSWDO review) | `kapwa-server/src/referrals/referrals.controller.ts` |
| Inter-agency referrals | `kapwa-server/src/inter-agency-referrals/inter-agency-referrals.controller.ts` |
| Access cards (assign, log, claimant view) | `kapwa-server/src/access-cards/access-cards.controller.ts` |
| Export (audit logs, fund utilization, certificate) | `kapwa-server/src/export/export.controller.ts` |
| Audit logs | `kapwa-server/src/audit/audit.controller.ts` |
| Announcements | `kapwa-server/src/announcements/announcements.controller.ts` |
| Agencies | `kapwa-server/src/agencies/agencies.controller.ts` |
| Users (admin only) | `kapwa-server/src/users/users.controller.ts` |
| Physical files | `kapwa-server/src/physical-files/physical-files.controller.ts` |
| Offline sync | `kapwa-server/src/sync/sync.controller.ts` |
| Notifications + preferences | `kapwa-server/src/notifications/notifications.controller.ts` |
| Chat | `kapwa-server/src/chat/chat.controller.ts` |
| IRF / CSR / admin wipe | `kapwa-server/src/irf/irf.controller.ts`, `kapwa-server/src/csr/csr.controller.ts`, `kapwa-server/src/admin/admin-wipe.controller.ts` |
| End-to-end system walkthrough | `docs/e2e-full-system.md` |
