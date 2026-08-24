# Program Specification

Functional specification of every server program (module) in the KAPWA system, plus the client shell. Each module section follows one template: purpose, functional requirements, inputs, processing rules, outputs, endpoints, client surfaces, and dependencies.

## 1. Purpose

Documents the program-level specification of the KAPWA MSWDO social welfare system — the 26 server feature modules and the React client shell — so that each program's inputs, processing rules, outputs, and interfaces are fully specified and traceable to the functional requirements of the system.

## 2. Program Specifications

### P-01: Authentication (AuthModule)

- **Purpose:** Registers and authenticates users (MSWDO staff, coordinators, claimants, agency staff, mayor, auditor), issues JWTs, and manages MFA, email verification, and password recovery.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | A user SHALL log in with email + password; on success the API SHALL return an access token and the user profile. |
| FR-AUTH-02 | When MFA is enabled for the account, login SHALL return an MFA challenge with a short-lived temporary token; the user SHALL verify with an OTP. |
| FR-AUTH-03 | The refresh flow SHALL rotate tokens; a revoked/invalid refresh token SHALL force re-login. |
| FR-AUTH-04 | Registration SHALL create an account (schema default role `social_worker`; service fallback intends `claimant`) and SHALL require email verification before first login. |
| FR-AUTH-05 | Forgot/reset password SHALL be email-based with expiry; reset SHALL invalidate prior tokens (token version bump). |

- **Inputs:** LoginDto (email, password), RegisterDto (name, email, phone, password), MfaVerifyDto (code), refresh token, forgot/reset DTOs.
- **Processing:** bcrypt password hashing; JWT access + refresh issuance; MFA challenge (temp token 5 min); email verification token; refresh token rotation with `token_version` check/bump; single-flight 401 refresh on the client.
- **Outputs:** accessToken, user profile, MFA challenge object, verification emails.
- **Endpoints:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/login/otp-verify`, `POST /auth/mfa/setup`, `POST /auth/mfa/enable`, `POST /auth/mfa/disable`, `POST /auth/mfa/verify`, `POST /auth/change-password`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-email`, `POST /auth/confirm-email-change`, `POST /auth/update-phone`, `POST /auth/request-person-link`, `POST /auth/verify-person-link` (19 routes).
- **Client surfaces:** LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, MfaSetupPage, SettingsPage (MFA).
- **Dependencies:** UsersModule (UserRepository), OtpModule, EmailModule, JwtModule.

### P-02: Synchronization (SyncModule)

- **Purpose:** Enables offline field work: devices push change deltas and pull server state with signature verification, idempotency, and conflict resolution.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-SYNC-01 | A device SHALL push signed deltas; the server SHALL reject requests with an invalid Ed25519 signature. |
| FR-SYNC-02 | The server SHALL reject payloads containing unknown underscore-prefixed meta fields (only `_fsmTransition` and `_clientUpdatedAt` allowed). |
| FR-SYNC-03 | Replayed requests with the same idempotency key SHALL return the cached result (TTL 86,400,000 ms). |
| FR-SYNC-04 | Conflicts on financial tables (interventions, disbursements, financial_assistance, case_interventions, access_card_services) SHALL resolve server-wins. |
| FR-SYNC-05 | Applied FSM transitions SHALL be re-validated against the shared case FSM. |

- **Inputs:** SyncPushDto (deviceId, changes, versionVectors, idempotencyKey, signature), pull query params.
- **Processing:** pre-flight meta-field rejection → Ed25519 signature verify → idempotency lookup → apply changes (transactional, SERIALIZABLE where needed) → conflict resolution (server-wins for financial tables, notes appended) → FSM re-validation → version vector update.
- **Outputs:** applied changes, resolved conflicts, fresh version vectors, queued/pending statuses.
- **Endpoints:** `POST /sync/v1` (delta push), `POST /sync/pull`, `GET /sync/conflicts/:deviceId`, `POST /sync/conflicts/:id/resolve` (4 routes).
- **Client surfaces:** `lib/offline-queue.ts`, `hooks/useConnectivity.ts`, `hooks/useSyncStatus.ts`, Topbar offline/pending badges.
- **Dependencies:** SyncQueueEntity, VersionVectorEntity, IdempotencyKeys, CasesModule (case-fsm).

### P-03: Case Management (CasesModule)

