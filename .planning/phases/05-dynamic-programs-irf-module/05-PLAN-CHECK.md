# Phase 5: Dynamic Programs & IRF Module — Plan Check

**Checked:** 2026-06-22
**Plans:** 05-01, 05-02, 05-03, 05-04
**Status:** **ISSUES FOUND** (3 blockers, 3 warnings, 2 info)

---

## Summary

The plans cover all 7 requirements across 4 well-structured plans. Task definitions are thorough with TDD-first patterns, detailed actions, and verification criteria. However, **3 locked decisions from CONTEXT.md are contradicted** by the IRF module plan (05-03), where the planner substituted simplified approaches for what the user explicitly decided:

| Decision | User Said | Plan Does | Severity |
|----------|-----------|-----------|----------|
| **D-08** | Client encrypts narration before sending | Server encrypts after receiving plaintext | ❌ BLOCKER |
| **D-09** | Per-record keys wrapped with per-user RSA public keys | Master wrapping key replaces per-user RSA | ❌ BLOCKER |
| **D-11** | DB-level PostgreSQL views with pgcrypto for name masking | Application-layer masking (existing pattern) | ❌ BLOCKER |

Additionally, no VALIDATION.md exists (Nyquist gate fail) and open research questions remain unresolved. Two plans (05-02, 05-03) are at scope warning thresholds.

---

## Per-Plan Analysis

### Plan 05-01: Dynamic Programs CRUD + JSON Schema Form Templates

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirement Coverage | ✅ | PRG-01, PRG-02 fully covered |
| Task Completeness | ✅ | 3 tasks, all have Files+Action+Verify+Done |
| Dependency Correctness | ✅ | Wave 1, no dependencies |
| Key Links Planned | ✅ | ProgramsPage→api.ts, service→entity, controller→service |
| Scope Sanity | ✅ | 3 tasks, 9 files |
| Verification Derivation | ✅ | User-observable truths, concrete artifacts |
| Context Compliance | ✅ | D-01 through D-07 all have implementing tasks |
| Pattern Compliance | ✅ | All files reference PATTERNS.md analogs |

**Verdict:** ✅ READY — No blockers.

---

### Plan 05-02: Program Assignment & Approval Workflow FSM

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirement Coverage | ✅ | PRG-03 fully covered |
| Task Completeness | ✅ | 4 tasks, all have Files+Action+Verify+Done |
| Dependency Correctness | ✅ | Wave 2, depends_on: [05-01] |
| Key Links Planned | ✅ | service→entity, service→interventions, sla→steps |
| Scope Sanity | ⚠️ | 4 tasks (warning threshold), 10 files. Task 2 is large (2 entities, DTO, service, controller, module, migration) |
| Verification Derivation | ✅ | Mostly user-observable truths |
| Context Compliance | ⚠️ | D-03 mentions "during case intake" but no case intake UI integration is planned — API-only. Discretion area, but worth noting. |
| Pattern Compliance | ✅ | All files reference PATTERNS.md analogs |

**Verdict:** ⚠️ WARNINGS — Consider splitting Task 2 into two (entities/DTO/migration, then service/controller/module). Otherwise viable.

---

### Plan 05-03: IRF Encryption, Name Masking & Disposition FSM

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirement Coverage | ✅ | IRF-01, IRF-02, IRF-04 covered |
| Task Completeness | ✅ | 3 tasks, all have Files+Action+Verify+Done |
| Dependency Correctness | ⚠️ | `depends_on: []` but `wave: 2` — inconsistency (should be wave 1) |
| Key Links Planned | ✅ | service→pgcrypto, service→key, service→audit, page→component |
| Scope Sanity | ⚠️ | 13 files modified — at warning threshold |
| Verification Derivation | ✅ | User-observable truths, concrete artifacts |
| Context Compliance | ❌ | **3 BLOCKERS:** D-08, D-09, D-11 contradictions; D-18 partial |
| Research Resolution | ❌ | Open questions unresolved in RESEARCH.md |
| Pattern Compliance | ✅ | Files reference PATTERNS.md analogs |

**Verdict:** ❌ BLOCKERS — See detailed issues below.

---

