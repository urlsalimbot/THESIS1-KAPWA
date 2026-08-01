# SPEC-GAP.md — KAPWA Specification Compliance Audit

> **Audit Scope**: Master Specification Document v1.1 vs current codebase  
> **Date**: July 2026  
> **Method**: Source code review, entity/controller/service analysis, migration inspection  
> **Status**: 5 sections ✅ fully passing, 9 sections ⚠️ partial, 4 sections ❌ missing

---

## 1. Functional Requirements Gap Table

| FR-ID | Requirement | Status | Finding |
|-------|------------|--------|---------|
| FR-01 | Create/update/retrieve unified beneficiary profiles | ✅ PASS | Persons + Beneficiaries entities, CRUD controllers, FTS |
| FR-02 | Classify roles: Reporter, Client Served, Victim, Recipient, Multi-Role | ⚠️ PARTIAL | `category` is free-text — no enumerated role values. Staff roles (social_worker/admin/coordinator) defined, but beneficiary role types not enforced |
| FR-03 | Auto-generate LGU ID: `NORZ-BRGY##-YYYY-###` | ❌ FAIL | Uses `KAPWA-YYYY-#####` (cases) and `NORZ-AC-YYYY-####` (access cards). No `NORZ-BRGY##-YYYY-###` format |
| FR-04 | Log interventions: financial, in-kind, referral, counseling, documentation | ✅ PASS | CaseIntervention entity, Referral entity, natureOfService field |
| FR-05 | Attach encrypted documents | ⚠️ PARTIAL | IRF narration encrypted (pgcrypto AES-256-CBC). File uploads stored unencrypted on local disk — MinIO not wired |
| FR-06 | Tag outcomes: Resolved, Ongoing, Referred, Closed | ⚠️ PARTIAL | Case FSM uses enrolled/assessed/in_review/active/transitioning/closed. No "Resolved", "Ongoing", or "Referred" statuses |
| FR-07 | Flag duplicate assistance within configurable windows | ❌ FAIL | No duplicate detection logic found |
| FR-08 | Store data locally in encrypted format | ✅ PASS | AES-256-GCM (localStorage) + SQLCipher (Capacitor, PBKDF2-SHA-256 key) |
| FR-09 | Auto-detect connectivity → background delta sync | ⚠️ PARTIAL | Delta sync endpoint exists. No client-side connectivity detection or background sync scheduling |
| FR-10 | Domain-aware conflict resolution (DACRA) | ⚠️ PARTIAL | Multi-strategy resolver exists (server-wins/append-notes/LWW). `FINANCIAL_TABLES` set is empty. Not the sophisticated DACRA algorithm described in spec |
| FR-11 | Queue unresolvable conflicts for human review with diff UI | ⚠️ PARTIAL | `sync_queue` with conflict status + resolver endpoint. No frontend diff UI |
| FR-12 | Store metadata for physical files (Cabinet/Folder/Shelf) | ❌ FAIL | No `physical_files` table or entity. Filing module is purely digital |
| FR-13 | Print QR labels linking digital ↔ physical records | ❌ FAIL | QR library used only for TOTP MFA setup — no physical record QR labels |
| FR-14 | Search physical files by name, date, type, location | ❌ FAIL | No physical file search exists |
| FR-15 | Capture digital consent with timestamp, officer, purpose tags | ✅ PASS | consent_ledger table with purpose, channel, granted_at, revoked_at |
| FR-16 | Enforce dynamic ABAC based on consent state | ✅ PASS | AbacGuard + PostgreSQL RLS on 4 tables |
| FR-17 | Configurable approval workflow with SLA timers | ✅ PASS | Program.approvalWorkflow JSONB, SlaService cron every 30 min |
| FR-18 | Auto-escalate overdue approvals via SMS/app | ✅ PASS | SlaService.checkAndEscalate() creates notifications |
| FR-19 | Require OTP/e-signature for approval/release | ⚠️ PARTIAL | OTP module exists. Not enforced as gate before approval endpoint |
| FR-20 | One-click DSWD-compliant reports | ⚠️ PARTIAL | Generic PDF/CSV/XLSX export. No DSWD-specific report templates |
| FR-21 | Program effectiveness dashboard | ✅ PASS | DashboardController returning metrics, trends, per-role views |
| FR-22 | COA-ready fund utilization reports with audit meta | ❌ FAIL | `exportForCoa()` is a stub returning empty arrays |
| FR-23 | Enforce RBAC with least-privilege visibility | ✅ PASS | RolesGuard + AbacGuard + barangay scoping |
| FR-24 | SMS OTP + device-bound PIN auth | ⚠️ PARTIAL | SMS OTP + TOTP MFA implemented. `device_id` column exists but never enforced |
| FR-25 | Immutable audit log (hash chain) | ⚠️ PARTIAL | SHA-256 hash chains on 3 tables (cases, beneficiaries, consent_ledger). No trigger preventing hash overwrite |
| FR-26 | Remote data wipe on lost/stolen device | ❌ FAIL | No remote wipe endpoint or mechanism |
| FR-27 | Admin tools: user mgmt, backup, sync queue monitoring | ⚠️ PARTIAL | Users CRUD + sync conflict management. No backup admin UI or sync monitoring dashboard |
| FR-28 | Admin creates/edits intervention types with JSON metadata | ✅ PASS | intervention_types table created, seeded with FA/C/CSR/R/H/HV/Other |
| FR-29 | Required documents via predefined code dictionary | ✅ PASS | DocumentVault.requirementKey, Program.requiredDocuments, requirementsChecklist JSONB |
| FR-30 | Enforce document checklist before submission | ⚠️ PARTIAL | requirementsChecklist tracked. No enforcement preventing status transition when incomplete |
| FR-31 | Config sync server-first; devices cache with version invalidation | ⚠️ PARTIAL | Generic sync via version vectors. No dedicated config sync mechanism |
| FR-32 | Audit trail for config changes | ❌ FAIL | No `intervention_type_audit` table. FormVersionHistory exists for programs only |