- **Purpose:** Manages the social welfare case lifecycle from enrollment through assessment, review, active service, transition, and closure.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-CASE-01 | A case SHALL be created referencing one beneficiary with status `enrolled`. |
| FR-CASE-02 | Transitions SHALL follow the shared FSM (`CASE_FSM`); invalid transitions SHALL return 400. |
| FR-CASE-03 | Role guards SHALL enforce transitions via `CASE_FSM_ROLES`; disburse (`ACTIVE`→`TRANSITIONING`) is admin-only; admin SHALL override any role check. |
| FR-CASE-04 | Precondition guards SHALL apply per status (assessment complete, FRVA/SWDI, intervention count, sustainability plan, signature/outcome). |
| FR-CASE-05 | Every transition SHALL append a `case_history` record with from/to status and transition type. |

- **Inputs:** CreateCaseDto, UpdateCaseDto, transition requests (status, userRole, notes).
- **Processing:** FSM validation (`isValidTransition`) → role check (`canTransition`) → precondition guards → status update → case_history append → worker notification.
- **Outputs:** case records, case history, notifications, control numbers.
- **Endpoints:** CRUD on `/cases` + `PATCH /cases/:id/status` (21 routes incl. tracker).
- **Client surfaces:** CasesPage, CaseViewPage (FSM timeline + confirm dialogs), CaseTrackerPage, DashboardPage (case metrics).
- **Dependencies:** BeneficiariesModule, ProgramsModule, case-fsm.ts, CaseHistoryEntity.

### P-04: Programs (ProgramsModule)

- **Purpose:** Maintains the social service program catalog (categories, fund sources, approval workflows, form templates).
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-PROG-01 | Admin SHALL create/update programs with name, category, waiting period, required documents, fund sources, approval workflow, and form template. |
| FR-PROG-02 | Program form templates SHALL be versioned via `form_version_history` (ON DELETE CASCADE on program). |

| FR-PROG-03 | Only admin SHALL modify the program catalog; program data SHALL drive intake and intervention options. |
- **Inputs:** CreateProgramDto / UpdateProgramDto.
- **Processing:** CRUD with validation; version capture on template change.
- **Outputs:** program records, form version history.
- **Endpoints:** CRUD on `/programs` (5 routes).
- **Client surfaces:** ProgramsPage, ProgramDetailPage, CreateProgramPage.
- **Dependencies:** FormVersionHistoryEntity.

### P-05: Beneficiaries (BeneficiariesModule)

- **Purpose:** Manages person records, beneficiary registrations, households, household memberships, beneficiary claimants, and consent.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-BEN-01 | Persons SHALL be the unified identity table; beneficiaries SHALL wrap a person record. |
| FR-BEN-02 | A beneficiary SHALL belong to at most one household via `household_memberships` (partial unique index on person_id+household_id). |
| FR-BEN-03 | Claimants SHALL link to beneficiaries via `beneficiary_claimants` with a relationship type. |
| FR-BEN-04 | A claimant SHALL retrieve their own access card and service history via `GET /beneficiaries/me/access-card`. |
| FR-BEN-05 | Consent events SHALL be append-only in `consent_ledger`. |

- **Inputs:** person/beneficiary DTOs, household links, claimant links, consent updates.
- **Processing:** person find-or-create (dedup by philhealth number or name+DOB+barangay), beneficiary creation, household membership linking, consent ledger writes.
- **Outputs:** person/beneficiary records, household memberships, access card data.
- **Endpoints:** CRUD on `/beneficiaries`, `/beneficiaries/me/access-card`, `/beneficiaries/me/services`, `/beneficiaries/me/consent` (10 routes).
- **Client surfaces:** BeneficiariesPage, BeneficiaryViewPage, ClaimantDashboardPage, ClaimantAccessCardPage.
- **Dependencies:** Persons, Households, HouseholdMemberships, BeneficiaryClaimants, ConsentLedger entities.

### P-06: Notifications (NotificationsModule)

- **Purpose:** Delivers in-app notifications with realtime WebSocket push and REST fallback.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-NOTIF-01 | Notifications SHALL be created with recipient, title, message, category, and channel; in-app delivery via WebSocket `user:{id}` rooms. |
| FR-NOTIF-02 | Users SHALL list, mark read, mark-all-read, and delete their notifications. |
| FR-NOTIF-03 | Notification preferences SHALL allow per-user opt-in by channel and category. |
| FR-NOTIF-04 | Access SHALL be role-gated: admin, social_worker, coordinator, claimant, auditor, agency_staff. |

