# Kapwa System — MSWDO Digitalization Gap Coverage Audit

**Date:** 2026-07-26
**Scope:** Server (`kapwa-server/src/`) and Client (`kapwa-client/src/`) implementation audit against documented MSWDO digitalization gaps.

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ FULLY IMPLEMENTED | Works in production, no critical gaps |
| 🟡 PARTIALLY IMPLEMENTED | Works but has bugs, missing pieces, or edge cases |
| ❌ MISSING | Not built, stub, or dead code |
| ❌ NON-FUNCTIONAL | Code exists but cannot work due to critical bug |
| ❌ DEAD CODE | Unused / being removed |

---

## 1. Digital Beneficiary Registry + GIS Intake

**Target gap:** Paper forms, no digital profile, manual lookup across paper files.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| `POST /intake` (10-step transactional pipeline) | ✅ FULLY | `intake.service.ts` — SERIALIZABLE transaction creates Person→Beneficiary→Claimant→Household→FamilyMembers→Case→ConsentLedger |
| Zod intake validation | ✅ FULLY | `intake.zod.ts` — 15+ required fields including email regex, enum constraints |
| `GET /beneficiaries` (paginated registry) | ✅ FULLY | `beneficiaries.controller.ts` — filterable by barangay/category/search, paginated |
| Beneficiary search (pg_trgm + FTS) | ✅ FULLY | `beneficiaries.service.ts` — 3-tier: ILIKE (2 chars), trigram similarity + FTS (3+ chars). GIN indexes on `search_vector` and `(surname, first_name) gin_trgm_ops` confirmed in migrations |
| Client intake form | ✅ FULLY | `IntakePage.tsx` (462 lines) with match-check integration |
| Client search UI | ✅ FULLY | Cmd+K `GlobalSearch`, `SearchResultsPage`, `BeneficiariesPage` with filters |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **A1** | PhilHealth dedup queries `philsysNumber` with value from `philhealthNumber` — different DB columns | `intake.service.ts:45` | **HIGH** — PhilHealth-based duplicate detection never matches |
| **A2** | Family member gender hardcoded to `'Male'`; Zod schema has no `gender` field so it's never collected | `intake.service.ts:133,319` / `intake.zod.ts:33-43` | **MEDIUM** — corrupts family composition data |
| **A3** | Family member DOB hardcoded to `new Date()`; Zod schema has no `dob` field | `intake.service.ts:135,321` / `intake.zod.ts:33-43` | **MEDIUM** — age calculations for family members are meaningless |

---

## 2. Case Tracking (FSM)

**Target gap:** Cases get lost between assessment steps; no automated status tracking.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| CaseStatus enum (6 states) | ✅ FULLY | `case.entity.ts:6-13` — ENROLLED→ASSESSED→IN_REVIEW→ACTIVE→TRANSITIONING→CLOSED |
| Strict transition map | ✅ FULLY | `cases.service.ts:249-256` — only linear forward + CLOSED allowed; anything else throws |
| Per-transition validation guards (5 rules) | ✅ FULLY | `cases.service.ts:260-277` — assessment fields→FRVA/SWDI→intervention count→selfReliance→clientSignature |
| Admin override (bypasses FSM) | ✅ FULLY | `cases.service.ts:420-434` — requires reason, logged as `'override'` |
| CaseHistory entity | ✅ FULLY | `case-history.entity.ts` — fromStatus, toStatus, role, transitionType, overrideReason |
| History logging on every transition | ✅ FULLY | All 6 transition methods call `logHistory()` |
| `GET /cases/:id/history` | ✅ FULLY | `cases.controller.ts:76` — ordered ASC |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **B1** | `!c.frvaScore` treats `0` (valid score) as falsy — FRVA score of 0 blocks ENROLLED→ASSESSED transition | `cases.service.ts:263` | **HIGH** — a case with zero FRVA score is stuck forever |
| **B2** | `approve()` and `updateStatus()` maintain duplicate role transition maps with different values — guaranteed drift | `cases.service.ts:279-290` vs `:337-343` | **MEDIUM** — inconsistent authorization over time |
| **B3** | `changedById` column exists but all callers pass `undefined` | `cases.service.ts` (all `logHistory` calls) | **LOW** — audit trail lacks user identity |

---

