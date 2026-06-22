# Roadmap: Kapwa — MSWDO Norzagaray

## Overview

Kapwa replaces paper-based workflows at the MSWDO of Norzagaray, Bulacan with a digital system covering the full social welfare lifecycle — from GIS beneficiary intake through case management, post-disbursement intervention logging, Access Card tracking, and compliance reporting. Built as an offline-first PWA on an existing brownfield codebase (React 18 + Capacitor 6 + NestJS 11 + PostgreSQL 16 + MinIO), this roadmap delivers 47 v1 requirements across 6 vertical-slice phases. Each phase delivers a complete, deployable user capability — from "staff can log in and the system runs" through "all stakeholders have role-appropriate dashboards" — with offline sync, consent gating, and compliance woven throughout.

## Phases

- [x] **Phase 1: Foundation — Deploy & Authenticate** - Infrastructure, roles, basic sync, and audit foundation
- [x] **Phase 2: GIS Intake & Beneficiary Registration** - Dual-mode GIS intake with consent management (completed 2026-06-19)
- [x] **Phase 3: Intervention Tracking & Case Management** - End-to-end case workflow with post-disbursement logging (completed 2026-06-22)
- [ ] **Phase 4: Access Card System** - Code# generation, service logs, loss/replacement workflow
- [ ] **Phase 5: Dynamic Programs & IRF Module** - Program configuration and encrypted incident reports
- [ ] **Phase 6: Dashboards, Notifications & Role Completion** - Role-specific UIs, notifications, compliance exports

## Phase Details

### Phase 1: Foundation — Deploy & Authenticate