- **Inputs:** CreateNotificationDto (title, message, category, recipientId), preference DTOs.
- **Processing:** persist notification → emit `notification:new` via gateway → mark read operations.
- **Outputs:** notification records, unread counts, realtime pushes.
- **Endpoints:** `/notifications` my/unread/read/read-all/preferences (12 routes).
- **Client surfaces:** NotificationsPage, NotificationsDropdown (Topbar), Toaster.
- **Dependencies:** NotificationsGateway, NotificationPreference entity.

### P-07: Incident Report Forms (IrfModule)

- **Purpose:** Manages IRF/blotter records with encrypted narration and disposition workflow.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-IRF-01 | Staff SHALL create IRF cases with blotter entry numbers (yearly sequence) and encrypted narration. |
| FR-IRF-02 | IRF detail SHALL be viewable by admin, social_worker, and auditor. |

| FR-IRF-03 | IRF records SHALL carry the yearly blotter sequence (BLT-{year}-{seq}) and SHALL be readable by the authorized roles. |
- **Inputs:** IRF DTOs (person data, narration, disposition, signatures).
- **Processing:** blotter sequence allocation, encryption of narration, case linkage.
- **Outputs:** IRF records, blotter numbers, encrypted narration blobs.
- **Endpoints:** CRUD + detail on `/irf` (15 routes).
- **Client surfaces:** IrfPage, CreateIrfPage, IrfDetailPage.
- **Dependencies:** irf-blotter-seq, Encryption service.

### P-08: Dashboard (DashboardModule)

- **Purpose:** Aggregates operational metrics for staff and the mayor's executive view.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-DASH-01 | Staff dashboards SHALL show case counts, pending items, and recent activity. |
| FR-DASH-02 | The mayor endpoint SHALL be restricted to the mayor role and include fund/operational summaries. |

| FR-DASH-03 | Dashboard metrics SHALL be scoped by the requesting user's role (staff, coordinator, mayor). |
- **Inputs:** none (role-derived).
- **Processing:** aggregate counts by status/barangay/agency.
- **Outputs:** metrics JSON.
- **Endpoints:** `/dashboard/*` (7 routes incl. mayor report).
- **Client surfaces:** DashboardPage, MayorReportsPage, CoordinatorDashboardPage, AgencyDashboardPage.
- **Dependencies:** Cases, Beneficiaries.

### P-09: Chat (ChatModule)

- **Purpose:** In-app messaging between admin, social workers, coordinators, and claimants.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-CHAT-01 | Users in the chat roles (admin, social_worker, coordinator, claimant) SHALL send and receive messages. |
| FR-CHAT-02 | Conversations SHALL be scoped per conversation id with read tracking. |

| FR-CHAT-03 | Unread message counts SHALL be tracked per conversation and surfaced to the recipient. |
- **Inputs:** message DTOs (content, conversationId, recipientId).
- **Processing:** persist message, mark read, realtime emit.
- **Outputs:** chat messages, conversation lists.
- **Endpoints:** `/chat/*` (6 routes).
- **Client surfaces:** MessagesPage, MessagesPopover (Topbar).
- **Dependencies:** Chat entity, gateway.

### P-10: Case Study Reports (CsrModule)

- **Purpose:** Produces case study reports (CSR) with narrative sections and PDF output.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-CSR-01 | Staff SHALL create CSR reports with structured sections (family background, assessment, recommendation, intervention plan). |
| FR-CSR-02 | CSR SHALL export to PDF (admin, social_worker, coordinator). |

| FR-CSR-03 | CSR records SHALL be finalizable; finalized reports SHALL be immutable. |
- **Inputs:** CSR DTOs (caseId, sections, signatures).
- **Processing:** create/update, finalize, PDF generation.
- **Outputs:** CSR records, PDFs.
- **Endpoints:** CRUD + pdf on `/csr` (6 routes).
- **Client surfaces:** CSR section of CaseViewPage / BeneficiaryViewPage.
- **Dependencies:** Cases, Export.

### P-11: Audit (AuditModule)

- **Purpose:** Records and exposes audit log entries for the auditor role.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-AUDIT-01 | Audit log entries SHALL be recorded for sensitive operations (admin, mayor, auditor, social_worker, coordinator). |
| FR-AUDIT-02 | Audit log access SHALL be admin/auditor only. |

| FR-AUDIT-03 | Audit log entries SHALL NOT be editable or deletable by any role. |
- **Inputs:** audit event data.
- **Processing:** append-only audit_log writes, query with filters.
- **Outputs:** audit log entries.
- **Endpoints:** `/audit/logs` (4 routes).
- **Client surfaces:** AuditPage, AuditorPage.
- **Dependencies:** audit_log entity.

