# 📦 KAPWA Project: Agentic Coding Team Handoff Specification
*Kindred Assistance and People's Welfare Assistance | MSWDO Norzagaray, Bulacan*
> **Version**: 2.0 (PDF-Mapped) | **Target**: AI/Agentic Dev Team | **Timeline**: 12 Weeks | **Compliance**: RA 11032, RA 10173, ARTA, COA, DSWD AO 2020-002

---

## 🎯 1. Project Overview & Non-Negotiable Principles
| Principle | Implementation Directive |
|-----------|--------------------------|
| **Augment, Don't Replace** | Preserve physical signatures, paper fallbacks, and "natural" workflows. Digital layer adds search, sync, audit, and duplicate detection only. |
| **Service-Triggered Profile Updates** | `beneficiaries` fields may ONLY be modified during an active GIS intake session. Zero standalone `PATCH /beneficiaries/:id` endpoints. |
| **Post-Disbursement Intervention Logging** | Interventions (FA/C/CSR/R/H/HV) are logged ONLY after `cases.status = 'disbursed'`. Intake ≠ Intervention. |
| **Offline-First by Default** | All core workflows function without internet. Sync uses custom delta protocol with domain-aware conflict resolution. |
| **Consent-Gated Data Access** | Every query evaluates `consent_ledger`. Revoked consent = immediate UI masking or `null` return. |

---

## 🏗️ 2. Architecture & Tech Stack
| Layer | Technology | Configuration | Role |
|-------|------------|---------------|------|
| **Client** | React 18 + TypeScript + Capacitor 6 + Vite | PWA + Native SQLCipher (AES-256) | Offline UI, local cache, signature capture, dynamic form renderer |
| **Server** | NestJS 10 + TypeScript + Node 20 LTS | Strict typing, Zod validation, modular guards | Sync endpoint, workflow router, ABAC evaluator, notification bus |
| **Database** | PostgreSQL 16 | `pgcrypto`, `pgAudit`, RLS enabled, materialized views | Single source of truth, encrypted PII, immutable audit logs |
| **Storage** | MinIO (S3-compatible) | SSE-S3 encryption, versioning, private buckets | Document vault (signatures, vouchers, IRF attachments) |
| **Proxy/Infra** | Caddy 2 + Podman + Ubuntu 22.04 | Auto-TLS, WAF, rate limiting, mTLS optional | Reverse proxy, connection pooling, backup cron |
| **Sync Protocol** | Custom REST + Ed25519 + Idempotency Keys | Delta packaging, version vectors, semantic merge rules | Offline → online reconciliation without data loss |

---

## 👥 3. User Roles & Access Matrix
| Role | Auth/Channel | Permissions | Data Scope | PDF Anchor |
|------|--------------|-------------|------------|------------|
| **MSWDO Social Worker** | JWT + SMS OTP + Device Binding | Create GIS, log interventions (post-disbursement), view family graph, export reports | Assigned barangays + linked households | GIS, Client Stub, Access Card |
| **MSWDO Admin** | MFA + Desktop (online) | Manage programs, users, consent ledger, sync queue, audit exports | Full system | Dynamic Program Config |
| **Barangay Coordinator** | SMS OTP + Mobile PWA | Submit GIS drafts, scan signatures, view assigned beneficiaries, receive announcements | Single barangay only | Case Tracker, Field Intake |
| **Claimant/Beneficiary** | SMS OTP + Access Card `Code#` | View service history, track status, manage consent, download receipts | Self + household (if consent granted) | Access Card, Client Dashboard |
| **Mayor's Office** | MFA + SSO | View anonymized tracker, fund utilization, SLA compliance (NO PII) | Aggregate/municipal | Petty Cash Voucher, Dashboard |
| **Auditor (COA/DSWD)** | MFA + Hardware Token | Read-only audit logs, hash-chain verification, consent ledger | Full system (immutable) | IRF, pgAudit, COA Reports |

---

## 🔄 4. Core Business Workflows (Strictly Mapped to PDFs)
```
[Client Walk-in/Referral]
       ↓
1️⃣ GIS INTAKE (Client Stub + General Intake Sheet)
   • Captures: Identity, family composition, requirements checklist, problem presented
   • Generates: `case` with `control_no`, `status = 'pending_assessment'`
   • ⛔ NO intervention fields enabled. Profile edits allowed ONLY here.
       ↓
2️⃣ ASSESSMENT & APPROVAL
   • SW completes assessment → Certificate of Eligibility generated
   • MSWDO Head reviews → Mayor approves → Petty Cash Voucher issued
   • Status: `pending_assessment` → `in_review` → `approved` → `disbursed`
       ↓
3️⃣ POST-INTERVENTION LOGGING (Service Delivery Complete)
   • SW logs: FA/C/CSR/R/H/HV, amount, fund source, OR/voucher #, service date
   • Uploads: Worker signature + client receipt/liquidation scan
   • System commits: Creates `intervention` → updates `case_tracker_log` → appends to `access_card_services` → triggers duplicate/fund checks
       ↓
4️⃣ TRACKING & NOTIFICATION
   • Auto-syncs to Case Tracker dashboard
   • SMS/in-app notification sent (if opted-in)
   • Beneficiary dashboard updates status & digital Access Card log
```