## 3. Duplicate Detection (30-day Rule)

**Target gap:** Households receive aid from multiple programs within 30 days without anyone knowing.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| Person dedup (2-stage: PhilHealth then name+DOB) | ✅ FULLY | `intake.service.ts:43-50` — but PhilHealth path is broken (see A1) |
| `matchCheck` trigram scoring | ✅ FULLY | `intake.service.ts:192-280` — weighted composite: `0.6*ben_score + 0.4*family_score`, threshold ≥0.6 |
| DB-level exclusion constraint (interventions) | ✅ FULLY | Migration `20260622000002-InterventionFields.ts:37-45` — GiST exclusion: no same household+type within 30 days |
| 30-day calculation in confirmMatch | 🟡 PARTIAL | Computes `nextEligibleDate` but does not enforce it — only returns in response |
| `COUNT() OVER (PARTITION BY ...)` | ❌ **MISSING** | Planned window-function approach for case-level dedup was never implemented |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **C1** | 30-day rule is advisory only — `confirmMatch` computes but never throws. No equivalent constraint at the case/beneficiary level | `intake.service.ts:337-347` | **MEDIUM** — duplicate enrollment within 30 days is possible |

---

## 4. Offline Capability + Sync

**Target gap:** Field workers in Norzagaray barangays have no internet connectivity; paper forms must be transported to the office.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| PWA manifest (standalone, icons) | ✅ FULLY | `manifest.json` |
| Service worker (cache-first assets, network-first API) | ❌ **DEAD CODE** | `sw.js` (84 lines) exists but **never registered** — no `navigator.serviceWorker.register()` call exists anywhere |
| Local encrypted storage | ✅ FULLY | `encrypted-db.ts` — AES-256-GCM with PBKDF2 (600k iterations); `secure-storage.ts` — SQLCipher on Capacitor, encrypted-db fallback on browser |
| Delta sync endpoint `POST /sync/v1` | ✅ FULLY | `sync.controller.ts` — processes INSERT/UPDATE/DELETE per change |
| Version vectors (per-device, per-table) | ✅ FULLY | `version-vector.entity.ts` + `sync.service.ts:511-541` |
| Ed25519 signing | ✅ FULLY | Client generates keypair, signs `{deviceId, changes}`, server verifies via `crypto.verify()` |
| Conflict resolver (server) | ✅ FULLY | `conflict-resolver.ts` — Financial=server-wins, Notes=append, Consent=server-revocation, Default=LWW. **12 test cases cover all branches.** |
| Idempotency (2-tier: in-memory LRU + DB table) | ✅ FULLY | `sync.service.ts:321-388` — 24h TTL, eviction at 10k entries |
| Online/offline event listener | ✅ FULLY | `window.addEventListener('online', syncOnReconnect)` in `sync.ts` + `Layout.tsx` banner |
| Sync queue UI (banner + panel + conflict dialog) | ✅ FULLY | `SyncStatusBanner.tsx`, `SyncQueuePanel.tsx`, `ConflictResolutionDialog.tsx` |
| Periodic auto-retry for failed/conflict items | ❌ **MISSING** | No `setInterval`/`setTimeout` — only retries on `window.online` event or manual click |
| HTTP retry for POST/PUT/DELETE | ❌ **MISSING** | `api.ts:140-172` — only GET requests have jittered exponential backoff (3 retries) |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **D1** | Service worker never registered — zero offline page caching | `main.tsx` — missing registration call | **CRITICAL** — PWA does not work offline despite having a full SW implementation |
| **D2** | Sync queue stores sensitive case/PII data in plaintext `localStorage` instead of `encrypted-db.ts` | `offline-queue.ts` | **HIGH** — encrypted storage exists but is bypassed for the sync queue |
| **D3** | Conflict dialog shows identical local and server payload — `serverPayload = item.payload` (same reference) | `ConflictResolutionDialog.tsx:60-61` | **HIGH** — user cannot meaningfully resolve conflicts |
| **D4** | `pullFromServer()` always queues server changes as `operation: 'INSERT'` even for UPDATEs | `sync.ts:152-156` | **HIGH** — potential duplicate records on pull |
| **D5** | `getChangesSince()` queries ALL rows `WHERE updated_at > 24h ago OR updated_at IS NULL` — full table scan per sync | `sync.service.ts:554-556` | **MEDIUM** — O(n) per sync, degrades with data growth |
| **D6** | `resolveConflictRemotely()` defined but never called from dialog — resolution choice never reaches server | `ConflictResolutionDialog.tsx` / `sync.ts:162-167` | **HIGH** — conflict resolution is local-only |