### P-12: Export (ExportModule)

- **Purpose:** Generates compliance and documentary outputs: certificates (PDF), monthly fund utilization (XLSX), and CSV/Excel exports.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-EXP-01 | The system SHALL generate certificates of indigency/eligibility/referral as PDF (`POST /export/certificate`; admin, social_worker, coordinator). |
| FR-EXP-02 | The system SHALL generate a monthly fund utilization workbook (`GET /export/monthly-funds?month=YYYY-MM`; admin, mayor, auditor), aggregating case interventions on transitioning cases. |
| FR-EXP-03 | Exports SHALL set Content-Disposition with a proper filename; the client SHALL download and parse it. |

- **Inputs:** certificate type + data; month string (validated `^\d{4}-(0[1-9]|1[0-2])$`).
- **Processing:** pdfkit certificate generation; exceljs workbook with program × fund source aggregation; SQL join cases.status='transitioning'.
- **Outputs:** PDF buffers, XLSX buffers, CSV streams.
- **Endpoints:** `POST /export/certificate`, `GET /export/monthly-funds`, plus audit-logs/service-summary/compliance exports (5 routes).
- **Client surfaces:** MayorReportsPage, DashboardPage (fund download), BeneficiaryViewPage, CaseViewPage (certificates), AuditPage.
- **Dependencies:** pdfkit, exceljs, csv-stringify.

### P-13: Filing (FilingModule)

- **Purpose:** Stores and retrieves case/beneficiary files in the local uploads directory.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-FIL-01 | Files SHALL be uploaded and stored on the server's uploads directory, linked to a case and/or beneficiary. |
| FR-FIL-02 | Files SHALL be downloadable by authorized roles; stale files SHALL be cleanable. |

| FR-FIL-03 | Stale uploads SHALL be cleanable via the cleanup endpoint. |
- **Inputs:** multipart uploads, file metadata.
- **Processing:** store file in `uploads/`, persist document_vault record, download + cleanup operations.
- **Outputs:** file records, download streams.
- **Endpoints:** `POST /filing/upload`, `GET /filing`, `GET /filing/:id`, `GET /filing/:id/download`, `DELETE /filing/:id`, `DELETE /filing/cleanup` (6 routes).
- **Client surfaces:** PhysicalFilesPage (implemented, unrouted), CaseViewPage file section.
- **Dependencies:** document_vault entity.

### P-14: Users (UsersModule)

- **Purpose:** Admin management of user accounts and roles.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-USER-01 | Admin SHALL create, update, activate/deactivate, and assign roles to users. |
| FR-USER-02 | Agency staff SHALL be linked to their agency via `agency_id`. |

| FR-USER-03 | User changes SHALL be audit-logged for accountability. |
- **Inputs:** user admin DTOs (email, role, agency, active).
- **Processing:** CRUD with role/agency validation.
- **Outputs:** user records.
- **Endpoints:** `/users/*` (5 routes).
- **Client surfaces:** AdminPage (UsersPanel).
- **Dependencies:** User entity, Agencies.

### P-15: Access Cards (AccessCardsModule)

- **Purpose:** Assigns and manages beneficiary access cards and their service logs.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-AC-01 | Staff SHALL assign access cards to beneficiaries; card codes SHALL be unique and yearly-sequenced. |
| FR-AC-02 | Service logs SHALL be recorded per card with date, service, and cost. |
| FR-AC-03 | The card summary SHALL be retrievable by code (Quick Scan) and the card print view SHALL render for download. |

- **Inputs:** card assignment DTOs, service log DTOs, card code.
- **Processing:** sequence allocation, service log persistence, summary aggregation (incl. other-agency services when consent active).
- **Outputs:** card records, service logs, summaries, print views.
- **Endpoints:** `/access-cards/*` (7 routes incl. assign, services, summary).
- **Client surfaces:** AccessCardViewPage, AccessCardPrintView, CoordinatorAccessCardsPage, QuickScanCard (CoordinatorDashboard), AgencyCardActivitiesPage.
- **Dependencies:** access_card_seq, access_card_services, Beneficiaries.

### P-16: Case Interventions (CaseInterventionsModule)

- **Purpose:** Records interventions/services delivered per case.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-CI-01 | Interventions SHALL attach to a case and optionally a program, with service name, delivery date, amount, mode, and fund source. |