---

## 2. Missing Tables from Spec §6.1 Core Data Model

| Table | Status | Impact |
|-------|--------|--------|
| `physical_files` | ❌ Not created | FR-12/13/14 (hybrid filing) entirely unimplementable |
| `sync_receipts` | ❌ Not created | No ack tracking for sync batches |
| `intervention_type_audit` | ❌ Not created | FR-32 (config change audit) cannot function |

---

## 3. Non-Functional Requirement Gaps

| NFR-ID | Requirement | Status | Finding |
|--------|-------------|--------|---------|
| NFR-01 | Sync latency < 3s per 50 records on 3G | ⚠️ UNVERIFIED | No load tests exist to verify |
| NFR-05 | AES-256 at rest | ✅ PASS | Client uses AES-256-GCM + SQLCipher |
| NFR-06 | TLS 1.3 + mTLS + Ed25519 | ❌ FAIL | Caddy serves plain HTTP (dev mode). No TLS 1.3 or mTLS. Ed25519 used for sync sigs only |
| NFR-07 | MFA (OTP + device binding) | ⚠️ PARTIAL | OTP/TOTP implemented. Device binding not enforced |
| NFR-08 | SHA-256 hash chaining | ✅ PASS | Implemented on 3 tables with verification endpoint |
| NFR-10 | Daily encrypted backups | ❌ FAIL | MinIO backups bucket exists. No pg_dump scheduling or automation |
| NFR-12 | Docker Compose deployment | ✅ PASS | Full docker-compose.yml with all services |
| NFR-14 | COA-compliant digital records | ❌ FAIL | exportForCoa() is a stub |

---

## 4. Tech Stack Gaps (Spec §5.1)

| Spec Requirement | Actual | Status | Note |
|-----------------|--------|--------|------|
| Angular 18+ PWA | **React 19** + Vite | ❌ FAIL | Entire frontend is React, not Angular |
| Capacitor 6 | **Capacitor 8** (`^8.4.1`) | ✅ UPGRADED | Newer version, functional |
| NestJS 11 | NestJS 11 | ✅ PASS | |
| Node 20/22 LTS | Node 20 | ✅ PASS | |
| PostgreSQL 17 | **PostgreSQL 16** | ⚠️ MINOR | Dockerfile uses `postgres:16-alpine` |
| MinIO | MinIO | ✅ PASS | |
| Caddy / Nginx | Caddy + Nginx | ✅ PASS | Both present in docker-compose |
| Docker Compose | Docker Compose | ✅ PASS | |
| JWT + SMS OTP | JWT + Twilio/OTP | ✅ PASS | |
| Ed25519 + SHA-256 | Both implemented | ✅ PASS | Ed25519 for sync, SHA-256 for audit chains |

---

## 5. Summary

### ✅ Fully Implemented (5 sections)
- Beneficiary & Identity (FR-01)
- Consent & Access Control (FR-15, FR-16)
- Workflow & Approval SLA (FR-17, FR-18)
- RBAC (FR-23)
- Client-side encryption (FR-08)

### ⚠️ Partial Implementation (9 sections)
- Role classification (FR-02)
- Document encryption (FR-05)
- Outcome tagging (FR-06)
- Client sync auto-detection (FR-09)
- DACRA conflict resolution (FR-10)
- Conflict diff UI (FR-11)
- OTP gate for approvals (FR-19)
- DSWD report templates (FR-20)
- Device binding (FR-24)
- Hash chain coverage (FR-25)
- Admin tools (FR-27)
- Document checklist enforcement (FR-30)
- Config sync mechanism (FR-31)

### ❌ Not Implemented (4 sections)
- **Hybrid physical-digital filing** (FR-12, FR-13, FR-14) — largest gap
- **Duplicate assistance detection** (FR-07)
- **Remote data wipe** (FR-26)
- **Config change audit trail** (FR-32)

### 🔴 Critical Gaps for Compliance
1. **TLS 1.3 / mTLS** — production exposure without HTTPS violates RA 10173 Sec. 20
2. **COA export stub** — COA Circular 2022-003 compliance not verifiable
3. **No automated backups** — data loss risk, COA non-compliance
4. **Tech stack mismatch (React vs Angular)** — spec says Angular 18+, codebase is React 19
5. **Missing physical filing** — stakeholder requirement from MSWDO officer ("need lang ay FILING SYSTEM")

---

*Generated by automated spec-vs-codebase audit. Re-audit after each sprint.*