---

## 5. Audit Trail / COA Compliance

**Target gap:** No immutable audit trail, no hash-chaining for data integrity, no digital signatures for worker accountability.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| SHA-256 hash chain | ❌ **NON-FUNCTIONAL** | `audit.service.ts` logic is correct, migration adds `hash`/`prev_hash` columns, but **no TypeORM entity declares them** — `repo.find()` returns objects without hash fields, `verifyHashChain()` skips every record, always returns `{valid: true}` |
| Write-time hash computation | ❌ **MISSING** | No `@AfterInsert`/`@AfterUpdate` subscriber, no DB trigger, no service-layer logic |
| `getAuditLog()` | ❌ **STUB** | `audit.service.ts:57-59` — returns `[]` always |
| `exportForCoa()` | ❌ **STUB** | `audit.service.ts:71-78` — returns hardcoded empty structure |
| Digital signatures (interventions) | ✅ FULLY | `worker_signature_url TEXT NOT NULL` enforced at DB level |
| Digital signatures (case closure) | 🟡 PARTIAL | `clientSignature` column exists, StepClosure has signature pad, but stores entire data URL (potential for very large rows) |
| Digital signatures (IRF, CSR) | ❌ **MISSING** | Columns exist on entities but no capture UI, no enforcement, all nullable |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **E1** | Hash chain is completely non-functional — `hash`/`prev_hash` columns invisible to TypeORM, no entity declares them | `case.entity.ts`, `beneficiary.entity.ts`, `consent-ledger.entity.ts` — all missing `@Column()` for hash fields | **CRITICAL** — COA audit integrity requirement unmet; verification always passes falsely |
| **E2** | No write-time hash computation exists at any layer | `audit.service.ts`, no subscriber, no trigger | **CRITICAL** — even if entities were mapped, nothing would compute hashes |
| **E3** | `getAuditLog()` and `exportForCoa()` are stubs returning empty data | `audit.service.ts:57-59,71-78` | **HIGH** — COA export requirement unmet |

---

## 6. Consent Management / RA 10173 Compliance

**Target gap:** No consent-based data access, no privacy controls, no way to revoke consent.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| ConsentLedger entity | ✅ FULLY | `consent-ledger.entity.ts` — status, purpose, channel, revokedAt, revokedReason |
| Consent creation on intake | ✅ FULLY | Both `submitIntake()` and `confirmMatch()` create consent with `status:'active'` |
| Consent revoke endpoint | ✅ FULLY | `POST /beneficiaries/:id/consent/revoke` with optional reason |
| ABAC consent gate | ✅ FULLY | `abac.guard.ts:33-41` — checks consent on beneficiary routes, throws `ForbiddenException` if revoked |
| PII masking on revoke (server interceptor) | ✅ FULLY | `pii.interceptor.ts` — nulls surname, firstName, middleName, address, phone, dob, philsysNumber |
| Client-side PII masking | ✅ FULLY | `usePiiMasking` hook + `pii-utils.ts` |
| Consent revocation respected in offline sync | ✅ FULLY | Server revocation overrides client state in conflict resolver |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| — | ABAC skips consent check for case and IRF routes (lines 29-30) | `abac.guard.ts:29-30` | **LOW** — PII interceptor provides defense-in-depth |

**Verdict:** PRODUCTION-READY. The consent module is end-to-end complete across server, client, and offline sync.

---

## 7. SLA Monitoring / ARTA Compliance