| FR-CI-02 | Intervention records SHALL be editable and deletable by authorized staff; deletions SHALL be audit-logged. |
| FR-CI-03 | Intervention aggregates SHALL feed the monthly fund utilization report. |
- **Inputs:** intervention DTOs.
- **Processing:** CRUD; aggregation for fund utilization reports.
- **Outputs:** intervention records.
- **Endpoints:** `GET /cases/:caseId/interventions`, `POST /cases/:caseId/interventions`, `PATCH /cases/:caseId/interventions/:id`, `DELETE /cases/:caseId/interventions/:id` (4 routes).
- **Client surfaces:** CaseViewPage intervention section.
- **Dependencies:** case_interventions entity, Programs.

### P-17: Civil Registry Lookup (LcrModule)

- **Purpose:** Imports civil registry (LCR) records into the person/beneficiary tables for identity verification.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-LCR-01 | Admin SHALL import LCR records (single or batch) into the person/beneficiary data. |

| FR-LCR-02 | Imports SHALL be idempotent (re-importing the same record SHALL NOT duplicate it). |
| FR-LCR-03 | Imports SHALL be restricted to the admin role. |
- **Inputs:** import DTOs (record payloads).
- **Processing:** validate and upsert into person/beneficiary tables.
- **Outputs:** imported records, import results.
- **Endpoints:** `POST /lcr/import`, `POST /lcr/import-batch` (2 routes).
- **Client surfaces:** admin import tooling.
- **Dependencies:** Beneficiaries (person/beneficiary entities).

### P-18: Service Level Agreements (SlaModule)

- **Purpose:** Tracks service-level targets for case handling.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-SLA-01 | SLA thresholds SHALL be defined and overdue cases surfaced. |

| FR-SLA-02 | SLA status SHALL be exposed to staff dashboards. |
| FR-SLA-03 | SLA definitions SHALL be configurable by admin. |
- **Inputs:** SLA config, case data.
- **Processing:** compute overdue status.
- **Outputs:** SLA status summaries.
- **Endpoints:** `/sla/*` (1 route).
- **Client surfaces:** DashboardPage SLA widget.
- **Dependencies:** Cases.

### P-19: OTP (OtpModule)

- **Purpose:** Generates and verifies one-time passwords for MFA and phone verification.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-OTP-01 | OTP codes SHALL be generated with expiry and verified once. |

| FR-OTP-02 | OTP codes SHALL be usable once and SHALL expire after the configured window. |
| FR-OTP-03 | OTP delivery SHALL support email and SMS channels. |
- **Inputs:** phone/email, code.
- **Processing:** generate, store with expiry, verify, consume.
- **Outputs:** sent codes (via SMS/email), verification results.
- **Endpoints:** `/otp/*` (2 routes).
- **Client surfaces:** MfaSetupPage, login MFA step.
- **Dependencies:** otp_codes entity, Email/SMS.

### P-20: Minio (MinioModule)

- **Purpose:** Object storage for documents, uploads, and backups.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-MINIO-01 | The API SHALL upload files to Minio (server-side multipart) and issue presigned GET URLs. |
| FR-MINIO-02 | Buckets SHALL be initialized on boot (documents, backups). |

| FR-MINIO-03 | Presigned GET URLs SHALL be short-lived and scoped to a single object. |
- **Inputs:** file buffers, bucket names.
- **Processing:** bucket init, put object, presign GET.
- **Outputs:** object keys, presigned URLs.
- **Endpoints:** `POST /minio/upload`, `GET /minio/signed-url/:bucket/:fileName` (2 routes).
- **Client surfaces:** FilingModule pages.
- **Dependencies:** Minio client.

### P-21: Intake (IntakeModule)

- **Purpose:** The field intake workflow: beneficiary registration with family members, match-check against existing records, and batch family intake.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-INTAKE-01 | Intake SHALL create persons/beneficiaries, link household members, and create a case with status `enrolled`. |
| FR-INTAKE-02 | Match-check SHALL score the intake against existing beneficiaries (0.6×beneficiary + 0.4×family, threshold 0.6, limit 10) and route to confirm or new record. |
| FR-INTAKE-03 | Batch family intake SHALL link additional members to the primary's existing household (dedup scoped by barangay/address) and return the existing case id. |
| FR-INTAKE-04 | The client SHALL autosave intake drafts (user-scoped key) and purge them on logout. |