**IRF/Criminal Workflow**:
```
[Abuse/Criminal Incident Reported]
       ↓
Social Worker fills IRF (Blotter #, Category, Item A/B/C, Auth Signatures)
       ↓
System encrypts victim details, masks names by default, links to `case`
       ↓
Secure export to WCPD/PNP requires `legal_basis_code` + audit log entry
       ↓
Case disposition tracked: `Under Investigation` → `Referred` → `Closed`
```

---

## 🗄️ 5. Core Database Schema (Exact PDF Field Mapping)

```sql
-- BENEFICIARIES & HOUSEHOLDS
CREATE TABLE beneficiaries (
  id TEXT PRIMARY KEY,
  philsys_number TEXT UNIQUE,
  surname TEXT NOT NULL, first_name TEXT NOT NULL, middle_name TEXT,
  gender TEXT CHECK (gender IN ('Male','Female')),
  dob DATE NOT NULL, address TEXT, phone TEXT,
  access_card_code TEXT UNIQUE, -- NORZ-AC-YYYY-####
  consent_status TEXT DEFAULT 'active',
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE households (
  id TEXT PRIMARY KEY,
  primary_beneficiary_id TEXT REFERENCES beneficiaries(id),
  barangay TEXT, estimated_income DECIMAL,
  verified_by TEXT, verified_at TIMESTAMP DEFAULT NOW()
);

-- FAMILY COMPOSITION (From Access Card)
CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id),
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- Spouse, Child, Parent, Sibling, etc.
  age INTEGER,
  status_income TEXT, -- Employed, Unemployed, Student, PWD, etc.
  is_primary BOOLEAN DEFAULT FALSE
);

-- CASES (Client Stub + Assessment + Approval)
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  control_no TEXT UNIQUE NOT NULL, -- From Client Stub
  beneficiary_id TEXT REFERENCES beneficiaries(id),
  service_requested TEXT[], -- ['Financial Aid', 'Case Study Report', 'PWD Referral', 'Others']
  requirements_checklist JSONB, -- Medical Cert, Indigency, Valid ID, etc.
  status TEXT CHECK (status IN ('pending_assessment','in_review','approved','disbursed','closed')),
  certificate_url TEXT, petty_cash_voucher_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
);

-- INTERVENTIONS (POST-DISBURSEMENT ONLY)
CREATE TABLE interventions (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  intervention_type TEXT CHECK (intervention_type IN ('FA','C','CSR','R','H','HV','Other')),
  amount DECIMAL(12,2),
  fund_source TEXT CHECK (fund_source IN ('Regular','PDAF','Legislative','Donation')),
  agency TEXT,
  service_date DATE NOT NULL,
  voucher_no TEXT, or_reference TEXT,
  worker_signature_url TEXT NOT NULL, -- Mandatory
  logged_by TEXT REFERENCES users(id), logged_at TIMESTAMP DEFAULT NOW()
);

-- CASE TRACKER LOG ("God Database")
CREATE TABLE case_tracker_log (
  id TEXT PRIMARY KEY,
  daily_seq_num INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  surname TEXT, first_name TEXT, middle_name TEXT,
  gender TEXT CHECK (gender IN ('M','F')),
  age_range TEXT CHECK (age_range IN ('0-7','8-17','18-59','60+')),
  client_category TEXT, -- Children, Youth, Women, PWD, Senior, Family
  barangay TEXT,
  intervention_remarks TEXT, -- FA/C/CSR/R/H/HV
  UNIQUE (transaction_date, daily_seq_num)
);

-- ACCESS CARD SERVICE RECORDS
CREATE TABLE access_card_services (
  id TEXT PRIMARY KEY,
  access_card_code TEXT REFERENCES beneficiaries(access_card_code),
  service_date DATE NOT NULL,
  service_rendered TEXT NOT NULL,
  cost DECIMAL(12,2),
  agency TEXT,
  worker_name_sign TEXT,
  intervention_id TEXT REFERENCES interventions(id)
);

-- IRF (Incident Report Form)
CREATE TABLE irf_cases (
  id TEXT PRIMARY KEY,
  blotter_entry_number TEXT UNIQUE NOT NULL,
  case_category TEXT NOT NULL,
  datetime_reported TIMESTAMP, datetime_incident TIMESTAMP,
  item_a_reporting_person JSONB,
  item_b_person_reported JSONB,
  encrypted_narration BYTEA, -- AES-256 via pgcrypto
  case_disposition TEXT,
  msdw_signature_url TEXT, reporting_signature_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DYNAMIC PROGRAMS
CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, category TEXT,
  waiting_period_days INTEGER,
  required_documents JSONB,
  fund_sources TEXT[],
  approval_workflow TEXT[],
  form_template JSONB, -- JSON Schema
  is_active BOOLEAN DEFAULT TRUE
);

-- CONSENT & AUDIT
CREATE TABLE consent_ledger (
  id TEXT PRIMARY KEY, beneficiary_id TEXT,
  purpose TEXT, channel TEXT, status TEXT DEFAULT 'active',
  granted_at TIMESTAMP, revoked_at TIMESTAMP
);
-- pg_audit_logs auto-enabled via trigger
```

