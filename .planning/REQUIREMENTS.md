# Requirements: Kapwa — MSWDO Norzagaray

**Defined:** 2026-06-19
**Core Value:** Social workers can register any claimant, conduct a full social case study, manage the complete approval workflow, log interventions post-disbursement, and track every service rendered — reliably offline in the field with automatic sync when connected.

## v1 Requirements

### GIS Intake & Beneficiary Profiling

- [ ] **GIS-01**: Staff can conduct dual-mode GIS intake (online/offline) capturing Client Stub fields, requirements checklist, family composition, and assessment notes
- [ ] **GIS-02**: Profile fields are editable ONLY during active GIS intake sessions — no standalone PATCH endpoints for beneficiaries
- [ ] **GIS-03**: Intake completion generates a case with control_no and status = 'pending_assessment'
- [ ] **GIS-04**: Staff can search beneficiaries by name, category, and barangay using trigram + BM25 with typo tolerance
- [ ] **GIS-05**: Family graph visualization via recursive CTE (up to 2 degrees, consent-filtered)
- [ ] **GIS-06**: Beneficiary categorization by type (Senior, PWD, Child, Solo Parent, etc.)

### Intervention Tracking

- [ ] **INT-01**: Interventions (FA/C/CSR/R/H/HV) are loggable ONLY after case.status = 'disbursed'
- [ ] **INT-02**: End-to-end workflow: intake → assessment → approval → disbursement → post-intervention logging
- [ ] **INT-03**: Eligibility checks with sliding window duplicate detection (30-day household limit)
- [ ] **INT-04**: Mandatory worker signature upload per intervention
- [ ] **INT-05**: Mandatory client receipt/liquidation scan upload per intervention
- [ ] **INT-06**: Case Tracker Log with daily sequencing (transaction_date + daily_seq_num unique)
- [ ] **INT-07**: Auto-append to Access Card service records on intervention creation
- [ ] **INT-08**: Fund source tracking (Regular/PDAF/Legislative/Donation) with balance checks

### Access Card System