- **Inputs:** IntakeDto (beneficiary, claimant, family members, consent), batch-family DTO (primary + members + caseId).
- **Processing:** person find-or-create → beneficiary → household + memberships → case `enrolled` → consent ledger → (batch) member dedup + membership skip; transactions SERIALIZABLE; errors surfaced generically.
- **Outputs:** caseId, control number, beneficiary records.
- **Endpoints:** `POST /intake`, `POST /intake/batch-family`, `POST /intake/match-check`, `POST /intake/confirm/:householdId` (4 routes).
- **Client surfaces:** IntakePage, IntakeReviewPage.
- **Dependencies:** Beneficiaries, Cases, Households.

### P-22: Referrals (ReferralsModule)

- **Purpose:** Barangay coordinator referrals into the MSWDO workflow.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-REF-01 | Coordinators SHALL file referrals (status `pending`); admin/social_worker SHALL accept (`accepted`) or decline (`declined`). |
| FR-REF-02 | Referrals SHALL carry person data and optionally link to a created case. |

| FR-REF-03 | Referral counts and pending counts SHALL be available to coordinators and staff. |
- **Inputs:** referral DTOs (person fields, reason).
- **Processing:** create, accept/decline transitions, optional case linkage.
- **Outputs:** referral records.
- **Endpoints:** `POST /referrals`, `GET /referrals`, `GET /referrals/mine`, `GET /referrals/counts`, `GET /referrals/pending-count`, `GET /referrals/:id`, `PATCH /referrals/:id/accept`, `PATCH /referrals/:id/decline` (8 routes).
- **Client surfaces:** CoordinatorReferralFormPage, CoordinatorReferralListPage, ReferralReviewPage, ReferralsPage.
- **Dependencies:** Cases, Beneficiaries.

### P-23: Announcements (AnnouncementsModule)

- **Purpose:** Public and internal announcements with rich text and publish workflow.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-ANN-01 | Public announcements SHALL be listable/detail-able without auth (published only). |
| FR-ANN-02 | Admin SHALL create/update/delete/pin announcements (draft or published); body HTML SHALL be sanitized server-side. |

| FR-ANN-03 | Pinned announcements SHALL be surfaced first in public listings. |
- **Inputs:** announcement DTOs (title, bodyHtml, status, pinned).
- **Processing:** slug generation, sanitize-html, publish/pin toggles, excerpt auto-generation.
- **Outputs:** announcement records, public JSON.
- **Endpoints:** `GET /announcements/public` + `GET /announcements/public/:slug` (unguarded); `GET /announcements`, `GET /announcements/:id`, `POST /announcements`, `PATCH /announcements/:id`, `PATCH /announcements/:id/pin`, `DELETE /announcements/:id` (admin, social_worker, coordinator) (8 routes).
- **Client surfaces:** LandingPage, AnnouncementPage, AnnouncementsPage (manage).
- **Dependencies:** announcements entity.

### P-24: Agencies (AgenciesModule)

- **Purpose:** Maintains partner agencies (RHU, WCPD, PESO, DILG, DSWD, DepEd, MSWDO).
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-AGY-01 | Admin SHALL create agencies with code, name, type, and contact info, and list/read them. |

| FR-AGY-02 | Agency list SHALL be readable by agency staff for referral targeting. |
| FR-AGY-03 | Agency creation SHALL validate unique codes. |
- **Inputs:** agency DTOs.
- **Processing:** CRUD.
- **Outputs:** agency records.
- **Endpoints:** `GET /agencies`, `GET /agencies/:id`, `POST /agencies` (3 routes).
- **Client surfaces:** AdminPage (agencies panel), AgencyProfilePage.
- **Dependencies:** agencies entity.

### P-25: Inter-Agency Referrals (InterAgencyReferralsModule)

- **Purpose:** Cross-agency beneficiary referrals with status workflow and notifications.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-IAR-01 | Authorized staff SHALL create referrals between agencies (from/to, person, case, legal basis). |
| FR-IAR-02 | The receiving agency staff SHALL be notified on creation; the creator SHALL be notified on receive/action/close/decline. |
| FR-IAR-03 | Transitions SHALL be role-guarded (assertReceiver 403, assertTransition 409); notifications SHALL be failure-isolated. |