**Target gap:** No tracking of how long cases sit at each stage; RA 11032 (ARTA) processing times cannot be enforced.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| SLA constants (2/3 day thresholds, weekend exclusion) | ✅ FULLY | `sla/constants.ts` |
| Cron escalation (`EVERY_30_MINUTES`) | ✅ FULLY | `sla.service.ts:20` — registered via `ScheduleModule.forRoot()` |
| SLA overdue flag on case queries | ✅ FULLY | `cases.service.ts:199-213` — `computeSlaOverdue()` annotates each case |
| `?sla=overdue` and `?sla=on_track` filters on case listing | ✅ FULLY | `cases.service.ts:119-123` |
| Manual SLA check endpoint | ✅ FULLY | `POST /sla/check` — admin-only |
| Notification creation on escalation | ✅ FULLY | `sla.service.ts:87-100` — creates Notification records for all active admins |
| Auto status change on SLA breach | ❌ **MISSING** | Cron creates notifications only — never auto-transitions a case |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **F1** | SLA cron ignores ASSESSED status — only checks ENROLLED, IN_REVIEW, ACTIVE | `sla.service.ts:30-40` | **HIGH** — cases stuck in ASSESSED never get escalated |
| **F2** | `computeSlaOverdue()` uses `APPROVED_ESCALATION_DAYS` (3) for IN_REVIEW — constant name doesn't match status | `cases.service.ts:207` | **LOW** — functionally correct but misleading |
| **F3** | ACTIVE threshold inconsistent: cron uses `APPROVED_ESCALATION_DAYS` (3), `computeSlaOverdue` uses hardcoded `30` | `sla.service.ts:36` vs `cases.service.ts:209` | **MEDIUM** — two different thresholds for the same status |
| **F4** | `statusLabel()` missing `'active'` entry | `sla.service.ts:84` | **LOW** — cron displays raw `'active'` in notifications |

---

## 8. Service History / Beneficiary Dashboard

**Target gap:** No way for beneficiaries to see what services they received; no Access Card digital record.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| Code# generator | ✅ FULLY | `access-cards.service.ts:15-41` — `NORZ-AC-{year}-{seq}`, SERIALIZABLE transaction |
| AccessCardService entity | ✅ FULLY | `access-card-service.entity.ts` — 8 data columns |
| Direct service logging (`POST /access-cards/log`) | ✅ FULLY | Zod-validated, creates `access_card_services` row |
| Auto-log on intervention creation | ✅ FULLY | `autoLogFromIntervention()` — called from case-interventions service |
| Beneficiary dashboard UI | ✅ FULLY | `ClaimantDashboardPage.tsx`, `MyAccessCardPage.tsx`, routes, nav |
| `GET /beneficiaries/dashboard` (claimant) | 🟡 PARTIAL | Route exists but `getMyServices()` returns `services: []` and `getAccessCard()` returns hardcoded `remainingSlots: 18` (see G1, G2) |
| "No Card = No Voucher" guard | ❌ **MISSING** | No middleware blocks intervention creation when `access_card_code` is absent |
| Card loss / replacement | ❌ **MISSING** | No endpoints for re-issuance |
| Case tracker log (daily_seq_num) | ❌ **DEAD CODE** | Table exists but scheduled for deletion (migration `20260723000001`); no TypeORM entity; zero INSERTs; no sequence for `daily_seq_num` |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **G1** | `getMyServices()` returns hardcoded `services: []` — never queries `access_card_services` table | `beneficiaries.service.ts:243` | **CRITICAL** — entire service history feature renders blank on the beneficiary dashboard |
| **G2** | `getAccessCard()` returns hardcoded `services: []` and `remainingSlots: 18` — never computed from DB | `beneficiaries.service.ts:265-266` | **CRITICAL** — Access Card view on dashboard shows no services and always claims 18 slots |
| **G3** | No enforcement of "No Card = No Voucher" — interventions can be created freely; `autoLogFromIntervention` silently exits with `console.warn` if no card exists | `access-cards.service.ts:99-108` | **HIGH** — core business rule not implemented |
| **G4** | Case tracker log table is entirely dead code — scheduled for deletion, never populated, no entity, no sequence | `20260723000001-DropCaseTrackerLog.ts` | **HIGH** — if this feature is needed, it must be rebuilt from scratch |

---

## 9. Encrypted IRF (Incident Report Form)