---

## 🔗 6. API Contract & Guards

| Endpoint | Method | Purpose | Critical Guard |
|----------|--------|---------|----------------|
| `/api/cases` | `POST` | Create GIS intake + Client Stub | Validates requirements checklist; sets `status='pending'` |
| `/api/cases/:id/status` | `PATCH` | Advance approval workflow | FSM transition guard; requires role-specific signature |
| `/api/interventions` | `POST` | Log post-disbursement service | `CHECK cases.status = 'disbursed'`; requires `worker_signature_url` |
| `/api/sync/v1` | `POST` | Delta sync (offline → server) | Ed25519 sig verification + idempotency key + consent filter |
| `/api/irf` | `POST` | Submit Incident Report Form | Encrypts `Item C` immediately; masks names in default views |
| `/api/beneficiary/dashboard` | `GET` | Claimant self-service view | ABAC + `consent_ledger` evaluation; read-only |
| `/api/programs` | `GET/POST` | Dynamic program config | Admin-only; validates JSON Schema form templates |

**Sync Conflict Rules**:
- Financial/Amount/Status → `Server Wins`
- Case Notes/Observations → `Chronological Append`
- Consent/Permissions → `Server Revocation Overrides`
- Unclear → `Conflict Queue` for Unit Head review

---

## 🖥️ 7. UI/UX Screen Inventory (PDF-Aligned)

| Screen | Role | Key Elements (Mapped to PDFs) |
|--------|------|-------------------------------|
| Dual-Mode GIS Intake | SW/Coordinator | Client Stub fields, Requirements checklist, Family Composition table, Assessment, Signatures |
| Approval Pipeline | SW/Admin | Certificate of Eligibility view, Petty Cash Voucher preview, Mayor/MSWDO Head e-sign/scan |
| Post-Intervention Logger | SW | Disbursed case list, FA/C/CSR/R/H/HV selector, Fund source, OR upload, Worker signature |
| Digital Case Tracker | All | Date-ordered table, Surname/First/Middle, Gender/Age/Category/Barangay, Intervention/Remarks |
| Access Card Manager | Admin/SW | Code# generator, 18-row service log, refill print, loss/replacement workflow, rules display |
| IRF Module | SW/WCPD Liaison | Blotter #, Category, Item A/B/C fields, Auth signatures, masked victim view, secure export |
| Claimant Dashboard | Beneficiary | Status tracker, Service history timeline, Digital Access Card view, Consent hub, Notifications |
| Program Configurator | Admin | Name/Category/Waiting period/Requirements/Workflow builder, JSON Schema form preview |
| Fund & SLA Dashboard | Mayor/Auditor | Released vs allocated %, unique households, overdue approvals, COA export |

---

## ⚙️ 8. Algorithms & Technical Directives

| Algorithm | Applied In | Implementation Directive |
|-----------|------------|--------------------------|
| Recursive CTE (DFS) | Family graph traversal | `WITH RECURSIVE` up to 2 degrees; filter by `consent_status` |
| Trigram + BM25 | Beneficiary search | `pg_trgm` fallback for typos; GIN index on `search_vector` |
| Version Vectors + Semantic Merge | Offline sync | Field-level `client_updated_at` vs `server_updated_at`; rule-based resolution |
| Sliding Window | Duplicate detection | `COUNT() OVER (PARTITION BY household_id ORDER BY service_date RANGE BETWEEN INTERVAL '30 days' PRECEDING AND CURRENT ROW)` |
| Finite State Machine | Case status workflow | Strict transitions: `pending` → `review` → `approved` → `disbursed` → `closed` |
| SHA-256 Hash Chaining | Audit trail | `intervention.prev_hash = SHA256(intervention.payload + prev_hash)` |
| ABAC Policy Eval | Access control | `(role, resource_sensitivity, consent_status, legal_basis)` → dynamic row masking |