**Goal**: Staff can deploy the full system stack, log in with role-appropriate access, and sync infrastructure is initialized with encrypted local storage.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INF-01, INF-02, INF-03, INF-05, ROL-01, ROL-06, SYNC-01, SYNC-04, SYNC-05, CON-06
**Success Criteria** (what must be TRUE):

  1. System deploys via Docker Compose with MinIO, Caddy 2 (auto-TLS, rate limiting), and PostgreSQL 16 with backup cron
  2. Admin can log in with MFA and manage users across all 6 role types (Social Worker, Admin, Barangay Coordinator, Claimant, Mayor's Office, Auditor)
  3. Mobile app uses SQLCipher AES-256 encrypted local database; sync endpoint enforces idempotency keys
  4. Offline queue status indicator is visible in the UI with pending change count
  5. Audit trail uses SHA-256 hash chaining — admin can verify chain integrity

**Plans**: 4/4 plans executed — COMPLETE

Plans:

- [x] 01-01-PLAN.md — Walking Skeleton: Docker Compose, Caddy, MinIO, connection pooling, RLS for all 6 roles
- [x] 01-02-PLAN.md — Admin User Management: POST /users, role validation, AdminPage form
- [x] 01-03-PLAN.md — Sync Client Foundation: SQLCipher, platform-aware SecureStorage, Layout offline queue fix
- [x] 01-04-PLAN.md — Audit Integrity & Idempotency: SHA-256 hash chain extension, DB-backed idempotency keys

### Phase 2: GIS Intake & Beneficiary Registration

**Goal**: Social workers can register any walk-in or referred claimant through dual-mode GIS intake (online/offline), capturing full Client Stub fields, family composition, assessment notes, and searchable beneficiary records.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: GIS-01, GIS-02, GIS-03, GIS-04, GIS-05, GIS-06, CON-01, CON-02, SYNC-02
**Success Criteria** (what must be TRUE):

  1. Staff can start a GIS intake session online or offline, capturing Client Stub fields, requirements checklist, family composition, and assessment notes — all in one form
  2. On intake completion, a case is generated with a unique control_no and status = 'pending_assessment'; profile fields are editable ONLY during active intake sessions (no standalone PATCH)
  3. Staff can search beneficiaries by name, category, and barangay with trigram + BM25 typo-tolerant search
  4. Family graph visualization shows relationships up to 2 degrees, filtered by consent status
  5. Consent ledger tracks grant/revoke per beneficiary; revoked consent = immediate masking of PII fields in UI

**Plans:** 4/4 plans complete

Plans:

- [x] 02-01-PLAN.md — Consolidated GIS Intake: POST /api/intake, category migration, IntakePage wiring
- [x] 02-02-PLAN.md — Beneficiary Search: pg_trgm + ts_rank, category/barangay filters
- [x] 02-03-PLAN.md — Family Graph, Consent & PII: Recursive CTE, revoke endpoint, interceptor, UI
- [x] 02-04-PLAN.md — Offline Intake Sync: Sync processor for intake, offline queue consolidation

### Phase 3: Intervention Tracking & Case Management

**Goal**: Staff can move cases through the full FSM lifecycle (pending_assessment → in_review → approved → disbursed → closed) and log post-disbursement interventions with mandatory signatures, eligibility checks, and fund source tracking.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-08, CON-03, CON-04, SYNC-03
**Success Criteria** (what must be TRUE):

  1. Case progresses through strict FSM transitions (pending → review → approved → disbursed → closed) with role-appropriate approval step at each gate
  2. Intervention entry (FA/C/CSR/R/H/HV) is ONLY available after case.status = 'disbursed'; system blocks any pre-disbursement logging
  3. Sliding-window duplicate detection prevents a household from receiving the same intervention type within 30 days
  4. Each intervention requires a mandatory worker signature upload AND client receipt/liquidation scan; Case Tracker Log auto-generates with daily sequence numbering
  5. ABAC evaluates (role, resource_sensitivity, consent_status) on every intervention query; ARTA SLA timers auto-escalate overdue approval steps

**Plans:** 3/3 plans complete

Plans:

- [x] 03-01-PLAN.md — Case FSM Lifecycle: 3-gate separation with per-gate endpoints, admin override, role-specific UI
- [x] 03-02-PLAN.md — Intervention Logging: signatures via MinIO, duplicate detection, fund source tracking, deferrable sig state
- [x] 03-03-PLAN.md — Tracker, SLA & Offline: NORZ-TRACK IDs, ARTA SLA cron, offline FSM transitions, sync conflict resolution

### Phase 4: Access Card System

**Goal**: Every beneficiary has a unique Access Card (CODE#), interventions auto-append to the 18-row service log, and "No Card = No Voucher" is enforced at intervention logging with full loss/replacement audit trail.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: AC-01, AC-02, AC-03, AC-04, INT-07
**Success Criteria** (what must be TRUE):

  1. Each beneficiary receives a unique Access Card code in format NORZ-AC-YYYY-#### upon intake completion
  2. Every intervention automatically appends to the beneficiary's 18-row Access Card service record with service date, type, cost, and agency
  3. "No Card = No Voucher" guard blocks intervention logging when the beneficiary has no active Access Card
  4. Loss/replacement workflow generates a new card code, preserves full audit trail of old card, and marks lost card as void
  5. Staff can view, print, and refill the Access Card service log from the UI

**Plans**: TBD

Plans:

- TBD

### Phase 5: Dynamic Programs & IRF Module

**Goal**: Admin can configure dynamic programs with JSON Schema form templates, and staff can submit encrypted Incident Report Forms (IRF) with secure WCPD/PNP export and case disposition tracking.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: PRG-01, PRG-02, PRG-03, IRF-01, IRF-02, IRF-03, IRF-04
**Success Criteria** (what must be TRUE):

  1. Admin can create/edit programs with name, category, waiting period, required documents, and fund sources — all persisted to the database
  2. Program config includes a JSON Schema form template that renders dynamically as a structured intake form in the UI
  3. Each program type supports a configurable multi-step approval workflow with role-based gates
  4. Staff can submit an IRF with blotter entry number, case category, and Item A/B/C fields; victim narration is AES-256 encrypted via pgcrypto
  5. Victim/person-reported names are masked by default in all views; secure export to WCPD/PNP requires legal_basis_code + audit log entry
  6. IRF case disposition tracks through Under Investigation → Referred → Closed

**Plans**: TBD

Plans:

- TBD

### Phase 6: Dashboards, Notifications & Role Completion

**Goal**: Every role sees appropriate data — Claimant self-service, Mayor's Office aggregate views, Auditor read-only logs — with consent-gated notifications and DSWD/COA-compliant exports.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ROL-02, ROL-03, ROL-04, ROL-05, CON-05, INF-04
**Success Criteria** (what must be TRUE):

  1. Claimant can access a self-service dashboard showing service history timeline, case status tracker, digital Access Card, and consent management hub
  2. Mayor's Office sees aggregate data only (no PII) — fund utilization, unique household counts, SLA compliance rates
  3. Auditor role provides read-only access to audit logs with SHA-256 hash-chain verification and consent ledger inspection
  4. Barangay Coordinator is scoped to single barangay with SMS OTP auth and mobile PWA interface
  5. SMS and in-app notifications are sent respecting consent preferences (opt-in/opt-out per channel)
  6. Admin can export DSWD/COA-compliant reports (audit logs, service summaries, compliance data)

**Plans**: TBD

Plans:

- TBD

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Deploy & Authenticate | 4/4 | Complete | 2026-06-19 |
| 2. GIS Intake & Beneficiary Registration | 4/4 | Complete   | 2026-06-19 |
| 3. Intervention Tracking & Case Management | 3/3 | Complete   | 2026-06-22 |
| 4. Access Card System | 0/0 | Not started | - |
| 5. Dynamic Programs & IRF Module | 0/0 | Not started | - |
| 6. Dashboards, Notifications & Role Completion | 0/0 | Not started | - |