**Target gap:** Paper IRF forms have no encryption for victim narratives, no access logging, and no secure export to WCPD/PNP.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| pgcrypto AES-256-CBC encryption | ✅ FULLY | `irf.service.ts:41-52` — per-record keys via `gen_random_bytes`, narration encrypted at DB level |
| Key wrapping with master key | ✅ FULLY | `irf-key.service.ts:26-33` — AES-256-CBC key wrap, `key_wraps` JSONB column |
| Default name masking | ✅ FULLY | `irf.service.ts:92-101` — surname/firstName returned as `[REDACTED]` |
| Decryption requires legal basis | ✅ FULLY | `irf.service.ts:134-165` — `legalBasis` required, audit-before-decrypt pattern |
| Name unmasking also gated | ✅ FULLY | `irf.service.ts:171-188` — same legal basis + audit log requirement |
| Secure WCPD/PNP export | ✅ FULLY | `irf-export.service.ts` — password-protected PDF, restricted permissions (no copy, no modify, low-res print) |
| Disposition FSM with logged overrides | ✅ FULLY | Refer→WCPD→PNP→Dismiss→Close; admin overrides audited |
| Access audit logging | ✅ FULLY | `irf-audit.service.ts` — all sensitive actions logged to `audit_log` table |

### Severity

| # | Bug | File:Line | Impact |
|---|-----|-----------|--------|
| **H1** | Audit logs use hardcoded `userId: 'system'` instead of actual user identity | `irf.service.ts:144` | **MEDIUM** — decryption audit trail lacks who-did-it |

**Verdict:** PRODUCTION-READY. The IRF module is the most complete feature in the system with defense-in-depth encryption, access control, audit logging, and secure export.

---

## 10. Access Control & RBAC

**Target gap:** No role-based access, no worker accountability.

### Implementation Status

| Component | Status | File(s) |
|-----------|--------|---------|
| JWT authentication | ✅ FULLY | `jwt.strategy.ts`, `jwt-auth.guard.ts` |
| RolesGuard (role check on endpoints) | ✅ FULLY | `roles.guard.ts` — checks `@Roles()` decorator against `req.user.role` |
| ABAC Guard (fine-grained access) | ✅ FULLY | `abac.guard.ts` — admin bypass, coordinator barangay-scoping, SW barangay-scoping, consent check |
| ABAC Service (resource sensitivity) | ✅ FULLY | `abac.service.ts` — public/internal/sensitive/restricted tiers |
| Role-gated FSM transitions | ✅ FULLY | `cases.service.ts:279-290` — per-status allowed roles (but duplicated, see B2) |
| `auditor` read-only access | ✅ FULLY | Auditor role on tracker/history endpoints |

---

## Summary

| # | Gap | Overall Status | Most Critical Issue | Severity |
|---|-----|---------------|---------------------|----------|
| 1 | Digital registry + intake | ✅ FULLY | PhilHealth dedup field mismatch (A1) | HIGH |
| 2 | Case FSM tracking | ✅ FULLY | FRVA score of 0 locks case (B1) | HIGH |
| 3 | Duplicate detection | 🟡 PARTIAL | 30-day rule not enforced at case level (C1) | MEDIUM |
| 4 | Offline capability | 🟡 PARTIAL | SW never registered (D1) / Sync queue in plaintext (D2) | CRITICAL |
| 5 | Audit trail / COA | ❌ NON-FUNCTIONAL | Hash chain invisible to TypeORM (E1/E2) | CRITICAL |
| 6 | Consent / RA 10173 | ✅ FULLY | Minor ABAC scope gap | LOW |
| 7 | SLA / ARTA | 🟡 PARTIAL | ASSESSED never escalated by cron (F1) | HIGH |
| 8 | Service history / dashboard | 🟡 PARTIAL | Dashboard returns empty services (G1/G2) | CRITICAL |
| 9 | Encrypted IRF | ✅ FULLY | Hardcoded userId in audit logs (H1) | MEDIUM |
| 10 | Access control | ✅ FULLY | No critical issues | — |

### Fix Priority

1. **CRITICAL** — Fix hash chain entity mapping (E1/E2) and register service worker (D1)
2. **CRITICAL** — Wire dashboard endpoints to query `access_card_services` (G1/G2)
3. **HIGH** — Fix PhilHealth dedup field (A1), FRVA=0 guard (B1), ASSESSED SLA cron (F1)
4. **HIGH** — Fix conflict dialog payload reference (D3), pull-INSERT bug (D4), remote resolution not called (D6)
5. **HIGH** — Add "No Card = No Voucher" enforcement (G3)
6. **MEDIUM** — Enforce 30-day rule at case level (C1), fix family member gender/DOB (A2/A3), encrypt sync queue (D2)
