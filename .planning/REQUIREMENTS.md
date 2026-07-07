# Requirements: Kapwa — MSWDO Norzagaray

**Defined:** 2026-07-05
**Core Value:** Social workers can register any claimant, conduct a full social case study (GIS), manage the complete approval workflow, log interventions post-disbursement, and track every service rendered — reliably offline in the field with automatic sync when connected.

## v1.1 Requirements (Completed: UI/UX Overhaul)

### UI/UX
- ✓ **UIX-01**: Full shadcn component migration across all screens
- ✓ **UIX-02**: Design token system (Tailwind CSS variables + CSS custom properties)
- ✓ **UIX-03**: Responsive layout + mobile UX for field workers
- ✓ **UIX-04**: Loading/empty/error states on every page
- ✓ **UIX-05**: Accessibility improvements (ARIA labels, keyboard nav)
- ✓ **UIX-06**: Public landing, about, and auth flow pages
- ✓ **UIX-07**: Print styles for reports
- ✓ **UIX-08**: Icon sizing standardization (size prop, consistent 16/20/24 scale)

## v1.2 Requirements (Current: Quality & Resilience Hardening)

### Toolchain
- [ ] **DEP-01**: Move playwright, @capacitor/cli, and esbuild to devDependencies
- [ ] **DEP-02**: Upgrade vitest to v4 and testing libraries (@testing-library/react, @testing-library/jest-dom)

### Error Resilience
- [x] **ERR-01**: Wrap all 28 pages in `<ErrorBoundary>` — catch render errors with fallback UI

### Test Coverage
- [x] **TST-01**: Unit tests for `api.ts` (67 functions, ≥70% coverage)
- [x] **TST-02**: Unit tests for `auth-context.tsx` (login, logout, role checks)
- [x] **TST-03**: Unit tests for `offline-queue.ts` (queue, dequeue, conflict resolution)
- [x] **TST-04**: Unit tests for `secure-storage.ts` (encrypt, decrypt, key rotation)
- [x] **TST-05**: Smoke tests for core UI components: Layout, Topbar, Sidebar, ProtectedRoute
- [x] **TST-06**: At least 1 smoke test per page (28 pages — renders without crash)
- [ ] **TST-07**: Integrate axe-core into CI pipeline — a11y assertions in vitest suite

### API Layer
- [x] **API-01**: Centralized API client with retry (3x GET), timeout (10s), Bearer token interceptor
- [x] **API-02**: Activate SWR for data fetching — replace raw `fetch()` calls with `useSWR` hooks

### Accessibility
- [x] **A11Y-01**: Enable `SkipToContent` component in `<Layout>`
- [x] **A11Y-02**: CI pipeline fails on a11y violations (integrated via TST-07) — tests integrated; CI gate deferred to Phase 17

### Security
- [ ] **SEC-01**: Token refresh/rotation — `onUnauthorized` interceptor in API client, break loop on 401 refresh

### Major Upgrades
- [x] **UPG-01**: Upgrade React 18 → 19 (test mobile Capacitor builds after)
- [x] **UPG-02**: Upgrade Capacitor 6 → 8 (test Android + iOS builds after)
- [x] **UPG-03**: Upgrade Tailwind CSS v3 → v4 (audit UI rendering after)

---

## Existing v1.1 Active Requirements (from prior milestone)

### Beneficiary Profiling (GIS Intake)
- [ ] **GIS-01**: Staff can conduct dual-mode GIS intake (online/offline) capturing Client Stub fields, requirements checklist, family composition, assessment notes
- [ ] **GIS-02**: Profile fields are editable ONLY during active GIS intake sessions — no standalone PATCH endpoints
- [ ] **GIS-03**: Generate case with control_no and status = 'pending_assessment' on intake completion
- [ ] **GIS-04**: Staff can search beneficiaries by name/category/barangay using trigram + BM25 with typo tolerance
- [ ] **GIS-05**: Family graph visualization via recursive CTE (2 degrees, consent-filtered)

### Intervention Tracking
- [ ] **INT-01**: Interventions (FA/C/CSR/R/H/HV) are loggable ONLY after case.status = 'disbursed'
- [ ] **INT-02**: End-to-end workflow: intake → assessment → approval → disbursement → post-intervention logging
- [ ] **INT-03**: Eligibility checks with sliding window duplicate detection (30-day household limit)
- [ ] **INT-04**: Mandatory worker signature + client receipt/liquidation upload per intervention
- [ ] **INT-05**: Case Tracker Log (daily sequencing, transaction_date + daily_seq_num unique constraint)
- [ ] **INT-06**: Auto-appends to Access Card service records on intervention creation
- [ ] **INT-07**: Fund source tracking (Regular/PDAF/Legislative/Donation) with per-source balance checks