- [ ] **AC-01**: Generate unique Access Card codes (NORZ-AC-YYYY-####) per beneficiary
- [ ] **AC-02**: 18-row service log per card with refill/print workflow
- [ ] **AC-03**: Loss/replacement workflow with full audit trail
- [ ] **AC-04**: "No Card = No Voucher" API guard enforced at intervention logging

### IRF (Incident Report Form) Module

- [ ] **IRF-01**: Staff can submit IRF with blotter entry number, case category, and Item A/B/C fields
- [ ] **IRF-02**: AES-256 encryption of victim narration via pgcrypto; names masked by default
- [ ] **IRF-03**: Secure export to WCPD/PNP requiring legal_basis_code + audit log entry
- [ ] **IRF-04**: Case disposition tracking: Under Investigation → Referred → Closed

### Dynamic Programs

- [ ] **PRG-01**: Admin can configure programs (name, category, waiting period, required docs, fund sources)
- [ ] **PRG-02**: Program config includes JSON Schema form template for dynamic UI rendering
- [ ] **PRG-03**: Approval workflow per program type with configurable steps

### User Roles & Access

- [ ] **ROL-01**: 6 roles implemented: MSWDO Social Worker, MSWDO Admin, Barangay Coordinator, Claimant, Mayor's Office, Auditor
- [ ] **ROL-02**: Barangay Coordinator scoped to single barangay, SMS OTP auth + mobile PWA
- [ ] **ROL-03**: Claimant self-service dashboard — status tracker, service history timeline, Access Card view, consent management
- [ ] **ROL-04**: Mayor's Office sees aggregate data only (no PII), fund utilization, SLA compliance
- [ ] **ROL-05**: Auditor role — read-only audit logs, hash-chain verification, consent ledger access
- [ ] **ROL-06**: MSWDO Admin — manage programs, users, consent ledger, sync queue, audit exports

### Consent & Compliance

- [ ] **CON-01**: Consent ledger with grant/revoke tracking per beneficiary
- [ ] **CON-02**: Revoked consent = immediate UI masking or null return on PII fields
- [ ] **CON-03**: ABAC evaluates (role, resource_sensitivity, consent_status, legal_basis) for every query
- [ ] **CON-04**: ARTA SLA timers with auto-escalation for overdue approvals
- [ ] **CON-05**: DSWD/COA-compliant report export formats
- [ ] **CON-06**: SHA-256 hash chaining for audit trail integrity

### Offline Sync

- [ ] **SYNC-01**: SQLCipher local cache on mobile (AES-256 encrypted)
- [ ] **SYNC-02**: All core workflows function offline; delta sync on reconnect
- [ ] **SYNC-03**: Conflict resolution: Financial/Amount → Server Wins; Notes → Chronological Append; Consent → Server Revocation Overrides; Unclear → Conflict Queue
- [ ] **SYNC-04**: Idempotency key enforcement on sync endpoint
- [ ] **SYNC-05**: Offline queue status indicator and pending count display in UI

### Infrastructure & Notifications

- [ ] **INF-01**: MinIO (S3-compatible) for document storage (signatures, vouchers, IRF attachments)
- [ ] **INF-02**: Caddy 2 reverse proxy with auto-TLS, rate limiting, WAF
- [ ] **INF-03**: Docker Compose deployment with automated backup cron
- [ ] **INF-04**: Notifications (SMS + in-app) respecting consent preferences
- [ ] **INF-05**: Connection pooling and backup strategy configured

## v2 Requirements

- **Full integration with PhilSys/DSWD national databases** — CSV/PDF export sufficient for v1
- **Real-time chat between beneficiaries and staff** — Existing Socket.IO infrastructure but not MSWDO-priority
- **Scheduling/appointment system** — Not in current project scope

## Out of Scope

| Feature | Reason |
|---------|--------|
| PhilSys/DSWD API integration | Standalone system; export reports for external submission |
| LGU-wide financial management | Fund tracking limited to intervention/program scope |
| Real-time chat | Infrastructure exists but not prioritized for MSWDO workflow |
| Appointment scheduling | Not part of MSWDO paper workflow mapped in KAPWA-PROJECT.md |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AC-01 | Phase 4 | Pending |
| AC-02 | Phase 4 | Pending |
| AC-03 | Phase 4 | Pending |
| AC-04 | Phase 4 | Pending |
| CON-01 | Phase 2 | Pending |
| CON-02 | Phase 2 | Pending |
| CON-03 | Phase 3 | Pending |
| CON-04 | Phase 3 | Pending |
| CON-05 | Phase 6 | Pending |
| CON-06 | Phase 1 | Pending |
| GIS-01 | Phase 2 | Pending |
| GIS-02 | Phase 2 | Pending |
| GIS-03 | Phase 2 | Pending |
| GIS-04 | Phase 2 | Pending |
| GIS-05 | Phase 2 | Pending |
| GIS-06 | Phase 2 | Pending |
| INF-01 | Phase 1 | Pending |
| INF-02 | Phase 1 | Pending |
| INF-03 | Phase 1 | Pending |
| INF-04 | Phase 6 | Pending |
| INF-05 | Phase 1 | Pending |
| INT-01 | Phase 3 | Pending |
| INT-02 | Phase 3 | Pending |
| INT-03 | Phase 3 | Pending |
| INT-04 | Phase 3 | Pending |
| INT-05 | Phase 3 | Pending |
| INT-06 | Phase 3 | Pending |
| INT-07 | Phase 4 | Pending |
| INT-08 | Phase 3 | Pending |
| IRF-01 | Phase 5 | Pending |
| IRF-02 | Phase 5 | Pending |
| IRF-03 | Phase 5 | Pending |
| IRF-04 | Phase 5 | Pending |
| PRG-01 | Phase 5 | Pending |
| PRG-02 | Phase 5 | Pending |
| PRG-03 | Phase 5 | Pending |
| ROL-01 | Phase 1 | Pending |
| ROL-02 | Phase 6 | Pending |
| ROL-03 | Phase 6 | Pending |
| ROL-04 | Phase 6 | Pending |
| ROL-05 | Phase 6 | Pending |
| ROL-06 | Phase 1 | Pending |
| SYNC-01 | Phase 1 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 1 | Pending |
| SYNC-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0 ✓
---
*Requirements defined: 2026-06-19*
*Last updated: 2026-06-19 after initial definition*