- **Inputs:** referral DTOs (toAgencyId, personId, caseId, reason, legalBasisCode).
- **Processing:** agency resolution (MSWDO fallback), person resolution, create → notifyAgency loop; receive/action/close/decline → notifyCreator (try/catch); status CHECK-constrained.
- **Outputs:** referral records, notifications.
- **Endpoints:** `POST /inter-agency-referrals` (create), `GET /inter-agency-referrals/inbox`, `GET /person/:personId`, `GET /case/:caseId`, `GET /beneficiary-search`, `PATCH /:id/receive`, `PATCH /:id/action`, `PATCH /:id/close`, `PATCH /:id/decline`, `POST /:id/promote-to-case` (10 routes).
- **Client surfaces:** AgencyReferralsPage, AgencyDashboardPage, AgencyCardActivitiesPage, InterAgencyReferralsPage (staff).
- **Dependencies:** Agencies, Beneficiaries, Cases, Notifications, Users (agency staff lookup).

### P-26: Agency Portal (AgencyPortalModule)

- **Purpose:** The agency-facing shell: dashboard, referral handling, and card activity views for agency staff.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-AP-01 | Agency staff SHALL see their agency dashboard with scoped referral totals and recent activity. |
| FR-AP-02 | Access SHALL be restricted to agency_staff + admin. |

| FR-AP-03 | Agency portal data SHALL be scoped to the caller's agency. |
- **Inputs:** none (agency derived from user.agencyId).
- **Processing:** agency-scoped aggregation of referrals and card activities.
- **Outputs:** dashboard JSON, referral lists, card activities.
- **Endpoints:** `GET /agency-portal/dashboard`, `GET /agency-portal/profile` (2 routes).
- **Client surfaces:** AgencyDashboardPage, AgencyReferralsPage, AgencyCardActivitiesPage, AgencyProfilePage.
- **Dependencies:** Agencies, InterAgencyReferrals, AccessCards.

### P-27: Client Shell (React)

- **Purpose:** The application shell: routing, auth context, API layer, SWR server-state, role-filtered navigation, offline/sync awareness, and theming.
- **Functional Requirements:**

| ID | Requirement |
|----|-------------|
| FR-SHELL-01 | The shell SHALL redirect users to role-appropriate landing pages after login (`ROLE_REDIRECT_MAP`). |
| FR-SHELL-02 | The API layer SHALL attach the bearer token, single-flight 401 refresh, and dispatch `kapwa:auth:logout` on refresh failure. |
| FR-SHELL-03 | SWR SHALL cache server state, revalidate on focus/reconnect, and keep previous data during refetch. |
| FR-SHELL-04 | Navigation SHALL be role-filtered (Sidebar via NAV_GROUPS, BottomNav role-derived, Topbar widgets gated by NOTIFICATION_ROLES/CHAT_ROLES). |
| FR-SHELL-05 | The shell SHALL surface connectivity status (offline badge, pending-sync count, persistent offline warning). |
| FR-SHELL-06 | The theme SHALL default to system preference with light/dark/system toggle. |

- **Inputs:** auth state, route changes, SWR keys, connectivity events.
- **Processing:** route gating (Private/Public), role redirects, token attach/refresh, SWR dedup + revalidation, offline queue integration, theme resolution.
- **Outputs:** rendered pages, navigation, badges, toasts.
- **Client surfaces:** routes.tsx (52 routes), App.tsx, Topbar/Sidebar/BottomNav, lib/api.ts, lib/auth-context.tsx, lib/offline-queue.ts, hooks/useConnectivity.ts + useSyncStatus.ts, lib/theme-context.tsx.
- **Dependencies:** all 49 page components + shared components.

## 3. Module Dependency Overview (Mermaid)

**Printing:** every diagram below is rendered to its own US-Letter-size PDF by `docs/diagrams/print-diagrams.mjs` (output in `docs/diagrams/print/`, one file per diagram) — run `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable node docs/diagrams/print-diagrams.mjs` after editing.


Edges represent module imports (solid) and data/FK relationships (where noted).