### Access Card System
- [ ] **AC-01**: Generate unique Access Card codes (NORZ-AC-YYYY-####) per beneficiary
- [ ] **AC-02**: 18-row service log per card with refill/print workflow
- [ ] **AC-03**: Loss/replacement workflow with audit trail
- [ ] **AC-04**: "No Card = No Voucher" API guard enforced

### IRF (Incident Report Form) Module
- [ ] **IRF-01**: Staff can submit IRF with blotter entry number, category, Item A/B/C fields
- [ ] **IRF-02**: AES-256 encryption of victim narration via pgcrypto; names masked by default
- [ ] **IRF-03**: Secure export to WCPD/PNP requiring legal_basis_code + audit log entry
- [ ] **IRF-04**: Case disposition tracking: Under Investigation → Referred → Closed

### Dynamic Programs
- [ ] **PRG-01**: Admin can configure programs (name, category, waiting period, required docs, fund sources)
- [ ] **PRG-02**: Program config includes JSON Schema form template for dynamic rendering
- [ ] **PRG-03**: Approval workflow per program type (configurable steps)

### User Roles & Access
- [ ] **ROL-01**: 6 roles: MSWDO Social Worker, MSWDO Admin, Barangay Coordinator, Claimant, Mayor's Office, Auditor
- [ ] **ROL-02**: Barangay Coordinator scoped to single barangay, SMS OTP auth + mobile PWA
- [ ] **ROL-03**: Mayor's Office sees aggregate data only (no PII)
- [ ] **ROL-04**: Auditor role — read-only audit logs, hash-chain verification, consent ledger
- [ ] **ROL-05**: Beneficiary self-service dashboard (status tracker, service history, Access Card view, consent hub)

### Consent & Compliance
- [ ] **CON-01**: Consent ledger with grant/revoke tracking; revoked consent = immediate UI masking
- [ ] **CON-02**: ABAC evaluates (role, resource_sensitivity, consent_status, legal_basis) for every query
- [ ] **CON-03**: ARTA SLA timers with auto-escalation for overdue approvals
- [ ] **CON-04**: DSWD/COA-compliant export formats (reports, audit logs)
- [ ] **CON-05**: RA 10173 data privacy controls (pgcrypto for PII, consent gating)

### Offline Sync
- [ ] **SYNC-01**: SQLCipher local cache on mobile (AES-256 encrypted)
- [ ] **SYNC-02**: All core workflows function offline; delta sync on reconnect
- [ ] **SYNC-03**: Conflict resolution rules: Financial/Amount → Server Wins, Notes → Chronological Append, Consent → Server Revocation Overrides, Unclear → Conflict Queue
- [ ] **SYNC-04**: Idempotency key enforcement on sync endpoint

### Infrastructure
- [ ] **INF-01**: MinIO (S3-compatible) for document vault (signatures, vouchers, IRF attachments)
- [ ] **INF-02**: Caddy 2 reverse proxy with auto-TLS, rate limiting
- [ ] **INF-03**: Docker Compose deployment with backup cron
- [ ] **INF-04**: Notifications (SMS via Twilio? + in-app) respecting consent preferences

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Integration with PhilSys/DSWD national databases | Standalone system; CSV/PDF export for external submission |
| Real-time chat between beneficiaries and staff | Chat infrastructure exists but not MSWDO-priority |
| Scheduling/appointment system | Not in current spec |
| Full financial management (LGU budgeting) | Fund tracking only per intervention/program |
| Redux/Zustand state management | SWR + React Context sufficient for current scale |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-01 | — | Pending |
| DEP-02 | — | Pending |
| ERR-01 | 16 | ✓ |
| TST-01 | 15 | ✓ |
| TST-02 | 15 | ✓ |
| TST-03 | 15 | ✓ |
| TST-04 | 15 | ✓ |
| TST-05 | 16 | ✓ |
| TST-06 | 16 (folded from 17) | ✓ |
| TST-07 | — | Pending |
| API-01 | 14 | ✓ |
| API-02 | 14 | ✓ |
| A11Y-01 | 16 | ✓ |
| A11Y-02 | 16 (CI gate deferred to 17) | ✓ |
| SEC-01 | — | Pending |
| UPG-01 | 13 | ✓ |
| UPG-02 | 13 | ✓ |
| UPG-03 | 13 | ✓ |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---

*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after milestone v1.2 definition*