### Plan 05-04: IRF Secure Export (PDF + JSON) & Audit

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirement Coverage | ✅ | IRF-03 fully covered |
| Task Completeness | ✅ | 3 tasks, all have Files+Action+Verify+Done |
| Dependency Correctness | ✅ | Wave 3, depends_on: [05-03] |
| Key Links Planned | ✅ | export→audit, export→pdfkit, controller→export |
| Scope Sanity | ✅ | 3 tasks, 7 files |
| Verification Derivation | ✅ | User-observable truths, concrete artifacts |
| Context Compliance | ✅ | D-14 through D-16 all implemented |
| Pattern Compliance | ✅ | Files reference PATTERNS.md analogs |

**Verdict:** ✅ READY — No blockers (assuming 05-03 issues are resolved first since it depends on it).

---

## Coverage Matrix

| Requirement | 05-01 | 05-02 | 05-03 | 05-04 | Status |
|-------------|-------|-------|-------|-------|--------|
| **PRG-01** | ✅ | | | | COVERED |
| **PRG-02** | ✅ | | | | COVERED |
| **PRG-03** | | ✅ | | | COVERED |
| **IRF-01** | | | ✅ | | COVERED |
| **IRF-02** | | | ✅ | | COVERED |
| **IRF-03** | | | | ✅ | COVERED |
| **IRF-04** | | | ✅ | | COVERED |

All 7 requirements are covered by at least one plan. ✅

### Success Criteria Coverage

| # | Success Criterion | Primary Plan | Status |
|---|-------------------|-------------|--------|
| 1 | Admin can create/edit programs with name, category, waiting period, required docs, fund sources | 05-01 | ✅ |
| 2 | Program config includes JSON Schema form template rendered dynamically | 05-01 | ✅ |
| 3 | Configurable multi-step approval workflow with role-based gates | 05-02 | ✅ |
| 4 | Staff submit IRF with blotter entry, case category, Item A/B/C; narration AES-256 encrypted | 05-03 | ✅ (encryption mechanism per plan, but D-08/D-09 contradicted) |
| 5 | Names masked by default; secure export requires legal_basis_code + audit | 05-03, 05-04 | ⚠️ (masking is app-layer not DB views per D-11) |
| 6 | IRF disposition tracks through Under Investigation → Referred → Closed | 05-03 | ✅ |

---

## Issues Found

### BLOCKERS (must fix before execution)

#### B1. [context_compliance] D-08 — Server-side encryption replaces client-side encryption (05-03)

- **Plan:** 05-03
- **Task:** 2
- **User decision (D-08):** *"Full end-to-end encryption. Client encrypts victim narration before sending over HTTPS. Server stores encrypted blob."*
- **Plan action:** `encryptWithPgcrypto()` receives `narration` as plaintext string from the request body and encrypts it server-side via `irfRepo.query()` with pgcrypto `encrypt()`. The client sends narration in the clear (over HTTPS) to the server.
- **Why it's a blocker:** The plan contradicts the locked decision. D-08 explicitly requires client-side encryption. The plan delivers server-side encryption. While the research recommends simplification, CONTEXT.md was not updated to reflect user approval of this change.
- **Fix hint:** Either (a) implement client-side AES-256 encryption using Web Crypto API before the narration leaves the browser, or (b) acknowledge the deviation and update D-08 in CONTEXT.md with user approval before execution.

---

#### B2. [context_compliance] D-09 — Simplified master wrapping key replaces per-user RSA public key wrapping (05-03)

