# Kapwa — MSWDO Norzagaray

## What This Is

Kapwa (Kindred Assistance and People's Welfare Assistance) is a social support software for the Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan. It replaces paper-based workflows with a digital system for claimant/beneficiary profiling, intervention tracking, and end-to-end case management — from GIS intake through assessment, approval, disbursement, and post-intervention logging. It includes an Incident Report Form (IRF) module for abuse/criminal cases with mandatory encryption, an Access Card system with Code# generation, and compliance with RA 11032, RA 10173 (Data Privacy), COA audit requirements, and DSWD standards.

Built as an offline-first PWA with Capacitor 6 mobile wrappers, React 18 client, NestJS 11 server, PostgreSQL 16 database, and MinIO object storage.

## Core Value

Social workers can register any claimant, conduct a full social case study (GIS), manage the complete approval workflow, log interventions post-disbursement, and track every service rendered — reliably offline in the field with automatic sync when connected.


## Requirements
## Current Milestone: v1.2 Quality & Resilience Hardening

**Goal:** Close test coverage gaps, harden error resilience, strengthen the API layer, and upgrade toolchain so Kapwa is production-ready.

**Target features:**
- Test coverage for core modules (api.ts, auth-context, offline-queue, secure-storage) — target ≥70%
- Smoke tests for core UI components (Layout, Topbar, Sidebar, ProtectedRoute)
- `<ErrorBoundary>` wrapping for all 28 pages
- Centralized API client with retry/timeout/interceptor pattern
- SWR activation for data fetching (stale-while-revalidate caching)
- Axe-core a11y integration in CI pipeline + SkipToContent activation
- Token refresh/rotation in auth-context
- Dependency cleanup: move playwright, @capacitor/cli, esbuild → devDependencies
- Upgrade vitest to v4, testing libraries to latest
- Plan React 19 + Capacitor 8 + Tailwind CSS v4 upgrade (medium-term, tested via mobile builds)

**Target scores:** Overall 53/100 → 75/100 (PRODUCTION READY)

### Validated

Existing Kapwa codebase capabilities:

- ✓ **JWT authentication with role infrastructure** — Multi-factor auth (password, SMS OTP, device binding)
- ✓ **Case management FSM** — pending_assessment → in_review → approved → disbursed → closed lifecycle
- ✓ **Beneficiary entity and schema** — beneficiaries, households, family_members tables
- ✓ **Intervention entity and schema** — interventions, case_tracker_log tables
- ✓ **Offline sync protocol** — Delta sync with Ed25519 signatures, version vectors, conflict resolution
- ✓ **PWA + Capacitor mobile deployment** — Cross-platform (browser + Android/iOS native)
- ✓ **RBAC + ABAC authorization pipeline** — Role-based and attribute-based access control with consent evaluation
- ✓ **Socket.IO real-time messaging** — Chat infrastructure
- ✓ **Zod validation pipeline** — API boundary validation
- ✓ **Dashboard view** — Aggregated data display
- ✓ **PostgreSQL with pgcrypto, pgAudit, RLS** — Database security infrastructure
- ✓ **Audit logging** — pgAudit triggers and SHA-256 hash chain pattern

### Active

#### Beneficiary Profiling (GIS Intake)
- [ ] **GIS-01**: Staff can conduct dual-mode GIS intake (online/offline) capturing Client Stub fields, requirements checklist, family composition, assessment notes
- [ ] **GIS-02**: Profile fields are editable ONLY during active GIS intake sessions — no standalone PATCH endpoints
- [ ] **GIS-03**: Generate case with control_no and status = 'pending_assessment' on intake completion
- [ ] **GIS-04**: Staff can search beneficiaries by name/category/barangay using trigram + BM25 with typo tolerance
- [ ] **GIS-05**: Family graph visualization via recursive CTE (2 degrees, consent-filtered)

#### Intervention Tracking
- [ ] **INT-01**: Interventions (FA/C/CSR/R/H/HV) are loggable ONLY after case.status = 'disbursed'
- [ ] **INT-02**: End-to-end workflow: intake → assessment → approval → disbursement → post-intervention logging
- [ ] **INT-03**: Eligibility checks with sliding window duplicate detection (30-day household limit)
- [ ] **INT-04**: Mandatory worker signature + client receipt/liquidation upload per intervention
- [ ] **INT-05**: Case Tracker Log (daily sequencing, transaction_date + daily_seq_num unique constraint)
- [ ] **INT-06**: Auto-appends to Access Card service records on intervention creation
- [ ] **INT-07**: Fund source tracking (Regular/PDAF/Legislative/Donation) with per-source balance checks

#### Access Card System
- [ ] **AC-01**: Generate unique Access Card codes (NORZ-AC-YYYY-####) per beneficiary
- [ ] **AC-02**: 18-row service log per card with refill/print workflow
- [ ] **AC-03**: Loss/replacement workflow with audit trail
- [ ] **AC-04**: "No Card = No Voucher" API guard enforced

#### IRF (Incident Report Form) Module
- [ ] **IRF-01**: Staff can submit IRF with blotter entry number, category, Item A/B/C fields
- [ ] **IRF-02**: AES-256 encryption of victim narration via pgcrypto; names masked by default
- [ ] **IRF-03**: Secure export to WCPD/PNP requiring legal_basis_code + audit log entry
- [ ] **IRF-04**: Case disposition tracking: Under Investigation → Referred → Closed

#### Dynamic Programs
- [ ] **PRG-01**: Admin can configure programs (name, category, waiting period, required docs, fund sources)
- [ ] **PRG-02**: Program config includes JSON Schema form template for dynamic rendering
- [ ] **PRG-03**: Approval workflow per program type (configurable steps)

#### User Roles & Access
- [ ] **ROL-01**: 6 roles: MSWDO Social Worker, MSWDO Admin, Barangay Coordinator, Claimant, Mayor's Office, Auditor
- [ ] **ROL-02**: Barangay Coordinator scoped to single barangay, SMS OTP auth + mobile PWA
- [ ] **ROL-03**: Mayor's Office sees aggregate data only (no PII)
- [ ] **ROL-04**: Auditor role — read-only audit logs, hash-chain verification, consent ledger
- [ ] **ROL-05**: Beneficiary self-service dashboard (status tracker, service history, Access Card view, consent hub)

#### Consent & Compliance
- [ ] **CON-01**: Consent ledger with grant/revoke tracking; revoked consent = immediate UI masking
- [ ] **CON-02**: ABAC evaluates (role, resource_sensitivity, consent_status, legal_basis) for every query
- [ ] **CON-03**: ARTA SLA timers with auto-escalation for overdue approvals
- [ ] **CON-04**: DSWD/COA-compliant export formats (reports, audit logs)
- [ ] **CON-05**: RA 10173 data privacy controls (pgcrypto for PII, consent gating)

#### Offline Sync
- [ ] **SYNC-01**: SQLCipher local cache on mobile (AES-256 encrypted)
- [ ] **SYNC-02**: All core workflows function offline; delta sync on reconnect
- [ ] **SYNC-03**: Conflict resolution rules: Financial/Amount → Server Wins, Notes → Chronological Append, Consent → Server Revocation Overrides, Unclear → Conflict Queue
- [ ] **SYNC-04**: Idempotency key enforcement on sync endpoint

#### Infrastructure
- [ ] **INF-01**: MinIO (S3-compatible) for document vault (signatures, vouchers, IRF attachments)
- [ ] **INF-02**: Caddy 2 reverse proxy with auto-TLS, rate limiting
- [ ] **INF-03**: Docker Compose deployment with backup cron
- [ ] **INF-04**: Notifications (SMS via Twilio? + in-app) respecting consent preferences

### Out of Scope

- **Integration with PhilSys/DSWD national databases** — Standalone system; CSV/PDF export for external submission
- **Real-time chat between beneficiaries and staff** — Chat infrastructure exists but not MSWDO-priority
- **Scheduling/appointment system** — Not in current spec
- **Full financial management (LGU budgeting)** — Fund tracking only per intervention/program

## Context

Kapwa is a thesis project targeting full deployment at the MSWDO of Norzagaray, Bulacan. The existing codebase has a strong technical foundation (NestJS modular architecture, offline-first sync protocol, JWT+ABAC auth, Capacitor mobile, PostgreSQL with RLS/pgcrypto/pgAudit). Key technical debt includes sub-50% test coverage, NestJS version mismatch (v10 vs v11), TypeORM alpha dependency, and sync service complexity. The full spec is defined in KAPWA-PROJECT.md v2.0, which maps directly to MSWDO paper forms (Client Stub, General Intake Sheet, Access Card, IRF, Petty Cash Voucher).

**Timeline:** 12 weeks (current semester)
**Deployment:** Cloud-hosted (Ubuntu + Docker Compose + Caddy)
**Compliance:** RA 11032, RA 10173, ARTA, COA, DSWD AO 2020-002

## Constraints

- **Stack**: React 18 + Capacitor 6 / NestJS 11 / PostgreSQL 16 / MinIO
- **Offline-first**: All core workflows must work without internet
- **Post-disbursement logging**: Interventions only after case disbursement
- **Service-triggered updates**: Profile edits only during active GIS intake
- **Compliance**: RA 10173 consent gating, COA audit trails, ARTA SLA timers
- **Testing**: ≥80% unit coverage target

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on existing Kapwa codebase | Avoid rebuild; existing sync, auth, and case infrastructure significantly accelerates development | — Pending |
| Offline-first with SQLCipher | Field workers in Norzagaray need reliable offline operation | — Pending |
| Post-disbursement intervention logging | Matches MSWDO paper workflow exactly; prevents data entry before service delivery | — Pending |
| MinIO for document storage | S3-compatible, self-hosted, encryption at rest | — Pending |
| ABAC + consent ledger for access control | RA 10173 compliance; dynamic row-level masking on consent revoke | — Pending |
| 6-sprint schedule (12 weeks) | Aligned with thesis timeline and project complexity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 after milestone v1.2 start