---

## 🛡️ 9. Compliance & Security Controls

| Requirement | Technical Implementation | Legal Anchor |
|-------------|--------------------------|--------------|
| RA 10173 Consent Gating | `consent_ledger` + ABAC middleware; instant UI masking on revoke | Sec. 12/26 |
| COA Audit Integrity | `pgAudit` + SHA-256 chain + mandatory `worker_signature_url` | Circular 2022-003 |
| ARTA Processing Time | SLA timers + FSM state tracking + auto-escalation | RA 11032 |
| Offline Resilience | SQLCipher cache + version vectors + CSV fallback + date sequencing | Business Continuity |
| IRF Confidentiality | `pgcrypto` AES-256 for narration; default `NULL` for names; access log required | DSWD AO 2020-002 |
| "No Card = No Voucher" | API guard: `SELECT status FROM beneficiaries WHERE access_card_code = ?` | Access Card Rule 4 |

---

## 📅 10. Sprint Schedule & Acceptance Criteria

| Sprint | Weeks | Focus | Deliverables | Acceptance Gate |
|--------|-------|-------|--------------|-----------------|
| **1** | 1–2 | Architecture, Programs, Graph | ERD live, program builder, family graph, RBAC/ABAC, consent ledger | All schemas deployed, graph query <500ms, RLS enforced |
| **2** | 3–4 | Offline Core, Sync, Forms | SQLCipher, delta sync, conflict resolver, JSON schema renderer | Offline CRUD → online sync w/ zero loss; 12 conflict tests pass |
| **3** | 5–6 | GIS, Intervention, Tracker | Dual-mode GIS, post-logging guard, daily tracker, signature capture | Interventions block until `disbursed`; tracker matches manual tally |
| **4** | 7–8 | Access Card, Workflow, Notifications | Code# system, SLA timers, OTP fallback, SMS/in-app templates, rate limiting | "No card = no voucher" enforced; notifications respect consent |
| **5** | 9–10 | IRF, Sharing, Security | Encrypted IRF, victim masking, WCPD export, field-level sharing | COA audit trail valid; IRF reveal requires legal basis + 2FA |
| **6** | 11–12 | Dashboard, UAT, Hardening | Fund metrics, claimant dashboard, pilot, bug fixes, final docs | 95% sync success; staff UAT sign-off; thesis chapters complete |

---

## 🤖 11. Agentic Team Guidelines & Conventions

| Rule | Directive |
|------|-----------|
| **Type Safety First** | Generate TypeScript interfaces/Zod schemas before logic. No `any` types in DB/API layers. |
| **Compliance by Default** | Every `POST/PUT/PATCH` validates: consent status, RLS scope, signature requirement, idempotency key. |
| **Offline-First UX** | Handle `navigator.onLine === false` gracefully. Show pending queue count. Disable sync-dependent actions. |
| **Audit Logging** | Use `pgAudit` triggers. Never log raw PII. Hash client identifiers in delivery logs. |
| **Conflict Resolution** | Implement semantic merge exactly as specified. Fallback to queue. Never auto-resolve financial fields. |
| **Dynamic Forms** | Render via `react-jsonschema-form`. Validate against `programs.form_template` JSON Schema. Version on change. |
| **Testing** | ≥80% unit coverage. E2E for sync, conflict, signature upload, consent revocation. Mock PhilSys/DSWD APIs. |
| **Commit Convention** | `feat:`, `fix:`, `docs:`, `security:`, `perf:`. Reference FR-IDs. Include sync status in offline logic changes. |
| **Error Handling** | Never expose internal IDs/stack traces. Show: `"Service temporarily unavailable. Contact MSWDO."` |

---

## ✅ Handoff Checklist for Agentic Team
- [ ] Initialize PostgreSQL 16 + enable `pgcrypto`, `pgAudit`, RLS
- [ ] Scaffold NestJS modules: `auth`, `sync`, `cases`, `interventions`, `programs`, `notifications`, `irf`, `audit`, `beneficiary_dashboard`
- [ ] Configure Capacitor + SQLCipher + dynamic form renderer
- [ ] Implement sync endpoint with Ed25519 verification + idempotency
- [ ] Deploy Caddy + Podman + backup cron
- [ ] Run compliance audit script (RA 10173 field mapping, RLS policy validation, hash-chain integrity)
- [ ] Generate OpenAPI spec + seed data for pilot UAT
- [ ] Deliver Sprint 1 artifacts + architecture diagram + test results

---