- **Plan:** 05-03
- **Task:** 2
- **User decision (D-09):** *"Per-IRF record key — each IRF gets a unique AES-256 key. The key is encrypted with authorized users' public keys and stored alongside the record. Re-encrypt on role/consent changes."*
- **Plan action:** Implements a simplified two-tier scheme where the per-record key is encrypted with a single master wrapping key (`userId: 'master'`), not per-user RSA public keys.
- **Why it's a blocker:** D-09 mandates per-user RSA key wrapping and re-encryption on role changes. The plan uses a single master wrapping key with no per-user key isolation. While the research recommends this simplification for MVP, the locked decision in CONTEXT.md hasn't been updated to reflect this.
- **Fix hint:** Either (a) implement the full per-user RSA key infrastructure (generate RSA key pairs per user, wrap per-record key with each authorized user's public key), or (b) document the accepted simplification in CONTEXT.md with user approval.

---

#### B3. [context_compliance] D-11 — Application-layer masking instead of PostgreSQL VIEWs (05-03)

- **Plan:** 05-03
- **Task:** 2
- **User decision (D-11):** *"DB-level masking via PostgreSQL views with pgcrypto. Default views return masked names (e.g., initials only). Queries with explicit legal_basis_code + audit context access unmasked views."*
- **Plan action:** Keeps the existing application-layer name masking in IrfService (which already masks in `findAll()` and `findById()`). Does NOT create any PostgreSQL views. The plan context says "Use app-layer name masking (already done in IrfService) per Pattern 3 recommendation."
- **Why it's a blocker:** D-11 explicitly and specifically requires PostgreSQL views with pgcrypto. The discussion log shows the user chose "DB-level with pgcrypto views" (✓ checked). The plan defers to the simpler existing approach without updating the decision.
- **Fix hint:** Either (a) create the PostgreSQL VIEWs (`masked_irf_cases` and `unmasked_irf_cases`) with pgcrypto-based conditional decryption per D-11, or (b) document the accepted deviation in CONTEXT.md.

---

#### B4. [nyquist_compliance] VALIDATION.md missing — Nyquist gate fail

- **Dimension:** 8 (Nyquist Compliance)
- **Issue:** No `05-VALIDATION.md` file exists in the phase directory.
- **Severity:** BLOCKER
- **Finding:** Nyquist validation is enabled (config default: `true`), but no VALIDATION.md was generated. Per the gate rules, this is a blocking failure.
- **Fix hint:** Re-run `/gsd-plan-phase 05 --research` to regenerate with Nyquist validation artifacts, or create `05-VALIDATION.md` manually per the Nyquist template.

---

#### B5. [research_resolution] Open questions unreolved in RESEARCH.md

- **Dimension:** 11 (Research Resolution)
- **Issue:** The `## Open Questions` section in 05-RESEARCH.md (lines 815-835) lacks the `(RESOLVED)` suffix on the heading, and individual questions have no `RESOLVED` markers.
- **Severity:** BLOCKER
- **Unresolved questions:**
  1. Per-record key vs. simplified key wrapping for MVP
  2. PostgreSQL VIEW-based name masking feasibility
  3. RSA key pair generation and storage strategy
  4. PDF export template design
- **Fix hint:** Add `(RESOLVED)` to the `## Open Questions` heading and mark each question with `RESOLVED:` followed by the resolution outcome. The decisions in CONTEXT.md effectively resolve these — the markers just need to be added.

---

### WARNINGS (should fix)

#### W1. [context_compliance] D-18 — Admin override not implemented for IRF disposition FSM (05-03)

- **Plan:** 05-03
- **Task:** 2
- **User decision (D-18):** *"Disposition states follow same strict FSM pattern as Phase 3 Cases — no backward transitions, admin override with reason as exception."*
- **Plan action:** Implements strict FSM transitions (no backward transitions) but does NOT include an admin override endpoint or method. The Phase 3 CasesService has `overrideStatus()` — no parallel exists in the IRF service.
- **Why a warning:** The core FSM functionality works. Admin override is an edge case for unusual situations. However, D-18 explicitly requires it "with reason as exception."
- **Fix hint:** Add an override endpoint (e.g., `PATCH /api/irf/:id/override-disposition`) with reason validation, restricted to admin role.

---

#### W2. [dependency_correctness] Wave/Dependency mismatch on Plan 05-03 (05-03)

- **Plan:** 05-03
- **Issue:** `depends_on: []` but `wave: 2`. Per dependency rules, `depends_on: []` = Wave 1. The plan has no actual dependencies on 05-01 or 05-02 (IRF is independent of Programs).
- **Severity:** WARNING
- **Fix hint:** Either set `depends_on: []` and `wave: 1` (can run parallel with 05-01), or keep wave 2 and document the reason (e.g., conservative scheduling).

---

#### W3. [scope_sanity] Task and file count at warning thresholds (05-02, 05-03)

- **Plan 05-02:** 4 tasks (warning threshold). Task 2 touches 8 files (2 entities, DTO, service, controller, 2 module files, migration) — large scope for a single task.
- **Plan 05-03:** 13 files modified (warning threshold). Task 2 manages 8 files including 2 new services, entity changes, controller, module, and migration.
- **Severity:** WARNING
- **Fix hint (05-02):** Consider splitting Task 2 into: (a) entities, DTO, migration and (b) service, controller, module integration.
- **Fix hint (05-03):** Consider splitting Task 2 into: (a) entity, migration, DTO and (b) services (key, audit) and (c) service rewrite + controller.

---

### INFO (suggestions)

#### I1. [scope_reduction] D-03 — Program assignment not surfaced in case intake UI

- **Plan:** 05-02
- **Issue:** D-03 says "Program assignment is part of case intake. When the social worker creates/edits a case, they can assign the beneficiary to one or more programs." The plan creates the backend API but doesn't add a program assignment UI widget to the existing case intake form (IntakePage/CasesForm).
- **Severity:** INFO — "Program assignment UI in case intake flow" is in the agent's Discretion, so the planner has freedom. But the D-03 decision references this capability during intake.
- **Suggestion:** Consider adding a task to display program assignments on the case intake/edit page, or at minimum document that this UI integration is deferred.

#### I2. [verification_derivation] Implementation-focused truths in must_haves

- **Plan 05-02, 05-03**
- **Issue:** Some `must_haves.truths` describe implementation details rather than user-observable outcomes:
  - 05-02: "The system materializes ProgramAssignmentStep records from the program's approval_workflow JSONB config" — user-observable truth would be "Approval steps are visible to the approver"
  - 05-03: "Each IRF record has its own AES-256 key wrapped with a master wrapping key" — user-observable truth would be "Narration remains encrypted and only decryptable with authorized access"
- **Suggestion:** Reframe these as user-observable outcomes. The executor still needs the implementation details, but must_haves should describe what the user experiences.

---

## Nyquist Compliance

| Task | Plan | Wave | Automated Command | Status |
|------|------|------|-------------------|--------|
| 05-01 T1 | 05-01 | 1 | `npx jest --no-cache programs.service.spec --testNamePattern="create" 2>&1 \| grep -c "FAIL"` | Cannot validate — no VALIDATION.md |
| 05-01 T2 | 05-01 | 1 | `npx jest --no-cache programs.service.spec --testNamePattern="create" 2>&1 \| grep -c "PASS"` | Cannot validate — no VALIDATION.md |
| 05-01 T3 | 05-01 | 1 | `cd ...kapwa-client && npx vite build 2>&1 \| tail -5` | Cannot validate — no VALIDATION.md |
| 05-02 T1 | 05-02 | 2 | `npx jest --no-cache program-assignments.service.spec 2>&1 \| grep -c "FAIL"` | Cannot validate — no VALIDATION.md |
| 05-02 T2 | 05-02 | 2 | `npx jest --no-cache program-assignments.service.spec 2>&1 \| grep -c "PASS\|pass"` | Cannot validate — no VALIDATION.md |
| 05-02 T3 | 05-02 | 2 | Manual check only (no automated) | Cannot validate — no VALIDATION.md |
| 05-02 T4 | 05-02 | 2 | `cd ...kapwa-client && npx vite build 2>&1 \| tail -5` | Cannot validate — no VALIDATION.md |
| 05-03 T1 | 05-03 | 2 | `npx jest --no-cache irf.service.spec 2>&1 \| grep -c "FAIL"` | Cannot validate — no VALIDATION.md |
| 05-03 T2 | 05-03 | 2 | `npx jest --no-cache irf.service.spec 2>&1 \| grep -c "PASS\|pass"` | Cannot validate — no VALIDATION.md |
| 05-03 T3 | 05-03 | 2 | `cd ...kapwa-client && npx vite build 2>&1 \| tail -5` | Cannot validate — no VALIDATION.md |
| 05-04 T1 | 05-04 | 3 | `npx jest --no-cache irf-export.service.spec 2>&1 \| grep -c "FAIL"` | Cannot validate — no VALIDATION.md |
| 05-04 T2 | 05-04 | 3 | `npx jest --no-cache irf-export.service.spec 2>&1 \| grep -c "PASS\|pass"` | Cannot validate — no VALIDATION.md |
| 05-04 T3 | 05-04 | 3 | `cd ...kapwa-client && npx vite build 2>&1 \| tail -5` | Cannot validate — no VALIDATION.md |

**Overall:** ❌ FAIL — VALIDATION.md missing (gate failure). All Nyquist checks 8a-8d cannot proceed.

---

## Decisions Compliance Matrix

| Decision | Plan(s) | Status |
|----------|---------|--------|
| D-01 | 05-01 | ✅ Implemented |
| D-02 | 05-01 | ✅ Checklist in ProgramsPage; MinIO upload is discretion |
| D-03 | 05-02 | ✅ API created; UI integration is discretion |
| D-04 | 05-01, 05-02 | ✅ ApprovalStep JSONB + runtime approval |
| D-05 | 05-02 | ✅ rejectStep() sets REJECTED |
| D-06 | 05-02 | ✅ SLA cron for program steps |
| D-07 | 05-02 | ✅ materializeIntervention() |
| **D-08** | **05-03** | **❌ BLOCKER — Server-side encrypt vs client-side** |
| **D-09** | **05-03** | **❌ BLOCKER — Master key vs per-user RSA** |
| D-10 | 05-03 | ✅ pgcrypto used |
| **D-11** | **05-03** | **❌ BLOCKER — App-layer masking vs DB views** |
| D-12 | 05-03 | ✅ Two-step unlock |
| D-13 | 05-03 | ✅ Any authenticated user with code |
| D-14 | 05-04 | ✅ PDF + JSON export |
| D-15 | 05-04 | ✅ Audit logged before export |
| D-16 | 05-04 | ✅ LegalBasis at export time |
| D-17 | 05-03 | ✅ 4-state FSM |
| D-18 | 05-03 | ⚠️ WARNING — No admin override endpoint |

---

## Architectural Tier Compliance (Dimension 7c)

Checked against the Architectural Responsibility Map in RESEARCH.md. Key findings:

| Capability | Expected Tier | Plan Tier | Status |
|------------|--------------|-----------|--------|
| Program CRUD | API + Client | API + Client | ✅ |
| JSON Schema rendering | Browser/Client | Browser/Client (JsonSchemaForm.tsx) | ✅ |
| Approval workflow definition | API (JSONB) | API (JSONB) | ✅ |
| Multi-step approval processing | API/Backend | API/Backend | ✅ |
| Program→Intervention materialization | API/Backend | API/Backend | ✅ |
| IRF submission | API + Client | API + Client | ✅ |
| AES-256 encryption per-record key | API + Database (pgcrypto) | API + Database (pgcrypto) | ✅ (tier correct despite D-08 mechanism issue) |
| Key wrapping | API/Backend | API/Backend (IrfKeyService) | ✅ |
| Name masking | Database (VIEWs) | Application layer | ❌ Wrong tier per D-11 |
| Legal basis audit | API + Database | API + Database (IrfAuditService) | ✅ |
| WCPD/PNP export | API/Backend | API/Backend (IrfExportService) | ✅ |
| Disposition FSM | API/Backend | API/Backend | ✅ |

**Overall:** ⚠️ Name masking is assigned to application layer instead of database views. This is a tier mismatch.

---

## Structured Issues (YAML)

```yaml
issues:
  - plan: "05-03"
    dimension: "context_compliance"
    severity: "blocker"
    description: "D-08: Client-side encryption not implemented — server encrypts narration after receiving plaintext. D-08 requires full end-to-end encryption with client encrypting before sending."
    task: 2
    fix_hint: "Implement client-side AES-256 via Web Crypto API before HTTPS send, or update D-08 in CONTEXT.md with user approval of server-side approach."

  - plan: "05-03"
    dimension: "context_compliance"
    severity: "blocker"
    description: "D-09: Per-user RSA key wrapping not implemented — simplified master wrapping key used instead. D-09 requires per-record AES keys wrapped with each authorized user's RSA public key."
    task: 2
    fix_hint: "Implement per-user RSA key pair generation, per-record key wrapping with each authorized user's public key, or update D-09 in CONTEXT.md with user approval of simplified two-tier scheme."

  - plan: "05-03"
    dimension: "context_compliance"
    severity: "blocker"
    description: "D-11: DB-level PostgreSQL views for name masking not created — application-layer masking used instead. D-11 requires PostgreSQL views with pgcrypto for default masked views and conditional unmasked views."
    task: 2
    fix_hint: "Create masked_irf_cases and unmasked_irf_cases VIEWs, or update D-11 in CONTEXT.md with user approval of application-layer approach."

  - plan: null
    dimension: "nyquist_compliance"
    severity: "blocker"
    description: "VALIDATION.md not found for phase 5. Nyquist validation is enabled but no VALIDATION.md artifact exists. Per gate rules, this is a blocking failure."
    fix_hint: "Re-run with --research flag to regenerate Nyquist artifacts, or manually create 05-VALIDATION.md."

  - plan: null
    dimension: "research_resolution"
    severity: "blocker"
    description: "Open questions in RESEARCH.md lack (RESOLVED) markers. Section heading has no (RESOLVED) suffix. 4 questions remain unmarked."
    fix_hint: "Add RESOLVED markers to all open questions and (RESOLVED) to section heading. Resolutions are implied by CONTEXT.md decisions — formalize them."

  - plan: "05-03"
    dimension: "context_compliance"
    severity: "warning"
    description: "D-18: Admin override endpoint missing for IRF disposition FSM. Phase 3 CasesService has overrideStatus() but IRF service has no equivalent."
    task: 2
    fix_hint: "Add PATCH /api/irf/:id/override-disposition endpoint with reason validation, admin role gate."

  - plan: "05-03"
    dimension: "dependency_correctness"
    severity: "warning"
    description: "depends_on: [] but wave: 2 — inconsistent. IRF module has no dependency on 05-01 or 05-02."
    fix_hint: "Change wave to 1 or document conservative scheduling rationale."

  - plan: "05-02"
    dimension: "scope_sanity"
    severity: "warning"
    description: "4 tasks per plan (threshold). Task 2 covers 8 files including 2 entities, DTO, service, controller, 2 module files, migration."
    fix_hint: "Split Task 2 into entities/DTO/migration and service/controller/module."

  - plan: "05-03"
    dimension: "scope_sanity"
    severity: "warning"
    description: "13 files modified across 3 tasks. Task 2 modifies 8 files including 2 new services."
    fix_hint: "Split Task 2 into entity/migration/DTO, services creation, and service rewrite blocks."

  - plan: "05-02"
    dimension: "context_compliance"
    severity: "info"
    description: "D-03 program assignment integrated into case intake is API-only. No UI integration in case intake form."
    fix_hint: "Document as deferral or add task for case intake UI integration."

  - plan: "05-02"
    dimension: "verification_derivation"
    severity: "info"
    description: "Some must_haves truths describe implementation details rather than user-observable outcomes."
    fix_hint: "Reframe: 'Approval steps visible to approver' instead of 'system materializes steps from JSONB'."

  - plan: "05-03"
    dimension: "verification_derivation"
    severity: "info"
    description: "'Each IRF record has its own AES-256 key' is implementation-focused."
    fix_hint: "Reframe: 'Narration remains encrypted and only decryptable with authorized access'."
```

---

## Architectural Tier Assessment

The name masking implementation at the application layer instead of database views (D-11) also constitutes a tier mismatch. The Architectural Responsibility Map assigns name masking to "Database (VIEWs)" with "API / Backend" as secondary. The plan assigns it entirely to the application layer. This is not a security-sensitive mismatch (the app-layer approach still masks names) but it contradicts the user's explicit decision for DB-level views.

---

## Recommendation

**Status: ISSUES FOUND — RETURN TO PLANNER**

3 blockers prevent clean execution. The core issue is that Plans 05-03 delivers simplified implementations that contradict 3 locked decisions (D-08, D-09, D-11). These appear to be research-informed simplifications that never received user approval in CONTEXT.md.

**Recommended path for each blocker:**

| Blocker | Fix Option A (Full Delivery) | Fix Option B (Document Simplification) |
|---------|------------------------------|----------------------------------------|
| D-08 | Implement Web Crypto client-side AES-256 before HTTPS send | Update D-08 to accept server-side encryption, noting the deviation |
| D-09 | Implement per-user RSA key pairs, per-record key wrapping per user | Update D-09 to accept simplified master-key wrapping for MVP |
| D-11 | Create masked_irf_cases + unmasked_irf_cases VIEWs per D-11 spec | Update D-11 to accept application-layer masking |

If the user accepts these simplifications, update CONTEXT.md and RESEARCH.md, then the plans are viable. The remaining warnings (scope, dependency, admin override) can be addressed during execution or are low-impact.

Plan 05-01: ✅ Ready
Plan 05-02: ⚠️ Ready with minor warnings
Plan 05-03: ❌ Blocked — requires resolution of D-08, D-09, D-11 before execution
Plan 05-04: ✅ Ready (depends on 05-03, but code is independent)

Additionally, VALIDATION.md must be created and RESEARCH.md open questions must be marked resolved before proceeding.