```mermaid
flowchart LR
    subgraph CORE["Core"]
        AUTH[AuthModule]
        USERS[UsersModule]
        OTP[OtpModule]
        MINIO[MinioModule]
    end
    subgraph WELFARE["Social Welfare"]
        BEN[BeneficiariesModule]
        CASES[CasesModule]
        PROG[ProgramsModule]
        INTK[IntakeModule]
        CI[CaseInterventionsModule]
        IRF[IrfModule]
        CSR[CsrModule]
        SLA[SlaModule]
        LCR[LcrModule]
    end
    subgraph REFERRAL["Referrals & Agencies"]
        REF[ReferralsModule]
        AGY[AgenciesModule]
        IAR[InterAgencyReferralsModule]
        AP[AgencyPortalModule]
    end
    subgraph COMMS["Communication & Reporting"]
        NOTIF[NotificationsModule]
        CHAT[ChatModule]
        ANN[AnnouncementsModule]
        DASH[DashboardModule]
        AUDIT[AuditModule]
        EXP[ExportModule]
        FIL[FilingModule]
        AC[AccessCardsModule]
    end
    subgraph SYNC["Offline Sync"]
        SYNCMOD[SynchronizationModule]
    end

    %% Data/FK-level edges (entity/FK access, not module imports): AUTH->USERS, CASES->BEN, CASES->CI, INTK->BEN, IAR->AGY, IAR->BEN, IAR->USERS, REF->CASES, CSR->CASES, IRF->CASES, EXP->CI, EXP->CASES, FIL->CASES, CHAT->USERS, DASH->CASES, DASH->BEN, SLA->CASES, ANN->USERS
    AUTH --> USERS
    AUTH --> OTP
    CASES --> NOTIF
    CASES --> AUTH
    CASES --> BEN
    CASES --> CI
    INTK --> BEN
    INTK --> CASES
    IAR --> AGY
    IAR --> BEN
    IAR --> CASES
    IAR --> NOTIF
    IAR --> USERS
    AP --> IAR
    REF --> CASES
    CSR --> CASES
    IRF --> CASES
    EXP --> CI
    EXP --> CASES
    FIL --> CASES
    NOTIF --> OTP
    CHAT --> USERS
    DASH --> CASES
    DASH --> BEN
    SLA --> CASES
    SYNCMOD --> INTK
    SYNCMOD --> AUTH
    ANN --> USERS
```

## 4. Diagram Narrative

The dependency graph shows **CasesModule** as the central hub: it depends on Beneficiaries, Case Interventions, and Notifications, and is itself the foundation for Intake, Referrals, Inter-Agency Referrals, CSR, IRF, Dashboard, SLA, Filing, and Export. **BeneficiariesModule** is the identity hub — Intake, Cases, and Inter-Agency Referrals all build on persons/beneficiaries. **NotificationsModule** is the communication service: Cases (worker notifications on transitions) and Inter-Agency Referrals (agency/creator notifications) depend on it, and its gateway delivers pushes in realtime.

**Leaf modules** (no outgoing edges) are LcrModule (LCR record import), SlaModule (threshold computation), OtpModule (standalone code generation), and MinioModule (object storage) — they serve other modules without depending on them. **ProgramsModule** and **AccessCardsModule** are drawn as standalone nodes: their data (program catalog; card codes and service logs) is consumed at the entity/FK level — see the ERD — rather than through module imports. **AgenciesModule** is the secondary hub for the agency-facing side: Inter-Agency Referrals resolves agencies (`IAR --> AGY`) and the Agency Portal builds on Inter-Agency Referrals (`AP --> IAR`).

The **SynchronizationModule** depends on Intake and Auth: it delegates intake-style writes for offline submissions and validates FSM transitions against the shared case state, while the client shell's offline queue feeds it. It is the field-work channel rather than a structural hub in the module graph.

The **client shell** is not drawn as a node but conceptually wraps everything: it consumes all 26 modules' endpoints through the API layer, and its role-filtered navigation (Topbar/Sidebar/BottomNav) determines which page groups each of the seven roles can reach.

## 5. Cross-References

| Item | Location |
|------|----------|
| Module wiring | `kapwa-server/src/app.module.ts` |
| Per-module controllers/services | `kapwa-server/src/<module>/*.controller.ts`, `*.service.ts` |
| Shared case FSM | `kapwa-server/src/cases/case-fsm.ts` |
| Client shell | `kapwa-client/src/routes.tsx`, `App.tsx`, `lib/api.ts`, `lib/auth-context.tsx`, `lib/offline-queue.ts`, `lib/theme-context.tsx` |
| Role-filtered navigation | `kapwa-client/src/components/Topbar.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `lib/role-access.ts` |
| Sync/connectivity hooks | `kapwa-client/src/hooks/useConnectivity.ts`, `useSyncStatus.ts` |
| Data model | `DB-SCHEMA.md`, `docs/diagrams/06-erd.md`, `docs/diagrams/07-data-dictionary.md` |
| Endpoints inventory | `docs/diagrams/02-use-case-diagram.md`, `docs/diagrams/05-output-and-user-interface.md` |